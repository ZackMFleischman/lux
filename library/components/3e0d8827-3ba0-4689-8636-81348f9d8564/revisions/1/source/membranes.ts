import { defineComponent } from '@lux/visual-sdk';

const membraneFragments = Object.freeze({
  helpers: `fn loMembraneLineCoverage(distance: f32, halfWidth: f32, aa: f32) -> f32 {
  return 1.0 - smoothstep(halfWidth - aa, halfWidth + aa, abs(distance));
}

fn loMembranes(r: LoRegion, p: vec2f, t: f32, settings: vec4f) -> f32 {
  let density = settings.x;
  let width = settings.y;
  let variation = settings.z;
  let motion = settings.w;
  let along = dot(r.local, r.tangent);
  let across = dot(r.local, vec2f(-r.tangent.y, r.tangent.x));
  let identity = vec2f(r.identity, r.parent);
  let hubCount = 1 + i32(floor(loHash(identity + 12.7) * 2.0));
  let aa = max(fwidth(along) + fwidth(across), 0.0010);
  var membrane = 0.0;
  for (var hubIndex = 0; hubIndex < 3; hubIndex++) {
    if (hubIndex >= hubCount) { break; }
    let hubSeed = identity + vec2f(f32(hubIndex) * 19.1, 71.3);
    let hub = vec2f(
      mix(-0.10, 0.10, loHash(hubSeed)),
      mix(-0.08, 0.08, loHash(hubSeed + 7.9)),
    );
    let q = vec2f(along, across) - hub;
    let angle = atan2(q.y, q.x);
    let radius = length(q);
    let petalCount = max(3.0, floor((7.0 + floor(loHash(hubSeed + 31.0) * 4.0)) * density));
    let bowedAngle = angle + sin(radius * 4.6 + hubSeed.x + t * motion * 0.05)
      * variation * 0.78;
    let phase = bowedAngle * petalCount / 6.283185 + loHash(hubSeed + 43.0);
    // The angular distance is converted to a world-space distance by radius,
    // so each fan line stays clean and reaches its owning cell boundary.
    let angularDistance = (fract(phase + 0.5) - 0.5) * 6.283185 / petalCount;
    let spokeDistance = radius * sin(angularDistance);
    let spokeWidth = max(0.0045 * width, aa * (1.25 + width * 0.85));
    let spoke = loMembraneLineCoverage(spokeDistance, spokeWidth, aa);
    membrane = max(membrane, spoke);
  }
  let gate = smoothstep(0.08, 0.46, density);
  return membrane * gate;
}
`,
});

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'lux/membrane-divisions',
    label: 'Membrane Divisions',
    description: 'Curved petal-fan divisions for compatible Living Ornament renderers.',
    tags: ['ornament', 'pattern', 'line'],
    inputs: {},
    outputs: {
      pattern: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-membranes/v1' },
        label: 'Membranes',
        description: 'Membrane coverage helper and live pattern multipliers.',
      },
    },
    controls: {
      density: { type: 'number', group: 'Membranes', label: 'Density', default: 1, min: 0.3, max: 2, step: 0.01 },
      width: { type: 'number', group: 'Membranes', label: 'Width', default: 1, min: 0.3, max: 2, step: 0.01 },
      variation: { type: 'number', group: 'Membranes', label: 'Variation', default: 1, min: 0, max: 1.5, step: 0.01 },
      motion: { type: 'number', group: 'Membranes', label: 'Motion', default: 1, min: 0, max: 2, step: 0.01 },
    },
    controlDescriptions: {
      density: 'Sets the number of divisions in each membrane fan.',
      width: 'Multiplier for membrane division width.',
      variation: 'Multiplier for membrane curvature variation.',
      motion: 'Multiplier for membrane motion.',
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
          abi: 'lux/ornament-membranes/v1',
          fragments: membraneFragments,
          values: { density, width, variation, motion },
        }) };
      },
      reset() {},
      dispose() {},
    };
  },
});
