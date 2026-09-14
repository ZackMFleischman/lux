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
const { render, screen, cleanup, fireEvent, act, waitFor, within } = await import('@testing-library/react');
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
    sourcePanel={<SourcePanel workspace={workspace} readOnly={false} onApply={() => {}} onSave={() => {}} />}
    libraryPanel={<section aria-label="Library fixture">Library fixture</section>} />);
  await waitFor(() => assert.equal(attaches, 1));
  const editorNode = document.querySelector('.cm-editor') as HTMLElement;
  const editor = EditorView.findFromDOM(editorNode)!;
  await act(async () => { editor.dispatch({ changes: { from: 0, insert: '// draft\n' } }); });
  await act(async () => { fireEvent.click(screen.getByText('View')); });
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
  assert.equal(document.querySelectorAll('.studio-dock-grid .dv-groupview').length, 4);
  assert.equal(groupFor('Source'), groupFor('Preview'));
  assert.notEqual(groupFor('Library'), groupFor('Preview'));
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
  assert.equal(document.querySelectorAll('.studio-dock-grid .dv-groupview').length, 4);
  assert.equal(groupFor('Source'), groupFor('Preview'));
  assert.notEqual(groupFor('Library'), groupFor('Preview'));
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
  await click('Maximize');
  await click('Show Inspector');
  const maximizedIntensity = screen.getByRole('slider', { name: 'Intensity' });
  await click('Hide Inspector');
  assert.equal(maximizedIntensity.closest('.studio-expanded-pane'), null);
  await click('Show Inspector');
  assert.equal(screen.getByRole('slider', { name: 'Intensity' }), maximizedIntensity);
  assert.equal(maximizedIntensity.closest('.studio-expanded-pane')?.hasAttribute('hidden'), false);
  await click('Restore workspace');
  await act(async () => { snapshot = { ...snapshot, authoring: { ...runtime, frameId: '11' } }; for (const listener of listeners) listener(); });
  await click('Open Inspector');
  assert.ok(screen.getByText('11'));
  await click('Open Preview');
  assert.equal(document.querySelector('.cm-editor'), editorNode);
  assert.equal(attaches, 1); assert.equal(detaches, 0); assert.equal(subscriptions, 1);
  for (const kind of ['preview', 'source', 'library', 'inspector', 'jobs']) {
    fireEvent.change(screen.getByLabelText('Move panel'), { target: { value: kind } });
    await click('Close selected panel');
  }
  assert.equal(document.querySelectorAll('.studio-dock-grid .dv-groupview').length, 0);
  await click('Open Source'); await click('Open Preview');
  assert.equal(document.querySelector('.cm-editor'), editorNode);
  assert.ok(document.contains(canvas));
  assert.equal(attaches, 1); assert.equal(subscriptions, 1);
  ui.unmount(); await act(async () => {});
  assert.equal(detaches, 1); assert.equal(subscriptions, 0);
});


test('group menu targets its owning group, cancels with focus and rejects a vanished target', async () => {
  const { LuxDockLayout } = await import('../../apps/studio/src/layout/LuxDockLayout.tsx');
  const { createStudioPanelRegistry } = await import('../../apps/studio/src/layout/registry.ts');
  let adapter: any;
  const registry = createStudioPanelRegistry();
  const ui = render(<LuxDockLayout registry={registry} panels={Object.fromEntries(registry.list().map(def => [def.kind, () => <div>{def.kind} content</div>]))}
    storage={window.localStorage} name="group-test" nonce="abcdefghijklmnopqrstuvwx" onReady={value => { adapter = value; }} />);
  const trigger = screen.getByRole('button', { name: 'Add pane to Preview group' });
  await act(async () => { trigger.focus(); fireEvent.click(trigger); });
  const focus = screen.getByRole('menuitem', { name: 'Focus Preview' });
  assert.equal(document.activeElement, focus);
  fireEvent.keyDown(focus, { key: 'ArrowDown' });
  assert.equal(document.activeElement, screen.getByRole('menuitem', { name: 'Move Source here' }));
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  await waitFor(() => assert.equal(document.activeElement, trigger));
  await act(async () => { fireEvent.click(trigger); });
  await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Move Source here' })); });
  await waitFor(() => assert.ok(document.activeElement?.closest('.dv-groupview')));
  let layout = adapter.capture('check');
  const groups = (node: any): any[] => node.type === 'leaf' ? [node.data] : node.data.flatMap(groups);
  assert.deepEqual(groups(layout.dock.grid.root).find((g: any) => g.id === 'preview-group').views, ['preview', 'source']);
  await act(async () => { adapter.close('source'); });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add pane to Preview group' })); });
  await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Open Source' })); });
  assert.ok(groups(adapter.capture('check').dock.grid.root).find((g: any) => g.id === 'preview-group').views.includes('source'));
  const target = adapter.groupTarget('jobs-group');
  await act(async () => { adapter.close('jobs'); });
  const before = adapter.capture('check');
  assert.throws(() => adapter.openInGroup('source', target), /no longer exists/);
  assert.deepEqual(adapter.capture('check'), before);
  ui.unmount();
});

