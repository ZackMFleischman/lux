import test from 'node:test';import assert from 'node:assert/strict';
import {plan,order,summarize,completeWithJob} from '../../scripts/gpu-paired/method.mjs';
const status={failedSamples:0,droppedSamples:0,pendingSamples:0,timestampQueryEnabled:true};
function fixture(){return order.flatMap(p=>p.modes.map(mode=>({pair:p.pair,mode,data:{performanceMode:mode,frameId:'300',timeSeconds:0,controlSequence:0,adapter:{vendor:'pinned'},reference:status,routine:{...status,timestampQueryEnabled:mode==='routine'},
 raw:[...Array.from({length:10},(_,i)=>({timer:'reference',frame:16+i*30,ms:mode==='routine'?1.01:1,complete:false,
 raw:{passCount:1,timestampsNs:['1000000',mode==='routine'?'2010000':'2000000']}})),...(mode==='routine'?Array.from({length:10},(_,i)=>({timer:'routine',frame:1+i*30})):[])]}})));}
test('paired GPU diagnostic keeps all five pairs and quantization uncertainty; never certifies total overhead',()=>{
 const result=summarize(fixture());assert.equal(result.validity,'diagnostic');assert.equal(result.pairs.length,5);
 assert.equal(result.legs.length,10);assert.ok(result.legs.every(row=>row.samples===8));
 assert.ok(Math.abs(result.meanPairedPercent-1)<1e-8);assert.ok(result.systematicQuantizationPercentBounds[0]<0);assert.ok(result.systematicQuantizationPercentBounds[1]>2);
 assert.equal(result.totalGpuOverheadGate,'unavailable');assert.deepEqual(order.map(row=>row.modes.join('/')),['baseline/routine','routine/baseline','baseline/routine','routine/baseline','baseline/routine']);
 assert.equal(plan.trialDeadlineMs,100000);assert.equal(plan.processDeadlineMs,120000);
});
test('missing reference or routine samples invalidate population without silently dropping the leg',()=>{
 for(const timer of ['reference','routine']){const legs=fixture();const leg=legs.find(row=>row.mode==='routine');leg.data.raw.splice(leg.data.raw.findIndex(row=>row.timer===timer),1);const result=summarize(legs);assert.equal(result.validity,'incomplete');assert.equal(result.legs.length,10);}
});
test('raw-duration mismatch rejects misleading GPU results',()=>{const legs=fixture();legs[0].data.raw.find(r=>r.frame===76).ms=2;assert.throws(()=>summarize(legs));});
test('changed device, mode or incomplete frame sequence invalidates comparison',()=>{
 for(const field of ['adapter','performanceMode','frameId']){const legs=fixture();legs[1].data[field]='changed';assert.equal(summarize(legs).validity,'incomplete');}
});
test('measurement cannot pass before application and owned-descendant cleanup are confirmed',()=>{
 const result={measurementValid:true,appClosed:true,errors:[]},job={cleanupComplete:true,exitCode:0,timeout:false,cancelled:false};
 assert.equal(completeWithJob(result,job).ok,true);
 for(const change of [{appClosed:false},{errors:['close failed']},{measurementValid:false}])assert.equal(completeWithJob({...result,...change},job).ok,false);
 for(const change of [{cleanupComplete:false},{exitCode:1},{timeout:true},{cancelled:true}])assert.equal(completeWithJob(result,{...job,...change}).ok,false);
});
