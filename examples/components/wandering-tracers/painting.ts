import { defineComponent, type Paths2DResource, type ShaderFieldResource } from '@lux/visual-sdk';
import {
  Scene,
  DataTexture,
  FloatType,
  RGBAFormat,
  NearestFilter,
  Mesh,
  PlaneGeometry,
  MeshBasicNodeMaterial,
  OrthographicCamera,
} from 'three/webgpu';
import { uniform, texture, uv, vec4, wgslFn } from 'three/tsl';

// A deliberately self-contained painting study. All pattern coordinates share
// the same slowly deforming sheet; region identities never reseed each frame.
const paintingBeforeRegions = `
fn livingPainting(st: vec2f, view: vec4f, form: vec4f, hatch: vec4f, pigment: vec4f, ink: vec4f, character: vec4f, music: vec4f, variety: vec4f, tracers: vec4f, trailData: texture_2d<f32>) -> vec4f {
  let t = view.x;
  let p = (st - 0.5) * vec2f(view.y, 1.0) * form.x;
  let seed = vec2f(view.z * 3.17, view.z * 7.31);
`;

const paintingAfterWatercolor = `
  let baseWash = color;
  var underpainting = color;
  let cream = mix(vec3f(0.89, 0.86, 0.70), vec3f(0.94, 0.79, 0.75), ink.z);
  let parentDrawing = lpRegionMarks(color, owner, center, local, edge, seed, t,
    form, hatch, ink, character, music, variety);
  color = parentDrawing;
  // Each cut contributes its own daughter style. Combining changes relative to
  // the parent preserves earlier divisions where different tracers intersect.
  var totalSplit = 0.0;
  var styleDelta = vec3f(0.0);
  var washDelta = vec3f(0.0);
  for (var traceIndex = 0; traceIndex < 4; traceIndex++) {
    if (textureLoad(trailData, vec2i(256 + traceIndex, 0), 0).x > 1.0) {
      let split = lpTracerSplit(p, q, center, owner, cellPlanes, planeCount,
        t, form.x, view.y, tracers, seed.x, f32(traceIndex), trailData);
      let childOwner = split.yz;
      let childTone = lpHash(childOwner + seed + 61.0);
      // Related but visibly distinct pigments on opposite sides of each cut.
      let family = lpHash(owner + seed + f32(traceIndex) * 31.7 + 407.0);
      let coolPigment = mix(vec3f(0.13, 0.28, 0.48), vec3f(0.16, 0.51, 0.43), family);
      let warmPigment = mix(vec3f(0.85, 0.64, 0.32), vec3f(0.67, 0.43, 0.48), family);
      let daughterPigment = mix(coolPigment, warmPigment, split.w);
      let washLight = dot(baseWash, vec3f(0.2126, 0.7152, 0.0722));
      let childWash = mix(baseWash * (0.84 + childTone * 0.30),
        daughterPigment * (0.70 + washLight * 0.65), 0.62);
      let daughterColor = lpRegionMarks(childWash, childOwner, center, local,
        edge, seed, t, form, hatch, ink, character, music, variety);
      totalSplit += split.x;
      styleDelta += (daughterColor - parentDrawing) * split.x;
      washDelta += (childWash - baseWash) * split.x;
    }
  }
  color += styleDelta / max(1.0, totalSplit);
  underpainting += washDelta / max(1.0, totalSplit);

  let edgePressure = 0.57 + 0.68 * lpNoise(q * 7.0 + seed)
    + character.y * 0.13 * sin(q.x * 37.0 + q.y * 21.0);
  let boundaryWidth = ink.x * 140.0 * pixelSize * edgePressure;
  let boundary = 1.0 - smoothstep(boundaryWidth - edgeAA * 0.55, boundaryWidth + edgeAA * 0.55, edge);
  color = mix(color, cream, boundary * (0.62 + 0.32 * lpNoise(q * 2.3 + seed)));
  // Stationary paper grain avoids animated video noise.
  let grain = lpHash(floor(st * vec2f(1920.0, 1080.0))) - 0.5;
  let fibers = lpNoise(p * 92.0) - 0.5;
  color += (grain * 0.026 + fibers * 0.037) * ink.w;
  color *= 0.96 + 0.04 * smoothstep(0.0, 0.25, min(min(st.x, 1.0 - st.x), min(st.y, 1.0 - st.y)));
  return vec4f(pow(clamp(color, vec3f(0.0), vec3f(1.0)), vec3f(2.2)), 1.0);
}


`;

