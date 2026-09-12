import type { DockviewApi, SerializedDockview } from 'dockview-react';
import type { PanelRegistry } from './registry.ts';
import { isReservedPanelKey } from './registry.ts';
import { DOCKVIEW_VERSION, defaultPersonalLayout, parsePersonalLayout, validatePersonalLayout } from './personal-layout.ts';
import type { PersonalLayout } from './personal-layout.ts';

/** Machine-local storage only. Do not route these bytes into SceneFileStore/export. */
export type LayoutStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type RestoreResult = { restored: boolean; reason?: string };
export class LuxDockviewAdapter {
  private api: DockviewApi;
  private registry: PanelRegistry;
  private storage: LayoutStorage;
  private mode: 'desktop' | 'laptop';
  private closed: SerializedDockview['panels'] = {};
  private applying = false;
  private disposed = false;
  private subscription: { dispose(): void };
  constructor(api: DockviewApi, registry: PanelRegistry, storage: LayoutStorage, mode: 'desktop' | 'laptop') {
    this.api = api; this.registry = registry; this.storage = storage; this.mode = mode;
    this.subscription = api.onDidRemovePanel(panel => { if (!this.applying && !this.disposed) this.closed[panel.id] = structuredClone(panel.toJSON()); });
  }
  private live() { if (this.disposed) throw Error('Layout adapter is disposed'); }
  private key(name: string) { if (!name.trim() || name.length > 80) throw Error('Invalid layout name'); return 'lux.personal-layout.v1.' + encodeURIComponent(name); }
  private apply(layout: PersonalLayout) {
    this.applying = true;
    try { this.api.fromJSON(layout.dock, { reuseExistingPanels: true }); this.closed = structuredClone(layout.closedPanels); }
    finally { this.applying = false; }
  }
  capture(name: string): PersonalLayout {
    this.live();
    // A move may emit remove/add. Only actually closed IDs enter persisted state.
    const closedPanels = Object.fromEntries(Object.entries(this.closed).filter(([id]) => !this.api.getPanel(id)));
    return validatePersonalLayout({ format: 'lux-personal-layout', version: 1, dockviewVersion: DOCKVIEW_VERSION, name, dock: this.api.toJSON(), closedPanels }, this.registry);
  }
  save(name: string): void { this.live(); const layout = this.capture(name); this.storage.setItem(this.key(name), JSON.stringify(layout)); }
  restore(name: string): RestoreResult {
    this.live();
    try {
      const text = this.storage.getItem(this.key(name));
      if (text === null) { this.apply(defaultPersonalLayout(this.registry, this.mode)); return { restored: false, reason: 'No saved personal layout' }; }
      this.apply(parsePersonalLayout(text, this.registry)); return { restored: true };
    } catch (error) {
      this.apply(defaultPersonalLayout(this.registry, this.mode));
      return { restored: false, reason: 'Saved layout unavailable or incompatible: ' + String(error) };
    }
  }
  reset(name: string): void { this.live(); this.apply(defaultPersonalLayout(this.registry, this.mode)); this.storage.removeItem(this.key(name)); }
  open(kind: string, id = kind): void {
    this.live(); const definition = this.registry.get(kind);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || isReservedPanelKey(id)) throw Error('Invalid panel identity');
    const existing = this.api.getPanel(id);
    if (existing) { if (existing.view.contentComponent !== kind) throw Error('Panel identity already belongs to another kind'); existing.api.setActive(); return; }
    if (!definition.multiple && this.api.panels.some(panel => panel.view.contentComponent === kind)) throw Error('Panel is already open');
    if (!definition.multiple && Object.entries(this.closed).some(([key, panel]) => key !== id && !this.api.getPanel(key) && panel.contentComponent === kind)) throw Error('Reopen the existing panel identity to preserve its view state');
    const previous = this.closed[id];
    if (previous && previous.contentComponent !== kind) throw Error('Closed panel identity belongs to another kind');
    if (this.api.panels.length + Object.keys(this.closed).filter(key => !this.api.getPanel(key)).length >= 32 && !previous) throw Error('Too many panels');
    this.api.addPanel({ id, component: kind, title: definition.title, renderer: 'always', params: { viewState: definition.parseViewState(previous?.params?.viewState) } });
    delete this.closed[id];
  }
  close(id: string): void { this.live(); const panel = this.api.getPanel(id); if (panel) this.api.removePanel(panel); }
  move(id: string, referenceId: string, position: 'left' | 'right' | 'top' | 'bottom' | 'center'): void {
    this.live(); const panel = this.api.getPanel(id), target = this.api.getPanel(referenceId);
    if (!panel || !target || panel === target) throw Error('Choose two different open panels');
    panel.api.moveTo({ group: target.group, position });
  }
  setViewState(id: string, value: unknown): void {
    this.live(); const panel = this.api.getPanel(id); if (!panel) throw Error('Panel is not open');
    panel.api.updateParameters({ viewState: this.registry.get(panel.view.contentComponent).parseViewState(value) });
  }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.subscription.dispose(); }
}
