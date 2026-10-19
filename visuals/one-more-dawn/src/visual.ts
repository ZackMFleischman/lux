// "One More Dawn" – opening of the stage show (0:00–1:12).
// The stage renderer draws flat cel-shaded colour plus a line buffer; the
// ink pass turns them into broadcast-cartoon line work.

import { defineVisual } from '@lux/visual-sdk';
import ink from './engine/ink.ts';
import stage from './stage-render.ts';

export default defineVisual({
  label: 'One More Dawn – Opening',
  definitions: { stage, ink },
  nodes: [
    { id: 'stage', definition: 'stage' },
    { id: 'ink', definition: 'ink' },
  ],
  edges: [
    { id: 'stage-color', from: { nodeId: 'stage', portId: 'color' }, to: { nodeId: 'ink', portId: 'color' }, delay: 'none' },
    { id: 'stage-lines', from: { nodeId: 'stage', portId: 'lines' }, to: { nodeId: 'ink', portId: 'lines' }, delay: 'none' },
  ],
  output: { nodeId: 'ink', portId: 'image' },
  expose: [
    { id: 'startAt', nodeId: 'stage', controlId: 'startAt' },
    { id: 'loop', nodeId: 'stage', controlId: 'loop' },
    { id: 'haze', nodeId: 'stage', controlId: 'haze' },
    { id: 'lineWidth', nodeId: 'ink', controlId: 'lineWidth' },
    { id: 'setLine', nodeId: 'ink', controlId: 'setLine' },
    { id: 'crease', nodeId: 'ink', controlId: 'crease' },
  ],
});
