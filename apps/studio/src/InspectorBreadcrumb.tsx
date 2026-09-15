import { useRef, useState } from 'react';
import { Button, Menu, MenuItem } from '@mui/material';
import type { NodePath } from '../../../packages/runtime-contracts/src/graph.ts';
import type { RuntimeView } from './service-client.ts';
import { compositionNodeLabel, compositionOccurrence, nodeKey } from './GraphPanel.tsx';

/** A single quiet line; intermediate ancestors stay available in the parent menu. */
export function InspectorBreadcrumb({ runtime, path, onSelect }: {
  runtime: RuntimeView | null; path?: NodePath; onSelect: (path: NodePath | null) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const currentButton = useRef<HTMLButtonElement>(null);
  const selectedParent = useRef(false);
  const parents = (path ?? []).slice(0, -1).map((_, index) => path!.slice(0, index + 1) as NodePath);
  const hasComponent = !!path?.length;
  const available = !hasComponent || !!compositionOccurrence(runtime, path!);
  const label = available ? compositionNodeLabel(runtime, path ?? []) : 'Unavailable component';
  if (!hasComponent) return null;
  return <nav className="inspector-breadcrumb" aria-label="Inspector controls path"><ol>
    <li><Button color="inherit" ref={hasComponent ? undefined : currentButton} aria-label="Scene controls"
      aria-current={!hasComponent ? 'page' : undefined}
      onClick={event => {
        event.currentTarget.closest('details')?.querySelector('summary')?.focus();
        onSelect(null);
      }}>Scene</Button></li>
    {parents.length > 0 && <li><Button color="inherit" aria-label="Parent controls" title="Parent controls"
      aria-haspopup="menu" aria-expanded={!!anchor} onClick={event => { selectedParent.current = false; setAnchor(event.currentTarget); }}>…</Button></li>}
    {hasComponent && <li className="inspector-current"><Button color="inherit" ref={currentButton} disabled={!available}
      aria-label={`Controls for ${label}`} aria-current="page" title={label}
      onClick={event => { event.currentTarget.focus(); onSelect(path!); }}><span>{label}</span></Button></li>}
  </ol>
    <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} disableRestoreFocus={selectedParent.current}
      slotProps={{ list: { dense: true, 'aria-label': 'Parent controls' }, transition: { onExited: () => { if (selectedParent.current) currentButton.current?.focus(); } } }}>
      {parents.map(parent => <MenuItem key={nodeKey(parent)} disabled={!compositionOccurrence(runtime, parent)} sx={{ fontSize: 12, minHeight: 28 }}
        onClick={() => { selectedParent.current = true; setAnchor(null); onSelect(parent); }}>{compositionNodeLabel(runtime, parent)}</MenuItem>)}
    </Menu>
  </nav>;
}
