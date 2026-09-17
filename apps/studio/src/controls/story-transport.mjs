const freeze=Object.freeze,RuntimeError=Error,finite=Number.isFinite,maxSafeInteger=Number.MAX_SAFE_INTEGER,min=Math.min,max=Math.max,create=Object.create,define=Object.defineProperty;
const RuntimeSet=Set,call=Function.prototype.call,arrayFind=call.bind(Array.prototype.find),arrayFindIndex=call.bind(Array.prototype.findIndex),arraySlice=call.bind(Array.prototype.slice),setAdd=call.bind(Set.prototype.add),setHas=call.bind(Set.prototype.has);
const clamp=(value,lower,upper)=>min(upper,max(lower,value));

function fail(code,message,candidates){const error=new RuntimeError(message);define(error,'code',{value:code,enumerable:true});if(candidates)define(error,'candidates',{value:freeze(arraySlice(candidates,0)),enumerable:true});throw error;}
function beatById(definition,id){const beat=arrayFind(definition.beats,row=>row.id===id);if(!beat)fail('BEAT_REQUIRED','Story beat is unavailable');return beat;}
function occurrenceIds(definition){const result=[];for(let index=0;index<definition.sequence.length;index++)result[index]=definition.sequence[index].id;return result;}
function occurrenceIndex(definition,id){const index=arrayFindIndex(definition.sequence,row=>row.id===id);if(index<0)fail('OCCURRENCE_REQUIRED','Story occurrence is unavailable',occurrenceIds(definition));return index;}

