import test from 'node:test';import assert from 'node:assert/strict';
import {inspectNativeInitStop} from '../../tools/gpu-spike/native-init-stop-inspect.mjs';
function fixture(){const owner={instanceId:'a'.repeat(32),attemptId:'b'.repeat(32),releaseId:'c'.repeat(64),revisionId:'d'.repeat(64),incomplete:false,lostRecords:0};
 const clock=at=>({domain:'qpc',frequency:'10000000',at:String(at)});
 return {experiment:{id:'12345678-1234-1234-1234-123456789abc',outcome:'success',cleanupComplete:true,timeoutMs:30000,child:{pid:42,startTicks:'1',frequency:10000000},result:{exitCode:0,timeout:false,cancelled:false,cleanupComplete:true,endTicks:'90000000'}},
 marker:{...owner,kind:'init-hang-entered',stage:'create',runId:'12345678-1234-1234-1234-123456789abc',hostPid:42,ready:false,workerHeartbeat:1,completedFrames:0,clock:clock(10000000)},
 armed:{...owner,kind:'init-hang-armed',stage:'before-create',runId:'12345678-1234-1234-1234-123456789abc',hostPid:42,ready:false,workerHeartbeat:1,completedFrames:0,clock:clock(9000000)},
 lifecycle:[{...owner,kind:'restart-trigger',clock:clock(100)},{...owner,kind:'stop-requested',force:true,clock:clock(24000000)},
 {...owner,kind:'process-exit-observed',stopped:true,activeProcesses:0,requestedAt:'24500000',observedExitAt:'25000000',clock:clock(25000000)}],expected:{releaseId:owner.releaseId,revisionId:owner.revisionId}};
}
test('pre-ready main-observed entry to independent empty-Job exit uses the unchanged two-second bound',()=>{
 const result=inspectNativeInitStop(fixture());assert.equal(result.conservativeHangToExitUpperBoundMs,1600);assert.equal(result.mainObservedEntryToExitMs,1500);assert.equal(result.physicalExitVerified,true);assert.equal(result.exactHangOnsetMeasured,false);
});
test('missing exit, stale/mismatched identity, output readiness, loss, frequency or slow exit cannot pass',()=>{
 for(const mutate of [f=>delete f.armed,f=>f.armed.attemptId='old',f=>f.armed.clock.at='11000000',f=>f.armed.clock.at='4999999',f=>f.lifecycle.pop(),f=>f.marker.ready=true,f=>f.marker.completedFrames=1,f=>f.marker.workerHeartbeat=0,
  f=>f.marker.runId='old',f=>f.marker.attemptId='e'.repeat(32),f=>f.lifecycle[2].activeProcesses=1,f=>f.lifecycle[2].stopped=false,
  f=>f.lifecycle[1].force=false,f=>f.lifecycle[2].lostRecords=1,f=>f.lifecycle[2].clock.frequency='1',
  f=>f.lifecycle[2].observedExitAt='30000001',f=>f.experiment.result.cleanupComplete=false]){
  const f=fixture();mutate(f);assert.throws(()=>inspectNativeInitStop(f));
 }
});
