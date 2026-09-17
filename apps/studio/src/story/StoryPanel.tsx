import {useEffect,useRef,useState} from 'react';
import {Button,FormControlLabel,Switch,Tooltip} from '@mui/material';
import type {RuntimeView,StudioController} from '../service-client.ts';
import {isUncertainStoryError} from '../service-client.ts';

type StoryStatus=NonNullable<RuntimeView['story']|RuntimeView['storySchedule']>;
type StorySchedule=NonNullable<RuntimeView['storySchedule']>;
type LegacyStoryStatus=NonNullable<RuntimeView['story']>;
type PanelStatus=LegacyStoryStatus|(StorySchedule&Readonly<{frame:NonNullable<StorySchedule['committed']>['frame'];resumeCandidates:readonly string[]}>);
type StoryAction=Parameters<StudioController['storyTransport']>[0];
type StoryResult=Awaited<ReturnType<StudioController['storyTransport']>>;
type RetryIntent={action:StoryAction;commandId:string;revision:number;label:string;kind:'command'|'seek'};

const actionKey=(action:StoryAction)=>action.action;
const errorText=(error:unknown)=>error instanceof Error?error.message:String(error);
const seconds=(value:number)=>{const safe=Math.max(0,value);return safe>0&&safe<1?`${Number((safe*1000).toPrecision(3))}ms`:`${safe.toFixed(1)}s`;};

export function storyStatusLabel(status:StoryStatus|undefined):string{
  if(!status)return 'Unavailable';
  const frame='scheduleHash'in status?status.committed?.frame:status.frame;
  if(!frame)return 'scheduleHash'in status&&status.pendingPreparation?`Preparing ${status.pendingPreparation.visualId}`:'Preparing Story';
  if(frame.state==='normal')return 'Normal';
  if(status.sequence.state==='ended')return 'Sequence ended';
  if(status.sequence.awaitingCue)return 'Awaiting cue';
  return status.definition.beats.find(beat=>beat.id===frame.beatId)?.label??frame.beatId;
}

