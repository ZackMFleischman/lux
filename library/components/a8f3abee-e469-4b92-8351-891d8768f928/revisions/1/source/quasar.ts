import { defineComponent } from '@lux/visual-sdk';
import disk from './accretion-disk.ts';
import lensing from './lensing/gravitational-lensing.ts';
import jets from './jets/polar-jets.ts';
import bloom from './bloom/quasar-bloom.ts';
import camera from './camera-controller/camera-controller.ts';

// Reusable quasar: shared 3D fields converge in one disk renderer, then bloom.
export default defineComponent({
  label: 'Quasar',
  definitions: { disk, lensing, jets, bloom, camera },
  nodes: [
    { id: 'camera', definition: 'camera' },
    { id: 'lensing', definition: 'lensing' },
    { id: 'jets', definition: 'jets' },
    { id: 'disk', definition: 'disk' },
    { id: 'bloom', definition: 'bloom' },
  ],
  inputs: {
    image: { nodeId: 'disk', portId: 'image' },
    bodies: { nodeId: 'disk', portId: 'bodies' },
  },
  edges: [
    { id: 'camera-to-disk', from: { nodeId: 'camera', portId: 'camera' }, to: { nodeId: 'disk', portId: 'camera' }, delay: 'none' },
    { id: 'lensing-to-disk', from: { nodeId: 'lensing', portId: 'field' }, to: { nodeId: 'disk', portId: 'lensing' }, delay: 'none' },
    { id: 'jets-to-disk', from: { nodeId: 'jets', portId: 'field' }, to: { nodeId: 'disk', portId: 'jets' }, delay: 'none' },
    { id: 'disk-to-bloom', from: { nodeId: 'disk', portId: 'image' }, to: { nodeId: 'bloom', portId: 'image' }, delay: 'none' },
  ],
  output: { nodeId: 'bloom', portId: 'image' },
  expose: [
    { id: 'zoom', nodeId: 'disk', controlId: 'zoom' },
    { id: 'inclination', nodeId: 'disk', controlId: 'inclination' },
    { id: 'roll', nodeId: 'disk', controlId: 'roll' },
    { id: 'drift', nodeId: 'disk', controlId: 'drift' },
    { id: 'spin', nodeId: 'disk', controlId: 'spin' },
    { id: 'turbulence', nodeId: 'disk', controlId: 'turbulence' },
    { id: 'flowClarity', nodeId: 'disk', controlId: 'flowClarity' },
    { id: 'heat', nodeId: 'disk', controlId: 'heat' },
    { id: 'radius', nodeId: 'disk', controlId: 'radius' },
    { id: 'lensing', nodeId: 'lensing', controlId: 'lensing' },
    { id: 'photon', nodeId: 'lensing', controlId: 'photon' },
    { id: 'jetPower', nodeId: 'jets', controlId: 'jetPower' },
    { id: 'jetWidth', nodeId: 'jets', controlId: 'jetWidth' },
    { id: 'jetTwist', nodeId: 'jets', controlId: 'jetTwist' },
    { id: 'jetSpeed', nodeId: 'jets', controlId: 'jetSpeed' },
    { id: 'bloom', nodeId: 'bloom', controlId: 'bloom' },
    { id: 'softness', nodeId: 'bloom', controlId: 'softness' },
    { id: 'exposure', nodeId: 'bloom', controlId: 'exposure' },
    { id: 'cameraYaw', nodeId: 'camera', controlId: 'yaw' },
    { id: 'cameraPitch', nodeId: 'camera', controlId: 'pitch' },
    { id: 'cameraPanX', nodeId: 'camera', controlId: 'panX' },
    { id: 'cameraPanY', nodeId: 'camera', controlId: 'panY' },
    { id: 'cameraDolly', nodeId: 'camera', controlId: 'dolly' },
    { id: 'cameraRoll', nodeId: 'camera', controlId: 'roll' },
  ],
});
