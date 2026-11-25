import { defineComponent } from '@lux/visual-sdk';
import { OrthographicCamera, Scene } from 'three/webgpu';
import { createAlienSaucer } from './saucer.ts';
import { createAlienFlag } from './flag.ts';

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'hippo/alien-saucer',
    label: 'Alien Hippo Saucer',
    description: 'Bubble-canopy saucer piloted by the alien hippo. Transparent output; visits four configurable destinations with hover stops.',
    tags: ['space', 'hippo', 'character', 'flight'],
    inputs: {},
    outputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Saucer', description: 'Transparent saucer overlay.' } },
    controls: {
      plantFlags: { type: 'number', label: 'Plant flags', default: 1, min: 0, max: 1, step: 1, group: 'Landing flags' },
      flagSize: { type: 'number', label: 'Flag size', default: 0.45, min: 0.1, max: 1.5, step: 0.01, group: 'Landing flags' },
      autopilot: { type: 'number', label: 'Autopilot', default: 1, min: 0, max: 1, step: 1, group: 'Flight' },
      travel: { type: 'number', label: 'Travel time', default: 5, min: 0.5, max: 30, step: 0.1, unit: 's', group: 'Flight' },
      dwell: { type: 'number', label: 'Hover time', default: 3, min: 0, max: 20, step: 0.1, unit: 's', group: 'Flight' },
      arc: { type: 'number', label: 'Flight arc', default: 0.3, min: 0, max: 1, step: 0.01, group: 'Flight' },
      banking: { type: 'number', label: 'Banking', default: 0.65, min: 0, max: 1.5, step: 0.01, group: 'Flight' },
      size: { type: 'number', label: 'Saucer size', default: 0.65, min: 0.1, max: 2.5, step: 0.01, group: 'Appearance' },
      pilotSize: { type: 'number', label: 'Hippo size', default: 1, min: 0.4, max: 1.4, step: 0.01, group: 'Appearance' },
      hue: { type: 'number', label: 'Running-light hue', default: 0.43, min: 0, max: 1, step: 0.01, group: 'Appearance' },
      engine: { type: 'number', label: 'Engine glow / audio', default: 0.8, min: 0, max: 3, step: 0.01, group: 'Appearance' },
      beam: { type: 'number', label: 'Hover beam', default: 0.5, min: 0, max: 2, step: 0.01, group: 'Appearance' },
      x: { type: 'number', label: 'Manual X', default: 0, min: -1, max: 1, step: 0.01, group: 'Manual position' },
      y: { type: 'number', label: 'Manual Y', default: 0, min: -1, max: 1, step: 0.01, group: 'Manual position' },
      x1: { type: 'number', label: 'Stop 1 X', default: -0.65, min: -1, max: 1, step: 0.01, group: 'Destinations' },
      y1: { type: 'number', label: 'Stop 1 Y', default: 0.15, min: -1, max: 1, step: 0.01, group: 'Destinations' },
      x2: { type: 'number', label: 'Stop 2 X', default: -0.1, min: -1, max: 1, step: 0.01, group: 'Destinations' },
      y2: { type: 'number', label: 'Stop 2 Y', default: 0.5, min: -1, max: 1, step: 0.01, group: 'Destinations' },
      x3: { type: 'number', label: 'Stop 3 X', default: 0.65, min: -1, max: 1, step: 0.01, group: 'Destinations' },
      y3: { type: 'number', label: 'Stop 3 Y', default: -0.2, min: -1, max: 1, step: 0.01, group: 'Destinations' },
      x4: { type: 'number', label: 'Stop 4 X', default: 0.1, min: -1, max: 1, step: 0.01, group: 'Destinations' },
      y4: { type: 'number', label: 'Stop 4 Y', default: -0.45, min: -1, max: 1, step: 0.01, group: 'Destinations' },
    },
    controlDescriptions: {
      plantFlags: 'Deploy an alien-hippo flag halfway through each hover stop. Flags persist until transport Reset.',
      flagSize: 'Scale the flag independently of the craft.',
      autopilot: '1 visits four configurable stops; 0 uses Manual X/Y. Scene integration supplies planet positions.',
      travel: 'Travel time.',
      dwell: 'Hover time.',
      arc: 'Flight arc.',
      banking: 'Banking.',
      size: 'Saucer size.',
      pilotSize: 'Hippo size.',
      hue: 'Running-light hue.',
      engine: 'Map audio or an LFO here to pulse the engine.',
      beam: 'Hover beam.',
      x: 'Manual X.',
      y: 'Manual Y.',
      x1: 'Stop 1 X.',
      y1: 'Stop 1 Y.',
      x2: 'Stop 2 X.',
      y2: 'Stop 2 Y.',
      x3: 'Stop 3 X.',
      y3: 'Stop 3 Y.',
      x4: 'Stop 4 X.',
      y4: 'Stop 4 Y.',
    },
    lifecycle: { state: 'stateless', reset: 'seed' },
  },
  async create(context) {
    const scene = new Scene();
    const aspect = context.settings.width / context.settings.height;
    const camera = new OrthographicCamera(-5 * aspect, 5 * aspect, 5, -5, 0.1, 100);
    camera.position.set(0, 0, 15);
    const saucer = createAlienSaucer();
    scene.add(saucer.root, saucer.lighting);
    const flags = [createAlienFlag(), createAlienFlag(), createAlienFlag(), createAlienFlag()];
    for (const flag of flags) scene.add(flag.root);
    const xs = [0, 0, 0, 0];
    const ys = [0, 0, 0, 0];
    return {
      update(frame) {
        const c = frame.controls;
        const time = frame.timeSeconds;
        xs[0] = c.x1; xs[1] = c.x2; xs[2] = c.x3; xs[3] = c.x4;
        ys[0] = c.y1; ys[1] = c.y2; ys[2] = c.y3; ys[3] = c.y4;
        const segment = c.travel + c.dwell;
        const stop = Math.floor(time / segment) % 4;
        const next = (stop + 1) % 4;
        const local = time % segment;
        const p = Math.max(0, Math.min(1, (local - c.dwell) / c.travel));
        const eased = p * p * p * (p * (p * 6 - 15) + 10);
        const moving = Math.sin(Math.PI * p);
        const x = xs[stop] + (xs[next] - xs[stop]) * eased;
        const y = ys[stop] + (ys[next] - ys[stop]) * eased + moving * c.arc;
        saucer.root.position.set((c.autopilot >= 0.5 ? x : c.x) * aspect * 4, (c.autopilot >= 0.5 ? y : c.y) * 4, 0);
        saucer.root.scale.setScalar(c.size);
        for (let i = 0; i < flags.length; i++) {
          const plantedAt = i * segment + c.dwell * 0.5;
          const deploy = c.autopilot >= 0.5 && c.plantFlags >= 0.5 ? Math.max(0, Math.min(1, (time - plantedAt) / 0.8)) : 0;
          flags[i].root.position.set(xs[i] * aspect * 4 + c.size * 0.7, ys[i] * 4 - c.size * 0.85, 0.1);
          flags[i].update(time, deploy * deploy * (3 - 2 * deploy), c.flagSize);
        }
        const bank = c.autopilot >= 0.5 ? -(xs[next] - xs[stop]) * moving * c.banking * 0.35 : 0;
        saucer.update(time, bank, c.autopilot >= 0.5 ? 1 - moving : 1, c.pilotSize, c.engine, c.beam, c.hue);
      },
      async evaluate(_inputs, evaluation) {
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {},
      dispose() { saucer.dispose(); for (const flag of flags) flag.dispose(); },
    };
  },
});
