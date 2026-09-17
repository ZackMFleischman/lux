import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '@babel/parser';
import {createHash} from 'node:crypto';
import {extractCompositionDeclaration} from '../../apps/build-worker/src/composition-declarations.mjs';
import {compositionSourceBundle,ballId,kaleidoscopeAId,kaleidoscopeBId} from '../compiler/composition-fixture.mjs';
import {createCompositionControlState} from '../../packages/runtime/src/components/composition-controls.ts';
import {nodeIdSchema} from '../../packages/runtime-contracts/src/identities.ts';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
function profile(source=compositionSourceBundle()){const asts=Object.fromEntries(Object.entries(source.files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})]));return extractCompositionDeclaration({entry:source.entry,files:source.files,asts,hash})!;}
const ball=nodeIdSchema.parse(ballId),kaleidoA=nodeIdSchema.parse(kaleidoscopeAId),kaleidoB=nodeIdSchema.parse(kaleidoscopeBId);
test('node writes update only their instance and public aliases, rejecting stale or invalid writes atomically',()=>{
 const p=profile(),state=createCompositionControlState(p),node=p.nodes.find(row=>row.nodePath[0]===kaleidoA)!;
 state.applyNode([kaleidoA],{segments:8},node.schemaHash);
 assert.deepEqual(state.nodeValues([kaleidoA]),{segments:8});
 assert.deepEqual(state.nodeValues([kaleidoB]),{segments:6});
 assert.equal(state.values().segmentsA,8);
 const saved=state.snapshot();
 for(const [path,patch,schemaHash] of [[[kaleidoA],{segments:999},node.schemaHash],[[kaleidoA],{missing:1},node.schemaHash],[[kaleidoA],{segments:4},'0'.repeat(64)],[[nodeIdSchema.parse('00000000-0000-4000-8000-000000000000')],{segments:4},node.schemaHash]] as const){
  assert.throws(()=>state.applyNode(path,patch,schemaHash));assert.deepEqual(state.snapshot(),saved);
 }
 assert.deepEqual(createCompositionControlState(p,saved).nodeValues([kaleidoA]),{segments:8});
});
test('composition controls keep one canonical leaf state and derive independent public aliases',()=>{
 const p=profile(),state=createCompositionControlState(p);assert.deepEqual(state.values(),{ballIntensity:.6,segmentsA:6,segmentsB:6});state.apply({ballIntensity:.6,segmentsA:4,segmentsB:9});assert.deepEqual(state.nodeValues([kaleidoA]),{segments:4});assert.deepEqual(state.nodeValues([kaleidoB]),{segments:9});assert.deepEqual(state.values(),{ballIntensity:.6,segmentsA:4,segmentsB:9});
});
test('node snapshots survive declaration reorder and compatible definition updates without retargeting aliases',()=>{
 const p=profile(),before=createCompositionControlState(p);before.apply({ballIntensity:.6,segmentsA:5,segmentsB:11});const saved=before.snapshot();
 const reorderedSource=compositionSourceBundle();
 reorderedSource.files['composition.ts']=reorderedSource.files['composition.ts'].replace(/nodes:\[[\s\S]*?\],edges:/,`nodes:[{id:'${kaleidoscopeBId}',definition:'kaleidoscope'},{id:'${kaleidoscopeAId}',definition:'kaleidoscope'},{id:'${ballId}',definition:'ball'}],edges:`);
 const restored=createCompositionControlState(profile(reorderedSource),saved);assert.deepEqual(restored.nodeValues([kaleidoA]),{segments:5});assert.deepEqual(restored.nodeValues([kaleidoB]),{segments:11});
 const rebound:any=structuredClone(p);rebound.declaration.expose.find((x:any)=>x.id==='segmentsA').nodeId=kaleidoscopeBId;rebound.publicControlBindings.segmentsA[0].nodePath=[kaleidoscopeBId];assert.throws(()=>createCompositionControlState(rebound,saved),/profile|binding|composition|declaration/i);
 const changedSource=compositionSourceBundle();changedSource.files['kaleidoscope.ts']+='\n// Compatible implementation edit.\n';const changed=profile(changedSource);
 const updated=createCompositionControlState(changed,saved);assert.deepEqual(updated.nodeValues([kaleidoA]),{segments:5});assert.deepEqual(updated.nodeValues([kaleidoB]),{segments:11});assert.deepEqual(updated.changes(),[]);
});
test('component updates retain compatible values and report values reset by a narrowed schema',()=>{
 const p=profile(),before=createCompositionControlState(p);before.apply({ballIntensity:.6,segmentsA:5,segmentsB:11});const saved=before.snapshot();
 const changedSource=compositionSourceBundle();changedSource.files['kaleidoscope.ts']=changedSource.files['kaleidoscope.ts'].replace('min:2,max:16','min:2,max:8');const changed=profile(changedSource);
 const updated=createCompositionControlState(changed,saved);
 assert.deepEqual(updated.nodeValues([kaleidoA]),{segments:5});assert.deepEqual(updated.nodeValues([kaleidoB]),{segments:6});
 assert.deepEqual(updated.changes(),[{id:`${kaleidoscopeBId}:segments`,reason:'out-of-range',previousValue:11,value:6}]);
});

test('typed composition node writes preserve Boolean and enum values through public aliases',()=>{
 const typedSource=compositionSourceBundle();
 typedSource.files['ball.ts']=typedSource.files['ball.ts'].replace(
  "intensity:{type:'number',label:'Intensity',default:.6,min:0,max:1,step:.01}",
  "intensity:{type:'boolean',label:'Enabled',default:true}");
 typedSource.files['kaleidoscope.ts']=typedSource.files['kaleidoscope.ts'].replace(
  "segments:{type:'number',label:'Segments',default:6,min:2,max:16,step:1}",
  "segments:{type:'enum',label:'Mode',default:'soft',options:[{id:'soft',label:'Soft'},{id:'hard',label:'Hard'}]}");
 const p=profile(typedSource),state=createCompositionControlState(p);
 const ballNode=p.nodes.find(row=>row.nodePath[0]===ball)!,kaleido=p.nodes.find(row=>row.nodePath[0]===kaleidoA)!;
 assert.deepEqual(state.values(),{ballIntensity:true,segmentsA:'soft',segmentsB:'soft'});
 state.applyNode([ball],{intensity:false},ballNode.schemaHash);
 state.applyNode([kaleidoA],{segments:'hard'},kaleido.schemaHash);
 assert.deepEqual(state.nodeValues([ball]),{intensity:false});
 assert.deepEqual(state.nodeValues([kaleidoA]),{segments:'hard'});
 assert.deepEqual(state.nodeValues([kaleidoB]),{segments:'soft'});
 assert.deepEqual(state.values(),{ballIntensity:false,segmentsA:'hard',segmentsB:'soft'});
 assert.throws(()=>state.applyNode([kaleidoA],{segments:'missing'},kaleido.schemaHash),/segments/i);
});
