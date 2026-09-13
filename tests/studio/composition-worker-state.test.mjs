import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '@babel/parser';
import {createHash} from 'node:crypto';
import {extractCompositionDeclaration} from '../../apps/build-worker/src/composition-declarations.mjs';
import {compositionSourceBundle} from '../compiler/composition-fixture.mjs';
import {prepareWorkerCompositionState} from '../../apps/studio/src/controls/worker-composition-state.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const source=compositionSourceBundle(),asts=Object.fromEntries(Object.entries(source.files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})])),composition=extractCompositionDeclaration({entry:source.entry,files:source.files,asts,hash});
const admission={kind:'composition',sdkVersion:'0.4.0',executionModel:'image-chain-v1',composition,compositionHash:hash(JSON.stringify(composition)),controls:composition.publicControls,controlSchemaHash:hash(JSON.stringify(composition.publicControls))};
function moduleDefinition(){const definitions={};for(const [name,definitionHash] of Object.entries(composition.definitionNames))definitions[name]={kind:'component',sdkVersion:'0.4.0',metadata:composition.definitions[definitionHash].metadata,async create(){throw Error('not called by checker')}};return {default:{kind:'composition',sdkVersion:'0.4.0',definitions,nodes:composition.declaration.nodes,edges:composition.declaration.edges,output:composition.declaration.output,expose:composition.declaration.expose}};}
test('worker composition state derives public values from canonical leaf rows and authenticates imported factories',async()=>{
 const state=await prepareWorkerCompositionState({sdkVersion:'0.4.0',controlSchema:composition.publicControls,controlSchemaHash:admission.controlSchemaHash,controls:{ballIntensity:.6,segmentsA:4,segmentsB:9}},admission);
 assert.deepEqual(state.values(),{ballIntensity:.6,segmentsA:4,segmentsB:9});assert.equal(Object.keys(state.checkDefinition(moduleDefinition())).length,2);assert.deepEqual(state.state().nodeControls.nodes.map(row=>row.values),[{intensity:.6},{segments:4},{segments:9}]);
 state.apply({ballIntensity:.6,segmentsA:7,segmentsB:9},1,admission.controlSchemaHash);assert.deepEqual(state.values(),{ballIntensity:.6,segmentsA:7,segmentsB:9});
});
test('worker rejects definition metadata disagreement before any factory call',async()=>{const state=await prepareWorkerCompositionState({sdkVersion:'0.4.0',controlSchema:composition.publicControls,controlSchemaHash:admission.controlSchemaHash,controls:{ballIntensity:.6,segmentsA:6,segmentsB:6}},admission),module=moduleDefinition();module.default.definitions.ball={...module.default.definitions.ball,metadata:{...module.default.definitions.ball.metadata,label:'Wrong'}};assert.throws(()=>state.checkDefinition(module),/mismatch/i);});
