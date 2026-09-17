import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {compileVisual} from '../../apps/build-worker/src/compile.mjs';
import {linkRuntime} from '../../apps/build-worker/src/link-runtime.mjs';
import {StandaloneClient} from '../../apps/studio/src/standalone-client.ts';

const definition={version:1 as const,beats:[{id:'arrival',label:'Arrival',timing:{kind:'timed' as const,durationSeconds:4}},{id:'orbit',label:'Orbit',timing:{kind:'sustained' as const}}],sequence:[{id:'arrival-1',beatId:'arrival',follow:{kind:'manual' as const}}]};
const normal=(init:any,storyRevision=0)=>({definition,capability:init.linked.storyCapability,storyHash:init.storyHash,storyRevision,frame:{state:'normal',storyEpoch:0},phase:'paused',autoAdvance:false,loop:false,effectiveAdvancing:false,sequence:{state:'detached',occurrenceId:null,index:null,nextOccurrenceId:null,dwellElapsedSeconds:0,dwellRemainingSeconds:null,awaitingCue:false},resumeCandidates:[],disabledReasons:{}});
const active=(init:any,storyRevision=1)=>({...normal(init,storyRevision),frame:{state:'active',storyEpoch:1,beatId:'arrival',activationId:1,occurrenceId:null,elapsedSeconds:0,localTimeSeconds:0,progress:0},phase:'running'});
const key=(input:any)=>JSON.stringify({expectedRevisionId:input.expectedRevisionId,expectedStoryHash:input.expectedStoryHash,expectedStoryRevision:input.expectedStoryRevision,action:input.action,...(['launch','replay','loop'].includes(input.action)?{beatId:input.beatId}:{}),...(['start','resume'].includes(input.action)&&input.occurrenceId!==undefined?{occurrenceId:input.occurrenceId}:{}),...(input.action==='set-auto-advance'?{enabled:input.enabled}:{}),...(input.action==='seek'?{localTimeSeconds:input.localTimeSeconds}:{})});

class StoryWorker{
 static all:StoryWorker[]=[];onmessage:any;onerror:any;messages:any[]=[];init:any;
 constructor(){StoryWorker.all.push(this);}
 postMessage(message:any){this.messages.push(message);if(message.type==='init'){this.init=message;queueMicrotask(()=>this.reply({type:'ready',story:normal(message)}));}}
 reply(extra:any){this.onmessage?.({data:{...this.init,type:'status',frameId:extra.frameId??'1',timeSeconds:extra.timeSeconds??0,clockEpoch:0,playback:this.init.playing?'playing':'paused',controls:this.init.controls,effectiveControls:this.init.controls,controlSequence:0,controlAnimations:[],controlAnimationIssues:[],animationSequence:0,tempo:{bpm:120,beatPosition:0,beatPhase:0,tempoSequence:0},tempoSequence:0,triggerSequence:0,...extra}});}
 terminate(){}
}

