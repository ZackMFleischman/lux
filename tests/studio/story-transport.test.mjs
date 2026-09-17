import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoryTransport} from '../../apps/studio/src/controls/story-transport.mjs';

const definition=Object.freeze({version:1,hash:'a'.repeat(64),beats:Object.freeze([
 Object.freeze({id:'hold',label:'Hold',timing:Object.freeze({kind:'sustained'})}),
 Object.freeze({id:'move',label:'Move',timing:Object.freeze({kind:'timed',durationSeconds:4})}),
]),sequence:Object.freeze([
 Object.freeze({id:'hold-1',beatId:'hold',follow:Object.freeze({kind:'after',seconds:2})}),
 Object.freeze({id:'move-1',beatId:'move',follow:Object.freeze({kind:'after',seconds:6})}),
 Object.freeze({id:'move-2',beatId:'move',follow:Object.freeze({kind:'manual'})}),
])});
const capability=Object.freeze({version:1,beats:Object.freeze([{id:'hold',kind:'sustained',seek:'none'},{id:'move',kind:'timed',seek:'direct'}])});
const command=(story,action,extra={})=>story.apply({action,expectedStoryRevision:story.revision(),...extra},0);

test('sustained activation stays live while story pause freezes independent occurrence dwell',()=>{
 const story=createStoryTransport(definition,capability);command(story,'start');
 let status=story.status(1);assert.equal(status.frame.beatId,'hold');assert.equal(status.frame.elapsedSeconds,1);assert.equal(status.frame.localTimeSeconds,null);assert.equal(status.sequence.dwellElapsedSeconds,1);
 story.apply({action:'pause',expectedStoryRevision:story.revision()},1);status=story.status(5);
 assert.equal(status.frame.elapsedSeconds,5,'activation elapsed uses continuing animation time');assert.equal(status.sequence.dwellElapsedSeconds,1);assert.equal(status.phase,'paused');
 story.apply({action:'play',expectedStoryRevision:story.revision()},5);assert.equal(story.status(6).sequence.dwellElapsedSeconds,2);
 story.completeFrame(6);assert.equal(story.status(6).frame.beatId,'hold','threshold frame is displayed before transition');
 story.beginFrame(6);status=story.status(6);assert.equal(status.frame.beatId,'move');assert.equal(status.frame.localTimeSeconds,0);assert.equal(status.sequence.occurrenceId,'move-1');
});

test('timed phase and dwell are independent, seek preserves dwell, and repeated occurrences re-enter',()=>{
 const story=createStoryTransport(definition,capability);story.apply({action:'start',occurrenceId:'move-1',expectedStoryRevision:0},10);
 let status=story.status(14);assert.equal(status.frame.localTimeSeconds,4);assert.equal(status.frame.progress,1);assert.equal(status.sequence.dwellElapsedSeconds,4);assert.equal(status.sequence.dwellRemainingSeconds,2);
 story.apply({action:'seek',localTimeSeconds:1,expectedStoryRevision:story.revision()},14);status=story.status(20);assert.equal(status.frame.localTimeSeconds,1);assert.equal(status.sequence.dwellElapsedSeconds,4);assert.equal(status.phase,'paused');
 story.apply({action:'play',expectedStoryRevision:story.revision()},20);story.completeFrame(22);assert.equal(story.status(22).frame.localTimeSeconds,3);story.beginFrame(22);status=story.status(22);
 assert.equal(status.sequence.occurrenceId,'move-2');assert.equal(status.frame.localTimeSeconds,0);assert.equal(status.frame.activationId,2,'repeated beat occurrence creates a new activation');assert.equal(status.sequence.awaitingCue,true);
});

