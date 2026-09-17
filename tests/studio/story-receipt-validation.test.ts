import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFreshStoryIntent,validateStoryReceiptTarget} from '../../apps/studio/src/standalone-client.ts';

const definition={version:1 as const,beats:[{id:'move',label:'Move',timing:{kind:'timed' as const,durationSeconds:4}},{id:'hold',label:'Hold',timing:{kind:'sustained' as const}}],sequence:[{id:'move-1',beatId:'move',follow:{kind:'after' as const,seconds:5}},{id:'hold-1',beatId:'hold',follow:{kind:'manual' as const}}]};
const capability={version:1 as const,beats:[{id:'move',kind:'timed' as const,seek:'direct' as const},{id:'hold',kind:'sustained' as const,seek:'none' as const}]};
const detached={state:'detached' as const,occurrenceId:null,index:null,nextOccurrenceId:null,dwellElapsedSeconds:0,dwellRemainingSeconds:null,awaitingCue:false};
const attached=(id:'move-1'|'hold-1',dwell=0)=>{const index=id==='move-1'?0:1,row=definition.sequence[index]!;return {state:'attached' as const,occurrenceId:id,index,nextOccurrenceId:definition.sequence[index+1]?.id??null,dwellElapsedSeconds:dwell,dwellRemainingSeconds:row.follow.kind==='after'?Math.max(0,row.follow.seconds-dwell):null,awaitingCue:row.follow.kind==='manual'};};
const frame=(beatId:'move'|'hold',activationId:number,storyEpoch:number,occurrenceId:string|null=null,local=beatId==='move'?0:null,elapsed=0)=>({state:'active' as const,storyEpoch,beatId,activationId,occurrenceId,elapsedSeconds:elapsed,localTimeSeconds:local,progress:local===null?null:local/4});
const status=(storyFrame:any,sequence:any=detached,patch:any={})=>({definition,capability,storyHash:'a'.repeat(64),storyRevision:patch.storyRevision??1,frame:storyFrame,phase:patch.phase??'running',autoAdvance:patch.autoAdvance??false,loop:patch.loop??false,effectiveAdvancing:false,sequence,resumeCandidates:[],disabledReasons:{}});
const normal=status({state:'normal' as const,storyEpoch:0},detached,{phase:'paused'}),moveDetached=status(frame('move',1,1,null,2,2)),moveAttached=status(frame('move',1,1,'move-1',2,2),attached('move-1',1),{autoAdvance:true}),holdDetached=status(frame('hold',2,2),detached);
const target=(before:any,action:any)=>({payloadKey:'key',action,expectedRevision:before.storyRevision,before});
const receipt=(action:string,story:any)=>({result:'applied' as const,commandId:'command',action,storyRevision:2,frameId:'2',timeSeconds:0,story});

test('Story receipt correlation covers every transport action and activation rule',()=>{
 const rows=[
  ['launch new',holdDetached,{action:'launch',beatId:'move'},status(frame('move',3,3)),false],
  ['launch same',moveAttached,{action:'launch',beatId:'move'},status(frame('move',1,2,null,2,2)),false],
  ['start',normal,{action:'start'},status(frame('move',1,1,'move-1'),attached('move-1'),{autoAdvance:true}),false],
  ['resume same',moveDetached,{action:'resume',occurrenceId:'move-1'},status(frame('move',1,2,'move-1',2,2),attached('move-1'),{autoAdvance:true}),false],
  ['resume new',holdDetached,{action:'resume',occurrenceId:'move-1'},status(frame('move',3,3,'move-1'),attached('move-1'),{autoAdvance:true}),false],
  ['advance',moveAttached,{action:'advance'},status(frame('hold',2,2,'hold-1'),attached('hold-1'),{autoAdvance:true}),false],
  ['replay',moveDetached,{action:'replay',beatId:'move'},status(frame('move',2,2)),false],
  ['loop',moveDetached,{action:'loop',beatId:'move'},status(frame('move',2,2),detached,{loop:true}),false],
  ['seek',moveAttached,{action:'seek',localTimeSeconds:1},status(frame('move',1,2,'move-1',1,2),attached('move-1',2),{phase:'paused',autoAdvance:true}),false],
  ['pause',moveAttached,{action:'pause'},status(frame('move',1,1,'move-1',2,2),attached('move-1',2),{phase:'paused',autoAdvance:true}),false],
  ['play',{...moveAttached,phase:'paused'},{action:'play'},status(frame('move',1,1,'move-1',2,2),attached('move-1',1),{phase:'running',autoAdvance:true}),false],
  ['set-auto',moveAttached,{action:'set-auto-advance',enabled:false},status(frame('move',1,1,'move-1',2,2),attached('move-1',1),{autoAdvance:false}),false],
  ['return-normal',moveDetached,{action:'return-normal'},status({state:'normal',storyEpoch:2},detached,{phase:'paused'}),true],
 ] as const;
 for(const [name,before,action,after] of rows){const binding=target(before,action);assert.doesNotThrow(()=>validateStoryReceiptTarget(receipt(action.action,after.frame) as any,binding as any,definition),name);assert.doesNotThrow(()=>validateFreshStoryIntent(after as any,binding as any),name);}
});

test('Story receipt correlation rejects stale activation, nonzero new local time, and wrong fresh intent',()=>{
 const startTarget=target(normal,{action:'start'}),stale=status(frame('move',1,0,'move-1'),attached('move-1'),{autoAdvance:true});
 assert.throws(()=>validateStoryReceiptTarget(receipt('start',stale.frame) as any,startTarget as any,definition),/fresh epoch/);
 const replayTarget=target(moveDetached,{action:'replay',beatId:'move'}),nonzero=status(frame('move',2,2,null,1));
 assert.throws(()=>validateStoryReceiptTarget(receipt('replay',nonzero.frame) as any,replayTarget as any,definition),/local zero/);
 const skipped=status(frame('move',3,2));assert.throws(()=>validateStoryReceiptTarget(receipt('replay',skipped.frame) as any,replayTarget as any,definition),/next activation/);assert.throws(()=>validateFreshStoryIntent(skipped as any,replayTarget as any),/next activation/);
 const autoTarget=target(moveAttached,{action:'set-auto-advance',enabled:false});
 assert.throws(()=>validateFreshStoryIntent(moveAttached as any,autoTarget as any),/auto-advance/);
});
