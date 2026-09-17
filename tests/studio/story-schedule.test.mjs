import test from 'node:test';
import assert from 'node:assert/strict';
import {createStorySchedule} from '../../apps/studio/src/controls/story-schedule.mjs';

const story=Object.freeze({version:2,normalVisualId:'normal',crossfadeSeconds:0.35,beats:Object.freeze([
 Object.freeze({id:'hold',label:'Hold',timing:Object.freeze({kind:'sustained'}),visualId:'red'}),
 Object.freeze({id:'move',label:'Move',timing:Object.freeze({kind:'timed',durationSeconds:4}),visualId:'blue'}),
 Object.freeze({id:'move-alt',label:'Move alt',timing:Object.freeze({kind:'timed',durationSeconds:4}),visualId:'red'}),
]),sequence:Object.freeze([
 Object.freeze({id:'hold-1',beatId:'hold',follow:Object.freeze({kind:'after',seconds:2}),visualId:'red'}),
 Object.freeze({id:'move-1',beatId:'move',follow:Object.freeze({kind:'after',seconds:6}),visualId:'blue'}),
 Object.freeze({id:'move-2',beatId:'move',follow:Object.freeze({kind:'manual'}),visualId:'red'}),
])});
const identity=Object.freeze({instanceId:'instance',generation:7,scheduleHash:'a'.repeat(64),capsuleHash:'b'.repeat(64)});
const create=()=>createStorySchedule({story,identity});
const prepare=(schedule,decision,slotId)=>{assert.equal(decision.result,'preparing');schedule.prepared(decision.preparation.token,{slotId});return decision;};
const commit=(schedule,decision,now,frameId)=>schedule.publishCommit(schedule.stageCommit(decision.preparation.token,now,frameId));

test('a target remains pending until its first valid frame commits a two-slot overlap',()=>{
 const schedule=create();
 const normal=prepare(schedule,schedule.initialize(0),'slot-normal');
 assert.equal(schedule.status(0).committed,null);
 commit(schedule,normal,0,'1');
 const launch=prepare(schedule,schedule.request({action:'launch',beatId:'move',commandId:'launch-1'},1),'slot-blue');
 let status=schedule.status(1);
 assert.equal(status.committed.visualId,'normal');
 assert.equal(status.pendingPreparation.phase,'ready');
 assert.deepEqual(status.resources.slotStates,{preparing:0,ready:1,active:1,retiring:0,unsettled:0});
 const receipt=commit(schedule,launch,1,'2');status=schedule.status(1);
 assert.equal(receipt.result,'applied');
 assert.equal(status.outgoing.visualId,'normal');
 assert.equal(status.incoming.visualId,'blue');
 assert.equal(status.crossfadeProgress,0);
 assert.deepEqual(schedule.frames(1).map(row=>[row.role,row.weight,row.story.state]),[['outgoing',1,'normal'],['incoming',0,'active']]);
});

test('overlap freezes on pause, seeks only incoming, rejects a third target, and retires after fade settlement',()=>{
 const schedule=create(),normal=prepare(schedule,schedule.initialize(0),'slot-normal');commit(schedule,normal,0,'1');
 const launch=prepare(schedule,schedule.request({action:'launch',beatId:'move',commandId:'launch-1'},1),'slot-blue');commit(schedule,launch,1,'2');
 schedule.beginFrame(1.175,true);assert.ok(Math.abs(schedule.status(1.175).crossfadeProgress-0.5)<1e-12);
 schedule.request({action:'pause',commandId:'pause'},1.175);schedule.beginFrame(2,true);assert.ok(Math.abs(schedule.status(2).crossfadeProgress-0.5)<1e-12);
 const seek=schedule.request({action:'seek',localTimeSeconds:3,commandId:'seek'},2);assert.equal(seek.result,'applied');
 const frames=schedule.frames(2);assert.equal(frames[0].story.state,'normal');assert.equal(frames[1].story.localTimeSeconds,3);
 assert.throws(()=>schedule.request({action:'launch',beatId:'hold',commandId:'third'},2),error=>error.code==='STORY_TRANSITION_BUSY');
 schedule.request({action:'play',commandId:'play'},2);schedule.beginFrame(2.175,true);schedule.completePresentedFrame(2.175,true);let status=schedule.status(2.175);
 assert.equal(status.crossfadeProgress,null);assert.equal(status.outgoing,null);assert.equal(status.committed.visualId,'blue');assert.equal(status.resources.slotStates.retiring,1);
 schedule.settleRetirement('slot-normal');status=schedule.status(2.175);assert.equal(status.resources.slotStates.retiring,0);assert.equal(status.resources.slotStates.active,1);
});

