import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchRuntimeCommand,triggerInputSchema} from '../../apps/studio/src/runtime-operations.ts';
import {StudioController,isUncertainTriggerError} from '../../apps/studio/src/service-client.ts';
import type {RuntimeView,StudioClient,StudioOperation,StudioSnapshot} from '../../apps/studio/src/service-client.ts';
import {StandaloneClient} from '../../apps/studio/src/standalone-client.ts';
import {compileVisual} from '../../apps/build-worker/src/compile.mjs';
import {linkRuntime} from '../../apps/build-worker/src/link-runtime.mjs';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {nestedCompositionSourceBundle,compositeAId,wrapperNodeId,wrappedEffectId} from '../compiler/composition-fixture.mjs';
import {compositionControlSchema} from '../../packages/runtime/src/components/composition-controls.ts';
import {canonicalControlSchemaJson} from '../../packages/runtime-contracts/src/parameters.mjs';

const trigger={id:'regenerate',type:'trigger',label:'Regenerate',changeCost:'live'} as const;
function fixture(){
 const operations:StudioOperation[]=[];
 const runtime={instanceId:'instance',generation:3,revisionId:'revision',sceneName:'Trigger fixture',authority:'studio',playback:'paused',clockEpoch:0,timeSeconds:2,frameId:'8',
  output:{width:1280,height:720},fault:null,sdkVersion:'0.2.0',controlSchema:[trigger],controlSchemaHash:'a'.repeat(64),controls:{},controlSequence:0,controlAnimations:[],controlAnimationIssues:[],animationSequence:0} as unknown as RuntimeView;
 const snapshot:StudioSnapshot={connection:'connected',message:null,receivedAtMs:0,authoring:runtime,host:null,jobs:[],visualFps:null,uiFps:null};
 const client:StudioClient={getSnapshot:()=>snapshot,subscribe:()=>()=>{},invoke:async operation=>{operations.push(operation);return {result:'applied',commandId:(operation as any).input.commandId,controlId:'regenerate',nodePath:[],sequence:1,frameId:'9',timeSeconds:2};}};
 return {runtime,client,operations};
}

test('generic trigger dispatch selects flat or node operation while preserving the caller command id',async()=>{
 const {runtime,client,operations}=fixture(),base={commandId:'command-a',instanceId:runtime.instanceId,expectedGeneration:runtime.generation,expectedRevisionId:runtime.revisionId,
  expectedControlSchemaHash:runtime.controlSchemaHash,controlId:'regenerate'};
 assert.equal(triggerInputSchema.parse(base).commandId,'command-a');
 const flat=await dispatchRuntimeCommand(client,'trigger',base);
 const node=await dispatchRuntimeCommand(client,'trigger',{...base,commandId:'command-b',nodePath:['11111111-1111-4111-8111-111111111111']});
 assert.equal(operations[0]!.name,'lux.trigger.fire');assert.equal((operations[0] as any).input.commandId,'command-a');
 assert.equal(operations[1]!.name,'lux.node.trigger.fire');assert.deepEqual((operations[1] as any).input.nodePath,['11111111-1111-4111-8111-111111111111']);
 assert.equal((flat.applied as any).frameId,'9');assert.equal((node.applied as any).commandId,'command-b');
});

test('StudioController sends guarded trigger commands and exposes only timeout as uncertain',async()=>{
 const {client,operations}=fixture(),controller=new StudioController(client,()=> 'request-a');
 const receipt=await controller.fireTrigger('regenerate','command-a');
 assert.equal((receipt as any).result,'applied');assert.deepEqual(operations[0],{name:'lux.trigger.fire',input:{requestId:'request-a',commandId:'command-a',instanceId:'instance',expectedGeneration:3,expectedRevisionId:'revision',expectedControlSchemaHash:'a'.repeat(64),controlId:'regenerate'}});
 assert.equal(isUncertainTriggerError(Object.assign(Error('late'),{code:'TRIGGER_TIMEOUT'})),true);
 assert.equal(isUncertainTriggerError(Object.assign(Error('bad'),{code:'RUNTIME_FAILED'})),false);
});

class TriggerWorker{
 static all:TriggerWorker[]=[];onmessage:any;onerror:any;messages:any[]=[];init:any;terminated=false;
 constructor(){TriggerWorker.all.push(this);}
 postMessage(message:any){this.messages.push(message);if(message.type==='init'){this.init=message;queueMicrotask(()=>this.reply({type:'ready',triggerSequence:0}));}}
  reply(extra:any){const triggerSequence=extra.triggerSequence??0;this.onmessage?.({data:{...this.init,type:'status',frameId:extra.frameId??'1',timeSeconds:0,clockEpoch:0,playback:this.init.playing?'playing':'paused',
  controls:this.init.controls,effectiveControls:this.init.controls,nodeControls:this.init.nodeControls,effectiveNodeControls:this.init.nodeControls,controlSequence:0,controlAnimations:[],controlAnimationIssues:[],animationSequence:0,
  tempo:{bpm:120,beatPosition:0,beatPhase:0,tempoSequence:0},tempoSequence:0,triggerSequence,...extra}});}
 terminate(){this.terminated=true;}
}

