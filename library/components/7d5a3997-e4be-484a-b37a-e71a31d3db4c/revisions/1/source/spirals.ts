import { defineComponent } from '@lux/visual-sdk';

const spiralFragments = Object.freeze({
  helpers: `fn loSpirals(r: LoRegion, p: vec2f, t: f32, settings: vec4f) -> f32 {
  let density = max(settings.x, 0.05);
  let width = max(settings.y, 0.05);
  let variation = clamp(settings.z, 0.0, 1.5);
  let motion = max(settings.w, 0.0);
  let frequency = 7.0 * density;
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
      let seed = cell + vec2f(r.identity * 0.071, r.identity * 0.113);
      let hx = loHash(seed + 17.3);
      let hy = loHash(seed + 43.7);
      let hr = loHash(seed + 91.1);
      let phase = loHash(seed + 131.9) * 6.2831853;
      let jitter = (vec2f(hx, hy) - 0.5) * (0.14 + variation * 0.20);
      let drift = vec2f(cos(t * 0.083 * motion + phase), sin(t * 0.067 * motion + phase));
      let center = cell + vec2f(0.5) + jitter + drift * motion * 0.018;
      let q = grid - center;
      let radius = mix(0.22, 0.47, hr) * mix(0.92, 1.08, clamp(variation, 0.0, 1.0));
      let radial = length(q);
      let angle = atan2(q.y, q.x) + t * motion * (0.045 + hr * 0.035);
      let turns = 2.15 + variation * mix(0.65, 1.55, hx);
      let pitch = radius / max(turns, 0.5);
      let winding = abs(fract(radial / pitch - angle / 6.2831853 + 0.5) - 0.5) * pitch;
      let inkWidth = radius * (0.038 + hr * 0.014) * width;
      let line = 1.0 - smoothstep(inkWidth, inkWidth + pixel, winding);
      let packed = 1.0 - smoothstep(radius - pixel, radius + pixel, radial);
      coverage = max(coverage, line * packed);
    }
  }
  return clamp(coverage, 0.0, 1.0);
}
`,
});

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'lux/spiral-fill',
    label: 'Spiral Fill',
    description: 'A reusable field of tightly packed, region-attached spiral ink marks.',
    tags: ['ornament', 'pattern', 'spiral'],
    inputs: {},
    outputs: {
      pattern: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-spirals/v1' },
        label: 'Spirals',
        description: 'Packed spiral helper and its current multiplier values.',
      },
    },
    controls: {
      density: { type: 'number', group: 'Spirals', label: 'Density', default: 1, min: 0.3, max: 2, step: 0.01 },
      width: { type: 'number', group: 'Spirals', label: 'Line width', default: 1, min: 0.3, max: 2, step: 0.01 },
      variation: { type: 'number', group: 'Spirals', label: 'Variation', default: 1, min: 0, max: 1.5, step: 0.01 },
      motion: { type: 'number', group: 'Spirals', label: 'Motion', default: 1, min: 0, max: 2, step: 0.01 },
    },
    controlDescriptions: {
      density: 'Multiplies the painting’s spiral packing density.',
      width: 'Multiplies the painting’s spiral ink width.',
      variation: 'Multiplies the painting’s spiral size and placement variation.',
      motion: 'Multiplies the painting’s subtle spiral motion.',
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
            abi: 'lux/ornament-spirals/v1',
            fragments: spiralFragments,
            values: { density, width, variation, motion },
          }),
        };
      },
      reset() {},
      dispose() {},
    };
  },
});
