import { defineComponent } from '@lux/visual-sdk';
import source from './source.ts';

// source.ts is an SDK 0.4 image-source component with an intensity control.
// `source` is a readable graph ID; use UUIDs only when discovery lacks uuid-or-readable-v1.
export default defineComponent({
  label: 'Reusable source',
  definitions: { source },
  nodes: [{ id: 'source', definition: 'source' }],
  edges: [],
  output: { nodeId: 'source', portId: 'image' },
  expose: [{ id: 'amount', nodeId: 'source', controlId: 'intensity' }],
});
