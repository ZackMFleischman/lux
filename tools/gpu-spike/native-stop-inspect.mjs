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
