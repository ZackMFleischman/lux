import { defineComponent } from '@lux/visual-sdk';

const ringFragments = Object.freeze({
  helpers: `fn loRings(r: LoRegion, p: vec2f, t: f32, settings: vec4f) -> f32 {
  let density = max(settings.x, 0.05);
  let width = max(settings.y, 0.05);
  let variation = clamp(settings.z, 0.0, 1.5);
  let motion = max(settings.w, 0.0);
  let frequency = 6.2 * density;
  let tangent = normalize(r.tangent);
  let normal = vec2f(-tangent.y, tangent.x);
  let attached = vec2f(dot(r.local, tangent), dot(r.local, normal));
  let grid = attached * frequency;
  let home = floor(grid);
  let pixel = max(max(fwidth(p.x), fwidth(p.y)) * frequency, 0.0008);
  var coverage = 0.0;

  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let cell = home + vec2f(f32(x), f32(y));
      let seed = cell + vec2f(r.identity * 0.097, r.identity * 0.149);
      let hx = loHash(seed + 11.7);
      let hy = loHash(seed + 37.1);
      let hr = loHash(seed + 79.9);
      let hd = loHash(seed + 151.3);
      let phase = loHash(seed + 211.7) * 6.2831853;
      let jitter = (vec2f(hx, hy) - 0.5) * (0.14 + variation * 0.19);
      let drift = vec2f(sin(t * 0.061 * motion + phase), cos(t * 0.073 * motion + phase));
      let center = cell + vec2f(0.5) + jitter + drift * motion * 0.016;
      let q = grid - center;
      let baseRadius = mix(0.17, 0.48, hr);
      let pulse = 1.0 + motion * 0.025 * sin(t * 0.052 + phase);
      let radius = baseRadius * mix(0.92, 1.10, variation * hr) * pulse;
      let radial = length(q);
      let inkWidth = (0.023 + hx * 0.012) * width;
      let ringDistance = abs(radial - radius);
      let ring = 1.0 - smoothstep(inkWidth, inkWidth + pixel, ringDistance);
      let dotRadius = radius * mix(0.18, 0.31, hy);
      let dot = (1.0 - smoothstep(dotRadius - pixel, dotRadius + pixel, radial))
        * step(0.82 - variation * 0.035, hd);
      coverage = max(coverage, max(ring, dot));
    }
  }
  return clamp(coverage, 0.0, 1.0);
}
`,
});

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'lux/packed-rings',
    label: 'Packed Circles & Rings',
    description: 'A reusable field of unequal packed circles, rings, and occasional solid dots.',
    tags: ['ornament', 'pattern', 'rings'],
    inputs: {},
    outputs: {
      pattern: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-rings/v1' },
        label: 'Rings',
        description: 'Packed circle and ring helper with its current multiplier values.',
      },
    },
    controls: {
      density: { type: 'number', group: 'Rings', label: 'Density', default: 1, min: 0.3, max: 2, step: 0.01 },
      width: { type: 'number', group: 'Rings', label: 'Line width', default: 1, min: 0.3, max: 2, step: 0.01 },
      variation: { type: 'number', group: 'Rings', label: 'Variation', default: 1, min: 0, max: 1.5, step: 0.01 },
      motion: { type: 'number', group: 'Rings', label: 'Motion', default: 1, min: 0, max: 2, step: 0.01 },
    },
    controlDescriptions: {
      density: 'Multiplies the painting’s circle and ring packing density.',
      width: 'Multiplies the painting’s circle and ring ink width.',
      variation: 'Multiplies the painting’s circle size and placement variation.',
      motion: 'Multiplies the painting’s subtle circle and ring motion.',
    },
    lifecycle: { state: 'stateless', reset: 'seed' },
  },
  async create() {
    let density = 1;
    let width = 1;
    let variation = 1;
    let motion = 1;
    return {
      update(frame) {
        density = frame.controls.density;
        width = frame.controls.width;
        variation = frame.controls.variation;
        motion = frame.controls.motion;
      },
      async evaluate(_inputs, evaluation) {
        return {
          pattern: evaluation.shaderField('pattern', {
            version: 1,
            abi: 'lux/ornament-rings/v1',
            fragments: ringFragments,
            values: { density, width, variation, motion },
          }),
        };
      },
      reset() {},
      dispose() {},
    };
  },
});
