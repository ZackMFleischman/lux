import { useEffect, useMemo, useRef } from 'react';
import type { FunctionComponent } from 'react';
import { DockviewReact, themeDark } from 'dockview-react';
import type { IDockviewPanelProps } from 'dockview-react';
import { LuxDockviewAdapter } from './dockview-adapter.ts';
import type { LayoutStorage, RestoreResult } from './dockview-adapter.ts';
import type { PanelRegistry } from './registry.ts';
import 'dockview-react/dist/styles/dockview.css';

export type LuxPanelProps = { panelId: string; viewState: Readonly<Record<string, unknown>>; setViewState(value: unknown): void };
/** Content closures bind application-owned stores/presentation leases above this shell. */
export function LuxDockLayout({ registry, panels, storage, name = 'Default', mode = 'desktop', nonce, onReady }: {
  registry: PanelRegistry; panels: Record<string, FunctionComponent<LuxPanelProps>>; storage: LayoutStorage;
  name?: string; mode?: 'desktop' | 'laptop'; nonce: string;
  onReady?(adapter: LuxDockviewAdapter, result: RestoreResult): void;
}) {
  const adapter = useRef<LuxDockviewAdapter | null>(null);
  const components = useMemo(() => Object.fromEntries(registry.list().map(definition => {
    const Panel = panels[definition.kind]; if (!Panel) throw Error('Missing real panel renderer: ' + definition.kind);
    const Component: FunctionComponent<IDockviewPanelProps> = props => <Panel panelId={props.api.id}
      viewState={definition.parseViewState(props.params?.viewState)} setViewState={value => props.api.updateParameters({ viewState: definition.parseViewState(value) })} />;
    return [definition.kind, Component];
  })), [registry, panels]);
  useEffect(() => () => { adapter.current?.dispose(); adapter.current = null; }, []);
  if (!/^[A-Za-z0-9+/=]{24,64}$/.test(nonce)) throw Error('Studio style nonce unavailable');
  return <DockviewReact components={components} theme={themeDark} nonce={nonce} disableFloatingGroups
    dndStrategy="pointer" onReady={event => {
      adapter.current?.dispose();
      const current = new LuxDockviewAdapter(event.api, registry, storage, mode); adapter.current = current;
      const result = current.restore(name); onReady?.(current, result);
    }} />;
}