export function createStoryTransport(definition,capability,storyHash=null){
 const direct=new RuntimeSet();for(let index=0;index<(capability?.beats?.length??0);index++){const row=capability.beats[index];if(row.kind==='timed'&&row.seek==='direct')setAdd(direct,row.id);}
 let storyEpoch=0,storyRevision=0,activationSequence=0,active=null,phaseRunning=false,autoAdvance=false,looping=false,attachedIndex=null,sequenceEnded=false,pendingTransition=null;
 const duration=beat=>beat.timing.kind==='timed'?beat.timing.durationSeconds:null;
 function requireActive(){if(!active)fail('NO_ACTIVE_BEAT','No Story beat is active');return active;}
 function phaseAt(now){if(!active||active.beat.timing.kind!=='timed')return null;const limit=duration(active.beat),elapsed=phaseRunning?max(0,now-active.phaseAt):0;return clamp(active.phaseBase+elapsed,0,limit);}
 function dwellAt(now){if(attachedIndex===null||!active)return 0;const occurrence=definition.sequence[attachedIndex];if(occurrence.follow.kind!=='after')return 0;return active.dwellBase+(phaseRunning&&autoAdvance&&!sequenceEnded?max(0,now-active.dwellAt):0);}
 function materialize(now){if(!active)return;const local=phaseAt(now),dwell=dwellAt(now);if(local!==null){active.phaseBase=local;active.phaseAt=now;}active.dwellBase=dwell;active.dwellAt=now;}
 function enter(beat,now,index=null){if(activationSequence>=maxSafeInteger)fail('ACTIVATION_EXHAUSTED','Story activation identity is exhausted; restart runtime');activationSequence++;storyEpoch++;active={beat,activationId:activationSequence,enteredAt:now,phaseBase:0,phaseAt:now,dwellBase:0,dwellAt:now};attachedIndex=index;sequenceEnded=false;phaseRunning=true;}
 function frame(now){
  if(!active)return freeze({state:'normal',storyEpoch});
  const local=phaseAt(now),limit=duration(active.beat);
  return freeze({state:'active',beatId:active.beat.id,activationId:active.activationId,occurrenceId:attachedIndex===null?null:definition.sequence[attachedIndex].id,
   elapsedSeconds:max(0,now-active.enteredAt),localTimeSeconds:local,progress:local===null?null:local/limit,storyEpoch});
 }
 function status(now,previewPlaying=true){
  const storyFrame=frame(now),occurrence=attachedIndex===null?null:definition.sequence[attachedIndex],dwell=dwellAt(now),remaining=occurrence?.follow.kind==='after'?max(0,occurrence.follow.seconds-dwell):null;
  const timed=active?.beat.timing.kind==='timed',local=phaseAt(now),phaseCanAdvance=!!timed&&local<duration(active.beat),dwellCanAdvance=!!occurrence&&occurrence.follow.kind==='after'&&!sequenceEnded&&autoAdvance;
  const state=attachedIndex===null?'detached':sequenceEnded?'ended':'attached',next=attachedIndex!==null&&attachedIndex+1<definition.sequence.length?definition.sequence[attachedIndex+1]:null;
  const candidates=[];if(active)for(let index=0;index<definition.sequence.length;index++)if(definition.sequence[index].beatId===active.beat.id)candidates[candidates.length]=definition.sequence[index].id;
  const disabledReasons=create(null);const disabled=(action,code,message,candidateOccurrenceIds)=>{define(disabledReasons,action,{value:freeze({code,message,...(candidateOccurrenceIds?{candidateOccurrenceIds:freeze(arraySlice(candidateOccurrenceIds,0))}:{})}),enumerable:true});};
  if(!definition.sequence.length)disabled('start','EMPTY_SEQUENCE','Story sequence is empty');
  if(!active){const actions=['pause','play','set-auto-advance','advance','seek','return-normal'];for(let index=0;index<actions.length;index++)disabled(actions[index],'NO_ACTIVE_BEAT','No Story beat is active');}
  else{
   if(active.beat.timing.kind!=='timed'||!setHas(direct,active.beat.id))disabled('seek','DIRECT_SEEK_REQUIRED','Active beat does not support direct timed transport');
   if(attachedIndex===null)disabled('advance','OCCURRENCE_REQUIRED','Attach an occurrence before advancing',occurrenceIds(definition));
   else if(attachedIndex+1>=definition.sequence.length)disabled('advance','FINAL_OCCURRENCE','The final Story occurrence has no next occurrence');
   if(attachedIndex===null||sequenceEnded)disabled('set-auto-advance','OCCURRENCE_REQUIRED','Attach a live occurrence before enabling Auto-advance',occurrenceIds(definition));
  }
  if(!definition.sequence.length)disabled('resume','EMPTY_SEQUENCE','Story sequence is empty');
  return freeze({definition,capability,storyHash,storyRevision,frame:storyFrame,phase:phaseRunning?'running':'paused',autoAdvance,loop:looping,
   effectiveAdvancing:!!previewPlaying&&phaseRunning&&(phaseCanAdvance||dwellCanAdvance),sequence:freeze({state,occurrenceId:occurrence?.id??null,index:attachedIndex,nextOccurrenceId:next?.id??null,
    dwellElapsedSeconds:dwell,dwellRemainingSeconds:remaining,awaitingCue:!!occurrence&&occurrence.follow.kind==='manual'&&!sequenceEnded}),
   resumeCandidates:freeze(candidates),disabledReasons:freeze(disabledReasons)});
 }
 function validateTimedDirect(beat){if(beat.timing.kind!=='timed'||!setHas(direct,beat.id))fail('DIRECT_SEEK_REQUIRED','Beat does not support direct timed transport');}
 function apply(input,now){
  if(!input||typeof input!=='object'||input.expectedStoryRevision!==storyRevision)fail('STORY_CHANGED','Story transport changed; read current status');
  const action=input.action;let beat,index;
  if(action==='launch')beat=beatById(definition,input.beatId);
  else if(action==='start'){if(!definition.sequence.length)fail('EMPTY_SEQUENCE','Story sequence is empty');index=input.occurrenceId===undefined?0:occurrenceIndex(definition,input.occurrenceId);}
  else if(action==='pause'||action==='play')requireActive();
  else if(action==='set-auto-advance'&&!active)fail('NO_ACTIVE_BEAT','No Story beat is active');
  else if(action==='set-auto-advance'&&typeof input.enabled!=='boolean')fail('INVALID_STORY_ACTION','Auto-advance requires a boolean enabled value');
  else if(action==='set-auto-advance'&&input.enabled===true&&(attachedIndex===null||sequenceEnded))fail('OCCURRENCE_REQUIRED','Attach an occurrence before enabling Auto-advance',occurrenceIds(definition));
  else if(action==='resume')index=occurrenceIndex(definition,input.occurrenceId);
  else if(action==='advance'){requireActive();if(attachedIndex===null)fail('OCCURRENCE_REQUIRED','Attach an occurrence before advancing',occurrenceIds(definition));if(attachedIndex+1>=definition.sequence.length)fail('FINAL_OCCURRENCE','The final Story occurrence has no next occurrence');index=attachedIndex+1;}
  else if(action==='seek'){beat=requireActive().beat;validateTimedDirect(beat);if(!finite(input.localTimeSeconds)||input.localTimeSeconds<0||input.localTimeSeconds>duration(beat))fail('INVALID_LOCAL_TIME','Seek time is outside the active beat');}
  else if(action==='replay'||action==='loop'){beat=beatById(definition,input.beatId);validateTimedDirect(beat);}
  else if(action==='return-normal'){if(!active)fail('NO_ACTIVE_BEAT','Story is already in Normal');}
  else if(action!=='set-auto-advance')fail('INVALID_STORY_ACTION','Unsupported Story transport action');
  let changed=pendingTransition!==null;materialize(now);pendingTransition=null;
  if(action==='launch'){
   const ownership=attachedIndex!==null;if(!active||active.beat.id!==beat.id){enter(beat,now,null);changed=true;}else{const canRun=active.beat.timing.kind!=='timed'||active.phaseBase<duration(active.beat);changed=changed||ownership||sequenceEnded||looping||autoAdvance||(!phaseRunning&&canRun);attachedIndex=null;sequenceEnded=false;looping=false;autoAdvance=false;if(ownership)storyEpoch++;if(canRun)phaseRunning=true;}
   attachedIndex=null;autoAdvance=false;looping=false;
  }else if(action==='start'){beat=beatById(definition,definition.sequence[index].beatId);enter(beat,now,index);autoAdvance=true;looping=false;changed=true;
  }else if(action==='pause'){changed=changed||phaseRunning;phaseRunning=false;}
  else if(action==='play'){changed=changed||!phaseRunning;phaseRunning=true;}
  else if(action==='set-auto-advance'){changed=changed||autoAdvance!==input.enabled;autoAdvance=input.enabled;}
  else if(action==='resume'){
   beat=beatById(definition,definition.sequence[index].beatId);if(!active||active.beat.id!==beat.id)enter(beat,now,index);else{attachedIndex=index;active.dwellBase=0;active.dwellAt=now;storyEpoch++;sequenceEnded=false;phaseRunning=true;}autoAdvance=true;looping=false;changed=true;
  }else if(action==='advance'){beat=beatById(definition,definition.sequence[index].beatId);const keepAuto=autoAdvance;enter(beat,now,index);autoAdvance=keepAuto;looping=false;changed=true;
  }else if(action==='seek'){active.phaseBase=input.localTimeSeconds;active.phaseAt=now;phaseRunning=false;looping=false;storyEpoch++;changed=true;
  }else if(action==='replay'||action==='loop'){enter(beat,now,null);autoAdvance=false;looping=action==='loop';changed=true;
  }else if(action==='return-normal'){active=null;attachedIndex=null;phaseRunning=false;autoAdvance=false;looping=false;sequenceEnded=false;storyEpoch++;changed=true;
  }
  if(changed)storyRevision++;return status(now);
 }
 function completeFrame(now){
  if(!active||pendingTransition)return;
  const occurrence=attachedIndex===null?null:definition.sequence[attachedIndex];
  if(occurrence?.follow.kind==='after'&&phaseRunning&&autoAdvance&&!sequenceEnded&&dwellAt(now)>=occurrence.follow.seconds){pendingTransition=attachedIndex+1<definition.sequence.length?freeze({kind:'advance',revision:storyRevision,index:attachedIndex+1}):freeze({kind:'end',revision:storyRevision});return;}
  if(attachedIndex===null&&looping&&phaseRunning&&active.beat.timing.kind==='timed'&&phaseAt(now)>=duration(active.beat))pendingTransition=freeze({kind:'loop',revision:storyRevision,beatId:active.beat.id});
 }
 function beginFrame(now){
  const transition=pendingTransition;pendingTransition=null;if(!transition||transition.revision!==storyRevision)return false;materialize(now);
  if(transition.kind==='advance'){const beat=beatById(definition,definition.sequence[transition.index].beatId),keepAuto=autoAdvance;enter(beat,now,transition.index);autoAdvance=keepAuto;looping=false;}
  else if(transition.kind==='loop'){enter(beatById(definition,transition.beatId),now,null);autoAdvance=false;looping=true;}
  else{sequenceEnded=true;autoAdvance=false;}
  storyRevision++;return true;
 }
 function reset(now){active=null;phaseRunning=false;autoAdvance=false;looping=false;attachedIndex=null;sequenceEnded=false;pendingTransition=null;storyEpoch++;storyRevision++;return status(now);}
 return freeze({apply,beginFrame,completeFrame,frame,status,reset,revision:()=>storyRevision});
}
