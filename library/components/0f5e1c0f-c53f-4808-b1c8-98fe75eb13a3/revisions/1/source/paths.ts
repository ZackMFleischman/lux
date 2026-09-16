import { defineComponent } from '@lux/visual-sdk';

import {
  createTracerGenerator,
  stepTracerGenerator,
  type PathsSnapshot,
} from './tracer-state.ts';

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'examples/wandering-tracer-paths',
    label: 'Wandering Tracer Paths',
    description: 'Generates reusable paths that enter from the canvas perimeter and grow across the frame.',
    tags: ['tracers', 'generator'],
    inputs: {},
    outputs: {
      paths: {
        type: { kind: 'paths2d', version: 1, coordinateSpace: 'canvas-height' },
        label: 'Paths',
        description: 'Grown tracer paths in centered canvas-height coordinates.',
      },
    },
    controls: {
      count: { type: 'number', group: 'Tracer paths', label: 'Count', default: 3, min: 0, max: 4, step: 1 },
      speed: { type: 'number', group: 'Tracer paths', label: 'Speed', default: 0.96, min: 0.1, max: 2, step: 0.01 },
      curl: { type: 'number', group: 'Tracer paths', label: 'Curl', default: 2.5, min: 0, max: 2.5, step: 0.01 },
      sway: { type: 'number', group: 'Tracer paths', label: 'Sway', default: 0.65, min: 0, max: 2, step: 0.01 },
      seed: { type: 'number', group: 'Tracer paths', label: 'Seed', default: 7, min: 0, max: 999, step: 1 },
      width: { type: 'number', group: 'Tracer paths', label: 'Width', default: 0.021, min: 0.005, max: 0.12, step: 0.001 },
      pace: { type: 'number', group: 'Tracer paths', label: 'Pace', default: 1.24, min: 0, max: 2, step: 0.01 },
    },
    controlDescriptions: {
      count: 'Sets the number of independent tracer lifetimes, up to four.',
      speed: 'Sets how quickly each tracer head advances through canvas-height space.',
      curl: 'Sets the stable curvature chosen for each lifetime.',
      sway: 'Sets a subtle shared-body movement without changing the deposited route.',
      seed: 'Chooses perimeter entries, headings, pigments, and hatch families.',
      width: 'Sets the full ribbon width in canvas-height units.',
      pace: 'Scales artistic time while deposition timestamps remain scene seconds.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    let generator = createTracerGenerator(aspect, Math.floor(context.random() * 0x7fff_ffff));
    let snapshot: PathsSnapshot = Object.freeze({ version: 1, paths: Object.freeze([]) });
    return {
      update(frame) {
        snapshot = stepTracerGenerator(generator, frame, frame.controls);
      },
      async evaluate(_inputs, evaluation) {
        return { paths: evaluation.paths('paths', snapshot) };
      },
      reset(seed) {
        generator = createTracerGenerator(aspect, seed);
        snapshot = Object.freeze({ version: 1, paths: Object.freeze([]) });
      },
      dispose() {
        snapshot = Object.freeze({ version: 1, paths: Object.freeze([]) });
      },
    };
  },
});
