import test from 'node:test';
import assert from 'node:assert/strict';

const providerModule = () => import('../../apps/studio/src/audio/studio-audio-provider.mjs');
const configuration = Object.freeze({
  logicalInputId: 'primary-audio',
  analyzer: Object.freeze({ version: 1, fftSize: 2048, minDecibels: -100, maxDecibels: -30 }),
});
const zero = generation => ({ generation, sequence: 0, available: false, level: 0, bass: 0, mids: 0, highs: 0, kickSequence:0, kickStrength:0 });

function eventResource(properties = {}) {
  const target = new EventTarget();
  return Object.assign(target, properties);
}

function captureFixture() {
  let stops = 0, closes = 0;
  const track = eventResource({ stop() { stops++; } });
  const stream = { getTracks: () => [track] };
  const context = eventResource({
    state: 'running', sampleRate: 48000,
    async close() { closes++; this.state = 'closed'; },
  });
  return { stream, context, track, stops: () => stops, closes: () => closes };
}

function manualScheduler() {
  let next = 0;
  const callbacks = new Map();
  return {
    request(callback) { const id = ++next; callbacks.set(id, callback); return id; },
    cancel(id) { callbacks.delete(id); },
    tick() { const entry = callbacks.entries().next().value; assert.ok(entry, 'sampling callback must be scheduled'); callbacks.delete(entry[0]); entry[1](16); },
    size: () => callbacks.size,
  };
}

test('explicit connect owns one capture while subscriptions only control sampling', async () => {
  const { createStudioAudioProvider } = await providerModule();
  const capture = captureFixture(), scheduler = manualScheduler();
  let opens = 0, analyzerDisposals = 0, sample = 0;
  const provider = createStudioAudioProvider({
    openCapture: async request => { opens++; assert.deepEqual(request, { configuration, localDeviceId: 'device-1' }); return capture; },
    createAnalyzer: () => ({
      sample: () => ({ level: ++sample / 10, bass: 0.2, mids: 0.3, highs: 0.4, kickStrength:0 }),
      dispose: () => { analyzerDisposals++; },
    }),
    scheduler,
  });

  const unsubscribeBeforeConnect = provider.subscribe(() => {});
  assert.equal(opens, 0);
  assert.equal(scheduler.size(), 0);
  unsubscribeBeforeConnect();

  await provider.connect(configuration, 'device-1');
  assert.equal(opens, 1);
  assert.deepEqual(provider.getSnapshot(), { generation: 1, sequence: 0, available: true, level: 0, bass: 0, mids: 0, highs: 0, kickSequence:0, kickStrength:0 });
  await provider.connect(configuration, 'device-1');
  assert.equal(opens, 1, 'the exact active connection is reused');

  const unsubscribe = provider.subscribe(() => {});
  assert.equal(scheduler.size(), 1);
  scheduler.tick();
  assert.deepEqual(provider.getSnapshot(), { generation: 1, sequence: 1, available: true, level: 0.1, bass: 0.2, mids: 0.3, highs: 0.4, kickSequence:0, kickStrength:0 });
  assert.equal(scheduler.size(), 1);
  unsubscribe();
  assert.equal(scheduler.size(), 0);
  assert.equal(capture.stops(), 0, 'unsubscribing does not release explicit capture');

  await provider.disconnect();
  assert.deepEqual(provider.getSnapshot(), zero(2));
  assert.equal(capture.stops(), 1);
  assert.equal(capture.closes(), 1);
  assert.equal(analyzerDisposals, 1);
  await provider.disconnect();
  assert.equal(capture.stops(), 1, 'cleanup is idempotent');
});

test('a stale connect completion cleans its resources without publishing', async () => {
  const { createStudioAudioProvider } = await providerModule();
  const capture = captureFixture();
  let resolveCapture;
  const provider = createStudioAudioProvider({
    openCapture: () => new Promise(resolve => { resolveCapture = resolve; }),
    createAnalyzer: () => { throw new Error('stale capture must not create an analyzer'); },
    scheduler: manualScheduler(),
  });

  const connecting = provider.connect(configuration);
  assert.deepEqual(provider.getSnapshot(), zero(1));
  await provider.disconnect();
  resolveCapture(capture);
  await connecting;

  assert.deepEqual(provider.getSnapshot(), zero(2));
  assert.equal(capture.stops(), 1);
  assert.equal(capture.closes(), 1);
});

