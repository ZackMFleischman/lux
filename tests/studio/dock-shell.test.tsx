import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><meta name="style-nonce" content="abcdefghijklmnopqrstuvwx"><body></body>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'Window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'ShadowRoot', 'DocumentFragment', 'Event', 'KeyboardEvent', 'MouseEvent', 'MutationObserver', 'getComputedStyle'] as const)
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  ResizeObserver: class { observe() {} unobserve() {} disconnect() {} } });
dom.window.Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
dom.window.Range.prototype.getBoundingClientRect = () => new dom.window.DOMRect();
const { render, screen, cleanup, fireEvent, act, waitFor } = await import('@testing-library/react');
const { StudioApp } = await import('../../apps/studio/src/renderer.tsx');
const { SourcePanel } = await import('../../apps/studio/src/source/SourcePanel.tsx');
const { createSourceWorkspace } = await import('../../apps/studio/src/source/workspace.ts');
const { EditorView } = await import('@codemirror/view');
const { undo } = await import('@codemirror/commands');
after(() => { cleanup(); dom.window.close(); });
async function click(name: string) { await act(async () => { fireEvent.click(screen.getByRole('button', { name })); }); }
test('real dock panes preserve canvas, editor undo and runtime subscriptions through close, tab, reset, restore and fullscreen', async () => {
  const runtime = { instanceId: '44ff55f0-8ea6-4fbf-89d5-665923f65cad', generation: 2, revisionId: 'revision-2', sceneName: 'Fixture',
    authority: 'studio' as const, playback: 'paused' as const, clockEpoch: 1, frameId: '10', intensity: 0.5, output: { width: 1920, height: 1080 }, fault: null };
  let snapshot = { connection: 'connected' as const, message: null, receivedAtMs: 1000, authoring: runtime, host: null, jobs: [], visualFps: null, uiFps: null };
  let subscriptions = 0, attaches = 0, detaches = 0;
  const listeners = new Set<() => void>();
  const client = { getSnapshot: () => snapshot, subscribe: (listener: () => void) => { subscriptions++; listeners.add(listener); return () => { subscriptions--; listeners.delete(listener); }; }, invoke: async () => { throw Error('Docking must not invoke runtime operations'); } };
  const canvas = document.createElement('canvas');
  const presentation = { attach: async ({ target }: { target: HTMLElement }) => { attaches++; target.append(canvas); return { detach: async () => { detaches++; canvas.remove(); } }; } };
  let notify = (_state: { detached: boolean; fullscreen: boolean }) => {};
  const windows = { getState: async () => ({ detached: false, fullscreen: false }), subscribe: (fn: typeof notify) => { notify = fn; return () => {}; },
    fullscreen: async (fullscreen: boolean) => notify({ detached: false, fullscreen }), dock: async () => {}, popout: async () => {} };
  const workspace = createSourceWorkspace({ sdkVersion: '0.1.0', entry: 'main.ts', files: { 'main.ts': 'export const value = 1' } });
  const ui = render(<StudioApp client={client} presentation={presentation} windows={windows} nowMs={1000}
    sourcePanel={<SourcePanel workspace={workspace} readOnly={false} onSave={() => {}} />} />);
  await waitFor(() => assert.equal(attaches, 1));
  const editorNode = document.querySelector('.cm-editor') as HTMLElement;
  const editor = EditorView.findFromDOM(editorNode)!;
  await act(async () => { editor.dispatch({ changes: { from: 0, insert: '// draft\n' } }); });
  await act(async () => { fireEvent.click(screen.getByText('View & layouts')); });
  await click('Close selected panel');
  assert.equal(document.contains(editorNode), false);
  await click('Open Source');
  assert.equal(document.querySelector('.cm-editor'), editorNode);
  await act(async () => { assert.equal(undo(editor), true); });
  assert.equal(workspace.getSnapshot().source.files['main.ts'], 'export const value = 1');
  await click('Move to tab group');
  fireEvent.change(screen.getByLabelText('Move panel'), { target: { value: 'preview' } });
  await click('Close selected panel');
  assert.equal(document.contains(canvas), false);
  await click('Open Preview');
  assert.ok(document.contains(canvas));
  assert.equal(attaches, 1);
  fireEvent.change(screen.getByLabelText('Move panel'), { target: { value: 'source' } });
  // Preserve a named non-default arrangement while resetting a different entry.
  // Resetting the saved name would delete it and exercise only missing fallback.
  await click('Reset desktop layout');
  await click('Move to tab group');
  const groupFor = (title: string) => {
    const tab = [...document.querySelectorAll('.dv-tab')].find(node => node.textContent?.trim() === title);
    assert.ok(tab, `Expected dock tab ${title}`);
    const group = tab.closest('.dv-groupview'); assert.ok(group); return group;
  };
  assert.equal(document.querySelectorAll('.studio-dock-grid .dv-groupview').length, 3);
  assert.equal(groupFor('Source'), groupFor('Preview'));
  await act(async () => { editor.dispatch({ changes: { from: 0, insert: '// saved layout draft\n' } }); });
  fireEvent.change(screen.getByLabelText('Layout name'), { target: { value: 'Authoring tabs' } });
  await click('Save layout');
  const saved = window.localStorage.getItem('lux.personal-layout.v1.Authoring%20tabs');
  assert.ok(saved);
  fireEvent.change(screen.getByLabelText('Layout name'), { target: { value: 'Temporary reset' } });
  await click('Reset desktop layout');
  assert.equal(document.querySelectorAll('.studio-dock-grid .dv-groupview').length, 4);
  assert.notEqual(groupFor('Source'), groupFor('Preview'));
  assert.equal(window.localStorage.getItem('lux.personal-layout.v1.Authoring%20tabs'), saved);
  fireEvent.change(screen.getByLabelText('Layout name'), { target: { value: 'Authoring tabs' } });
  await click('Restore layout');
  assert.ok(screen.getByText('Restored layout: Authoring tabs'));
  assert.equal(document.querySelectorAll('.studio-dock-grid .dv-groupview').length, 3);
  assert.equal(groupFor('Source'), groupFor('Preview'));
  assert.equal(document.querySelector('.preview-surface canvas'), canvas);
  assert.equal(document.querySelector('.cm-editor'), editorNode);
  assert.equal(EditorView.findFromDOM(editorNode), editor);
  assert.equal(editor.state.doc.toString(), '// saved layout draft\nexport const value = 1');
  await act(async () => { assert.equal(undo(editor), true); });
  assert.equal(workspace.getSnapshot().source.files['main.ts'], 'export const value = 1');
  await click('Reset laptop layout');
  await click('Open Preview');
  assert.equal(canvas.closest('.preview-surface'), document.querySelector('.preview-surface'));
  await click('Fullscreen');
  assert.equal(canvas.closest('.studio-expanded-pane')?.hasAttribute('hidden'), false);
  assert.equal(screen.queryByRole('button', { name: 'Play' }), null);
  await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }); });
  assert.ok(canvas.closest('.studio-dock-grid'));
  await click('Maximize'); await click('Restore workspace');
  await act(async () => { snapshot = { ...snapshot, authoring: { ...runtime, frameId: '11' } }; for (const listener of listeners) listener(); });
  await click('Open Inspector');
  assert.ok(screen.getByText('11'));
  await click('Open Preview');
  assert.equal(document.querySelector('.cm-editor'), editorNode);
  assert.equal(attaches, 1); assert.equal(detaches, 0); assert.equal(subscriptions, 1);
  ui.unmount(); await act(async () => {});
  assert.equal(detaches, 1); assert.equal(subscriptions, 0);
});
