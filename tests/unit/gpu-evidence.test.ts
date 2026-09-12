import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProbeEvidence } from '../../scripts/gpu-evidence.mjs';
const producer = [{kind:'summary',paint:100,held:0,uncertain:0,dropped:0,closed:true,failed:false,webgpuReady:true}];
const receiver = [{kind:'context',sharedContext:true,nvInterop:true},{kind:'counters',consumed:90}];
test('short GPU diagnostic requires both producer completion and receiver consumption', () => {
  assert.equal(validateProbeEvidence(producer, receiver).ok, true);
  assert.equal(validateProbeEvidence(producer, []).ok, false);
  assert.equal(validateProbeEvidence([], receiver).ok, false);
  assert.equal(validateProbeEvidence(producer, [...receiver,{kind:'failure',reason:'cleanup'}]).ok, false);
});
test('incomplete ownership, worker failure and telemetry loss cannot pass', () => {
  for (const invalid of [{held:1},{uncertain:1},{dropped:1},{failed:true},{webgpuReady:false},{closed:false},{paint:0}]) {
    assert.equal(validateProbeEvidence([{...producer[0],...invalid}],receiver).ok,false);
  }
});
