import { Button } from '@mui/material';
import type { NodePath } from '../../../packages/runtime-contracts/src/graph.ts';
import type { RuntimeView } from './service-client.ts';
import { compositionNodeLabel, compositionOccurrence, nodeKey } from './GraphPanel.tsx';

/** Inspector navigation does not depend on the Graph panel being open. */
export function InspectorBreadcrumb({ runtime, path, onSelect }: {
  runtime: RuntimeView | null; path?: NodePath; onSelect: (path: NodePath | null) => void;
}) {
  const ancestors = (path ?? []).map((_, index) => path!.slice(0, index + 1) as NodePath);
  const items = [
    { key: 'scene', label: 'Scene', path: null, available: true },
    ...ancestors.map(parent => ({
      key: nodeKey(parent), label: compositionNodeLabel(runtime, parent), path: parent,
      available: !!compositionOccurrence(runtime, parent),
    })),
  ];
  return <nav className="inspector-breadcrumb" aria-label="Inspector controls path"><ol>
    {items.map((item, index) => <li key={item.key}>
      <Button color="inherit" disabled={!item.available}
        aria-label={item.path ? `Controls for ${item.label}` : 'Scene controls'}
        aria-current={index === items.length - 1 ? 'page' : undefined}
        onClick={event => { event.currentTarget.focus(); onSelect(item.path); }}>
        {item.available ? item.label : 'Unavailable component'}
      </Button>
    </li>)}
  </ol></nav>;
}
