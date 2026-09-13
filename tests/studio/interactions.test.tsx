import test, { afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { StudioClient, StudioOperation, StudioSnapshot, RuntimeView } from '../../apps/studio/src/service-client.ts';
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

test('RTL: code-defined controls expose independent values, numeric entry and defaults without Intensity', async () => {
  const fixture = service();
  const schema = [
    { id: 'spikeHeight', type: 'number' as const, label: 'Spike height', min: 0, max: 4, default: 1, step: 0.1, changeCost: 'live' as const },
    { id: 'noiseScale', type: 'number' as const, label: 'Noise scale', min: 1, max: 20, default: 5, changeCost: 'live' as const },
  ];
  fixture.publish({ sdkVersion: '0.2.0', intensity: undefined, controlSchema: schema, controlSchemaHash: 'a'.repeat(64), controls: { spikeHeight: 2, noiseScale: 7 }, controlSequence: 0 });
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  assert.equal(screen.queryByRole('slider', { name: 'Intensity' }), null);
  assert.equal(screen.getAllByRole('slider').length, 2);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Noise scale value' }), { target: { value: '12' } });
  fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Noise scale value' }), { key: 'Enter' });
  await waitFor(() => assert.equal(fixture.calls.length, 1));
  assert.deepEqual(fixture.calls[0]?.input, { requestId: fixture.calls[0]?.input.requestId, instanceId: '44ff55f0-8ea6-4fbf-89d5-665923f65cad', expectedGeneration: 2, expectedRevisionId: 'revision-2', expectedControlSchemaHash: 'a'.repeat(64), values: { noiseScale: 12 }, mode: 'live' });
  fireEvent.click(screen.getByRole('button', { name: 'Reset Spike height to default' }));
  await waitFor(() => assert.equal(fixture.calls.length, 2));
  assert.deepEqual((fixture.calls[1] as any).input.values, { spikeHeight: 1 });
});

test('RTL: an empty authored schema has no invented control', () => {
  const fixture = service();
  fixture.publish({ sdkVersion: '0.2.0', intensity: undefined, controlSchema: [], controlSchemaHash: 'b'.repeat(64), controls: {}, controlSequence: 0 });
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  assert.equal(screen.queryByRole('slider'), null);
  assert.ok(screen.getByText('This visual defines no live controls.'));
});

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
  return { client, calls, fail: () => { fail = true; }, publish: (values: Partial<RuntimeView>) => {
    snapshot = { ...snapshot, authoring: { ...snapshot.authoring!, ...values } as RuntimeView };
    for (const listener of listeners) listener();
  }, update: () => {
    snapshot = { ...snapshot, authoring: { ...snapshot.authoring!, generation: 3, playback: 'playing' } };
    for (const listener of listeners) listener();
  } };
}

