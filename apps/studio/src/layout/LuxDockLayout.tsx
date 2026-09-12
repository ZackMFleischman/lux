import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { Button, Menu, MenuItem, Tooltip } from '@mui/material';
import type { FunctionComponent } from 'react';
import { DockviewReact, themeDark } from 'dockview-react';
import type { IDockviewHeaderActionsProps, IDockviewPanelProps } from 'dockview-react';
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
  const HeaderActions = useMemo(() => function GroupActions({ group, activePanel, containerApi }: IDockviewHeaderActionsProps) {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null), [error, setError] = useState('');
    const id = useId(), selected = useRef(false);
    return <><Tooltip title="Add pane"><Button className="pane-add" aria-label={`Add pane to ${activePanel?.title ?? 'empty'} group`}
      aria-haspopup="menu" aria-expanded={!!anchor} aria-controls={anchor ? id : undefined}
      onPointerDown={event => event.stopPropagation()} onClick={event => { selected.current = false; setError(''); setAnchor(event.currentTarget); }}>+</Button></Tooltip>
      <Menu id={id} anchorEl={anchor} open={!!anchor} disableRestoreFocus={selected.current} slotProps={{ transition: { onExited: () => { if (selected.current && containerApi.getGroup(group.id) === group) group.focus(); } } }} onClose={() => setAnchor(null)}
        onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setAnchor(null); } }}>
        {registry.list().map(definition => {
          const action = adapter.current?.groupAction(definition.kind, group) ?? 'Open';
          return <MenuItem key={definition.kind} onClick={() => {
            try { adapter.current?.openInGroup(definition.kind, group); selected.current = true; setAnchor(null); }
            catch (reason) { setError(String(reason)); }
          }}>{action === 'Move' ? `Move ${definition.title} here` : `${action} ${definition.title}`}</MenuItem>;
        })}
        {error && <li role="alert">{error}</li>}
      </Menu></>;
  }, [registry]);
  useEffect(() => () => { adapter.current?.dispose(); adapter.current = null; }, []);
  if (!/^[A-Za-z0-9+/=]{24,64}$/.test(nonce)) throw Error('Studio style nonce unavailable');
  return <DockviewReact rightHeaderActionsComponent={HeaderActions} components={components} theme={themeDark} nonce={nonce} disableFloatingGroups
    dndStrategy="pointer" onReady={event => {
      adapter.current?.dispose();
      const current = new LuxDockviewAdapter(event.api, registry, storage, mode); adapter.current = current;
      const result = current.restore(name); onReady?.(current, result);
    }} />;
}
