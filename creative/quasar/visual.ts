import { defineVisual } from '@lux/visual-sdk';
import starfield from './starfield/starfield.ts';
import quasar from './quasar.ts';
import bloom from './bloom.ts';

export default defineVisual({
  label: 'Feeding Quasar',
  definitions: { starfield, quasar, bloom },
  nodes: [
    { id: '6d0bd349-bbeb-4988-b49b-443315397b16', definition: 'starfield' },
    { id: 'fa981b60-a121-45e0-9a97-ccedfa2e05cc', definition: 'quasar' },
    { id: 'd831c483-9f01-4a63-80e2-a43d0a373aee', definition: 'bloom' },
  ],
  edges: [
    { id: '1e4b6cde-eaea-4aa7-9178-aa676053fbae', from: { nodeId: '6d0bd349-bbeb-4988-b49b-443315397b16', portId: 'image' }, to: { nodeId: 'fa981b60-a121-45e0-9a97-ccedfa2e05cc', portId: 'image' }, delay: 'none' },
    { id: 'b53bf4e4-bd7e-43f3-a993-051746df89ac', from: { nodeId: 'fa981b60-a121-45e0-9a97-ccedfa2e05cc', portId: 'image' }, to: { nodeId: 'd831c483-9f01-4a63-80e2-a43d0a373aee', portId: 'image' }, delay: 'none' },
  ],
  output: { nodeId: 'd831c483-9f01-4a63-80e2-a43d0a373aee', portId: 'image' },
  expose: [
    { id: 'starlight', nodeId: '6d0bd349-bbeb-4988-b49b-443315397b16', controlId: 'starlight' },
    { id: 'featureStarDensity', nodeId: '6d0bd349-bbeb-4988-b49b-443315397b16', controlId: 'featureStarDensity' },
    { id: 'featureStarScale', nodeId: '6d0bd349-bbeb-4988-b49b-443315397b16', controlId: 'featureStarScale' },
    { id: 'featureStarVariance', nodeId: '6d0bd349-bbeb-4988-b49b-443315397b16', controlId: 'featureStarVariance' },
    { id: 'featureStarOpacity', nodeId: '6d0bd349-bbeb-4988-b49b-443315397b16', controlId: 'featureStarOpacity' },
    { id: 'twinkle', nodeId: '6d0bd349-bbeb-4988-b49b-443315397b16', controlId: 'twinkle' },
    { id: 'zoom', nodeId: 'fa981b60-a121-45e0-9a97-ccedfa2e05cc', controlId: 'zoom' },
    { id: 'inclination', nodeId: 'fa981b60-a121-45e0-9a97-ccedfa2e05cc', controlId: 'inclination' },
    { id: 'roll', nodeId: 'fa981b60-a121-45e0-9a97-ccedfa2e05cc', controlId: 'roll' },
    { id: 'drift', nodeId: 'fa981b60-a121-45e0-9a97-ccedfa2e05cc', controlId: 'drift' },
    { id: 'spin', nodeId: 'fa981b60-a121-45e0-9a97-ccedfa2e05cc', controlId: 'spin' },
    { id: 'turbulence', nodeId: 'fa981b60-a121-45e0-9a97-ccedfa2e05cc', controlId: 'turbulence' },
    { id: 'heat', nodeId: 'fa981b60-a121-45e0-9a97-ccedfa2e05cc', controlId: 'heat' },
    { id: 'radius', nodeId: 'fa981b60-a121-45e0-9a97-ccedfa2e05cc', controlId: 'radius' },
    { id: 'jetPower', nodeId: 'fa981b60-a121-45e0-9a97-ccedfa2e05cc', controlId: 'jetPower' },
    { id: 'jetWidth', nodeId: 'fa981b60-a121-45e0-9a97-ccedfa2e05cc', controlId: 'jetWidth' },
    { id: 'jetTwist', nodeId: 'fa981b60-a121-45e0-9a97-ccedfa2e05cc', controlId: 'jetTwist' },
    { id: 'jetSpeed', nodeId: 'fa981b60-a121-45e0-9a97-ccedfa2e05cc', controlId: 'jetSpeed' },
    { id: 'lensing', nodeId: 'fa981b60-a121-45e0-9a97-ccedfa2e05cc', controlId: 'lensing' },
    { id: 'photon', nodeId: 'fa981b60-a121-45e0-9a97-ccedfa2e05cc', controlId: 'photon' },
    { id: 'bloom', nodeId: 'd831c483-9f01-4a63-80e2-a43d0a373aee', controlId: 'bloom' },
    { id: 'softness', nodeId: 'd831c483-9f01-4a63-80e2-a43d0a373aee', controlId: 'softness' },
    { id: 'exposure', nodeId: 'd831c483-9f01-4a63-80e2-a43d0a373aee', controlId: 'exposure' },
  ],
});
