import test from 'node:test';import assert from 'node:assert/strict';
import {inspectReceiverWorkerTiming} from '../../tools/gpu-spike/receiver-worker-timing-inspect.mjs';
const fixture=()=>[{kind:'receiver-worker-timing',instanceId:'a'.repeat(32),sequence:1,stage:'outer-sleep',start:'100',end:'160100',generation:0,outputGeneration:0,frameId:'0',boundFrame:false,complete:true,requestedSleepMs:1},
 {kind:'receiver-worker-timing-summary',instanceId:'a'.repeat(32),domain:'qpc',frequency:'10000000',capacity:32768,recorded:1,attempted:1,lostRecords:0,clockFailures:0,incompleteSpans:0,allocationFailed:false,aborted:false,valid:true}];
test('actual requested-one-ms sleep is summarized as observed CPU elapsed, without a GPU claim',()=>{
 const result=inspectReceiverWorkerTiming(fixture(),'a'.repeat(32),'10000000');assert.equal(result.ok,true);assert.equal(result.stages['outer-sleep'].p95Ms,16);assert.equal(result.gpuDurationMeasured,false);
});
test('loss, aborted spans, duplicate/missing rows, wrong clocks and identity invalidate timing aggregation',()=>{
 for(const mutate of [r=>r.pop(),r=>r.push(r[0]),r=>r[0].sequence=2,r=>r[0].instanceId='old',r=>r[0].end='99',r=>r[0].complete=false,r=>r[1].frequency='1',r=>r[1].lostRecords=1,r=>r[1].valid=false]){
  const rows=fixture();mutate(rows);assert.throws(()=>inspectReceiverWorkerTiming(rows,'a'.repeat(32),'10000000'));
 }
});
