import assert from 'node:assert/strict';
const stages=['outer-sleep','local-copy-poll-sleep','copy-submit-to-query-done','nv-lock','gl-fence-to-ready'];
const ticks=value=>{assert.equal(typeof value,'string');assert.match(value,/^(0|[1-9][0-9]{0,19})$/);const result=BigInt(value);assert.ok(result<=0xffffffffffffffffn);return result;};
export function inspectReceiverWorkerTiming(rows,instanceId,frequency,envelope){
 assert.ok(Array.isArray(rows)&&rows.length<=32769);assert.match(instanceId,/^[a-f0-9]{32}$/);
 const summaries=rows.filter(r=>r.kind==='receiver-worker-timing-summary');assert.equal(summaries.length,1,'Missing exact timing summary');const s=summaries[0];
 assert.equal(s.instanceId,instanceId);assert.equal(s.domain,'qpc');assert.equal(s.frequency,frequency);const hz=ticks(frequency);assert.ok(hz>0n);
 assert.ok(envelope,'Missing independent child QPC envelope');assert.equal(envelope.frequency,frequency);
 const childStart=ticks(envelope.start),childEnd=ticks(envelope.end);assert.ok(childStart>0n&&childEnd>=childStart);
 assert.equal(s.capacity,32768);assert.equal(s.valid,true,'Timing evidence incomplete');assert.equal(s.aborted,false);assert.equal(s.allocationFailed,false);
 for(const key of ['lostRecords','clockFailures','incompleteSpans'])assert.equal(s[key],0,key);
 const records=rows.filter(r=>r.kind==='receiver-worker-timing');assert.equal(records.length+1,rows.length);assert.ok(records.length>0);assert.equal(s.recorded,records.length);assert.equal(s.attempted,records.length);
 const samples=Object.fromEntries(stages.map(stage=>[stage,[]]));let previousEnd=0n;
 records.forEach((r,index)=>{
  assert.equal(r.instanceId,instanceId);assert.equal(r.sequence,index+1);assert.ok(stages.includes(r.stage));assert.equal(r.complete,true);
  const start=ticks(r.start),end=ticks(r.end);assert.ok(start>0n&&end>=start&&end>=previousEnd);previousEnd=end;
  assert.ok(start>=childStart&&end<=childEnd,'Timing span lies outside the independently observed child lifetime');
  const frame=ticks(r.frameId);for(const key of ['generation','outputGeneration'])assert.ok(Number.isSafeInteger(r[key])&&r[key]>=0);
  assert.equal(r.boundFrame,frame>0n);if(!r.boundFrame)assert.ok(r.generation===0&&r.outputGeneration===0);
 if(r.stage.endsWith('sleep'))assert.equal(r.requestedSleepMs,1);else {assert.equal(r.boundFrame,true);assert.equal(Object.hasOwn(r,'requestedSleepMs'),false);}
  samples[r.stage].push(Number(end-start)*1000/Number(hz));
 });
 const summary=Object.fromEntries(stages.map(stage=>{const a=samples[stage].sort((x,y)=>x-y),at=p=>a.length?a[Math.max(0,Math.ceil(a.length*p)-1)]:null;return [stage,{count:a.length,medianMs:at(.5),p95Ms:at(.95),maxMs:at(1)}];}));
 return {ok:true,instanceId,recorded:records.length,stages:summary,childEnvelope:{start:envelope.start,end:envelope.end,frequency},gpuDurationMeasured:false,scope:'Whole measured receiver worker loop, including startup and stop, not only the ten-second cadence window. CPU elapsed includes queue/poll/wake delay; timing perturbation uncalibrated. No performance acceptance.'};
}
