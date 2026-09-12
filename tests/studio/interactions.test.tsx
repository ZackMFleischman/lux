import test, { afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { StudioClient, StudioOperation, StudioSnapshot } from '../../apps/studio/src/service-client.ts';
import type { WindowState } from '../../apps/studio/src/window-client.ts';

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

test('RTL: pending playback preserves button styling and ignores duplicate transport commands', async () => {
  const fixture = service(), user = userEvent.setup({ document });
  let finishPlay!: () => void, finishIntensity!: () => void;
  fixture.client.invoke = operation => {
    fixture.calls.push(operation);
    return new Promise(resolve => {
      if (operation.name === 'lux.playback') finishPlay = () => resolve({});
      else finishIntensity = () => resolve({});
    });
  };
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  await user.click(screen.getByRole('button', { name: 'Play' }));
  fireEvent.change(screen.getByRole('slider'), { target: { value: '0.8' } });
  await waitFor(() => assert.equal(fixture.calls.length, 2));
  assert.equal(document.querySelector('.playback-state')?.textContent, 'paused');
  await act(async () => finishIntensity());
  assert.equal((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled, false);
  assert.equal((screen.getByRole('button', { name: 'Restart runtime' }) as HTMLButtonElement).disabled, false);
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  fireEvent.click(screen.getByRole('button', { name: 'Restart runtime' }));
  assert.equal(fixture.calls.length, 2);
  await act(async () => finishPlay());
  assert.equal((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled, false);
  assert.equal(document.querySelector('.playback-state')?.textContent, 'paused');
  await act(async () => fixture.update());
  assert.equal(document.querySelector('.playback-state')?.textContent, 'playing');
});

test('RTL: intensity writes do not disable transport or insert a success alert', async () => {
  const fixture = service(); let finish!: () => void;
  fixture.client.invoke = operation => { fixture.calls.push(operation); return new Promise(resolve => { finish = () => resolve({}); }); };
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  fireEvent.change(screen.getByRole('slider'), { target: { value: '0.8' } });
  await waitFor(() => assert.equal(fixture.calls.length, 1));
  for (const name of ['Play', 'Reset', 'Restart runtime']) assert.equal((screen.getByRole('button', { name }) as HTMLButtonElement).disabled, false);
  assert.equal(screen.queryByText('Sending request…'), null);
  await act(async () => finish());
  assert.equal(screen.queryByText('Request accepted. Awaiting applied runtime status.'), null);
  assert.equal(screen.queryByRole('alert'), null);
});

test('RTL: Escape exits native fullscreen even before its state notification arrives', async () => {
  const values: boolean[] = [];
  const windows = { getState: async () => ({ detached: false, fullscreen: false }), subscribe: () => () => {},
    popout: async () => {}, dock: async () => {}, fullscreen: async (value: boolean) => { values.push(value); } };
  render(<StudioApp client={createDisconnectedClient()} windows={windows} nowMs={1000} />);
  await userEvent.setup({ document }).keyboard('{Escape}');
  assert.deepEqual(values, [false]);
});

test('RTL: fullscreen shows only preview, ignores stale initial state, and exits on first Escape', async () => {
  let notify!: (state: WindowState) => void, initial!: (state: WindowState) => void;
  const windows = {
    getState: () => new Promise<WindowState>(resolve => { initial = resolve; }),
    subscribe: (listener: (state: WindowState) => void) => { notify = listener; return () => {}; },
    popout: async () => {}, dock: async () => {},
    fullscreen: async (fullscreen: boolean) => { notify({ detached: false, fullscreen }); },
  };
  const { container } = render(<StudioApp client={service().client} windows={windows} nowMs={1000} />);
  const surface = container.querySelector('.preview-surface');
  fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
  assert.ok(container.querySelector('.studio-preview-fullscreen'));
  assert.equal(screen.queryByRole('button', { name: 'Play' }), null);
  assert.equal(screen.queryByRole('slider'), null);
  assert.ok(screen.getByText('Press Escape to exit fullscreen'));
  await act(async () => initial({ detached: false, fullscreen: false }));
  assert.ok(container.querySelector('.studio-preview-fullscreen'));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 3600)); });
  assert.equal(screen.queryByText('Press Escape to exit fullscreen'), null);
  fireEvent.keyDown(window, { key: 'Escape' });
  assert.equal(container.querySelector('.studio-preview-fullscreen'), null);
  assert.ok(screen.getByRole('button', { name: 'Fullscreen' }));
  assert.equal(container.querySelector('.preview-surface'), surface);
});
