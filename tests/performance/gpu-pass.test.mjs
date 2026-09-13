import test from 'node:test';
import assert from 'node:assert/strict';
import { createGpuPassTimer } from '../../packages/performance/gpu-pass.mjs';

test('offset reference probing preserves the unchanged real routine query schedule',async()=>{
 const f=fixture(),reference=[],routine=[];
 const ref=createGpuPassTimer(f.device,(frame)=>{reference.push(frame+15);return true;});
 const normal=createGpuPassTimer(f.device,(frame)=>{routine.push(frame);return true;});
 for(let frame=1;frame<=61;frame++){
  if(frame>=16)ref.begin(frame-15);normal.begin(frame);const encoder=f.device.createCommandEncoder();encoder.beginRenderPass({}).end();f.device.queue.submit([encoder.finish()]);
  normal.end();ref.end();await f.flush();
 }
 assert.deepEqual(routine,[1,31,61]);assert.deepEqual(reference,[16,46]);
 assert.equal(ref.status().failedSamples,0);assert.equal(normal.status().failedSamples,0);
 normal.dispose();ref.dispose();
});

test('baseline leaves GPU APIs untouched and allocates no query resources',()=>{
 const f=fixture(),encoder=f.device.createCommandEncoder,submit=f.device.queue.submit;
 const timer=createGpuPassTimer(f.device,()=>assert.fail('No baseline GPU samples'),{mode:'baseline'});
 assert.equal(f.buffers.length,0);assert.equal(f.queries.length,0);
 assert.equal(f.device.createCommandEncoder,encoder);assert.equal(f.device.queue.submit,submit);
 timer.begin(1);timer.end();assert.equal(timer.status().timestampQueryEnabled,false);
 assert.equal(timer.status().failedSamples,0);timer.dispose();
});

test('routine samples frames 1 and 31 without treating intervening draws as failures',async()=>{
 const f=fixture(),samples=[];const timer=createGpuPassTimer(f.device,(frame)=>{samples.push(frame);return true;});
 for(let frame=1;frame<=31;frame++){
  timer.begin(frame);const e=f.device.createCommandEncoder(),p=e.beginRenderPass({});
  assert.equal(Boolean(p.descriptor.timestampWrites),frame===1||frame===31);
  p.end();f.device.queue.submit([e.finish()]);timer.end();await f.flush();
 }
 assert.deepEqual(samples,[1,31]);assert.equal(timer.status().failedSamples,0);assert.equal(timer.status().droppedSamples,0);timer.dispose();
});

