import test, { afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><head><meta name="style-nonce" content="abcdefghijklmnopqrstuvwx"></head><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const name of ['window', 'Window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'ShadowRoot', 'DocumentFragment', 'Event', 'KeyboardEvent', 'MouseEvent', 'MutationObserver', 'getComputedStyle'] as const)
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true });
// jsdom has no layout; these only allow CodeMirror's scheduled geometry reads.
dom.window.Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
dom.window.Range.prototype.getBoundingClientRect = () => new dom.window.DOMRect();
const { render, screen, cleanup, fireEvent, act } = await import('@testing-library/react');
const { SourcePanel } = await import('../../apps/studio/src/source/SourcePanel.tsx');
const { createSourceWorkspace } = await import('../../apps/studio/src/source/workspace.ts');
const { EditorView } = await import('@codemirror/view');
const { undo } = await import('@codemirror/commands');
afterEach(async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 200)); }); cleanup(); }); after(() => dom.window.close());
const fixture = () => createSourceWorkspace({ sdkVersion: '0.1.0', entry: 'main.ts',
  files: { 'main.ts': 'export const main = 1', 'lib/color.ts': 'export const color = 1', 'other/color.ts': 'export const color = 2' } });
async function click(element: HTMLElement) { await act(async () => { fireEvent.click(element); }); }
function view() { return EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement)!; }
test('source panel preserves helper edits and undo across close/reopen and document replacement resets history', async () => {
  const w = fixture(); render(<SourcePanel workspace={w} readOnly={false} onSave={() => {}} />);
  await click(screen.getByRole('button', { name: 'Open lib/color.ts' }));
  await act(async () => { view().dispatch({ changes: { from: 0, to: view().state.doc.length, insert: 'helper draft' } }); });
  assert.equal(w.getSnapshot().source.files['lib/color.ts'], 'helper draft');
  await click(screen.getByRole('button', { name: 'Close lib/color.ts' }));
  await click(screen.getByRole('button', { name: 'Open lib/color.ts' }));
  assert.equal(view().state.doc.toString(), 'helper draft');
  await act(async () => { assert.equal(undo(view()), true); });
  assert.equal(w.getSnapshot().source.files['lib/color.ts'], 'export const color = 1');
  await act(async () => { w.replaceDocument({ sdkVersion: '0.1.0', entry: 'main.ts', files: { 'main.ts': 'new document' } }); });
  assert.equal(view().state.doc.toString(), 'new document');
  await act(async () => { assert.equal(undo(view()), false); });
});
test('file creation validates paths, saving sees all files, and busy view is readonly', async () => {
  const w = fixture(); let saved: unknown;
  const ui = render(<SourcePanel workspace={w} readOnly={false} onSave={() => { saved = w.getSnapshot().source; }} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'New TypeScript file' }), { target: { value: '../bad.ts' } });
  await click(screen.getByRole('button', { name: 'Add file' }));
  assert.match(screen.getByRole('alert').textContent!, /Invalid relative/);
  fireEvent.change(screen.getByRole('textbox', { name: 'New TypeScript file' }), { target: { value: 'lib/new.ts' } });
  await click(screen.getByRole('button', { name: 'Add file' }));
  assert.equal(w.getSnapshot().selectedFile, 'lib/new.ts');
  fireEvent.keyDown(view().contentDOM, { key: 's', ctrlKey: true });
  assert.equal(Object.keys((saved as any).files).length, 4);
  ui.rerender(<SourcePanel workspace={w} readOnly={true} onSave={() => {}} />);
  assert.equal(view().contentDOM.getAttribute('contenteditable'), 'false');
  assert.equal((screen.getByRole('button', { name: 'Add file' }) as HTMLButtonElement).disabled, true);
  assert.ok(document.querySelector('style[nonce="abcdefghijklmnopqrstuvwx"]'));
});
test('external replacement resets changed file history and panel remount retains unaffected file history', async () => {
  const w = fixture(); let ui = render(<SourcePanel workspace={w} readOnly={false} onSave={() => {}} />);
  await act(async () => { view().dispatch({ changes: { from: 0, insert: '// mine\n' } }); });
  await click(screen.getByRole('button', { name: 'Open lib/color.ts' }));
  await act(async () => { view().dispatch({ changes: { from: 0, insert: '// helper\n' } }); });
  await act(async () => { const next = structuredClone(w.getSnapshot().source); next.files['lib/color.ts'] = 'external helper';
    await w.submit(next, w.getSnapshot().version, async () => {}); });
  assert.equal(view().state.doc.toString(), 'external helper');
  await act(async () => { assert.equal(undo(view()), false); });
  ui.unmount(); ui = render(<SourcePanel workspace={w} readOnly={false} onSave={() => {}} />);
  await click(screen.getByRole('button', { name: 'Open main.ts' }));
  await act(async () => { assert.equal(undo(view()), true); });
  assert.equal(w.getSnapshot().source.files['main.ts'], 'export const main = 1');
  assert.ok(document.querySelector('.cm-lineNumbers'));
  assert.ok(document.querySelector('.cm-line span[class]'), 'TypeScript tokens have highlighting classes');
});
test('composition suppresses save and failed admission restores the admitted editor text', async () => {
  const w = fixture(); let saves = 0;
  render(<SourcePanel workspace={w} readOnly={false} onSave={() => { saves++; }} />);
  fireEvent.compositionStart(view().contentDOM);
  fireEvent.keyDown(view().contentDOM, { key: 's', ctrlKey: true }); assert.equal(saves, 0);
  fireEvent.compositionEnd(view().contentDOM);
  fireEvent.keyDown(view().contentDOM, { key: 's', ctrlKey: true }); assert.equal(saves, 1);
  await act(async () => { view().dispatch({ changes: { from: 0, insert: '\ud800' } }); });
  assert.equal(view().state.doc.toString(), w.getSnapshot().source.files['main.ts']);
  assert.match(screen.getByRole('alert').textContent!, /valid UTF-8/);
});
test('current diagnostics navigate helper coordinates and edited drafts label them stale', async () => {
  const w = fixture(), diagnostics = [{ file: 'lib/color.ts', line: 1, column: 8, message: 'A helper error', draftVersion: 0 }];
  render(<SourcePanel workspace={w} readOnly={false} onSave={() => {}} diagnostics={diagnostics} />);
  await click(screen.getByRole('button', { name: /A helper error/ }));
  assert.equal(w.getSnapshot().selectedFile, 'lib/color.ts'); assert.equal(view().state.selection.main.head, 7);
  await act(async () => { w.edit('main.ts', 'new draft'); });
  assert.match(screen.getByText(/Stale diagnostic/).textContent!, /source has changed/);
  assert.equal((screen.getByRole('button', { name: /A helper error/ }) as HTMLButtonElement).disabled, true);
});
