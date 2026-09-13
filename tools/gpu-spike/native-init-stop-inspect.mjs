const requireFact=(value,message)=>{if(!value)throw Error(message);};
const ticks=value=>{if(typeof value!=='string'||!/^(0|[1-9][0-9]{0,19})$/.test(value)||BigInt(value)>0xffffffffffffffffn)throw Error('Invalid QPC ticks');return BigInt(value);};
const id=value=>typeof value==='string'&&/^[a-f0-9]{32}$/.test(value);
/** Independent main-observed create entry to confirmed producer Job exit. The
 * console delivery timestamp is not exact worker hang onset. No rendered frame
 * or recovery image is expected from this deliberately pre-ready fixture. */
export function inspectNativeInitStop({experiment,armed,marker,lifecycle,expected}){
 requireFact(experiment?.outcome==='success'&&experiment.cleanupComplete===true&&experiment.result?.cleanupComplete===true&&experiment.result.exitCode===0&&experiment.result.timeout===false&&experiment.result.cancelled===false,'Supervised completion/cleanup failed');
 requireFact(experiment.timeoutMs===30000,'Expected unchanged30-second outer bound');
 requireFact(marker?.kind==='init-hang-entered'&&marker.stage==='create'&&marker.runId===experiment.id&&marker.hostPid===experiment.child?.pid&&marker.ready===false&&marker.completedFrames===0&&Number.isSafeInteger(marker.workerHeartbeat)&&marker.workerHeartbeat>0,'Missing pre-ready initialized-worker entry marker');
 requireFact(expected&&/^[a-f0-9]{64}$/.test(expected.releaseId)&&/^[a-f0-9]{64}$/.test(expected.revisionId)&&marker.revisionId===expected.revisionId&&id(marker.instanceId)&&id(marker.attemptId),'Invalid pinned source/attempt identity');
 requireFact(armed?.kind==='init-hang-armed'&&armed.stage==='before-create'&&armed.ready===false&&armed.completedFrames===0&&armed.workerHeartbeat>0&&
  ['runId','hostPid','instanceId','attemptId','revisionId'].every(key=>armed[key]===marker[key]),'Missing matching pre-GO origin');
 requireFact(Array.isArray(lifecycle)&&lifecycle.length>0&&lifecycle.length<=100,'Invalid bounded lifecycle evidence');
 const rows=lifecycle.filter(r=>r.attemptId===marker.attemptId);
 requireFact(rows.length>0&&rows.every(r=>r.instanceId===marker.instanceId&&r.releaseId===expected.releaseId&&r.revisionId===expected.revisionId&&r.incomplete===false&&r.lostRecords===0),'Incomplete or mismatched attempt evidence');
 const start=rows.filter(r=>r.kind==='restart-trigger'),stop=rows.filter(r=>r.kind==='stop-requested'),exit=rows.filter(r=>r.kind==='process-exit-observed');
 requireFact(start.length===1&&stop.length===1&&stop[0].force===true&&exit.length===1&&exit[0].stopped===true&&exit[0].activeProcesses===0,'Independent forced empty-Job exit not established');
 const frequency=ticks(marker.clock?.frequency);
 requireFact(frequency>0n&&Number(frequency)===experiment.child.frequency&&[armed,marker,...rows].every(r=>r.clock?.domain==='qpc'&&ticks(r.clock.frequency)===frequency),'QPC domains/frequencies disagree');
 const entered=ticks(marker.clock.at),requested=ticks(stop[0].clock.at),terminated=ticks(exit[0].requestedAt),observed=ticks(exit[0].observedExitAt);
 const origin=ticks(armed.clock.at);
 requireFact(ticks(experiment.child.startTicks)<=ticks(start[0].clock.at)&&ticks(start[0].clock.at)<=origin&&origin<=entered&&entered<=requested&&requested<=terminated&&terminated<=observed&&observed<=ticks(experiment.result.endTicks),'Equivocal arm/entry/stop ordering');
 requireFact((observed-origin)*1000n<=frequency*2000n,'Physical initialization stop exceeds2seconds from pre-GO origin');
 return {ok:true,instanceId:marker.instanceId,attemptId:marker.attemptId,enteredAt:marker.clock.at,observedExitAt:exit[0].observedExitAt,
  armedAt:armed.clock.at,conservativeHangToExitUpperBoundMs:Number(observed-origin)*1000/Number(frequency),mainObservedEntryToExitMs:Number(observed-entered)*1000/Number(frequency),physicalExitVerified:true,exactHangOnsetMeasured:false,
  measurementOrigin:'Main QPC persisted before GO permits authored create; includes dispatch and persistence delay',readyBeforeHang:false,
  actualResolumeTested:false,recoveryImageTested:false,gpuResourceCleanupVerified:false};
}
