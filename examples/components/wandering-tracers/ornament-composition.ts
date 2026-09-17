import { defineComposition } from '@lux/visual-sdk';
import regions from './regions.ts';
import watercolor from './watercolor.ts';
import boundary from './boundary.ts';
import phrasing from './phrasing.ts';
import renderer from './ornament-renderer.ts';
import spirals from './spirals.ts';
import rings from './rings.ts';
import membranes from './membranes.ts';
import contours from './contours.ts';
import hatching from './hatching.ts';
import ribbons from './ribbons.ts';

// The existing producers retain their original painting outputs. This companion
// visual connects their ornament fields and six independent motif providers.
export default defineComposition({
  label: 'Living Ornament',
  definitions: { regions, watercolor, boundary, phrasing, renderer, spirals, rings, membranes, contours, hatching, ribbons },
  nodes: [
    { id: 'd1720000-63ac-49c7-8ad7-8cf6458b5101', definition: 'spirals' },
    { id: 'd1720000-63ac-49c7-8ad7-8cf6458b5102', definition: 'rings' },
    { id: 'd1720000-63ac-49c7-8ad7-8cf6458b5103', definition: 'membranes' },
    { id: 'd1720000-63ac-49c7-8ad7-8cf6458b5104', definition: 'contours' },
    { id: 'd1720000-63ac-49c7-8ad7-8cf6458b5105', definition: 'hatching' },
    { id: 'd1720000-63ac-49c7-8ad7-8cf6458b5106', definition: 'ribbons' },
    { id: 'd1710000-63ac-49c7-8ad7-8cf6458b5101', definition: 'regions' },
    { id: 'd1710000-63ac-49c7-8ad7-8cf6458b5102', definition: 'watercolor' },
    { id: 'd1710000-63ac-49c7-8ad7-8cf6458b5103', definition: 'boundary' },
    { id: 'd1710000-63ac-49c7-8ad7-8cf6458b5104', definition: 'phrasing' },
    { id: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', definition: 'renderer' },
  ],
  edges: [
    { id: 'd1721000-63ac-49c7-8ad7-8cf6458b5101', from: { nodeId: 'd1720000-63ac-49c7-8ad7-8cf6458b5101', portId: 'pattern' }, to: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', portId: 'spirals' }, delay: 'none' },
    { id: 'd1721000-63ac-49c7-8ad7-8cf6458b5102', from: { nodeId: 'd1720000-63ac-49c7-8ad7-8cf6458b5102', portId: 'pattern' }, to: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', portId: 'rings' }, delay: 'none' },
    { id: 'd1721000-63ac-49c7-8ad7-8cf6458b5103', from: { nodeId: 'd1720000-63ac-49c7-8ad7-8cf6458b5103', portId: 'pattern' }, to: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', portId: 'membranes' }, delay: 'none' },
    { id: 'd1721000-63ac-49c7-8ad7-8cf6458b5104', from: { nodeId: 'd1720000-63ac-49c7-8ad7-8cf6458b5104', portId: 'pattern' }, to: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', portId: 'contours' }, delay: 'none' },
    { id: 'd1721000-63ac-49c7-8ad7-8cf6458b5105', from: { nodeId: 'd1720000-63ac-49c7-8ad7-8cf6458b5105', portId: 'ornament' }, to: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', portId: 'hatching' }, delay: 'none' },
    { id: 'd1721000-63ac-49c7-8ad7-8cf6458b5106', from: { nodeId: 'd1720000-63ac-49c7-8ad7-8cf6458b5106', portId: 'pattern' }, to: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', portId: 'ribbons' }, delay: 'none' },
    { id: 'd1711000-63ac-49c7-8ad7-8cf6458b5101', from: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5101', portId: 'ornament' }, to: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', portId: 'regions' }, delay: 'none' },
    { id: 'd1711000-63ac-49c7-8ad7-8cf6458b5102', from: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5102', portId: 'ornament' }, to: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', portId: 'watercolor' }, delay: 'none' },
    { id: 'd1711000-63ac-49c7-8ad7-8cf6458b5103', from: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5103', portId: 'ornament' }, to: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', portId: 'boundary' }, delay: 'none' },
    { id: 'd1711000-63ac-49c7-8ad7-8cf6458b5104', from: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5104', portId: 'ornament' }, to: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', portId: 'phrasing' }, delay: 'none' },
  ],
  output: { nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', portId: 'image' },
  expose: [
    { id: 'birdThoughts', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'birdThoughts' },
    { id: 'birdSociability', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'birdSociability' },
    { id: 'birdPerchDuration', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'birdPerchDuration' },
    { id: 'birdPitch', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'birdPitch' },
    { id: 'birdExcursionSpeed', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'birdExcursionSpeed' },
    { id: 'birdSpecies', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'birdSpecies' },
    { id: 'birdPalette', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'birdPalette' },
    { id: 'birdSize', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'birdSize' },
    { id: 'birdSpeed', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'birdSpeed' },
    { id: 'birdOrbit', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'birdOrbit' },
    { id: 'birdVisits', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'birdVisits' },
    { id: 'structuralActivity', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'structuralActivity' },
    { id: 'spiralsDensity', nodeId: 'd1720000-63ac-49c7-8ad7-8cf6458b5101', controlId: 'density' },
    { id: 'spiralsWidth', nodeId: 'd1720000-63ac-49c7-8ad7-8cf6458b5101', controlId: 'width' },
    { id: 'ringsDensity', nodeId: 'd1720000-63ac-49c7-8ad7-8cf6458b5102', controlId: 'density' },
    { id: 'ringsWidth', nodeId: 'd1720000-63ac-49c7-8ad7-8cf6458b5102', controlId: 'width' },
    { id: 'membranesDensity', nodeId: 'd1720000-63ac-49c7-8ad7-8cf6458b5103', controlId: 'density' },
    { id: 'membranesWidth', nodeId: 'd1720000-63ac-49c7-8ad7-8cf6458b5103', controlId: 'width' },
    { id: 'contoursDensity', nodeId: 'd1720000-63ac-49c7-8ad7-8cf6458b5104', controlId: 'density' },
    { id: 'contoursWidth', nodeId: 'd1720000-63ac-49c7-8ad7-8cf6458b5104', controlId: 'width' },
    { id: 'hatchingDensity', nodeId: 'd1720000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'ornamentDensity' },
    { id: 'hatchingWidth', nodeId: 'd1720000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'ornamentWidth' },
    { id: 'ribbonsDensity', nodeId: 'd1720000-63ac-49c7-8ad7-8cf6458b5106', controlId: 'density' },
    { id: 'ribbonsWidth', nodeId: 'd1720000-63ac-49c7-8ad7-8cf6458b5106', controlId: 'width' },
    { id: 'patternDensity', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'patternDensity' },
    { id: 'patternWidth', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'patternWidth' },
    { id: 'patternVariation', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'patternVariation' },
    { id: 'patternStrength', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'patternStrength' },
    { id: 'patternRest', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'patternRest' },
    { id: 'patternMotion', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'patternMotion' },
    { id: 'patternTravel', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'patternTravel' },
    { id: 'patternGrowth', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5105', controlId: 'patternGrowth' },
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
    { id: 'phrasing', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5104', controlId: 'phrasing' },
    { id: 'composition', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5104', controlId: 'composition' },
    { id: 'tension', nodeId: 'd1710000-63ac-49c7-8ad7-8cf6458b5104', controlId: 'tension' },
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
