const test = require('node:test');
const assert = require('node:assert/strict');
const { InstanceRegistry, validateRequest, sameInstalledPath } = require('../../apps/installed-runtime/src/registry.cjs');
const runtimeId = 'a'.repeat(64), releaseId = 'b'.repeat(64);
const request = instanceId => ({ version: 1, runtimeId, releaseId, instanceId, hostPid: 42 });
test('installed Windows paths tolerate casing while rejecting a different directory', () => {
  assert.equal(sameInstalledPath('C:/Users/Author/Lux/Installed', 'c:/users/author/lux/installed'), true);
  assert.equal(sameInstalledPath('C:/Users/Author/Lux/Installed', 'C:/Users/Other/Lux/Installed'), false);
});
test('installed copies own independent producers and removal stops only its producer', async () => {
  const stopped = [], started = [];
  const registry = new InstanceRegistry({runtimeId, start: async value => { started.push(value); return {stop: async () => stopped.push(value.instanceId)}; }});
  await registry.reconcile([request('1'.repeat(32)), request('2'.repeat(32))], 0);
  assert.equal(started.length, 2);
  await registry.reconcile([request('2'.repeat(32))], 10);
  assert.deepEqual(stopped, ['1'.repeat(32)]);
  assert.equal(started.length, 2);
  await registry.close(); assert.deepEqual(stopped, ['1'.repeat(32), '2'.repeat(32)]);
});
test('installed admission rejects traversal, identity changes and bounds simultaneous activation', async () => {
  assert.throws(() => validateRequest({...request('../escape'), runtimeId}, runtimeId));
  assert.throws(() => validateRequest({...request('1'.repeat(32)), runtimeId: 'c'.repeat(64)}, runtimeId));
  const registry = new InstanceRegistry({runtimeId, limit: 1, start: async () => ({stop: async () => {}})});
  await registry.reconcile([request('1'.repeat(32)), request('2'.repeat(32))], 0);
  assert.equal(registry.entries.size, 1);
  assert.match(registry.errors.get('2'.repeat(32)), /capacity/);
  await registry.reconcile([{...request('1'.repeat(32)), releaseId: 'c'.repeat(64)}], 1);
  assert.match(registry.errors.get('1'.repeat(32)), /identity/);
  await registry.close();
});
test('a failed producer retries with backoff and stops after three attempts', async () => {
  let starts = 0;
  const registry = new InstanceRegistry({runtimeId, start: async () => { starts++; throw Error('missing package'); }});
  for (const time of [0, 100, 1000, 3000, 9000, 20000]) await registry.reconcile([request('1'.repeat(32))], time);
  assert.equal(starts, 3);
  assert.match(registry.errors.get('1'.repeat(32)), /missing package/);
  await registry.close();
});
