import test from 'node:test';import assert from 'node:assert/strict';
import {inspectNativeStop} from '../../tools/gpu-spike/native-stop-inspect.mjs';
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
test('missing, stale, mixed, incomplete, reordered and request-only evidence cannot pass',()=>{
 for(const change of [f=>f.marker=null,f=>f.marker.runId='old',f=>f.marker.attemptId='e'.repeat(32),f=>f.marker.hostPid=43,f=>f.marker.ready=false,f=>f.lifecycle.pop(),f=>f.lifecycle[0].force=false,f=>f.lifecycle[1].stopped=false,f=>f.lifecycle[1].activeProcesses=1,f=>f.lifecycle[1].incomplete=true,f=>f.lifecycle[1].lostRecords=1,f=>f.lifecycle[1].clock.frequency='100',f=>f.lifecycle[1].revisionId='e'.repeat(64),f=>f.probe.disarmAt='9999999',f=>f.probe.callbacksAfterMarker=0,f=>f.experiment.result.timeout=true,f=>f.probe.elapsedMs=10001,f=>f.probe.disarmSubmitted=false]){const f=fixture();change(f);assert.throws(()=>inspectNativeStop(f));}
});
