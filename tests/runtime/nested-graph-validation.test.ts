import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNestedGraph, workCounter, publish, snapshot } from '../../packages/runtime/src/graph/nested-validate.ts';
import { validateGraph } from '../../packages/runtime/src/graph/validate.ts';
import { basic, twins, chain, leaves, fanout, placements, controlFanout, sizedBody, clone, hash, node, ref, cref, meta, graphDef, signal, image, edge, uuid, control } from './nested-graph-fixtures.ts';
import { sizedMetadata, fanout512 } from './graph-fixtures.ts';
const admit=(v:any)=>validateNestedGraph(v.graph,v.definitions);
const bad=(v:any,rule?:RegExp)=>assert.throws(()=>admit(v),(e:any)=>e.code==='INVALID_NESTED_GRAPH'&&e.message.length<=768&&(!rule||rule.test(e.message)));
test('admits and detaches a source root, preserving exact graph and complete definitions',()=>{
 const v=basic(), result=admit(v); assert.deepEqual(result.graph,v.graph);assert.notEqual(result.definitions,v.definitions);assert.ok(Object.isFrozen(result.definitions[hash(1)]));
});
test('all catalog recursion, missing writers, binding shape and lifecycle reject before pruning',()=>{
 let v=basic();v.definitions[hash(3)]=graphDef([node(1,3)]);bad(v,/recurs/);
 v=basic();v.definitions[hash(3)]=graphDef([node(1,4)]);v.definitions[hash(4)]=graphDef([node(1,3)]);bad(v,/recurs/);
 v=basic();v.definitions[hash(2)].metadata=meta({required:signal});bad(v,/writer|required/);
 v=basic();v.definitions[hash(1)].body.outputBindings.extra=ref(1);bad(v,/binding/);
 v=basic();v.definitions[hash(2)].metadata.lifecycle.state='stateful';bad(v,/lifecycle/);
});
test('depth 8 and pre-pruning 512 leaves pass, their +1 boundaries reject',()=>{
 assert.ok(admit(chain(8)));bad(chain(9),/level|depth/);assert.ok(admit(leaves(512)));bad(leaves(513),/leaf/);
});
test('legal nested fanout accounts for 4096 leaf inputs before allocation and rejects 4097',()=>{
 assert.ok(admit(fanout()));bad(fanout(true),/edge/);
});
test('hostile raw data rejects without getter invocation, including unused definitions',()=>{
 let calls=0;const v=basic();Object.defineProperty(v.definitions[hash(2)].metadata,'label',{get(){calls++;throw Error('executed');},enumerable:true});bad(v,/own data/);assert.equal(calls,0);
 const a=basic();a.definitions[hash(3)]=a.definitions[hash(2)];bad(a,/alias/);
 for(const mutate of [(v:any)=>v.graph[Symbol('x')]=0,(v:any)=>Object.defineProperty(v.graph,'x',{value:1}),(v:any)=>v.graph.outputPort='\ud800',(v:any)=>Object.setPrototypeOf(v.graph,new Date()),(v:any)=>delete v.definitions[hash(1)].body.nodes[0]]){const b=basic();mutate(b);bad(b);}
});
test('control interface mismatch and expanded aliases reject but parent chains pass',()=>{
 assert.ok(admit(twins()));const v=twins();v.definitions[hash(2)].metadata.controls[0].max=9;bad(v,/control/);
});
test('2048 graph-plus-code placements admit before pruning and 2049 rejects despite only512 leaves',()=>{
 assert.ok(admit(placements()));bad(placements(true),/placement/);
});
test('16384 expanded public control targets admit with every boundary alias counted',()=>{
 assert.ok(admit(controlFanout()));bad(controlFanout(true),/control target/);
});
test('raw malformed-hash body counts reject before any descendant descriptor traversal',()=>{
 const v=basic();let reads=0;const guarded=new Proxy({}, {ownKeys(){reads++;throw Error('descendant traversed');}});
 v.definitions['bad.hash']={kind:'graph',metadata:guarded,body:{nodes:Array(129).fill(null),edges:[],inputBindings:{},outputBindings:{},controlBindings:{}}};
 bad(v,/128/);assert.equal(reads,0);
});
test('each public interface is explicit; signals may be nested but cannot be source roots',()=>{
 for(const mutate of [(v:any)=>delete v.definitions[hash(1)].body.outputBindings.image,(v:any)=>v.definitions[hash(1)].body.outputBindings.image=ref(9),(v:any)=>v.definitions[hash(1)].body.outputBindings.image=ref(1,'missing'),(v:any)=>v.definitions[hash(1)].body.inputBindings.x=[],(v:any)=>v.graph.outputPort='missing',(v:any)=>v.graph.rootDefinitionHash=hash(2)]){const v=basic();mutate(v);bad(v);}
 const v=basic();v.definitions[hash(3)]=graphDef([node(1,4)],[],{p:[ref(1,'p')]},{s:ref(1,'s')},{},meta({p:signal},{s:signal}));v.definitions[hash(4)]={kind:'code',metadata:meta({p:signal},{s:signal})};assert.ok(admit(v));v.graph.rootDefinitionHash=hash(3);v.graph.outputPort='s';bad(v,/root public inputs/);
 const s=basic();s.definitions[hash(1)].metadata=meta({},{image:signal});s.definitions[hash(2)].metadata=meta({},{image:signal});bad(s,/selected output/);
});
test('local cycles, duplicate writers and parallel-boundary conflicts reject in unused graphs',()=>{
 const v=basic();v.definitions[hash(4)]={kind:'code',metadata:meta({x:signal},{s:signal})};v.definitions[hash(3)]=graphDef([node(1,4),node(2,4)],[edge(1,uuid(1),'s',uuid(2),'x'),edge(2,uuid(2),'s',uuid(1),'x')],{},{s:ref(1,'s')},{},meta({},{s:signal}));bad(v,/cycle/);
 const w=clone(v);w.definitions[hash(3)].body.edges.pop();w.definitions[hash(3)].metadata=meta({p:signal},{s:signal});w.definitions[hash(3)].body.inputBindings={p:[ref(1,'x'),ref(2,'x')]};bad(w,/duplicate writer/);
 const q=clone(w);q.definitions[hash(3)].body.edges=[];q.definitions[hash(3)].body.inputBindings.p=[ref(1,'x'),ref(1,'x'),ref(2,'x')];bad(q,/duplicate writer/);
});
test('control compatibility checks unit/step presence, ranges and all values without clamping',()=>{
 for(const mutate of [(v:any)=>v.definitions[hash(3)].metadata.controls[0].unit='hz',(v:any)=>delete v.definitions[hash(3)].metadata.controls[0].step,(v:any)=>v.definitions[hash(3)].metadata.controls[0].min=-1,(v:any)=>v.definitions[hash(2)].body.nodes[0].controlDefaults={unknown:2},(v:any)=>v.definitions[hash(2)].body.nodes[0].controlDefaults={gain:11},(v:any)=>v.definitions[hash(2)].body.controlBindings.gain=[],(v:any)=>v.definitions[hash(2)].body.controlBindings.gain=[cref(3),cref(3)]]){const v=twins();mutate(v);bad(v);}
 const v=twins();v.definitions[hash(2)].metadata=meta({},{image},{gain:control(3),other:control(3)});v.definitions[hash(2)].body.controlBindings.other=[cref(3)];bad(v,/control.*writer/);
});
test('raw JSON byte boundary includes graph/definitions wrapper and escaped text',()=>{
 const v=basic();v.graph.extra='';const base=Buffer.byteLength(JSON.stringify([v.graph,v.definitions]));v.graph.extra='x'.repeat(2097152-base);
 bad(v,/unsupported field/);v.graph.extra+='x';bad(v,/raw JSON byte/);
 const d=basic();let nested:any={};d.graph.extra=nested;for(let i=0;i<17;i++){nested.x={};nested=nested.x;}bad(d,/raw depth/);
 const n=basic();n.graph.extra=Array(100000).fill(0);bad(n,/raw value/);
});
test('all metadata retains 64KiB per entry and1MiB aggregate bounds',()=>{
 const v=basic();v.definitions[hash(3)]={kind:'code',metadata:sizedMetadata(65536)};assert.ok(admit(v));v.definitions[hash(3)].metadata=sizedMetadata(65537);bad(v,/metadata.*byte|exceeds/);
 const w=basic();const initial=Buffer.byteLength(JSON.stringify(w.definitions[hash(1)].metadata))+Buffer.byteLength(JSON.stringify(w.definitions[hash(2)].metadata));
 for(let i=0;i<16;i++)w.definitions[hash(i+3)]={kind:'code',metadata:sizedMetadata(i===15?65536-initial:65536)};
 assert.ok(admit(w));w.definitions[hash(18)].metadata=sizedMetadata(65537-initial);bad(w,/aggregate metadata/);
});
test('definition/body raw quotas and invalid extra array keys fail before descendants',()=>{
 const v=basic();for(let i=3;i<=128;i++)v.definitions[hash(i)]={kind:'code',metadata:meta()};assert.ok(admit(v));v.definitions[hash(129)]={kind:'code',metadata:meta()};bad(v,/128/);
 for(const [field,count] of [['nodes',129],['edges',513]] as const){const v=basic();v.definitions[hash(1)].body[field]=Array(count).fill(null);bad(v,/raw array/);}
 const b=basic();b.definitions[hash(1)].body.inputBindings={x:Array(2049).fill(null)};bad(b,/2048/);
 const a=basic();a.definitions[hash(1)].body.nodes.extra=0;bad(a,/property|dense/);
});
test('independent catalog work exhausts a finite global budget even when every standalone graph fits',()=>{
 const v=controlFanout();for(let i=10;i<18;i++)v.definitions[hash(i)]=clone(v.definitions[hash(1)]);bad(v,/resolution work/);
});
test('canonical body quotas accept exact256KiB and aggregate1MiB, reject one byte beyond',()=>{
 assert.ok(admit(sizedBody(262144)));bad(sizedBody(262145),/canonical body byte/);
 const v=sizedBody(209716);for(let i=3;i<=6;i++)v.definitions[hash(i)]=sizedBody(209715).definitions[hash(1)];assert.ok(admit(v));
 v.definitions[hash(6)]=sizedBody(209716).definitions[hash(1)];bad(v,/aggregate body byte/);
});
test('one finite resolution counter permits65536 operations and rejects the next before processing',()=>{
 const charge=workCounter();for(let i=0;i<65536;i++)charge();assert.throws(charge,(e:any)=>e.code==='INVALID_NESTED_GRAPH'&&/resolution work/.test(e.message));
});
test('shared publication gate admits4MiB, rejects the next byte without freezing a failed candidate',()=>{
 const exact={text:'x'.repeat(4194304-11)};assert.equal(Buffer.byteLength(JSON.stringify(exact)),4194304);assert.ok(Object.isFrozen(publish(exact,'test')));
 const over={text:'x'.repeat(4194305-11)};assert.throws(()=>publish(over,'test'),/output byte budget/);assert.equal(Object.isFrozen(over),false);
});
test('raw value/depth counters admit equality and reject +1 independently of later graph shape',()=>{
 assert.equal((snapshot([Array(99999).fill(0)],['fixture'],2097152,false)[0] as unknown[]).length,99999);
 assert.throws(()=>snapshot([Array(100000).fill(0)],['fixture'],2097152,false),/raw value/);
 const chain=(n:number)=>{let value:unknown=0;for(let i=0;i<n;i++)value={x:value};return value;};
 assert.ok(snapshot([chain(16)],['fixture']));assert.throws(()=>snapshot([chain(17)],['fixture']),/raw depth/);
});
test('C03a stays closed to version2 and exact UUID spellings remain separate',()=>{
 const v=basic();assert.throws(()=>validateGraph(v.graph,v.definitions),(e:any)=>e.code==='INVALID_GRAPH');
 const upper='ABCDEFAB-CDEF-ABCD-EFAB-CDEFABCDEFAB',lower=upper.toLowerCase();v.definitions[hash(1)].body.nodes=[{...node(1,2),id:upper},{...node(2,2),id:lower}];v.definitions[hash(1)].body.outputBindings.image={nodeId:upper,portId:'image'};
 const admitted=admit(v);const root=admitted.definitions[hash(1)]!;assert.equal(root.kind,'graph');if(root.kind==='graph')assert.deepEqual(root.body.nodes.map(n=>n.id),[upper,lower]);
});
test('2048 local binding targets and512 ordinary local edges are legal equality fixtures',()=>{
 const v=basic(),ports=Object.fromEntries(Array.from({length:16},(_,i)=>[`p${i}`,signal]));
 v.definitions[hash(4)]={kind:'code',metadata:meta(ports,ports)};
 v.definitions[hash(3)]=graphDef(Array.from({length:127},(_,i)=>node(i+1,4)),[],Object.fromEntries(Object.keys(ports).map(id=>[id,Array.from({length:127},(_,i)=>ref(i+1,id))])),Object.fromEntries(Object.keys(ports).map(id=>[id,ref(1,id)])),{},meta(ports,ports));assert.ok(admit(v));
 v.definitions[hash(5)]={kind:'code',metadata:meta({p0:signal})};v.definitions[hash(3)].body.nodes.push(node(128,5));v.definitions[hash(3)].body.inputBindings.p0.push(ref(128,'p0'));bad(v,/binding target/);
 const flat=fanout512(),s=basic();s.definitions=clone(flat.definitions);s.definitions[hash(99)]=graphDef(flat.graph.nodes.map(n=>({...n,controlDefaults:{}})),flat.graph.edges,{},{image:flat.graph.finalOutput},{},clone({...meta(),lifecycle:{state:'stateful',reset:'seed'}}));s.graph.rootDefinitionHash=hash(99);assert.ok(admit(s));
});
test('deep malformed locations retain bounded path and violated rule together',()=>{
 const v=basic();let r:any={};v.graph.extra=r;for(let i=0;i<18;i++){const next={};r['x'.repeat(96)]=next;r=next;}
 assert.throws(()=>admit(v),(e:any)=>e.code==='INVALID_NESTED_GRAPH'&&e.path.length<=384&&e.message.length<=768&&/raw depth/.test(e.message));
});
test('conservative local cycles reject even when separate internal ports would flatten acyclically',()=>{
 const v=basic();v.definitions[hash(4)]={kind:'code',metadata:meta({},{s:signal})};v.definitions[hash(5)]={kind:'code',metadata:meta({s:signal})};
 v.definitions[hash(3)]=graphDef([node(1,4),node(2,5)],[],{s:[ref(2,'s')]},{s:ref(1,'s')},{},meta({s:signal},{s:signal}));
 v.definitions[hash(1)].body.nodes.push(node(2,3),node(3,3));v.definitions[hash(1)].body.edges=[edge(1,uuid(2),'s',uuid(3),'s'),edge(2,uuid(3),'s',uuid(2),'s')];bad(v,/cycle/);
});
