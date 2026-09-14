import { defineComposition } from '@lux/visual-sdk';
import kaleidoscope from './kaleidoscope.ts';

export default defineComposition({
  label: 'Wrapped mirror',
  definitions: { kaleidoscope },
  nodes: [
    { id: '77777777-7777-4777-8777-777777777777', definition: 'kaleidoscope' },
  ],
  edges: [],
  input: { nodeId: '77777777-7777-4777-8777-777777777777', portId: 'image' },
  output: { nodeId: '77777777-7777-4777-8777-777777777777', portId: 'image' },
  expose: [
    { id: 'segments', nodeId: '77777777-7777-4777-8777-777777777777', controlId: 'segments' },
  ],
});
