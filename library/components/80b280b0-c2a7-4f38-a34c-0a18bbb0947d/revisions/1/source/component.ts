import { defineComponent } from '@lux/visual-sdk';
import {
  Scene, Color, Object3D,
  PerspectiveCamera, AmbientLight, DirectionalLight,
} from 'three/webgpu';

import { createCubeKit } from './cube-kit.ts';

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'cubes/prismatic-fan',
    label: 'Prismatic Cube Fan',
    description: 'One to twenty rainbow trails with reversible color and size gradients.',
    tags: ['cubes', 'metallic', 'cascade'],
    inputs: {},
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'The full metallic cube fan.',
      },
    },
    controls: {
      armCount: {
        type: 'number', label: 'Spiral arms', default: 10,
        min: 1, max: 20, step: 1,
      },
      hueShift: {
        type: 'number', label: 'Palette shift', default: 0,
        min: 0, max: 1, step: 0.01,
      },
      colorGradient: {
        type: 'number', label: 'Arm light gradient', default: 0.35,
        min: -1, max: 1, step: 0.01,
      },
      sizeTaper: {
        type: 'number', label: 'Cube size taper', default: 0.65,
        min: -1, max: 1, step: 0.01,
      },
    spinSpeed: {
      type: 'number', label: 'Spin speed', default: 0.6,
      min: -2, max: 2, step: 0.01, unit: 'rad/s',
    },
    spread: {
      type: 'number', label: 'Fan spread', default: 1.15,
      min: 0.2, max: 1.6, step: 0.01,
    },
    flowSpeed: {
      type: 'number', label: 'Cascade speed', default: 1.35,
      min: 0, max: 2, step: 0.01,
    },
    cubeSize: {
      type: 'number', label: 'Cube size', default: 0.7,
      min: 0.15, max: 0.85, step: 0.01,
    },
  },
    controlDescriptions: {
      armCount: 'Number of evenly spaced spiral arms.',
      hueShift: 'Rotate the rainbow palette across all arms.',
      colorGradient: 'Positive fades light to dark toward the tip; negative reverses it. Zero is even.',
      sizeTaper: 'Positive grows cubes toward the tip; negative shrinks them. Zero is uniform.',
      spinSpeed: 'Rotation speed of each cube.',
      spread: 'Radius multiplier for the fanned trails.',
      flowSpeed: 'Speed of the cascading fan motion.',
      cubeSize: 'Size multiplier for the cubes along each trail.',
    },
    lifecycle: { state: 'stateless', reset: 'seed' },
  },
  async create(context) {
    const scene = new Scene();
    scene.background = new Color(0x05070d);
    const kit = createCubeKit();
    const cubes = kit.makeInstances(560);
    cubes.frustumCulled = false;
    scene.add(cubes);
    const cube = new Object3D();
    const color = new Color();
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
    camera.position.z = 18;
    return {
      update(frame) {
        const time = frame.timeSeconds * frame.controls.flowSpeed;
        const spin = frame.timeSeconds * frame.controls.spinSpeed;
        const armCount = Math.round(frame.controls.armCount);
        cubes.count = armCount * 28;
        for (let i = 0; i < cubes.count; i++) {
          const arm = Math.floor(i / 28);
          const trail = i % 28;
          const u = trail / 27;
          const phase = time * 0.65 - u * 2.5 + arm * Math.PI * 2 / armCount;
          const radius = (0.8 + u * 7.4) * frame.controls.spread;

          cube.position.set(
            Math.cos(phase) * radius * 1.45,
            Math.sin(phase) * radius * 0.77 + 0.45 * Math.sin(time * 1.3 + u * 7),
            Math.sin(u * 5 - time + arm) * 1.7,
          );
          const size = frame.controls.cubeSize * (0.975 + (u - 0.5) * 1.3 * frame.controls.sizeTaper);
          cube.scale.setScalar(size);
          cube.rotation.set(
            0.35 + spin * 0.45 + u * 3 + arm,
            0.5 + spin + u * 4,
            phase * 0.4,
          );
          cube.updateMatrix();
          cubes.setMatrixAt(i, cube.matrix);
          const hue = (0.46 + arm / armCount + frame.controls.hueShift) % 1;
          const lightness = 0.55 + (0.5 - u) * frame.controls.colorGradient * 0.65;
          color.setHSL(hue, 0.78, lightness);
          cubes.setColorAt(i, color);
        }
        cubes.instanceMatrix.needsUpdate = true;
        if (cubes.instanceColor) cubes.instanceColor.needsUpdate = true;
      },
      async evaluate(_inputs, evaluation) {
        return { image: await evaluation.render(scene, camera) };
      },
      reset(_seed) {},
      dispose() {
        cubes.dispose();
        kit.dispose();
      },
    };
  },
});
