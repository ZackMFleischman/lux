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
  reply(extra:any){this.onmessage?.({data:{...this.init,type:'status',frameId:'1',timeSeconds:0,clockEpoch:0,controlSequence:0,playback:'paused',...extra}});}
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
  await assert.rejects(client.submit({...source,files:{...source.files,'composition.ts':'invalid'}} as any),/invalid composition/);
  assert.equal(client.getSnapshot().authoring!.generation,runtime.generation);const before=compiles;
  await client.invoke({name:'lux.runtime.restart',input:{requestId:'restart',instanceId:runtime.instanceId,expectedGeneration:runtime.generation}});
  assert.equal(compiles,before);assert.deepEqual(CompositionWorker.all.at(-1)!.init.controls,{ballIntensity:.6,segmentsA:8,segmentsB:11});
});
