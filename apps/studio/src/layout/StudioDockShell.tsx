import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Alert, Button, TextField } from '@mui/material';
import { LuxDockLayout } from './LuxDockLayout.tsx';
import { createStudioPanelRegistry, PanelRegistry } from './registry.ts';
import type { LuxDockviewAdapter, LayoutStorage } from './dockview-adapter.ts';

const kinds = ['preview', 'source', 'inspector', 'jobs'] as const;
type Kind = typeof kinds[number];
// Resolve Storage only during an operation so denied access uses adapter recovery.
const storage: LayoutStorage = {
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: key => window.localStorage.removeItem(key),
};
/** The portals own real panes above Dockview mounts. Reparenting their host preserves
 * the same canvas, editor/undo, subscriptions and React state even through closure. */
export function StudioDockShell({ compact, ...content }: { compact: boolean } & Record<Kind, ReactNode>) {
  const [mode] = useState<'desktop' | 'laptop'>(() => window.innerWidth < 1100 ? 'laptop' : 'desktop');
  const [name, setName] = useState('Default'), [message, setMessage] = useState('');
  const [panel, setPanel] = useState<Kind>('source'), [reference, setReference] = useState<Kind>('preview');
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
  function action(run: (value: LuxDockviewAdapter) => void) {
    try { if (!adapter.current) throw Error('Layout is loading'); run(adapter.current); }
    catch (reason) { setMessage(String(reason)); }
  }
  function reset(next: 'desktop' | 'laptop') {
    action(value => { value.reset(name, next); setMessage(`Reset to ${next} layout`); });
  }
  const nonce = document.querySelector<HTMLMetaElement>('meta[name="style-nonce"]')?.content ?? '';
  return <div className={`studio-dock-shell ${compact ? 'dock-compact' : ''}`}>
    <details className="layout-tools" hidden={compact}><summary>View & layouts</summary><div className="layout-tools-content">
      <div className="layout-actions" aria-label="Add panel">{kinds.map(kind => <Button key={kind} onClick={() => action(value => value.open(kind))}>Open {registry.get(kind).title}</Button>)}</div>
      <div className="layout-actions"><TextField size="small" label="Layout name" value={name} onChange={event => setName(event.target.value)} />
        <Button onClick={() => action(value => { value.save(name); setMessage(`Saved layout: ${name}`); })}>Save layout</Button>
        <Button onClick={() => action(value => { const result = value.restore(name); setMessage(result.restored ? `Restored layout: ${name}` : result.reason ?? 'Default layout restored'); })}>Restore layout</Button>
        <Button onClick={() => reset('desktop')}>Reset desktop layout</Button><Button onClick={() => reset('laptop')}>Reset laptop layout</Button></div>
      <div className="layout-actions"><label>Move panel <select aria-label="Move panel" value={panel} onChange={event => setPanel(event.target.value as Kind)}>{kinds.map(kind => <option key={kind}>{kind}</option>)}</select></label>
        <label>Relative to <select aria-label="Relative to" value={reference} onChange={event => setReference(event.target.value as Kind)}>{kinds.map(kind => <option key={kind}>{kind}</option>)}</select></label>
        {(['left', 'right', 'top', 'bottom', 'center'] as const).map(position => <Button key={position} onClick={() => action(value => value.move(panel, reference, position))}>Move {position === 'center' ? 'to tab group' : position}</Button>)}
        <Button onClick={() => action(value => value.close(panel))}>Close selected panel</Button></div>
      {message && <Alert severity="info" role="status">{message}</Alert>}
    </div></details>
    <div className="studio-dock-grid" hidden={compact}><LuxDockLayout registry={registry} panels={panels} storage={storage} nonce={nonce} mode={mode}
      onReady={(value, result) => { adapter.current = value; if (result.reason && result.reason !== 'No saved personal layout') setMessage(result.reason); }} /></div>
    <div className="studio-expanded-pane" hidden={!compact} ref={expanded} />
    {kinds.map(kind => createPortal(content[kind], hosts[kind], kind))}
  </div>;
}
