import { defineVisual } from '@lux/visual-sdk';
import group from './component-group.ts';

// `source-group` is a readable graph ID; use UUIDs only when discovery lacks uuid-or-readable-v1.

export default defineVisual({
  label: 'Component visual',
  definitions: { group },
  nodes: [{ id: 'source-group', definition: 'group' }],
  edges: [],
  output: { nodeId: 'source-group', portId: 'image' },
  expose: [{ id: 'amount', nodeId: 'source-group', controlId: 'amount' }],
});
