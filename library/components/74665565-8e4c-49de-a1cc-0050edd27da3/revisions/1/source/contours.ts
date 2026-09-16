import { defineComponent } from '@lux/visual-sdk';

const contourFragments = Object.freeze({
  helpers: `fn loContourLineCoverage(distance: f32, halfWidth: f32, aa: f32) -> f32 {
  return 1.0 - smoothstep(halfWidth - aa, halfWidth + aa, abs(distance));
}

fn loContours(r: LoRegion, p: vec2f, t: f32, settings: vec4f) -> f32 {
  let density = settings.x;
  let width = settings.y;
  let variation = settings.z;
  let motion = settings.w;
  let along = dot(r.local, r.tangent);
  let across = dot(r.local, vec2f(-r.tangent.y, r.tangent.x));
  let identity = vec2f(r.identity, r.parent);
  let offset = vec2f(
    (loHash(identity + 103.0) - 0.5) * 0.42,
    (loHash(identity + 211.0) - 0.5) * 0.34,
  );
  let q = vec2f(along, across) - offset;
  let angle = atan2(q.y, q.x);
  let stretch = vec2f(0.82 + loHash(identity + 17.0) * 0.52,
    0.70 + loHash(identity + 29.0) * 0.42);
  let radius = length(q / stretch);
  let lobes = 2.0 + floor(loHash(identity + 37.0) * 3.0);
  let waviness = sin(angle * lobes + identity.x * 0.17) * (0.040 + variation * 0.085)
    + sin(angle * (lobes + 2.0) - t * motion * 0.07) * 0.018;
  let contourRadius = radius + waviness;
  let spacing = mix(0.29, 0.105, clamp(density * 0.55, 0.0, 1.0));
  let phase = contourRadius / spacing + loHash(identity + 61.0) * 0.42;
  let contour = abs(fract(phase + 0.5) - 0.5) * spacing;
  let aa = max(fwidth(contourRadius), 0.0010);
  let lineWidth = max(0.0052 * width, aa * (1.10 + width * 0.78));
  let line = loContourLineCoverage(contour, lineWidth, aa);
  let taper = smoothstep(0.04, 0.24, r.edge) * (1.0 - smoothstep(1.15, 1.75, contourRadius));
  return line * taper;
}
`,
});

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'lux/nested-contours',
    label: 'Nested Contours',
    description: 'Wavy nested contour lines for compatible Living Ornament renderers.',
    tags: ['ornament', 'pattern', 'contour'],
    inputs: {},
    outputs: {
      pattern: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-contours/v1' },
        label: 'Contours',
        description: 'Contour coverage helper and live pattern multipliers.',
      },
    },
    controls: {
      density: { type: 'number', group: 'Contours', label: 'Density', default: 1, min: 0.3, max: 2, step: 0.01 },
      width: { type: 'number', group: 'Contours', label: 'Width', default: 1, min: 0.3, max: 2, step: 0.01 },
      variation: { type: 'number', group: 'Contours', label: 'Variation', default: 1, min: 0, max: 1.5, step: 0.01 },
      motion: { type: 'number', group: 'Contours', label: 'Motion', default: 1, min: 0, max: 2, step: 0.01 },
    },
    controlDescriptions: {
      density: 'Multiplier for nested contour density.',
      width: 'Multiplier for nested contour width.',
      variation: 'Multiplier for nested contour waviness.',
      motion: 'Multiplier for nested contour motion.',
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
        return { pattern: evaluation.shaderField('pattern', {
          version: 1,
          abi: 'lux/ornament-contours/v1',
          fragments: contourFragments,
          values: { density, width, variation, motion },
        }) };
      },
      reset() {},
      dispose() {},
    };
  },
});
