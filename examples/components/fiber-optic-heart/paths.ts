import { defineComponent } from '@lux/visual-sdk';
import { makeLoops } from './geometry.ts';

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'fiber-heart/looping-paths',
    label: 'Looping Spline Paths',
    description: 'Persistent closed figure-eight strands around a central opening; sampled paths2d for independent renderers.',
    tags: ['paths', 'loops', 'cables'],
    inputs: {},
    outputs: {
      paths: { type: { kind: 'paths2d', version: 1, coordinateSpace: 'canvas-height' }, label: 'Paths', description: 'Up to sixteen closed paths, 97 points each.' },
    },
    controls: {
      count: { type: 'number', group: 'Shape', label: 'Strands', default: 12, min: 0, max: 16, step: 1 },
      spread: { type: 'number', group: 'Shape', label: 'Spread', default: 1, min: 0.3, max: 1.4, step: 0.01 },
      width: { type: 'number', group: 'Shape', label: 'Cable width', default: 0.018, min: 0.002, max: 0.05, step: 0.001 },
      seed: { type: 'number', group: 'Shape', label: 'Arrangement', default: 7, min: 0, max: 999, step: 1 },
      motion: { type: 'number', group: 'Motion', label: 'Drift', default: 0.35, min: 0, max: 2, step: 0.01 },
    },
    controlDescriptions: {
      count: 'Number of persistent strands. Existing identities stay stable as more are added.',
      spread: 'Scales the knot around its central opening.',
      width: 'Full base width in canvas-height units; renderer style scales this width.',
      seed: 'Chooses a repeatable arrangement of looping strands.',
      motion: 'Slow analytic deformation; zero freezes the routes.',
    },
    lifecycle: { state: 'stateless', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    let snapshot = makeLoops(0, aspect, { count: 12, spread: 1, width: 0.018, seed: 7, motion: 0.35 });
    return {
      update(frame) {
        snapshot = makeLoops(frame.timeSeconds, aspect, frame.controls);
      },
      async evaluate(_inputs, evaluation) {
        return { paths: evaluation.paths('paths', snapshot) };
      },
      reset() {},
      dispose() {},
    };
  },
});