test('cancellation invalidates publication but retains capacity until the late preparation settles',()=>{
 const schedule=create(),normal=prepare(schedule,schedule.initialize(0),'slot-normal');commit(schedule,normal,0,'1');const active=prepare(schedule,schedule.request({action:'launch',beatId:'hold',commandId:'hold'},0),'slot-red');commit(schedule,active,0,'2');schedule.completePresentedFrame(.35);schedule.settleRetirement('slot-normal');
 const pending=schedule.request({action:'launch',beatId:'move',commandId:'launch'},1);
 schedule.request({action:'pause',commandId:'pause'},1);
 assert.equal(schedule.status(1).pendingPreparation.phase,'cancelled');
 assert.throws(()=>schedule.request({action:'launch',beatId:'move-alt',commandId:'other'},1),error=>error.code==='STORY_CAPACITY_BUSY');
 assert.equal(schedule.prepared(pending.preparation.token,{slotId:'late'}).accepted,false);
 assert.equal(schedule.status(1).resources.slotStates.retiring,1);
 schedule.settleRetirement('late');
 assert.equal(schedule.status(1).resources.slotStates.retiring,0);
});

test('same beat and visual adopts while a fresh occurrence or different visual prepares a new activation',()=>{
 const schedule=create(),normal=prepare(schedule,schedule.initialize(0),'slot-normal');commit(schedule,normal,0,'1');
 let next=prepare(schedule,schedule.request({action:'launch',beatId:'move',commandId:'launch'},0),'slot-blue');commit(schedule,next,0,'2');schedule.beginFrame(.35,true);schedule.completePresentedFrame(.35,true);schedule.settleRetirement('slot-normal');
 const activation=schedule.status(.35).committed.activationId;
 assert.equal(schedule.request({action:'launch',beatId:'move',commandId:'adopt'},.35).result,'applied');
 assert.equal(schedule.status(.35).committed.activationId,activation);
 next=schedule.request({action:'start',occurrenceId:'move-1',commandId:'occurrence'},.35);assert.equal(next.result,'preparing');
 schedule.cancel(next.preparation.token,'test');schedule.preparationSettled(next.preparation.token);
 const alternate=schedule.request({action:'launch',beatId:'move-alt',commandId:'other-ref'},.35);assert.equal(alternate.result,'preparing');
});

test('stable Normal to Normal is an idempotent no-op with no slot preparation',()=>{
 const schedule=create(),normal=prepare(schedule,schedule.initialize(0),'slot-normal');commit(schedule,normal,0,'1');const before=schedule.status(0);
 const decision=schedule.request({action:'return-normal',commandId:'normal-again'},1),after=schedule.status(1);
 assert.equal(decision.result,'applied');assert.equal(after.committed.slotId,'slot-normal');assert.equal(after.committed.activationId,before.committed.activationId);assert.equal(after.storyRevision,before.storyRevision);assert.equal(after.pendingPreparation,null);
});

test('automatic dwell becomes one bounded waiting intention until overlap and retirement free capacity',()=>{
 const fast=Object.freeze({...story,sequence:Object.freeze([
  Object.freeze({...story.sequence[0],follow:Object.freeze({kind:'after',seconds:.1})}),story.sequence[1],
 ])});
 const schedule=createStorySchedule({story:fast,identity}),normal=prepare(schedule,schedule.initialize(0),'slot-normal');commit(schedule,normal,0,'1');
 const start=prepare(schedule,schedule.request({action:'start',occurrenceId:'hold-1',commandId:'start'},0),'slot-red');commit(schedule,start,0,'2');
 schedule.completeFrame(.1);let status=schedule.status(.1);assert.equal(status.dueNext.occurrenceId,'move-1');assert.equal(status.dueNext.state,'waiting');
 assert.equal(schedule.takeDue(.1).result,'waiting');
 schedule.beginFrame(.35,true);schedule.completePresentedFrame(.35,true);assert.equal(schedule.takeDue(.35).result,'waiting','retiring ownership still consumes the second slot');
 schedule.settleRetirement('slot-normal');const due=schedule.takeDue(.35);assert.equal(due.result,'preparing');assert.equal(due.preparation.occurrenceId,'move-1');assert.equal(schedule.status(.35).dueNext,null);
});

