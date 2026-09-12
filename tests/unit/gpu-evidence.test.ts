import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProbeEvidence, validateResolumeEvidence } from '../../scripts/gpu-evidence.mjs';
const producer = [{kind:'summary',paint:100,held:0,uncertain:0,dropped:0,closed:true,failed:false,webgpuReady:true}];
const receiver = [{kind:'context',sharedContext:true,nvInterop:true},{kind:'counters',consumed:90}];
test('compiled transport cannot pass using old diagnostic or mismatched initial controls',()=>{
  const release={sourceHash:'source',linked:{linkedHash:'linked'}};
  assert.equal(validateProbeEvidence(producer,receiver,release).ok,false);
  const records=[...producer,{kind:'release',sourceHash:'source',linkedHash:'linked'},
    {kind:'host-control',value:.17},{kind:'initial-frame',sourceHash:'source',frameId:'1',controlSequence:0,intensity:.17}];
  assert.equal(validateProbeEvidence(records,receiver,release).ok,true);
  assert.equal(validateProbeEvidence([...records.slice(0,-1),{...records.at(-1),intensity:.65}],receiver,release).ok,false);
});
test('short GPU diagnostic requires both producer completion and receiver consumption', () => {
  assert.equal(validateProbeEvidence(producer, receiver).ok, true);
  assert.equal(validateProbeEvidence(producer, []).ok, false);
  assert.equal(validateProbeEvidence([], receiver).ok, false);
  assert.equal(validateProbeEvidence(producer, [...receiver,{kind:'failure',reason:'cleanup'}]).ok, false);
});

test('host evidence rejects replacement contexts, resets and wrong producer attachment', () => {
  const initial = {callbacks:10,consumed:2};
  const events = [{kind:'attached',producerPid:42},{kind:'counters',callbacks:20,consumed:8}];
  assert.equal(validateResolumeEvidence(producer,events,{pid:42,code:0},initial).ok,true);
  for (const extra of [{kind:'context'},{kind:'context-host-snapshot'},{kind:'counters',callbacks:21,consumed:0},
    {kind:'failure'}, {kind:'counters',callbacks:19,consumed:9}]) {
    assert.equal(validateResolumeEvidence(producer,[...events,extra],{pid:42,code:0},initial).ok,false);
  }
  assert.equal(validateResolumeEvidence(producer,events,{pid:43,code:0},initial).ok,false);
  assert.equal(validateResolumeEvidence(producer,events,{pid:42,code:2},initial).ok,false);
});
test('incomplete ownership, worker failure and telemetry loss cannot pass', () => {
  for (const invalid of [{held:1},{uncertain:1},{dropped:1},{failed:true},{webgpuReady:false},{closed:false},{paint:0}]) {
    assert.equal(validateProbeEvidence([{...producer[0],...invalid}],receiver).ok,false);
  }
});

test('a single delivered frame is not continuing transport', () => {
  assert.equal(validateProbeEvidence([{...producer[0],paint:1}],receiver).ok,false);
  assert.equal(validateProbeEvidence(producer,[receiver[0],{kind:'counters',consumed:1}]).ok,false);
  assert.equal(validateResolumeEvidence(producer,[{kind:'attached',producerPid:42},
    {kind:'counters',callbacks:20,consumed:3}],{pid:42,code:0},{callbacks:10,consumed:2}).ok,false);
});