test('RTL: disconnected controls refuse input while workspace remains operable', async () => {
  const user = userEvent.setup({ document });
  render(<StudioApp client={createDisconnectedClient()} nowMs={1000} />);
  assert.equal((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled, true);
  assert.equal(screen.queryByRole('slider'), null);
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
  assert.equal(screen.queryByRole('button', { name: 'Pause' }), null);
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
  await user.click(screen.getByRole('button', { name: 'More playback actions' }));
  await user.click(screen.getByRole('menuitem', { name: 'Restart runtime' }));
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
  await user.click(screen.getByRole('button', { name: 'More playback actions' }));
  assert.notEqual(screen.getByRole('menuitem', { name: 'Restart runtime' }).getAttribute('aria-disabled'), 'true');
  fireEvent.click(screen.getByRole('menuitem', { name: 'Restart runtime' }));
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
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
  for (const name of ['Play', 'Reset', 'More playback actions']) assert.equal((screen.getByRole('button', { name }) as HTMLButtonElement).disabled, false);
  assert.equal(screen.queryByText('Sending request…'), null);
  await act(async () => finish());
  assert.equal(screen.queryByText('Request accepted. Awaiting applied runtime status.'), null);
  assert.equal(screen.queryByRole('alert'), null);
});

test('RTL: delayed applied values never pull a slider away from the latest input', async () => {
  const fixture = service();
  const pending: Array<() => void> = [];
  fixture.client.invoke = operation => {
    fixture.calls.push(operation);
    return new Promise(resolve => pending.push(() => {
      if (operation.name === 'lux.parameters.set') fixture.publish(operation.input.values);
      resolve({});
    }));
  };
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  const slider = screen.getByRole('slider') as HTMLInputElement;
  fireEvent.change(slider, { target: { value: '0.6' } });
  fireEvent.change(slider, { target: { value: '0.8' } });
  assert.equal(slider.value, '0.8');
  assert.equal(fixture.calls.length, 1, 'controller coalesces pending writes');
  await act(async () => pending.shift()!());
  assert.ok(screen.getByText('Applied value: 0.60'));
  assert.equal(slider.value, '0.8', 'old acknowledgement must not overwrite newer input');
  assert.equal(fixture.calls.length, 2);
  fireEvent.change(slider, { target: { value: '0.9' } });
  await act(async () => pending.shift()!());
  assert.equal(slider.value, '0.9');
  await act(async () => pending.shift()!());
  assert.equal(slider.value, '0.9');
  assert.ok(screen.getByText('Applied value: 0.90'));
  await act(async () => fixture.publish({ intensity: 0.25 }));
  assert.equal(slider.value, '0.25', 'external changes still apply after local input settles');
});

test('RTL: rejected slider input restores confirmed value and replacement ignores old completion', async () => {
  const fixture = service();
  let reject!: (reason: Error) => void;
  fixture.client.invoke = operation => { fixture.calls.push(operation); return new Promise((_resolve, fail) => { reject = fail; }); };
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  let slider = screen.getByRole('slider') as HTMLInputElement;
  fireEvent.change(slider, { target: { value: '0.8' } });
  await act(async () => reject(Error('Parameter rejected')));
  assert.equal(slider.value, '0.5');
  assert.match(screen.getByRole('alert').textContent ?? '', /Parameter rejected/);
  fireEvent.change(slider, { target: { value: '0.9' } });
  await act(async () => fixture.publish({ revisionId: 'new-revision', intensity: 0.2 }));
  slider = screen.getByRole('slider') as HTMLInputElement;
  assert.equal(slider.value, '0.2');
  await act(async () => reject(Error('Old revision rejected')));
  assert.equal(slider.value, '0.2');
  assert.equal(screen.queryByText('Old revision rejected'), null);
});

test('RTL: a replaced runtime has an independent input queue while old writes are pending', async () => {
  const fixture = service();
  const pending: Array<{ resolve(): void; reject(reason: Error): void }> = [];
  fixture.client.invoke = operation => {
    fixture.calls.push(operation);
    return new Promise((resolve, reject) => pending.push({ resolve: () => {
      if (operation.name === 'lux.parameters.set') fixture.publish(operation.input.values);
      resolve({});
    }, reject }));
  };
  render(<StudioApp client={fixture.client} nowMs={1000} />);
  let slider = screen.getByRole('slider') as HTMLInputElement;
  fireEvent.change(slider, { target: { value: '0.8' } });
  await act(async () => fixture.publish({ revisionId: 'new-revision', intensity: 0.2 }));
  slider = screen.getByRole('slider') as HTMLInputElement;
  fireEvent.change(slider, { target: { value: '0.4' } });
  assert.equal(fixture.calls.length, 2, 'new runtime input cannot queue behind the obsolete target');
  await act(async () => pending[1]!.resolve());
  assert.equal(slider.value, '0.4');
  await act(async () => pending[0]!.reject(Error('Obsolete revision')));
  assert.equal(slider.value, '0.4');
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


test('RTL: unavailable popout is absent while fullscreen remains available', async () => {
  const windows = { getState: async () => ({ detached: false, fullscreen: false }), subscribe: () => () => {},
    dock: async () => {}, fullscreen: async () => {} };
  render(<StudioApp client={service().client} windows={windows} nowMs={1000} />);
  assert.equal(screen.queryByRole('button', { name: 'Pop out' }), null);
  assert.equal((screen.getByRole('button', { name: 'Fullscreen' }) as HTMLButtonElement).disabled, false);
});
