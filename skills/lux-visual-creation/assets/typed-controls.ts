import { defineVisual } from '@lux/visual-sdk';
import {
  Color,
  Mesh,
  MeshBasicNodeMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
} from 'three/webgpu';

export default defineVisual({
  controls: {
    scale: {
      type: 'number',
      label: 'Scale',
      default: 0.72,
      min: 0.3,
      max: 1,
      step: 0.01,
      group: 'Shape',
    },
    glow: {
      type: 'boolean',
      label: 'Glow',
      default: true,
      group: 'Appearance',
    },
    palette: {
      type: 'enum',
      label: 'Palette',
      default: 'violet',
      presentation: 'dropdown',
      group: 'Appearance',
      options: [
        { id: 'violet', label: 'Violet', description: 'Electric violet tones.' },
        { id: 'ember', label: 'Ember', description: 'Warm ember tones.' },
        { id: 'mint', label: 'Mint', description: 'Fresh mint tones.' },
      ],
    },
    direction: {
      type: 'enum',
      label: 'Direction',
      default: 'right',
      presentation: 'radio',
      group: 'Motion',
      options: [
        { id: 'left', label: 'Left' },
        { id: 'right', label: 'Right' },
      ],
    },
    shape: {
      type: 'enum',
      label: 'Shape',
      default: 'square',
      presentation: 'segmented',
      group: 'Shape',
      options: [
        { id: 'wide', label: 'Wide' },
        { id: 'square', label: 'Square' },
        { id: 'tall', label: 'Tall' },
      ],
    },
  },
  async create(context) {
    const geometry = new PlaneGeometry(1, 1);
    const material = new MeshBasicNodeMaterial({ color: '#8a68ff' });
    const mesh = new Mesh(geometry, material);
    const scene = new Scene();
    scene.background = new Color('#090b13');
    scene.add(mesh);

    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    return {
      update(frame) {
        const direction = frame.controls.direction === 'left' ? -1 : 1;
        const dimensions = frame.controls.shape === 'wide'
          ? [1.35, 0.68]
          : frame.controls.shape === 'tall'
            ? [0.68, 1.35]
            : [1, 1];
        const colors = {
          violet: '#8a68ff',
          ember: '#ff7043',
          mint: '#54e6b3',
        } as const;

        mesh.scale.set(
          dimensions[0] * frame.controls.scale,
          dimensions[1] * frame.controls.scale,
          1,
        );
        mesh.rotation.z = direction * frame.timeSeconds * 0.22;
        material.color.set(colors[frame.controls.palette]);
        material.opacity = frame.controls.glow ? 1 : 0.45;
        material.transparent = !frame.controls.glow;
      },
      render(target) {
        return context.renderer.render(scene, camera, target);
      },
      reset(_seed) {},
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  },
});
