import { test, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { PreviewCaptureActions, PreviewCaptureMenu } from '../../apps/studio/src/PreviewCaptureMenu.tsx';
import { StudioMenuProvider } from '../../apps/studio/src/StudioMenu.tsx';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
for (const name of ['window', 'Window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'MutationObserver', 'getComputedStyle'] as const)
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  ResizeObserver: class { observe() {} unobserve() {} disconnect() {} } });
const { render, screen, cleanup } = await import('@testing-library/react');
const { userEvent } = await import('@testing-library/user-event');
after(() => { cleanup(); dom.window.close(); });
afterEach(() => cleanup());

test('Preview menu exposes frame and recording actions and announces fixed recording dimensions', async () => {
  const calls: string[] = [];
  const user = userEvent.setup({ document });
  const { rerender } = render(<StudioMenuProvider><header><PreviewCaptureMenu available status={{ phase: 'idle' }}
    onSaveFrame={async () => { calls.push('frame'); }} onStart={async () => { calls.push('start'); }} onStop={async () => { calls.push('stop'); }} /></header></StudioMenuProvider>);

  await user.click(screen.getByRole('button', { name: 'Preview' }));
  await user.click(screen.getByRole('menuitem', { name: 'Save frame PNG' }));
  await user.click(screen.getByRole('button', { name: 'Preview' }));
  await user.click(screen.getByRole('menuitem', { name: 'Record video' }));
  assert.deepEqual(calls, ['frame', 'start']);

  rerender(<StudioMenuProvider><header><PreviewCaptureMenu available status={{ phase: 'recording', width: 1920, height: 1080, mimeType: 'video/webm;codecs=vp9', path: 'C:/clip.webm' }}
    onSaveFrame={async () => { calls.push('frame'); }} onStart={async () => { calls.push('start'); }} onStop={async () => { calls.push('stop'); }} /></header></StudioMenuProvider>);
  assert.ok(screen.getByRole('status').textContent?.includes('Recording 1920 × 1080'));
  await user.click(screen.getByRole('button', { name: 'Preview · REC' }));
  assert.equal((screen.getByRole('menuitem', { name: 'Save frame PNG' }) as HTMLElement).getAttribute('aria-disabled'), 'true');
  await user.click(screen.getByRole('menuitem', { name: 'Stop recording' }));
  assert.deepEqual(calls, ['frame', 'start', 'stop']);
});

test('Preview menu disables capture when no working visual exists', async () => {
  const user = userEvent.setup({ document });
  render(<StudioMenuProvider><header><PreviewCaptureMenu available={false} status={{ phase: 'idle' }}
    onSaveFrame={async () => {}} onStart={async () => {}} onStop={async () => {}} /></header></StudioMenuProvider>);
  await user.click(screen.getByRole('button', { name: 'Preview' }));
  assert.equal(screen.getByRole('menuitem', { name: 'Save frame PNG' }).getAttribute('aria-disabled'), 'true');
  assert.equal(screen.getByRole('menuitem', { name: 'Record video' }).getAttribute('aria-disabled'), 'true');
});

test('Preview header actions use the shared recorder state and expose concise labels', async () => {
  const calls: string[] = [];
  const user = userEvent.setup({ document });
  const { rerender } = render(<PreviewCaptureActions available status={{ phase: 'idle' }}
    onSaveFrame={async () => { calls.push('frame'); }} onStart={async () => { calls.push('start'); }} onStop={async () => { calls.push('stop'); }} />);

  const frame = screen.getByRole('button', { name: 'Save frame PNG' });
  assert.equal(frame.getAttribute('title'), null);
  await user.hover(frame);
  assert.ok(await screen.findByRole('tooltip', { name: 'Save frame PNG' }));
  await user.unhover(frame);
  await user.click(frame);
  await user.click(screen.getByRole('button', { name: 'Record video' }));
  assert.deepEqual(calls, ['frame', 'start']);

  rerender(<PreviewCaptureActions available status={{ phase: 'recording', width: 1920, height: 1080, mimeType: 'video/webm', path: 'C:/clip.webm' }}
    onSaveFrame={async () => { calls.push('frame'); }} onStart={async () => { calls.push('start'); }} onStop={async () => { calls.push('stop'); }} />);
  assert.ok(screen.getByRole('status').textContent?.includes('Recording 1920 × 1080'));
  assert.equal((screen.getByRole('button', { name: 'Save frame PNG' }) as HTMLButtonElement).disabled, true);
  await user.click(screen.getByRole('button', { name: 'Stop recording' }));
  assert.deepEqual(calls, ['frame', 'start', 'stop']);
});
