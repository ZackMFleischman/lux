import { defineComposition } from '@lux/visual-sdk';
import paths from './paths.ts';
import regions from './regions.ts';
import hatching from './hatching.ts';
import watercolor from './watercolor.ts';
import painting from './painting.ts';
import renderer from './renderer.ts';
import boundary from './boundary.ts';

// One immutable snapshot drives both region carving and the visible tracer ink.
export default defineComposition({
  label: 'Living Painting — Shared Tracers',
  definitions: { paths, regions, hatching, watercolor, painting, renderer, boundary },
  nodes: [
    { id: 'd10d1010-63ac-49c7-8ad7-8cf6458b5101', definition: 'paths' },
    { id: 'd10d1515-63ac-49c7-8ad7-8cf6458b5115', definition: 'regions' },
    { id: 'd10d1717-63ac-49c7-8ad7-8cf6458b5117', definition: 'hatching' },
    { id: 'd10d1818-63ac-49c7-8ad7-8cf6458b5118', definition: 'watercolor' },
    { id: 'd10d2020-63ac-49c7-8ad7-8cf6458b5102', definition: 'painting' },
    { id: 'd10d3030-63ac-49c7-8ad7-8cf6458b5103', definition: 'renderer' },
    { id: 'd10d1919-63ac-49c7-8ad7-8cf6458b5119', definition: 'boundary' },
  ],
  edges: [
    { id: 'd10d4040-63ac-49c7-8ad7-8cf6458b5107', from: { nodeId: 'd10d1515-63ac-49c7-8ad7-8cf6458b5115', portId: 'field' }, to: { nodeId: 'd10d2020-63ac-49c7-8ad7-8cf6458b5102', portId: 'regions' }, delay: 'none' },
    { id: 'd10d4050-63ac-49c7-8ad7-8cf6458b5108', from: { nodeId: 'd10d1717-63ac-49c7-8ad7-8cf6458b5117', portId: 'field' }, to: { nodeId: 'd10d2020-63ac-49c7-8ad7-8cf6458b5102', portId: 'hatching' }, delay: 'none' },
    { id: 'd10d4060-63ac-49c7-8ad7-8cf6458b5109', from: { nodeId: 'd10d1818-63ac-49c7-8ad7-8cf6458b5118', portId: 'field' }, to: { nodeId: 'd10d2020-63ac-49c7-8ad7-8cf6458b5102', portId: 'watercolor' }, delay: 'none' },
    { id: 'd10d4070-63ac-49c7-8ad7-8cf6458b5110', from: { nodeId: 'd10d1919-63ac-49c7-8ad7-8cf6458b5119', portId: 'field' }, to: { nodeId: 'd10d2020-63ac-49c7-8ad7-8cf6458b5102', portId: 'boundary' }, delay: 'none' },
    { id: 'd10d4010-63ac-49c7-8ad7-8cf6458b5104', from: { nodeId: 'd10d1010-63ac-49c7-8ad7-8cf6458b5101', portId: 'paths' }, to: { nodeId: 'd10d2020-63ac-49c7-8ad7-8cf6458b5102', portId: 'paths' }, delay: 'none' },
    { id: 'd10d4020-63ac-49c7-8ad7-8cf6458b5105', from: { nodeId: 'd10d1010-63ac-49c7-8ad7-8cf6458b5101', portId: 'paths' }, to: { nodeId: 'd10d3030-63ac-49c7-8ad7-8cf6458b5103', portId: 'paths' }, delay: 'none' },
    { id: 'd10d4030-63ac-49c7-8ad7-8cf6458b5106', from: { nodeId: 'd10d2020-63ac-49c7-8ad7-8cf6458b5102', portId: 'image' }, to: { nodeId: 'd10d3030-63ac-49c7-8ad7-8cf6458b5103', portId: 'image' }, delay: 'none' },
  ],
  output: { nodeId: 'd10d3030-63ac-49c7-8ad7-8cf6458b5103', portId: 'image' },
  expose: [
  {
    "id": "pace",
    "nodeId": "d10d2020-63ac-49c7-8ad7-8cf6458b5102",
    "controlId": "pace"
  },
  {
    "id": "motion",
    "nodeId": "d10d1515-63ac-49c7-8ad7-8cf6458b5115",
    "controlId": "motion"
  },
  {
    "id": "phrasing",
    "nodeId": "d10d2020-63ac-49c7-8ad7-8cf6458b5102",
    "controlId": "phrasing"
  },
  {
    "id": "scale",
    "nodeId": "d10d1515-63ac-49c7-8ad7-8cf6458b5115",
    "controlId": "scale"
  },
  {
    "id": "warp",
    "nodeId": "d10d1515-63ac-49c7-8ad7-8cf6458b5115",
    "controlId": "warp"
  },
  {
    "id": "growth",
    "nodeId": "d10d1515-63ac-49c7-8ad7-8cf6458b5115",
    "controlId": "growth"
  },
  {
    "id": "seed",
    "nodeId": "d10d1515-63ac-49c7-8ad7-8cf6458b5115",
    "controlId": "seed"
  },
  {
    "id": "composition",
    "nodeId": "d10d2020-63ac-49c7-8ad7-8cf6458b5102",
    "controlId": "composition"
  },
  {
    "id": "tension",
    "nodeId": "d10d2020-63ac-49c7-8ad7-8cf6458b5102",
    "controlId": "tension"
  },
  {
    "id": "hierarchy",
    "nodeId": "d10d2020-63ac-49c7-8ad7-8cf6458b5102",
    "controlId": "hierarchy"
  },
  {
    "id": "coverage",
    "nodeId": "d10d1717-63ac-49c7-8ad7-8cf6458b5117",
    "controlId": "coverage"
  },
  {
    "id": "spacing",
    "nodeId": "d10d1717-63ac-49c7-8ad7-8cf6458b5117",
    "controlId": "spacing"
  },
  {
    "id": "curvature",
    "nodeId": "d10d1717-63ac-49c7-8ad7-8cf6458b5117",
    "controlId": "curvature"
  },
  {
    "id": "angle",
    "nodeId": "d10d1717-63ac-49c7-8ad7-8cf6458b5117",
    "controlId": "angle"
  },
  {
    "id": "hatchWidth",
    "nodeId": "d10d1717-63ac-49c7-8ad7-8cf6458b5117",
    "controlId": "hatchWidth"
  },
  {
    "id": "relation",
    "nodeId": "d10d1717-63ac-49c7-8ad7-8cf6458b5117",
    "controlId": "relation"
  },
  {
    "id": "spacingVar",
    "nodeId": "d10d1717-63ac-49c7-8ad7-8cf6458b5117",
    "controlId": "spacingVar"
  },
  {
    "id": "curvatureVar",
    "nodeId": "d10d1717-63ac-49c7-8ad7-8cf6458b5117",
    "controlId": "curvatureVar"
  },
  {
    "id": "angleVar",
    "nodeId": "d10d1717-63ac-49c7-8ad7-8cf6458b5117",
    "controlId": "angleVar"
  },
  {
    "id": "palette",
    "nodeId": "d10d1818-63ac-49c7-8ad7-8cf6458b5118",
    "controlId": "palette"
  },
  {
    "id": "warmth",
    "nodeId": "d10d1818-63ac-49c7-8ad7-8cf6458b5118",
    "controlId": "warmth"
  },
  {
    "id": "contrast",
    "nodeId": "d10d1818-63ac-49c7-8ad7-8cf6458b5118",
    "controlId": "contrast"
  },
  {
    "id": "pooling",
    "nodeId": "d10d1818-63ac-49c7-8ad7-8cf6458b5118",
    "controlId": "pooling"
  },
  {
    "id": "blooms",
    "nodeId": "d10d1818-63ac-49c7-8ad7-8cf6458b5118",
    "controlId": "blooms"
  },
  {
    "id": "outline",
    "nodeId": "d10d1919-63ac-49c7-8ad7-8cf6458b5119",
    "controlId": "outline"
  },
  {
    "id": "inkWarmth",
    "nodeId": "d10d1919-63ac-49c7-8ad7-8cf6458b5119",
    "controlId": "inkWarmth"
  },
  {
    "id": "handDrawn",
    "nodeId": "d10d1919-63ac-49c7-8ad7-8cf6458b5119",
    "controlId": "handDrawn"
  },
  {
    "id": "grain",
    "nodeId": "d10d1919-63ac-49c7-8ad7-8cf6458b5119",
    "controlId": "grain"
  },
  {
    "id": "tracerCount",
    "nodeId": "d10d1010-63ac-49c7-8ad7-8cf6458b5101",
    "controlId": "count"
  },
  {
    "id": "tracerSpeed",
    "nodeId": "d10d1010-63ac-49c7-8ad7-8cf6458b5101",
    "controlId": "speed"
  },
  {
    "id": "tracerCurl",
    "nodeId": "d10d1010-63ac-49c7-8ad7-8cf6458b5101",
    "controlId": "curl"
  },
  {
    "id": "tracerSway",
    "nodeId": "d10d1010-63ac-49c7-8ad7-8cf6458b5101",
    "controlId": "sway"
  },
  {
    "id": "tracerSeed",
    "nodeId": "d10d1010-63ac-49c7-8ad7-8cf6458b5101",
    "controlId": "seed"
  },
  {
    "id": "tracerWidth",
    "nodeId": "d10d1010-63ac-49c7-8ad7-8cf6458b5101",
    "controlId": "width"
  },
  {
    "id": "tracerPace",
    "nodeId": "d10d1010-63ac-49c7-8ad7-8cf6458b5101",
    "controlId": "pace"
  },
  {
    "id": "tracerContrast",
    "nodeId": "d10d3030-63ac-49c7-8ad7-8cf6458b5103",
    "controlId": "contrast"
  },
  {
    "id": "tracerHatch",
    "nodeId": "d10d3030-63ac-49c7-8ad7-8cf6458b5103",
    "controlId": "hatch"
  },
  {
    "id": "tracerBleed",
    "nodeId": "d10d3030-63ac-49c7-8ad7-8cf6458b5103",
    "controlId": "bleed"
  }
],
});
