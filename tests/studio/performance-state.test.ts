import test from 'node:test';
import assert from 'node:assert/strict';
import { PerformanceReceiver } from '../../apps/studio/src/performance/performance-state.ts';
import { createFrameCollector } from '../../packages/performance/live.mjs';
const owner={instanceId:'instance',generation:1,revisionId:'revision'};
function sample(){const c=createFrameCollector({startMs:0});c.record(20,1,2,3,4,false);return c.summary(500);}

test('routine receiver rejects populations impossible under one-in-thirty sampling',()=>{
 const collector=createFrameCollector({startMs:0});
 for(let frame=1;frame<=60;frame++){collector.record(frame,frame,1,2,3,false);collector.recordGpu(frame,1,true);}
 const valid=collector.summary(500,{timestampQuerySupported:true,timestampQueryEnabled:true});
 assert.equal(valid.gpu.expectedCount,2);
 assert.equal(new PerformanceReceiver(owner,0).receive(valid,10),true);
 for(const expectedCount of [3,60]){
  const forged={...valid,gpu:{...valid.gpu,sampleCount:expectedCount,expectedCount,missingCount:0}};
  assert.equal(new PerformanceReceiver(owner,0).receive(forged,10),false);
 }
 // A summary may begin on any sampling phase, including just before frame 31.
 const phased=createFrameCollector({startMs:0});phased.record(20,30,1,2,3,false);phased.record(21,31,1,2,3,false);phased.recordGpu(31,1,true);
 assert.equal(new PerformanceReceiver(owner,0).receive(phased.summary(500,{timestampQuerySupported:true,timestampQueryEnabled:true}),10),true);
});

test('receiver accepts explicit baseline and sampled routine summaries without accepting false full coverage',()=>{
 const baseline=createFrameCollector({startMs:0,mode:'baseline'});baseline.record(20,1);
 const r=new PerformanceReceiver(owner,0);assert.equal(r.receive(baseline.summary(500,{timestampQuerySupported:true}),10),true);
 assert.equal(r.snapshot.worker!.mode,'baseline');assert.equal(r.snapshot.worker!.cpuCall.availability,'unsupported');
 const routine=createFrameCollector({startMs:0});routine.record(20,1,2,3,4,false);routine.recordGpu(1,1,true);
 const s=routine.summary(500,{timestampQuerySupported:true,timestampQueryEnabled:true});
 assert.equal(new PerformanceReceiver(owner,0).receive(s,10),true);
 assert.equal(new PerformanceReceiver(owner,0).receive({...s,gpu:{...s.gpu,validity:'complete'}},10),false);
 assert.equal(new PerformanceReceiver(owner,0).receive({...s,gpu:{...s.gpu,expectedCount:2,missingCount:1}},10),false);
 assert.equal(new PerformanceReceiver(owner,0).receive({...s,mode:'baseline'},10),false);
 assert.equal(new PerformanceReceiver(owner,0).receive({...s,cpuCall:{...s.cpuCall,validity:'sampled'}},10),false);
});
test('telemetry uses parent arrival age and monotonic worker sequences, with detached bounded data',()=>{
 const r=new PerformanceReceiver(owner,100),raw:any=structuredClone(sample());
 assert.equal(r.snapshot.status,'pending');assert.equal(r.receive(raw,110),true);
 assert.equal(r.snapshot.observedAtMs,110);assert.equal(r.snapshot.status,'live');
 raw.cpuCall.p95=999;assert.equal(r.snapshot.worker!.cpuCall.p95,5);
 assert.equal(r.receive(raw,700),false);assert.equal(r.age(1610),true);assert.equal(r.snapshot.status,'stale');
 assert.equal(r.age(1700),false);assert.equal(r.receive({...sample(),sequence:2,windowStartMs:500,windowEndMs:1000},1800),true);
 r.fail();assert.equal(r.snapshot.status,'failed');assert.equal(r.receive({...sample(),sequence:3},2500),false);
});
test('invalid, misleading, oversized and regressing telemetry cannot replace the last good summary',()=>{
 const r=new PerformanceReceiver(owner,0);r.receive(sample(),10);const previous=r.snapshot;
 for(const patch of [{sequence:2,cpuCall:{...sample().cpuCall,p95:NaN}}, {sequence:2,retainedRecords:4097},
  {sequence:2,gpu:{...sample().gpu,availability:'available',p95:0}}, {sequence:2,windowEndMs:-1},
  {sequence:2,cpuCall:{...sample().cpuCall,reason:'x'.repeat(1000)}}])assert.equal(r.receive({...sample(),...patch},1000),false);
 assert.equal(r.snapshot,previous);assert.equal(r.receive({...sample(),sequence:2},9),false);
});