test('post-import intrinsic mutation cannot corrupt slot admission or status',()=>{
 const schedule=create(),descriptors={max:Object.getOwnPropertyDescriptor(Math,'max'),min:Object.getOwnPropertyDescriptor(Math,'min'),hasOwn:Object.getOwnPropertyDescriptor(Object,'hasOwn'),create:Object.getOwnPropertyDescriptor(Object,'create'),size:Object.getOwnPropertyDescriptor(Map.prototype,'size'),String:globalThis.String};
 try{
  Math.max=()=>{throw Error('mutated max')};Math.min=()=>{throw Error('mutated min')};Object.hasOwn=()=>false;Object.create=()=>{throw Error('mutated create')};Object.defineProperty(Map.prototype,'size',{configurable:true,get(){throw Error('mutated size')}});globalThis.String=()=>{throw Error('mutated String')};
  const normal=prepare(schedule,schedule.initialize(0),'slot-normal');commit(schedule,normal,0,'1');assert.equal(schedule.status(0).resources.slots,1);const pending=schedule.request({action:'launch',beatId:'move',commandId:'failure'},1);schedule.preparationFailed(pending.preparation.token,new Error('failed'));assert.equal(schedule.status(1).preparationFailure.message,'failed');
 }finally{for(const [target,key,descriptor] of [[Math,'max',descriptors.max],[Math,'min',descriptors.min],[Object,'hasOwn',descriptors.hasOwn],[Object,'create',descriptors.create],[Map.prototype,'size',descriptors.size]])Object.defineProperty(target,key,descriptor);globalThis.String=descriptors.String;}
});

test('play preserves a pending target while pause cancels it',()=>{
 const schedule=create(),normal=prepare(schedule,schedule.initialize(0),'slot-normal');commit(schedule,normal,0,'1');const active=prepare(schedule,schedule.request({action:'launch',beatId:'hold',commandId:'hold'},0),'slot-red');commit(schedule,active,0,'2');schedule.completePresentedFrame(.35);schedule.settleRetirement('slot-normal');
 const launch=schedule.request({action:'launch',beatId:'move',commandId:'launch'},1);schedule.request({action:'play',commandId:'play'},1);assert.equal(schedule.status(1).pendingPreparation.token,launch.preparation.token);
 const pause=schedule.request({action:'pause',commandId:'pause'},1);assert.equal(pause.cancelledCommandId,'launch');assert.equal(schedule.status(1).pendingPreparation.phase,'cancelled');
});

test('status disabled reasons match Normal, detached, sustained, and attached admission',()=>{
 const schedule=create(),normal=prepare(schedule,schedule.initialize(0),'slot-normal');commit(schedule,normal,0,'1');for(const action of ['pause','play','seek','set-auto-advance','advance'])assert.ok(schedule.status(0).disabledReasons[action]);assert.throws(()=>schedule.request({action:'pause',commandId:'x'},0),e=>e.code==='NO_ACTIVE_BEAT');
 let next=prepare(schedule,schedule.request({action:'launch',beatId:'hold',commandId:'hold'},0),'slot-red');commit(schedule,next,0,'2');schedule.completePresentedFrame(.35);schedule.settleRetirement('slot-normal');const detached=schedule.status(.35);assert.ok(detached.disabledReasons.seek);assert.ok(detached.disabledReasons.advance);assert.ok(detached.disabledReasons['set-auto-advance']);
});

