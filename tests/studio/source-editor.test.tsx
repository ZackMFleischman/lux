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
const { render, screen, cleanup, fireEvent, act, waitFor, within } = await import('@testing-library/react');
const { SourcePanel } = await import('../../apps/studio/src/source/SourcePanel.tsx');
const { ProblemsPanel } = await import('../../apps/studio/src/source/ProblemsPanel.tsx');
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
  const ui = render(<SourcePanel workspace={w} readOnly={false} onApply={() => {}} onSave={() => {}} />);
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
  ui.rerender(<SourcePanel workspace={w} readOnly={true} onApply={() => {}} onSave={() => {}} />);
  await input('blocked');
  assert.equal(view().state.doc.toString(), initial);
});
test('source panel preserves helper edits and undo across close/reopen and document replacement resets history', async () => {
  const w = fixture(); render(<SourcePanel workspace={w} readOnly={false} onApply={() => {}} onSave={() => {}} />);
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
test('file creation validates paths, includes all files, and busy view is readonly', async () => {
  const w = fixture();
  const ui = render(<SourcePanel workspace={w} readOnly={false} onApply={() => {}} />);
  assert.equal(screen.queryByRole('textbox', { name: 'New TypeScript file' }), null);
  await click(screen.getByRole('button', { name: 'New file' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'New TypeScript file' }), { target: { value: '../bad.ts' } });
  await click(screen.getByRole('button', { name: 'Add file' }));
  assert.match(screen.getByRole('alert').textContent!, /Invalid relative/);
  assert.equal((screen.getByRole('textbox', { name: 'New TypeScript file' }) as HTMLInputElement).value, '../bad.ts');
  fireEvent.change(screen.getByRole('textbox', { name: 'New TypeScript file' }), { target: { value: 'lib/new.ts' } });
  await click(screen.getByRole('button', { name: 'Add file' }));
  assert.equal(w.getSnapshot().selectedFile, 'lib/new.ts');
  assert.equal(Object.keys(w.getSnapshot().source.files).length, 4);
  ui.rerender(<SourcePanel workspace={w} readOnly={true} onApply={() => {}} onSave={() => {}} />);
  assert.equal(view().contentDOM.getAttribute('contenteditable'), 'false');
  assert.equal((screen.getByRole('button', { name: 'New file' }) as HTMLButtonElement).disabled, true);
  assert.ok(document.querySelector('style[nonce="abcdefghijklmnopqrstuvwx"]'));
});
test('external replacement resets changed file history and panel remount retains unaffected file history', async () => {
  const w = fixture(); let ui = render(<SourcePanel workspace={w} readOnly={false} onApply={() => {}} onSave={() => {}} />);
  await act(async () => { view().dispatch({ changes: { from: 0, insert: '// mine\n' } }); });
  await click(screen.getByRole('button', { name: 'Open lib/color.ts' }));
  await act(async () => { view().dispatch({ changes: { from: 0, insert: '// helper\n' } }); });
  await act(async () => { const next = structuredClone(w.getSnapshot().source); next.files['lib/color.ts'] = 'external helper';
    await w.submit(next, w.getSnapshot().version, async () => {}); });
  assert.equal(view().state.doc.toString(), 'external helper');
  await act(async () => { assert.equal(undo(view()), false); });
  ui.unmount(); ui = render(<SourcePanel workspace={w} readOnly={false} onApply={() => {}} onSave={() => {}} />);
  await click(screen.getByRole('button', { name: 'Open main.ts' }));
  await act(async () => { assert.equal(undo(view()), true); });
  assert.equal(w.getSnapshot().source.files['main.ts'], 'export const main = 1');
  assert.ok(document.querySelector('.cm-lineNumbers'));
  assert.ok(document.querySelector('.cm-line span[class]'), 'TypeScript tokens have highlighting classes');
});
test('composition suppresses Build and failed admission restores the admitted editor text', async () => {
  const w = fixture(); let builds = 0;
  render(<SourcePanel workspace={w} readOnly={false} onApply={() => { builds++; }} />);
  fireEvent.compositionStart(view().contentDOM);
  fireEvent.keyDown(view().contentDOM, { key: 'Enter', ctrlKey: true }); assert.equal(builds, 0);
  fireEvent.compositionEnd(view().contentDOM);
  fireEvent.keyDown(view().contentDOM, { key: 'Enter', ctrlKey: true }); assert.equal(builds, 1);
  await act(async () => { view().dispatch({ changes: { from: 0, insert: '\ud800' } }); });
  assert.equal(view().state.doc.toString(), w.getSnapshot().source.files['main.ts']);
  assert.match(screen.getByRole('alert').textContent!, /valid UTF-8/);
});
test('repeated rejected edits never diverge from admitted source and preserve prior undo history', async () => {
  const w = fixture();
  render(<SourcePanel workspace={w} readOnly={false} onApply={() => {}} />);
  await act(async () => { view().dispatch({ changes: { from: 0, insert: '// admitted\n' } }); });
  const version = w.getSnapshot().version, admitted = w.getSnapshot().source.files['main.ts'];
  for (let i = 0; i < 2; i++) {
    await act(async () => { view().dispatch({ changes: { from: 0, insert: '\ud800' } }); });
    assert.equal(view().state.doc.toString(), admitted); assert.equal(w.getSnapshot().version, version);
    assert.equal(w.getSnapshot().source.files['main.ts'], admitted);
  }
  await act(async () => { assert.equal(undo(view()), true); });
  assert.equal(w.getSnapshot().source.files['main.ts'], 'export const main = 1');
});
test('current diagnostics expose helper coordinates and external navigation selects the editor target', async () => {
  const w = fixture(), diagnostics = [{ file: 'lib/color.ts', line: 1, column: 8, message: 'A helper error', draftVersion: 0 }];
  let target: { path: string; offset: number } | null = null;
  const ui = render(<ProblemsPanel diagnostics={diagnostics} snapshot={w.getSnapshot()} onNavigate={value => { target = value; }} />);
  await click(screen.getByRole('button', { name: /A helper error/ }));
  assert.deepEqual(target, { path: 'lib/color.ts', offset: 7 });
  assert.ok(target);
  const navigationTarget = target as { path: string; offset: number };
  let handled = 0;
  ui.rerender(<SourcePanel workspace={w} readOnly={false} onApply={() => {}} onSave={() => {}}
    diagnosticTarget={{ ...navigationTarget, request: 1, documentKey: w.getSnapshot().documentKey, draftVersion: w.getSnapshot().version }}
    onDiagnosticTargetHandled={request => { handled = request; }} />);
  assert.equal(w.getSnapshot().selectedFile, 'lib/color.ts'); assert.equal(view().state.selection.main.head, 7);
  assert.equal(handled, 1);
  ui.rerender(<SourcePanel workspace={w} readOnly={false} onApply={() => {}} onSave={() => {}} diagnosticTarget={null} />);
  await act(async () => { w.edit('main.ts', 'new draft'); });
  ui.rerender(<ProblemsPanel diagnostics={diagnostics} snapshot={w.getSnapshot()} onNavigate={() => {}} />);
  assert.match(screen.getByText(/Stale diagnostic/).textContent!, /source has changed/);
  assert.equal((screen.getByRole('button', { name: /A helper error/ }) as HTMLButtonElement).disabled, true);
});
test('rejected candidate diagnostics explain their origin and cannot navigate the retained source', async () => {
  const w = fixture();
  render(<ProblemsPanel snapshot={w.getSnapshot()} onNavigate={() => {}} diagnostics={[
    { file: 'lib/color.ts', line: 1, column: 8, message: 'Candidate helper error', draftVersion: 0, candidateOnly: true },
  ]} />);
  assert.equal((screen.getByRole('button', { name: /Candidate helper error/ }) as HTMLButtonElement).disabled, true);
  assert.match(screen.getByText(/Diagnostic belongs to a rejected candidate/).textContent!, /displayed source is unchanged/);
  assert.equal(w.getSnapshot().selectedFile, 'main.ts');
});


test('new-file Escape cancels locally, restores focus and leaves source unchanged', async () => {
  const w = fixture(); render(<SourcePanel workspace={w} readOnly={false} onApply={() => {}} onSave={() => {}} />);
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
  const w = createSourceWorkspace(imageSource()); render(<SourcePanel workspace={w} readOnly={false} onApply={() => {}} onSave={() => {}} />);
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
  const w = createSourceWorkspace(imageSource()); render(<SourcePanel workspace={w} readOnly={false} onApply={() => {}} onSave={() => {}} />);
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
  render(<SourcePanel workspace={fixture()} readOnly={false} onApply={() => {}} onSave={() => {}} />);
  assert.ok(screen.getByText('No image assets.')); assert.equal(view().state.doc.toString(), 'export const main = 1');
});
test('malformed image presentation stays local and code remains accessible', async () => {
  const w = createSourceWorkspace(imageSource()), snapshot = w.getSnapshot();
  const broken = { ...snapshot, source: { ...imageSource(), assets: { 'assets/red.bmp': { mediaType: 'image/bmp' as const, encoding: 'base64' as const, data: 'bad' } } } };
  const presentation = { ...w, getSnapshot: () => broken };
  render(<SourcePanel workspace={presentation} readOnly={false} onApply={() => {}} onSave={() => {}} />);
  await click(screen.getByRole('button', { name: 'View assets/red.bmp' }));
  assert.match(screen.getByRole('region', { name: 'Asset preview' }).textContent!, /Image unavailable/);
  assert.equal(screen.queryByRole('img', { name: /Image preview:/ }), null);
  await click(screen.getByRole('button', { name: 'Open main.ts' }));
  assert.equal(view().state.doc.toString(), 'export const main = 1');
});
test('keyboard asset activation and source tabs keep navigation accessible', async () => {
  const { userEvent } = await import('@testing-library/user-event');
  const user = userEvent.setup({ document });
  const w = createSourceWorkspace(imageSource()); render(<SourcePanel workspace={w} readOnly={false} onApply={() => {}} onSave={() => {}} />);
  const asset = screen.getByRole('button', { name: 'View assets/red.bmp' });
  await act(async () => { asset.focus(); });
  await user.keyboard('{Enter}');
  assert.deepEqual(painted.get(preview()), [255, 0, 0, 255]);
  assert.equal(asset.getAttribute('aria-current'), 'page');
  await click(screen.getByRole('tab', { name: /main.ts/ }));
  assert.ok(screen.getByRole('textbox', { name: /TypeScript source/ }));
  assert.equal(screen.queryByRole('img', { name: /Image preview:/ }), null);
});

test('collapsing source navigation preserves the active asset and code draft', async () => {
  const w = createSourceWorkspace(imageSource()); render(<SourcePanel workspace={w} readOnly={false} onApply={() => {}} onSave={() => {}} />);
  await act(async () => { view().dispatch({ changes: { from: 0, insert: '// retained draft\n' } }); });
  await click(screen.getByRole('button', { name: 'View assets/red.bmp' }));
  const header = screen.getByText('Files and assets');
  const disclosure = header.closest('details');
  assert.ok(disclosure);
  assert.ok(disclosure.classList.contains('studio-disclosure'));
  assert.ok(disclosure.open);
  await click(header);
  assert.ok(screen.getByRole('region', { name: 'Asset preview' }));
  assert.equal(disclosure.open, false);
  await click(header);
  assert.equal(disclosure.open, true);
  await click(screen.getByRole('button', { name: 'Open main.ts' }));
  assert.match(view().state.doc.toString(), /retained draft/);
  assert.equal(w.getSnapshot().source.files['main.ts'], '// retained draft\nexport const main = 1');
});

test('source shortcut builds with Ctrl/Cmd+Enter and leaves scene save for the app command layer', async () => {
  const w = fixture(); const commands: string[] = [];
  const ui = render(<SourcePanel workspace={w} readOnly={false} onApply={() => { commands.push('apply'); }} onSave={() => { commands.push('save'); }} />);
  const key = (value: string, options: KeyboardEventInit) => fireEvent.keyDown(view().contentDOM, { key: value, ...options });
  key('Enter', {});
  for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
    assert.equal(key('Enter', modifier), false);
    key('s', modifier);
    key('S', { ...modifier, shiftKey: true });
    assert.equal(key('Enter', { ...modifier, repeat: true }), false);
    key('Enter', { ...modifier, isComposing: true });
    key('Enter', { ...modifier, altKey: true });
    fireEvent.compositionStart(view().contentDOM);
    key('Enter', modifier);
    fireEvent.compositionEnd(view().contentDOM);
  }
  assert.deepEqual(commands, ['apply', 'apply']);
  ui.rerender(<SourcePanel workspace={w} readOnly={true} onApply={() => { commands.push('apply'); }} onSave={() => { commands.push('save'); }} />);
  key('Enter', { ctrlKey: true }); key('Enter', { metaKey: true });
  assert.deepEqual(commands, ['apply', 'apply']);
  ui.rerender(<SourcePanel workspace={w} readOnly={false} onApply={() => { commands.push('apply'); }} onSave={() => { commands.push('save'); }} />);
  let finish!: () => void;
  let pending!: Promise<void>;
  await act(async () => { pending = w.submit(w.getSnapshot().source, w.getSnapshot().version, () => new Promise(resolve => { finish = resolve; })); });
  key('Enter', { ctrlKey: true }); key('Enter', { metaKey: true });
  assert.deepEqual(commands, ['apply', 'apply']);
  await act(async () => { finish(); await pending; });
});

test('authoring source shortcut compiles the complete edited bundle, exposes errors, and keeps explicit scene save', async () => {
  // Only the compiler/file IPC boundary is replaced; authoring/session/workspace/editor stay real.
  Object.assign(globalThis, {
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
  });
  const source = fixture().getSnapshot().source;
  const builds: unknown[] = [], saves: any[] = [];
  let finish!: () => void, finishSave!: () => void;
  let agentCommand!: (command: any) => Promise<any>;
  let holdSave = true;
  let compileSucceeds = false;
  class AuthoringWorker {
    static all: AuthoringWorker[] = [];
    onmessage: any; onerror: any; init: any; frame = 1; timer?: ReturnType<typeof setInterval>;
    constructor() { AuthoringWorker.all.push(this); }
    postMessage(message: any) {
      if (message.type === 'init') { this.init = message; queueMicrotask(() => {
        this.reply({ type: 'ready' });
        this.reply({ type: 'status', playback: 'paused' });
        this.timer = setInterval(() => this.reply({ type: 'heartbeat', frameId: String(++this.frame), playback: 'paused' }), 100);
        (this.timer as any).unref?.();
      }); }
    }
    reply(extra: any) { this.onmessage({ data: { ...this.init, type: 'status', frameId: '1', timeSeconds: 0,
      clockEpoch: 0, controlSequence: 0, intensity: this.init.controls.intensity, playback: 'playing', ...extra } }); }
    terminate() { if (this.timer) clearInterval(this.timer); }
  }
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: AuthoringWorker });
  (dom.window.HTMLCanvasElement.prototype as any).transferControlToOffscreen = () => ({});
  const sceneName = 'A deliberately long scene title.lux-scene';
  window.luxExport = { unavailableReason: 'Resolume export is not included in this installation', create: async () => null };
  window.luxAuthoring = {
    example: async () => source,
    compile: async bundle => { builds.push(structuredClone(bundle));
      if (!compileSucceeds) {
        await new Promise<void>(resolve => { finish = resolve; });
        return { ok: false, diagnostics: [{ file: 'lib/color.ts', line: 1, column: 8, message: 'Shortcut compile error' }] };
      }
      return { ok: true, linked: { code: '' }, sourceHash: 'resolved-source' }; },
    save: async request => { saves.push(request);
      if (holdSave) await new Promise<void>(resolve => { finishSave = resolve; });
      return { token: 'scene-token', name: sceneName }; },
    open: async () => null, dirty: async () => {}, smokeSave: async () => null,
    onAgentCommand: handler => { agentCommand = handler; return () => {}; },
  };
  const { AuthoringApp } = await import('../../apps/studio/src/authoring.tsx');
  await act(async () => { render(<AuthoringApp />); });
  assert.deepEqual([...document.querySelectorAll<HTMLButtonElement>('header [data-studio-menu]')].map(button => button.textContent), ['File', 'View', 'Preview']);
  assert.match(screen.getByRole('button', { name: 'Build' }).getAttribute('title') ?? '', /Ctrl\+Enter/);
  fireEvent.click(screen.getByText('File'));
  const fileMenu = screen.getByRole('menu', { name: 'File' });
  for (const hint of ['Ctrl+S', 'Ctrl+Shift+S', 'Ctrl+Shift+E']) assert.ok(within(fileMenu).getByText(hint));
  const unavailableExport = within(fileMenu).getByRole('menuitem', { name: /Export for Resolume/ });
  assert.equal(unavailableExport.getAttribute('aria-disabled'), 'true');
  assert.equal(unavailableExport.getAttribute('title'), 'Resolume export is not included in this installation');
  fireEvent.keyDown(fileMenu, { key: 'Escape' });
  await click(screen.getByRole('button', { name: 'View' }));
  await click(screen.getByRole('menuitem', { name: 'Source' }));
  await waitFor(() => assert.ok(screen.queryByRole('button', { name: 'View' })));
  await click(screen.getByRole('button', { name: 'Open lib/color.ts' }));
  await act(async () => { view().dispatch({ changes: { from: 0, to: view().state.doc.length, insert: 'export const color = 42' } }); });
  const editor = view();
  await act(async () => {
    fireEvent.keyDown(editor.contentDOM, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(editor.contentDOM, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(editor.contentDOM, { key: 's', metaKey: true, shiftKey: true });
  });
  assert.deepEqual(builds, [{ sdkVersion: '0.1.0', entry: 'main.ts', files: {
    'main.ts': 'export const main = 1', 'lib/color.ts': 'export const color = 42', 'other/color.ts': 'export const color = 2',
  } }]);
  assert.equal(saves.length, 0);
  assert.equal(screen.queryByText(/Studio is busy/), null);
  await act(async () => { finish(); });
  await click(screen.getByRole('button', { name: /Problems: 1/ }));
  await waitFor(() => assert.ok(screen.queryByRole('button', { name: /Shortcut compile error/ })));
  assert.ok(screen.getByRole('region', { name: 'Source diagnostics' }));
  assert.equal(screen.queryByRole('region', { name: 'Source problems' }), null);
  assert.equal(document.querySelector('.source-workspace')?.textContent?.includes('Shortcut compile error'), false);
  assert.equal(screen.getAllByText(/Shortcut compile error/).length, 1, 'structured diagnostic replaces the repeated compile job fault');
  assert.equal(view(), editor);
  await click(screen.getByRole('button', { name: /Shortcut compile error/ }));
  await waitFor(() => assert.equal(view().state.selection.main.head, 7));
  await act(async () => { view().dispatch({ selection: { anchor: 0 } }); });
  await click(screen.getByRole('button', { name: 'Open main.ts' }));
  await click(screen.getByRole('button', { name: 'Open lib/color.ts' }));
  assert.equal(view().state.selection.main.head, 0, 'consumed navigation does not replay when returning to the file');
  const activeEditor = view();
  fireEvent.click(screen.getByText('File'));
  await click(screen.getByRole('menuitem', { name: 'Save' }));
  assert.equal(builds.length, 1); assert.equal(saves.length, 1);
  assert.equal(screen.queryByText(/Studio is busy/), null);
  await act(async () => { holdSave = false; finishSave(); });
  assert.equal(saves[0].saveAs, false); assert.deepEqual(saves[0].document.source, builds[0]);
  const title = document.querySelector('.document-name')!;
  assert.equal(title.getAttribute('title'), sceneName);
  assert.ok(title.textContent?.includes(sceneName));
  assert.equal(title.querySelector('button, summary, [role="button"]'), null);
  await act(async () => { activeEditor.dispatch({ changes: { from: 0, insert: '// unsaved\n' } }); });
  assert.ok(title.textContent?.endsWith(' *'));
  fireEvent.keyDown(activeEditor.contentDOM, { key: 's', ctrlKey: true });
  await waitFor(() => assert.equal(saves.length, 2));
  assert.equal(saves.length, 2); assert.equal(saves[1].saveAs, false);
  assert.equal(title.textContent?.endsWith(' *'), false);
  fireEvent.keyDown(activeEditor.contentDOM, { key: 's', ctrlKey: true, shiftKey: true });
  await waitFor(() => assert.equal(saves.length, 3));
  assert.equal(saves.length, 3); assert.equal(saves[2].saveAs, true);
  fireEvent.keyDown(activeEditor.contentDOM, { key: 's', ctrlKey: true, shiftKey: true, repeat: true });
  assert.equal(saves.length, 3, 'repeat does not reopen Save as');
  compileSucceeds = true;
  const current = await agentCommand({ method: 'read', params: {} });
  await act(async () => { await agentCommand({ method: 'build', params: { source: current.source, expectedDraftVersion: current.draftVersion } }); });
  assert.equal(screen.queryByText(/Shortcut compile error/), null);
  assert.ok(screen.getByRole('button', { name: /Problems: 0/ }));
  assert.equal(builds.length, 2);
  await act(async () => {
    AuthoringWorker.all.at(-1)!.reply({ type: 'failure', message: 'test cleanup' });
    await new Promise(resolve => setTimeout(resolve, 350));
    AuthoringWorker.all.at(-1)!.reply({ type: 'failure', message: 'test cleanup' });
  });
});
