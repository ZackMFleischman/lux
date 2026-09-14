import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '@babel/parser';
import {createHash} from 'node:crypto';
import {extractCompositionDeclaration} from '../../apps/build-worker/src/composition-declarations.mjs';
import {compositionSourceBundle,kaleidoscopeAId,kaleidoscopeBId} from '../compiler/composition-fixture.mjs';
import {createCompositionControlState} from '../../packages/runtime/src/components/composition-controls.ts';
import {nodeIdSchema} from '../../packages/runtime-contracts/src/identities.ts';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
function profile(){const source=compositionSourceBundle(),asts=Object.fromEntries(Object.entries(source.files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})]));return extractCompositionDeclaration({entry:source.entry,files:source.files,asts,hash})!;}
const kaleidoA=nodeIdSchema.parse(kaleidoscopeAId),kaleidoB=nodeIdSchema.parse(kaleidoscopeBId);
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
 const reordered:any=structuredClone(p);reordered.nodes.reverse();reordered.declaration.nodes.reverse();const restored=createCompositionControlState(reordered,saved);assert.deepEqual(restored.nodeValues([kaleidoA]),{segments:5});assert.deepEqual(restored.nodeValues([kaleidoB]),{segments:11});
 const rebound:any=structuredClone(p);rebound.declaration.expose.find((x:any)=>x.id==='segmentsA').nodeId=kaleidoscopeBId;rebound.publicControlBindings.segmentsA[0].nodePath=[kaleidoscopeBId];assert.throws(()=>createCompositionControlState(rebound,saved),/profile|binding|composition/i);
 const changed:any=structuredClone(p),declarationNode=changed.declaration.nodes.find((x:any)=>x.id===kaleidoscopeAId),oldHash=changed.definitionNames[declarationNode.definition],nextHash='f'.repeat(64);
 changed.definitionNames[declarationNode.definition]=nextHash;changed.definitions[nextHash]=changed.definitions[oldHash];delete changed.definitions[oldHash];
 for(const node of changed.nodes)if(node.definitionHash===oldHash)node.definitionHash=nextHash;
 for(const node of changed.definitions[changed.graph.rootDefinitionHash].body.nodes)if(node.definitionHash===oldHash)node.definitionHash=nextHash;
 const updated=createCompositionControlState(changed,saved);assert.deepEqual(updated.nodeValues([kaleidoA]),{segments:5});assert.deepEqual(updated.nodeValues([kaleidoB]),{segments:11});assert.deepEqual(updated.changes(),[]);
});
test('component updates retain compatible values and report values reset by a narrowed schema',()=>{
 const p=profile(),before=createCompositionControlState(p);before.apply({ballIntensity:.6,segmentsA:5,segmentsB:11});const saved=before.snapshot(),changed:any=structuredClone(p);
 const sharedHash=changed.nodes.find((x:any)=>x.nodePath[0]===kaleidoscopeAId).definitionHash;
 changed.definitions[sharedHash].metadata.controls[0].max=8;
 for(const node of changed.nodes)if(node.definitionHash===sharedHash){node.schema[0].max=8;node.schemaHash='e'.repeat(64);}
 const updated=createCompositionControlState(changed,saved);
 assert.deepEqual(updated.nodeValues([kaleidoA]),{segments:5});assert.deepEqual(updated.nodeValues([kaleidoB]),{segments:6});
 assert.deepEqual(updated.changes(),[{id:`${kaleidoscopeBId}:segments`,reason:'out-of-range',previousValue:11,value:6}]);
});
