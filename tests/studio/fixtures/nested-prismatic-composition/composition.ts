import { defineComposition } from '@lux/visual-sdk';
import ball from './ball.ts';
import doubleMirror from './double-mirror.ts';

export default defineComposition({
  label: 'Nested prismatic mirrors',
  definitions: { ball, doubleMirror },
  nodes: [
    { id: '11111111-1111-4111-8111-111111111111', definition: 'ball' },
    { id: '44444444-4444-4444-8444-444444444444', definition: 'doubleMirror' },
    { id: '55555555-5555-4555-8555-555555555555', definition: 'doubleMirror' },
  ],
  edges: [
    { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', from: { nodeId: '11111111-1111-4111-8111-111111111111', portId: 'image' }, to: { nodeId: '44444444-4444-4444-8444-444444444444', portId: 'image' }, delay: 'none' },
    { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', from: { nodeId: '44444444-4444-4444-8444-444444444444', portId: 'image' }, to: { nodeId: '55555555-5555-4555-8555-555555555555', portId: 'image' }, delay: 'none' },
  ],
  output: { nodeId: '55555555-5555-4555-8555-555555555555', portId: 'image' },
  expose: [
    { id: 'ballIntensity', nodeId: '11111111-1111-4111-8111-111111111111', controlId: 'intensity' },
    { id: 'segmentsA', nodeId: '44444444-4444-4444-8444-444444444444', controlId: 'firstSegments' },
    { id: 'segmentsB', nodeId: '55555555-5555-4555-8555-555555555555', controlId: 'secondSegments' },
  ],
});
