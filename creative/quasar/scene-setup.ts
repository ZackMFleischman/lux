import { defineVisual } from '@lux/visual-sdk';
import starfield from './starfield/starfield.ts';

export default defineVisual({
  label: 'Quasar',
  definitions: {
    starfield,
  },
  nodes: [
    {
      id: '6d0bd349-bbeb-4988-b49b-443315397b16',
      definition: 'starfield',
    },
  ],
  edges: [],
  output: {
    nodeId: '6d0bd349-bbeb-4988-b49b-443315397b16',
    portId: 'image',
  },
  expose: [
    {
      id: 'starlight',
      nodeId: '6d0bd349-bbeb-4988-b49b-443315397b16',
      controlId: 'starlight',
    },
    {
      id: 'featureStarDensity',
      nodeId: '6d0bd349-bbeb-4988-b49b-443315397b16',
      controlId: 'featureStarDensity',
    },
    {
      id: 'featureStarScale',
      nodeId: '6d0bd349-bbeb-4988-b49b-443315397b16',
      controlId: 'featureStarScale',
    },
    {
      id: 'featureStarVariance',
      nodeId: '6d0bd349-bbeb-4988-b49b-443315397b16',
      controlId: 'featureStarVariance',
    },
    {
      id: 'featureStarOpacity',
      nodeId: '6d0bd349-bbeb-4988-b49b-443315397b16',
      controlId: 'featureStarOpacity',
    },
    {
      id: 'twinkle',
      nodeId: '6d0bd349-bbeb-4988-b49b-443315397b16',
      controlId: 'twinkle',
    },
  ],
});
