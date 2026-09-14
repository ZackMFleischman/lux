import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '@babel/parser';
import {createHash} from 'node:crypto';
import {extractCompositionDeclaration} from '../../apps/build-worker/src/composition-declarations.mjs';
import {compositionSourceBundle,nestedCompositionSourceBundle,kaleidoscopeAId,kaleidoscopeBId,compositeAId,compositeBId,wrapperNodeId,wrappedEffectId,directEffectId} from '../compiler/composition-fixture.mjs';
import {prepareWorkerCompositionState} from '../../apps/studio/src/controls/worker-composition-state.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const source=compositionSourceBundle(),asts=Object.fromEntries(Object.entries(source.files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})])),composition=extractCompositionDeclaration({entry:source.entry,files:source.files,asts,hash});
const admission={kind:'composition',sdkVersion:'0.4.0',executionModel:'image-chain-v1',composition,compositionHash:hash(JSON.stringify(composition)),controls:composition.publicControls,controlSchemaHash:hash(JSON.stringify(composition.publicControls))};
const kaleidoscopeA=composition.nodes.find(row=>row.nodePath[0]===kaleidoscopeAId);
function moduleDefinition(){const definitions={};for(const [name,definitionHash] of Object.entries(composition.definitionNames))definitions[name]={kind:'component',sdkVersion:'0.4.0',metadata:composition.definitions[definitionHash].metadata,async create(){throw Error('not called by checker')}};return {default:{kind:'composition',sdkVersion:'0.4.0',definitions,nodes:composition.declaration.nodes,edges:composition.declaration.edges,output:composition.declaration.output,expose:composition.declaration.expose}};}
function extract(source){const asts=Object.fromEntries(Object.entries(source.files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})]));return extractCompositionDeclaration({entry:source.entry,files:source.files,asts,hash});}
function runtimeDefinition(profile,definitionHash,memo=new Map()){if(memo.has(definitionHash))return memo.get(definitionHash);const row=profile.definitions[definitionHash];if(row.kind==='code'){const result={kind:'component',sdkVersion:'0.4.0',metadata:row.metadata,async create(){throw Error('not called by checker')}};memo.set(definitionHash,result);return result;}const module=profile.moduleDeclarations[definitionHash],definitions={},result={kind:'composition',sdkVersion:'0.4.0',...module.declaration,definitions};memo.set(definitionHash,result);for(const [name,hash] of Object.entries(module.definitionNames))definitions[name]=runtimeDefinition(profile,hash,memo);return result;}
test('worker composition state derives public values from canonical leaf rows and authenticates imported factories',async()=>{
 const state=await prepareWorkerCompositionState({sdkVersion:'0.4.0',controlSchema:composition.publicControls,controlSchemaHash:admission.controlSchemaHash,controls:{ballIntensity:.6,segmentsA:4,segmentsB:9}},admission);
 assert.deepEqual(state.values(),{ballIntensity:.6,segmentsA:4,segmentsB:9});assert.equal(Object.keys(state.checkDefinition(moduleDefinition())).length,2);assert.deepEqual(state.state().nodeControls.nodes.map(row=>row.values),[{intensity:.6},{segments:4},{segments:9}]);
 state.apply({ballIntensity:.6,segmentsA:7,segmentsB:9},1,admission.controlSchemaHash);assert.deepEqual(state.values(),{ballIntensity:.6,segmentsA:7,segmentsB:9});
});
test('worker rejects definition metadata disagreement before any factory call',async()=>{const state=await prepareWorkerCompositionState({sdkVersion:'0.4.0',controlSchema:composition.publicControls,controlSchemaHash:admission.controlSchemaHash,controls:{ballIntensity:.6,segmentsA:6,segmentsB:6}},admission),module=moduleDefinition();module.default.definitions.ball={...module.default.definitions.ball,metadata:{...module.default.definitions.ball.metadata,label:'Wrong'}};assert.throws(()=>state.checkDefinition(module),/mismatch/i);});
test('worker evaluates one node LFO without replacing its base or changing a sibling instance',async()=>{
 const binding={nodePath:[kaleidoscopeAId],definitionHash:kaleidoscopeA.definitionHash,schemaHash:kaleidoscopeA.schemaHash,controlId:'segments',shape:'sine',periodSeconds:2,amount:3,phase:.25,enabled:true};
 const state=await prepareWorkerCompositionState({sdkVersion:'0.4.0',controlSchema:composition.publicControls,controlSchemaHash:admission.controlSchemaHash,
  controls:{ballIntensity:.6,segmentsA:6,segmentsB:6},controlAnimations:[binding]},admission);
 assert.equal(state.nodeValues([kaleidoscopeAId],0).segments,9);
 assert.equal(state.nodeValues([kaleidoscopeBId],0).segments,6);
 assert.equal(state.values(0).segmentsA,9);
 assert.deepEqual(state.state().controls,{ballIntensity:.6,segmentsA:6,segmentsB:6},'status and persistence retain base values');
 assert.equal(state.values(.5).segmentsA,6);
});
test('worker animation bypass freezes phase and restart returns to configured phase',async()=>{
 const binding={nodePath:[kaleidoscopeAId],definitionHash:kaleidoscopeA.definitionHash,schemaHash:kaleidoscopeA.schemaHash,controlId:'segments',shape:'sine',periodSeconds:2,amount:3,phase:.25,enabled:true};
 const state=await prepareWorkerCompositionState({sdkVersion:'0.4.0',controlSchema:composition.publicControls,controlSchemaHash:admission.controlSchemaHash,
  controls:{ballIntensity:.6,segmentsA:6,segmentsB:6},controlAnimations:[binding]},admission);
 state.applyAnimations([{...binding,enabled:false}],1,.5);
 assert.equal(state.values(9).segmentsA,6,'bypass must return the base');
 state.applyAnimations([binding],2,10);
 assert.equal(state.values(10).segmentsA,6,'reenable resumes the frozen half-cycle');
 assert.equal(state.values(10.5).segmentsA,3);
 state.restartAnimation(binding.nodePath,binding.controlId,10.5);
 assert.equal(state.values(10.5).segmentsA,9);
});
test('worker keeps an incompatible same-path binding disabled instead of retargeting it',async()=>{
 const binding={nodePath:[kaleidoscopeAId],definitionHash:'f'.repeat(64),schemaHash:kaleidoscopeA.schemaHash,controlId:'segments',shape:'sine',periodSeconds:2,amount:3,phase:.25,enabled:true};
 const state=await prepareWorkerCompositionState({sdkVersion:'0.4.0',controlSchema:composition.publicControls,controlSchemaHash:admission.controlSchemaHash,
  controls:{ballIntensity:.6,segmentsA:6,segmentsB:6},controlAnimations:[binding]},admission);
 assert.equal(state.values(0).segmentsA,6);
 assert.match(state.state().controlAnimationIssues[0].message,/changed|incompatible/i);
 assert.deepEqual(state.state().controlAnimations,[binding],'binding identity remains available for save and repair');
});
test('worker recursively authenticates nested composition objects and returns only sealed leaf factories',async()=>{
 const profile=extract(nestedCompositionSourceBundle()),nestedAdmission={...admission,composition:profile,controls:profile.publicControls,controlSchemaHash:hash(JSON.stringify(profile.publicControls))};
 const state=await prepareWorkerCompositionState({sdkVersion:'0.4.0',controlSchema:profile.publicControls,controlSchemaHash:nestedAdmission.controlSchemaHash,controls:{ballIntensity:.6,segmentsA:6,segmentsB:6}},nestedAdmission);
 const runtime=runtimeDefinition(profile,profile.graph.rootDefinitionHash),factories=state.checkDefinition({default:runtime});
 assert.equal(Object.keys(factories).length,2);
 const wrappedPath=[compositeAId,wrapperNodeId,wrappedEffectId],directB=[compositeBId,directEffectId];
 state.apply({ballIntensity:.6,segmentsA:9,segmentsB:11},1,nestedAdmission.controlSchemaHash);
 assert.equal(state.nodeValues(wrappedPath).segments,9);assert.equal(state.nodeValues(directB).segments,11);
 state.applyNode(wrappedPath,{segments:4},2,profile.nodes.find(row=>JSON.stringify(row.nodePath)===JSON.stringify(wrappedPath)).schemaHash);
 assert.equal(state.values().segmentsA,4);assert.equal(state.nodeValues([compositeBId,wrapperNodeId,wrappedEffectId]).segments,6);
});
test('worker rejects nested runtime definition tampering before returning a leaf factory',async()=>{
 const profile=extract(nestedCompositionSourceBundle()),nestedAdmission={...admission,composition:profile,controls:profile.publicControls,controlSchemaHash:hash(JSON.stringify(profile.publicControls))};
 const state=await prepareWorkerCompositionState({sdkVersion:'0.4.0',controlSchema:profile.publicControls,controlSchemaHash:nestedAdmission.controlSchemaHash,controls:{ballIntensity:.6,segmentsA:6,segmentsB:6}},nestedAdmission);
 const runtime=runtimeDefinition(profile,profile.graph.rootDefinitionHash),nested=runtime.definitions.composite.definitions.wrapped.definitions.kaleidoscope;
 runtime.definitions.composite.definitions.wrapped.definitions.kaleidoscope={...nested,metadata:{...nested.metadata,label:'Tampered'}};
 assert.throws(()=>state.checkDefinition({default:runtime}),/mismatch/i);
});