test('timed loop exposes one endpoint frame before a fresh zero-time activation',()=>{
 const schedule=create(),normal=prepare(schedule,schedule.initialize(0),'slot-normal');commit(schedule,normal,0,'1');const timed=prepare(schedule,schedule.request({action:'launch',beatId:'move',commandId:'move'},0),'slot-blue');commit(schedule,timed,0,'2');schedule.completePresentedFrame(.35);schedule.settleRetirement('slot-normal');const before=schedule.status(1).committed.activationId;
 schedule.request({action:'loop',beatId:'move',commandId:'loop'},1);assert.equal(schedule.frames(1)[0].story.localTimeSeconds,4);assert.equal(schedule.restartAfterEndpoint(1),true);const after=schedule.status(1);assert.equal(after.committed.activationId,before+1);assert.equal(after.committed.frame.localTimeSeconds,0);assert.equal(after.loop,true);
});

test('fresh resume dwell and stale due intention are reset by manual control',()=>{
 const fast=Object.freeze({...story,sequence:Object.freeze([Object.freeze({...story.sequence[0],follow:Object.freeze({kind:'after',seconds:.1})}),story.sequence[1]])});const schedule=createStorySchedule({story:fast,identity});
 const normal=prepare(schedule,schedule.initialize(0),'slot-normal');commit(schedule,normal,0,'1');const held=prepare(schedule,schedule.request({action:'start',occurrenceId:'hold-1',commandId:'start'},0),'slot-red');commit(schedule,held,0,'2');schedule.completePresentedFrame(.35);schedule.settleRetirement('slot-normal');schedule.completeFrame(.5);assert.ok(schedule.status(.5).dueNext);
 schedule.request({action:'pause',commandId:'pause'},.5);assert.equal(schedule.status(.5).dueNext,null);assert.equal(schedule.takeDue(.5).result,'waiting');schedule.request({action:'resume',occurrenceId:'hold-1',commandId:'resume'},1);assert.equal(schedule.status(1).sequence.dwellElapsedSeconds,0);
});

test('zero-duration replacement stages the incoming visual on its receipt frame',()=>{
 const instant=Object.freeze({...story,crossfadeSeconds:0}),schedule=createStorySchedule({story:instant,identity});const normal=prepare(schedule,schedule.initialize(0),'slot-normal');commit(schedule,normal,0,'1');const next=prepare(schedule,schedule.request({action:'launch',beatId:'move',commandId:'move'},1),'slot-blue'),staged=schedule.stageCommit(next.preparation.token,1,'2');assert.deepEqual(staged.rows.map(row=>[row.slotId,row.weight]),[['slot-blue',1]]);schedule.publishCommit(staged);const status=schedule.status(1);assert.equal(status.committed.slotId,'slot-blue');assert.equal(status.outgoing,null);
});

test('automatic timed loop publishes endpoint then advances activation at zero for every wrap',()=>{
 const schedule=create(),normal=prepare(schedule,schedule.initialize(0),'slot-normal');commit(schedule,normal,0,'1');const timed=prepare(schedule,schedule.request({action:'launch',beatId:'move',commandId:'move'},0),'slot-blue');commit(schedule,timed,0,'2');schedule.completePresentedFrame(.35);schedule.settleRetirement('slot-normal');schedule.request({action:'loop',beatId:'move',commandId:'loop'},1);schedule.restartAfterEndpoint(1);const first=schedule.status(1),revision=first.storyRevision;schedule.completePresentedFrame(5,true);assert.equal(schedule.restartPending(),true);assert.equal(schedule.frames(5)[0].story.localTimeSeconds,4);assert.equal(schedule.status(5).storyRevision,revision+1);schedule.restartAfterEndpoint(5);assert.equal(schedule.frames(5)[0].story.localTimeSeconds,0);assert.equal(schedule.status(5).committed.activationId,first.committed.activationId+1);
});

