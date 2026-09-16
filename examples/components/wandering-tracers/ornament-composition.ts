import { defineComposition } from '@lux/visual-sdk';
import regions from './regions.ts';
import watercolor from './watercolor.ts';
import boundary from './boundary.ts';
import phrasing from './phrasing.ts';
import renderer from './ornament-renderer.ts';

// The existing producers retain their original painting outputs. This companion
// visual connects only their ornament fields and needs five executable nodes.
export default defineComposition({
  label: 'Living Ornament',
  definitions: { regions, watercolor, boundary, phrasing, renderer },
  nodes: [
    { id: 'd1710000-63ac-49c7-8ad7-8cf6458b5101', definition: 'regions' },
    { id: 'd1710000-63ac-49c7-8ad7-8cf6458b5102', definition: 'watercolor' },
    { id: 'd1710000-63ac-49c7-8ad7-8cf6458b5103', definition: 'boundary' },
    { id: 'd1710000-63ac-49c7-8ad7-8cf6458b5104', definition: 'phrasing' },
    { id: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', definition: 'renderer' },
  ],
  edges: [
    { id: 'd1711000-63ac-49c7-8ad7-8cf6458b5101', from: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5101', portId: 'ornament' }, to: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', portId: 'regions' }, delay: 'none' },
    { id: 'd1711000-63ac-49c7-8ad7-8cf6458b5102', from: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5102', portId: 'ornament' }, to: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', portId: 'watercolor' }, delay: 'none' },
    { id: 'd1711000-63ac-49c7-8ad7-8cf6458b5103', from: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5103', portId: 'ornament' }, to: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', portId: 'boundary' }, delay: 'none' },
    { id: 'd1711000-63ac-49c7-8ad7-8cf6458b5104', from: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5104', portId: 'ornament' }, to: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', portId: 'phrasing' }, delay: 'none' },
  ],
  output: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', portId: 'image' },
  expose: [
    { id: 'patternDensity', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'patternDensity' },
    { id: 'patternWidth', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'patternWidth' },
    { id: 'patternVariation', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'patternVariation' },
    { id: 'patternStrength', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'patternStrength' },
    { id: 'patternRest', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'patternRest' },
    { id: 'patternMotion', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'patternMotion' },
    { id: 'ornamentSize', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5101', controlId: 'ornamentSize' },
    { id: 'ornamentComplexity', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5101', controlId: 'ornamentComplexity' },
    { id: 'ornamentConcavity', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5101', controlId: 'ornamentConcavity' },
    { id: 'ornamentCorridorWidth', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5101', controlId: 'ornamentCorridorWidth' },
    { id: 'ornamentNesting', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5101', controlId: 'ornamentNesting' },
    { id: 'seed', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5101', controlId: 'seed' },
    { id: 'hierarchy', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5104', controlId: 'hierarchy' },
    { id: 'ornamentMotion', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5101', controlId: 'ornamentMotion' },
    { id: 'ornamentGrowth', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5101', controlId: 'ornamentGrowth' },
    { id: 'pace', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5104', controlId: 'pace' },
    { id: 'palette', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5102', controlId: 'palette' },
    { id: 'warmth', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5102', controlId: 'warmth' },
    { id: 'contrast', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5102', controlId: 'contrast' },
    { id: 'ornamentSaturation', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5102', controlId: 'ornamentSaturation' },
    { id: 'pooling', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5102', controlId: 'pooling' },
    { id: 'blooms', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5102', controlId: 'blooms' },
    { id: 'ornamentWidth', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5103', controlId: 'ornamentWidth' },
    { id: 'ornamentAccent', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5103', controlId: 'ornamentAccent' },
    { id: 'handDrawn', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5103', controlId: 'handDrawn' },
    { id: 'grain', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5103', controlId: 'grain' },
  ],
});