test('StandaloneClient settles after the applied receipt and an old duplicate cannot regress latest trigger status',async t=>{
 const source={sdkVersion:'0.2.0' as const,entry:'visual.ts',files:{'visual.ts':await readFile('packages/visual-sdk/examples/actions.ts','utf8')}},options={dependencyRoot:process.env.LUX_COMPILER_DEPENDENCIES||resolve('node_modules')};
 const compiled=await compileVisual({source},options);if(!compiled.ok)assert.fail(JSON.stringify(compiled));const linked=await linkRuntime(compiled.artifact,options);
 const originals=new Map(['Worker','document'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));Object.defineProperty(globalThis,'Worker',{value:TriggerWorker,configurable:true});Object.defineProperty(globalThis,'document',{value:{createElement:()=>({style:{},transferControlToOffscreen:()=>({}),remove(){}})},configurable:true});
 const client=new StandaloneClient({compile:async()=>({ok:true,sourceHash:compiled.artifact.sourceHash,linked})} as any,{codeDeclaredParameters:true});
 t.after(()=>{const running=(client as any).running;if(running)(client as any).stop(running,'test complete');for(const [key,value] of originals)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});
 await client.submit(source);const runtime=client.getSnapshot().authoring!,worker=TriggerWorker.all.at(-1)!,input={requestId:'request-a',commandId:'command-a',instanceId:runtime.instanceId,expectedGeneration:runtime.generation,expectedRevisionId:runtime.revisionId,expectedControlSchemaHash:runtime.controlSchemaHash,controlId:'turn'};
 worker.reply({frameId:'99',triggerSequence:1,latestTriggerReceipt:{result:'applied',commandId:'unsolicited',controlId:'turn',nodePath:[],sequence:1,frameId:'99',timeSeconds:0}});assert.equal(client.getSnapshot().authoring!.triggerSequence,0);
 let settled=false;const pending=client.invoke({name:'lux.trigger.fire',input:{...input,expectedControlSchemaHash:input.expectedControlSchemaHash!}}).finally(()=>{settled=true;});await Promise.resolve();assert.equal(worker.messages.at(-1).type,'trigger');
 const first={result:'applied' as const,commandId:'command-a',controlId:'turn',nodePath:[],sequence:1,frameId:'2',timeSeconds:0};
 const wrongTarget={...first,controlId:'other'};worker.reply({requestId:'request-a',frameId:'2',triggerSequence:1,latestTriggerReceipt:wrongTarget,triggerReceipt:wrongTarget});await Promise.resolve();assert.equal(settled,false);assert.equal(client.getSnapshot().authoring!.triggerSequence,0);
 worker.reply({requestId:'request-a',frameId:'2',triggerSequence:1,latestTriggerReceipt:first,triggerReceipt:{...first,frameId:'999'}});await Promise.resolve();assert.equal(settled,false,'request and latest copies must identify the same completed frame');assert.equal(client.getSnapshot().authoring!.triggerSequence,0);
 worker.reply({requestId:'request-a',frameId:'4',triggerSequence:2,latestTriggerReceipt:{...first,sequence:2,frameId:'4'},triggerReceipt:{...first,sequence:2,frameId:'4'}});await Promise.resolve();assert.equal(settled,false);assert.equal(client.getSnapshot().authoring!.triggerSequence,0);
 worker.reply({requestId:'request-a',frameId:'2',triggerSequence:1,latestTriggerReceipt:first,triggerReceipt:first});assert.deepEqual(await pending,first);assert.deepEqual(client.getSnapshot().authoring!.latestTriggerReceipt,first);
 const secondPending=client.invoke({name:'lux.trigger.fire',input:{...input,expectedControlSchemaHash:input.expectedControlSchemaHash!,requestId:'request-b',commandId:'command-b'}}),second={...first,commandId:'command-b',sequence:2,frameId:'3'};worker.reply({requestId:'request-b',frameId:'3',triggerSequence:2,latestTriggerReceipt:second,triggerReceipt:second});await secondPending;
 let duplicateSettled=false;const duplicate=client.invoke({name:'lux.trigger.fire',input:{...input,expectedControlSchemaHash:input.expectedControlSchemaHash!,requestId:'request-a-late'}}).finally(()=>{duplicateSettled=true;});
 worker.reply({requestId:'request-a-late',frameId:'3',triggerSequence:2,latestTriggerReceipt:second,triggerReceipt:{...first,frameId:'999'}});await Promise.resolve();assert.equal(duplicateSettled,false,'an accepted command receipt is immutable');
 worker.reply({requestId:'request-a-late',frameId:'3',triggerSequence:2,latestTriggerReceipt:second,triggerReceipt:first});assert.deepEqual(await duplicate,first);assert.deepEqual(client.getSnapshot().authoring!.latestTriggerReceipt,second);
 const failed=client.invoke({name:'lux.trigger.fire',input:{...input,expectedControlSchemaHash:input.expectedControlSchemaHash!,requestId:'request-c',commandId:'command-c'}});worker.reply({type:'failure',requestId:'request-c',code:'RUNTIME_FAILED',message:'authored trigger failed'});
 await assert.rejects(failed,error=>(error as {code?:string}).code==='RUNTIME_FAILED');assert.equal(client.getSnapshot().authoring!.fault?.code,'RUNTIME_FAILED');
});

