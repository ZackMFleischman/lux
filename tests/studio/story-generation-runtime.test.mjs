import test from 'node:test';
import assert from 'node:assert/strict';
import {createStorySchedule} from '../../apps/studio/src/controls/story-schedule.mjs';
import {createStoryGenerationRuntime} from '../../apps/studio/src/controls/story-generation-runtime.mjs';

const story=Object.freeze({version:2,normalVisualId:'normal',crossfadeSeconds:.35,beats:Object.freeze([
 Object.freeze({id:'move',label:'Move',timing:Object.freeze({kind:'timed',durationSeconds:4}),visualId:'blue'}),
]),sequence:Object.freeze([])});
const identity=Object.freeze({instanceId:'instance',generation:1,scheduleHash:'a'.repeat(64),capsuleHash:'b'.repeat(64)});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}};

function fixture(){
 const events=[],prepares=new Map(),slots=new Map(),receipts=[],intermediate=[],failures=[];
 const schedule=createStorySchedule({story,storyHash:'c'.repeat(64),visualCapabilities:[],identity});
 const runtime=createStoryGenerationRuntime({schedule,
  prepareSlot(preparation){events.push(`prepare:${preparation.visualId}`);const wait=deferred();prepares.set(preparation.visualId,{wait,preparation});return wait.promise;},
  async renderSlot(slot,frame){events.push(`render:${slot.id}:${frame.state==='active'?frame.beatId:'normal'}`);},
  async compose(frames){events.push(`compose:${frames.map(frame=>frame.slot.id+':'+frame.weight.toFixed(2)).join(',')}`);},
  async settleGpu(){events.push('gpu');},
  async disposeSlot(slot){events.push(`dispose:${slot.id}`);slots.delete(slot.id);},
  onReceipt(receipt){receipts.push(receipt);},onIntermediateFrame(result){intermediate.push(result)},onError(error,preparation){events.push(`error:${error.code??error.message}`);failures.push({error,preparation})},
 });
 const complete=async(visualId,id)=>{const row=prepares.get(visualId);const slot={id};slots.set(id,slot);row.wait.resolve(slot);await runtime.idle();};
 return {runtime,schedule,events,prepares,receipts,intermediate,failures,complete};
}

test('preparation remains outside the draw chain and receipt follows first composed GPU frame',async()=>{
 const f=fixture();f.runtime.initialize(0);await f.complete('normal','normal-slot');assert.equal(f.receipts.length,1);
 f.events.length=0;f.runtime.command({action:'launch',beatId:'move',commandId:'launch'},1);
 await f.runtime.draw(1.1,'ambient');
 assert.deepEqual(f.events,['prepare:blue','render:normal-slot:normal','compose:normal-slot:1.00','gpu'],'outgoing continues while create is pending');
 f.events.length=0;await f.complete('blue','blue-slot');
 assert.deepEqual(f.events,['render:blue-slot:move','gpu','compose:normal-slot:1.00,blue-slot:0.00','gpu']);
 assert.equal(f.receipts.at(-1).commandId,'launch');assert.equal(f.receipts.at(-1).frameId,'3');
});

test('cancelled preparation cannot publish and late instance retires exactly once',async()=>{
 const f=fixture();f.runtime.initialize(0);await f.complete('normal','normal-slot');f.events.length=0;
 f.runtime.command({action:'launch',beatId:'move',commandId:'launch'},1);await f.complete('blue','blue-slot');await f.runtime.draw(1.35);f.runtime.command({action:'return-normal',commandId:'normal'},2);f.runtime.command({action:'pause',commandId:'pause'},2);
 await f.complete('normal','late-slot');assert.ok(f.events.includes('dispose:late-slot'));assert.equal(f.events.some(event=>event.startsWith('compose:')&&event.includes('late-slot')),false);
 assert.equal(f.schedule.status(1).resources.slotStates.retiring,0);
});

test('cooperative disposal awaits preparation, drains GPU, and reports zero owned runtime slots',async()=>{
 const f=fixture();f.runtime.initialize(0);const cleanup=f.runtime.dispose();let settled=false;cleanup.then(()=>settled=true);await Promise.resolve();assert.equal(settled,false);
 await f.complete('normal','late-normal');const result=await cleanup;assert.equal(result.disposition,'settled');assert.equal(result.resources.slots,0);assert.equal(result.resources.pendingCreates,0);assert.ok(f.events.includes('dispose:late-normal'));assert.ok(f.events.includes('gpu'));
});

test('a rejected create clears its reservation and allows a later retry',async()=>{
 const f=fixture();f.runtime.initialize(0);await f.complete('normal','normal-slot');
 f.runtime.command({action:'launch',beatId:'move',commandId:'bad'},1);f.prepares.get('blue').wait.reject(Object.assign(new Error('create failed'),{code:'CREATE_FAILED'}));await f.runtime.idle();
 assert.equal(f.runtime.status(1).pendingPreparation,null);assert.equal(f.runtime.resources().slots,1);assert.equal(f.runtime.status(1).preparationFailure.code,'CREATE_FAILED');assert.equal(f.failures.at(-1).preparation.commandId,'bad');assert.equal(f.runtime.status(1).committed.slotId,'normal-slot');
 const retry=f.runtime.command({action:'launch',beatId:'move',commandId:'retry'},2);assert.equal(retry.result,'preparing');
});

