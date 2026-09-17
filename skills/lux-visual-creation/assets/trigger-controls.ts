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
    size: {
      type: 'number',
      label: 'Size',
      default: 0.64,
      min: 0.3,
      max: 0.9,
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
      presentation: 'segmented',
      group: 'Appearance',
      options: [
        { id: 'violet', label: 'Violet' },
        { id: 'ember', label: 'Ember' },
        { id: 'mint', label: 'Mint' },
      ],
    },
    pulse: {
      type: 'trigger',
      label: 'Pulse',
      description: 'Rotate the tile by one deterministic step.',
      group: 'Actions',
    },
    regenerate: {
      type: 'trigger',
      label: 'Regenerate',
      description: 'Advance the deterministic color and position variant.',
      group: 'Actions',
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

    let pulseStep = 0;
    let variant = 0;
    return {
      update(frame) {
        for (const event of frame.events) {
          if (event.controlId === 'pulse') pulseStep = (pulseStep + 1) % 8;
          if (event.controlId === 'regenerate') variant = (variant + 1) % 3;
        }

        const colors = {
          violet: ['#8a68ff', '#d45cff', '#5c78ff'],
          ember: ['#ff7043', '#ffb347', '#dd3f68'],
          mint: ['#54e6b3', '#31bfe0', '#a4ef6f'],
        } as const;
        mesh.scale.setScalar(frame.controls.size);
        mesh.rotation.z = pulseStep * Math.PI / 8;
        mesh.position.x = (variant - 1) * 0.22;
        material.color.set(colors[frame.controls.palette][variant]);
        material.opacity = frame.controls.glow ? 1 : 0.45;
        material.transparent = !frame.controls.glow;
      },
      render(target) {
        return context.renderer.render(scene, camera, target);
      },
      reset(_seed) {
        pulseStep = 0;
        variant = 0;
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  },
});
