import { defineVisual } from '@lux/visual-sdk';
import core from './core.ts';
import paths from './paths.ts';
import renderer from './renderer.ts';
import dust from './dust.ts';

export default defineVisual({
  label: 'Fiber-Optic Heart',
  definitions: { core, paths, renderer, dust },
  nodes: [
    { id: 'a2ca5401-1e17-4c40-8dd6-6595f78a0001', definition: 'core' },
    { id: 'a2ca5401-1e17-4c40-8dd6-6595f78a0002', definition: 'paths' },
    { id: 'a2ca5401-1e17-4c40-8dd6-6595f78a0003', definition: 'renderer' },
    { id: 'a2ca5401-1e17-4c40-8dd6-6595f78a0004', definition: 'dust' },
  ],
  edges: [
    {
      id: 'a2ca5401-1e17-4c40-8dd6-6595f78a0011',
      from: { nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0001', portId: 'image' },
      to: { nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0003', portId: 'image' },
      delay: 'none',
    },
    {
      id: 'a2ca5401-1e17-4c40-8dd6-6595f78a0012',
      from: { nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0002', portId: 'paths' },
      to: { nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0003', portId: 'paths' },
      delay: 'none',
    },
    {
      id: 'a2ca5401-1e17-4c40-8dd6-6595f78a0013',
      from: { nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0003', portId: 'image' },
      to: { nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0004', portId: 'image' },
      delay: 'none',
    },
  ],
  output: { nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0004', portId: 'image' },
  expose: [
    { id: 'coreBrightness', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0001', controlId: 'brightness' },
    { id: 'coreRadius', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0001', controlId: 'radius' },
    { id: 'haze', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0001', controlId: 'haze' },
    { id: 'breath', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0001', controlId: 'breath' },
    { id: 'flare', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0001', controlId: 'flare' },
    { id: 'strandCount', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0002', controlId: 'count' },
    { id: 'spread', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0002', controlId: 'spread' },
    { id: 'cableWidth', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0002', controlId: 'width' },
    { id: 'arrangement', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0002', controlId: 'seed' },
    { id: 'drift', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0002', controlId: 'motion' },
    { id: 'strandBrightness', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0003', controlId: 'brightness' },
    { id: 'palette', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0003', controlId: 'palette' },
    { id: 'pulseSpeed', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0003', controlId: 'pulseSpeed' },
    { id: 'pulseWidth', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0003', controlId: 'pulseWidth' },
    { id: 'pulseStrength', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0003', controlId: 'pulseStrength' },
    { id: 'ribbons', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0003', controlId: 'ribbons' },
    { id: 'ribbonWidth', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0003', controlId: 'ribbonWidth' },
    { id: 'cables', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0003', controlId: 'cables' },
    { id: 'collars', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0003', controlId: 'collars' },
    { id: 'dustCount', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0004', controlId: 'count' },
    { id: 'dustSize', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0004', controlId: 'size' },
    { id: 'dustDrift', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0004', controlId: 'drift' },
    { id: 'dustBrightness', nodeId: 'a2ca5401-1e17-4c40-8dd6-6595f78a0004', controlId: 'brightness' },
  ],
});
