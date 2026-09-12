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

test('native selected-text insertion preserves admission, undo, readonly and composition paths', async () => {
  const w = fixture();
  const ui = render(<SourcePanel workspace={w} readOnly={false} onSave={() => {}} />);
  const initial = view().state.doc.toString();
  const select = async () => act(async () => { view().dispatch({ selection: { anchor: view().state.doc.length, head: 0 } }); });
  const input = async (data: string, options: InputEventInit = {}) => {
    const event = new dom.window.InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data, ...options });
    await act(async () => { view().contentDOM.dispatchEvent(event); });
    return event.defaultPrevented;
  };
  await select();
  assert.equal(await input('export const unicode = "日本";'), true);
  assert.equal(w.getSnapshot().source.files['main.ts'], 'export const unicode = "日本";');
  await act(async () => { assert.equal(undo(view()), true); });
  assert.equal(view().state.doc.toString(), initial);
  await select();
  assert.equal(await input('\ud800'), true);
  assert.equal(view().state.doc.toString(), initial);
  assert.equal(w.getSnapshot().source.files['main.ts'], initial);
  assert.equal(await input('composing', { isComposing: true }), false);
  assert.equal(await input('composition', { inputType: 'insertCompositionText' }), false);
  assert.equal(await input('uncancelable', { cancelable: false }), false);
  fireEvent.compositionStart(view().contentDOM);
  assert.equal(await input('composition without flag'), false);
  fireEvent.compositionEnd(view().contentDOM);
  assert.equal(view().state.doc.toString(), initial);
  ui.rerender(<SourcePanel workspace={w} readOnly={true} onSave={() => {}} />);
  await input('blocked');
  assert.equal(view().state.doc.toString(), initial);
});
test('source panel preserves helper edits and undo across close/reopen and document replacement resets history', async () => {
  const w = fixture(); render(<SourcePanel workspace={w} readOnly={false} onSave={() => {}} />);
  await click(screen.getByRole('button', { name: 'Open lib/color.ts' }));
  await act(async () => { view().dispatch({ changes: { from: 0, to: view().state.doc.length, insert: 'helper draft' } }); });
  assert.equal(w.getSnapshot().source.files['lib/color.ts'], 'helper draft');
  await click(screen.getByRole('button', { name: 'Close lib/color.ts' }));
  assert.equal(document.activeElement?.getAttribute('aria-selected'), 'true');
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
  assert.equal(screen.queryByRole('textbox', { name: 'New TypeScript file' }), null);
  await click(screen.getByRole('button', { name: 'New file' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'New TypeScript file' }), { target: { value: '../bad.ts' } });
  await click(screen.getByRole('button', { name: 'Add file' }));
  assert.match(screen.getByRole('alert').textContent!, /Invalid relative/);
  assert.equal((screen.getByRole('textbox', { name: 'New TypeScript file' }) as HTMLInputElement).value, '../bad.ts');
  fireEvent.change(screen.getByRole('textbox', { name: 'New TypeScript file' }), { target: { value: 'lib/new.ts' } });
  await click(screen.getByRole('button', { name: 'Add file' }));
  assert.equal(w.getSnapshot().selectedFile, 'lib/new.ts');
  fireEvent.keyDown(view().contentDOM, { key: 's', ctrlKey: true });
  assert.equal(Object.keys((saved as any).files).length, 4);
  ui.rerender(<SourcePanel workspace={w} readOnly={true} onSave={() => {}} />);
  assert.equal(view().contentDOM.getAttribute('contenteditable'), 'false');
  assert.equal((screen.getByRole('button', { name: 'New file' }) as HTMLButtonElement).disabled, true);
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
test('repeated rejected edits never diverge from admitted source and preserve prior undo history', async () => {
  const w = fixture(); let saved: unknown;
  render(<SourcePanel workspace={w} readOnly={false} onSave={() => { saved = w.getSnapshot().source; }} />);
  await act(async () => { view().dispatch({ changes: { from: 0, insert: '// admitted\n' } }); });
  const version = w.getSnapshot().version, admitted = w.getSnapshot().source.files['main.ts'];
  for (let i = 0; i < 2; i++) {
    await act(async () => { view().dispatch({ changes: { from: 0, insert: '\ud800' } }); });
    assert.equal(view().state.doc.toString(), admitted); assert.equal(w.getSnapshot().version, version);
    fireEvent.keyDown(view().contentDOM, { key: 's', ctrlKey: true });
    assert.equal((saved as any).files['main.ts'], admitted);
  }
  await act(async () => { assert.equal(undo(view()), true); });
  assert.equal(w.getSnapshot().source.files['main.ts'], 'export const main = 1');
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
test('rejected candidate diagnostics explain their origin and cannot navigate the retained source', async () => {
  const w = fixture();
  render(<SourcePanel workspace={w} readOnly={false} onSave={() => {}} diagnostics={[
    { file: 'lib/color.ts', line: 1, column: 8, message: 'Candidate helper error', draftVersion: 0, candidateOnly: true },
  ]} />);
  assert.equal((screen.getByRole('button', { name: /Candidate helper error/ }) as HTMLButtonElement).disabled, true);
  assert.match(screen.getByText(/Diagnostic belongs to a rejected candidate/).textContent!, /displayed source is unchanged/);
  assert.equal(w.getSnapshot().selectedFile, 'main.ts');
});


test('new-file Escape cancels locally, restores focus and leaves source unchanged', async () => {
  const w = fixture(); render(<SourcePanel workspace={w} readOnly={false} onSave={() => {}} />);
  const before = w.getSnapshot(); let globalEscapes = 0;
  const listener = () => { globalEscapes++; }; window.addEventListener('keydown', listener);
  await click(screen.getByRole('button', { name: 'New file' }));
  const input = screen.getByRole('textbox', { name: 'New TypeScript file' });
  fireEvent.change(input, { target: { value: 'unsaved.ts' } });
  await act(async () => { fireEvent.keyDown(input, { key: 'Escape' }); });
  assert.equal(screen.queryByRole('textbox', { name: 'New TypeScript file' }), null);
  assert.equal(document.activeElement, screen.getByRole('button', { name: 'New file' }));
  assert.equal(w.getSnapshot(), before); assert.equal(globalEscapes, 0);
  window.removeEventListener('keydown', listener);
});

// Canvas rasterization is absent in jsdom. Capture the actual decoded RGBA sent
// to the canvas boundary; these checks do not claim browser/GPU rendering.
const painted = new WeakMap<HTMLCanvasElement, number[]>();
dom.window.HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
  const canvas = this;
  return { createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: (image: ImageData) => painted.set(canvas, [...image.data]) } as any;
} as any;
function imageSource() {
  const data = 'Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA==';
  const green = Buffer.from(data, 'base64'); green[55] = 255; green[56] = 0;
  return { sourceVersion: 2 as const, sdkVersion: '0.1.0' as const, entry: 'main.ts', files: { 'main.ts': 'export const main = 1' },
    assets: { 'assets/red.bmp': { mediaType: 'image/bmp' as const, encoding: 'base64' as const, data },
      'assets/green.bmp': { mediaType: 'image/bmp' as const, encoding: 'base64' as const, data: green.toString('base64') } } };
}
const preview = () => screen.getByRole('img', { name: /Image preview:/ }) as HTMLCanvasElement;
test('asset selection displays decoded pixels and preserves code drafts and undo', async () => {
  const w = createSourceWorkspace(imageSource()); render(<SourcePanel workspace={w} readOnly={false} onSave={() => {}} />);
  await act(async () => { view().dispatch({ changes: { from: 0, insert: '// draft\n' } }); });
  const editor = view();
  await click(screen.getByRole('button', { name: 'View assets/red.bmp' }));
  assert.deepEqual(painted.get(preview()), [255, 0, 0, 255]);
  assert.match(screen.getByRole('region', { name: 'Asset preview' }).textContent!, /1 × 1.*58 bytes/);
  assert.equal(screen.queryByRole('textbox', { name: /TypeScript source/ }), null);
  await click(screen.getByRole('button', { name: 'View assets/green.bmp' }));
  assert.deepEqual(painted.get(preview()), [0, 255, 0, 255]);
  await click(screen.getByRole('button', { name: 'Open main.ts' }));
  assert.equal(view(), editor); assert.match(view().state.doc.toString(), /draft/);
  await act(async () => { assert.equal(undo(view()), true); });
  assert.equal(w.getSnapshot().source.files['main.ts'], 'export const main = 1');
});
test('selected asset refreshes on replacement, reports dirty bytes and cannot survive removal or a new document', async () => {
  const w = createSourceWorkspace(imageSource()); render(<SourcePanel workspace={w} readOnly={false} onSave={() => {}} />);
  await click(screen.getByRole('button', { name: 'View assets/red.bmp' }));
  const next = imageSource(); next.assets['assets/red.bmp'].data = next.assets['assets/green.bmp'].data;
  await act(async () => { await w.submit(next, w.getSnapshot().version, async () => {}); });
  assert.deepEqual(painted.get(preview()), [0, 255, 0, 255]);
  assert.match(screen.getByRole('button', { name: 'View assets/red.bmp' }).textContent!, /\*/);
  await act(async () => { await w.submit({ ...next, assets: {} }, w.getSnapshot().version, async () => {}); });
  assert.equal(screen.queryByRole('img', { name: /Image preview:/ }), null);
  assert.match(screen.getByText('No image assets.').textContent!, /No image/);
  await act(async () => { w.replaceDocument(imageSource()); });
  assert.equal(screen.queryByRole('img', { name: /Image preview:/ }), null);
  await click(screen.getByRole('button', { name: 'View assets/red.bmp' }));
  await act(async () => { w.replaceDocument(imageSource()); });
  assert.equal(screen.queryByRole('img', { name: /Image preview:/ }), null);
});
test('legacy files remain editable with an empty asset list', () => {
  render(<SourcePanel workspace={fixture()} readOnly={false} onSave={() => {}} />);
  assert.ok(screen.getByText('No image assets.')); assert.equal(view().state.doc.toString(), 'export const main = 1');
});
test('malformed image presentation stays local and code remains accessible', async () => {
  const w = createSourceWorkspace(imageSource()), snapshot = w.getSnapshot();
  const broken = { ...snapshot, source: { ...imageSource(), assets: { 'assets/red.bmp': { mediaType: 'image/bmp' as const, encoding: 'base64' as const, data: 'bad' } } } };
  const presentation = { ...w, getSnapshot: () => broken };
  render(<SourcePanel workspace={presentation} readOnly={false} onSave={() => {}} />);
  await click(screen.getByRole('button', { name: 'View assets/red.bmp' }));
  assert.match(screen.getByRole('region', { name: 'Asset preview' }).textContent!, /Image unavailable/);
  assert.equal(screen.queryByRole('img', { name: /Image preview:/ }), null);
  await click(screen.getByRole('button', { name: 'Open main.ts' }));
  assert.equal(view().state.doc.toString(), 'export const main = 1');
});
test('keyboard asset activation and source tabs keep navigation accessible', async () => {
  const { userEvent } = await import('@testing-library/user-event');
  const user = userEvent.setup({ document });
  const w = createSourceWorkspace(imageSource()); render(<SourcePanel workspace={w} readOnly={false} onSave={() => {}} />);
  const asset = screen.getByRole('button', { name: 'View assets/red.bmp' });
  await act(async () => { asset.focus(); });
  await user.keyboard('{Enter}');
  assert.deepEqual(painted.get(preview()), [255, 0, 0, 255]);
  assert.equal(asset.getAttribute('aria-current'), 'page');
  await click(screen.getByRole('tab', { name: /main.ts/ }));
  assert.ok(screen.getByRole('textbox', { name: /TypeScript source/ }));
  assert.equal(screen.queryByRole('img', { name: /Image preview:/ }), null);
});
