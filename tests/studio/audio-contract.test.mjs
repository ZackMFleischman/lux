import test from 'node:test';
import assert from 'node:assert/strict';

const contract = () => import('../../apps/studio/src/audio/audio-contract.mjs');

test('portable audio source normalizes one bounded primary input configuration', async () => {
  const { normalizeAudioBandSource } = await contract();
  const source = normalizeAudioBandSource({
    kind: 'audio-band',
    logicalInputId: 'primary-audio',
    band: 'bass',
    analyzer: { version: 1, fftSize: 2048, minDecibels: -100, maxDecibels: -30 },
  });

  assert.deepEqual(source, {
    kind: 'audio-band',
    logicalInputId: 'primary-audio',
    band: 'bass',
    analyzer: { version: 1, fftSize: 2048, minDecibels: -100, maxDecibels: -30 },
  });
  assert.ok(Object.isFrozen(source));
  assert.ok(Object.isFrozen(source.analyzer));
});

test('portable audio source rejects extra fields and unsupported identity or analyzer bounds', async () => {
  const { normalizeAudioBandSource } = await contract();
  const valid = {
    kind: 'audio-band', logicalInputId: 'primary-audio', band: 'highs',
    analyzer: { version: 1, fftSize: 2048, minDecibels: -100, maxDecibels: -30 },
  };

  assert.throws(() => normalizeAudioBandSource({ ...valid, deviceId: 'private-device' }), /Invalid audio band source/);
  assert.throws(() => normalizeAudioBandSource({ ...valid, logicalInputId: 'microphone-2' }), /Invalid logical audio input/);
  assert.throws(() => normalizeAudioBandSource({ ...valid, band: 'kick' }), /Invalid audio band/);
  assert.throws(() => normalizeAudioBandSource({ ...valid, analyzer: { ...valid.analyzer, fftSize: 4096 } }), /Invalid audio analyzer/);
  assert.throws(() => normalizeAudioBandSource({ ...valid, analyzer: { ...valid.analyzer, minDecibels: -121 } }), /Invalid audio analyzer/);
  assert.throws(() => normalizeAudioBandSource({ ...valid, analyzer: { ...valid.analyzer, maxDecibels: 1 } }), /Invalid audio analyzer/);
  assert.throws(() => normalizeAudioBandSource({ ...valid, analyzer: { ...valid.analyzer, minDecibels: -40, maxDecibels: -35 } }), /Invalid audio analyzer/);
});

test('portable kick source reuses the exact shared analyzer configuration', async () => {
  const { normalizeAudioKickSource } = await contract();
  const source = normalizeAudioKickSource({kind:'audio-kick',logicalInputId:'primary-audio',analyzer:{version:1,fftSize:2048,minDecibels:-100,maxDecibels:-30}});
  assert.deepEqual(source,{kind:'audio-kick',logicalInputId:'primary-audio',analyzer:{version:1,fftSize:2048,minDecibels:-100,maxDecibels:-30}});
  assert.throws(()=>normalizeAudioKickSource({...source,deviceId:'private'}),/Invalid audio kick source/);
});

test('audio snapshots require bounded latched kick identity and clear it when unavailable', async () => {
  const { normalizeAudioBandSnapshot } = await contract();
  const snapshot={generation:2,sequence:4,available:true,level:.1,bass:.2,mids:.3,highs:.4,kickSequence:1,kickStrength:.8};
  assert.deepEqual(normalizeAudioBandSnapshot(snapshot),snapshot);
  assert.throws(()=>normalizeAudioBandSnapshot({...snapshot,kickSequence:Number.MAX_SAFE_INTEGER+1}),/Invalid audio band snapshot/);
  assert.throws(()=>normalizeAudioBandSnapshot({...snapshot,available:false,level:0,bass:0,mids:0,highs:0}),/Invalid audio band snapshot/);
});

test('local device identity is validated separately from portable configuration', async () => {
  const { normalizeLocalAudioDeviceId } = await contract();

  assert.equal(normalizeLocalAudioDeviceId(undefined), undefined);
  assert.equal(normalizeLocalAudioDeviceId('device-1'), 'device-1');
  assert.throws(() => normalizeLocalAudioDeviceId(''), /Invalid local audio device/);
  assert.throws(() => normalizeLocalAudioDeviceId('x'.repeat(513)), /Invalid local audio device/);
});
