import { defineComponent } from '@lux/visual-sdk';
import {
  CAMERA_CONTROLLER_ABI,
  type CameraControllerValues,
} from './camera-pose.ts';

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'lux/camera-controller',
    label: 'Camera Controller',
    description: 'Additive manual camera offsets for an explicitly connected 3D camera consumer.',
    tags: ['camera', '3d', 'interaction'],
    inputs: {},
    outputs: {
      camera: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/camera-controller/v1' },
        label: 'Camera offsets',
        description: 'Validated orbit, pan, dolly, and roll offsets for an opted-in camera consumer.',
      },
    },
    controls: {
      yaw: { type: 'number', label: 'Orbit left / right', default: 0, min: -3.141592653589793, max: 3.141592653589793, step: 0.001, group: 'Camera' },
      pitch: { type: 'number', label: 'Orbit up / down', default: 0, min: -1.553, max: 1.553, step: 0.001, group: 'Camera' },
      panX: { type: 'number', label: 'Pan horizontal', default: 0, min: -2, max: 2, step: 0.001, group: 'Camera' },
      panY: { type: 'number', label: 'Pan vertical', default: 0, min: -2, max: 2, step: 0.001, group: 'Camera' },
      dolly: { type: 'number', label: 'Dolly', default: 0, min: -0.95, max: 4, step: 0.001, group: 'Camera' },
      roll: { type: 'number', label: 'Roll', default: 0, min: -3.141592653589793, max: 3.141592653589793, step: 0.001, group: 'Camera' },
    },
    controlDescriptions: {
      yaw: 'Additive orbit angle around the authored up axis, in radians.',
      pitch: 'Additive orbit angle around the yawed right axis, in radians.',
      panX: 'Horizontal offset in multiples of the consumer focus distance.',
      panY: 'Vertical offset in multiples of the consumer focus distance.',
      dolly: 'Additive camera distance in multiples of the consumer focus distance.',
      roll: 'Additive rotation around the final forward axis, in radians.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create() {
    let values: CameraControllerValues = Object.freeze({ yaw: 0, pitch: 0, panX: 0, panY: 0, dolly: 0, roll: 0 });
    return {
      update(frame) {
        values = Object.freeze({
          yaw: frame.controls.yaw,
          pitch: frame.controls.pitch,
          panX: frame.controls.panX,
          panY: frame.controls.panY,
          dolly: frame.controls.dolly,
          roll: frame.controls.roll,
        });
      },
      async evaluate(_inputs, evaluation) {
        return {
          camera: evaluation.shaderField('camera', {
            version: 1,
            abi: CAMERA_CONTROLLER_ABI,
            fragments: {},
            values,
          }),
        };
      },
      reset() {},
      dispose() {},
    };
  },
});
