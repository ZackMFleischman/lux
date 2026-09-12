const test = require('node:test'), assert = require('node:assert/strict');
const { ProducerHealth, InstanceRegistry } = require('../../apps/installed-runtime/src/registry.cjs');
const attemptId = 'a'.repeat(32);
const status = (sequence, patch = {}) => ({ version: 1, attemptId, sequence, ready: true, frameId: '1', completedFrames: 1, backpressureFrames: 0, ...patch });
test('external startup deadline expires despite a responsive main that never publishes a first frame', () => {
  const health = new ProducerHealth({ attemptId, startedAt: 0 });
  for (let now = 0; now <= 15000; now += 250) health.observe(status(now + 1, { ready: false, frameId: '0', completedFrames: 0 }), now);
  assert.match(health.failure(15000), /startup/);
});
test('main heartbeat and advancing worker/published frames have independent external deadlines', () => {
  const missing = new ProducerHealth({ attemptId, startedAt: 0 }); missing.observe(status(1), 100);
  assert.match(missing.failure(2600), /main heartbeat/);
  const worker = new ProducerHealth({ attemptId, startedAt: 0 }); worker.observe(status(1), 100);
  for (let now = 1100; now < 4100; now += 1000) worker.observe(status(now, { completedFrames: now }), now);
  assert.match(worker.failure(4100), /Visual frame/);
  const compositor = new ProducerHealth({ attemptId, startedAt: 0 }); compositor.observe(status(1), 100);
  for (let now = 1100; now < 4100; now += 1000) compositor.observe(status(now, { frameId: String(now) }), now);
  assert.match(compositor.failure(4100), /Published output/);
  const healthy = new ProducerHealth({ attemptId, startedAt: 0 });
  for (let now = 0; now <= 20000; now += 250) { healthy.observe(status(now + 1, { frameId: String(now + 1), completedFrames: now + 1 }), now); assert.equal(healthy.failure(now), null); }
});
test('old attempts, replayed sequences and malformed samples cannot renew a producer', () => {
  const health = new ProducerHealth({ attemptId, startedAt: 0 }); health.observe(status(1), 100);
  for (const sample of [status(2, { attemptId: 'b'.repeat(32) }), status(1), status(2, { sequence: NaN }), status(2, { frameId: '-1' }), status(2, { completedFrames: -1 })])
    assert.equal(health.observe(sample, 2500), false);
  assert.match(health.failure(2600), /main heartbeat/);
});
test('confirmed receiver backpressure tolerates a non-consuming host without hiding a stalled visual', () => {
  const health = new ProducerHealth({ attemptId, startedAt: 0 }); health.observe(status(1), 0);
  for (let now = 250; now <= 10000; now += 250) {
    health.observe(status(now, { frameId: String(now), backpressureFrames: now }), now);
    assert.equal(health.failure(now), null);
  }
  for (let now = 10250; now < 14000; now += 250) health.observe(status(now, { frameId: '10000', backpressureFrames: now }), now);
  assert.match(health.failure(14000), /Visual frame/);
});
test('expiry stops only its Job, backs off and disposes even the third failed producer', async () => {
  const runtimeId = 'a'.repeat(64), releaseId = 'b'.repeat(64), bad = '1'.repeat(32), good = '2'.repeat(32);
  const request = instanceId => ({ version: 1, runtimeId, releaseId, instanceId, hostPid: 42 });
  const starts = [], stops = [];
  const registry = new InstanceRegistry({ runtimeId, start: async value => {
    starts.push(value.instanceId); return { exited: false, failure: () => value.instanceId === bad ? 'startup deadline' : null,
      stop: async options => { stops.push({ id: value.instanceId, force: options?.force }); } };
  } });
  for (const now of [0, 1, 500, 1001, 1002, 3002, 3003, 10000]) await registry.reconcile([request(bad), request(good)], now);
  assert.equal(starts.filter(id => id === bad).length, 3); assert.equal(starts.filter(id => id === good).length, 1);
  assert.deepEqual(stops, Array.from({ length: 3 }, () => ({ id: bad, force: true })));
  assert.equal(registry.entries.get(bad).producer, null); assert.match(registry.errors.get(bad), /startup/);
  await registry.reconcile([request(good)], 20000); assert.equal(registry.errors.has(bad), false);
  await registry.close(); assert.equal(stops.at(-1).id, good);
});
