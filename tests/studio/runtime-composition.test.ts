import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { StandaloneClient } from '../../apps/studio/src/standalone-client.ts';
import { compileVisual } from '../../apps/build-worker/src/compile.mjs';
import { linkRuntime } from '../../apps/build-worker/src/link-runtime.mjs';
import { nestedCompositionSourceBundle, compositeAId, compositeBId, wrapperNodeId, wrappedEffectId, directEffectId } from '../compiler/composition-fixture.mjs';
import { createCompositionControlState } from '../../packages/runtime/src/components/composition-controls.ts';
import type { SourceBundle } from '../../packages/runtime-contracts/src/index.ts';

class CompositionWorker {
  static all:CompositionWorker[]=[];
  static autoReady=true;
  onmessage:any;onerror:any;messages:any[]=[];init:any;terminated=false;
  constructor(){CompositionWorker.all.push(this);}
  postMessage(message:any){this.messages.push(message);if(message.type==='init'){this.init=message;if(CompositionWorker.autoReady)queueMicrotask(()=>this.reply({type:'ready'}));}}
  reply(extra:any){this.onmessage?.({data:{...this.init,type:'status',frameId:'1',timeSeconds:0,clockEpoch:0,controlSequence:0,playback:this.init.playing?'playing':'paused',...extra,effectiveNodeControls:extra.effectiveNodeControls??extra.nodeControls??this.init.nodeControls}});}
  terminate(){this.terminated=true;}
}

