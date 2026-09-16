import { defineVisual } from '@lux/visual-sdk';
import group from './component-group.ts';

export default defineVisual({
  label: 'Component visual',
  definitions: { group },
  nodes: [{ id: '22222222-2222-4222-8222-222222222222', definition: 'group' }],
  edges: [],
  output: { nodeId: '22222222-2222-4222-8222-222222222222', portId: 'image' },
  expose: [{ id: 'amount', nodeId: '22222222-2222-4222-8222-222222222222', controlId: 'amount' }],
});