test('nested node trigger aliases post one canonical leaf target and stop before posting if validation loses its generation',async t=>{
 const source=nestedCompositionSourceBundle() as any;source.files['kaleidoscope.ts']=source.files['kaleidoscope.ts'].replace("segments:{type:'number',label:'Segments',default:6,min:2,max:16,step:1}","segments:{type:'trigger',label:'Regenerate'}");
 const options={dependencyRoot:process.env.LUX_COMPILER_DEPENDENCIES||resolve('node_modules')},compiled=await compileVisual({source},options);if(!compiled.ok)assert.fail(JSON.stringify(compiled));const linked=await linkRuntime(compiled.artifact,options);
 const originals=new Map(['Worker','document','crypto'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));Object.defineProperty(globalThis,'Worker',{value:TriggerWorker,configurable:true});Object.defineProperty(globalThis,'document',{value:{createElement:()=>({style:{},transferControlToOffscreen:()=>({}),remove(){}})},configurable:true});
 const client=new StandaloneClient({compile:async()=>({ok:true,sourceHash:compiled.artifact.sourceHash,linked})} as any,{codeDeclaredParameters:true});
 t.after(()=>{const running=(client as any).running;if(running)(client as any).stop(running,'test complete');for(const [key,value] of originals)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});
 await client.submit(source);const runtime=client.getSnapshot().authoring!,worker=TriggerWorker.all.at(-1)!,controller=new StudioController(client,()=> 'nested-request');
 const pending=controller.fireNodeTrigger([compositeAId] as any,'firstSegments','nested-command');
 for(let index=0;index<20&&worker.messages.at(-1)?.type!=='trigger';index++)await new Promise(resolve=>setImmediate(resolve));
 const sent=worker.messages.at(-1);assert.equal(sent.type,'trigger');assert.deepEqual(sent.nodePath,[compositeAId,wrapperNodeId,wrappedEffectId]);assert.equal(sent.controlId,'segments');assert.equal(worker.messages.filter(row=>row.type==='trigger').length,1);
 const receipt={result:'applied' as const,commandId:'nested-command',controlId:'segments',nodePath:[compositeAId,wrapperNodeId,wrappedEffectId],sequence:1,frameId:'2',timeSeconds:0};worker.reply({requestId:'nested-request',frameId:'2',triggerSequence:1,latestTriggerReceipt:receipt,triggerReceipt:receipt});assert.deepEqual(await pending,receipt);

 const schema=compositionControlSchema(runtime.composition!,[compositeAId] as any);
 const expectedControlSchemaHash=createHash('sha256').update(canonicalControlSchemaJson(schema)).digest('hex'),old=(client as any).running,before=worker.messages.length,nativeCrypto=globalThis.crypto;
 let releaseDigest=(_value:ArrayBuffer)=>{};
 Object.defineProperty(globalThis,'crypto',{value:{subtle:{digest:()=>new Promise<ArrayBuffer>(resolveDigest=>{releaseDigest=resolveDigest;})},randomUUID:nativeCrypto.randomUUID.bind(nativeCrypto)},configurable:true});
 const racing=client.invoke({name:'lux.node.trigger.fire',input:{requestId:'race-request',commandId:'race-command',instanceId:runtime.instanceId,expectedGeneration:runtime.generation,expectedRevisionId:runtime.revisionId,expectedControlSchemaHash,nodePath:[compositeAId] as any,controlId:'firstSegments'}});
 await Promise.resolve();(client as any).stop(old,'promoted generation');releaseDigest(new ArrayBuffer(32));
 await assert.rejects(racing,/Runtime changed/);assert.equal(worker.messages.length,before,'stale generation validation never posts to the stopped worker');
});
