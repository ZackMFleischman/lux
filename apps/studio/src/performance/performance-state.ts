import type { FrameSummary, LiveMetric } from '../../../../packages/performance/live.mjs';
import { GPU_SAMPLE_EVERY, GPU_SAMPLING_POLICY } from '../../../../packages/performance/collection-mode.mjs';
export type PerformanceOwner=Readonly<{instanceId:string;generation:number;revisionId:string}>;
export type PerformanceSnapshot=Readonly<{
 owner:PerformanceOwner;status:'pending'|'live'|'stale'|'failed';observedAtMs:number|null;worker:FrameSummary|null;
}>;
const count=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
const duration=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
function metric(raw:any,unit:'ms'|'Hz'):LiveMetric {
 if(!raw||raw.unit!==unit||!['available','pending','unsupported'].includes(raw.availability)||
  !['complete','sampled','incomplete'].includes(raw.validity)||raw.gate!=='not_evaluated'||
  !count(raw.sampleCount)||!count(raw.expectedCount)||!count(raw.missingCount)||
  raw.sampleCount+raw.missingCount!==raw.expectedCount||
  typeof raw.samplingPolicy!=='string'||raw.samplingPolicy.length>160||
  (raw.reason!==undefined&&(typeof raw.reason!=='string'||raw.reason.length>256)))throw Error('Invalid metric');
 if(raw.missingCount>0&&raw.validity!=='incomplete')throw Error('Missing observations cannot be complete');
 const result:any={unit,availability:raw.availability,validity:raw.validity,gate:'not_evaluated',
  sampleCount:raw.sampleCount,expectedCount:raw.expectedCount,missingCount:raw.missingCount,samplingPolicy:raw.samplingPolicy};
 if(raw.reason!==undefined)result.reason=raw.reason;
 for(const key of ['value','p50','p95','p99','max'])if(raw[key]!==undefined){
  if(!duration(raw[key])||raw.availability!=='available')throw Error('Invalid duration');result[key]=raw[key];
 }
 if(raw.availability==='available') {
  if(unit==='Hz'?!duration(raw.value):!(raw.sampleCount>0&&['p50','p95','p99','max'].every(key=>duration(raw[key]))&&raw.p50<=raw.p95&&raw.p95<=raw.p99&&raw.p99<=raw.max))throw Error('Missing statistics');
 }
 return Object.freeze(result);
}
function summary(raw:any):FrameSummary {
 if(!raw||raw.schemaVersion!==1||!['baseline','routine'].includes(raw.mode)||raw.clockDomain!=='dedicated-worker-monotonic-ms'||
  !count(raw.sequence)||raw.sequence===0||!duration(raw.windowStartMs)||!duration(raw.windowEndMs)||raw.windowEndMs<raw.windowStartMs)throw Error('Invalid summary');
 const result:any={schemaVersion:1,mode:raw.mode,clockDomain:raw.clockDomain,sequence:raw.sequence,windowStartMs:raw.windowStartMs,windowEndMs:raw.windowEndMs};
 for(const key of ['lostRecords','invalidRecords','intervalLostRecords','intervalInvalidRecords','retainedRecords']){
  if(!count(raw[key]))throw Error('Invalid count');result[key]=raw[key];
 }
 if(raw.retainedRecords>4096||raw.intervalLostRecords>raw.lostRecords||raw.intervalInvalidRecords>raw.invalidRecords)throw Error('Invalid bounds');
 result.produced=metric(raw.produced,'Hz');
 if(result.produced.validity==='sampled'||(raw.mode==='baseline'&&(raw.retainedRecords!==0||raw.lostRecords!==0)))throw Error('Invalid baseline/frame coverage');
 for(const key of ['update','renderCall','cpuCall','renderAwait','queueWait']){
  result[key]=metric(raw[key],'ms');
  if(result[key].validity==='sampled'||result[key].sampleCount!==raw.retainedRecords||result[key].expectedCount!==(raw.mode==='baseline'?0:result.produced.expectedCount))throw Error('Invalid coverage');
  if(raw.mode==='baseline'&&(result[key].availability!=='unsupported'||result[key].samplingPolicy!=='none'))throw Error('Invalid baseline timing');
 }
 const gpu=raw.gpu;
 if(!gpu||![true,false,null].includes(gpu.timestampQuerySupported)||typeof gpu.timestampQueryEnabled!=='boolean'||
  !count(gpu.failedSamples)||!count(gpu.droppedSamples)||!count(gpu.pendingSamples)||gpu.pendingSamples>3)throw Error('Invalid GPU capability');
 if(gpu.timestampQueryEnabled?gpu.timestampQuerySupported!==true||gpu.availability==='unsupported':gpu.availability!=='unsupported'||gpu.sampleCount!==0||gpu.validity!=='incomplete')throw Error('Invalid GPU coverage');
 if(gpu.sampleCount>raw.retainedRecords)throw Error('Invalid GPU samples');
 if(gpu.expectedCount>result.produced.expectedCount||gpu.validity==='complete'||gpu.samplingPolicy!==(raw.mode==='baseline'?'none':GPU_SAMPLING_POLICY))throw Error('Invalid GPU coverage count');
 // This receiver consumes consecutive completed worker frames. An interval can
 // start on any phase, but cannot contain more than ceil(N/30) eligible frames.
 if(raw.mode==='routine'&&gpu.expectedCount>Math.ceil(result.produced.expectedCount/GPU_SAMPLE_EVERY))throw Error('Invalid GPU sampling population');
 if(raw.mode==='baseline'&&(gpu.timestampQueryEnabled||gpu.expectedCount!==0||gpu.failedSamples!==0||gpu.droppedSamples!==0||gpu.pendingSamples!==0))throw Error('Invalid baseline GPU timing');
 result.gpu=Object.freeze({...metric(gpu,'ms'),timestampQuerySupported:gpu.timestampQuerySupported,timestampQueryEnabled:gpu.timestampQueryEnabled,failedSamples:gpu.failedSamples,droppedSamples:gpu.droppedSamples,pendingSamples:gpu.pendingSamples});
 return Object.freeze(result);
}
/** Holds one bounded, detached summary. Arrival timestamps belong to the UI
 * clock; they are never subtracted from the worker's monotonic timestamps. */
export class PerformanceReceiver {
 snapshot:PerformanceSnapshot;
 private lastArrival:number;
 constructor(owner:PerformanceOwner,now:number){this.lastArrival=now;this.snapshot=Object.freeze({owner:Object.freeze({...owner}),status:'pending',observedAtMs:null,worker:null});}
 receive(raw:unknown,now:number):boolean {
  if(this.snapshot.status==='failed'||!duration(now)||now<this.lastArrival)return false;
  try {
   const value=summary(raw),previous=this.snapshot.worker;
   if(previous&&(value.mode!==previous.mode||value.sequence<=previous.sequence||value.windowStartMs<previous.windowEndMs||value.lostRecords<previous.lostRecords||value.invalidRecords<previous.invalidRecords||value.gpu.failedSamples<previous.gpu.failedSamples||value.gpu.droppedSamples<previous.gpu.droppedSamples))return false;
   this.lastArrival=now;this.snapshot=Object.freeze({...this.snapshot,status:'live',observedAtMs:now,worker:value});return true;
  }catch{return false;}
 }
 age(now:number):boolean {
  if((this.snapshot.status==='pending'||this.snapshot.status==='live')&&now-this.lastArrival>=1500){this.snapshot=Object.freeze({...this.snapshot,status:'stale'});return true;}return false;
 }
 fail(){this.snapshot=Object.freeze({...this.snapshot,status:'failed'});}
}
