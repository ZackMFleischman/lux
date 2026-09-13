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
test('a failed producer retries once and remains failed after the second fault in 30 seconds', async () => {
  let starts = 0;
  const registry = new InstanceRegistry({runtimeId, start: async () => { starts++; throw Error('missing package'); }});
  for (const time of [0, 100, 1000, 3000, 9000, 20000]) await registry.reconcile([request('1'.repeat(32))], time);
  assert.equal(starts, 2);
  assert.match(registry.errors.get('1'.repeat(32)), /missing package/);
  await registry.close();
});
test('healthy generations retain fault history, renew retry eligibility after 30 seconds, and removal resets policy',async()=>{
 let starts=0;const producers=[];
 const registry=new InstanceRegistry({runtimeId,start:async()=>{starts++;const producer={exited:false,stop:async()=>{}};producers.push(producer);return producer;}});
 const lease=request('1'.repeat(32));await registry.reconcile([lease],0);
 producers[0].exited=true;await registry.reconcile([lease],100);await registry.entries.get(lease.instanceId).stopping;await registry.reconcile([lease],350);assert.equal(starts,2);
 producers[1].exited=true;await registry.reconcile([lease],30099);await registry.entries.get(lease.instanceId).stopping;await registry.reconcile([lease],40000);assert.equal(starts,2,'second fault less than 30s suppresses despite successful restart');
 await registry.reconcile([],40001);await Promise.resolve();await registry.reconcile([lease],40002);assert.equal(starts,3,'deliberate removal/re-attach resets the instance policy');
 producers[2].exited=true;await registry.reconcile([lease],40100);await registry.entries.get(lease.instanceId).stopping;await registry.reconcile([lease],40350);assert.equal(starts,4);
 producers[3].exited=true;await registry.reconcile([lease],70100);await registry.entries.get(lease.instanceId).stopping;await registry.reconcile([lease],70350);assert.equal(starts,5,'fault at exactly 30s permits a fresh automatic retry');
 await registry.close();
});
test('invalid and backward clocks cannot bypass suppressed recovery',async()=>{
 let starts=0;const registry=new InstanceRegistry({runtimeId,start:async()=>{starts++;throw Error('failed');}}),lease=request('1'.repeat(32));
 await registry.reconcile([lease],10);await registry.reconcile([lease],260);
 for(const now of [NaN,Infinity,-1,259])await assert.rejects(registry.reconcile([lease],now),/monotonic/);
 await registry.reconcile([lease],40000);assert.equal(starts,2);await registry.close();
});
