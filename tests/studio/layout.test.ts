import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioPanelRegistry, PanelRegistry } from '../../apps/studio/src/layout/registry.ts';
import { defaultPersonalLayout, parsePersonalLayout, validatePersonalLayout } from '../../apps/studio/src/layout/personal-layout.ts';
import { LuxDockviewAdapter } from '../../apps/studio/src/layout/dockview-adapter.ts';
import { JSDOM } from 'jsdom';

test('versioned desktop split and laptop tab layouts contain only registered real panel kinds', () => {
  const registry = createStudioPanelRegistry();
  const desktop = defaultPersonalLayout(registry, 'desktop'), laptop = defaultPersonalLayout(registry, 'laptop');
  assert.deepEqual(Object.keys(desktop.dock.panels), ['preview', 'source', 'inspector', 'jobs']);
  assert.deepEqual(parsePersonalLayout(JSON.stringify(desktop), registry), desktop);
  assert.equal((laptop.dock.grid.root.data as any[])[0].data.views.length, 4);
  assert.notDeepEqual(desktop.dock.grid.root, laptop.dock.grid.root);
  assert.throws(() => registry.get('graph'), /Unavailable/);
  const expanded = createStudioPanelRegistry([{ kind: 'graph', title: 'Graph', multiple: false, parseViewState: () => ({}) }]);
  assert.equal(expanded.get('graph').title, 'Graph');
  assert.throws(() => new PanelRegistry([registry.get('preview'), registry.get('preview')]), /duplicate/);
});
test('layout parser rejects unsupported schema, unknown panels, state authority and unsafe references', () => {
  const registry = createStudioPanelRegistry(), base = defaultPersonalLayout(registry, 'desktop');
  const reject = (edit: (value: any) => void) => { const value = structuredClone(base); edit(value); assert.throws(() => validatePersonalLayout(value, registry)); };
  reject(value => value.version = 2); reject(value => value.dockviewVersion = '7.1.0');
  reject(value => value.dock.panels.preview.contentComponent = 'missing');
  reject(value => value.dock.panels.preview.params.viewState = { instanceId: 'runtime-must-not-live-here' });
  reject(value => value.dock.panels.preview.id = 'other');
  reject(value => value.dock.activeGroup = 'missing');
  reject(value => value.dock.grid.root.data[0].data[0].data[0].data.views = ['missing']);
  reject(value => value.dock.popoutGroups = [{ url: 'https://example.com' }]);
  reject(value => value.dock.floatingGroups = [{ position: { left: -999999 } }]);
  reject(value => value.closedPanels.preview = value.dock.panels.preview);
  assert.throws(() => parsePersonalLayout(' '.repeat(131073), registry), /128 KiB/);
  const cycle: any = {}; cycle.child = cycle; assert.throws(() => validatePersonalLayout(cycle, registry), /complex/);
});
test('inspector instances preserve independent locks and serialized title is canonicalized', () => {
  const registry = createStudioPanelRegistry(), layout = defaultPersonalLayout(registry, 'laptop');
  layout.dock.panels.inspector!.params = { viewState: { lockedTargetId: 'node-a' } };
  layout.dock.panels.second = { id: 'second', contentComponent: 'inspector', params: { viewState: { lockedTargetId: 'node-b' } } };
  (layout.dock.grid.root.data as any[])[0].data.views.push('second');
  layout.dock.panels.preview!.title = 'Injected title';
  const result = validatePersonalLayout(layout, registry);
  assert.equal(result.dock.panels.preview!.title, 'Preview');
  assert.equal(result.dock.panels.inspector!.params!.viewState.lockedTargetId, 'node-a');
  assert.equal(result.dock.panels.second!.params!.viewState.lockedTargetId, 'node-b');
});

test('real Dockview CPU adapter moves, saves, restores, reopens and resets without runtime authority', async t => {
  const dom = new JSDOM('<!doctype html><div id="dock"></div>', { pretendToBeVisual: true, url: 'http://localhost' });
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const globals: Record<string, unknown> = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
  };
  for (const [key, value] of Object.entries(globals)) { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  const { createDockview } = await import('dockview-react');
  const registry = createStudioPanelRegistry(), content = new Map<string, HTMLElement>();
  const api = createDockview(dom.window.document.getElementById('dock')!, { disableAutoResizing: true, disableFloatingGroups: true,
    createComponent: options => { const element = dom.window.document.createElement('section'); content.set(options.id, element); return { element, init() {} }; },
  });
  api.layout(1440, 900);
  const data = new Map<string, string>(), storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  const adapter = new LuxDockviewAdapter(api, registry, storage, 'desktop');
  t.after(() => { adapter.dispose(); api.dispose(); dom.window.close(); for (const [key, value] of originals) if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); });
  assert.equal(adapter.restore('Personal').restored, false); assert.equal(api.totalPanels, 4);
  adapter.setViewState('inspector', { lockedTargetId: 'node-a' });
  adapter.open('inspector', 'inspector-2'); adapter.setViewState('inspector-2', { lockedTargetId: 'node-b' });
  adapter.move('source', 'preview', 'center');
  assert.equal(api.getPanel('source')!.group.id, api.getPanel('preview')!.group.id);
  adapter.close('inspector-2'); adapter.save('Personal');
  assert.equal(api.getPanel('inspector-2'), undefined);
  adapter.reset('Temporary'); assert.equal(api.totalPanels, 4);
  assert.equal(adapter.restore('Personal').restored, true); adapter.open('inspector', 'inspector-2');
  assert.equal(api.getPanel('inspector-2')!.params!.viewState.lockedTargetId, 'node-b');
  assert.equal(api.getPanel('inspector')!.params!.viewState.lockedTargetId, 'node-a');
  assert.equal(api.getPanel('source')!.group.id, api.getPanel('preview')!.group.id);
  adapter.close('source'); assert.throws(() => adapter.open('source', 'different-source'), /existing panel identity/); adapter.open('source');
  const beforeFailure = JSON.stringify(adapter.capture('Before'));
  const oldSet = storage.setItem; storage.setItem = () => { throw Error('disk quota'); };
  assert.throws(() => adapter.save('Before'), /quota/); assert.equal(JSON.stringify(adapter.capture('Before')), beforeFailure); storage.setItem = oldSet;
  const read = storage.getItem; storage.getItem = () => { throw Error('storage unavailable'); };
  assert.match(adapter.restore('Unreadable').reason!, /storage unavailable/); assert.equal(api.totalPanels, 4); storage.getItem = read;
  data.set('lux.personal-layout.v1.Broken', '{bad'); assert.equal(adapter.restore('Broken').restored, false); assert.equal(api.totalPanels, 4);
  adapter.dispose(); assert.throws(() => adapter.save('Personal'), /disposed/);
});
