import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNestedGraph } from '../../packages/runtime/src/graph/nested-validate.ts';
import { planNestedGraph } from '../../packages/runtime/src/graph/nested-plan.ts';
import { basic, twins, fanout, clone, hash, uuid, node, graphDef, meta, ref, cref, edge, signal, image, control, controlFanout } from './nested-graph-fixtures.ts';
import type { NestedExecutionPlan, NestedDefinition, NodeControlOverride } from '../../packages/runtime-contracts/src/nested-graph.ts';
const admitted=(v:any)=>validateNestedGraph(v.graph,v.definitions);
test('same-hash nested instances retain paths, defaults, pruned targets and independent plans',()=>{
 const v=twins(), accepted=admitted(v), p=planNestedGraph(accepted);
 assert.deepEqual(p.nodes.map(n=>n.nodePath),[[uuid(1),uuid(3)]]);assert.deepEqual(p.nodes[0]!.initialControls,{gain:5});
 assert.deepEqual(p.prunedNodePaths,[[uuid(2),uuid(3)]]);assert.deepEqual(p.publicControlBindings.gain,[{nodePath:[uuid(1),uuid(3)],controlId:'gain',active:true}]);
 const second=planNestedGraph(accepted);assert.deepEqual(second,p);assert.notEqual(second.nodes,p.nodes);assert.notEqual(second.nodes[0]!.initialControls,p.nodes[0]!.initialControls);
 v.graph.outputPort='b';const q=planNestedGraph(admitted(v));assert.deepEqual(q.nodes[0]!.initialControls,{gain:7});assert.equal(q.publicControlBindings.gain![0]!.active,false);
});
test('explicit caller patches win without quantization and overlapping writer routes reject',()=>{
 const v=admitted(twins());const path=[uuid(1),uuid(3)] as any;
 assert.equal(planNestedGraph(v,[{nodePath:path,values:{gain:6.125}}]).nodes[0]!.initialControls.gain,6.125);
 for(const overrides of [[{nodePath:[],values:{gain:6}},{nodePath:path,values:{gain:6}}],[{nodePath:path,values:{gain:6}},{nodePath:[],values:{gain:6}}]])assert.throws(()=>planNestedGraph(v,overrides),/overlap/);
 assert.throws(()=>planNestedGraph(v,[{nodePath:[uuid(99)] as any,values:{gain:6}}]),/path/);
 assert.throws(()=>planNestedGraph(v,[{nodePath:path,values:{}}]),/nonempty/);
});
test('nested 4096-edge graph prunes to one consumer with sixteen distinct inputs and one producer',()=>{
 const p=planNestedGraph(admitted(fanout()));assert.equal(p.nodes.length,2);assert.equal(p.nodes[1]!.inputs.length,16);assert.deepEqual(p.nodes.map(n=>n.nodePath),[[uuid(1),uuid(1)],[uuid(2),uuid(1)]]);assert.equal(p.prunedNodePaths.length,255);
});
test('forged admission fails and output records are recursively immutable',()=>{
 const v=admitted(basic());assert.throws(()=>planNestedGraph(clone(v)),/validated/);const p=planNestedGraph(v);assert.throws(()=>{(p.nodes[0]!.nodePath as any).push(uuid(4));},TypeError);
});
test('nested diamond shares its producer and keeps distinct parallel input connections',()=>{
 const v={graph:{version:2,rootDefinitionHash:hash(1),outputPort:'image'},definitions:{
 [hash(1)]:graphDef([node(1,2),node(2,3),node(3,3),node(4,5)],[edge(1,uuid(1),'s',uuid(2),'s'),edge(2,uuid(1),'s',uuid(3),'s'),edge(3,uuid(2),'s',uuid(4),'left'),edge(4,uuid(3),'s',uuid(4),'right')],{},{image:ref(4)}),
 [hash(2)]:{kind:'code',metadata:meta({},{s:signal})},
 [hash(3)]:graphDef([node(5,4)],[],{s:[ref(5,'a'),ref(5,'b')]},{s:ref(5,'s')},{},meta({s:signal},{s:signal})),
 [hash(4)]:{kind:'code',metadata:meta({a:signal,b:signal},{s:signal})},
 [hash(5)]:{kind:'code',metadata:meta({left:signal,right:signal})}}};
 const p=planNestedGraph(admitted(clone(v)));
 assert.deepEqual(p.nodes.map(n=>n.nodePath),[[uuid(1)],[uuid(2),uuid(5)],[uuid(3),uuid(5)],[uuid(4)]]);
 assert.deepEqual(p.nodes[1]!.inputs,[{portId:'a',source:{nodePath:[uuid(1)],portId:'s'}},{portId:'b',source:{nodePath:[uuid(1)],portId:'s'}}]);
 const reordered:any=clone(v);reordered.definitions[hash(1)].body.nodes.reverse();reordered.definitions[hash(1)].body.edges.reverse();assert.deepEqual(planNestedGraph(admitted(reordered)),p);
});
test('configured defaults resolve literal1 through5 at the documented enclosing levels',()=>{
 const v=twins();assert.equal(planNestedGraph(admitted(v)).nodes[0]!.initialControls.gain,5);
 v.definitions[hash(1)].metadata=meta({},{a:image,b:image});v.definitions[hash(1)].body.controlBindings={};assert.equal(planNestedGraph(admitted(v)).nodes[0]!.initialControls.gain,4);
 v.definitions[hash(1)].body.nodes[0].controlDefaults={};assert.equal(planNestedGraph(admitted(v)).nodes[0]!.initialControls.gain,3);
 v.definitions[hash(2)].metadata=meta();v.definitions[hash(2)].body.controlBindings={};v.definitions[hash(1)].body.nodes[1].controlDefaults={};assert.equal(planNestedGraph(admitted(v)).nodes[0]!.initialControls.gain,2);
 v.definitions[hash(2)].body.nodes[0].controlDefaults={};assert.equal(planNestedGraph(admitted(v)).nodes[0]!.initialControls.gain,1);
});
test('overrides validate inactive targets, unique paths, numeric values and bounded ordinary data',()=>{
 const v=admitted(twins()),path=[uuid(2),uuid(3)] as any;
 assert.deepEqual(planNestedGraph(v,[{nodePath:path,values:{gain:8}}]).nodes[0]!.initialControls,{gain:5});
 for(const values of [{gain:NaN},{gain:Infinity},{gain:11},{other:1}] as Record<string,number>[])assert.throws(()=>planNestedGraph(v,[{nodePath:path,values}]),(e:any)=>e.code==='INVALID_NESTED_GRAPH');
 assert.throws(()=>planNestedGraph(v,[{nodePath:path,values:{gain:8}},{nodePath:[...path],values:{gain:9}}]),/duplicate override path/);
 let reads=0;const values=Object.defineProperty({},'gain',{enumerable:true,get(){reads++;return 2;}});assert.throws(()=>planNestedGraph(v,[{nodePath:path,values}]),/own data/);assert.equal(reads,0);
 const tooMany=Array.from({length:513},()=>({nodePath:[],values:{gain:1}}));assert.throws(()=>planNestedGraph(v,tooMany),/512/);
});
test('large public control fanout preserves every inactive address without sharing snapshots',()=>{
 const p=planNestedGraph(admitted(controlFanout()));assert.equal(p.nodes.length,1);assert.equal(p.prunedNodePaths.length,511);assert.equal(p.publicControlBindings.c0!.length,512);assert.equal(p.publicControlBindings.c0!.filter(t=>t.active).length,1);
 assert.notEqual(p.publicControlBindings.c0![0]!.nodePath,p.publicControlBindings.c1![0]!.nodePath);
});
test('override byte quota applies to the actual array at equality, including punctuation',()=>{
 const v=admitted(basic()),make=(n:number)=>[{nodePath:[],values:{['x'.repeat(n)]:1}}] as any;
 const baseline=Buffer.byteLength(JSON.stringify(make(0))),exact=make(262144-baseline);
 assert.equal(Buffer.byteLength(JSON.stringify(exact)),262144);
 assert.throws(()=>planNestedGraph(v,exact),(e:any)=>e.code==='INVALID_NESTED_GRAPH'&&!/byte budget/.test(e.message));
 assert.throws(()=>planNestedGraph(v,make(262145-baseline)),/raw JSON byte budget/);
});
test('512 unique scene patches validate before pruning with no shared leaf values',()=>{
 const v=admitted(controlFanout());const overrides=Array.from({length:512},(_,i)=>({nodePath:[uuid(1+Math.floor(i/64)),uuid(1+i%64)] as any,values:{c0:6.25}}));
 const p=planNestedGraph(v,overrides);assert.equal(p.nodes[0]!.initialControls.c0,6.25);assert.equal(p.nodes[0]!.initialControls.c1,1);assert.equal(p.prunedNodePaths.length,511);
 assert.throws(()=>planNestedGraph(v,[...overrides,{nodePath:[],values:{c0:6}}]),/512/);
});
test('reordered complete definitions and binding targets preserve canonical admission and plan',()=>{
 const v=controlFanout(),first=admitted(v),shuffled=clone(v);shuffled.definitions=Object.fromEntries(Object.entries(shuffled.definitions).reverse());
 for(const d of Object.values(shuffled.definitions) as any[]){if(d.kind!=='graph')continue;d.body.nodes.reverse();d.body.edges.reverse();for(const field of ['inputBindings','outputBindings','controlBindings']){d.body[field]=Object.fromEntries(Object.entries(d.body[field]).reverse());for(const value of Object.values(d.body[field]))if(Array.isArray(value))value.reverse();}}
 const second=admitted(shuffled);assert.deepEqual(second,first);assert.deepEqual(planNestedGraph(second),planNestedGraph(first));
});

// Compile-only misuse examples exercise the new DTOs, not runtime casts.
function readonlyContract(plan:NestedExecutionPlan,definition:NestedDefinition,override:NodeControlOverride){
 // @ts-expect-error readonly structured path
 plan.nodes[0]!.nodePath.push(uuid(1));
 // @ts-expect-error readonly values
 plan.nodes[0]!.initialControls.gain=2;
 // @ts-expect-error readonly public binding collection
 plan.publicControlBindings.x=[];
 // @ts-expect-error numeric patches only
 override.values.gain='bad';
 if(definition.kind==='code'){
  // @ts-expect-error code definitions do not carry graph bodies
  definition.body;
 }else{
  // @ts-expect-error immutable graph body nodes
  definition.body.nodes=[];
 }
}
void readonlyContract;
