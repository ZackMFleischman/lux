import { z } from 'zod';
import type { SerializedDockview } from 'dockview-react';
import type { PanelRegistry } from './registry.ts';

export const DOCKVIEW_VERSION = '7.0.4';
export const LAYOUT_BYTE_LIMIT = 131072;
export type PersonalLayout = { format: 'lux-personal-layout'; version: 1; dockviewVersion: typeof DOCKVIEW_VERSION; name: string; dock: SerializedDockview; closedPanels: SerializedDockview['panels'] };
const id = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
const size = z.number().finite().min(0).max(32768);
const group = z.object({ id, views: z.array(id).min(1).max(32), activeView: id.optional(),
  locked: z.literal(false).optional(), hideHeader: z.literal(false).optional(), headerPosition: z.enum(['top', 'bottom', 'left', 'right']).optional() }).strict();
type GridNode = { type: 'leaf'; data: z.infer<typeof group>; size?: number; visible?: boolean } | { type: 'branch'; data: GridNode[]; size?: number };
const node: z.ZodType<GridNode> = z.lazy(() => z.union([
  z.object({ type: z.literal('leaf'), data: group, size: size.optional(), visible: z.literal(true).optional() }).strict(),
  z.object({ type: z.literal('branch'), data: z.array(node).max(64), size: size.optional() }).strict(),
]));
const panel = z.object({ id, contentComponent: z.string().min(1).max(32), tabComponent: z.undefined().optional(), title: z.string().max(80).optional(), renderer: z.literal('always').optional(),
  params: z.object({ viewState: z.record(z.unknown()) }).strict().optional(),
  minimumWidth: size.optional(), minimumHeight: size.optional(), maximumWidth: size.optional(), maximumHeight: size.optional(),
}).strict();
const schema = z.object({ format: z.literal('lux-personal-layout'), version: z.literal(1), dockviewVersion: z.literal(DOCKVIEW_VERSION),
  name: z.string().trim().min(1).max(80), dock: z.object({
    grid: z.object({ root: node, height: size, width: size, orientation: z.enum(['HORIZONTAL', 'VERTICAL']) }).strict(),
    panels: z.record(panel), activeGroup: id.optional(), floatingGroups: z.array(z.never()).max(0).optional(), popoutGroups: z.array(z.never()).max(0).optional(),
  }).strict(), closedPanels: z.record(panel).default({}),
}).strict();
export function validatePersonalLayout(value: unknown, registry: PanelRegistry): PersonalLayout {
  // Bound recursive input before the schema walks it. No executable/component data
  // or runtime identities are admitted through a persisted panel's view state.
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }]; let entries = 0;
  while (stack.length) {
    const item = stack.pop()!; if (++entries > 4096 || item.depth > 32) throw Error('Layout is too complex');
    if (['function', 'symbol', 'bigint'].includes(typeof item.value) || (typeof item.value === 'number' && !Number.isFinite(item.value))) throw Error('Layout must contain JSON data');
    if (item.value && typeof item.value === 'object') for (const [key, child] of Object.entries(item.value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('Unsafe layout key');
      stack.push({ value: child, depth: item.depth + 1 });
    }
  }
  const result = schema.parse(value);
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > LAYOUT_BYTE_LIMIT) throw Error('Layout exceeds 128 KiB');
  if (Object.keys(result.dock.panels).length + Object.keys(result.closedPanels).length > 32) throw Error('Too many panels');
  const counts = new Map<string, number>(), seenPanels = new Set<string>(), seenGroups = new Set<string>();
  for (const [panelId, record] of [...Object.entries(result.dock.panels), ...Object.entries(result.closedPanels)]) {
    if (record.id !== panelId) throw Error('Panel identity mismatch');
    const definition = registry.get(record.contentComponent), count = (counts.get(definition.kind) ?? 0) + 1;
    if (!definition.multiple && count > 1) throw Error('Duplicate singleton panel: ' + definition.kind);
    counts.set(definition.kind, count);
    if ((record.minimumWidth ?? 0) > (record.maximumWidth ?? 32768) || (record.minimumHeight ?? 0) > (record.maximumHeight ?? 32768)) throw Error('Inconsistent panel size constraints');
    record.params = { viewState: definition.parseViewState(record.params?.viewState) };
    record.title = definition.title; record.renderer = 'always';
  }
  if (Object.keys(result.closedPanels).some(panelId => Object.hasOwn(result.dock.panels, panelId))) throw Error('Panel is both open and closed');
  function walk(current: GridNode, depth: number) {
    if (depth > 12) throw Error('Layout grid is too deep');
    if (current.type === 'branch') { for (const child of current.data) walk(child, depth + 1); return; }
    if (seenGroups.has(current.data.id)) throw Error('Duplicate group identity'); seenGroups.add(current.data.id);
    for (const panelId of current.data.views) {
      if (!Object.hasOwn(result.dock.panels, panelId) || seenPanels.has(panelId)) throw Error('Invalid panel reference');
      seenPanels.add(panelId);
    }
    if (current.data.activeView && !current.data.views.includes(current.data.activeView)) throw Error('Invalid active panel');
  }
  walk(result.dock.grid.root, 0);
  if (seenPanels.size !== Object.keys(result.dock.panels).length) throw Error('Unreachable panel');
  if (result.dock.activeGroup && !seenGroups.has(result.dock.activeGroup)) throw Error('Invalid active group');
  return result as PersonalLayout;
}
export function parsePersonalLayout(text: string, registry: PanelRegistry): PersonalLayout {
  if (new TextEncoder().encode(text).byteLength > LAYOUT_BYTE_LIMIT) throw Error('Layout exceeds 128 KiB');
  return validatePersonalLayout(JSON.parse(text), registry);
}
export function defaultPersonalLayout(registry: PanelRegistry, mode: 'desktop' | 'laptop'): PersonalLayout {
  const panels = Object.fromEntries(['preview', 'source', 'inspector', 'jobs'].map(kind => [kind, { id: kind, contentComponent: kind, title: registry.get(kind).title, renderer: 'always' as const, params: { viewState: {} } }]));
  const leaf = (id: string, views: string[], size: number): GridNode => ({ type: 'leaf', size, data: { id, views, activeView: views[0] } });
  const root: GridNode = mode === 'laptop' ? { type: 'branch', data: [leaf('workspace', Object.keys(panels), 900)] } : {
    type: 'branch', data: [
      { type: 'branch', size: 1200, data: [
        { type: 'branch', size: 800, data: [leaf('source-group', ['source'], 400), leaf('preview-group', ['preview'], 800)] },
        leaf('jobs-group', ['jobs'], 100),
      ] }, leaf('inspector-group', ['inspector'], 240),
    ],
  };
  return validatePersonalLayout({ format: 'lux-personal-layout', version: 1, dockviewVersion: DOCKVIEW_VERSION, name: mode === 'desktop' ? 'Desktop' : 'Laptop',
    dock: { grid: { root, width: mode === 'desktop' ? 1440 : 900, height: 900, orientation: 'HORIZONTAL' }, panels, activeGroup: mode === 'desktop' ? 'preview-group' : 'workspace' } }, registry);
}
