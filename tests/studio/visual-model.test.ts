import test from 'node:test';
import assert from 'node:assert/strict';
import {compositionOccurrence,compositionNodes,compositionControlTarget,visualControlNode,visualSelection} from '../../apps/studio/src/visual-model.ts';
import {getRuntimeControlState} from '../../apps/studio/src/service-client.ts';
import type {RuntimeView} from '../../apps/studio/src/service-client.ts';
import {nodeIdSchema} from '../../packages/runtime-contracts/src/identities.ts';

const runtime:RuntimeView={instanceId:'flat',generation:1,revisionId:'revision',sceneName:'Saved visual',authority:'studio',playback:'paused',clockEpoch:1,frameId:null,output:{width:320,height:180},fault:null,intensity:.4};

test('legacy visual has a view-only code occurrence at its existing empty control path',()=>{
 const before=JSON.stringify(runtime),state=getRuntimeControlState(runtime),occurrence=compositionOccurrence(runtime,[]);
 assert.equal(occurrence?.definition.kind,'code');
 assert.equal(occurrence?.definitionHash,state.controlSchemaHash);
 assert.deepEqual(occurrence?.metadata.controls,state.controlSchema);
 assert.deepEqual(compositionNodes(runtime).map(node=>node.nodePath),[[]]);
 assert.deepEqual(compositionControlTarget(runtime,[],'intensity'),{nodePath:[],controlId:'intensity'});
 assert.equal(compositionControlTarget(runtime,[],'missing'),undefined);
 assert.equal(compositionOccurrence(runtime,[nodeIdSchema.parse('11111111-1111-4111-8111-111111111111')]),undefined);
 assert.equal(JSON.stringify(runtime),before);
 assert.equal(runtime.composition,undefined);
 assert.equal(runtime.nodeControls,undefined);
});

test('direct parameter visuals retain schema identity and missing graph state is never invented',()=>{
 const schema=getRuntimeControlState(runtime).controlSchema;
 const parameters:RuntimeView={...runtime,sdkVersion:'0.2.0',intensity:undefined,controlSchema:schema,controlSchemaHash:'b'.repeat(64),controls:{intensity:.4},controlSequence:0};
 const node=visualControlNode(parameters,[]);
 assert.equal(node?.definitionHash,'b'.repeat(64));
 assert.equal(node?.schemaHash,'b'.repeat(64));
 assert.deepEqual(node?.values,{intensity:.4});
 assert.equal(compositionOccurrence({...parameters,sdkVersion:'0.4.0'},[]),undefined);
 assert.deepEqual(compositionNodes({...parameters,sdkVersion:'0.4.0'}),[]);
});

test('direct-only selection returns to Scene when a graph visual replaces it',()=>{
 const path:import('../../packages/runtime-contracts/src/graph.ts').NodePath=[];
 assert.equal(visualSelection(runtime,path),path);
 assert.equal(visualSelection({...runtime,...getRuntimeControlState(runtime),sdkVersion:'0.4.0',intensity:undefined},path),null);
 const missing=[nodeIdSchema.parse('11111111-1111-4111-8111-111111111111')];
 assert.equal(visualSelection(runtime,missing),missing,'missing real occurrences retain the existing unavailable-node explanation');
});
