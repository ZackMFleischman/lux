import { defineComponent } from '@lux/visual-sdk';

// Shared LoRegion, loHash and loNoise come from the consumer's geometry/phrasing.
// The ribbon fragment preserves the prototype ladder, pearl and stripe math.
const ribbonFragments = Object.freeze({
  helpers: `
fn loRibbonMarks(r: LoRegion, p: vec2f, t: f32, settings: vec4f) -> f32 {
  let density = max(settings.x, 0.08);
  let width = clamp(settings.y, 0.1, 3.0);
  let variety = clamp(settings.z, 0.0, 1.5);
  let identity = vec2f(r.identity * 1.731, r.parent * 0.913 + 23.7);
  let family = loHash(identity + 41.3);
  let character = loHash(identity + 83.1);
  let axis = normalize(r.tangent + vec2f(0.00001, 0.0));
  let side = vec2f(-axis.y, axis.x);
  let along = dot(r.local, axis);
  let across = dot(r.local, side);
  let sway = settings.w * 0.018 * sin(t * 0.17 + character * 6.28318);
  let bend = variety * 0.025 * sin(along * 3.4 + character * 8.0 + sway);
  let laneWidth = mix(0.13, 0.22, character) / sqrt(density);
  let transverse = (across + bend) / laneWidth;
  let spacing = mix(0.085, 0.14, loHash(identity + 107.0)) / density;
  let phase = along / spacing + character * 7.0;
  let rungId = floor(phase + 0.5);
  let jitter = (loHash(vec2f(rungId, r.identity + 11.0)) - 0.5) * 0.13 * variety;
  let rungDistance = abs(fract(phase + jitter + 0.5) - 0.5);
  let rungAA = max(fwidth(phase), 0.006);
  let transverseAA = max(fwidth(transverse), 0.006);

  // A long ladder follows the shape: two calm rails and individual crossbars.
  let band = 1.0 - smoothstep(0.84, 0.84 + transverseAA, abs(transverse));
  let railDistance = abs(abs(transverse) - 0.80);
  let rails = 1.0 - smoothstep(0.028 * width, 0.028 * width + transverseAA, railDistance);
  let rungs = (1.0 - smoothstep(0.048 * width, 0.048 * width + rungAA, rungDistance)) * band;
  let ladder = 1.0 - (1.0 - rails) * (1.0 - rungs);

  // Alternating bead sizes make a necklace rather than a uniform dotted line.
  let beadSize = 0.23 + 0.07 * loHash(vec2f(rungId + 67.0, r.identity));
  let beadPoint = vec2f((fract(phase + jitter + 0.5) - 0.5), transverse * 0.56);
  let beadDistance = length(beadPoint);
  let beadAA = max(fwidth(beadDistance), 0.008);
  let pearl = 1.0 - smoothstep(beadSize * sqrt(width), beadSize * sqrt(width) + beadAA, beadDistance);
  let beadRim = 1.0 - smoothstep(0.032 * width, 0.032 * width + beadAA, abs(beadDistance - beadSize));
  let beads = mix(pearl, beadRim, step(0.58, character));

  // The third family is a broad ribbon of closely spaced transverse bands.
  let ribbonBand = 1.0 - smoothstep(0.91, 0.91 + transverseAA, abs(transverse));
  let stripes = (1.0 - smoothstep(0.15 * width, 0.15 * width + rungAA, rungDistance)) * ribbonBand;
  let pattern = mix(mix(ladder, beads, step(0.36, family)), stripes, step(0.73, family));
  let boundaryAA = max(fwidth(r.edge), 0.0004);
  let inset = smoothstep(0.006, 0.018 + boundaryAA, r.edge);
  return clamp(pattern * inset, 0.0, 1.0);
}
`,
});

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'lux/decorated-ribbons',
    label: 'Decorated Ribbons',
    description: 'Region-attached ladders, pearl beads, and transverse ribbon stripes with independent live multipliers.',
    tags: ['ornament', 'ribbons', 'pattern'],
    inputs: {},
    outputs: {
      pattern: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-ribbons/v1' },
        label: 'Ribbons', description: 'Decorated ribbon coverage helper and current pattern multipliers.',
      },
    },
    controls: {
      density: { type: 'number', group: 'Decorated Ribbons', label: 'Density', default: 1, min: 0.3, max: 2, step: 0.01 },
      width: { type: 'number', group: 'Decorated Ribbons', label: 'Width', default: 1, min: 0.3, max: 2, step: 0.01 },
      variation: { type: 'number', group: 'Decorated Ribbons', label: 'Variation', default: 1, min: 0, max: 1.5, step: 0.01 },
      motion: { type: 'number', group: 'Decorated Ribbons', label: 'Motion', default: 1, min: 0, max: 2, step: 0.01 },
    },
    controlDescriptions: {
      density: 'Multiplies the shared ornament density for ribbon cells and beads.',
      width: 'Multiplies the shared ornament stroke width for rails, rungs, and pearl rims.',
      variation: 'Multiplies the shared variation in ribbon bends and cell placement.',
      motion: 'Multiplies the shared slow motion of region-attached ribbons.',
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
            abi: 'lux/ornament-ribbons/v1',
            fragments: ribbonFragments,
            values: { density, width, variation, motion },
          }),
        };
      },
      reset() {},
      dispose() {},
    };
  },
});
