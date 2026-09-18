import { defineVisual } from '@lux/visual-sdk';
import starfield from './starfield/starfield.ts';
import quasar from './quasar/quasar.ts';
import planets from './planets/orbiting-worlds.ts';

export default defineVisual({
  label: 'Feeding Quasar',
  definitions: { starfield, quasar, planets },
  nodes: [
    { id: 'starfield', definition: 'starfield' },
    { id: 'planets', definition: 'planets' },
    { id: 'quasar', definition: 'quasar' },
  ],
  edges: [
    { id: 'starfield-to-quasar', from: { nodeId: 'starfield', portId: 'image' }, to: { nodeId: 'quasar', portId: 'image' }, delay: 'none' },
    { id: 'planets-to-quasar', from: { nodeId: 'planets', portId: 'field' }, to: { nodeId: 'quasar', portId: 'bodies' }, delay: 'none' },
  ],
  output: { nodeId: 'quasar', portId: 'image' },
  expose: [
    { id: 'starlight', nodeId: 'starfield', controlId: 'starlight' },
    { id: 'featureStarDensity', nodeId: 'starfield', controlId: 'featureStarDensity' },
    { id: 'featureStarScale', nodeId: 'starfield', controlId: 'featureStarScale' },
    { id: 'featureStarVariance', nodeId: 'starfield', controlId: 'featureStarVariance' },
    { id: 'featureStarOpacity', nodeId: 'starfield', controlId: 'featureStarOpacity' },
    { id: 'twinkle', nodeId: 'starfield', controlId: 'twinkle' },
    { id: 'zoom', nodeId: 'quasar', controlId: 'zoom' },
    { id: 'inclination', nodeId: 'quasar', controlId: 'inclination' },
    { id: 'roll', nodeId: 'quasar', controlId: 'roll' },
    { id: 'drift', nodeId: 'quasar', controlId: 'drift' },
    { id: 'spin', nodeId: 'quasar', controlId: 'spin' },
    { id: 'turbulence', nodeId: 'quasar', controlId: 'turbulence' },
    { id: 'flowClarity', nodeId: 'quasar', controlId: 'flowClarity' },
    { id: 'heat', nodeId: 'quasar', controlId: 'heat' },
    { id: 'radius', nodeId: 'quasar', controlId: 'radius' },
    { id: 'lensing', nodeId: 'quasar', controlId: 'lensing' },
    { id: 'photon', nodeId: 'quasar', controlId: 'photon' },
    { id: 'jetPower', nodeId: 'quasar', controlId: 'jetPower' },
    { id: 'jetWidth', nodeId: 'quasar', controlId: 'jetWidth' },
    { id: 'jetTwist', nodeId: 'quasar', controlId: 'jetTwist' },
    { id: 'jetSpeed', nodeId: 'quasar', controlId: 'jetSpeed' },
    { id: 'bloom', nodeId: 'quasar', controlId: 'bloom' },
    { id: 'softness', nodeId: 'quasar', controlId: 'softness' },
    { id: 'exposure', nodeId: 'quasar', controlId: 'exposure' },
    { id: 'cameraYaw', nodeId: 'quasar', controlId: 'cameraYaw' },
    { id: 'cameraPitch', nodeId: 'quasar', controlId: 'cameraPitch' },
    { id: 'cameraPanX', nodeId: 'quasar', controlId: 'cameraPanX' },
    { id: 'cameraPanY', nodeId: 'quasar', controlId: 'cameraPanY' },
    { id: 'cameraDolly', nodeId: 'quasar', controlId: 'cameraDolly' },
    { id: 'cameraRoll', nodeId: 'quasar', controlId: 'cameraRoll' },
    { id: 'orbiters', nodeId: 'planets', controlId: 'orbiters' },
    { id: 'orbitSpeed', nodeId: 'planets', controlId: 'orbitSpeed' },
    { id: 'beltDensity', nodeId: 'planets', controlId: 'beltDensity' },
  ],
});