test('compose failure preserves the previously published schedule and front ownership',async()=>{
 const events=[],prepares=new Map();let fail=false;
 const schedule=createStorySchedule({story,storyHash:'c'.repeat(64),visualCapabilities:[],identity});
 const runtime=createStoryGenerationRuntime({schedule,prepareSlot(p){const wait=deferred();prepares.set(p.visualId,wait);return wait.promise;},async renderSlot(){},async compose(){if(fail)throw new Error('compose failed')},async settleGpu(){},async disposeSlot(){},onError(error){events.push(error.message)}});
 runtime.initialize(0);prepares.get('normal').resolve({id:'normal-slot'});await runtime.idle();fail=true;runtime.command({action:'launch',beatId:'move',commandId:'bad'},1);prepares.get('blue').resolve({id:'blue-slot'});await runtime.idle();
 const status=runtime.status(1);assert.equal(status.committed.visualId,'normal');assert.equal(status.outgoing,null);assert.equal(status.pendingPreparation,null);assert.deepEqual(events,['compose failed']);
});

test('pending preparation is included in exact two-slot ownership accounting',async()=>{
 const f=fixture();f.runtime.initialize(0);await f.complete('normal','normal-slot');f.runtime.command({action:'launch',beatId:'move',commandId:'pending'},1);
 assert.equal(f.runtime.resources().slots,2);assert.equal(f.runtime.resources().pendingCreates,1);assert.equal(f.runtime.resources().slotStates.preparing,1);
});

test('post-publication retirement failure keeps the committed candidate and reports terminal cleanup failure',async()=>{
 const instant=Object.freeze({...story,crossfadeSeconds:0}),events=[],prepares=new Map(),receipts=[],schedule=createStorySchedule({story:instant,storyHash:'c'.repeat(64),visualCapabilities:[],identity});
 const runtime=createStoryGenerationRuntime({schedule,prepareSlot(p){const wait=deferred();prepares.set(p.visualId,wait);return wait.promise;},async renderSlot(){},async compose(){},async settleGpu(){},async disposeSlot(slot){if(slot.id==='normal-slot')throw new Error('retire failed')},onReceipt:r=>receipts.push(r),onError:e=>events.push(e.code)});
 runtime.initialize(0);prepares.get('normal').resolve({id:'normal-slot'});await runtime.idle();runtime.command({action:'launch',beatId:'move',commandId:'move'},1);prepares.get('blue').resolve({id:'blue-slot'});await runtime.idle();assert.equal(receipts.at(-1).commandId,'move');assert.equal(runtime.status(1).committed.slotId,'blue-slot');assert.deepEqual(events,['STORY_POST_COMMIT_FAILED']);assert.equal(runtime.resources().slots,2);
});

test('rejected initial preparation remains cleanly disposable with zero ownership',async()=>{
 const f=fixture();f.runtime.initialize(0);f.prepares.get('normal').wait.reject(new Error('normal failed'));await f.runtime.idle();assert.equal(f.runtime.status(0).committed,null);assert.equal(f.runtime.status(0).preparationFailure.code,'STORY_PREPARATION_FAILED');const cleanup=await f.runtime.dispose();assert.equal(cleanup.disposition,'settled');assert.equal(cleanup.resources.slots,0);
});

test('failed slot disposal retains ownership and repeated cleanup returns the same rejected outcome',async()=>{
 const prepares=new Map(),schedule=createStorySchedule({story,storyHash:'c'.repeat(64),visualCapabilities:[],identity});const runtime=createStoryGenerationRuntime({schedule,prepareSlot(p){const wait=deferred();prepares.set(p.visualId,wait);return wait.promise;},async renderSlot(){},async compose(){},async settleGpu(){},async disposeSlot(){throw new Error('dispose failed')}});runtime.initialize(0);prepares.get('normal').resolve({id:'normal-slot'});await runtime.idle();const first=runtime.dispose(),second=runtime.dispose();assert.equal(first,second);await assert.rejects(first,/dispose failed/);assert.equal(runtime.resources().slots,1);
});

test('timed loop publishes endpoint and zero on distinct synchronized completed frame IDs',async()=>{
 const f=fixture();f.runtime.initialize(0);await f.complete('normal','normal-slot');f.runtime.command({action:'launch',beatId:'move',commandId:'move'},0);await f.complete('blue','blue-slot');await f.runtime.draw(.35);const before=f.runtime.status(.35).committed.activationId;f.runtime.command({action:'loop',beatId:'move',commandId:'loop'},1);const result=await f.runtime.draw(1);assert.equal(f.intermediate.at(-1).status.committed.frame.localTimeSeconds,4);assert.equal(Number(result.frameId),Number(f.intermediate.at(-1).frameId)+1);assert.equal(result.status.committed.frame.localTimeSeconds,0);assert.equal(result.status.committed.activationId,before+1);
});
