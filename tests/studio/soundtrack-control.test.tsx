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
function Harness({ player, api, initial = null, origin = null, changes }: { player: SoundtrackPlayer; api: SoundtrackClient; initial?: SceneSoundtrack | null; origin?: string | null; changes: (SceneSoundtrack | null)[] }) {
  const [soundtrack, setSoundtrack] = useState<SceneSoundtrack | null>(initial);
  return <div className="transport"><SoundtrackControl player={player} api={api} soundtrack={soundtrack} origin={origin}
    onChange={next => { changes.push(next); setSoundtrack(next); }} onResolved={() => {}} onError={message => { if (message) throw Error(message); }} /></div>;
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
    loadLinked: async token => ({ status: 'missing', name: 'dawn.mp3', message: `dawn.mp3 was not found (${token}). Choose it again to relink.` }) };
  const linked = { path: 'audio/dawn.mp3', absolutePath: 'C:\\music\\dawn.mp3', sha256: 'd'.repeat(64), offsetSeconds: 0, volume: 1 };
  render(<Harness player={player} api={api} initial={linked} origin="scene-1" changes={[]} />);
  const button = await screen.findByRole('button', { name: 'Soundtrack: dawn.mp3. File missing' });
  await user.click(button);
  assert.ok((await screen.findByRole('alert')).textContent?.includes('was not found (scene-1)'));
  assert.ok(screen.getByRole('button', { name: 'Relink file…' }));
  assert.equal(player.status().state, 'missing');
});
