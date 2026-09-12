import test, { afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { StudioClient, StudioOperation, StudioSnapshot } from '../../apps/studio/src/service-client.ts';

// jsdom models DOM events only. It starts no browser, Electron, canvas or GPU.
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://studio.test/' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'ShadowRoot', 'DocumentFragment', 'Event', 'KeyboardEvent', 'MouseEvent', 'getComputedStyle'] as const) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true });
const { render, screen, cleanup, waitFor, fireEvent, act } = await import('@testing-library/react');
const { userEvent } = await import('@testing-library/user-event');
const { StudioApp } = await import('../../apps/studio/src/renderer.tsx');
const { createDisconnectedClient } = await import('../../apps/studio/src/service-client.ts');
afterEach(() => cleanup());
after(() => dom.window.close());

function service() {
  let snapshot: StudioSnapshot = {
    connection: 'connected', message: null, receivedAtMs: 1000,
    authoring: { instanceId: '44ff55f0-8ea6-4fbf-89d5-665923f65cad', generation: 2,
      revisionId: 'revision-2', sceneName: 'Test fixture', authority: 'studio', playback: 'paused', clockEpoch: 1,
      frameId: '10', intensity: 0.5, output: { width: 1920, height: 1080 }, fault: null },
    host: null, jobs: [], visualFps: null, uiFps: null,
  };
  const calls: StudioOperation[] = [], listeners = new Set<() => void>();
  let fail = false;
  const client: StudioClient = {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    invoke: async operation => { calls.push(operation); if (fail) throw Error('Runtime unavailable. Retry after reconnecting.'); return { accepted: true }; },
  };
  return { client, calls, fail: () => { fail = true; }, update: () => {
    snapshot = { ...snapshot, authoring: { ...snapshot.authoring!, generation: 3, playback: 'playing' } };
    for (const listener of listeners) listener();
  } };
}

test('RTL: disconnected buttons and MUI slider refuse input while workspace remains operable', async () => {
  const user = userEvent.setup({ document });
  render(<StudioApp client={createDisconnectedClient()} nowMs={1000} />);
  assert.equal((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled, true);
  assert.equal((screen.getByRole('slider') as HTMLInputElement).disabled, true);
  await user.click(screen.getByRole('button', { name: 'Maximize' }));
  assert.ok(screen.getByRole('button', { name: 'Restore workspace' }));
  assert.ok(screen.getByRole('heading', { name: 'Awaiting runtime' }));
  await user.keyboard('{Escape}');
  assert.ok(screen.getByRole('button', { name: 'Maximize' }));
});

test('RTL: playback and intensity invoke guarded shared operations and wait for applied state', async () => {
  const fixture = service(), user = userEvent.setup({ document });
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  await user.click(screen.getByRole('button', { name: 'Play' }));
  await waitFor(() => assert.equal(fixture.calls.length, 1));
  assert.equal(fixture.calls[0]?.name, 'lux.playback');
  assert.equal(fixture.calls[0]?.input.expectedGeneration, 2);
  assert.equal((screen.getByRole('button', { name: 'Pause' }) as HTMLButtonElement).disabled, true);
  fireEvent.change(screen.getByRole('slider'), { target: { value: '0.8' } });
  await waitFor(() => assert.equal(fixture.calls.length, 2));
  const write = fixture.calls[1];
  assert.equal(write?.name, 'lux.parameters.set');
  if (write?.name === 'lux.parameters.set') assert.deepEqual(write.input.values, { intensity: 0.8 });
  assert.ok(screen.getByText('Applied value: 0.50'));
  await act(async () => fixture.update());
  await user.click(screen.getByRole('button', { name: 'Pause' }));
  await waitFor(() => assert.equal(fixture.calls.length, 3));
  assert.equal(fixture.calls[2]?.input.expectedGeneration, 3);
});

test('RTL: failed runtime command shows actionable error without a successful-state claim', async () => {
  const fixture = service(), user = userEvent.setup({ document }); fixture.fail();
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  await user.click(screen.getByRole('button', { name: 'Restart runtime' }));
  await waitFor(() => assert.match(screen.getByRole('alert').textContent ?? '', /Runtime unavailable/));
  assert.equal(screen.queryByText('Request accepted. Awaiting applied runtime status.'), null);
  assert.ok(screen.getByText('revision-2'));
});
