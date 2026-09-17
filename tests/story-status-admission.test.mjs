import test from 'node:test';import assert from 'node:assert/strict';
import {createStorySchedule} from '../apps/studio/src/controls/story-schedule.mjs';
import {validateStoryScheduleStatus,validateStoryScheduleReceipt} from '../apps/studio/src/story/story-status-admission.mjs';
const story=Object.freeze({version:2,normalVisualId:'normal',crossfadeSeconds:1,beats:Object.freeze([Object.freeze({id:'beat',label:'Beat',timing:Object.freeze({kind:'timed',durationSeconds:2}),visualId:'beatVisual'})]),sequence:Object.freeze([Object.freeze({id:'one',beatId:'beat',follow:Object.freeze({kind:'after',seconds:1}),visualId:'beatVisual'})])});
const identity=Object.freeze({instanceId:'instance',generation:1,scheduleHash:'a'.repeat(64),capsuleHash:'b'.repeat(64)});const caps=Object.freeze([Object.freeze({visualId:'normal',storyCapability:null}),Object.freeze({visualId:'beatVisual',storyCapability:Object.freeze({version:1,beats:Object.freeze([Object.freeze({id:'beat',kind:'timed',seek:'direct'})])})})]);const trusted=Object.freeze({manifest:Object.freeze({story,storyHash:'c'.repeat(64)}),identity,visualCapabilities:caps});
function status(){const schedule=createStorySchedule({story,storyHash:'c'.repeat(64),visualCapabilities:caps,identity});const p=schedule.initialize(0);schedule.prepared(p.preparation.token,{slotId:'slot-1'});return schedule.publishCommit(schedule.stageCommit(p.preparation.token,0,'1')).status;}
test('admits and freezes an exact schedule receipt',()=>{const actual=validateStoryScheduleStatus(status(),trusted);assert.equal(actual.definition.normalVisualId,'normal');assert(Object.isFrozen(actual));assert(Object.isFrozen(actual.resources));});
test('rejects capability escalation and identity/revision regressions',()=>{const raw=structuredClone(status());raw.visualCapabilities[0].storyCapability={version:1,beats:[{id:'beat',kind:'timed',seek:'direct'}]};assert.throws(()=>validateStoryScheduleStatus(raw,trusted),/capabilities|provenance/i);raw.visualCapabilities=structuredClone(caps);raw.instanceId='other';assert.throws(()=>validateStoryScheduleStatus(raw,trusted),/instanceId/);raw.instanceId='instance';raw.storyRevision=-1;assert.throws(()=>validateStoryScheduleStatus(raw,{...trusted,priorStatus:status()}),/storyRevision/);});
test('rejects forged frame references and resource quota',()=>{const raw=structuredClone(status());raw.committed.frame.storyEpoch=99;assert.throws(()=>validateStoryScheduleStatus(raw,trusted),/frame/);raw.committed.frame.storyEpoch=raw.committed.storyEpoch;raw.resources.pendingCreates=2;assert.throws(()=>validateStoryScheduleStatus(raw,trusted),/resource/);});
test('admits only exact historical transport receipts',()=>{const receipt={result:'applied',commandId:'cmd',action:'launch',storyRevision:2,frameId:'12',timeSeconds:3,story:{state:'active',beatId:'beat',activationId:2,occurrenceId:null,elapsedSeconds:1,localTimeSeconds:1,progress:.5,storyEpoch:2}};assert.equal(validateStoryScheduleReceipt(receipt,{definition:story,commandId:'cmd',action:'launch',previous:{storyRevision:1}}).frameId,'12');assert.throws(()=>validateStoryScheduleReceipt({...receipt,action:'pause'},{definition:story,commandId:'cmd',action:'launch'}),/command/);assert.throws(()=>validateStoryScheduleReceipt({...receipt,story:{...receipt.story,beatId:'nope'}},{definition:story,commandId:'cmd',action:'launch'}),/active/);});
test('rejects nonfinite and inconsistent timed receipt progress',()=>{
 const base={result:'applied',commandId:'cmd',action:'seek',storyRevision:2,frameId:'12',timeSeconds:3,story:{state:'active',beatId:'beat',activationId:2,occurrenceId:null,elapsedSeconds:1,localTimeSeconds:1,progress:.5,storyEpoch:2}},facts={definition:story,commandId:'cmd',action:'seek'};
 for(const change of [{localTimeSeconds:NaN},{progress:NaN},{progress:.2}])assert.throws(()=>validateStoryScheduleReceipt({...base,story:{...base.story,...change}},facts),/timing/);
});
test('rejects nonfinite crossfade and mismatched incoming ownership',()=>{
 const schedule=createStorySchedule({story,storyHash:'c'.repeat(64),visualCapabilities:caps,identity});let p=schedule.initialize(0);schedule.prepared(p.preparation.token,{slotId:'normal'});schedule.publishCommit(schedule.stageCommit(p.preparation.token,0,'1'));
 p=schedule.request({action:'launch',beatId:'beat',commandId:'go'},0);schedule.prepared(p.preparation.token,{slotId:'incoming'});schedule.publishCommit(schedule.stageCommit(p.preparation.token,0,'2'));
 const valid=schedule.status(.1);assert.doesNotThrow(()=>validateStoryScheduleStatus(valid,trusted));
 const nonfinite=structuredClone(valid);nonfinite.crossfadeProgress=NaN;assert.throws(()=>validateStoryScheduleStatus(nonfinite,trusted),/crossfade/);
 const wrong=structuredClone(valid);wrong.committed.slotId='different';assert.throws(()=>validateStoryScheduleStatus(wrong,trusted),/crossfade/);
});
test('preparation failure uses one exact Story target tuple',()=>{
 const raw=structuredClone(status());
 raw.preparationFailure={visualId:'beatVisual',beatId:null,occurrenceId:'one',code:'CREATE_FAILED',message:'failed'};
 assert.throws(()=>validateStoryScheduleStatus(raw,trusted),/preparationFailure/);
 raw.preparationFailure={visualId:'beatVisual',beatId:'beat',occurrenceId:'one',code:'CREATE_FAILED',message:'failed'};
 assert.doesNotThrow(()=>validateStoryScheduleStatus(raw,trusted));
 for(const change of [{visualId:'normal'},{beatId:null},{occurrenceId:'missing'}])assert.throws(()=>validateStoryScheduleStatus({...raw,preparationFailure:{...raw.preparationFailure,...change}},trusted),/preparationFailure/);
 const secondBeat={id:'second',label:'Second',timing:{kind:'timed',durationSeconds:2},visualId:'beatVisual'},extendedStory={...story,beats:[...story.beats,secondBeat],sequence:[...story.sequence,{id:'two',beatId:'second',follow:{kind:'manual'},visualId:'beatVisual'}]},extendedCaps=[caps[0],{visualId:'beatVisual',storyCapability:{version:1,beats:[...caps[1].storyCapability.beats,{id:'second',kind:'timed',seek:'direct'}]}}];
 const extendedFacts={...trusted,manifest:{...trusted.manifest,story:extendedStory},visualCapabilities:extendedCaps},extendedRaw={...raw,definition:extendedStory,visualCapabilities:extendedCaps};
 assert.doesNotThrow(()=>validateStoryScheduleStatus(extendedRaw,extendedFacts));
 assert.throws(()=>validateStoryScheduleStatus({...extendedRaw,preparationFailure:{...raw.preparationFailure,occurrenceId:'two'}},extendedFacts),/preparationFailure/);
 assert.doesNotThrow(()=>validateStoryScheduleStatus({...raw,preparationFailure:{...raw.preparationFailure,visualId:'normal',beatId:null,occurrenceId:null}},trusted));
});
