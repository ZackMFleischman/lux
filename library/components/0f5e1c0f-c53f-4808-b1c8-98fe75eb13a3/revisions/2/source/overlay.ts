import { defineComposition } from '@lux/visual-sdk';

import paths from './generator/paths.ts';
import renderer from './renderer/renderer.ts';

export default defineComposition({
  label: 'Wandering Tracer Overlay',
  definitions: { paths, renderer },
  nodes: [
    { id: 'b17c1010-5f6a-4f88-9db5-e8b4e5534201', definition: 'paths' },
    { id: 'b17c2020-5f6a-4f88-9db5-e8b4e5534202', definition: 'renderer' },
  ],
  edges: [
    {
      id: 'b17c3030-5f6a-4f88-9db5-e8b4e5534203',
      from: { nodeId: 'b17c1010-5f6a-4f88-9db5-e8b4e5534201', portId: 'paths' },
      to: { nodeId: 'b17c2020-5f6a-4f88-9db5-e8b4e5534202', portId: 'paths' },
      delay: 'none',
    },
  ],
  input: { nodeId: 'b17c2020-5f6a-4f88-9db5-e8b4e5534202', portId: 'image' },
  output: { nodeId: 'b17c2020-5f6a-4f88-9db5-e8b4e5534202', portId: 'image' },
  expose: [
    { id: 'count', nodeId: 'b17c1010-5f6a-4f88-9db5-e8b4e5534201', controlId: 'count' },
    { id: 'speed', nodeId: 'b17c1010-5f6a-4f88-9db5-e8b4e5534201', controlId: 'speed' },
    { id: 'curl', nodeId: 'b17c1010-5f6a-4f88-9db5-e8b4e5534201', controlId: 'curl' },
    { id: 'sway', nodeId: 'b17c1010-5f6a-4f88-9db5-e8b4e5534201', controlId: 'sway' },
    { id: 'seed', nodeId: 'b17c1010-5f6a-4f88-9db5-e8b4e5534201', controlId: 'seed' },
    { id: 'width', nodeId: 'b17c1010-5f6a-4f88-9db5-e8b4e5534201', controlId: 'width' },
    { id: 'pace', nodeId: 'b17c1010-5f6a-4f88-9db5-e8b4e5534201', controlId: 'pace' },
    { id: 'contrast', nodeId: 'b17c2020-5f6a-4f88-9db5-e8b4e5534202', controlId: 'contrast' },
    { id: 'hatch', nodeId: 'b17c2020-5f6a-4f88-9db5-e8b4e5534202', controlId: 'hatch' },
    { id: 'bleed', nodeId: 'b17c2020-5f6a-4f88-9db5-e8b4e5534202', controlId: 'bleed' },
  ],
});
