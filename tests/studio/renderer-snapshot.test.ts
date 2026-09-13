import test from 'node:test';
import assert from 'node:assert/strict';
import { createRendererSnapshot } from '../../apps/studio/src/renderer-snapshot.ts';
import type { StudioSnapshot } from '../../apps/studio/src/service-client.ts';

function fixture() {
  let snapshot: StudioSnapshot = { connection: 'connected', message: null, receivedAtMs: 0,
    authoring: { instanceId: 'owner', generation: 1, revisionId: 'revision', sceneName: 'Fixture', authority: 'studio',
      playback: 'playing', clockEpoch: 0, frameId: '0', intensity: 0.5, output: { width: 1920, height: 1080 }, fault: null },
    host: null, jobs: [], visualFps: null, uiFps: null };
  const listeners = new Set<() => void>();
  const client = { getSnapshot: () => snapshot, subscribe: (listener: () => void) => {
    listeners.add(listener); return () => { listeners.delete(listener); };
  }, invoke: async () => ({}) };
  return { client, listeners, publish(patch: Partial<StudioSnapshot>) {
    snapshot = { ...snapshot, ...patch }; for (const listener of listeners) listener(); return snapshot;
  } };
}

test('renderer coalesces frame observations, caches reads and publishes latest within 100 ms', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const source = fixture(), view = createRendererSnapshot(source.client);
  const initial = view.getSnapshot(); let notifications = 0;
  const off = view.subscribe(() => { notifications++; });
  for (let frame = 1; frame <= 60; frame++) {
    source.publish({ receivedAtMs: frame, authoring: { ...initial.authoring!, frameId: String(frame) },
      visualFps: { value: 60, sampledAtMs: frame, coverage: 1 } });
    assert.equal(view.getSnapshot(), initial, 'React consistency checks must see the cached UI snapshot');
  }
  assert.equal(source.client.getSnapshot().authoring!.frameId, '60', 'raw state remains exact');
  assert.equal(notifications, 0);
  context.mock.timers.tick(99); assert.equal(notifications, 0);
  context.mock.timers.tick(1); assert.equal(notifications, 1);
  assert.equal(view.getSnapshot(), source.client.getSnapshot());
  context.mock.timers.tick(1000); assert.equal(notifications, 1, 'no polling while idle');
  off();
});

test('control, transport, owner, fault and jobs changes bypass pending frame delay', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const source = fixture(), view = createRendererSnapshot(source.client);
  let notifications = 0; const off = view.subscribe(() => { notifications++; });
  const patches: Partial<StudioSnapshot>[] = [
    { authoring: { ...source.client.getSnapshot().authoring!, sdkVersion: '0.1.0', intensity: 0.8 } },
    { authoring: { ...source.client.getSnapshot().authoring!, playback: 'paused' } },
    { authoring: { ...source.client.getSnapshot().authoring!, generation: 2 } },
    { authoring: { ...source.client.getSnapshot().authoring!, playback: 'failed', fault: { code: 'FAULT', message: 'Lost device' } } },
    { jobs: [{ jobId: 'job', state: 'failed', summary: 'Build failed' }] },
    { connection: 'disconnected', authoring: null },
  ];
  for (const patch of patches) {
    source.publish({ receivedAtMs: 10 });
    const next = source.publish(patch);
    assert.equal(view.getSnapshot(), next);
  }
  assert.equal(notifications, patches.length);
  context.mock.timers.tick(100); assert.equal(notifications, patches.length, 'cancelled observations cannot overwrite urgent state');
  off();
});

test('last unsubscribe cancels timer; reattachment catches up without leaking source listeners', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const source = fixture(), view = createRendererSnapshot(source.client);
  let notifications = 0; const off = view.subscribe(() => { notifications++; });
  source.publish({ receivedAtMs: 2 }); off();
  assert.equal(source.listeners.size, 0);
  context.mock.timers.tick(100); assert.equal(notifications, 0);
  source.publish({ authoring: null });
  const detach = view.subscribe(() => { notifications++; });
  assert.equal(source.listeners.size, 1); assert.equal(view.getSnapshot(), source.client.getSnapshot());
  assert.equal(notifications, 1); detach();
});
