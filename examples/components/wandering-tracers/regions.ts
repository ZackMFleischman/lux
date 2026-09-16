import { defineComponent } from '@lux/visual-sdk';
import { ornamentRegionFragments } from './ornament-regions.ts';

// ABI lux/organic-regions/v1 supplies exactly these two source fragments.
// The painting consumer inserts them at the original livingPainting body and
// helper positions. Fragment source must remain stable for one component
// instance; changing it requires a deliberate rebuild of that consumer.
const regionFragments = Object.freeze({
  regionGeometry: `  // Compact regions: a gentle turning current and bounded local perturbations.
  // Avoid stacked directional shears, which stretched the earlier study.
  var q = p;
  let phrase = lpPhrase(p, t);
  let energy = music.x * (1.0 + music.y * (phrase - 0.5) * 0.85);
  let turn = form.y * 0.075 * sin(t * 0.055) * exp(-dot(p, p) * 0.035);
  q += vec2f(-p.y, p.x) * turn;
  let drift = vec2f(t * 0.009, -t * 0.007);
  q += form.y * 0.19 * (vec2f(lpNoise(p * 1.25 + seed + drift), lpNoise(p * 1.25 + seed + 48.9 - drift)) - 0.5);
  q += form.y * 0.065 * (0.65 + energy * 0.35)
    * (vec2f(lpNoise(p * 3.2 + seed + drift), lpNoise(p * 3.2 + seed + 17.8 - drift)) - 0.5);
  q += character.y * 0.022 * (vec2f(lpNoise(p * 7.0 + seed), lpNoise(p * 7.0 + seed + 13.8)) - 0.5);
  let cell = floor(q);
  var first = 1000.0;
  var owner = vec2f(0.0);
  var center = vec2f(0.0);
  // Nearby weighted seeds trade territory continuously. No frame-wise randomness.
  for (var y = -2; y <= 2; y++) {
    for (var x = -2; x <= 2; x++) {
      let id = cell + vec2f(f32(x), f32(y));
      let region = lpRegion(id, seed, t, form, music);
      let site = region.xy;
      let weight = region.z;
      let d = dot(q - site, q - site) - weight;
      if (d < first) {
        first = d;
        owner = id;
        center = site;
      }
    }
  }
  let r = lpHash2(owner + seed + 7.0);
  let local = q - center;
  // True minimum distance to the competing weighted bisectors. The original
  // first/second shortcut changed denominator abruptly, creating stray arcs.
  // Reuse the weighted cell's half planes for every tracer.
  var cellPlanes: array<vec3f, 25>;
  var planeCount = 0;
  let ownerWeight = lpRegion(owner, seed, t, form, music).z;
  var edge = 1000.0;
  for (var y = -2; y <= 2; y++) {
    for (var x = -2; x <= 2; x++) {
      let id = cell + vec2f(f32(x), f32(y));
      if (any(id != owner)) {
        let region = lpRegion(id, seed, t, form, music);
        let site = region.xy;
        let weight = region.z;
        let d = dot(q - site, q - site) - weight;
        let normal = 2.0 * (site - center);
        let plane = dot(site, site) - weight - dot(center, center) + ownerWeight;
        cellPlanes[planeCount] = vec3f(normal, plane);
        planeCount += 1;
        edge = min(edge, max(0.0, d - first) / max(2.0 * length(site - center), 0.01));
      }
    }
  }
  let pixelSize = max(length(dpdx(q)), length(dpdy(q)));
  let edgeAA = clamp(fwidth(edge), 0.0001, pixelSize * 1.4);
`,
  lpRegion: `fn lpRegion(id: vec2f, seed: vec2f, time: f32, form: vec4f, music: vec4f) -> vec3f {
  let random = lpHash2(id + seed);
  let group = floor(id * 0.5);
  let slot = id - group * 2.0;
  let anchorSlot = floor(lpHash(group + seed + 137.0) * 4.0);
  let anchor = select(0.0, 1.0, slot.x + slot.y * 2.0 == anchorSlot);
  let phrase = lpPhrase(id + 0.5, time);
  let groupAngle = lpHash(group + seed + 51.0) * 6.283185;
  let localAngle = lpHash(id + seed + 87.0) * 6.283185;
  let motionGate = 0.42 + music.y * 0.58 * phrase;
  let movement = vec2f(sin(time * 0.10 + groupAngle), cos(time * 0.085 + groupAngle)) * 0.10
    + vec2f(cos(time * 0.13 + localAngle), sin(time * 0.11 + localAngle)) * 0.045;
  let site = id + 0.5 + (random - 0.5) * 0.83 + form.z * motionGate * movement;
  let hierarchy = music.w * (anchor * 0.86 - 0.17);
  let staticWeight = (lpHash(id + seed + 13.0) - 0.5) * 0.72 + hierarchy;
  let response = mix(-0.65, 1.0, anchor);
  let growth = form.w * music.x * 0.37 * response * music.y * (phrase - 0.45);
  return vec3f(site, staticWeight + growth);
}
`,
});

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'lux/organic-regions',
    label: 'Organic Regions & Motion',
    description: 'Reusable weighted organic regions with the Living Painting sheet deformation and site motion.',
    tags: ['painting', 'regions', 'motion'],
    inputs: {},
    outputs: {
      field: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/organic-regions/v1' },
        label: 'Regions',
        description: 'Region geometry and motion shader fragments with their current numeric values.',
      },
      ornament: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-regions/v1' },
        label: 'Ornament regions',
        description: 'Layered analytic ornament regions with stable ownership, local coordinates, and visible boundaries.',
      },
    },
    controls: {
      scale: { type: 'number', group: 'Regions', label: 'Scale', default: 6.2, min: 2, max: 10, step: 0.01 },
      warp: { type: 'number', group: 'Regions', label: 'Flowing bends', default: 2.65, min: 0, max: 3, step: 0.01 },
      growth: { type: 'number', group: 'Regions', label: 'Region growth', default: 0.88, min: 0, max: 1.5, step: 0.01 },
      seed: { type: 'number', group: 'Regions', label: 'Variation', default: 7, min: 0, max: 100, step: 1 },
      motion: { type: 'number', group: 'Motion', label: 'Drift', default: 1.08, min: 0, max: 1.5, step: 0.01 },
      ornamentSize: { type: 'number', group: 'Ornament Shape', label: 'Size', default: 1, min: 0.6, max: 1.5, step: 0.01 },
      ornamentComplexity: { type: 'number', group: 'Ornament Shape', label: 'Complexity', default: 0.7, min: 0, max: 1.5, step: 0.01 },
      ornamentConcavity: { type: 'number', group: 'Ornament Shape', label: 'Concavity', default: 0.85, min: 0, max: 1.5, step: 0.01 },
      ornamentCorridorWidth: { type: 'number', group: 'Ornament Shape', label: 'Corridor width', default: 0.11, min: 0.03, max: 0.25, step: 0.01 },
      ornamentNesting: { type: 'number', group: 'Ornament Shape', label: 'Nesting', default: 0.65, min: 0, max: 1, step: 0.01 },
      ornamentMotion: { type: 'number', group: 'Ornament Motion', label: 'Motion', default: 0.15, min: 0, max: 1, step: 0.01 },
      ornamentGrowth: { type: 'number', group: 'Ornament Motion', label: 'Growth', default: 0.25, min: 0, max: 1, step: 0.01 },
    },
    controlDescriptions: {
      scale: 'scale setting for the painting.',
      warp: 'warp setting for the painting.',
      growth: 'growth setting for the painting.',
      seed: 'seed setting for the painting.',
      motion: 'motion setting for the painting.',
      ornamentSize: 'Overall scale of the broad ornament regions.',
      ornamentComplexity: 'Adds organic variation and layered lobe detail.',
      ornamentConcavity: 'Deepens the carved bays within the broad regions.',
      ornamentCorridorWidth: 'Sets the width of winding connections and thin necks.',
      ornamentNesting: 'Controls the presence and size of nested islands.',
      ornamentMotion: 'Sets the subtle attached motion of each region.',
      ornamentGrowth: 'Sets the amount of slow region breathing.',
    },
    lifecycle: { state: 'stateless', reset: 'seed' },
  },
  async create() {
    let scale = 6.2;
    let warp = 2.65;
    let growth = 0.88;
    let seed = 7;
    let motion = 1.08;
    let ornamentSize = 1;
    let ornamentComplexity = 0.7;
    let ornamentConcavity = 0.85;
    let ornamentCorridorWidth = 0.11;
    let ornamentNesting = 0.65;
    let ornamentMotion = 0.15;
    let ornamentGrowth = 0.25;
    return {
      update(frame) {
        scale = frame.controls.scale;
        warp = frame.controls.warp;
        growth = frame.controls.growth;
        seed = frame.controls.seed;
        motion = frame.controls.motion;
        ornamentSize = frame.controls.ornamentSize;
        ornamentComplexity = frame.controls.ornamentComplexity;
        ornamentConcavity = frame.controls.ornamentConcavity;
        ornamentCorridorWidth = frame.controls.ornamentCorridorWidth;
        ornamentNesting = frame.controls.ornamentNesting;
        ornamentMotion = frame.controls.ornamentMotion;
        ornamentGrowth = frame.controls.ornamentGrowth;
      },
      async evaluate(_inputs, evaluation) {
        return {
          field: evaluation.shaderField('field', {
            version: 1,
            abi: 'lux/organic-regions/v1',
            fragments: regionFragments,
            values: { scale, warp, growth, seed, motion },
          }),
          ornament: evaluation.shaderField('ornament', {
            version: 1,
            abi: 'lux/ornament-regions/v1',
            fragments: ornamentRegionFragments,
            values: {
              size: ornamentSize,
              complexity: ornamentComplexity,
              concavity: ornamentConcavity,
              corridorWidth: ornamentCorridorWidth,
              nesting: ornamentNesting,
              motion: ornamentMotion,
              growth: ornamentGrowth,
              seed,
            },
          }),
        };
      },
      reset() {},
      dispose() {},
    };
  },
});
