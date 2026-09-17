import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoryWorkerGeneration} from '../../apps/studio/src/story/story-worker-generation.mjs';

const story=Object.freeze({version:2,normalVisualId:'normal',crossfadeSeconds:.35,beats:Object.freeze([Object.freeze({id:'move',label:'Move',timing:Object.freeze({kind:'timed',durationSeconds:4}),visualId:'blue'})]),sequence:Object.freeze([])});
const identity=Object.freeze({instanceId:'instance',generation:1,scheduleHash:'a'.repeat(64),capsuleHash:'b'.repeat(64)});
const manifest=Object.freeze({version:1,story,storyHash:'c'.repeat(64),...identity,visuals:Object.freeze([{visualId:'normal'},{visualId:'blue'}])});
const initialVisualStates=Object.freeze(['normal','blue'].map(visualId=>Object.freeze({visualId,sdkVersion:'0.2.0',controlSchema:[],controlSchemaHash:'d'.repeat(64),controls:{},controlSequence:0,controlAnimations:[],animationSequence:0})));
function fixture({deferBlue=false,mutateRenderer=false}={}){
 const events=[],receipts=[],modules=new Map(),states=new Map(),controlSlots=new Map();let releaseBlue;const blueGate=deferBlue?new Promise(resolve=>releaseBlue=resolve):null;
 for(const visualId of ['normal','blue'])modules.set(visualId,{default:{
  controls:[],sdkVersion:'0.2.0',story:visualId==='blue'?{version:1,beats:[{id:'move',kind:'timed',seek:'direct'}]}:undefined,
  async create(context){events.push(`create:${visualId}`);if(visualId==='blue'&&blueGate)await blueGate;return {
   update(frame){events.push(`update:${visualId}:${frame.story.state}`)},
   render(){return context.renderer.render({},{});},reset(){},dispose(){events.push(`dispose:${visualId}`)},
  };},
 }});
 const controlFactory=visualId=>({createSlot(){let sequence=0,audio;const slot={checkDefinition(module){return module.default.create},values(){return {}},sample(){},resolveTrigger(path,controlId){return {nodePath:path,controlId}},apply(values,next){sequence=next},applyAnimations(){},applyAudioSnapshot(snapshot){audio=snapshot},latestAudio(){return audio},state(){return {sdkVersion:'0.2.0',controlSchemaHash:'d'.repeat(64),controls:{},controlSequence:sequence,effectiveControls:{},controlAnimations:[],controlAnimationIssues:[],animationSequence:0}}};const rows=controlSlots.get(visualId)??[];rows.push(slot);controlSlots.set(visualId,rows);return slot}});
 const factories={visual:id=>({controls:controlFactory(id)}),assets:{async acquire(visualId,slotKey){return {leaseId:slotKey,assets:new Map(),images:new Map(),release:async()=>{events.push(`lease:${visualId}`);return true}}},status(){return {leaseCount:0,assetLeaseBytes:0,pendingStagingJobs:0,assetStagingBytes:0}},async dispose(){}},async dispose(){}};
 const sharedModules={capsule:{visuals:[{id:'normal',artifactVersion:3},{id:'blue',artifactVersion:6,storyCapability:{version:1,beats:[{id:'move',kind:'timed',seek:'direct'}]}}]},async importVisual(id){events.push(`import:${id}`);if(mutateRenderer){renderer.setRenderTarget=()=>{throw Error('mutated target')};renderer.render=()=>{throw Error('mutated render')}}return modules.get(id)},status(){return {pendingImports:0,ownedModuleURLs:3}},async dispose(){events.push('modules-dispose')}};
 const renderer={setRenderTarget(){},async render(){events.push('backend')}};const device={queue:{async onSubmittedWorkDone(){events.push('gpu')}}};
 const compositor={slotTarget:index=>({index}),async compose(rows){events.push(`compose:${rows.map(row=>row.weight.toFixed(2)).join(',')}`)},async present(){events.push('present')},async capture(){return new Uint8Array(4)},status(){return {storyTargetBytes:96}},async dispose(){events.push('compositor-dispose')}};
 const tempoClock={snapshot:()=>({beatPosition:0})};
 const generation=createStoryWorkerGeneration({identity,manifest,initialVisualStates,factories,sharedModules,renderer,device,compositor,settings:{width:1,height:1,fps:60,seed:1},tempoClock,onPreparedReceipt:r=>receipts.push(r),onError:error=>events.push(`error:${error.message}`)});
 return {generation,events,receipts,controlSlots,releaseBlue:()=>releaseBlue?.()};
}
test('generation imports only prepared visuals, publishes full visual state, and disposes exact ownership',async()=>{
 const f=fixture();await f.generation.initialize(0);assert.ok(f.events.includes('import:normal'));assert.ok(!f.events.includes('import:blue'));const visualStates=f.generation.visualStates(0);assert.equal(visualStates.length,2);assert.strictEqual(visualStates[0].controlSchema,initialVisualStates[0].controlSchema);assert.equal(visualStates[0].controlSchemaHash,initialVisualStates[0].controlSchemaHash);
 f.generation.command({action:'launch',beatId:'move',commandId:'launch'},1);await f.generation.draw(1.1,'ambient');await f.generation.status(1.1);for(let i=0;i<20&&!f.events.includes('import:blue');i++)await new Promise(resolve=>setTimeout(resolve,0));await f.generation.draw(1.2,'later');
 assert.ok(f.events.includes('import:blue'));assert.equal(f.generation.status(1.2).incoming.visualId,'blue');
 const cleanup=await f.generation.dispose();assert.equal(cleanup.resources.slots,0);for(const event of ['dispose:normal','dispose:blue','lease:normal','lease:blue','compositor-dispose','modules-dispose'])assert.ok(f.events.includes(event),event);
});

test('initial and mid-create audio snapshots reach the delayed candidate before its first frame',async()=>{
 const f=fixture({deferBlue:true}),audio1={generation:1,sequence:1,available:true},audio2={generation:1,sequence:2,available:true};f.generation.audio(audio1,{playing:false,timeSeconds:0});await f.generation.initialize(0);
 f.generation.command({action:'launch',beatId:'move',commandId:'launch'},1);for(let i=0;i<20&&!f.events.includes('create:blue');i++)await new Promise(resolve=>setTimeout(resolve,0));f.generation.audio(audio2,{playing:true,timeSeconds:1});f.releaseBlue();for(let i=0;i<20&&!f.receipts.some(row=>row.commandId==='launch');i++)await new Promise(resolve=>setTimeout(resolve,0));
 const blue=f.controlSlots.get('blue');assert.equal(blue.at(-1).latestAudio().sequence,2);assert.equal(f.receipts.at(-1).commandId,'launch');await f.generation.dispose();
});

test('authored top-level renderer mutation cannot replace the pre-import render backend',async()=>{
 const f=fixture({mutateRenderer:true});await f.generation.initialize(0);assert.ok(f.events.includes('backend'));await f.generation.dispose();
});

test('trigger admission revalidates activation inside the serialized runtime owner',async()=>{
 const f=fixture(),generation=f.generation;await generation.initialize(0);const old=generation.status(0).committed;generation.command({action:'launch',beatId:'move',commandId:'move'},1);for(let i=0;i<20&&!f.receipts.some(row=>row.commandId==='move');i++)await new Promise(resolve=>setTimeout(resolve,0));await assert.rejects(generation.triggerAndDraw({visualId:old.visualId,activationId:old.activationId,controlId:'fire',commandId:'stale',sequence:1},1),/activation is unavailable/);await generation.dispose();
});
