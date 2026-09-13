import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameCollector } from '../../packages/performance/live.mjs';

test('baseline disables duration collection while preserving completed-frame health counts',()=>{
 const c=createFrameCollector({startMs:0,mode:'baseline'});
 for(let frame=1;frame<=5000;frame++)assert.equal(c.record(frame,frame),true);
 assert.equal(c.recordGpu(1,1,true),false);
 const s=c.summary(5000,{timestampQuerySupported:true});
 assert.equal(s.mode,'baseline');assert.equal(s.retainedRecords,0);assert.equal(s.lostRecords,0);
 assert.equal(s.produced.sampleCount,5000);assert.equal(s.cpuCall.availability,'unsupported');
 assert.equal(s.cpuCall.expectedCount,0);assert.equal(s.gpu.expectedCount,0);assert.match(s.gpu.reason,/baseline/i);
 assert.throws(()=>createFrameCollector({startMs:0,mode:'invalid'}));
});

test('routine GPU populations include only eligible frames, including across summary boundaries',()=>{
 const c=createFrameCollector({startMs:0});
 for(let frame=1;frame<=60;frame++)c.record(frame,frame,1,1,1,false);
 assert.equal(c.recordGpu(2,99,true),false);assert.equal(c.recordGpu(1,1,true),true);assert.equal(c.recordGpu(31,2,true),true);
 const s=c.summary(100,{timestampQuerySupported:true,timestampQueryEnabled:true});
 assert.equal(s.gpu.expectedCount,2);assert.equal(s.gpu.missingCount,0);assert.equal(s.gpu.validity,'sampled');
 assert.equal(s.gpu.p95,2);assert.match(s.gpu.samplingPolicy,/30/);assert.equal(s.cpuCall.sampleCount,60);
 c.record(110,61,1,1,1,false);
 const pending=c.summary(120,{timestampQuerySupported:true,timestampQueryEnabled:true,pendingSamples:1});
 assert.equal(pending.gpu.expectedCount,1);assert.equal(pending.gpu.missingCount,1);assert.equal(pending.gpu.validity,'incomplete');
 assert.equal(c.recordGpu(61,8,true),false,'late results cannot enter another summary');
 c.record(130,62,1,1,1,false);
 const unsampled=c.summary(140,{timestampQuerySupported:true,timestampQueryEnabled:true});
 assert.equal(unsampled.gpu.expectedCount,0);assert.equal(unsampled.gpu.missingCount,0);assert.equal(unsampled.gpu.validity,'sampled');
});

test('GPU readbacks correlate once to retained frames; missing or late samples never reuse earlier values',()=>{
 const c=createFrameCollector({startMs:0});c.record(10,1,1,2,3,false);c.record(20,31,1,2,3,false);
 assert.equal(c.recordGpu(1,4,true),true);assert.equal(c.recordGpu(1,99,true),false);
 const summary=c.summary(500,{timestampQuerySupported:true,timestampQueryEnabled:true,failedSamples:1,droppedSamples:0,pendingSamples:0});
 assert.equal(summary.gpu.p95,4);assert.equal(summary.gpu.sampleCount,1);assert.equal(summary.gpu.missingCount,1);assert.equal(summary.gpu.validity,'incomplete');assert.equal(summary.gpu.failedSamples,1);
 assert.equal(c.recordGpu(31,8,true),false);
 c.record(510,61,1,2,3,false);c.recordGpu(61,5,false);
 const next=c.summary(1000,{timestampQuerySupported:true,timestampQueryEnabled:true});assert.equal(next.gpu.p95,5);assert.equal(next.gpu.validity,'incomplete');assert.match(next.gpu.reason,/outside passes/);
});

test('collector measures completed-frame throughput and per-frame CPU sums with nearest-rank quantiles',()=>{
  const c=createFrameCollector({startMs:0,capacity:32,windowMs:1000});
  for(let i=1;i<=10;i++)c.record(i*100, i, i%2?1:9, i%2?9:1, 3, false);
  const s=c.summary(1000);
  assert.equal(s.produced.value,10);assert.equal(s.cpuCall.p95,10);
  assert.equal(s.update.p95,9);assert.equal(s.renderCall.p95,9);
  assert.equal(s.queueWait.p95,3);assert.equal(s.cpuCall.sampleCount,10);
  assert.equal(s.cpuCall.gate,'not_evaluated');assert.equal(s.cpuCall.validity,'complete');
  assert.equal(s.gpu.availability,'unsupported');assert.equal('p95' in s.gpu,false);
});

test('overflow is bounded and cannot improve completeness; drained samples are not retained indefinitely',()=>{
  const c=createFrameCollector({startMs:0,capacity:4,windowMs:1000});
  for(let i=1;i<=5;i++)c.record(i*10,i,1,2,3,false);
  const s=c.summary(100);assert.equal(s.lostRecords,1);assert.equal(s.cpuCall.validity,'incomplete');
  assert.equal(s.cpuCall.sampleCount,4);assert.equal(s.cpuCall.expectedCount,5);
  assert.equal(s.produced.value,50,'throughput uses cumulative completions, not only retained spans');
  const aged=c.summary(1200);assert.equal(aged.cpuCall.sampleCount,0);assert.equal(aged.cpuCall.availability,'pending');
  assert.equal(aged.produced.value,0);assert.equal(aged.retainedRecords,0);
});

test('invalid timestamps, durations and frame order invalidate coverage without inventing zero values',()=>{
  const c=createFrameCollector({startMs:0,capacity:8,windowMs:1000});
  c.record(100,1,1,2,3,false);c.record(200,2,NaN,2,3,false);c.record(150,3,1,2,3,false);
  const s=c.summary(300);assert.equal(s.invalidRecords,2);assert.equal(s.cpuCall.validity,'incomplete');
  assert.equal(s.cpuCall.sampleCount,1);assert.equal(s.cpuCall.gate,'not_evaluated');
  assert.throws(()=>c.summary(299),/monotonic/);
});

test('async renders remain explicit wall-time observations and cannot claim a complete CPU-work measurement',()=>{
  const c=createFrameCollector({startMs:0});c.record(100,1,2,3,20,true,40);
  const s=c.summary(500);assert.equal(s.renderAwait.p95,40);assert.equal(s.cpuCall.p95,5);
  assert.equal(s.cpuCall.validity,'incomplete');assert.match(s.cpuCall.reason,/asynchronous/i);
  assert.equal(s.gpu.timestampQuerySupported,null);assert.equal(s.gpu.timestampQueryEnabled,false);
});

test('snapshot data is detached and invalid allocation options fail before creating buffers',()=>{
  assert.throws(()=>createFrameCollector({startMs:0,capacity:4097}));
  assert.throws(()=>createFrameCollector({startMs:0,windowMs:120001}));
  const c=createFrameCollector({startMs:0});c.record(1,1,1,1,1,false);
  const s=c.summary(10);assert.ok(Object.isFrozen(s));assert.ok(Object.isFrozen(s.cpuCall));
  assert.equal(c.summary(20).cpuCall.availability,'pending');
});
