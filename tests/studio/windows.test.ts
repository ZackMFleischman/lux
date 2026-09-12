import test from 'node:test';
import assert from 'node:assert/strict';
import { StudioWindows, isTrustedStudioUrl } from '../../apps/studio/src/windows.ts';

test('closing detached preview restores docking without owning a runtime', async () => {
  const updates: unknown[] = [];
  let onClosed = () => {};
  let created = 0, focused = 0, fullscreen = false;
  const preview = { focus: () => { focused++; }, close: () => onClosed(), setFullScreen: (value: boolean) => { fullscreen = value; }, isFullScreen: () => fullscreen };
  const windows = new StudioWindows(async closed => { created++; onClosed = closed; return preview; }, state => updates.push(state));
  await windows.popout(); await windows.popout();
  assert.equal(created, 1);
  assert.equal(focused, 1);
  assert.equal(windows.detached, true);
  windows.dock();
  assert.equal(windows.detached, false);
  assert.deepEqual(updates, [true, false]);
});

test('failed popout retains a usable docked panel', async () => {
  const states: boolean[] = [];
  const windows = new StudioWindows(async () => { throw Error('window blocked'); }, state => states.push(state));
  await assert.rejects(windows.popout(), /window blocked/);
  assert.equal(windows.detached, false);
  assert.deepEqual(states, []);
});

test('dock during pending popout cancels presentation and prevents an orphan window', async () => {
  let finish!: (window: { focus(): void; close(): void; setFullScreen(value: boolean): void; isFullScreen(): boolean }) => void;
  let created = 0, closed = 0;
  const windows = new StudioWindows(() => { created++; return new Promise(resolve => { finish = resolve; }); }, () => {});
  const first = windows.popout();
  const second = windows.popout();
  windows.dock();
  finish({ focus() {}, close() { closed++; }, setFullScreen() {}, isFullScreen: () => false });
  await Promise.all([first, second]);
  assert.equal(created, 1);
  assert.equal(closed, 1);
  assert.equal(windows.detached, false);
});

test('only the exact local Studio document can invoke window operations', () => {
  const page = 'file:///C:/Lux/studio/dist/index.html';
  assert.equal(isTrustedStudioUrl(page, page), true);
  assert.equal(isTrustedStudioUrl(page + '?view=preview', page), true);
  for (const url of ['https://example.com', page + '/other', page + '?script=evil', page.replace('index', 'other'), 'invalid']) {
    assert.equal(isTrustedStudioUrl(url, page), false);
  }
});