const paintingAfterHatching = `

// Consume the exact geometry published by Tracer Paths. The region transition
// intentionally retains the uneven per-pixel wash behavior of the saved study.
fn lpTracerSplit(p: vec2f, q: vec2f, center: vec2f, owner: vec2f,
  planes: array<vec3f, 25>, planeCount: i32, time: f32, scale: f32,
  aspect: f32, settings: vec4f, seed: f32, index: f32,
  trailData: texture_2d<f32>) -> vec4f {
  let slot = i32(index);
  let metadata = textureLoad(trailData, vec2i(256 + slot, 0), 0);
  let count = i32(metadata.x);
  let offset = slot * 64;
  let sheetOffset = q - p;
  var crossingEntry = 1000.0;
  var crossingExit = -1000.0;
  var nearest = 1000.0;
  var signedSide = 0.0;
  for (var j = 0; j < 63; j++) {
    if (j + 1 >= count) { break; }
    let a = textureLoad(trailData, vec2i(offset + j, 0), 0);
    let b = textureLoad(trailData, vec2i(offset + j + 1, 0), 0);
    let start = a.xy * scale;
    let direction = (b.xy - a.xy) * scale;
    let ratio = clamp(dot(p - start, direction) / max(dot(direction, direction), 0.000001), 0.0, 1.0);
    let delta = p - (start + direction * ratio);
    let distance = dot(delta, delta);
    if (distance < nearest) {
      nearest = distance;
      signedSide = direction.x * delta.y - direction.y * delta.x;
    }
    let origin = start + sheetOffset;
    // Skip distant segments before clipping against the cell half planes.
    if (length(origin + direction * 0.5 - center) < 3.5) {
      var low = 0.0;
      var high = 1.0;
      for (var k = 0; k < planeCount; k++) {
        let numerator = planes[k].z - dot(planes[k].xy, origin);
        let denominator = dot(planes[k].xy, direction);
        if (abs(denominator) < 0.00001) {
          if (numerator < 0.0) { high = -1.0; }
        } else if (denominator > 0.0) {
          high = min(high, numerator / denominator);
        } else {
          low = max(low, numerator / denominator);
        }
      }
      if (high > low) {
        crossingEntry = min(crossingEntry, mix(a.w, b.w, low) * scale);
        crossingExit = max(crossingExit, mix(a.w, b.w, high) * scale);
      }
    }
  }
  let headDistance = textureLoad(trailData, vec2i(offset + max(count - 1, 0), 0), 0).w * scale;
  let blend = smoothstep(0.08, 0.25, crossingExit - crossingEntry)
    * smoothstep(0.0, 0.48, headDistance - crossingExit) * metadata.y;
  let side = step(0.0, signedSide);
  let childOwner = owner + vec2f(137.7 + side * 79.3 + index * 53.1,
    213.1 + metadata.w * 31.7 + side * 43.9 + index * 117.3);
  return vec4f(blend, childOwner, side);
}

// A slow rise, a short crest, then a longer release and a quiet interval.
// Nearby regions share a phrase; its position-dependent delay prevents a pulse
// that makes the entire image breathe in lockstep.
fn lpPhrase(position: vec2f, time: f32) -> f32 {
  let phase = fract(time * 0.028 + lpNoise(position * 0.28 + 19.7) * 0.32);
  return smoothstep(0.10, 0.58, phase) * (1.0 - smoothstep(0.66, 0.91, phase));
}

`;