test('Graph selects an instance, opens Inspector, writes only that node and preserves selection across panel closure',async()=>{
  const {parse}=await import('@babel/parser');
  const {createHash}=await import('node:crypto');
  const {extractCompositionDeclaration}=await import('../../apps/build-worker/src/composition-declarations.mjs');
  const {compositionSourceBundle,kaleidoscopeAId,kaleidoscopeBId}=await import('../compiler/composition-fixture.mjs');
  const {createCompositionControlState}=await import('../../packages/runtime/src/components/composition-controls.ts');
  const source=compositionSourceBundle(),asts=Object.fromEntries(Object.entries(source.files).map(([path,text])=>[path,parse(text,{sourceType:'module',plugins:['typescript']})]));
  const composition=extractCompositionDeclaration({entry:source.entry,files:source.files,asts,hash:(value:string)=>createHash('sha256').update(value).digest('hex')})!;
  const state=createCompositionControlState(composition);
  let runtime:any={instanceId:'graph-instance',generation:1,revisionId:'graph-revision',sceneName:'Graph fixture',authority:'studio',playback:'paused',clockEpoch:0,frameId:'1',output:{width:1280,height:720},fault:null,sdkVersion:'0.4.0',controlSchema:composition.publicControls,controlSchemaHash:'a'.repeat(64),controls:state.values(),controlSequence:0,nodeControls:{sourceHash:'graph-revision',nodes:state.snapshot().nodes},composition};
  let snapshot:any={connection:'connected',message:null,receivedAtMs:1000,authoring:runtime,host:null,jobs:[],visualFps:null,uiFps:null};
  const calls:any[]=[],listeners=new Set<()=>void>();
  const client={getSnapshot:()=>snapshot,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},invoke:async(op:any)=>{
    calls.push(op);assert.equal(op.name,'lux.node.parameters.set');state.applyNode(op.input.nodePath,op.input.values,op.input.expectedControlSchemaHash);
    runtime={...runtime,controls:state.values(),nodeControls:{sourceHash:runtime.revisionId,nodes:state.snapshot().nodes},controlSequence:runtime.controlSequence+1};snapshot={...snapshot,authoring:runtime};listeners.forEach(fn=>fn());
  }};
  window.localStorage.clear();
  const ui=render(<StudioApp client={client} nowMs={1000} sourcePanel={<div>Source fixture</div>}/>);
  await act(async()=>{fireEvent.click(screen.getByText('View'));});await click('Open Graph');
  const nodes=[...document.querySelectorAll<HTMLButtonElement>('.graph-node')];assert.equal(nodes.length,3);
  assert.equal(document.querySelectorAll('.graph-wires path').length,2);
  assert.equal(document.querySelectorAll('.graph-final-output').length,1);
  fireEvent.change(screen.getByLabelText('Move panel'),{target:{value:'inspector'}});await click('Close selected panel');
  await act(async()=>{nodes[1]!.focus();fireEvent.click(nodes[1]!);});
  assert.ok(document.querySelector('.inspector'));
  assert.equal(calls.length,0,'selection must not invoke a runtime operation');
  const selectedInspector=within(document.querySelector('.inspector')!);
  const selectedControlLabel=selectedInspector.getByText('Segments');
  assert.ok(selectedInspector.getByText('Mirror segments'));
  assert.equal(selectedControlLabel.getAttribute('tabindex'),'0','selected-node help must remain keyboard accessible');
  fireEvent.mouseOver(selectedControlLabel);
  assert.ok(await screen.findByRole('tooltip',{name:'Mirror segments'}));
  fireEvent.mouseOut(selectedControlLabel);
  const input=document.querySelector<HTMLInputElement>('.inspector input[type="number"]')!;
  await act(async()=>{fireEvent.change(input,{target:{value:'8'}});fireEvent.keyDown(input,{key:'Enter'});});
  assert.equal(calls.length,1);assert.deepEqual(calls[0].input.nodePath,[kaleidoscopeAId]);
  assert.equal(runtime.controls.segmentsA,8);assert.equal(runtime.controls.segmentsB,6);
  await click('Zoom in');const transform=document.querySelector<HTMLElement>('.graph-content')!.style.transform;
  fireEvent.change(screen.getByLabelText('Move panel'),{target:{value:'graph'}});await click('Close selected panel');await click('Open Graph');
  assert.equal(document.querySelector<HTMLElement>('.graph-content')!.style.transform,transform);
  assert.equal(nodes[1]!.getAttribute('aria-pressed'),'true');
  await act(async()=>{fireEvent.click(nodes[2]!);});
  assert.equal(document.querySelector<HTMLInputElement>('.inspector input[type="number"]')!.value,'6');
  assert.equal(runtime.nodeControls.nodes.find((node:any)=>node.nodePath[0]===kaleidoscopeBId).values.segments,6);
  assert.equal(runtime.generation,1);assert.equal(runtime.playback,'paused');ui.unmount();
});
