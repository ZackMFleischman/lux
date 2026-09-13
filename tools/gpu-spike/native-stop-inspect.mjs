const integer=value=>Number.isSafeInteger(value)&&value>=0;
const ticks=value=>{if(typeof value!=='string'||! /^(0|[1-9][0-9]{0,19})$/.test(value)||BigInt(value)>0xffffffffffffffffn)throw Error('Invalid QPC ticks');return BigInt(value);};
const assert=(condition,message)=>{if(!condition)throw Error(message);};
/** Measures a conservative host-trigger-to-confirmed-Job-exit bound, not a
 * worker acknowledgement or exact hang-onset timestamp. No Resolume claim. */
export function inspectNativeStop({experiment,probe,marker,lifecycle,expected}) {
  assert(experiment?.outcome==='success'&&experiment.cleanupComplete===true&&experiment.result?.cleanupComplete===true&&experiment.result.exitCode===0&&experiment.result.timeout===false&&experiment.result.cancelled===false,'Supervised completion/cleanup failed');
  assert(integer(experiment.timeoutMs)&&experiment.timeoutMs>=1000&&experiment.timeoutMs<=30000,'Invalid outer budget');
  assert(probe?.runId===experiment.id&&probe.ok===true&&probe.deinstantiated===true&&probe.deinitialized===true&&probe.hostPid===experiment.child?.pid,'Invalid native probe ownership/teardown');
  assert(integer(probe.elapsedMs)&&probe.elapsedMs<=10000&&probe.ready===true&&probe.armAccepted===true&&probe.disarmSubmitted===true&&integer(probe.callbacksAfterMarker)&&probe.callbacksAfterMarker>0,'Missing bounded ready/arm/disarm evidence');
  assert(marker?.kind==='hang-entered'&&marker.runId===experiment.id&&marker.hostPid===probe.hostPid&&marker.ready===true&&integer(marker.workerHeartbeat)&&marker.workerHeartbeat>0&&integer(marker.completedFrames)&&marker.completedFrames>0,'Missing durable hang entry/readiness');
  assert(expected&&/^[a-f0-9]{64}$/.test(expected.releaseId)&&/^[a-f0-9]{64}$/.test(expected.revisionId)&&marker.revisionId===expected.revisionId&&/^[a-f0-9]{32}$/.test(marker.instanceId)&&/^[a-f0-9]{32}$/.test(marker.attemptId),'Invalid release/attempt identity');
  assert(Array.isArray(lifecycle)&&lifecycle.length>0&&lifecycle.length<=100,'Invalid bounded lifecycle evidence');
  const rows=lifecycle.filter(row=>row.attemptId===marker.attemptId);
  assert(rows.length>0&&rows.every(row=>row.instanceId===marker.instanceId&&row.releaseId===expected.releaseId&&row.revisionId===expected.revisionId&&row.incomplete===false&&row.lostRecords===0),'Incomplete or mismatched attempt evidence');
  const stop=rows.filter(row=>row.kind==='stop-requested'),exit=rows.filter(row=>row.kind==='process-exit-observed');
  assert(stop.length===1&&stop[0].force===true&&exit.length===1&&exit[0].stopped===true&&exit[0].activeProcesses===0,'Physical forced Job exit not established');
  const frequency=ticks(probe.clock?.frequency);
  assert(frequency>0n&&[probe,marker,stop[0],exit[0]].every(row=>row.clock?.domain==='qpc'&&ticks(row.clock.frequency)===frequency),'QPC domains/frequencies disagree');
  const ready=ticks(probe.readyAt),trigger=ticks(probe.triggerAt),entered=ticks(marker.clock.at),reset=ticks(probe.disarmAt),requested=ticks(stop[0].clock.at),terminated=ticks(exit[0].requestedAt),observed=ticks(exit[0].observedExitAt);
  assert(ready<=trigger&&trigger<=entered&&entered<=reset&&reset<=requested&&requested<=terminated&&terminated<=observed,'Equivocal trigger/entry/disarm/stop ordering');
  assert((observed-trigger)*1000n<=frequency*2000n,'Physical exit within the conservative 2s bound was not established');
  return {ok:true,instanceId:marker.instanceId,attemptId:marker.attemptId,triggerAt:probe.triggerAt,observedExitAt:exit[0].observedExitAt,
    upperBoundMs:Number(observed-trigger)*1000/Number(frequency),physicalExitVerified:true,exactHangOnsetMeasured:false,disarmWasWorkerAcknowledged:false,actualResolumeTested:false};
}

/** Observed current-value recovery of the pinned binary-color fixture. This is
 * not a first-frame, explicit-restart or recovery-performance measurement. */
export function inspectNativeRecovery(input) {
  const stopped=inspectNativeStop(input),{probe,marker,lifecycle,expected}=input;
  const color=(value,wanted)=>Array.isArray(value)&&value.length===4&&value.every((v,i)=>integer(v)&&v<=255&&Math.abs(v-wanted[i])<=5);
  assert(probe.recoveryMode===true&&probe.recovered===true&&probe.currentNormalizedValue===0&&color(probe.initialRGBA,[255,0,255,255])&&color(probe.recoveredRGBA,[0,255,255,255]),'Missing recovered cyan/current host value');
  const recovered=ticks(probe.recoveredAt),observed=ticks(stopped.observedExitAt),frequency=ticks(probe.clock.frequency);
  assert(ticks(probe.disarmAt)<recovered&&observed<=recovered,'Recovery predates disarm or confirmed old exit');
  assert(lifecycle.every(row=>row.instanceId===marker.instanceId&&row.releaseId===expected.releaseId&&row.revisionId===expected.revisionId&&/^[a-f0-9]{32}$/.test(row.attemptId)&&row.incomplete===false&&row.lostRecords===0&&row.clock?.domain==='qpc'&&ticks(row.clock.frequency)===frequency),'Incomplete or mismatched recovery evidence');
  const starts=lifecycle.filter(row=>row.kind==='restart-trigger'&&ticks(row.clock.at)<=recovered);
  assert(starts.length===2&&starts.filter(row=>row.attemptId===marker.attemptId).length===1,'Expected one original and one retry attempt');
  const original=starts.find(row=>row.attemptId===marker.attemptId),retry=starts.find(row=>row.attemptId!==marker.attemptId);
  assert(ticks(original.clock.at)<=ticks(probe.readyAt)&&observed<=ticks(retry.clock.at)&&ticks(retry.clock.at)<=recovered,'Retry did not follow confirmed original exit');
  assert(lifecycle.every(row=>{
    if(row.attemptId===marker.attemptId)return true;
    const at=ticks(row.kind==='process-exit-observed'?row.observedExitAt:row.clock.at);
    return at>recovered||(row.attemptId===retry.attemptId&&row.kind==='restart-trigger');
  }),'Retry fault or extra attempt precedes recovered image');
  return {...stopped,recoveryImageVerified:true,retryAttemptId:retry.attemptId,recoveredAt:probe.recoveredAt,currentNormalizedValue:0,
    initialRGBA:probe.initialRGBA,recoveredRGBA:probe.recoveredRGBA,firstAcceptedFrameMeasured:false,explicitRestartTested:false,recoveryFiveSecondGateMeasured:false};
}
