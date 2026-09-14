import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { StandaloneClient } from '../../apps/studio/src/standalone-client.ts';
import { compileVisual } from '../../apps/build-worker/src/compile.mjs';
import { linkRuntime } from '../../apps/build-worker/src/link-runtime.mjs';
import { compositionSourceBundle, kaleidoscopeAId, kaleidoscopeBId } from '../compiler/composition-fixture.mjs';
import { createCompositionControlState } from '../../packages/runtime/src/components/composition-controls.ts';
import { nodeIdSchema } from '../../packages/runtime-contracts/src/identities.ts';
import type { SourceBundle } from '../../packages/runtime-contracts/src/index.ts';

class CompositionWorker {
  static all:CompositionWorker[]=[];
  onmessage:any;onerror:any;messages:any[]=[];init:any;terminated=false;
  constructor(){CompositionWorker.all.push(this);}
  postMessage(message:any){this.messages.push(message);if(message.type==='init'){this.init=message;queueMicrotask(()=>this.reply({type:'ready'}));}}
  reply(extra:any){this.onmessage?.({data:{...this.init,type:'status',frameId:'1',timeSeconds:0,clockEpoch:0,controlSequence:0,playback:'paused',...extra,effectiveNodeControls:extra.effectiveNodeControls??extra.nodeControls??this.init.nodeControls}});}
  terminate(){this.terminated=true;}
}

test('Studio promotes, edits and restarts a composition from canonical leaf snapshots while a failed rebuild retains it',async t=>{
  const source=compositionSourceBundle() as SourceBundle,options={dependencyRoot:process.env.LUX_COMPILER_DEPENDENCIES||resolve('node_modules')};
  const compiled=await compileVisual({source},options);if(!compiled.ok||!('artifactVersion' in compiled.artifact)||compiled.artifact.artifactVersion!==5)assert.fail(JSON.stringify(compiled));const linked=await linkRuntime(compiled.artifact,options);if(!('linkedVersion' in linked)||linked.linkedVersion!==5)assert.fail('expected composition link');
  const originals=new Map(['Worker','document'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  Object.defineProperty(globalThis,'Worker',{value:CompositionWorker,configurable:true});
  Object.defineProperty(globalThis,'document',{value:{createElement:()=>({style:{},transferControlToOffscreen:()=>({}),remove(){}})},configurable:true});
  CompositionWorker.all=[];let compiles=0;
  const client=new StandaloneClient({compile:async(input:any)=>{compiles++;if(input.files['composition.ts']==='invalid')return {ok:false,diagnostics:[{code:'COMPILE_FAILED',message:'invalid composition'}]};return {ok:true,sourceHash:compiled.artifact.sourceHash,linked};}} as any,{codeDeclaredParameters:true});
  t.after(()=>{const runtime=(client as any).running;if(runtime)(client as any).stop(runtime,'test complete');for(const [key,value]of originals)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});
  const saved=createCompositionControlState(linked.composition);saved.apply({ballIntensity:.6,segmentsA:5,segmentsB:11});
  await client.submit(source,{savedControls:{sourceHash:compiled.artifact.sourceHash,nodes:saved.snapshot().nodes}});
  const worker=CompositionWorker.all.at(-1)!;assert.deepEqual(client.getSnapshot().authoring!.controls,{ballIntensity:.6,segmentsA:5,segmentsB:11});
  const persisted=client.getSnapshot().authoring!.nodeControls!;
  assert.deepEqual(persisted.nodes.find(row=>row.nodePath[0]===nodeIdSchema.parse(kaleidoscopeAId))!.values,{segments:5});
  assert.deepEqual(persisted.nodes.find(row=>row.nodePath[0]===nodeIdSchema.parse(kaleidoscopeBId))!.values,{segments:11});
  const runtime=client.getSnapshot().authoring!,write=client.invoke({name:'lux.parameters.set',input:{requestId:'change-a',instanceId:runtime.instanceId,expectedGeneration:runtime.generation,expectedRevisionId:runtime.revisionId,expectedControlSchemaHash:runtime.controlSchemaHash,values:{segmentsA:8},mode:'live'}});
  const command=worker.messages.at(-1),next=createCompositionControlState(linked.composition,worker.init.nodeControls);next.apply(command.values);
  worker.reply({requestId:'change-a',controls:next.values(),nodeControls:next.snapshot(),controlSequence:1});await write;
  assert.deepEqual(client.getSnapshot().authoring!.controls,{ballIntensity:.6,segmentsA:8,segmentsB:11});
  worker.reply({controls:worker.init.controls,nodeControls:worker.init.nodeControls,controlSequence:0});
  assert.deepEqual(client.getSnapshot().authoring!.controls,{ballIntensity:.6,segmentsA:8,segmentsB:11},'delayed older composition state must not replace canonical leaf values');
  assert.deepEqual(client.getSnapshot().authoring!.composition,linked.composition,'graph describes the accepted composition');
  const node=persisted.nodes.find(row=>row.nodePath[0]===nodeIdSchema.parse(kaleidoscopeAId))!;
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
  await assert.rejects(client.submit({...source,files:{...source.files,'composition.ts':'invalid'}} as any),/invalid composition/);
  assert.equal(client.getSnapshot().authoring!.generation,runtime.generation);const before=compiles;
  await client.invoke({name:'lux.runtime.restart',input:{requestId:'restart',instanceId:runtime.instanceId,expectedGeneration:runtime.generation}});
  assert.equal(compiles,before);assert.deepEqual(CompositionWorker.all.at(-1)!.init.controls,{ballIntensity:.6,segmentsA:7,segmentsB:11});
  assert.deepEqual(CompositionWorker.all.at(-1)!.init.nodeControls.nodes.find((row:any)=>row.nodePath[0]===kaleidoscopeAId).values,{segments:7});
  assert.deepEqual(CompositionWorker.all.at(-1)!.init.controlAnimations,[binding]);
});
