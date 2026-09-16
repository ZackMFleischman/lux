import { StudioMenu } from '../StudioMenu.tsx';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Alert, Button, TextField, Menu, MenuItem, Divider, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { LuxDockLayout } from './LuxDockLayout.tsx';
import { createStudioPanelRegistry, PanelRegistry } from './registry.ts';
import type { LuxDockviewAdapter, LayoutStorage } from './dockview-adapter.ts';

const kinds = ['preview', 'source', 'library', 'inspector', 'diagnostics', 'jobs', 'graph'] as const;
type Kind = typeof kinds[number];
// Resolve Storage only during an operation so denied access uses adapter recovery.
const storage: LayoutStorage = {
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: key => window.localStorage.removeItem(key),
};
/** The portals own real panes above Dockview mounts. Reparenting their host preserves
 * the same canvas, editor/undo, subscriptions and React state even through closure. */
export function StudioDockShell({ compact, showInspector, toolsHost, onOpenPanelReady, ...content }: { compact: boolean; showInspector: boolean; toolsHost?: HTMLElement | null; onOpenPanelReady?: (action:null|((kind:Kind)=>void))=>void } & Record<Exclude<Kind,'graph'>, ReactNode> & {graph?:ReactNode}) {
  const [mode] = useState<'desktop' | 'laptop'>(() => window.innerWidth < 1100 ? 'laptop' : 'desktop');
  const [name, setName] = useState('Default'), [message, setMessage] = useState('');
  const [layoutsOpen, setLayoutsOpen] = useState(false);
  const viewButton = useRef<HTMLButtonElement | null>(null);
  const adapter = useRef<LuxDockviewAdapter | null>(null), expanded = useRef<HTMLDivElement>(null);
  const compactRef = useRef(compact); compactRef.current = compact;
  const hosts = useMemo(() => Object.fromEntries(kinds.map(kind => {
    const host = document.createElement('div'); host.className = `studio-pane-host studio-pane-${kind}`;
    return [kind, host];
  })) as Record<Kind, HTMLDivElement>, []);
  const slots = useRef<Partial<Record<Kind, HTMLDivElement>>>({});
  const registry = useMemo(() => new PanelRegistry(createStudioPanelRegistry().list().map(definition => ({ ...definition, multiple: false }))), []);
  const panels = useMemo(() => Object.fromEntries(kinds.map(kind => [kind, function PaneSlot() {
    const slot = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
      slots.current[kind] = slot.current!;
      if (!(kind === 'preview' && compactRef.current)) slot.current!.append(hosts[kind]);
      return () => { delete slots.current[kind]; if (hosts[kind].parentElement === slot.current) hosts[kind].remove(); };
    }, []);
    return <div ref={slot} className="studio-pane-slot" />;
  }])), [hosts]);
  useLayoutEffect(() => {
    const destination = compact ? expanded.current : slots.current.preview;
    if (destination) destination.append(hosts.preview); else hosts.preview.remove();
  }, [compact, hosts]);
  useLayoutEffect(() => {
    const destination = compact && showInspector ? expanded.current : slots.current.inspector;
    if (destination) destination.append(hosts.inspector); else hosts.inspector.remove();
  }, [compact, hosts, showInspector]);
  function action(run: (value: LuxDockviewAdapter) => void) {
    try { if (!adapter.current) throw Error('Layout is loading'); run(adapter.current); }
    catch (reason) { setMessage(String(reason)); }
  }
  useLayoutEffect(()=>()=>onOpenPanelReady?.(null),[onOpenPanelReady]);
  function reset(next: 'desktop' | 'laptop') {
    action(value => { value.reset(name, next); setMessage(`Reset to ${next} layout`); });
  }
  const nonce = document.querySelector<HTMLMetaElement>('meta[name="style-nonce"]')?.content ?? '';
  const tools = <div className="layout-tools" hidden={compact}>
    <StudioMenu label="View" buttonRef={viewButton}>
      {kinds.map(kind => <MenuItem key={kind} onClick={() => action(value => value.open(kind))}>{registry.get(kind).title}</MenuItem>)}
      <Divider />
      <MenuItem onClick={() => setLayoutsOpen(true)}>Layouts…</MenuItem>
    </StudioMenu>
    <Dialog open={layoutsOpen} onClose={() => setLayoutsOpen(false)} aria-labelledby="workspace-layouts-title"
      maxWidth="xs" fullWidth slotProps={{ transition: { onExited: () => viewButton.current?.focus() } }}
      onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}>
      <DialogTitle id="workspace-layouts-title">Workspace layouts</DialogTitle>
      <DialogContent>
        <div className="layout-actions"><TextField size="small" label="Layout name" value={name} onChange={event => setName(event.target.value)} />
        <Button onClick={() => action(value => { value.save(name); setMessage(`Saved layout: ${name}`); })}>Save layout</Button>
        <Button onClick={() => action(value => { const result = value.restore(name); setMessage(result.restored ? `Restored layout: ${name}` : result.reason ?? 'Default layout restored'); })}>Restore layout</Button>
        <Button onClick={() => reset('desktop')}>Reset desktop layout</Button><Button onClick={() => reset('laptop')}>Reset laptop layout</Button></div>
        {message && <Alert severity="info" role="status">{message}</Alert>}
      </DialogContent>
      <DialogActions><Button onClick={() => setLayoutsOpen(false)}>Done</Button></DialogActions>
    </Dialog>
  </div>;
  return <div className={`studio-dock-shell ${compact ? 'dock-compact' : ''}`}>
    {toolsHost ? createPortal(tools, toolsHost) : tools}
    {message && !layoutsOpen && <Alert severity="info" role="status" onClose={() => setMessage('')}>{message}</Alert>}

    <div className="studio-dock-grid" hidden={compact}><LuxDockLayout registry={registry} panels={panels} storage={storage} nonce={nonce} mode={mode}
      onReady={(value, result) => { adapter.current = value; onOpenPanelReady?.(kind=>{if(kind==='inspector')value.openBeside(kind,'graph');else value.open(kind);}); if (result.reason && result.reason !== 'No saved personal layout') setMessage(result.reason); }} /></div>
    <div className={`studio-expanded-pane ${showInspector ? 'studio-expanded-with-inspector' : ''}`} hidden={!compact} ref={expanded} />
    {kinds.map(kind => createPortal(content[kind], hosts[kind], kind))}
  </div>;
}
