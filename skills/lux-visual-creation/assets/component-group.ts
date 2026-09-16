import { defineComponent } from '@lux/visual-sdk';
import source from './source.ts';

// source.ts is an SDK 0.4 image-source component with an intensity control.
export default defineComponent({
  label: 'Reusable source',
  definitions: { source },
  nodes: [{ id: '11111111-1111-4111-8111-111111111111', definition: 'source' }],
  edges: [],
  output: { nodeId: '11111111-1111-4111-8111-111111111111', portId: 'image' },
  expose: [{ id: 'amount', nodeId: '11111111-1111-4111-8111-111111111111', controlId: 'intensity' }],
});