test('track end publishes unavailable zero before idempotent owned cleanup', async () => {
  const { createStudioAudioProvider } = await providerModule();
  const capture = captureFixture(), scheduler = manualScheduler();
  let analyzerDisposals = 0;
  const provider = createStudioAudioProvider({
    openCapture: async () => capture,
    createAnalyzer: () => ({ sample: () => ({ level: 1, bass: 1, mids: 1, highs: 1, kickStrength:0 }), dispose: () => { analyzerDisposals++; } }),
    scheduler,
  });
  await provider.connect(configuration);
  const unsubscribe = provider.subscribe(() => {});
  scheduler.tick();
  assert.equal(provider.getSnapshot().available, true);

  capture.track.dispatchEvent(new Event('ended'));
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(provider.getSnapshot(), zero(2));
  assert.equal(capture.stops(), 1);
  assert.equal(capture.closes(), 1);
  assert.equal(analyzerDisposals, 1);
  assert.equal(scheduler.size(), 0);
  unsubscribe();
});

test('interrupted audio context publishes unavailable zero and requires a new connect', async () => {
  const { createStudioAudioProvider } = await providerModule();
  const capture = captureFixture();
  let opens = 0;
  const provider = createStudioAudioProvider({
    openCapture: async () => { opens++; return capture; },
    createAnalyzer: () => ({ sample: () => ({ level: 0, bass: 0, mids: 0, highs: 0, kickStrength:0 }), dispose() {} }),
    scheduler: manualScheduler(),
  });
  await provider.connect(configuration);

  capture.context.state = 'interrupted';
  capture.context.dispatchEvent(new Event('statechange'));
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(provider.getSnapshot(), zero(2));
  assert.equal(capture.stops(), 1);
  assert.equal(capture.closes(), 1);
  assert.equal(opens, 1);
});

test('switching analyzer configuration closes the old capture before opening the new one', async () => {
  const { createStudioAudioProvider } = await providerModule();
  const first = captureFixture(), second = captureFixture(), order = [];
  const nextConfiguration = { ...configuration, analyzer: { ...configuration.analyzer, minDecibels: -90 } };
  let attempt = 0;
  const provider = createStudioAudioProvider({
    openCapture: async () => { order.push(`open-${++attempt}`); return attempt === 1 ? first : second; },
    createAnalyzer: (_context, stream) => ({ sample: () => ({ level: 0, bass: 0, mids: 0, highs: 0, kickStrength:0 }),
      dispose: () => order.push(stream === first.stream ? 'dispose-1' : 'dispose-2') }),
    scheduler: manualScheduler(),
  });

  await provider.connect(configuration);
  await provider.connect(nextConfiguration);

  assert.deepEqual(order, ['open-1', 'dispose-1', 'open-2']);
  assert.equal(first.stops(), 1);
  assert.equal(first.closes(), 1);
  assert.equal(second.stops(), 0);
  assert.equal(provider.getSnapshot().generation, 2);
  await provider.dispose();
});

test('kick peak increments once and remains latched through weaker tail samples', async()=>{
  const {createStudioAudioProvider}=await providerModule();
  const capture=captureFixture(),scheduler=manualScheduler();
  const samples=[
    {level:.2,bass:.8,mids:0,highs:0,kickStrength:.9},
    {level:.2,bass:.6,mids:0,highs:0,kickStrength:0},
    {level:.1,bass:.3,mids:0,highs:0,kickStrength:0},
  ];
  const provider=createStudioAudioProvider({openCapture:async()=>capture,createAnalyzer:()=>({sample:()=>samples.shift(),dispose(){}}),scheduler});
  await provider.connect(configuration);const off=provider.subscribe(()=>{});
  scheduler.tick();assert.equal(provider.getSnapshot().kickSequence,1);assert.equal(provider.getSnapshot().kickStrength,.9);
  scheduler.tick();scheduler.tick();
  assert.equal(provider.getSnapshot().kickSequence,1);assert.equal(provider.getSnapshot().kickStrength,.9);
  off();await provider.dispose();
});
