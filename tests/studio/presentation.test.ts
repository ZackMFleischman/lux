import test from 'node:test';
import assert from 'node:assert/strict';
import { PreviewBinding } from '../../apps/studio/src/presentation.ts';

test('moving presentation retires only consumers and preserves the runtime key', async () => {
  const events: string[] = [];
  const keys: unknown[] = [];
  const binding = new PreviewBinding<string>({ attach: async ({ target, runtimeKey }) => {
    events.push(`attach:${target}`); keys.push(runtimeKey);
    return { detach: async () => { events.push(`detach:${target}`); } };
  } });
  const key = { instanceId: 'runtime-1', generation: 6 };
  await binding.move('docked', key);
  await binding.move('detached', key);
  await binding.close();
  await binding.close();
  assert.deepEqual(events, ['attach:docked', 'detach:docked', 'attach:detached', 'detach:detached']);
  assert.deepEqual(keys, [key, key]);
});

test('attachment completing after close is retired rather than leaked or presented', async () => {
  let resolveAttach!: (lease: { detach(): Promise<void> }) => void;
  let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  let releases = 0;
  const binding = new PreviewBinding<string>({ attach: async () => {
    started(); return new Promise(resolve => { resolveAttach = resolve; });
  } });
  const moving = binding.move('window', { instanceId: 'runtime-1', generation: 6 });
  await entered;
  const closing = binding.close();
  resolveAttach({ detach: async () => { releases++; } });
  await Promise.all([moving, closing]);
  assert.equal(releases, 1);
});

test('a failed detach never attaches a second consumer over uncertain ownership', async () => {
  let attaches = 0;
  const binding = new PreviewBinding<string>({ attach: async () => {
    attaches++; return { detach: async () => { throw Error('detach unavailable'); } };
  } });
  await binding.move('first', { instanceId: 'runtime-1', generation: 1 });
  await assert.rejects(binding.move('second', { instanceId: 'runtime-1', generation: 1 }), /detach unavailable/);
  assert.equal(attaches, 1);
});
