import { defineComposition } from '@lux/visual-sdk';

import background from './background.ts';
import overlay from './overlay.ts';

export default defineComposition({
  label: 'Wandering Tracers',
  definitions: { background, overlay },
  nodes: [
    { id: 'c28d1010-63ac-49c7-8ad7-8cf6458b5101', definition: 'background' },
    { id: 'c28d2020-63ac-49c7-8ad7-8cf6458b5102', definition: 'overlay' },
  ],
  edges: [
    {
      id: 'c28d3030-63ac-49c7-8ad7-8cf6458b5103',
      from: { nodeId: 'c28d1010-63ac-49c7-8ad7-8cf6458b5101', portId: 'image' },
      to: { nodeId: 'c28d2020-63ac-49c7-8ad7-8cf6458b5102', portId: 'image' },
      delay: 'none',
    },
  ],
  output: { nodeId: 'c28d2020-63ac-49c7-8ad7-8cf6458b5102', portId: 'image' },
  expose: [
    { id: 'backgroundMotion', nodeId: 'c28d1010-63ac-49c7-8ad7-8cf6458b5101', controlId: 'motion' },
    { id: 'count', nodeId: 'c28d2020-63ac-49c7-8ad7-8cf6458b5102', controlId: 'count' },
    { id: 'speed', nodeId: 'c28d2020-63ac-49c7-8ad7-8cf6458b5102', controlId: 'speed' },
    { id: 'curl', nodeId: 'c28d2020-63ac-49c7-8ad7-8cf6458b5102', controlId: 'curl' },
    { id: 'sway', nodeId: 'c28d2020-63ac-49c7-8ad7-8cf6458b5102', controlId: 'sway' },
    { id: 'seed', nodeId: 'c28d2020-63ac-49c7-8ad7-8cf6458b5102', controlId: 'seed' },
    { id: 'width', nodeId: 'c28d2020-63ac-49c7-8ad7-8cf6458b5102', controlId: 'width' },
    { id: 'pace', nodeId: 'c28d2020-63ac-49c7-8ad7-8cf6458b5102', controlId: 'pace' },
    { id: 'contrast', nodeId: 'c28d2020-63ac-49c7-8ad7-8cf6458b5102', controlId: 'contrast' },
    { id: 'hatch', nodeId: 'c28d2020-63ac-49c7-8ad7-8cf6458b5102', controlId: 'hatch' },
    { id: 'bleed', nodeId: 'c28d2020-63ac-49c7-8ad7-8cf6458b5102', controlId: 'bleed' },
  ],
});
