import { test, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { useState } from 'react';
import { SoundtrackControl } from '../../apps/studio/src/soundtrack/SoundtrackControl.tsx';
import { SoundtrackPlayer } from '../../apps/studio/src/soundtrack/soundtrack-player.ts';
import type { SoundtrackAudioContext } from '../../apps/studio/src/soundtrack/soundtrack-player.ts';
import type { SoundtrackClient } from '../../apps/studio/src/soundtrack/soundtrack-client.ts';
import type { SceneSoundtrack } from '../../packages/core/src/scene-soundtrack.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
for (const name of ['window', 'Window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'ShadowRoot', 'DocumentFragment', 'HTMLInputElement', 'Event', 'KeyboardEvent', 'MouseEvent', 'MutationObserver', 'getComputedStyle'] as const)
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  ResizeObserver: class { observe() {} unobserve() {} disconnect() {} } });
const { render, screen, cleanup, waitFor } = await import('@testing-library/react');
const { userEvent } = await import('@testing-library/user-event');
after(() => { cleanup(); dom.window.close(); });
afterEach(() => cleanup());

function fakePlayer() {
  const gain = { gain: { value: 1 }, connect() {} };
  const context = { currentTime: 0, state: 'running', destination: {}, resume: async () => {}, createGain: () => gain,
    createBufferSource: () => ({ buffer: null, connect() {}, start() {}, stop() {}, disconnect() {} }),
    decodeAudioData: async (data: ArrayBuffer) => ({ duration: data.byteLength }) };
  return { player: new SoundtrackPlayer({ createContext: () => context as unknown as SoundtrackAudioContext }), gain };
}
function Harness({ player, api, initial = null, origin = null, changes, accept = () => true }: { player: SoundtrackPlayer; api: SoundtrackClient; initial?: SceneSoundtrack | null; origin?: string | null; changes: (SceneSoundtrack | null)[]; accept?: (next: SceneSoundtrack | null) => boolean }) {
  const [soundtrack, setSoundtrack] = useState<SceneSoundtrack | null>(initial);
  return <div className="transport"><SoundtrackControl player={player} api={api} soundtrack={soundtrack} origin={origin}
    onChange={next => { if (!accept(next)) return false; changes.push(next); setSoundtrack(next); return true; }} onResolved={() => {}} onError={message => { if (message) throw Error(message); }} /></div>;
}

test('soundtrack control links a file, edits offset and volume, mutes and removes it by keyboard', async () => {
  const { player, gain } = fakePlayer(), changes: (SceneSoundtrack | null)[] = [], user = userEvent.setup({ document });
  const api: SoundtrackClient = { choose: async () => ({ name: 'dawn.mp3', absolutePath: 'C:\\music\\dawn.mp3', sha256: 'd'.repeat(64), bytes: new Uint8Array(300) }),
    loadLinked: async () => assert.fail('a chosen file needs no reload') };
  render(<Harness player={player} api={api} changes={changes} />);
  const button = screen.getByRole('button', { name: 'Soundtrack: none' });
  button.focus(); await user.keyboard('{Enter}');
  const dialog = await screen.findByRole('dialog', { name: 'Soundtrack' });
  assert.ok(dialog.textContent?.includes('No file linked'));
  await user.click(screen.getByRole('button', { name: 'Choose soundtrack…' }));
  await waitFor(() => assert.equal(changes.length, 1));
  assert.deepEqual(changes[0], { path: 'C:\\music\\dawn.mp3', absolutePath: 'C:\\music\\dawn.mp3', sha256: 'd'.repeat(64), offsetSeconds: 0, volume: 1 });
  assert.equal(player.status().durationSeconds, 300);
  assert.ok(screen.getByRole('button', { name: 'Soundtrack: dawn.mp3. Linked', hidden: true }), 'the transport button names the linked file');
  const offset = screen.getByRole('spinbutton', { name: 'Soundtrack offset seconds' });
  await user.clear(offset); await user.type(offset, '12.5{Enter}');
  assert.equal(changes.at(-1)?.offsetSeconds, 12.5);
  assert.equal(player.status().offsetSeconds, 12.5);
  const volume = screen.getByRole('slider', { name: 'Soundtrack volume' });
  volume.focus(); await user.keyboard('{Home}');
  assert.equal(gain.gain.value, 0);
  assert.equal(changes.at(-1)?.volume, 0);
  await user.click(screen.getByRole('switch', { name: 'Mute (this session only)' }));
  assert.equal(player.status().muted, true);
  assert.equal(changes.at(-1)?.volume, 0, 'mute is not a scene edit');
  await user.click(screen.getByRole('button', { name: 'Remove' }));
  assert.equal(changes.at(-1), null);
  assert.equal(player.status().durationSeconds, null);
});

test('a missing linked file shows a non-blocking warning and offers relink', async () => {
  const { player } = fakePlayer(), user = userEvent.setup({ document });
  const api: SoundtrackClient = { choose: async () => null,
    loadLinked: async token => ({ status: 'unavailable', name: 'dawn.mp3', message: `dawn.mp3 is missing, unreadable or changed since it was linked (${token}).` }) };
  const linked = { path: 'audio/dawn.mp3', absolutePath: 'C:\\music\\dawn.mp3', sha256: 'd'.repeat(64), offsetSeconds: 0, volume: 1 };
  render(<Harness player={player} api={api} initial={linked} origin="scene-1" changes={[]} />);
  const button = await screen.findByRole('button', { name: 'Soundtrack: dawn.mp3. File unavailable' });
  await user.click(button);
  const alert = await screen.findByRole('alert');
  assert.ok(alert.textContent?.includes('changed since it was linked (scene-1)'));
  assert.ok(alert.textContent?.includes('Last linked in folder “music”'), 'the alert shows the folder name, not the full path');
  assert.ok(screen.getByLabelText('Last linked at C:\\music\\dawn.mp3'));
  assert.ok(screen.getByRole('button', { name: 'Relink file…' }));
  assert.equal(player.status().state, 'unavailable');
});

test('invalid offsets show inline, and a rejected link leaves the player unchanged', async () => {
  const { player } = fakePlayer(), user = userEvent.setup({ document }), changes: (SceneSoundtrack | null)[] = [];
  let accept = true;
  const api: SoundtrackClient = { choose: async () => ({ name: 'other.mp3', absolutePath: 'C:\\music\\other.mp3', sha256: 'e'.repeat(64), bytes: new Uint8Array(500) }),
    loadLinked: async () => assert.fail('no reload') };
  render(<Harness player={player} api={api} changes={changes} accept={() => accept} />);
  await user.click(screen.getByRole('button', { name: 'Soundtrack: none' }));
  await user.click(await screen.findByRole('button', { name: 'Choose soundtrack…' }));
  await waitFor(() => assert.equal(changes.length, 1));
  const offset = screen.getByRole('spinbutton', { name: 'Soundtrack offset seconds' });
  await user.clear(offset); await user.type(offset, '-3{Enter}');
  assert.equal(offset.getAttribute('aria-invalid'), 'true');
  assert.ok(screen.getByText('Enter 0 to 86400 seconds'));
  assert.equal(changes.length, 1, 'an invalid offset is not saved');
  await user.clear(offset); await user.type(offset, '4{Enter}');
  assert.equal(offset.getAttribute('aria-invalid'), 'false');
  assert.equal(changes.at(-1)?.offsetSeconds, 4);
  accept = false;
  await user.click(screen.getByRole('button', { name: 'Replace file…' }));
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(player.status().durationSeconds, 500, 'the rejected file never reached the player');
  assert.equal(changes.length, 2);
});