test('Story host correlates completed-frame receipts and accepts an immutable duplicate after ambient frames',async t=>{
 const source={sdkVersion:'0.2.0' as const,entry:'visual.ts',files:{'visual.ts':await readFile('packages/visual-sdk/examples/story.ts','utf8')}},options={dependencyRoot:process.env.LUX_COMPILER_DEPENDENCIES||resolve('node_modules')};
 const compiled=await compileVisual({source},options);if(!compiled.ok)assert.fail(JSON.stringify(compiled));const linked=await linkRuntime(compiled.artifact,options);
 const originals=new Map(['Worker','document'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));Object.defineProperty(globalThis,'Worker',{value:StoryWorker,configurable:true});Object.defineProperty(globalThis,'document',{value:{createElement:()=>({style:{},transferControlToOffscreen:()=>({}),remove(){}})},configurable:true});
 const client=new StandaloneClient({compile:async()=>({ok:true,sourceHash:compiled.artifact.sourceHash,linked})} as any,{codeDeclaredParameters:true});
 t.after(()=>{const running=(client as any).running;if(running)(client as any).stop(running,'test complete');for(const [key,value] of originals)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});
 await client.submit(source,{story:definition});const runtime=client.getSnapshot().authoring!,worker=StoryWorker.all.at(-1)!;assert.equal(runtime.story?.frame.state,'normal');
 const input={requestId:'story-a',commandId:'command-a',instanceId:runtime.instanceId,expectedGeneration:runtime.generation,expectedRevisionId:runtime.revisionId,expectedStoryHash:runtime.story!.storyHash,expectedStoryRevision:0,action:'launch' as const,beatId:'arrival'};
 let settled=false;const pending=client.invoke({name:'lux.story.transport',input}).finally(()=>{settled=true;});await Promise.resolve();assert.equal(worker.messages.at(-1).type,'story-transport');
 const receipt={result:'applied' as const,commandId:'command-a',action:'launch' as const,storyRevision:1,frameId:'2',timeSeconds:0,story:active(worker.init).frame};
 worker.reply({requestId:'story-a',frameId:'2',story:active(worker.init),storyReceipt:{...receipt,frameId:'99'},storyCommandKey:key(input)});await Promise.resolve();assert.equal(settled,false);
 worker.reply({requestId:'story-a',frameId:'2',story:active(worker.init),storyReceipt:receipt,storyCommandKey:key(input)});assert.deepEqual(await pending,{receipt,currentStatus:active(worker.init)});
 worker.reply({frameId:'3',timeSeconds:1,story:{...active(worker.init),frame:{...active(worker.init).frame,elapsedSeconds:1,localTimeSeconds:1,progress:.25}}});assert.equal(client.getSnapshot().authoring!.story!.storyRevision,1);
 const duplicate=client.invoke({name:'lux.story.transport',input:{...input,requestId:'story-a-retry'}});worker.reply({requestId:'story-a-retry',frameId:'3',timeSeconds:1,story:{...active(worker.init),frame:{...active(worker.init).frame,elapsedSeconds:1,localTimeSeconds:1,progress:.25}},storyReceipt:receipt,storyCommandKey:key(input),storyCommandDuplicate:true});
 assert.deepEqual((await duplicate as any).receipt,receipt,'duplicate retains the original completed-frame identity');
 worker.reply({frameId:'4',story:{...active(worker.init,3),storyRevision:3}});assert.equal(client.getSnapshot().authoring!.story!.storyRevision,1,'unsolicited revision jumps are ignored');

 const lostInput={...input,requestId:'story-lost',commandId:'command-lost',expectedStoryRevision:1,action:'seek' as const,localTimeSeconds:1};delete (lostInput as any).beatId;
 const lost=client.invoke({name:'lux.story.transport',input:lostInput});await Promise.resolve();const wait=(client as any).pending.get('story-lost');clearTimeout(wait.timer);(client as any).pending.delete('story-lost');wait.reject(Object.assign(Error('uncertain'),{code:'STORY_TIMEOUT'}));await assert.rejects(lost,error=>(error as any).code==='STORY_TIMEOUT');
 const completed={...active(worker.init,2),storyRevision:2,frame:{...active(worker.init).frame,storyEpoch:2,localTimeSeconds:1,progress:.25}},lostReceipt={result:'applied' as const,commandId:'command-lost',action:'seek' as const,storyRevision:2,frameId:'4',timeSeconds:1,story:completed.frame};
 worker.reply({frameId:'5',timeSeconds:2,story:{...completed,frame:{...completed.frame,elapsedSeconds:2}}});
 let retrySettled=false;const retry=client.invoke({name:'lux.story.transport',input:{...lostInput,requestId:'story-lost-retry'}}).finally(()=>{retrySettled=true;});
 const wrongKey=key({...lostInput,localTimeSeconds:2});worker.reply({requestId:'story-lost-retry',frameId:'5',timeSeconds:2,story:{...completed,frame:{...completed.frame,elapsedSeconds:2}},storyReceipt:lostReceipt,storyCommandKey:wrongKey,storyCommandDuplicate:true});await Promise.resolve();assert.equal(retrySettled,false,'same action with different payload identity cannot settle');
 worker.reply({requestId:'story-lost-retry',frameId:'5',timeSeconds:2,story:{...completed,frame:{...completed.frame,elapsedSeconds:2}},storyReceipt:lostReceipt,storyCommandKey:key(lostInput),storyCommandDuplicate:true});assert.deepEqual((await retry as any).receipt,lostReceipt,'first-seen exact retry accepts its immutable older completed-frame receipt');
 const invalidInput={...input,requestId:'story-invalid',commandId:'command-invalid',expectedStoryRevision:2,action:'advance' as const};delete (invalidInput as any).beatId;
 const invalid=client.invoke({name:'lux.story.transport',input:invalidInput});await Promise.resolve();worker.reply({type:'command-error',requestId:'story-invalid',code:'OCCURRENCE_REQUIRED',message:'Attach an occurrence',candidates:['arrival-1']});
 await assert.rejects(invalid,error=>(error as any).code==='OCCURRENCE_REQUIRED'&&JSON.stringify((error as any).candidates)==='["arrival-1"]');
});