test('sustained replay and loop reject consistently and same-beat launch preserves a held endpoint',()=>{
 const schedule=create(),normal=prepare(schedule,schedule.initialize(0),'slot-normal');commit(schedule,normal,0,'1');let held=prepare(schedule,schedule.request({action:'launch',beatId:'hold',commandId:'hold'},0),'slot-red');commit(schedule,held,0,'2');schedule.completePresentedFrame(.35);schedule.settleRetirement('slot-normal');assert.ok(schedule.status(.35).disabledReasons.replay);assert.ok(schedule.status(.35).disabledReasons.loop);assert.throws(()=>schedule.request({action:'loop',beatId:'hold',commandId:'bad'},.35),e=>e.code==='DIRECT_SEEK_REQUIRED');
 const other=create(),base=prepare(other,other.initialize(0),'slot-normal');commit(other,base,0,'1');const move=prepare(other,other.request({action:'launch',beatId:'move',commandId:'move'},0),'slot-blue');commit(other,move,0,'2');other.completePresentedFrame(.35);other.settleRetirement('slot-normal');other.request({action:'seek',localTimeSeconds:4,commandId:'seek'},1);other.request({action:'launch',beatId:'move',commandId:'same'},2);assert.equal(other.status(3).phase,'paused');assert.equal(other.status(3).committed.frame.localTimeSeconds,4);
});

test('paused Preview reports nonadvancing Story and pending manual ownership cannot leak stale due intent',()=>{
 const fast=Object.freeze({...story,sequence:Object.freeze([Object.freeze({...story.sequence[0],follow:Object.freeze({kind:'after',seconds:.1})}),story.sequence[1]])}),schedule=createStorySchedule({story:fast,identity}),normal=prepare(schedule,schedule.initialize(0),'slot-normal');commit(schedule,normal,0,'1');const start=prepare(schedule,schedule.request({action:'start',occurrenceId:'hold-1',commandId:'start'},0),'slot-red');commit(schedule,start,0,'2');schedule.completePresentedFrame(.35);schedule.settleRetirement('slot-normal');assert.equal(schedule.status(.4,false).effectiveAdvancing,false);const manual=schedule.request({action:'launch',beatId:'move',commandId:'manual'},.4);schedule.completeFrame(1);assert.equal(schedule.status(1).dueNext,null);assert.throws(()=>schedule.request({action:'launch',beatId:'hold',commandId:'same'},1),e=>e.code==='STORY_CAPACITY_BUSY');schedule.prepared(manual.preparation.token,{slotId:'slot-blue'});schedule.publishCommit(schedule.stageCommit(manual.preparation.token,1,'3'));assert.equal(schedule.status(1).dueNext,null);
});

test('auto-advance off and on preserves elapsed dwell without counting the disabled interval',()=>{
 const schedule=create(),normal=prepare(schedule,schedule.initialize(0),'slot-normal');commit(schedule,normal,0,'1');const start=prepare(schedule,schedule.request({action:'start',occurrenceId:'hold-1',commandId:'start'},0),'slot-red');commit(schedule,start,0,'2');schedule.completePresentedFrame(.35);schedule.settleRetirement('slot-normal');schedule.request({action:'set-auto-advance',enabled:false,commandId:'off'},1);assert.equal(schedule.status(5).sequence.dwellElapsedSeconds,1);schedule.request({action:'set-auto-advance',enabled:true,commandId:'on'},5);assert.equal(schedule.status(6).sequence.dwellElapsedSeconds,2);
});

test('pausing a loop at its endpoint preserves the held endpoint and activation',()=>{
 const schedule=create(),normal=prepare(schedule,schedule.initialize(0),'slot-normal');commit(schedule,normal,0,'1');const move=prepare(schedule,schedule.request({action:'launch',beatId:'move',commandId:'move'},0),'slot-blue');commit(schedule,move,0,'2');schedule.completePresentedFrame(.35);schedule.settleRetirement('slot-normal');schedule.request({action:'loop',beatId:'move',commandId:'loop'},1);schedule.restartAfterEndpoint(1);const before=schedule.status(1).committed;schedule.request({action:'pause',commandId:'pause'},5);schedule.completePresentedFrame(5,true);const after=schedule.status(5);assert.equal(after.phase,'paused');assert.equal(after.committed.frame.localTimeSeconds,4);assert.equal(after.committed.activationId,before.activationId);assert.equal(after.committed.storyEpoch,before.storyEpoch);assert.equal(schedule.restartPending(),false);
});
