import { defineComponent } from '@lux/visual-sdk';
import { Scene, PerspectiveCamera, Vector3, Color } from 'three/webgpu';
import { createFlareRig } from './flare-rig.ts';

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'lux/optical-flare',
    label: 'Layered Optical Flare',
    description: 'Transparent camera-axis optical ghosts with soft bloom and a restrained optional streak.',
    tags: ['cosmos', 'flare', 'light'],
    inputs: {},
    outputs: {
      image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Flare', description: 'Transparent additive flare layer.' },
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
    controlDescriptions: {
      intensity: 'Light energy; choose a small value for distant stars.',
      size: 'Radius relative to screen half-height, independent of world distance.',
      hue: 'Subtle warm or cool source color.',
      saturation: 'Color strength; lower values preserve a white-hot core.',
      x: 'Normalized screen position; -1 is left and +1 is right.',
      y: 'Normalized screen position; -1 is bottom and +1 is top.',
      ghosts: 'Strength of chromatic aperture ghosts along the optical axis.',
      streak: 'Strength of the thin horizontal streak; low by default.',
    },
    controls: {
      intensity: { type: 'number', label: 'Brightness', default: 1, min: 0, max: 5, step: 0.01, group: 'Light' },
      size: { type: 'number', label: 'Angular size', default: 0.42, min: 0.01, max: 1.5, step: 0.01, group: 'Light' },
      hue: { type: 'number', label: 'Tint hue', default: 0.60, min: 0, max: 1, step: 0.01, group: 'Light' },
      saturation: { type: 'number', label: 'Tint saturation', default: 0.30, min: 0, max: 1, step: 0.01, group: 'Light' },
      x: { type: 'number', label: 'Horizontal position', default: -0.42, min: -1.2, max: 1.2, step: 0.01, group: 'Position' },
      y: { type: 'number', label: 'Vertical position', default: 0.22, min: -1.2, max: 1.2, step: 0.01, group: 'Position' },
      ghosts: { type: 'number', label: 'Ghost layers', default: 0.8, min: 0, max: 3, step: 0.01, group: 'Optics' },
      streak: { type: 'number', label: 'Horizontal streak', default: 0.08, min: 0, max: 1, step: 0.01, group: 'Optics' },
    },
  },
  async create(context) {
    const scene = new Scene();
    const camera = new PerspectiveCamera(50, context.settings.width / context.settings.height, 0.1, 100);
    camera.position.z = 5;
    camera.updateMatrixWorld();
    const rig = createFlareRig('optical');
    scene.add(rig.root);
    const position = new Vector3();
    const tint = new Color();
    return {
      update(frame) {
        const c = frame.controls;
        position.set(c.x, c.y, 0.5).unproject(camera);
        tint.setHSL(c.hue, c.saturation, 0.78);
        rig.update(camera, position, { brightness: c.intensity, scale: c.size, tint,
          ghosts: c.ghosts, streak: c.streak });
      },
      async evaluate(_inputs, evaluation) { return { image: await evaluation.render(scene, camera) }; },
      reset() {},
      dispose() { rig.dispose(); },
    };
  },
});
