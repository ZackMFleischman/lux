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
test('composition controls keep one canonical leaf state and derive independent public aliases',()=>{
 const p=profile(),state=createCompositionControlState(p);assert.deepEqual(state.values(),{ballIntensity:.6,segmentsA:6,segmentsB:6});state.apply({ballIntensity:.6,segmentsA:4,segmentsB:9});assert.deepEqual(state.nodeValues([kaleidoA]),{segments:4});assert.deepEqual(state.nodeValues([kaleidoB]),{segments:9});assert.deepEqual(state.values(),{ballIntensity:.6,segmentsA:4,segmentsB:9});
});
test('node snapshots survive declaration reorder but never retarget through alias rebinding or changed definition identity',()=>{
 const p=profile(),before=createCompositionControlState(p);before.apply({ballIntensity:.6,segmentsA:5,segmentsB:11});const saved=before.snapshot();
 const reordered:any=structuredClone(p);reordered.nodes.reverse();reordered.declaration.nodes.reverse();const restored=createCompositionControlState(reordered,saved);assert.deepEqual(restored.nodeValues([kaleidoA]),{segments:5});assert.deepEqual(restored.nodeValues([kaleidoB]),{segments:11});
 const rebound:any=structuredClone(p);rebound.declaration.expose.find((x:any)=>x.id==='segmentsA').nodeId=kaleidoscopeBId;rebound.publicControlBindings.segmentsA[0].nodePath=[kaleidoscopeBId];assert.throws(()=>createCompositionControlState(rebound,saved),/profile|binding|composition/i);
 const changed:any=structuredClone(p),node=changed.nodes.find((x:any)=>x.nodePath[0]===kaleidoscopeAId);node.definitionHash='f'.repeat(64);assert.throws(()=>createCompositionControlState(changed,saved),/profile|schema|definition/i);
});