test('Studio saves, reopens, edits and restarts nested composition instances while a failed rebuild retains them',async t=>{
  const source=nestedCompositionSourceBundle() as SourceBundle,options={dependencyRoot:process.env.LUX_COMPILER_DEPENDENCIES||resolve('node_modules')};
  const compiled=await compileVisual({source},options);if(!compiled.ok||!('artifactVersion' in compiled.artifact)||compiled.artifact.artifactVersion!==5)assert.fail(JSON.stringify(compiled));const linked=await linkRuntime(compiled.artifact,options);if(!('linkedVersion' in linked)||linked.linkedVersion!==5)assert.fail('expected composition link');
  const originals=new Map(['Worker','document'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  Object.defineProperty(globalThis,'Worker',{value:CompositionWorker,configurable:true});
  Object.defineProperty(globalThis,'document',{value:{createElement:()=>({style:{},transferControlToOffscreen:()=>({}),remove(){}})},configurable:true});
  CompositionWorker.all=[];CompositionWorker.autoReady=true;let compiles=0;
  const compiler={compile:async(input:any)=>{compiles++;if(input.files['composite.ts']==='invalid')return {ok:false,diagnostics:[{code:'COMPILE_FAILED',message:'invalid nested composition'}]};return {ok:true,sourceHash:compiled.artifact.sourceHash,linked};}} as any;
  const client=new StandaloneClient(compiler,{codeDeclaredParameters:true});
  t.after(()=>{const runtime=(client as any).running;if(runtime)(client as any).stop(runtime,'test complete');for(const [key,value]of originals)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});
  const saved=createCompositionControlState(linked.composition);saved.apply({ballIntensity:.6,segmentsA:5,segmentsB:11});
  await client.submit(source,{savedControls:{sourceHash:compiled.artifact.sourceHash,nodes:saved.snapshot().nodes}});
  const worker=CompositionWorker.all.at(-1)!;assert.deepEqual(client.getSnapshot().authoring!.controls,{ballIntensity:.6,segmentsA:5,segmentsB:11});
  const persisted=client.getSnapshot().authoring!.nodeControls!;
  assert.deepEqual(persisted.nodes.find(row=>row.nodePath.join('/')===[compositeAId,wrapperNodeId,wrappedEffectId].join('/'))!.values,{segments:5});
  assert.deepEqual(persisted.nodes.find(row=>row.nodePath.join('/')===[compositeBId,directEffectId].join('/'))!.values,{segments:11});
  const runtime=client.getSnapshot().authoring!,write=client.invoke({name:'lux.parameters.set',input:{requestId:'change-a',instanceId:runtime.instanceId,expectedGeneration:runtime.generation,expectedRevisionId:runtime.revisionId,expectedControlSchemaHash:runtime.controlSchemaHash,values:{segmentsA:8},mode:'live'}});
  const command=worker.messages.at(-1),next=createCompositionControlState(linked.composition,worker.init.nodeControls);next.apply(command.values);
  worker.reply({requestId:'change-a',controls:next.values(),nodeControls:next.snapshot(),controlSequence:1});await write;
  assert.deepEqual(client.getSnapshot().authoring!.controls,{ballIntensity:.6,segmentsA:8,segmentsB:11});
  worker.reply({controls:worker.init.controls,nodeControls:worker.init.nodeControls,controlSequence:0});
  assert.deepEqual(client.getSnapshot().authoring!.controls,{ballIntensity:.6,segmentsA:8,segmentsB:11},'delayed older composition state must not replace canonical leaf values');
  assert.deepEqual(client.getSnapshot().authoring!.composition,linked.composition,'graph describes the accepted composition');
  const node=persisted.nodes.find(row=>row.nodePath.join('/')===[compositeAId,wrapperNodeId,wrappedEffectId].join('/'))!;
  const nodeInput={requestId:'node-a',instanceId:runtime.instanceId,expectedGeneration:runtime.generation,expectedRevisionId:runtime.revisionId,expectedControlSchemaHash:node.schemaHash,nodePath:node.nodePath,values:{segments:7},mode:'live' as const};
  await assert.rejects(client.invoke({name:'lux.node.parameters.set',input:{...nodeInput,expectedRevisionId:'stale'}}),/Revision changed/);
  await assert.rejects(client.invoke({name:'lux.node.parameters.set',input:{...nodeInput,expectedControlSchemaHash:'0'.repeat(64)}}),/schema changed/);
  await assert.rejects(client.invoke({name:'lux.node.parameters.set',input:{...nodeInput,values:{segments:999}}}));
  const nodeWrite=client.invoke({name:'lux.node.parameters.set',input:nodeInput});
  assert.equal(worker.messages.at(-1).type,'node-controls');
  next.applyNode(node.nodePath,{segments:7},node.schemaHash);
  worker.reply({requestId:'node-a',controls:next.values(),nodeControls:next.snapshot(),controlSequence:2});await nodeWrite;
  assert.deepEqual(client.getSnapshot().authoring!.controls,{ballIntensity:.6,segmentsA:7,segmentsB:11});
  const binding={nodePath:node.nodePath,definitionHash:node.definitionHash,schemaHash:node.schemaHash,controlId:'segments',shape:'sine' as const,periodSeconds:2,amount:3,phase:0,enabled:true};
  const animationWrite=client.invoke({name:'lux.node.animation.set',input:{requestId:'animate-a',instanceId:runtime.instanceId,expectedGeneration:runtime.generation,
    expectedRevisionId:runtime.revisionId,expectedControlSchemaHash:node.schemaHash,nodePath:node.nodePath,controlId:'segments',animation:binding}} as any);
  assert.deepEqual(worker.messages.at(-1),{type:'animations',requestId:'animate-a',instanceId:runtime.instanceId,generation:runtime.generation,animationSequence:1,controlAnimations:[binding]});
  worker.reply({requestId:'animate-a',controls:next.values(),nodeControls:next.snapshot(),controlSequence:2,controlAnimations:[binding],animationSequence:1});await animationWrite;
  assert.deepEqual(client.getSnapshot().authoring!.controlAnimations,[binding]);
  worker.reply({controls:next.values(),nodeControls:next.snapshot(),controlSequence:2,controlAnimations:[],animationSequence:0});
  assert.deepEqual(client.getSnapshot().authoring!.controlAnimations,[binding],'delayed animation state must not replace the newer binding');
  await assert.rejects(client.submit({...source,files:{...source.files,'composite.ts':'invalid'}} as any),/invalid nested composition/);
  assert.equal(client.getSnapshot().authoring!.generation,runtime.generation);const before=compiles;
  await client.invoke({name:'lux.runtime.restart',input:{requestId:'restart',instanceId:runtime.instanceId,expectedGeneration:runtime.generation}});
  assert.equal(compiles,before);assert.deepEqual(CompositionWorker.all.at(-1)!.init.controls,{ballIntensity:.6,segmentsA:7,segmentsB:11});
  assert.deepEqual(CompositionWorker.all.at(-1)!.init.nodeControls.nodes.find((row:any)=>row.nodePath.join('/')===[compositeAId,wrapperNodeId,wrappedEffectId].join('/')).values,{segments:7});
  assert.deepEqual(CompositionWorker.all.at(-1)!.init.controlAnimations,[binding]);
  const accepted=client.getSnapshot().authoring!,reopened=new StandaloneClient(compiler,{codeDeclaredParameters:true});
  t.after(()=>{const runtime=(reopened as any).running;if(runtime)(reopened as any).stop(runtime,'test complete');});
  await reopened.submit(source,{savedControls:accepted.nodeControls!,savedControlAnimations:accepted.controlAnimations});
  assert.deepEqual(reopened.getSnapshot().authoring!.controls,{ballIntensity:.6,segmentsA:7,segmentsB:11});
  assert.deepEqual(reopened.getSnapshot().authoring!.controlAnimations,[binding]);
  assert.deepEqual(reopened.getSnapshot().authoring!.nodeControls!.nodes.find(row=>row.nodePath.join('/')===[compositeBId,directEffectId].join('/'))!.values,{segments:11},'the other reusable composition instance reopens independently');

  const active=(client as any).running as {worker:CompositionWorker},beforeReplacement=client.getSnapshot().authoring!;
  const workerCount=CompositionWorker.all.length;CompositionWorker.autoReady=false;let replacementError:unknown;const replacement=client.submit(source);void replacement.catch(error=>{replacementError=error;});
  for(let i=0;i<200&&CompositionWorker.all.length===workerCount&&!replacementError;i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(CompositionWorker.all.length,workerCount+1,String(replacementError));
  const candidate=CompositionWorker.all.at(-1)!;assert.notEqual(candidate,active.worker);
  const latestNode=beforeReplacement.nodeControls!.nodes.find(row=>row.nodePath.join('/')===node.nodePath.join('/'))!;
  const inFlight=client.invoke({name:'lux.node.parameters.set',input:{requestId:'replacement-node',instanceId:beforeReplacement.instanceId,
    expectedGeneration:beforeReplacement.generation,expectedRevisionId:beforeReplacement.revisionId,expectedControlSchemaHash:latestNode.schemaHash,
    nodePath:latestNode.nodePath,values:{segments:9},mode:'live'}});
  candidate.reply({type:'ready'});await Promise.resolve();assert.equal(active.worker.terminated,false);
  const latest=createCompositionControlState(linked.composition,active.worker.init.nodeControls);latest.applyNode(latestNode.nodePath,{segments:9},latestNode.schemaHash);
  active.worker.reply({requestId:'replacement-node',controls:latest.values(),nodeControls:latest.snapshot(),controlSequence:1,controlAnimations:[binding],animationSequence:0});await inFlight;
  assert.deepEqual(client.getSnapshot().authoring!.nodeControls!.nodes.find(row=>row.nodePath.join('/')===latestNode.nodePath.join('/'))!.values,{segments:9});
  for(let i=0;i<8;i++)await Promise.resolve();const synchronized=candidate.messages.at(-1)!;
  assert.equal(synchronized.type,'node-controls');assert.deepEqual(synchronized.nodePath,latestNode.nodePath);assert.deepEqual(synchronized.values,{segments:9});
  const promoted=createCompositionControlState(linked.composition,candidate.init.nodeControls);promoted.applyNode(synchronized.nodePath,synchronized.values,synchronized.controlSchemaHash);
  candidate.reply({requestId:synchronized.requestId,controls:promoted.values(),nodeControls:promoted.snapshot(),controlSequence:synchronized.controlSequence,
    controlAnimations:[binding],animationSequence:0});await replacement;
  const acceptedDocument:any=client.acceptedDocument();
  assert.deepEqual(acceptedDocument.controls.nodes.find((row:any)=>row.nodePath.join('/')===latestNode.nodePath.join('/')).values,{segments:9});
  assert.deepEqual(acceptedDocument.controlAnimations,[binding]);assert.equal(active.worker.terminated,true);
});