test('manual launch detaches, resume keeps same-beat pose with fresh dwell, and auto-enable requires attachment',()=>{
 const story=createStoryTransport(definition,capability);command(story,'launch',{beatId:'move'});let status=story.status(2);assert.equal(status.frame.localTimeSeconds,2);assert.equal(status.sequence.state,'detached');
 assert.throws(()=>story.apply({action:'set-auto-advance',enabled:true,expectedStoryRevision:story.revision()},2),error=>error.code==='OCCURRENCE_REQUIRED'&&error.candidates.length===3);
 const activation=status.frame.activationId;story.apply({action:'resume',occurrenceId:'move-2',expectedStoryRevision:story.revision()},2);status=story.status(2);
 assert.equal(status.frame.activationId,activation);assert.equal(status.frame.localTimeSeconds,2);assert.equal(status.sequence.dwellElapsedSeconds,0);assert.equal(status.sequence.awaitingCue,true);
});

test('loop and scheduled follow present endpoint/threshold once then transition on the next frame',()=>{
 const story=createStoryTransport(definition,capability);command(story,'loop',{beatId:'move'});let status=story.status(4);assert.equal(status.frame.localTimeSeconds,4);const activation=status.frame.activationId;
 story.completeFrame(4);assert.equal(story.status(4).frame.activationId,activation);story.beginFrame(4);status=story.status(4);assert.equal(status.frame.localTimeSeconds,0);assert.equal(status.frame.activationId,activation+1);
 story.apply({action:'return-normal',expectedStoryRevision:story.revision()},4);assert.equal(story.status(100).frame.state,'normal');
});

test('repeated intent no-ops preserve revision while canceling a queued transition advances it',()=>{
 const story=createStoryTransport(definition,capability);command(story,'launch',{beatId:'move'});const launched=story.revision();
 story.apply({action:'play',expectedStoryRevision:launched},1);assert.equal(story.revision(),launched);
 story.apply({action:'launch',beatId:'move',expectedStoryRevision:launched},1);assert.equal(story.revision(),launched);
 story.apply({action:'pause',expectedStoryRevision:launched},1);const paused=story.revision();assert.equal(paused,launched+1);
 story.apply({action:'pause',expectedStoryRevision:paused},2);assert.equal(story.revision(),paused);
 const sequence=createStoryTransport(definition,capability);sequence.apply({action:'start',occurrenceId:'hold-1',expectedStoryRevision:0},0);sequence.completeFrame(2);
 const queued=sequence.revision();sequence.apply({action:'set-auto-advance',enabled:true,expectedStoryRevision:queued},2);
 assert.equal(sequence.revision(),queued+1,'canceling a scheduled transition is an observable state change');
 assert.equal(sequence.beginFrame(2),false,'the canceled transition cannot replay');
});

test('prepared Story state ignores mutated ambient math, array and prototype setters',()=>{
 const story=createStoryTransport(definition,capability),descriptors={min:Object.getOwnPropertyDescriptor(Math,'min'),max:Object.getOwnPropertyDescriptor(Math,'max'),includes:Object.getOwnPropertyDescriptor(Array.prototype,'includes'),code:Object.getOwnPropertyDescriptor(Error.prototype,'code'),pause:Object.getOwnPropertyDescriptor(Object.prototype,'pause')};
 try{
  Math.min=()=>{throw Error('mutated min')};Math.max=()=>{throw Error('mutated max')};Array.prototype.includes=()=>{throw Error('mutated includes')};
  Object.defineProperty(Error.prototype,'code',{configurable:true,set(){throw Error('mutated error setter')}});Object.defineProperty(Object.prototype,'pause',{configurable:true,set(){throw Error('mutated object setter')}});
  story.apply({action:'start',expectedStoryRevision:0},0);story.completeFrame(2);assert.equal(story.status(2).frame.state,'active');story.beginFrame(2);assert.equal(story.status(2).frame.beatId,'move');
  assert.throws(()=>story.apply({action:'unknown',expectedStoryRevision:story.revision()},2),error=>error.code==='INVALID_STORY_ACTION');
 }finally{
  for(const [target,key,descriptor] of [[Math,'min',descriptors.min],[Math,'max',descriptors.max],[Array.prototype,'includes',descriptors.includes],[Error.prototype,'code',descriptors.code],[Object.prototype,'pause',descriptors.pause]]){if(descriptor)Object.defineProperty(target,key,descriptor);else Reflect.deleteProperty(target,key);}
 }
});
