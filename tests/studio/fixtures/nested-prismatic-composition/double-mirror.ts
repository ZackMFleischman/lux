import { defineComposition } from '@lux/visual-sdk';
import wrappedMirror from './wrapped-mirror.ts';
import kaleidoscope from './kaleidoscope.ts';

export default defineComposition({
  label: 'Double mirror',
  definitions: { wrappedMirror, kaleidoscope },
  nodes: [
    { id: '66666666-6666-4666-8666-666666666666', definition: 'wrappedMirror' },
    { id: '88888888-8888-4888-8888-888888888888', definition: 'kaleidoscope' },
  ],
  edges: [
    { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', from: { nodeId: '66666666-6666-4666-8666-666666666666', portId: 'image' }, to: { nodeId: '88888888-8888-4888-8888-888888888888', portId: 'image' }, delay: 'none' },
  ],
  input: { nodeId: '66666666-6666-4666-8666-666666666666', portId: 'image' },
  output: { nodeId: '88888888-8888-4888-8888-888888888888', portId: 'image' },
  expose: [
    { id: 'firstSegments', nodeId: '66666666-6666-4666-8666-666666666666', controlId: 'segments' },
    { id: 'secondSegments', nodeId: '88888888-8888-4888-8888-888888888888', controlId: 'segments' },
  ],
});
