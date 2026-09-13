import test from 'node:test';
import assert from 'node:assert/strict';
import { A,B,C,D,U,h,h2,h3,hash,uuid,image,signal,clone,node,edge,metadata,basic,diamond,fanout512,sizedMetadata } from './graph-fixtures.ts';
import { normalizeComponentMetadata, canonicalComponentMetadataJson } from '../../packages/runtime-contracts/src/components.mjs';

const api = await import('../../packages/runtime/src/graph/validate.ts').catch(error => {
  if(error.code === 'ERR_MODULE_NOT_FOUND') return undefined;
  throw error;
});
assert.ok(api, 'C03a requires a graph validator implementation');
const {validateGraph,isValidatedGraph} = api;
function invalid(graph:unknown, definitions:unknown, path:RegExp, rule:RegExp) {
  assert.throws(()=>validateGraph(graph,definitions),(error:any)=>{
    assert.equal(error.code,'INVALID_GRAPH'); assert.match(error.path,path); assert.match(error.message,rule);
    assert.ok(error.message.length<=768); return true;
  });
}
test('basic graph is detached, recursively frozen and locally authentic',()=>{
  const f=basic(), saved=clone(f), result=validateGraph(f.graph,f.definitions);
  assert.ok(isValidatedGraph(result)); assert.ok(!isValidatedGraph(clone(result)));
  f.graph.nodes[0]!.definitionHash=h2; f.definitions[h]!.metadata=metadata({},{value:signal});
  assert.deepEqual(result.graph,saved.graph); assert.deepEqual(result.definitions,saved.definitions);
  assert.throws(()=>{(result.graph.nodes as any).push(node(B));},TypeError);
  assert.throws(()=>{(result.definitions[h]!.metadata.lifecycle as any).reset='bad';},TypeError);
});
test('entire graph rejects dangling identity, duplicate writers and missing inputs before pruning',()=>{
  const cases:[string,(f:ReturnType<typeof diamond>)=>void,RegExp,RegExp][]=[
    ['hash',f=>{f.graph.nodes.find(n=>n.id===U)!.definitionHash=hash(99);},/^node:/,/definition/],
    ['node',f=>{f.graph.edges[0]!.from.nodeId=uuid(99);},/^edge:/,/node/],
    ['port',f=>{f.graph.edges[0]!.from.portId='missing';},/^edge:/,/output/],
    ['direction',f=>{f.graph.edges[0]!.from.portId='in';},/^edge:/,/output/],
    ['node duplicate',f=>{f.graph.nodes.push(clone(f.graph.nodes[0]!));},/^node:/,/duplicate/],
    ['edge duplicate',f=>{f.graph.edges.push(clone(f.graph.edges[0]!));},/^edge:/,/duplicate/],
    ['writer',f=>{f.graph.edges.push(edge(9,B,'value',D,'right'));},/^edge:/,/writer/],
    ['missing input',f=>{f.graph.edges.pop();},/^node:/,/required input/],
    ['unreachable input',f=>{f.graph.nodes.find(n=>n.id===U)!.definitionHash=h2;},/^node:/,/required input/],
  ];
  for(const [name,mutate,path,rule] of cases){const f=diamond();mutate(f); const before=clone(f); invalid(f.graph,f.definitions,path,rule);assert.deepEqual(f,before,name);}
});
test('port compatibility is exact and final output must be an image output',()=>{
  for(const unit of ['seconds','']) {const f=diamond(); (f.definitions[h2]!.metadata.inputs.in!.type as any).unit=unit;invalid(f.graph,f.definitions,unit?/^edge:/:/^definitions\./,unit?/type/:/Unicode|points/);}
  const f=diamond(); f.definitions[h2]!.metadata=metadata({in:image},{value:signal});invalid(f.graph,f.definitions,/^edge:/,/type/);
  for(const port of ['value','in','missing']){const g=diamond();g.graph.finalOutput={nodeId:B,portId:port};invalid(g.graph,g.definitions,/graph.finalOutput/,/image|output/);}
  for(const [field,value] of [['colorSpace','srgb'],['alphaMode','straight']] as const){const g=basic();(g.definitions[h]!.metadata.outputs.image!.type as any)[field]=value;invalid(g.graph,g.definitions,/^definitions\./,/linear-srgb/);}
  for(const value of ['sample','event']){const g=diamond();(g.definitions[h2]!.metadata.inputs.in!.type as any).clock=value;invalid(g.graph,g.definitions,/^definitions\./,/frame/);}
});
test('same-step cycles reject even outside the final dependency closure',()=>{
  for(const two of [false,true]){
    const f=basic();f.definitions[h2]={kind:'code',metadata:metadata({in:signal},{value:signal})};
    f.graph.nodes.push(node(B,h2));if(two)f.graph.nodes.push(node(C,h2));
    f.graph.edges.push(edge(1,B,'value',two?C:B,'in'));if(two)f.graph.edges.push(edge(2,C,'value',B,'in'));
    invalid(f.graph,f.definitions,/^node:/,/cycle/);
  }
});
test('all delayed representations and future fields reject without hiding unreachable edges',()=>{
  for(const delay of [undefined,'previous-step',0,1,null,false]){const f=diamond();if(delay===undefined)delete (f.graph.edges[0] as any).delay;else(f.graph.edges[0] as any).delay=delay;invalid(f.graph,f.definitions,/graph.edges\[/,/delay|missing/);}
  for(const mutate of [(f:any)=>f.graph.groups=[],(f:any)=>f.graph.nodes[0].overrides={},(f:any)=>f.graph.finalOutput.nodePath=[A],(f:any)=>f.definitions[h].kind='graph',(f:any)=>f.definitions[h].publicInputs={}]){const f=basic();mutate(f);invalid(f.graph,f.definitions,/graph|definitions/,/field|kind/);}
});
test('raw descriptor admission never runs getters and rejects aliases and exotic data',()=>{
  let reads=0;
  const cases:((f:any)=>void)[]=[
    f=>Object.defineProperty(f.definitions[h].metadata,'label',{enumerable:true,get(){reads++;return 'bad';}}),
    f=>Object.defineProperty(f.graph.nodes[0],'id',{enumerable:true,get(){reads++;return A;}}),
    f=>{f.graph.extra=f.graph.nodes;}, f=>{f.graph.extra=f.graph;},
    f=>{delete f.graph.nodes[0];},f=>{f.graph.nodes.extra=true;},f=>{f.graph[Symbol('x')]=1;},
    f=>Object.defineProperty(f.graph,'extra',{value:1,enumerable:false}),f=>{Object.setPrototypeOf(f.graph,{inherited:1});},
    f=>{Object.setPrototypeOf(f.graph.nodes,null);},f=>{f.graph.extra=()=>1;},f=>{f.graph.extra=undefined;},
    f=>{f.graph.extra=1n;},f=>{f.graph.extra=Symbol('x');},f=>{f.graph.extra=Infinity;},f=>{f.graph.extra=NaN;},f=>{f.graph.extra='\ud800';},
  ];
  for(const mutate of cases){const f=basic();mutate(f);invalid(f.graph,f.definitions,/graph|definitions/,/data|alias|cycle|dense|array|Unicode|finite|plain/);}
  assert.equal(reads,0);
});
test('raw node, edge and definition counts apply before visitation and pruning',()=>{
  const f=basic();f.graph.nodes=Array.from({length:128},(_,i)=>node(uuid(i+1)));assert.equal(validateGraph(f.graph,f.definitions).graph.nodes.length,128);
  f.graph.nodes.push(node(uuid(129)));invalid(f.graph,f.definitions,/graph.nodes/,/128/);
  const d=basic();for(let i=0;i<127;i++)d.definitions[hash(i)]={kind:'code',metadata:clone(metadata())};assert.equal(Object.keys(validateGraph(d.graph,d.definitions).definitions).length,128);
  d.definitions[hash(127)]={kind:'code',metadata:clone(metadata())};invalid(d.graph,d.definitions,/definitions/,/128/);
  const e=fanout512();assert.equal(validateGraph(e.graph,e.definitions).graph.edges.length,512);e.graph.edges.push(edge(900,D,'value',A,'in'));invalid(e.graph,e.definitions,/graph.edges/,/512/);
  const giant=basic();Object.defineProperty(giant.graph.nodes,'length',{value:4294967295});invalid(giant.graph,giant.definitions,/graph.nodes/,/128/);
  const empty=basic();empty.graph.nodes=[];invalid(empty.graph,empty.definitions,/graph.nodes/,/one|1/);
});
test('depth, value, property and byte budgets reject before shape normalization',()=>{
  const depth=basic();let nested:any=null;for(let i=0;i<17;i++)nested={next:nested};(depth.graph as any).extra=nested;invalid(depth.graph,depth.definitions,/graph/,/depth/);
  const values=basic();(values.graph as any).extra=Array.from({length:100000},()=>null);invalid(values.graph,values.definitions,/graph/,/value/);
  const props=basic();(props.graph as any).extra=Object.fromEntries(Array.from({length:100001},(_,i)=>[String(i),null]));invalid(props.graph,props.definitions,/graph/,/propert|value/);
  const bytes=basic();(bytes.graph as any).extra='😀'.repeat(530000);invalid(bytes.graph,bytes.definitions,/graph/,/byte/);
  const long=basic();(long.graph as any).extra='a'.repeat(2097153);invalid(long.graph,long.definitions,/graph/,/string|byte/);
});
test('all raw descriptors are admitted before metadata normalization or caller code',()=>{
  const f=basic();(f.definitions[h]!.metadata as any).key='invalid';let reads=0;
  f.definitions[h2]={kind:'code',metadata:metadata()};Object.defineProperty(f.definitions[h2],'metadata',{enumerable:true,get(){reads++;throw Error('getter executed');}});
  invalid(f.graph,f.definitions,new RegExp(`definitions.${h2}`),/own data/);assert.equal(reads,0);
  const g=basic();Object.defineProperty(g.graph.nodes,'0',{enumerable:true,get(){reads++;throw Error('getter executed');}});g.graph.nodes.length=129;
  invalid(g.graph,g.definitions,/graph.nodes/,/128/);assert.equal(reads,0);
});
test('existing C01 port, control, tag and text limits remain authoritative',()=>{
  const f=basic();f.definitions[h2]={kind:'code',metadata:sizedMetadata(20000)};
  assert.equal(Object.keys(validateGraph(f.graph,f.definitions).definitions[h2]!.metadata.inputs).length,16);
  for(const side of ['inputs','outputs'] as const){const g=clone(f);(g.definitions[h2]!.metadata[side] as any).extra=clone(g.definitions[h2]!.metadata[side].port0);invalid(g.graph,g.definitions,/definitions/,/16 ports/);}
  const control=clone(f);(control.definitions[h2]!.metadata.controls as any).push({...control.definitions[h2]!.metadata.controls[0],id:'extra'});(control.definitions[h2]!.metadata.controlDescriptions as any).extra='Extra';invalid(control.graph,control.definitions,/definitions/,/32 controls/);
  for(const [field,value] of [['tags',Array.from({length:17},()=> 'tag')],['label','x'.repeat(81)],['description','x'.repeat(513)]] as const){const g=clone(f);(g.definitions[h2]!.metadata as any)[field]=value;invalid(g.graph,g.definitions,/definitions/,/16|80|512/);}
});
test('legal Unicode metadata straddles exact per-entry and aggregate canonical byte limits',()=>{
  const bytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
  const one=sizedMetadata(65536);assert.equal(bytes(one),65536);assert.equal(new TextEncoder().encode(canonicalComponentMetadataJson(one)).byteLength,65536);
  const f=basic();f.definitions[h2]={kind:'code',metadata:one};assert.equal(bytes(validateGraph(f.graph,f.definitions).definitions[h2]!.metadata),65536);
  f.definitions[h2]!.metadata=sizedMetadata(65537);invalid(f.graph,f.definitions,/definitions/,/64 KiB/);
  const g=basic(), small=bytes(g.definitions[h]!.metadata);
  for(let i=0;i<15;i++)g.definitions[hash(i)]={kind:'code',metadata:sizedMetadata(65536)};
  g.definitions[hash(15)]={kind:'code',metadata:sizedMetadata(65536-small)};
  assert.equal(Object.values(g.definitions).reduce((n,row)=>n+bytes(row.metadata),0),1048576);
  assert.equal(Object.keys(validateGraph(g.graph,g.definitions).definitions).length,17);
  g.definitions[hash(15)]!.metadata=sizedMetadata(65537-small);invalid(g.graph,g.definitions,/definitions/,/aggregate/);
});
test('raw JSON byte accounting includes wrapper, Unicode and escaped text at exactly 2 MiB',()=>{
  const f=basic();
  // C01 control labels trim valid whitespace. This legal raw representation can
  // reach the raw cap while its normalized metadata stays small.
  const m=clone(metadata());(m as any).controls=[{id:'gain',type:'number',label:'Gain',default:0,min:0,max:1,changeCost:'live'}];(m as any).controlDescriptions={gain:'Escaped "quote" and \\slash 😀'};
  f.definitions[h]!.metadata=m;
  const encode=()=>new TextEncoder().encode(JSON.stringify([f.graph,f.definitions])).byteLength;
  const extra=2097152-encode();(m.controls[0] as any).label=' '.repeat(extra)+'Gain';
  assert.equal(encode(),2097152);const result=validateGraph(f.graph,f.definitions);assert.equal(result.definitions[h]!.metadata.controls[0]!.label,'Gain');
  (m.controls[0] as any).label+=' ';assert.equal(encode(),2097153);invalid(f.graph,f.definitions,/definitions/,/raw JSON byte/);
});
test('invalid shared UUID/hash representations reject without applying mapping normalization',()=>{
  for(const id of [' '+A,A+' ','not-uuid','00000000-0000-4000-8000-00000000000g']){const f=basic();f.graph.nodes[0]!.id=id;invalid(f.graph,f.definitions,/graph.nodes\[0\]/,/UUID/);}
  for(const bad of [h.toUpperCase(),'b'.repeat(63),'g'.repeat(64)]){const f=basic();f.graph.nodes[0]!.definitionHash=bad;invalid(f.graph,f.definitions,/graph.nodes\[0\]/,/hash/);}
  const f=basic();f.definitions['__proto__']= {kind:'code',metadata:metadata()};invalid(f.graph,f.definitions,/definitions/,/plain/);
  const g=diamond();g.graph.edges[0]!.id='bad';invalid(g.graph,g.definitions,/graph.edges\[/,/UUID/);
});
test('maximum legal topology proves the canonical byte cap is dominated by raw counts and C01 names',()=>{
  const f=fanout512(), output='v'.repeat(64), input=(i:number)=>`p${String(i).padStart(63,'0')}`;
  const producer=f.definitions[h]!.metadata.outputs.value!;
  (f.definitions[h]!.metadata as any).outputs={[output]:producer};
  (f.definitions[h2]!.metadata as any).inputs=Object.fromEntries(Object.entries(f.definitions[h2]!.metadata.inputs).map(([id,port])=>[input(Number(id.slice(2))),port]));
  for(const e of f.graph.edges){e.from.portId=output;e.to.portId=input(Number(e.to.portId.slice(2)));}
  for(let i=65;i<=128;i++)f.graph.nodes.push(node(uuid(i),h));
  const graph=validateGraph(f.graph,f.definitions).graph;
  assert.equal(graph.nodes.length,128);assert.equal(graph.edges.length,512);
  // All UUIDs are36 ASCII chars, hashes64, C01 port IDs<=64 ASCII. Maximum
  // encoded node129, edge324, reference125; wrapper and commas yield183213.
  // Actual final image name is shorter. A graph cannot reach262145 bytes while
  // satisfying these earlier invariants; do not bypass them to fake a cap test.
  assert.equal(new TextEncoder().encode(JSON.stringify(graph)).byteLength,183154);
  assert.ok(183213<262144);
});
test('matching non-null units and image wiring preserve metadata labels independently',()=>{
  const g=diamond();for(const row of Object.values(g.definitions))for(const port of [...Object.values(row.metadata.inputs),...Object.values(row.metadata.outputs)])if(port.type.kind==='signal')(port.type as any).unit='seconds';
  assert.equal(validateGraph(g.graph,g.definitions).graph.nodes.length,5);
  const f=clone({graph:{version:1,nodes:[node(A),node(B,h2)],edges:[edge(1,A,'image',B,'in')],finalOutput:{nodeId:B,portId:'image'}},definitions:{[h]:{kind:'code',metadata:metadata()},[h2]:{kind:'code',metadata:metadata({in:image})}}});
  (f.definitions[h2]!.metadata.inputs.in as any).label='Different label';assert.equal(validateGraph(f.graph,f.definitions).graph.edges.length,1);
  (f.definitions[h2]!.metadata.inputs.in as any).type={kind:'geometry'};invalid(f.graph,f.definitions,/definitions/,/unsupported port type/);
});
test('plain null-prototype records admit while dangerous keys remain ordinary rejected data',()=>{
  const f=basic();Object.setPrototypeOf(f.graph,null);Object.setPrototypeOf(f.definitions,null);Object.setPrototypeOf(f.definitions[h]!.metadata,null);
  assert.equal(validateGraph(f.graph,f.definitions).graph.nodes[0]!.id,A);
  const g=basic();Object.defineProperty(g.graph,'__proto__',{value:{polluted:true},enumerable:true});invalid(g.graph,g.definitions,/graph/,/unsupported field/);assert.equal(({} as any).polluted,undefined);
  const badKey=basic();Object.defineProperty(badKey.graph,'\ud800',{value:0,enumerable:true});invalid(badKey.graph,badKey.definitions,/graph/,/Unicode/);
});
