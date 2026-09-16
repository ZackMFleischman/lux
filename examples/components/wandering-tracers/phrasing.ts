import { defineComponent } from '@lux/visual-sdk';

// ABI lux/composition-phrasing/v1 owns the shared phrase/noise basis and the
// accumulated artistic clock used by every compatible painting field.
const phrasingFragments = Object.freeze({
  lpPhrase: `// A slow rise, a short crest, then a longer release and a quiet interval.
// Nearby regions share a phrase; its position-dependent delay prevents a pulse
// that makes the entire image breathe in lockstep.
fn lpPhrase(position: vec2f, time: f32) -> f32 {
  let phase = fract(time * 0.028 + lpNoise(position * 0.28 + 19.7) * 0.32);
  return smoothstep(0.10, 0.58, phase) * (1.0 - smoothstep(0.66, 0.91, phase));
}

`,
  noiseBasis: `
fn lpHash(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.x, p.y, p.x) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn lpHash2(p: vec2f) -> vec2f {
  return vec2f(lpHash(p), lpHash(p + vec2f(39.7, 17.2)));
}

fn lpNoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(lpHash(i), lpHash(i + vec2f(1.0, 0.0)), u.x),
    mix(lpHash(i + vec2f(0.0, 1.0)), lpHash(i + vec2f(1.0, 1.0)), u.x), u.y);
}

fn lpFbm(p: vec2f) -> f32 {
  return lpNoise(p) * 0.56 + lpNoise(p * 2.03 + 7.1) * 0.27 + lpNoise(p * 4.09 + 19.3) * 0.12 + lpNoise(p * 8.13 + 31.7) * 0.05;
}
`,
});

const ornamentFragments = Object.freeze({
  helpers: (phrasingFragments.lpPhrase + phrasingFragments.noiseBasis).replaceAll('lp', 'lo'),
});

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'lux/composition-phrasing',
    label: 'Composition Phrasing',
    description: 'Shared artistic clock, phrase rhythm, spatial composition, and deterministic noise basis.',
    tags: ['painting', 'motion', 'composition'],
    inputs: {},
    outputs: {
      field: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/composition-phrasing/v1' },
        label: 'Phrasing',
        description: 'Phrase and noise shader helpers with the current artistic time and composition values.',
      },
      ornament: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-phrasing/v1' },
        label: 'Ornament phrasing',
        description: 'Shared artistic time and noise helpers for compatible ornament renderers.',
      },
    },
    controls: {
      pace: { type: 'number', group: 'Motion', label: 'Pace', default: 1.24, min: 0, max: 3, step: 0.01 },
      phrasing: { type: 'number', group: 'Motion', label: 'Tension and release', default: 1, min: 0, max: 1, step: 0.01, description: 'Slow build, crest, release, and rest. Shapes lead; linework and color follow.' },
      composition: { type: 'number', group: 'Composition', label: 'Quiet to intricate', default: 0.44, min: 0, max: 1.5, step: 0.01 },
      tension: { type: 'number', group: 'Composition', label: 'Tension', default: 0.72, min: 0, max: 1.5, step: 0.01, description: 'Strength of local pressure, contrasting line directions, and rhythmic compression.' },
      hierarchy: { type: 'number', group: 'Composition', label: 'Large and small rhythm', default: 0.99, min: 0, max: 1.5, step: 0.01, description: 'Large anchor regions alternate with smaller supporting regions.' },
    },
    controlDescriptions: {
      pace: 'pace setting for the painting.',
      phrasing: 'phrasing setting for the painting.',
      composition: 'composition setting for the painting.',
      tension: 'tension setting for the painting.',
      hierarchy: 'hierarchy setting for the painting.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create() {
    let artisticTime = 0;
    let previousTime = 0;
    let pace = 1.24;
    let phrasing = 1;
    let composition = 0.44;
    let tension = 0.72;
    let hierarchy = 0.99;
    return {
      update(frame) {
        const c = frame.controls;
        artisticTime += Math.max(0, frame.timeSeconds - previousTime) * c.pace;
        previousTime = frame.timeSeconds;
        pace = c.pace;
        phrasing = c.phrasing;
        composition = c.composition;
        tension = c.tension;
        hierarchy = c.hierarchy;
      },
      async evaluate(_inputs, evaluation) {
        return {
          field: evaluation.shaderField('field', {
            version: 1,
            abi: 'lux/composition-phrasing/v1',
            fragments: phrasingFragments,
            values: { time: artisticTime, pace, phrasing, composition, tension, hierarchy },
          }),
          ornament: evaluation.shaderField('ornament', {
            version: 1,
            abi: 'lux/ornament-phrasing/v1',
            fragments: ornamentFragments,
            values: { time: artisticTime, pace, phrasing, composition, tension, hierarchy },
          }),
        };
      },
      reset() {
        artisticTime = 0;
        previousTime = 0;
      },
      dispose() {},
    };
  },
});
