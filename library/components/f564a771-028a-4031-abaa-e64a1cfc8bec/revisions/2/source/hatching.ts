import { defineComponent } from '@lux/visual-sdk';
import { ornamentHatchingFragments } from './ornament-hatching.ts';

// ABI lux/region-hatching/v1 supplies the original regional drawing function.
// The painting consumer inserts it at the original helper position. Fragment
// source must remain stable for one consumer instance.
const hatchingFragments = Object.freeze({
  lpRegionMarks: `fn lpRegionMarks(baseColor: vec3f, owner: vec2f, center: vec2f, local: vec2f,
  edge: f32, seed: vec2f, t: f32, form: vec4f, hatch: vec4f, ink: vec4f,
  character: vec4f, music: vec4f, variety: vec4f) -> vec3f {
  var color = baseColor;
  let r = lpHash2(owner + seed + 7.0);
  // Each region has a durable line family. Angles, fans and wave amplitudes
  // vary across regions; adjacent strokes inside one family bend together.
  let linePhrase = lpPhrase(center, t - 3.5);
  let lineEnergy = music.x * (1.0 + music.y * (linePhrase - 0.5) * 0.85);
  // Persistent region styles: restrained parallel marks, broad sweeps, fans,
  // and occasional contours. Shared family traits relate spacing and weight;
  // independent small variations prevent adjacent regions feeling stamped.
  let style = lpHash(owner + seed + 211.0);
  let detail = lpHash2(owner + seed + 317.0);
  let quietStyle = 1.0 - step(0.25, style);
  let fanStyle = step(0.65, style) * (1.0 - step(0.90, style));
  let contourStyle = step(0.90, style);
  let intrinsicBend = mix(0.72 + detail.x * 0.55, 0.12 + detail.x * 0.22, quietStyle)
    + fanStyle * 0.43;
  let regionCurvature = hatch.z * mix(1.0, intrinsicBend, variety.y);
  let sharedAngle = (lpNoise(center * 0.34 + seed * 0.01) - 0.5) * 2.5;
  let counterpoint = step(0.77, lpHash(owner + seed + 203.0));
  let localDirection = (r.x - 0.5) * mix(4.9, 1.35, music.z)
    + counterpoint * (1.05 + lineEnergy * 0.32) + (detail.y - 0.5) * 0.65;
  let angle = sharedAngle + localDirection * variety.z + hatch.w
    + music.y * 0.09 * (linePhrase - 0.5);
  let axis = vec2f(cos(angle), sin(angle));
  let along = dot(local, vec2f(-axis.y, axis.x));
  let across = dot(local, axis);
  let bend = 0.18 * sin(along * (1.3 + r.y) + r.y * 8.0 + t * 0.10)
    + 0.16 * (lpNoise(vec2f(along * 2.1 + t * 0.016, r.x * 21.0)) - 0.5)
    + 0.02 * sin(along * 6.1 - t * 0.07 + r.x * 13.0);
  let fan = (r.y - 0.5) * (0.28 + fanStyle * 0.85) * along * along;
  var path = across + regionCurvature * (bend + fan) * (0.82 + lineEnergy * 0.18);
  if (contourStyle > 0.5) {
    path = length(local + vec2f(0.68, -0.60)) + regionCurvature * bend * 0.45;
  }
  // Three related spacing bands create dense phrases, ordinary passages, rests.
  let intrinsicSpacing = select(select(0.58, 1.0, detail.x > 0.30), 1.55, detail.x > 0.75)
    * (0.90 + r.y * 0.20);
  let spacingBand = mix(1.0, intrinsicSpacing, variety.x);
  let spacing = hatch.y * spacingBand
    * (1.0 - music.y * music.x * 0.14 * (linePhrase - 0.5));
  let phase = path / spacing;
  let lineId = floor(phase + 0.5);
  let lineJitter = (lpHash(vec2f(lineId, r.x * 79.0)) - 0.5) * 0.17
    + character.y * 0.065 * (lpNoise(vec2f(along * 10.0, lineId + r.y * 91.0)) - 0.5);
  let stripeDistance = abs(fract(phase + 0.5 + lineJitter) - 0.5);
  let stripeAA = max(fwidth(phase), 0.001);
  let pressure = 0.73 + 0.36 * lpNoise(vec2f(along * 5.0, lineId * 1.7 + r.y * 4.0))
    + character.y * 0.20 * sin(along * 18.0 + lineId * 1.9);
  let intrinsicWeight = clamp(sqrt(intrinsicSpacing) * (0.68 + detail.y * 0.66)
    * (1.0 + quietStyle * 0.12), 0.48, 1.65);
  let regionWeight = ink.y * mix(1.0, intrinsicWeight, variety.w);
  let halfWidth = min(0.28, regionWeight * 4.0 * pressure * stripeAA);
  let stripe = 1.0 - smoothstep(halfWidth - stripeAA * 0.5, halfWidth + stripeAA * 0.5, stripeDistance);
  // Dense at lower/right, breathing room upper/left, slowly shifting overall.
  let position = center / form.x;
  let activity = smoothstep(-0.28, 0.30, position.x * 0.67 - position.y * 0.9 + 0.035 + 0.055 * sin(t * 0.045));
  let quiet = exp(-dot(center - vec2f(-0.8, 0.65), center - vec2f(-0.8, 0.65)) * 0.40);
  let eligibility = lpHash(owner + seed + 103.0);
  let score = hatch.x + character.x * ((activity - 0.5) * 0.92 - quiet * 0.29)
    + music.y * 0.07 * (linePhrase - 0.5);
  var coverage = smoothstep(eligibility - 0.045, eligibility + 0.045, score);
  coverage *= smoothstep(0.0, 0.1, hatch.x);
  coverage = mix(coverage, 1.0, smoothstep(0.94, 1.0, hatch.x));
  let growth = 0.80 + music.y * 0.23 * linePhrase + 0.05 * r.y;
  let reveal = 1.0 - smoothstep(growth - 0.08, growth + 0.08, along * 0.31 + 0.40);
  let inset = smoothstep(0.003, 0.012, edge);
  // A few small empty islands give the drawing secondary scale and punctuation.
  let islandDistance = length((local - vec2f(0.08, -0.05)) * vec2f(0.9, 1.3)) - (0.045 + r.x * 0.055);
  let islandAA = max(fwidth(islandDistance), 0.001);
  let islandActive = step(0.89, r.y) * smoothstep(0.025, 0.065, edge);
  let island = (1.0 - smoothstep(-islandAA, islandAA, islandDistance)) * islandActive;
  // A sparse, stable second family runs perpendicular to the primary axis.
  // Keep it lighter and more open so crosshatched regions remain accents.
  let crossStyle = lpHash(owner + seed + 509.0);
  let crossEligible = step(0.81, crossStyle) * (1.0 - contourStyle);
  let crossBend = regionCurvature * 0.065
    * sin(across * (1.5 + detail.y) + r.x * 9.0 + t * 0.08);
  let crossPhase = (along + crossBend) / (spacing * (1.18 + detail.y * 0.40));
  let crossId = floor(crossPhase + 0.5);
  let crossJitter = (lpHash(vec2f(crossId, r.y * 91.0)) - 0.5) * 0.12;
  let crossDistance = abs(fract(crossPhase + crossJitter + 0.5) - 0.5);
  let crossAA = max(fwidth(crossPhase), 0.001);
  let crossWidth = min(0.24, regionWeight * 3.2 * pressure * crossAA);
  let crossStripe = 1.0 - smoothstep(crossWidth - crossAA * 0.5,
    crossWidth + crossAA * 0.5, crossDistance);
  let drawing = 1.0 - (1.0 - stripe) * (1.0 - crossStripe * crossEligible * 0.72);
  let hatchAlpha = drawing * coverage * reveal * inset * (1.0 - island) * 0.92;
  let cream = mix(vec3f(0.89, 0.86, 0.70), vec3f(0.94, 0.79, 0.75), ink.z);
  color = mix(color, cream, hatchAlpha);
  color = mix(color, color * 0.78, island * 0.38);
  let islandLine = (1.0 - smoothstep(ink.x, ink.x + islandAA, abs(islandDistance))) * islandActive;
  color = mix(color, cream, islandLine * 0.70);

  return color;
}
`,
});

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'lux/region-hatching',
    label: 'Region Hatching',
    description: 'Reusable per-region line families, crosshatching, contours, and drawing coverage.',
    tags: ['painting', 'hatching', 'drawing'],
    inputs: {},
    outputs: {
      ornament: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-hatching/v1' },
        label: 'Ornament hatching',
        description: 'Attached wavy hatching and crosshatching with live pattern multipliers.',
      },
      field: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/region-hatching/v1' },
        label: 'Hatching',
        description: 'Region hatching shader fragment with its current numeric values.',
      },
    },
    controls: {
      ornamentDensity: { type: 'number', group: 'Ornament Hatching', label: 'Density', default: 1, min: 0.3, max: 2, step: 0.01 },
      ornamentWidth: { type: 'number', group: 'Ornament Hatching', label: 'Width', default: 1, min: 0.3, max: 2, step: 0.01 },
      ornamentVariation: { type: 'number', group: 'Ornament Hatching', label: 'Variation', default: 1, min: 0, max: 1.5, step: 0.01 },
      ornamentMotion: { type: 'number', group: 'Ornament Hatching', label: 'Motion', default: 1, min: 0, max: 2, step: 0.01 },
      coverage: { type: 'number', group: 'Hatching', label: 'Coverage', default: 0.23, min: 0, max: 1, step: 0.01 },
      spacing: { type: 'number', group: 'Hatching', label: 'Average spacing', default: 0.096, min: 0.015, max: 0.12, step: 0.001, description: 'Overall spacing scale. Each region keeps its own spacing ratio.' },
      curvature: { type: 'number', group: 'Hatching', label: 'Overall bend', default: 1.52, min: 0, max: 3, step: 0.01, description: 'Strength of distinct regional styles: restrained lines, sweeping curves, fans, and contours.' },
      angle: { type: 'number', group: 'Hatching', label: 'Direction bias', default: 2.31, min: -3.1416, max: 3.1416, step: 0.01, description: 'Shifts the overall direction while preserving regional relationships.' },
      hatchWidth: { type: 'number', group: 'Hatching', label: 'Average ink weight', default: 0.12, min: 0.035, max: 0.4, step: 0.005, description: 'Overall stroke weight. Dense patterns tend toward finer strokes; open patterns can carry heavier marks.' },
      relation: { type: 'number', group: 'Hatching', label: 'Neighboring harmony', default: 0.54, min: 0, max: 1, step: 0.01, description: 'Neighboring patterns share direction, with occasional opposing accents.' },
      spacingVar: { type: 'number', group: 'Regional variety', label: 'Spacing variety', default: 1, min: 0, max: 1, step: 0.01 },
      curvatureVar: { type: 'number', group: 'Regional variety', label: 'Bend variety', default: 1, min: 0, max: 1, step: 0.01 },
      angleVar: { type: 'number', group: 'Regional variety', label: 'Direction variety', default: 1.19, min: 0, max: 1.5, step: 0.01 },
    },
    controlDescriptions: {
      ornamentDensity: 'Multiplies the shared ornament density for regional hatching.',
      ornamentWidth: 'Multiplies the shared ornament stroke width for regional hatching.',
      ornamentVariation: 'Multiplies the shared variation in regional hatch angles, spacing, and curvature.',
      ornamentMotion: 'Multiplies the shared slow motion of the attached hatching.',
      coverage: 'coverage setting for the painting.',
      spacing: 'spacing setting for the painting.',
      curvature: 'curvature setting for the painting.',
      angle: 'angle setting for the painting.',
      hatchWidth: 'hatchWidth setting for the painting.',
      relation: 'relation setting for the painting.',
      spacingVar: 'spacingVar setting for the painting.',
      curvatureVar: 'curvatureVar setting for the painting.',
      angleVar: 'angleVar setting for the painting.',
    },
    lifecycle: { state: 'stateless', reset: 'seed' },
  },
  async create() {
    let ornamentDensity = 1;
    let ornamentWidth = 1;
    let ornamentVariation = 1;
    let ornamentMotion = 1;
    let coverage = 0.23;
    let spacing = 0.096;
    let curvature = 1.52;
    let angle = 2.31;
    let hatchWidth = 0.12;
    let relation = 0.54;
    let spacingVar = 1;
    let curvatureVar = 1;
    let angleVar = 1.19;
    return {
      update(frame) {
        ornamentDensity = frame.controls.ornamentDensity;
        ornamentWidth = frame.controls.ornamentWidth;
        ornamentVariation = frame.controls.ornamentVariation;
        ornamentMotion = frame.controls.ornamentMotion;
        coverage = frame.controls.coverage;
        spacing = frame.controls.spacing;
        curvature = frame.controls.curvature;
        angle = frame.controls.angle;
        hatchWidth = frame.controls.hatchWidth;
        relation = frame.controls.relation;
        spacingVar = frame.controls.spacingVar;
        curvatureVar = frame.controls.curvatureVar;
        angleVar = frame.controls.angleVar;
      },
      async evaluate(_inputs, evaluation) {
        return {
          ornament: evaluation.shaderField('ornament', {
            version: 1,
            abi: 'lux/ornament-hatching/v1',
            fragments: ornamentHatchingFragments,
            values: { density: ornamentDensity, width: ornamentWidth, variation: ornamentVariation, motion: ornamentMotion },
          }),
          field: evaluation.shaderField('field', {
            version: 1,
            abi: 'lux/region-hatching/v1',
            fragments: hatchingFragments,
            values: {
              coverage,
              spacing,
              curvature,
              angle,
              hatchWidth,
              relation,
              spacingVar,
              curvatureVar,
              angleVar,
              widthVar: 0.81,
            },
          }),
        };
      },
      reset() {},
      dispose() {},
    };
  },
});
