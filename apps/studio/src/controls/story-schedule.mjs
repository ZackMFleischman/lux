// Pure two-slot Story ownership and transport state. GPU work and authored
// callbacks are driven by the worker; this object only decides when ownership
// may change and which immutable Story frame belongs to each visible slot.
const freeze=Object.freeze,RuntimeError=Error,RuntimeString=String,define=Object.defineProperty,hasOwn=Object.hasOwn,createObject=Object.create;
const min=Math.min,max=Math.max,finite=Number.isFinite,maxSafe=Number.MAX_SAFE_INTEGER;
const call=Function.prototype.call,MapCtor=Map,mapGet=call.bind(Map.prototype.get),mapSet=call.bind(Map.prototype.set),mapDelete=call.bind(Map.prototype.delete),mapSize=call.bind(Object.getOwnPropertyDescriptor(Map.prototype,'size').get);
const clamp=(value,lower,upper)=>min(upper,max(lower,value));
function fail(code,message){const error=new RuntimeError(message);define(error,'code',{value:code,enumerable:true});throw error;}

export function createStorySchedule({story,storyHash=null,visualCapabilities=freeze([]),identity}){
 const beats=new MapCtor(),occurrences=new MapCtor();
 for(let index=0;index<story.beats.length;index++)mapSet(beats,story.beats[index].id,story.beats[index]);
 for(let index=0;index<story.sequence.length;index++)mapSet(occurrences,story.sequence[index].id,freeze({...story.sequence[index],index}));
 let activationSequence=0,storyEpoch=0,storyRevision=0,preparationEpoch=0;
 let committed=null,outgoing=null,incoming=null,pending=null,fadeBase=0,fadeAt=0,phaseRunning=false,autoAdvance=false,loop=false,dueNext=null,deferredRestart=null,preparationFailure=null;
 const retiring=new MapCtor();
 const duration=activation=>activation?.beat?.timing?.kind==='timed'?activation.beat.timing.durationSeconds:null;
 function targetFor(input){
  let beat=null,occurrence=null,visualId=null;
  if(input.action==='return-normal')visualId=story.normalVisualId;
  else if(input.action==='launch'||input.action==='replay'||input.action==='loop'){
   beat=mapGet(beats,input.beatId);if(!beat)fail('BEAT_REQUIRED','Story beat is unavailable');visualId=beat.visualId;
   if((input.action==='replay'||input.action==='loop')&&beat.timing.kind!=='timed')fail('DIRECT_SEEK_REQUIRED','Replay and loop require a timed direct-seek beat');
  }else if(input.action==='start'){
   occurrence=input.occurrenceId===undefined?(story.sequence[0]?mapGet(occurrences,story.sequence[0].id):null):mapGet(occurrences,input.occurrenceId);if(!occurrence)fail('OCCURRENCE_REQUIRED','Story occurrence is unavailable');beat=mapGet(beats,occurrence.beatId);visualId=occurrence.visualId;
  }else if(input.action==='resume'){
   occurrence=mapGet(occurrences,input.occurrenceId);if(!occurrence)fail('OCCURRENCE_REQUIRED','Story occurrence is unavailable');beat=mapGet(beats,occurrence.beatId);visualId=occurrence.visualId;
  }else if(input.action==='advance'){
   if(!committed?.occurrence)fail('OCCURRENCE_REQUIRED','Attach an occurrence before advancing');const row=story.sequence[committed.occurrence.index+1];occurrence=row?mapGet(occurrences,row.id):null;if(!occurrence)fail('FINAL_OCCURRENCE','The final Story occurrence has no next occurrence');beat=mapGet(beats,occurrence.beatId);visualId=occurrence.visualId;
  }else fail('INVALID_STORY_ACTION','Unsupported ownership-changing Story action');
  return freeze({visualId,beat,occurrence:occurrence??null,action:input.action});
 }
 function nextActivation(target,now,slotId){
  if(activationSequence>=maxSafe)fail('ACTIVATION_EXHAUSTED','Story activation identity is exhausted; restart runtime');
  activationSequence++;storyEpoch++;
  return {slotId,visualId:target.visualId,beat:target.beat,occurrence:target.occurrence,activationId:activationSequence,storyEpoch,enteredAt:now,phaseBase:0,phaseAt:now,dwellBase:0,dwellAt:now,heldFrame:null};
 }
 function localAt(activation,now){const limit=duration(activation);if(limit===null)return null;return clamp(activation.phaseBase+(phaseRunning?max(0,now-activation.phaseAt):0),0,limit);}
 function storyFrame(activation,now){
  if(!activation.beat)return freeze({state:'normal',storyEpoch:activation.storyEpoch});
  const local=localAt(activation,now),limit=duration(activation);
  return freeze({state:'active',beatId:activation.beat.id,activationId:activation.activationId,occurrenceId:activation.occurrence?.id??null,elapsedSeconds:max(0,now-activation.enteredAt),localTimeSeconds:local,progress:local===null?null:local/limit,storyEpoch:activation.storyEpoch});
 }
 function dwellAt(activation,now){if(!activation?.occurrence||activation.occurrence.follow.kind!=='after')return 0;return activation.dwellBase+(phaseRunning&&autoAdvance?max(0,now-activation.dwellAt):0);}
 function materialize(now){if(!committed)return;if(committed.beat){const local=localAt(committed,now);if(local!==null){committed.phaseBase=local;committed.phaseAt=now;}}committed.dwellBase=dwellAt(committed,now);committed.dwellAt=now;if(incoming&&story.crossfadeSeconds>0){fadeBase=progressAt(now);fadeAt=now;}}
 function progressAt(now){if(!outgoing||!incoming)return null;if(story.crossfadeSeconds===0)return 1;const value=fadeBase+(phaseRunning?max(0,now-fadeAt)/story.crossfadeSeconds:0);return value>=1-1e-12?1:clamp(value,0,1);}
 function slotCounts(){
  let preparing=0,ready=0,unsettled=0;if(pending){if(pending.phase==='preparing')preparing=1;else if(pending.phase==='ready')ready=1;else if(pending.phase==='cancelled')unsettled=1;}
  return freeze({preparing,ready,active:(outgoing?1:0)+(committed?1:0),retiring:mapSize(retiring),unsettled});
 }
 function resourceStatus(){const slotStates=slotCounts();return freeze({slots:slotStates.preparing+slotStates.ready+slotStates.active+slotStates.retiring+slotStates.unsettled,slotStates,pendingCreates:pending?.phase==='preparing'||pending?.phase==='cancelled'?1:0,storyTargetBytes:0,assetLeases:0,assetLeaseBytes:0,assetStagingJobs:0,assetStagingBytes:0,pendingImports:0,ownedModuleURLs:0,pendingCallbacks:0,gpuSubmissions:0,readbackGrants:0,readbackBytes:0});}
 function publicActivation(value,now){return value?freeze({slotId:value.slotId,visualId:value.visualId,beatId:value.beat?.id??null,occurrenceId:value.occurrence?.id??null,activationId:value.activationId,storyEpoch:value.storyEpoch,frame:value.heldFrame??storyFrame(value,now)}):null;}
 function status(now,previewPlaying=true){
  const occurrence=committed?.occurrence??null,dwell=dwellAt(committed,now),remaining=occurrence?.follow.kind==='after'?max(0,occurrence.follow.seconds-dwell):null,next=occurrence&&occurrence.index+1<story.sequence.length?story.sequence[occurrence.index+1]:null;
  const disabledReasons=createObject(null),disabled=(action,code,message)=>{if(!hasOwn(disabledReasons,action))define(disabledReasons,action,{value:freeze({code,message}),enumerable:true});};
  const ownershipActions=['launch','start','advance','resume','replay','loop','return-normal'];
  if(outgoing){for(let index=0;index<ownershipActions.length;index++)disabled(ownershipActions[index],'STORY_TRANSITION_BUSY','A Story transition is already visible');}
  else if(pending||mapSize(retiring)){for(let index=0;index<ownershipActions.length;index++)disabled(ownershipActions[index],'STORY_CAPACITY_BUSY','Story activation capacity is still owned');}
  if(!committed?.beat){const actions=['pause','play','seek','set-auto-advance','advance'];for(let index=0;index<actions.length;index++)disabled(actions[index],'NO_ACTIVE_BEAT','No Story beat is active');}
  else{if(committed.beat.timing.kind!=='timed'){disabled('seek','DIRECT_SEEK_REQUIRED','The active Story beat does not support direct seek');disabled('replay','DIRECT_SEEK_REQUIRED','Replay requires a timed direct-seek beat');disabled('loop','DIRECT_SEEK_REQUIRED','Loop requires a timed direct-seek beat');}if(!committed.occurrence){disabled('set-auto-advance','OCCURRENCE_REQUIRED','Attach an occurrence before enabling Auto-advance');disabled('advance','OCCURRENCE_REQUIRED','Attach an occurrence before advancing');}}
  return freeze({...identity,definition:story,storyHash,visualCapabilities,storyRevision,phase:phaseRunning?'running':'paused',autoAdvance,loop,effectiveAdvancing:!!previewPlaying&&phaseRunning,committed:publicActivation(committed,now),outgoing:publicActivation(outgoing,now),incoming:publicActivation(incoming,now),crossfadeProgress:progressAt(now),pendingPreparation:pending?freeze({token:pending.token,phase:pending.phase,visualId:pending.target.visualId,beatId:pending.target.beat?.id??null,occurrenceId:pending.target.occurrence?.id??null,commandId:pending.commandId??null,cancelled:pending.phase==='cancelled'}):null,preparationFailure,dueNext,sequence:freeze({state:occurrence?'attached':'detached',occurrenceId:occurrence?.id??null,index:occurrence?.index??null,nextOccurrenceId:next?.id??null,dwellElapsedSeconds:dwell,dwellRemainingSeconds:remaining,awaitingCue:!!occurrence&&occurrence.follow.kind==='manual'}),disabledReasons:freeze(disabledReasons),resources:resourceStatus()});
 }
 function reserve(target,commandId,now){
  if(pending||outgoing||mapSize(retiring)>0)fail(outgoing?'STORY_TRANSITION_BUSY':'STORY_CAPACITY_BUSY',outgoing?'A Story transition is already visible':'Story activation capacity is still owned');
  dueNext=null;const token=`${identity.generation}:${++preparationEpoch}`,slotKey=`story:${token}`;
  pending={token,slotKey,target,commandId,phase:'preparing',requestedAt:now};
  preparationFailure=null;
  return freeze({result:'preparing',preparation:freeze({token,slotKey,visualId:target.visualId,beatId:target.beat?.id??null,occurrenceId:target.occurrence?.id??null,commandId:commandId??null,requestedAt:now,storyFrame:target.beat?freeze({state:'active',beatId:target.beat.id,activationId:activationSequence+1,occurrenceId:target.occurrence?.id??null,elapsedSeconds:0,localTimeSeconds:target.beat.timing.kind==='timed'?0:null,progress:target.beat.timing.kind==='timed'?0:null,storyEpoch:storyEpoch+1}):freeze({state:'normal',storyEpoch:storyEpoch+1})})});
 }
 function initialize(now){if(committed||pending)fail('STORY_ALREADY_INITIALIZED','Story schedule is already initialized');return reserve(freeze({visualId:story.normalVisualId,beat:null,occurrence:null,action:'initialize'}),null,now);}
 function cancel(token,reason='cancelled'){
  if(!pending||pending.token!==token)return freeze({cancelled:false});
  if(pending.phase==='ready'){mapSet(retiring,pending.slotId,freeze({slotId:pending.slotId,reason}));pending=null;return freeze({cancelled:true,retiring:true});}
  pending.phase='cancelled';pending.cancelReason=reason;preparationEpoch++;return freeze({cancelled:true,retiring:false});
 }
 function prepared(token,{slotId}){
  if(!pending||pending.token!==token)return freeze({accepted:false,reason:'stale'});
  if(pending.phase==='cancelled'){mapSet(retiring,slotId,freeze({slotId,reason:pending.cancelReason??'cancelled'}));pending=null;return freeze({accepted:false,reason:'cancelled'});}
  if(pending.phase!=='preparing')fail('STORY_PREPARATION_STATE','Story preparation is not awaiting an instance');
  pending.phase='ready';pending.slotId=slotId;return freeze({accepted:true});
 }
 function preparationSettled(token){if(pending?.token===token&&pending.phase==='cancelled'){pending=null;return true;}return false;}
 function preparationFailed(token,error){
  if(!pending||pending.token!==token)return false;
  preparationFailure=freeze({visualId:pending.target.visualId,beatId:pending.target.beat?.id??null,occurrenceId:pending.target.occurrence?.id??null,code:typeof error?.code==='string'?error.code:'STORY_PREPARATION_FAILED',message:RuntimeString(error?.message||error).slice(0,500)});pending=null;return true;
 }
 function stageCommit(token,now,frameId){
  if(!pending||pending.token!==token||pending.phase!=='ready')fail('STORY_PREPARATION_STATE','Story preparation is not ready to commit');
  const commandId=pending.commandId,target=pending.target,next={slotId:pending.slotId,visualId:target.visualId,beat:target.beat,occurrence:target.occurrence,activationId:activationSequence+1,storyEpoch:storyEpoch+1,enteredAt:now,phaseBase:0,phaseAt:now,dwellBase:0,dwellAt:now,heldFrame:null};
  const oldFrame=committed?storyFrame(committed,now):null;
  const rows=committed?(story.crossfadeSeconds===0?freeze([freeze({role:'incoming',slotId:next.slotId,weight:1,story:storyFrame(next,now)})]):freeze([freeze({role:'outgoing',slotId:committed.slotId,weight:1,story:oldFrame}),freeze({role:'incoming',slotId:next.slotId,weight:0,story:storyFrame(next,now)})])):freeze([freeze({role:'committed',slotId:next.slotId,weight:1,story:storyFrame(next,now)})]);
  return freeze({token,commandId,target,next,now,frameId,rows});
 }
 function publishCommit(stage){
  if(!pending||pending.token!==stage.token||pending.phase!=='ready')fail('STORY_PREPARATION_STATE','Story staged commit is no longer current');
  const {commandId,target,next,now,frameId}=stage;pending=null;dueNext=null;activationSequence=next.activationId;storyEpoch=next.storyEpoch;
  if(!committed){committed=next;phaseRunning=false;storyRevision++;}
  else{
   materialize(now);outgoing=committed;outgoing.heldFrame=storyFrame(outgoing,now);incoming=next;committed=next;phaseRunning=true;autoAdvance=!!target.occurrence;loop=target.action==='loop';fadeBase=0;fadeAt=now;storyRevision++;
   if(story.crossfadeSeconds===0)finishOverlap(now);
  }
  return freeze({result:'applied',commandId,storyRevision,frameId,timeSeconds:now,status:status(now)});
 }
 function finishOverlap(now){if(!outgoing)return;mapSet(retiring,outgoing.slotId,freeze({slotId:outgoing.slotId,reason:'crossfade-complete'}));outgoing=null;incoming=null;fadeBase=0;fadeAt=now;}
 function beginFrame(now,previewPlaying=true){return status(now,previewPlaying);}
 function completePresentedFrame(now,previewPlaying=true){if(outgoing&&incoming&&previewPlaying&&phaseRunning&&progressAt(now)>=1)finishOverlap(now);completeFrame(now);}
 function completeFrame(now){
  if(deferredRestart||pending)return;
  if(loop&&phaseRunning&&committed?.beat?.timing.kind==='timed'&&localAt(committed,now)>=committed.beat.timing.durationSeconds){deferredRestart=freeze({loop:true});storyRevision++;return;}
  if(dueNext||!committed?.occurrence||!autoAdvance||!phaseRunning)return;
  const occurrence=committed.occurrence;if(occurrence.follow.kind!=='after'||dwellAt(committed,now)<occurrence.follow.seconds)return;
  const next=story.sequence[occurrence.index+1];if(next)dueNext=freeze({occurrenceId:next.id,state:'waiting'});else autoAdvance=false;
 }
 function takeDue(now){
  if(!dueNext)return freeze({result:'waiting'});
  if(!phaseRunning||!autoAdvance||!committed?.occurrence||committed.occurrence.index+1>=story.sequence.length||story.sequence[committed.occurrence.index+1].id!==dueNext.occurrenceId){dueNext=null;return freeze({result:'waiting'});}
  if(outgoing||pending||mapSize(retiring))return freeze({result:'waiting'});
  const occurrence=mapGet(occurrences,dueNext.occurrenceId);dueNext=null;
  return reserve(freeze({visualId:occurrence.visualId,beat:mapGet(beats,occurrence.beatId),occurrence,action:'advance'}),null,now);
 }
 function frames(now){
  if(outgoing&&incoming){const progress=progressAt(now);return freeze([freeze({role:'outgoing',slotId:outgoing.slotId,weight:1-progress,story:outgoing.heldFrame}),freeze({role:'incoming',slotId:incoming.slotId,weight:progress,story:storyFrame(incoming,now)})]);}
  return committed?freeze([freeze({role:'committed',slotId:committed.slotId,weight:1,story:storyFrame(committed,now)})]):freeze([]);
 }
 function request(input,now){
  if(!input||typeof input!=='object')fail('INVALID_STORY_ACTION','Invalid Story action');
  if(input.action==='pause'||input.action==='play'){
   if(!committed?.beat)fail('NO_ACTIVE_BEAT','No Story beat is active');
   const cancelledCommandId=input.action==='pause'?(pending?.commandId??null):null;if(input.action==='pause'&&pending)cancel(pending.token,input.action);materialize(now);const next=input.action==='play';const changed=phaseRunning!==next;phaseRunning=next;if(input.action==='pause')dueNext=null;if(changed)storyRevision++;
   return freeze({result:'applied',commandId:input.commandId??null,storyRevision,status:status(now),...(cancelledCommandId?{cancelledCommandId}:{})});
  }
  if(input.action==='seek'){
   if(!committed?.beat||committed.beat.timing.kind!=='timed'||!finite(input.localTimeSeconds)||input.localTimeSeconds<0||input.localTimeSeconds>committed.beat.timing.durationSeconds)fail('INVALID_LOCAL_TIME','Seek time is outside the active beat');
   const cancelledCommandId=pending?.commandId??null;if(pending)cancel(pending.token,'seek');materialize(now);committed.phaseBase=input.localTimeSeconds;committed.phaseAt=now;phaseRunning=false;loop=false;dueNext=null;storyEpoch++;committed.storyEpoch=storyEpoch;storyRevision++;
   return freeze({result:'applied',commandId:input.commandId??null,storyRevision,status:status(now),...(cancelledCommandId?{cancelledCommandId}:{})});
  }
  if(input.action==='set-auto-advance'){
   if(!committed?.occurrence)fail('OCCURRENCE_REQUIRED','Attach an occurrence before enabling Auto-advance');materialize(now);const changed=autoAdvance!==input.enabled;autoAdvance=input.enabled;if(!autoAdvance)dueNext=null;if(changed)storyRevision++;return freeze({result:'applied',commandId:input.commandId??null,storyRevision,status:status(now)});
  }
  const target=targetFor(input);
  if(outgoing)fail('STORY_TRANSITION_BUSY','A Story transition is already visible');
  if(pending||mapSize(retiring)>0)fail('STORY_CAPACITY_BUSY','Story activation capacity is still owned');
  if(input.action==='return-normal'&&committed&&!committed.beat&&committed.visualId===story.normalVisualId)return freeze({result:'applied',commandId:input.commandId??null,storyRevision,status:status(now)});
  const same=committed&&committed.visualId===target.visualId&&committed.beat?.id===(target.beat?.id??undefined);
  if(input.action==='launch'&&same){materialize(now);const changed=!!committed.occurrence||autoAdvance||loop;committed.occurrence=null;autoAdvance=false;loop=false;dueNext=null;if(changed)storyRevision++;return freeze({result:'applied',commandId:input.commandId??null,storyRevision,status:status(now)});}
  if(input.action==='resume'&&same){materialize(now);committed.occurrence=target.occurrence;committed.dwellBase=0;committed.dwellAt=now;autoAdvance=true;loop=false;phaseRunning=true;dueNext=null;storyEpoch++;committed.storyEpoch=storyEpoch;storyRevision++;return freeze({result:'applied',commandId:input.commandId??null,storyRevision,status:status(now)});}
  if((input.action==='replay'||input.action==='loop')&&same){materialize(now);dueNext=null;if(committed.beat?.timing.kind==='timed'){committed.phaseBase=committed.beat.timing.durationSeconds;committed.phaseAt=now;phaseRunning=false;deferredRestart=freeze({loop:input.action==='loop'});}else{activationSequence++;storyEpoch++;committed.activationId=activationSequence;committed.storyEpoch=storyEpoch;committed.enteredAt=now;committed.phaseBase=0;committed.phaseAt=now;committed.occurrence=null;phaseRunning=true;autoAdvance=false;loop=input.action==='loop';}storyRevision++;return freeze({result:'applied',commandId:input.commandId??null,storyRevision,status:status(now)});}
  return reserve(target,input.commandId??null,now);
 }
 function settleRetirement(slotId){return mapDelete(retiring,slotId);}
 function releaseSlot(slotId){let changed=mapDelete(retiring,slotId);if(outgoing?.slotId===slotId){outgoing=null;changed=true;}if(incoming?.slotId===slotId){incoming=null;changed=true;}if(committed?.slotId===slotId){committed=null;changed=true;}return changed;}
 function restartAfterEndpoint(now){if(!deferredRestart)return false;activationSequence++;storyEpoch++;committed.activationId=activationSequence;committed.storyEpoch=storyEpoch;committed.enteredAt=now;committed.phaseBase=0;committed.phaseAt=now;committed.dwellBase=0;committed.dwellAt=now;committed.occurrence=null;phaseRunning=true;autoAdvance=false;loop=deferredRestart.loop;deferredRestart=null;return true;}
 function restartPending(){return deferredRestart!==null;}
 return freeze({initialize,request,prepared,stageCommit,publishCommit,cancel,preparationSettled,preparationFailed,settleRetirement,releaseSlot,beginFrame,completePresentedFrame,restartPending,restartAfterEndpoint,completeFrame,takeDue,frames,status});
}