test('an uninstrumented encoder from an unsampled frame cannot certify a sampled submission',async()=>{
 const f=fixture(),samples=[];const timer=createGpuPassTimer(f.device,(frame)=>{samples.push(frame);return true;});
 timer.begin(2);const old=f.device.createCommandEncoder();old.beginRenderPass({}).end();timer.end();
 timer.begin(31);f.device.queue.submit([old.finish()]);timer.end();await f.flush();
 assert.equal(timer.status().failedSamples,1);assert.deepEqual(samples,[]);timer.dispose();
});
function fixture({blocked=false,fail=false}={}) {
 const submits=[],buffers=[],queries=[];let pending=[];
 const device={features:new Set(['timestamp-query']),pushErrorScope(){},popErrorScope:async()=>null,queue:{submit(v){submits.push(v);}},
  createQuerySet(){const q={destroyed:false,destroy(){this.destroyed=true;}};queries.push(q);return q;},
  createBuffer(){const bytes=new BigUint64Array(256);bytes[0]=9007199254740993n;bytes[1]=9007199255740993n;bytes[2]=9007199256740993n;bytes[3]=9007199258740993n;
   const b={destroyed:false,mapAsync(){return fail?Promise.reject(Error('map failed')):blocked?new Promise(r=>pending.push(r)):Promise.resolve();},getMappedRange(){return bytes.buffer;},unmap(){},destroy(){this.destroyed=true;}};buffers.push(b);return b;},
  createCommandEncoder(){return {beginRenderPass(descriptor){return {descriptor,end(){}};},beginComputePass(descriptor){return {descriptor,end(){}};},resolveQuerySet(){},copyBufferToBuffer(){},finish(){return {};}};}};
 return {device,buffers,queries,release(){for(const resolve of pending)resolve();pending=[];},flush:async()=>{for(let i=0;i<10;i++)await Promise.resolve();}};
}
test('GPU timer captures every render/compute pass, subtracts uint64 before converting, and never reuses cached results',async()=>{
 const f=fixture(),samples=[];const timer=createGpuPassTimer(f.device,(frame,ms)=>{samples.push({frame,ms});return true;});
 timer.begin(1);const encoder=f.device.createCommandEncoder();const a=encoder.beginRenderPass({colorAttachments:[]}),b=encoder.beginComputePass({});a.end();b.end();f.device.queue.submit([encoder.finish()]);timer.end();await f.flush();
 assert.equal(a.descriptor.timestampWrites.beginningOfPassWriteIndex,0);assert.equal(b.descriptor.timestampWrites.endOfPassWriteIndex,3);
 assert.deepEqual(samples,[{frame:1,ms:3}]);assert.equal(timer.status().completedSamples,1);
 timer.begin(31);timer.end();await f.flush();assert.equal(samples.length,1);assert.equal(timer.status().failedSamples,1);
 timer.dispose();assert.ok(f.buffers.every(b=>b.destroyed));assert.ok(f.queries.every(q=>q.destroyed));
});
test('readback pool stays bounded and overflow/failure/late completion are explicit',async()=>{
 const f=fixture({blocked:true}),samples=[];const timer=createGpuPassTimer(f.device,(frame,ms)=>{samples.push([frame,ms]);return true;});
 for(let frame=1;frame<=121;frame+=30){timer.begin(frame);const e=f.device.createCommandEncoder();e.beginRenderPass({}).end();f.device.queue.submit([e.finish()]);timer.end();}
 assert.equal(f.buffers.length,6);assert.equal(f.queries.length,3);assert.equal(timer.status().pendingSamples,3);assert.equal(timer.status().droppedSamples,2);
 timer.dispose();f.release();await f.flush();assert.equal(samples.length,0);
 const bad=fixture({fail:true}),other=createGpuPassTimer(bad.device,()=>true);other.begin(1);bad.device.createCommandEncoder().beginRenderPass({}).end();other.end();await bad.flush();assert.equal(other.status().failedSamples,1);other.dispose();
});
test('unsupported features allocate nothing and conflicting query writes cannot claim complete coverage',async()=>{
 const unsupported=fixture();unsupported.device.features.clear();const timer=createGpuPassTimer(unsupported.device,()=>true);assert.equal(timer.status().timestampQueryEnabled,false);assert.equal(unsupported.buffers.length,0);
 const f=fixture(),samples=[];const active=createGpuPassTimer(f.device,(...args)=>samples.push(args));active.begin(1);f.device.createCommandEncoder().beginRenderPass({timestampWrites:{querySet:'existing'}}).end();active.end();await f.flush();assert.equal(samples.length,0);assert.equal(active.status().failedSamples,1);active.dispose();
});
test('copies retain useful pass timing with incomplete coverage and old command buffers cannot impersonate a reused query slot',async()=>{
 const f=fixture(),samples=[];const timer=createGpuPassTimer(f.device,(frame,ms,complete)=>{samples.push({frame,ms,complete});return true;});
 timer.begin(1);const first=f.device.createCommandEncoder();first.beginRenderPass({}).end();first.copyBufferToBuffer();const old=first.finish();f.device.queue.submit([old]);timer.end();await f.flush();
 assert.deepEqual(samples,[{frame:1,ms:1,complete:false}]);
 timer.begin(31);f.device.queue.submit([old]);timer.end();await f.flush();assert.equal(samples.length,1);assert.equal(timer.status().failedSamples,1);timer.dispose();
});
test('pass overflow and non-extensible WebGPU objects invalidate instrumentation without breaking rendering',async()=>{
 const f=fixture(),samples=[];const timer=createGpuPassTimer(f.device,(...args)=>samples.push(args));timer.begin(1);const encoder=f.device.createCommandEncoder();
 for(let i=0;i<129;i++)encoder.beginRenderPass({}).end();f.device.queue.submit([encoder.finish()]);timer.end();await f.flush();assert.equal(samples.length,0);assert.equal(timer.status().failedSamples,1);timer.dispose();
 const g=fixture(),create=g.device.createCommandEncoder;g.device.createCommandEncoder=()=>Object.freeze(create());const other=createGpuPassTimer(g.device,()=>true);other.begin(1);
 assert.doesNotThrow(()=>g.device.createCommandEncoder().beginRenderPass({}).end());other.end();assert.equal(other.status().failedSamples,1);other.dispose();
 const h=fixture();Object.freeze(h.device);const unsupported=createGpuPassTimer(h.device,()=>true);assert.equal(unsupported.status().timestampQueryEnabled,false);assert.ok(h.buffers.every(b=>b.destroyed));unsupported.dispose();
});
test('asynchronous GPU validation failure rejects otherwise plausible cached timestamp contents',async()=>{
 const f=fixture(),samples=[];f.device.popErrorScope=async()=>({message:'invalid command'});const timer=createGpuPassTimer(f.device,(...args)=>samples.push(args));
 timer.begin(1);const encoder=f.device.createCommandEncoder();encoder.beginRenderPass({}).end();f.device.queue.submit([encoder.finish()]);timer.end();await f.flush();
 assert.equal(samples.length,0);assert.equal(timer.status().failedSamples,1);timer.dispose();
});
