import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRecovery } from '../../packages/performance/recovery.ts';
const target={instanceId:'instance',generation:2,revisionId:'revision',controlSchemaHash:'schema',controlSequence:8,controls:{amount:.8}};
function evidence():any{return {schemaVersion:1,provenance:'synthetic',clockDomain:'harness-monotonic-ms',injectedAtMs:100,stopRequestedAtMs:1350,stopObservedAtMs:1360,restartRequestedAtMs:1400,
 consumed:{atMs:1500,frameId:'1',referenceImageConfirmed:true,...target},target,hostResponsive:true,sourceIntact:true,lostRecords:0,incomplete:false};}
test('recovery requires independent stop and exact consumed generation/reference/current values',()=>{
 const result=evaluateRecovery(evidence());assert.equal(result.watchdog.gate,'pass');assert.equal(result.watchdog.durationMs,1260);
 assert.equal(result.recovery.gate,'pass');assert.equal(result.recovery.durationMs,100);assert.equal(result.hardwareAcceptance,'unavailable');
 for(const key of ['generation','revisionId','controlSchemaHash','controlSequence','controls']){
  const e=evidence();e.consumed[key]=key==='controls'?{amount:.5}:key==='generation'||key==='controlSequence'?1:'old';
  assert.equal(evaluateRecovery(e).recovery.gate,'fail',key);
 }
});
test('termination requests and worker-ready proxies cannot pass host recovery',()=>{
 const e=evidence();e.stopObservedAtMs=null;e.consumed=null;
 const result=evaluateRecovery(e);assert.equal(result.watchdog.gate,'unavailable');assert.equal(result.recovery.gate,'unavailable');
 assert.equal(result.watchdog.durationMs,undefined);assert.equal(result.recovery.durationMs,undefined);
});
test('late observations fail budgets and incomplete/invalid records cannot pass',()=>{
 const e=evidence();e.stopObservedAtMs=2201;e.restartRequestedAtMs=2300;e.consumed.atMs=7301;
 assert.equal(evaluateRecovery(e).watchdog.gate,'fail');assert.equal(evaluateRecovery(e).recovery.gate,'fail');
 for(const patch of [{lostRecords:1},{incomplete:true},{stopObservedAtMs:99},{clockDomain:'wall-clock'},
  {target:{...target,controls:{amount:NaN}}},{hostResponsive:false},{sourceIntact:false}]){
  const result=evaluateRecovery({...evidence(),...patch});assert.notEqual(result.watchdog.gate,'pass');assert.notEqual(result.recovery.gate,'pass');
 }
});
