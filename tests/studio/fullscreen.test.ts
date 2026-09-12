import test from 'node:test';
import assert from 'node:assert/strict';
import { observeFullscreen } from '../../apps/studio/src/fullscreen.ts';
test('fullscreen events are authoritative even when the native query still reports the previous state', () => {
  let native = false;
  const listeners = new Map<string, () => void>(), observed: boolean[] = [];
  const state = observeFullscreen({ isFullScreen: () => native, on: (event, listener) => { listeners.set(event, listener); } }, value => observed.push(value));
  listeners.get('enter-full-screen')!();
  assert.equal(state(), true); assert.deepEqual(observed, [true]);
  native = true;
  listeners.get('leave-full-screen')!();
  assert.equal(state(), false); assert.deepEqual(observed, [true, false]);
});
