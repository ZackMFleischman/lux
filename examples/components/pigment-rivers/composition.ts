import { defineVisual } from '@lux/visual-sdk';
import bands from './bands.ts';
import renderer from './renderer.ts';
import surface from './surface.ts';
import phrasing from '../wandering-tracers/phrasing.ts';
import watercolor from '../wandering-tracers/watercolor.ts';
import boundary from '../wandering-tracers/boundary.ts';
import contours from '../wandering-tracers/contours.ts';

// Existing source providers are imported unchanged. Bundle using the companion
// preparation script so their relative modules remain inside the source root.
export default defineVisual({
  label: 'Pigment Rivers',
  definitions: { bands, phrasing, watercolor, boundary, contours, renderer, surface },
  nodes: [
    { id: 'b8dc8301-67a4-47d0-9c72-18dc6abf0001', definition: 'bands' },
    { id: 'b8dc8301-67a4-47d0-9c72-18dc6abf0002', definition: 'phrasing' },
    { id: 'b8dc8301-67a4-47d0-9c72-18dc6abf0003', definition: 'watercolor' },
    { id: 'b8dc8301-67a4-47d0-9c72-18dc6abf0004', definition: 'boundary' },
    { id: 'b8dc8301-67a4-47d0-9c72-18dc6abf0005', definition: 'contours' },
    { id: 'b8dc8301-67a4-47d0-9c72-18dc6abf0006', definition: 'renderer' },
    { id: 'b8dc8301-67a4-47d0-9c72-18dc6abf0007', definition: 'surface' },
  ],
  edges: [
    {
      id: 'b8dc8301-67a4-47d0-9c72-18dc6abf0011',
      from: { nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0001', portId: 'field' },
      to: { nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0006', portId: 'bands' }, delay: 'none',
    },
    {
      id: 'b8dc8301-67a4-47d0-9c72-18dc6abf0012',
      from: { nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0002', portId: 'ornament' },
      to: { nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0006', portId: 'phrasing' }, delay: 'none',
    },
    {
      id: 'b8dc8301-67a4-47d0-9c72-18dc6abf0013',
      from: { nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0003', portId: 'ornament' },
      to: { nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0006', portId: 'watercolor' }, delay: 'none',
    },
    {
      id: 'b8dc8301-67a4-47d0-9c72-18dc6abf0014',
      from: { nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0004', portId: 'ornament' },
      to: { nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0006', portId: 'boundary' }, delay: 'none',
    },
    {
      id: 'b8dc8301-67a4-47d0-9c72-18dc6abf0015',
      from: { nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0005', portId: 'pattern' },
      to: { nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0006', portId: 'contours' }, delay: 'none',
    },
    {
      id: 'b8dc8301-67a4-47d0-9c72-18dc6abf0016',
      from: { nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0006', portId: 'image' },
      to: { nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0007', portId: 'image' }, delay: 'none',
    },
  ],
  output: { nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0007', portId: 'image' },
  expose: [
    { id: 'bandDensity', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0001', controlId: 'scale' },
    { id: 'folding', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0001', controlId: 'fold' },
    { id: 'flow', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0001', controlId: 'flow' },
    { id: 'arrangement', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0001', controlId: 'seed' },
    { id: 'pace', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0002', controlId: 'pace' },
    { id: 'phrasing', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0002', controlId: 'phrasing' },
    { id: 'warmth', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0003', controlId: 'warmth' },
    { id: 'pooling', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0003', controlId: 'pooling' },
    { id: 'blooms', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0003', controlId: 'blooms' },
    { id: 'inkWidth', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0004', controlId: 'ornamentWidth' },
    { id: 'inkCharacter', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0004', controlId: 'handDrawn' },
    { id: 'contourDensity', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0005', controlId: 'density' },
    { id: 'contourWidth', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0005', controlId: 'width' },
    { id: 'acidPalette', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0006', controlId: 'acidPalette' },
    { id: 'contourStrength', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0006', controlId: 'contourStrength' },
    { id: 'scumble', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0006', controlId: 'scumble' },
    { id: 'paperTooth', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0007', controlId: 'tooth' },
    { id: 'pigmentDrag', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0007', controlId: 'drag' },
    { id: 'dryBrush', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0007', controlId: 'dryBrush' },
    { id: 'margin', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0007', controlId: 'margin' },
    { id: 'splatter', nodeId: 'b8dc8301-67a4-47d0-9c72-18dc6abf0007', controlId: 'splatter' },
  ],
});
