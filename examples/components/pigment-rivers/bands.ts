import { defineComponent } from '@lux/visual-sdk';

// Expects loNoise from the unchanged Composition Phrasing provider.
const fragments = Object.freeze({
  helpers: `struct LoRegion {
  identity: f32,
  parent: f32,
  edge: f32,
  age: f32,
  local: vec2f,
  tangent: vec2f,
}

fn prWarp(p: vec2f, t: f32, settings: vec4f) -> vec2f {
  var q = p * settings.x;
  let clock = t * settings.z * 0.06;
  let seed = settings.w * 0.117;
  q.x += settings.y * (0.72 * sin(q.y * 1.35 + clock + seed)
    + 0.25 * sin(q.y * 2.7 - clock * 0.63));
  q.y += settings.y * (0.85 * sin(q.x * 1.22 - clock * 0.8)
    + 0.28 * sin(q.x * 2.8 + q.y * 0.65 + seed));
  q += (vec2f(loNoise(q * 1.8 + seed), loNoise(q * 1.8 + seed + 37.0)) - 0.5) * 0.12;
  return q;
}

fn prScalar(p: vec2f, t: f32, settings: vec4f) -> f32 {
  let q = prWarp(p, t, settings);
  // Unequal bands open into rounded pools near a few field extrema.
  return q.y * 1.7 + 0.62 * sin(q.x * 1.3) + 0.28 * cos(q.y * 1.6 + q.x * 0.7);
}

fn prRegion(p: vec2f, t: f32, settings: vec4f) -> LoRegion {
  let field = prScalar(p, t, settings);
  let epsilon = 0.003;
  let gradient = vec2f(
    prScalar(p + vec2f(epsilon, 0.0), t, settings) - prScalar(p - vec2f(epsilon, 0.0), t, settings),
    prScalar(p + vec2f(0.0, epsilon), t, settings) - prScalar(p - vec2f(0.0, epsilon), t, settings)
  ) / (2.0 * epsilon);
  let gradientLength = max(length(gradient), 0.15);
  let rawTangent = vec2f(-gradient.y, gradient.x) / max(length(gradient), 0.0001);
  let tangent = select(rawTangent, vec2f(1.0, 0.0), length(gradient) < 0.0001);
  let band = floor(field);
  let edge = min(fract(field), 1.0 - fract(field)) / gradientLength;
  let q = prWarp(p, t, settings);
  let local = tangent * q.x + vec2f(-tangent.y, tangent.x) * (fract(field) - 0.5) * 1.3;
  // Map stable bands into the existing wash's explicit color families.
  let identity = 101.0 + (band + 200.0 - floor((band + 200.0) / 19.0) * 19.0);
  return LoRegion(identity, 0.0, edge, 1.0, local, tangent);
}
`,
});

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'pigment-rivers/folded-bands',
    label: 'Folded Pigment Bands',
    description: 'Long folded color regions with a LoRegion-compatible local frame and estimated boundary distance.',
    tags: ['painting', 'bands', 'field'],
    inputs: {},
    outputs: {
      field: { type: { kind: 'shader-field', version: 1, abi: 'examples/folded-pigment-bands/v1' }, label: 'Bands', description: 'Helpers require the ornament phrasing noise basis. Values: scale, fold, flow, seed.' },
    },
    controls: {
      scale: { type: 'number', group: 'Pigment shape', label: 'Band density', default: 1, min: 0.4, max: 2, step: 0.01 },
      fold: { type: 'number', group: 'Pigment shape', label: 'Folding', default: 1.15, min: 0, max: 2, step: 0.01 },
      flow: { type: 'number', group: 'Pigment shape', label: 'Flow', default: 0.3, min: 0, max: 2, step: 0.01 },
      seed: { type: 'number', group: 'Pigment shape', label: 'Arrangement', default: 7, min: 0, max: 999, step: 1 },
    },
    controlDescriptions: {
      scale: 'Spatial density of pigment bands, independent of canvas aspect ratio.',
      fold: 'Large directional folds and bends; zero leaves quieter wavy strata.',
      flow: 'Speed of large shape deformation, using upstream artistic time.',
      seed: 'Stable arrangement of the folds and paper-like edge perturbations.',
    },
    lifecycle: { state: 'stateless', reset: 'seed' },
  },
  async create() {
    let values = { scale: 1, fold: 1.15, flow: 0.3, seed: 7 };
    return {
      update(frame) { values = { ...frame.controls }; },
      async evaluate(_inputs, evaluation) {
        return { field: evaluation.shaderField('field', {
          version: 1, abi: 'examples/folded-pigment-bands/v1', fragments, values,
        }) };
      },
      reset() {},
      dispose() {},
    };
  },
});