const scheduleFrame=(status:StoryStatus|undefined)=>status&&('scheduleHash'in status?status.committed?.frame:status.frame);
export function StoryPanel({status:statusInput,available,controller,onError,previewPlayback}:{status:StoryStatus|undefined;available:boolean;controller:StudioController;onError:(error:string)=>void;previewPlayback?:RuntimeView['playback']}){
  const schedule=statusInput&&'scheduleHash'in statusInput?statusInput:undefined,frame=scheduleFrame(statusInput);
  const preparationFailure=schedule?.preparationFailure,preparationFailureMessage=preparationFailure
    ?`Could not prepare source ${preparationFailure.visualId}${preparationFailure.beatId?` for ${schedule.definition.beats.find(beat=>beat.id===preparationFailure.beatId)?.label??preparationFailure.beatId}`:''}. ${preparationFailure.message}`
    :undefined;
  const activeBeatId=frame?.state==='active'?frame.beatId:null;
  const [selectedBeatId,setSelectedBeatId]=useState<string|null>(activeBeatId??statusInput?.definition.beats[0]?.id??null);
  const [selectedOccurrenceId,setSelectedOccurrenceId]=useState<string|null>(statusInput?.sequence.occurrenceId??statusInput?.definition.sequence[0]?.id??null);
  const [pending,setPending]=useState<string|null>(null),[retry,setRetry]=useState<RetryIntent|null>(null),commandInFlight=useRef(false);
  const currentStatus=useRef(statusInput);currentStatus.current=statusInput;
  const scrub=useRef({inFlight:false,queued:null as number|null,revision:statusInput?.storyRevision??0,lastAcknowledged:frame?.state==='active'?frame.localTimeSeconds??0:0,identity:frame?.state==='active'?`${frame.beatId}:${frame.activationId}`:''});
  const scrubGeneration=useRef(0),pointerGesture=useRef({active:false,cancelled:false});
  const [scrubValue,setScrubValue]=useState(scrub.current.lastAcknowledged),[scrubBusy,setScrubBusy]=useState(false);
  useEffect(()=>{
    if(!statusInput)return;
    if(!statusInput.definition.beats.some(beat=>beat.id===selectedBeatId))setSelectedBeatId(activeBeatId??statusInput.definition.beats[0]?.id??null);
    if(!statusInput.definition.sequence.some(row=>row.id===selectedOccurrenceId))setSelectedOccurrenceId(statusInput.sequence.occurrenceId??statusInput.definition.sequence[0]?.id??null);
  },[statusInput?.storyHash,activeBeatId,selectedBeatId,selectedOccurrenceId]);
  useEffect(()=>{
    const identity=frame?.state==='active'?`${frame.beatId}:${frame.activationId}`:'';
    if(identity!==scrub.current.identity){scrubGeneration.current++;scrub.current={inFlight:false,queued:null,revision:statusInput?.storyRevision??0,lastAcknowledged:frame?.state==='active'?frame.localTimeSeconds??0:0,identity};pointerGesture.current={active:false,cancelled:false};setScrubBusy(false);setRetry(current=>current?.kind==='seek'?null:current);}
    if(statusInput&&!scrub.current.inFlight){scrub.current.revision=statusInput.storyRevision;if(frame?.state==='active'&&frame.localTimeSeconds!==null){scrub.current.lastAcknowledged=frame.localTimeSeconds;setScrubValue(frame.localTimeSeconds);}}
  },[statusInput?.storyRevision,frame]);
  if(!statusInput)return <section className="story-panel story-unavailable" aria-label="Story"><h2>Story</h2><p className="hint">Build a Story-aware visual to use beat transport.</p></section>;
  if(!frame)return <section className="story-panel" aria-label="Story"><header className="story-header"><div><span className="eyebrow">STORY</span><h2>{storyStatusLabel(statusInput)}</h2></div><span className="story-state">Preparing</span></header>{preparationFailureMessage&&<p className="story-preparation-failure" role="alert">{preparationFailureMessage}</p>}{schedule?.pendingPreparation&&<p role="status">{schedule.pendingPreparation.phase==='ready'?'Ready to show':'Preparing'} source {schedule.pendingPreparation.visualId}.</p>}{Object.values(statusInput.disabledReasons).find(reason=>/CAPACITY|RESOURCE|SLOT/i.test(reason.code))&&<p className="hint">{Object.values(statusInput.disabledReasons).find(reason=>/CAPACITY|RESOURCE|SLOT/i.test(reason.code))!.message}</p>}</section>;
  const status:PanelStatus=schedule?Object.assign({},schedule,{frame,resumeCandidates:Object.freeze([] as string[])}):statusInput as LegacyStoryStatus;
  const beats=new Map(status.definition.beats.map(beat=>[beat.id,beat])),activeBeat=activeBeatId?beats.get(activeBeatId):undefined,selectedBeat=selectedBeatId?beats.get(selectedBeatId):undefined;
  const selectedOccurrence=status.definition.sequence.find(row=>row.id===selectedOccurrenceId),selectedOccurrenceIndex=selectedOccurrence?status.definition.sequence.findIndex(row=>row.id===selectedOccurrence.id):-1;
  const disabled=(action:StoryAction['action'])=>(status.disabledReasons as Readonly<Record<string,Readonly<{message:string}>>>)[action]?.message;
  const capabilityFor=(visualId:string|undefined,beatId:string|undefined)=>visualId&&beatId?schedule?.visualCapabilities.find(row=>row.visualId===visualId)?.storyCapability?.beats.find(beat=>beat.id===beatId):undefined;
  const capabilityReason=(visualId:string|undefined,beatId:string|undefined)=>schedule&&!capabilityFor(visualId,beatId)?`Source ${visualId??'unknown'} does not expose ${beatId??'this beat'}.`:undefined;
  const activeVisualId=schedule?.committed?.visualId,activeSeekReason=schedule&&activeBeat?.timing.kind==='timed'&&capabilityFor(activeVisualId,activeBeat.id)?.seek!=='direct'?`Source ${activeVisualId} does not support direct seek for ${activeBeat.label}.`:undefined;
  const capacityReason=Object.values(status.disabledReasons).find(reason=>/CAPACITY|RESOURCE|SLOT/i.test(reason.code));
  async function runAction(action:StoryAction,label:string,retryIntent?:RetryIntent){
    if(commandInFlight.current||scrub.current.inFlight||!available)return;
    const reason=disabled(actionKey(action));if(reason){onError(reason);return;}
    const intent=retryIntent??{action,commandId:crypto.randomUUID(),revision:currentStatus.current!.storyRevision,label,kind:'command' as const};
    commandInFlight.current=true;setPending(label);setRetry(null);
    try{await controller.storyTransport(intent.action,intent.commandId,intent.revision);}
    catch(error){if(isUncertainStoryError(error))setRetry(intent);onError(errorText(error));}
    finally{commandInFlight.current=false;setPending(null);}
  }
  async function sendSeek(target:number,revision:number,commandId:string=crypto.randomUUID()){
    if(!available||commandInFlight.current)return;
    const identity=scrub.current.identity,generation=scrubGeneration.current,intent:RetryIntent={action:{action:'seek',localTimeSeconds:target},commandId,revision,label:`seek to ${seconds(target)}`,kind:'seek'};
    scrub.current.inFlight=true;setScrubBusy(true);setRetry(null);let next:number|null=null;
    try{
      const result=await controller.storyTransport(intent.action,intent.commandId,intent.revision) as StoryResult;
      const acknowledged=result.currentStatus,frame=scheduleFrame(acknowledged),ackIdentity=frame?.state==='active'?`${frame.beatId}:${frame.activationId}`:'';
      if(generation!==scrubGeneration.current||scrub.current.identity!==identity||ackIdentity!==identity)return;
      scrub.current.revision=acknowledged.storyRevision;
      if(frame?.state==='active'&&frame.localTimeSeconds!==null){scrub.current.lastAcknowledged=frame.localTimeSeconds;setScrubValue(frame.localTimeSeconds);}
      next=scrub.current.queued;scrub.current.queued=null;
    }catch(error){
      if(generation!==scrubGeneration.current||scrub.current.identity!==identity)return;
      scrub.current.queued=null;
      const latest=currentStatus.current,latestFrame=scheduleFrame(latest),latestIdentity=latestFrame?.state==='active'?`${latestFrame.beatId}:${latestFrame.activationId}`:'';
      if(latest&&latestIdentity===identity){scrub.current.revision=latest.storyRevision;if(latestFrame?.state==='active'&&latestFrame.localTimeSeconds!==null){scrub.current.lastAcknowledged=latestFrame.localTimeSeconds;setScrubValue(latestFrame.localTimeSeconds);}}
      else setScrubValue(scrub.current.lastAcknowledged);
      if(isUncertainStoryError(error))setRetry(intent);onError(errorText(error));
    }
    finally{if(generation!==scrubGeneration.current||scrub.current.identity!==identity)return;scrub.current.inFlight=false;setScrubBusy(false);if(next!==null&&next!==scrub.current.lastAcknowledged)void sendSeek(next,scrub.current.revision);}
  }
  function queueSeek(value:number){if(commandInFlight.current)return;setScrubValue(value);if(scrub.current.inFlight)scrub.current.queued=value;else void sendSeek(value,scrub.current.revision);}
  function retryLast(){if(!retry)return;if(retry.kind==='seek')void sendSeek((retry.action as Extract<StoryAction,{action:'seek'}>).localTimeSeconds,retry.revision,retry.commandId);else void runAction(retry.action,retry.label,retry);}
  const blocked=!available||!!pending||scrubBusy;
  const selectedMoveAction:StoryAction|undefined=selectedOccurrence?(status.frame.state==='active'&&status.sequence.state==='detached'?{action:'resume',occurrenceId:selectedOccurrence.id}:{action:'start',occurrenceId:selectedOccurrence.id}):undefined;
  const selectedOccurrenceVisual=selectedOccurrence&&'visualId'in selectedOccurrence?selectedOccurrence.visualId as string:undefined;
  const selectedMoveReason=selectedMoveAction?(capabilityReason(selectedOccurrenceVisual,selectedOccurrence?.beatId)??disabled(selectedMoveAction.action)):undefined;
  return <section className="story-panel" aria-label="Story">
    <header className="story-header"><div><span className="eyebrow">STORY</span><h2>{storyStatusLabel(status)}</h2></div><span className={`story-state story-state-${status.frame.state}`}>{status.frame.state==='normal'?'Normal':'Active'}</span></header>
    {retry&&<div className="story-retry" role="alert"><span>The last Story command may still have applied.</span><Button size="small" onClick={retryLast}>Retry {retry.label}</Button></div>}
    {preparationFailureMessage&&<p className="story-preparation-failure" role="alert">{preparationFailureMessage}</p>}
    {schedule?.pendingPreparation&&<p className="story-preparation" role="status">{schedule.pendingPreparation.phase==='ready'?'Ready to show':'Preparing'} source {schedule.pendingPreparation.visualId}{schedule.pendingPreparation.beatId?` for ${beats.get(schedule.pendingPreparation.beatId)?.label??schedule.pendingPreparation.beatId}`:''}.</p>}
    {schedule?.outgoing&&schedule.crossfadeProgress!==null&&<p className="story-crossfade" role="status">Transitioning from source {schedule.outgoing.visualId} to {schedule.committed?.visualId} · {Math.round(schedule.crossfadeProgress*100)}%</p>}
    {capacityReason&&<p className="hint">{capacityReason.message}</p>}
    <div className="story-primary-actions">
      {status.definition.sequence.length>0&&status.frame.state==='normal'&&<Button variant="contained" disabled={blocked||!!disabled('start')} title={disabled('start')} onClick={()=>void runAction({action:'start'},'start story')}>Start story</Button>}
      {status.frame.state==='active'&&<><Button disabled={blocked||!!disabled(status.phase==='running'?'pause':'play')} title={disabled(status.phase==='running'?'pause':'play')} onClick={()=>void runAction({action:status.phase==='running'?'pause':'play'},status.phase==='running'?'pause story':'play story')}>{status.phase==='running'?'Pause story':'Play story'}</Button><Button disabled={blocked||!!disabled('return-normal')} title={disabled('return-normal')} onClick={()=>void runAction({action:'return-normal'},'return to normal')}>Return to normal</Button></>}
    </div>
    {status.frame.state==='active'&&<div className="story-active-summary"><div className="story-transition" aria-live="polite"><strong>{activeBeat?.label??status.frame.beatId}</strong>{activeVisualId&&<span>Source {activeVisualId}</span>}<span>{status.phase==='running'?'Running':'Paused'}</span>{activeBeat?.timing.kind==='sustained'&&<span>Staying on beat</span>}{status.sequence.awaitingCue&&<span>Awaiting cue</span>}{status.sequence.state==='ended'&&<span>Sequence ended</span>}{status.phase==='running'&&previewPlayback&&previewPlayback!=='playing'&&<span>Story ready · Preview paused</span>}{status.sequence.state!=='detached'&&!status.autoAdvance&&<span>Auto-advance off</span>}{status.sequence.nextOccurrenceId&&<span>Next: {beats.get(status.definition.sequence.find(row=>row.id===status.sequence.nextOccurrenceId)?.beatId??'')?.label??status.sequence.nextOccurrenceId}</span>}</div><span>{seconds(status.frame.elapsedSeconds)} active</span></div>}
    {status.frame.state==='active'&&activeBeat?.timing.kind==='timed'&&<section className="story-local-time" aria-label="Timed beat position"><div><strong>{activeBeat.label}</strong><span>{seconds(scrubValue)} / {seconds(activeBeat.timing.durationSeconds)}</span></div><input type="range" aria-label={`Local time for ${activeBeat.label}`} title={activeSeekReason??disabled('seek')} min={0} max={activeBeat.timing.durationSeconds} step={activeBeat.timing.durationSeconds/100||Number.MIN_VALUE} value={scrubValue} disabled={!available||!!pending||!!activeSeekReason||!!disabled('seek')} onPointerDown={event=>{pointerGesture.current={active:true,cancelled:false};event.currentTarget.setPointerCapture?.(event.pointerId);}} onPointerUp={event=>{pointerGesture.current={active:false,cancelled:false};event.currentTarget.releasePointerCapture?.(event.pointerId);}} onPointerCancel={()=>{pointerGesture.current={active:false,cancelled:false};}} onChange={event=>{if(!pointerGesture.current.cancelled)queueSeek(Number(event.target.value));}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();scrub.current.queued=null;if(pointerGesture.current.active)pointerGesture.current.cancelled=true;setScrubValue(scrub.current.lastAcknowledged);}}}/><div><Button disabled={blocked||!!disabled('replay')} onClick={()=>void runAction({action:'replay',beatId:activeBeat.id},`replay ${activeBeat.label}`)}>Replay {activeBeat.label}</Button><Button disabled={blocked||!!disabled('loop')} aria-pressed={status.loop} onClick={()=>void runAction({action:'loop',beatId:activeBeat.id},`loop ${activeBeat.label}`)}>Loop {activeBeat.label}</Button></div></section>}
    {status.definition.sequence.length>0&&<section className="story-sequence" aria-labelledby="story-sequence-heading"><div className="story-section-heading"><h3 id="story-sequence-heading">Sequence</h3><span>{status.sequence.state==='detached'?'Detached':status.sequence.state==='ended'?'Ended':'Attached'}</span></div>
      <ol className="story-ribbon" aria-label="Story sequence">{status.definition.sequence.map((occurrence,index)=>{const beat=beats.get(occurrence.beatId),name=`${beat?.label??occurrence.beatId} — occurrence ${index+1} of ${status.definition.sequence.length}`,current=status.sequence.occurrenceId===occurrence.id&&status.sequence.state!=='detached',selected=selectedOccurrenceId===occurrence.id,after=occurrence.follow.kind==='after',progress=current&&after?Math.min(100,Math.max(0,status.sequence.dwellElapsedSeconds/occurrence.follow.seconds*100)):0;return <li key={occurrence.id} className={`${selected?'story-occurrence-selected ':''}${current?'story-occurrence-current ':''}${after?'story-occurrence-timed':'story-occurrence-manual'}`} style={{'--story-dwell-weight':after?occurrence.follow.seconds:1} as React.CSSProperties}>
        <button type="button" aria-label={`${name} · ${occurrence.id}`} aria-pressed={selected} aria-current={current?'step':undefined} onClick={()=>setSelectedOccurrenceId(occurrence.id)}><span>{beat?.label??occurrence.beatId}</span><small>{index+1} · {occurrence.id}{'visualId'in occurrence?` · source ${occurrence.visualId}`:''}</small>{current&&<i aria-hidden="true" className="story-cursor"/>}</button>
        {current&&after&&<><span className="story-dwell-progress" role="progressbar" aria-label={`Dwell for ${name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><i style={{width:`${progress}%`}}/></span><small className="story-dwell-label">{status.sequence.dwellRemainingSeconds===null?'Dwell':`${seconds(status.sequence.dwellRemainingSeconds)} remaining`}</small></>}
        {current&&!after&&<small className="story-dwell-label">Awaiting cue</small>}
      </li>;})}</ol>
      {selectedOccurrence&&selectedMoveAction&&<Button className="story-start-here" disabled={blocked||!!selectedMoveReason} title={selectedMoveReason} onClick={()=>void runAction(selectedMoveAction,`${selectedMoveAction.action==='resume'?'resume':'start'} here`)}>{selectedMoveAction.action==='resume'?'Resume here':'Start here'}: {beats.get(selectedOccurrence.beatId)?.label??selectedOccurrence.beatId} — occurrence {selectedOccurrenceIndex+1} of {status.definition.sequence.length}</Button>}
      {status.frame.state==='active'&&status.sequence.state==='detached'&&status.resumeCandidates.length===1&&<Button disabled={blocked||!!disabled('resume')} title={disabled('resume')} onClick={()=>void runAction({action:'resume',occurrenceId:status.resumeCandidates[0]!},'resume story')}>Resume story</Button>}
      {status.frame.state==='active'&&status.sequence.state!=='detached'&&<div className="story-follow-actions"><Tooltip title={disabled('set-auto-advance')??''}><span><FormControlLabel label="Auto-advance" control={<Switch size="small" checked={status.autoAdvance} disabled={blocked||!!disabled('set-auto-advance')} slotProps={{input:{'aria-label':'Auto-advance'}}} onChange={event=>void runAction({action:'set-auto-advance',enabled:event.target.checked},event.target.checked?'enable auto-advance':'disable auto-advance')}/>} /></span></Tooltip><Button disabled={blocked||!!disabled('advance')} title={disabled('advance')} onClick={()=>void runAction({action:'advance'},'advance story')}>Advance</Button></div>}
    </section>}
    <section className="story-beats" aria-labelledby="story-beats-heading"><h3 id="story-beats-heading">Beats</h3><ul>{status.definition.beats.map(beat=>{const active=activeBeatId===beat.id,selected=selectedBeatId===beat.id,visualId='visualId'in beat?beat.visualId:undefined,sourceReason=capabilityReason(visualId,beat.id),capability=capabilityFor(visualId,beat.id);return <li key={beat.id} className={`${active?'story-beat-active ':''}${selected?'story-beat-selected':''}`}><button type="button" className="story-beat-select" aria-pressed={selected} aria-current={active?'true':undefined} onClick={()=>setSelectedBeatId(beat.id)}><span>{beat.label}</span><small>{beat.timing.kind==='sustained'?'Sustained':seconds(beat.timing.durationSeconds)} · {beat.id}{visualId?` · source ${visualId}${capability?` · ${capability.kind}`:''}`:''}</small></button><Button className="story-launch" disabled={blocked||!!sourceReason||!!disabled('launch')} title={sourceReason??disabled('launch')} onClick={()=>void runAction({action:'launch',beatId:beat.id},`launch ${beat.label}`)}>Launch {beat.label}</Button></li>;})}</ul></section>
    {selectedBeat&&selectedBeat.id!==activeBeat?.id&&selectedBeat.timing.kind==='timed'&&<p className="hint">{selectedBeat.label} is timed ({seconds(selectedBeat.timing.durationSeconds)}). Launch it to scrub its local time.</p>}
  </section>;
}
