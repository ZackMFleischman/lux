import test from 'node:test';import assert from 'node:assert/strict';
import {inspectNativeStop,inspectNativeRecovery} from '../../tools/gpu-spike/native-stop-inspect.mjs';
const clock=at=>({domain:'qpc',frequency:'10000000',...(at?{at}:{})});
function fixture(){const identity={instanceId:'a'.repeat(32),attemptId:'b'.repeat(32),revisionId:'c'.repeat(64),releaseId:'d'.repeat(64),incomplete:false,lostRecords:0};return {
 experiment:{id:'run',outcome:'success',cleanupComplete:true,timeoutMs:30000,child:{pid:42},result:{cleanupComplete:true,exitCode:0,timeout:false,cancelled:false}},
 probe:{runId:'run',ok:true,deinstantiated:true,deinitialized:true,hostPid:42,elapsedMs:8000,ready:true,armAccepted:true,disarmSubmitted:true,callbacksAfterMarker:50,clock:clock(),readyAt:'1',triggerAt:'10000000',disarmAt:'10100000'},
 marker:{...identity,kind:'hang-entered',runId:'run',hostPid:42,ready:true,workerHeartbeat:3,completedFrames:4,clock:clock('10010000')},expected:identity,
 lifecycle:[{...identity,kind:'stop-requested',force:true,clock:clock('23000000')},{...identity,kind:'process-exit-observed',stopped:true,activeProcesses:0,clock:clock(),requestedAt:'23000001',observedExitAt:'25000000'}]};}
test('physical endpoint includes all Job descendants and uses the earlier host trigger conservatively',()=>{
 const f=fixture(),result=inspectNativeStop(f);assert.equal(result.upperBoundMs,1500);assert.equal(result.disarmWasWorkerAcknowledged,false);
 f.lifecycle[1].observedExitAt='30000000';assert.equal(inspectNativeStop(f).upperBoundMs,2000);
 f.lifecycle[1].observedExitAt='30000001';assert.throws(()=>inspectNativeStop(f),/2s/);
});

function recoveryFixture(){const f=fixture(),identity={...f.expected},retry={...identity,attemptId:'e'.repeat(32)};
 Object.assign(f.probe,{recoveryMode:true,recovered:true,currentNormalizedValue:0,initialRGBA:[255,0,255,255],recoveredRGBA:[0,255,255,255],recoveredAt:'40000000'});
 f.lifecycle.unshift({...identity,kind:'restart-trigger',clock:clock('0')});
 f.lifecycle.push({...retry,kind:'restart-trigger',clock:clock('26000000')},{...retry,kind:'stop-requested',force:false,clock:clock('41000000')},{...retry,kind:'process-exit-observed',stopped:true,activeProcesses:0,clock:clock(),requestedAt:'42000000',observedExitAt:'42000001'});return f;
}
test('observed recovery binds cyan/current host value to exactly one retry after physical old exit',()=>{
 const result=inspectNativeRecovery(recoveryFixture());assert.equal(result.recoveryImageVerified,true);assert.equal(result.retryAttemptId,'e'.repeat(32));assert.equal(result.firstAcceptedFrameMeasured,false);assert.equal(result.recoveryFiveSecondGateMeasured,false);
});
test('recovery rejects missing pixels, stale value, early retry, faults and equivocal extra attempts',()=>{
 for(const change of [f=>f.probe.recoveryMode=false,f=>f.probe.recovered=false,f=>f.probe.currentNormalizedValue=0.5,f=>f.probe.initialRGBA=[0,255,255,255],f=>f.probe.recoveredRGBA=[255,0,255,255],f=>f.probe.recoveredRGBA[3]=0,f=>f.probe.recoveredAt='24000000',f=>f.lifecycle[3].clock.at='24000000',f=>f.lifecycle[3].revisionId='f'.repeat(64),f=>f.lifecycle[3].incomplete=true,f=>f.lifecycle[3].clock.frequency='100',f=>f.lifecycle[4].clock.at='39000000',f=>f.lifecycle.push({...f.lifecycle[3],attemptId:'f'.repeat(32)}),f=>f.lifecycle.splice(3,1)]){const f=recoveryFixture();change(f);assert.throws(()=>inspectNativeRecovery(f));}
});
test('missing, stale, mixed, incomplete, reordered and request-only evidence cannot pass',()=>{
 for(const change of [f=>f.marker=null,f=>f.marker.runId='old',f=>f.marker.attemptId='e'.repeat(32),f=>f.marker.hostPid=43,f=>f.marker.ready=false,f=>f.lifecycle.pop(),f=>f.lifecycle[0].force=false,f=>f.lifecycle[1].stopped=false,f=>f.lifecycle[1].activeProcesses=1,f=>f.lifecycle[1].incomplete=true,f=>f.lifecycle[1].lostRecords=1,f=>f.lifecycle[1].clock.frequency='100',f=>f.lifecycle[1].revisionId='e'.repeat(64),f=>f.probe.disarmAt='9999999',f=>f.probe.callbacksAfterMarker=0,f=>f.experiment.result.timeout=true,f=>f.probe.elapsedMs=10001,f=>f.probe.disarmSubmitted=false]){const f=fixture();change(f);assert.throws(()=>inspectNativeStop(f));}
});
