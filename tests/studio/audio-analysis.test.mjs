import test from 'node:test';
import assert from 'node:assert/strict';

const analysis = () => import('../../apps/studio/src/audio/audio-analysis.mjs');
const config = Object.freeze({ version: 1, fftSize: 2048, minDecibels: -100, maxDecibels: -20 });

test('band analysis separates bass, mids, and highs with hand-derived full-scale fixtures', async () => {
  const { analyzeAudioFrame } = await analysis();
  const time = new Float32Array(2048).fill(0.25);
  const frequency = new Float32Array(1024).fill(-100);
  for (let index = 1; index <= 10; index++) frequency[index] = -20;

  assert.deepEqual(analyzeAudioFrame(time, frequency, 48000, config), {
    level: 0.25, bass: 1, mids: 0, highs: 0,
  });

  frequency.fill(-100);
  for (let index = 11; index <= 85; index++) frequency[index] = -20;
  assert.deepEqual(analyzeAudioFrame(time, frequency, 48000, config), {
    level: 0.25, bass: 0, mids: 1, highs: 0,
  });

  frequency.fill(-100);
  for (let index = 86; index < frequency.length; index++) frequency[index] = -20;
  assert.deepEqual(analyzeAudioFrame(time, frequency, 48000, config), {
    level: 0.25, bass: 0, mids: 0, highs: 1,
  });
});

test('band analysis rejects mismatched buffers and non-finite samples', async () => {
  const { analyzeAudioFrame } = await analysis();
  const time = new Float32Array(2048);
  const frequency = new Float32Array(1024).fill(-100);

  assert.throws(() => analyzeAudioFrame(new Float32Array(1024), frequency, 48000, config), /Invalid audio time-domain frame/);
  assert.throws(() => analyzeAudioFrame(time, new Float32Array(2048), 48000, config), /Invalid audio frequency frame/);
  time[3] = Number.NaN;
  assert.throws(() => analyzeAudioFrame(time, frequency, 48000, config), /Invalid audio sample/);
});

test('Web Audio analyzer disables built-in smoothing and disconnects only owned nodes', async () => {
  const { createWebAudioBandAnalyzer } = await analysis();
  let sourceDisconnects = 0, analyzerDisconnects = 0;
  const analyzerNode = {
    fftSize: 32, minDecibels: -40, maxDecibels: -10, smoothingTimeConstant: 0.8,
    frequencyBinCount: 1024,
    getFloatTimeDomainData(buffer) { buffer.fill(0.5); },
    getFloatFrequencyData(buffer) { buffer.fill(-100); },
    disconnect() { analyzerDisconnects++; },
  };
  const sourceNode = {
    connected: null,
    connect(node) { this.connected = node; },
    disconnect() { sourceDisconnects++; },
  };
  const context = {
    sampleRate: 48000,
    createMediaStreamSource(stream) { assert.equal(stream, 'owned-stream'); return sourceNode; },
    createAnalyser() { return analyzerNode; },
  };
  const analyzer = createWebAudioBandAnalyzer(context, 'owned-stream', config);

  assert.equal(analyzerNode.fftSize, 2048);
  assert.equal(analyzerNode.minDecibels, -100);
  assert.equal(analyzerNode.maxDecibels, -20);
  assert.equal(analyzerNode.smoothingTimeConstant, 0);
  assert.equal(sourceNode.connected, analyzerNode);
  const {spectrum,...bands}=analyzer.sample(0);
  assert.deepEqual(bands, { level: 0.5, bass: 0, mids: 0, highs: 0, kickStrength: 0 });
  assert.equal(spectrum.magnitudes.length,128);assert.ok(spectrum.magnitudes.every(value=>value===0));

  analyzer.dispose();
  analyzer.dispose();
  assert.equal(sourceDisconnects, 1);
  assert.equal(analyzerDisconnects, 1);
});

test('kick detector emits one local peak for a sustained onset and ignores silence and steady noise', async () => {
  const { createKickTransientDetector } = await analysis();
  const detector = createKickTransientDetector();
  assert.equal(detector.sample(0, 0), 0);
  assert.equal(detector.sample(0, 16), 0);
  assert.equal(detector.sample(.8, 32), 0);
  assert.ok(Math.abs(detector.sample(.8, 48) - .8) < 1e-12);
  assert.equal(detector.sample(.8, 64), 0);
  assert.equal(detector.sample(.7, 80), 0);
  detector.reset();
  assert.equal(detector.sample(.1, 0), 0);
  assert.equal(detector.sample(.11, 16), 0);
  assert.equal(detector.sample(.09, 32), 0);
  assert.equal(detector.sample(.1, 48), 0);
});

test('kick detector rearms below hysteresis and emits two separated onsets', async () => {
  const { createKickTransientDetector } = await analysis();
  const detector = createKickTransientDetector();
  const emitted = [];
  for (const [bass, time] of [[0,0],[.9,16],[.8,32],[0,48],[0,64],[.7,80],[.5,96]]) {
    const value = detector.sample(bass, time);
    if (value) emitted.push(value);
  }
  assert.equal(emitted.length, 2);
  assert.ok(emitted[0] > emitted[1]);
  assert.throws(() => detector.sample(.2, 95), /Invalid kick detector time/);
});

test('kick detector retains an equal-score plateau and emits its strong peak before a weaker tail', async () => {
  const { createKickTransientDetector } = await analysis();
  const detector = createKickTransientDetector();
  assert.equal(detector.sample(0, 0), 0);
  assert.equal(detector.sample(.9, 0), 0);
  assert.equal(detector.sample(.9, 0), 0, 'equal score keeps tracking the same episode');
  assert.ok(Math.abs(detector.sample(.5, 16) - .9) < 1e-12);
});
