import { defineComponent } from '@lux/visual-sdk';
import {
  Scene, Color, Mesh, BoxGeometry, MeshStandardNodeMaterial,
  PerspectiveCamera, AmbientLight, DirectionalLight,
} from 'three/webgpu';

import { createCubeKit } from './cube-kit.ts';

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'cubes/metallic-cube',
    label: 'Metallic Cube',
    description: 'A reusable spinning metallic cube using the same cube primitive as the fan.',
    tags: ['cubes', 'metallic', 'cascade'],
    inputs: {},
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'A single metallic cube.',
      },
    },
    controls: {
    spinSpeed: {
      type: 'number', label: 'Spin speed', default: 0.6,
      min: -2, max: 2, step: 0.01, unit: 'rad/s',
    },
    cubeSize: {
      type: 'number', label: 'Cube size', default: 0.7,
      min: 0.15, max: 0.85, step: 0.01,
    },
  },
    controlDescriptions: {
      spinSpeed: 'Rotation speed of each cube.',
      cubeSize: 'Size multiplier for the cubes along each trail.',
    },
    lifecycle: { state: 'stateless', reset: 'seed' },
  },
  async create(context) {
    const scene = new Scene();
    scene.background = new Color(0x05070d);
    const kit = createCubeKit();
    const cubes: Mesh[] = [];
    for (let i = 0; i < 1; i++) {
      const cube = kit.makeCube(Math.floor(i / 28));
      cubes.push(cube);
      scene.add(cube);
    }
    scene.add(new AmbientLight(0xc4d8ff, 1.5));
    const key = new DirectionalLight(0xffffff, 6);
    key.position.set(3, 5, 7);
    scene.add(key);
    const rim = new DirectionalLight(0x74bfff, 4);
    rim.position.set(-5, 1, 3);
    scene.add(rim);
    const gold = new DirectionalLight(0xffc5a0, 3);
    gold.position.set(1, -4, -2);
    scene.add(gold);
    const camera = new PerspectiveCamera(
      45, context.settings.width / context.settings.height, 0.1, 100,
    );
    camera.position.z = 5;
    return {
      update(frame) {
        const spin = frame.timeSeconds * frame.controls.spinSpeed;
        const cube = cubes[0];
        cube.scale.setScalar(frame.controls.cubeSize * 2);
        cube.rotation.set(0.35 + spin * 0.45, 0.5 + spin, 0);
      },
      async evaluate(_inputs, evaluation) {
        return { image: await evaluation.render(scene, camera) };
      },
      reset(_seed) {},
      dispose() {
        kit.dispose();
      },
    };
  },
});
