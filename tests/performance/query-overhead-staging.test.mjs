import test from 'node:test';import assert from 'node:assert/strict';
import {installSubmitStaging,waitForTimerDrain} from '../../tools/gpu-spike/query-overhead/staging.mjs';
import {createGpuPassTimer} from '../../packages/performance/gpu-pass.mjs';
function fixture(){const events=[],submitted=[];let fail=false;const device={features:new Set(['timestamp-query']),pushErrorScope(){events.push('push');},popErrorScope(){events.push('pop');return Promise.resolve(null);},
 queue:{submit(buffers){events.push('real-submit');if(fail)throw Error('submit failed');submitted.push(buffers);}},
 createQuerySet(){return {destroy(){}};},createBuffer(){return {mapAsync(){events.push('native-map');return Promise.resolve();},getMappedRange(){return new BigUint64Array([100n,200n]).buffer;},unmap(){},destroy(){}};},
 createCommandEncoder(){return {beginRenderPass(){return {end(){}};},beginComputePass(){return {end(){}};},resolveQuerySet(){events.push('resolve');},copyBufferToBuffer(){events.push('copy');},finish(){return {};}};}};
 return {device,events,submitted,failSubmit(){fail=true;}};
}
test('unsettled timer scope has a finite post-measurement drain bound',async()=>{await assert.rejects(waitForTimerDrain({status:()=>({pendingSamples:1})},1),/completion deadline/);});
test('real timer resolve/copy joins one flush; native map starts only after real submission',async()=>{
 const f=fixture(),stage=installSubmitStaging(f.device),samples=[],timer=createGpuPassTimer(f.device,(frame)=>samples.push(frame));
 stage.begin();stage.append({boundary:'start'});
 for(let frame=1;frame<=30;frame++){timer.begin(frame);const e=f.device.createCommandEncoder();e.beginRenderPass({}).end();f.device.queue.submit([e.finish()]);timer.end();}
 stage.append({boundary:'end'});assert.equal(f.submitted.length,0);assert.equal(f.events.includes('native-map'),false);assert.deepEqual(f.events.filter(x=>['resolve','copy'].includes(x)),['resolve','copy']);
 assert.deepEqual(stage.flush(),{realSubmissions:1,commandBuffers:33,logicalSubmissionGroups:31,deferredMaps:1});await stage.drain();for(let i=0;i<8;i++)await Promise.resolve();
 assert.ok(f.events.indexOf('real-submit')<f.events.indexOf('native-map'));assert.deepEqual(samples,[1]);assert.equal(timer.status().completedSamples,1);assert.equal(timer.status().pendingSamples,0);timer.dispose();stage.restore();
});
test('baseline has identical outer buffers/body but no query resolve or deferred map',async()=>{
 const f=fixture(),stage=installSubmitStaging(f.device),timer=createGpuPassTimer(f.device,()=>{}, {mode:'baseline'});stage.begin();stage.append({});
 for(let frame=1;frame<=30;frame++){timer.begin(frame);const e=f.device.createCommandEncoder();e.beginRenderPass({}).end();f.device.queue.submit([e.finish()]);timer.end();}stage.append({});
 assert.deepEqual(stage.flush(),{realSubmissions:1,commandBuffers:32,logicalSubmissionGroups:30,deferredMaps:0});await stage.drain();assert.equal(f.events.includes('native-map'),false);timer.dispose();stage.restore();
});
test('failed real submit rejects deferred map without invoking native map',async()=>{
 const f=fixture(),stage=installSubmitStaging(f.device),timer=createGpuPassTimer(f.device,()=>{});stage.begin();timer.begin(1);const e=f.device.createCommandEncoder();e.beginRenderPass({}).end();f.device.queue.submit([e.finish()]);timer.end();f.failSubmit();assert.throws(()=>stage.flush(),/submit failed/);await assert.rejects(stage.drain());for(let i=0;i<8;i++)await Promise.resolve();assert.equal(f.events.includes('native-map'),false);assert.equal(timer.status().failedSamples,1);timer.dispose();stage.restore();
});