const paintingAfterRegionHelper = `
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
`;

const regionAbi = 'lux/organic-regions/v1';
const regionFragmentKeys = ['lpRegion', 'regionGeometry'] as const;
const regionValueKeys = ['growth', 'motion', 'scale', 'seed', 'warp'] as const;
const hatchingAbi = 'lux/region-hatching/v1';
const hatchingFragmentKeys = ['lpRegionMarks'] as const;
const hatchingValueKeys = ['angle', 'angleVar', 'coverage', 'curvature', 'curvatureVar', 'hatchWidth', 'relation', 'spacing', 'spacingVar', 'widthVar'] as const;
const watercolorAbi = 'lux/watercolor/v1';
const watercolorFragmentKeys = ['wash'] as const;
const watercolorValueKeys = ['blooms', 'contrast', 'palette', 'pooling', 'warmth'] as const;

function hasExactKeys(record: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean {
  const keys = Object.keys(record).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

export default defineComponent({
  metadata: {
    declarationVersion: 1, key: 'lux/living-painting', label: 'Living Painting',
    description: 'Organic watercolor regions that adopt new colors and hatch styles when shared tracer paths cross them.',
    tags: ['painting', 'regions', 'watercolor'],
    inputs: {
      paths: { type: { kind: 'paths2d', version: 1, coordinateSpace: 'canvas-height' }, label: 'Paths', description: 'Shared tracer geometry used to carve the regions.' },
      regions: { type: { kind: 'shader-field', version: 1, abi: 'lux/organic-regions/v1' }, label: 'Regions', description: 'Organic region geometry and motion shader field.' },
      hatching: { type: { kind: 'shader-field', version: 1, abi: 'lux/region-hatching/v1' }, label: 'Hatching', description: 'Per-region line families, crosshatching, contours, and drawing coverage.' },
      watercolor: { type: { kind: 'shader-field', version: 1, abi: 'lux/watercolor/v1' }, label: 'Watercolor', description: 'Animated washes, warm pools, blooms, and pigment pooling.' },
    },
    outputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'The painting before tracer ink is composited.' } },
  controls: {
    pace: { type: 'number', group: 'Motion', label: 'Pace', default: 1.24, min: 0, max: 3, step: 0.01 },
    phrasing: { type: 'number', group: 'Motion', label: 'Tension and release', default: 1, min: 0, max: 1, step: 0.01, description: 'Slow build, crest, release, and rest. Shapes lead; linework and color follow.' },

    composition: { type: 'number', group: 'Composition', label: 'Quiet to intricate', default: 0.44, min: 0, max: 1.5, step: 0.01 },
    tension: { type: 'number', group: 'Composition', label: 'Tension', default: 0.72, min: 0, max: 1.5, step: 0.01, description: 'Strength of local pressure, contrasting line directions, and rhythmic compression.' },
    hierarchy: { type: 'number', group: 'Composition', label: 'Large and small rhythm', default: 0.99, min: 0, max: 1.5, step: 0.01, description: 'Large anchor regions alternate with smaller supporting regions.' },

    outline: { type: 'number', group: 'Ink & paper', label: 'Boundary width', default: 0.005, min: 0.002, max: 0.03, step: 0.001 },
    inkWarmth: { type: 'number', group: 'Ink & paper', label: 'Warmth', default: 0.15, min: 0, max: 1, step: 0.01 },
    handDrawn: { type: 'number', group: 'Ink & paper', label: 'Hand-drawn character', default: 1.34, min: 0, max: 1.5, step: 0.01 },
    grain: { type: 'number', group: 'Ink & paper', label: 'Grain', default: 1.48, min: 0, max: 2, step: 0.01 },


  },
    controlDescriptions: {pace: 'pace setting for the painting.',
      phrasing: 'phrasing setting for the painting.',
      composition: 'composition setting for the painting.',
      tension: 'tension setting for the painting.',
      hierarchy: 'hierarchy setting for the painting.',
      outline: 'outline setting for the painting.',
      inkWarmth: 'inkWarmth setting for the painting.',
      handDrawn: 'handDrawn setting for the painting.',
      grain: 'grain setting for the painting.'},
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const time = uniform(0);
    const aspect = context.settings.width / context.settings.height;
    const seed = uniform(7);
    const scale = uniform(5.4);
    const warp = uniform(1.3);
    const motion = uniform(0.8);
    const growth = uniform(0.65);
    const coverage = uniform(0.58);
    const spacing = uniform(0.042);
    const curvature = uniform(1.3);
    const angle = uniform(0);
    const palette = uniform(0.1);
    const warmth = uniform(1);
    const contrast = uniform(1);
    const pooling = uniform(0.8);
    const outline = uniform(0.008);
    const hatchWidth = uniform(0.15);
    const inkWarmth = uniform(0.23);
    const grain = uniform(1);
    const composition = uniform(0.9);
    const handDrawn = uniform(0.85);
    const blooms = uniform(1.1);
    const tension = uniform(0.72);
    const phrasing = uniform(0.85);
    const relation = uniform(0.74);
    const hierarchy = uniform(1.0);
    const spacingVar = uniform(1);
    const curvatureVar = uniform(1);
    const angleVar = uniform(1);
    // Preserve the saved study’s regional weight variety.
    const widthVar = uniform(0.81);
    // Bounded texture upload avoids large uniform arrays and uses the exact shared paths.
    const pathData = new Float32Array(260 * 4);
    const pathTexture = new DataTexture(pathData, 260, 1, RGBAFormat, FloatType);
    pathTexture.minFilter = pathTexture.magFilter = NearestFilter;
    pathTexture.generateMipmaps = false;
    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    let material: MeshBasicNodeMaterial | undefined;
    let scene: Scene | undefined;
    let assembledShaderSource: string | undefined;

    function preparePainting(
      regions: ShaderFieldResource,
      hatching: ShaderFieldResource,
      watercolor: ShaderFieldResource,
    ): Scene {
      const regionData = regions.data;
      if (regionData.version !== 1 || regionData.abi !== regionAbi) {
        throw Error(`Living Painting requires shader field ${regionAbi}.`);
      }
      if (!hasExactKeys(regionData.fragments, regionFragmentKeys)) {
        throw Error(`Living Painting ${regionAbi} requires exactly the lpRegion and regionGeometry fragments.`);
      }
      if (!hasExactKeys(regionData.values, regionValueKeys)) {
        throw Error(`Living Painting ${regionAbi} requires exactly the growth, motion, scale, seed, and warp values.`);
      }
      const hatchingData = hatching.data;
      if (hatchingData.version !== 1 || hatchingData.abi !== hatchingAbi) {
        throw Error(`Living Painting requires shader field ${hatchingAbi}.`);
      }
      if (!hasExactKeys(hatchingData.fragments, hatchingFragmentKeys)) {
        throw Error(`Living Painting ${hatchingAbi} requires exactly the lpRegionMarks fragment.`);
      }
      if (!hasExactKeys(hatchingData.values, hatchingValueKeys)) {
        throw Error(`Living Painting ${hatchingAbi} requires exactly its nine control values and widthVar.`);
      }
      const watercolorData = watercolor.data;
      if (watercolorData.version !== 1 || watercolorData.abi !== watercolorAbi) {
        throw Error(`Living Painting requires shader field ${watercolorAbi}.`);
      }
      if (!hasExactKeys(watercolorData.fragments, watercolorFragmentKeys)) {
        throw Error(`Living Painting ${watercolorAbi} requires exactly the wash fragment.`);
      }
      if (!hasExactKeys(watercolorData.values, watercolorValueKeys)) {
        throw Error(`Living Painting ${watercolorAbi} requires exactly the blooms, contrast, palette, pooling, and warmth values.`);
      }

      const source = paintingBeforeRegions
        + regionData.fragments.regionGeometry
        + watercolorData.fragments.wash
        + paintingAfterWatercolor
        + hatchingData.fragments.lpRegionMarks
        + paintingAfterHatching
        + regionData.fragments.lpRegion
        + paintingAfterRegionHelper;
      if (assembledShaderSource !== undefined && source !== assembledShaderSource) {
        throw Error('Living Painting shader field source changed; rebuild the component to apply it.');
      }
      if (assembledShaderSource === undefined) {
        assembledShaderSource = source;
        material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
        material.fragmentNode = wgslFn(source)(
          uv(),
          vec4(time, aspect, seed, 0),
          vec4(scale, warp, motion, growth),
          vec4(coverage, spacing, curvature, angle),
          vec4(palette, warmth, contrast, pooling),
          vec4(outline, hatchWidth, inkWarmth, grain),
          vec4(composition, handDrawn, blooms, 0),
          vec4(tension, phrasing, relation, hierarchy),
          vec4(spacingVar, curvatureVar, angleVar, widthVar),
          vec4(4, 0, 0, 0),
          texture(pathTexture),
        );
        scene = new Scene();
        const mesh = new Mesh(geometry, material);
        mesh.frustumCulled = false;
        scene.add(mesh);
      }

      scale.value = regionData.values.scale;
      warp.value = regionData.values.warp;
      growth.value = regionData.values.growth;
      seed.value = regionData.values.seed;
      motion.value = regionData.values.motion;
      coverage.value = hatchingData.values.coverage;
      spacing.value = hatchingData.values.spacing;
      curvature.value = hatchingData.values.curvature;
      angle.value = hatchingData.values.angle;
      hatchWidth.value = hatchingData.values.hatchWidth;
      relation.value = hatchingData.values.relation;
      spacingVar.value = hatchingData.values.spacingVar;
      curvatureVar.value = hatchingData.values.curvatureVar;
      angleVar.value = hatchingData.values.angleVar;
      widthVar.value = hatchingData.values.widthVar;
      palette.value = watercolorData.values.palette;
      warmth.value = watercolorData.values.warmth;
      contrast.value = watercolorData.values.contrast;
      pooling.value = watercolorData.values.pooling;
      blooms.value = watercolorData.values.blooms;
      return scene!;
    }
    let artisticTime = 0;
    let previousTime = 0;
    return {
      update(frame) {
        const c = frame.controls;
        artisticTime += Math.max(0, frame.timeSeconds - previousTime) * c.pace;
        previousTime = frame.timeSeconds;
        time.value = artisticTime;
        outline.value = c.outline;
        inkWarmth.value = c.inkWarmth;
        grain.value = c.grain;
        composition.value = c.composition;
        handDrawn.value = c.handDrawn;
        tension.value = c.tension;
        phrasing.value = c.phrasing;
        hierarchy.value = c.hierarchy;
      },
      async evaluate(inputs, evaluation) {
        const scene = preparePainting(
          inputs.regions as ShaderFieldResource,
          inputs.hatching as ShaderFieldResource,
          inputs.watercolor as ShaderFieldResource,
        );
        const paths = (inputs.paths as Paths2DResource).data.paths;
        if (paths.length > 4 || paths.some(path => path.points.length > 64)) {
          throw Error('Living Painting supports at most four paths of 64 points.');
        }
        pathData.fill(0);
        paths.forEach((path, index) => {
          pathData.set([path.points.length, path.opacity, path.styleSeed, path.generation], (256 + index) * 4);
          path.points.forEach((point, j) => pathData.set([point.x, point.y, point.width, point.distance], (index * 64 + j) * 4));
        });
        pathTexture.needsUpdate = true;
        return { image: await evaluation.render(scene, camera) };
      },
      reset(_seed) {
        artisticTime = 0;
        previousTime = 0;
      },
      dispose() {
        geometry.dispose();
        material?.dispose();
        pathTexture.dispose();
      },
    };
  },
});
