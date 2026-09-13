import test from 'node:test';import assert from 'node:assert/strict';
import {inspectCadence} from '../../tools/gpu-spike/cadence-inspect.mjs';
function fixture(){
 const instanceId='a'.repeat(32),attemptId='b'.repeat(32),releaseId='c'.repeat(64),revisionId='d'.repeat(64);
 const slots=Array.from({length:600},(_,slot)=>({slot,due:String(1000+slot*100),before:String(1000+slot*100),after:String(1002+slot*100),sequence:slot+1,missed:false,success:true}));
 return {expected:{releaseId,revisionId},experiment:{id:'run',child:{pid:42,startTicks:'900',frequency:6000},timeoutMs:30000,outcome:'success',cleanupComplete:true,result:{cleanupComplete:true,exitCode:0,timeout:false,cancelled:false,endTicks:'62000'}},
 probe:{mode:'cadence-v1',runId:'run',hostPid:42,ok:true,deinstantiated:true,deinitialized:true,lostRecords:0,clock:{domain:'qpc',frequency:'6000'},start:'1000',end:'61000',coverageEnd:'61001',slots},
 host:[{kind:'native-clock',domain:'qpc',frequency:'6000'},...slots.map(s=>({kind:'host-opportunity',instanceId,sequence:s.sequence,at:String(Number(s.before)+1),present:false,generation:0,frameId:'0',copyCompletedQpc:'0'})),{kind:'host-telemetry-summary',instanceId,lostRecords:0,recorded:600}],
 lifecycle:[{kind:'restart-trigger',instanceId,attemptId,releaseId,revisionId,incomplete:false,lostRecords:0,clock:{domain:'qpc',frequency:'6000',at:'2000'}}]};
}
test('full cold-start window retains no-frame opportunities and elapsed callback spans',()=>{
 const r=inspectCadence(fixture());assert.equal(r.opportunities,600);assert.equal(r.rateHz,60);assert.equal(r.noFrame,600);assert.equal(r.missedSlots,0);assert.equal(r.callbackMs.p95,1/3);assert.equal(r.performanceAcceptance,false);assert.equal(r.freshImageMeasured,false);
});
test('a skipped nominal slot lowers actual cadence and is never a fake opportunity',()=>{
 const x=fixture();Object.assign(x.probe.slots[1],{before:'0',after:'0',sequence:0,missed:true,success:false});x.host.splice(2,1);x.host.at(-1).recorded=599;
 for(let i=2;i<600;i++)x.probe.slots[i].sequence--;for(const [i,o] of x.host.filter(x=>x.kind==='host-opportunity').entries())o.sequence=i+1;
 const r=inspectCadence(x);assert.equal(r.opportunities,599);assert.equal(r.rateHz,59.9);assert.equal(r.missedSlots,1);
});
test('held transport frames remain held; they are not fresh rendered-image claims',()=>{
 const x=fixture();x.lifecycle[0].clock.at='900';for(const o of x.host.filter(x=>x.kind==='host-opportunity'))Object.assign(o,{present:true,generation:1,frameId:'5',copyCompletedQpc:'950'});
 const r=inspectCadence(x);assert.equal(r.heldTransport,599);assert.equal(r.selectedTransport,1);assert.equal(r.freshImageMeasured,false);
});
test('supervisor QPC envelope and producer-start provenance cannot be shifted or fabricated',()=>{
 for(const mutate of [x=>x.experiment.child.startTicks='1001',x=>x.experiment.result.endTicks='61000',x=>x.experiment.child.frequency=6001,x=>x.lifecycle[0].clock.at='800',x=>{Object.assign(x.host.at(-2),{present:true,generation:1,frameId:'5',copyCompletedQpc:'1900'});},x=>{x.lifecycle[0].clock.at='61001';}]){
  const x=fixture();mutate(x);assert.throws(()=>inspectCadence(x));
 }
});
test('incomplete windows, fake joins, missing slots, timer failures and loss fail closed',()=>{
 for(const mutate of [x=>x.probe.end='60999',x=>x.probe.coverageEnd='60999',x=>x.probe.slots.pop(),x=>x.probe.slots[1].slot=0,x=>x.probe.slots[1].due='1101',x=>x.probe.slots[1].before='999',x=>x.host[1].at='1003',x=>x.host.splice(2,1),x=>x.host.at(-1).lostRecords=1,x=>x.probe.ok=false,x=>x.probe.slots[0].success=false,x=>x.probe.clock.frequency='6001',x=>x.experiment.timeoutMs=30001,x=>x.experiment.cleanupComplete=false,x=>x.lifecycle[0].revisionId='e'.repeat(64)]){
  const x=fixture();mutate(x);assert.throws(()=>inspectCadence(x));
 }
});
