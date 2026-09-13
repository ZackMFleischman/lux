import { defineComposition } from '@lux/visual-sdk';
import ball from './ball.ts';
import kaleidoscope from './kaleidoscope.ts';

export default defineComposition({
  definitions: { ball, kaleidoscope },
  nodes: [
    { id: '11111111-1111-4111-8111-111111111111', definition: 'ball' },
    { id: '22222222-2222-4222-8222-222222222222', definition: 'kaleidoscope' },
    { id: '33333333-3333-4333-8333-333333333333', definition: 'kaleidoscope' },
  ],
  edges: [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', from: { nodeId: '11111111-1111-4111-8111-111111111111', portId: 'image' }, to: { nodeId: '22222222-2222-4222-8222-222222222222', portId: 'image' }, delay: 'none' },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', from: { nodeId: '22222222-2222-4222-8222-222222222222', portId: 'image' }, to: { nodeId: '33333333-3333-4333-8333-333333333333', portId: 'image' }, delay: 'none' },
  ],
  output: { nodeId: '33333333-3333-4333-8333-333333333333', portId: 'image' },
  expose: [
    { id: 'ballIntensity', nodeId: '11111111-1111-4111-8111-111111111111', controlId: 'intensity' },
    { id: 'segmentsA', nodeId: '22222222-2222-4222-8222-222222222222', controlId: 'segments' },
    { id: 'segmentsB', nodeId: '33333333-3333-4333-8333-333333333333', controlId: 'segments' },
  ],
});
