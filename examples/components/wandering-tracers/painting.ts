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
const boundaryAbi = 'lux/boundary-ink/v1';
const boundaryFragmentKeys = ['finish'] as const;
const boundaryValueKeys = ['grain', 'handDrawn', 'inkWarmth', 'outline'] as const;
const phrasingAbi = 'lux/composition-phrasing/v1';
const phrasingFragmentKeys = ['lpPhrase', 'noiseBasis'] as const;
const phrasingValueKeys = ['composition', 'hierarchy', 'pace', 'phrasing', 'tension', 'time'] as const;

function hasExactKeys(record: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean {
  const keys = Object.keys(record).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

export default defineComponent({
  metadata: {
    declarationVersion: 1, key: 'lux/region-styles-split-transitions', label: 'Region Styles & Splits',
    description: 'Combines five painting fields and shared paths into region styles with smooth daughter-region color and hatch transitions.',
    tags: ['painting', 'regions', 'watercolor'],
    inputs: {
      paths: { type: { kind: 'paths2d', version: 1, coordinateSpace: 'canvas-height' }, label: 'Paths', description: 'Shared tracer geometry used to carve the regions.' },
      regions: { type: { kind: 'shader-field', version: 1, abi: 'lux/organic-regions/v1' }, label: 'Regions', description: 'Organic region geometry and motion shader field.' },
      hatching: { type: { kind: 'shader-field', version: 1, abi: 'lux/region-hatching/v1' }, label: 'Hatching', description: 'Per-region line families, crosshatching, contours, and drawing coverage.' },
      watercolor: { type: { kind: 'shader-field', version: 1, abi: 'lux/watercolor/v1' }, label: 'Watercolor', description: 'Animated washes, warm pools, blooms, and pigment pooling.' },
      boundary: { type: { kind: 'shader-field', version: 1, abi: 'lux/boundary-ink/v1' }, label: 'Boundary ink', description: 'Uneven warm outlines and stationary paper grain shader field.' },
      phrasing: { type: { kind: 'shader-field', version: 1, abi: 'lux/composition-phrasing/v1' }, label: 'Phrasing', description: 'Shared artistic clock, phrase rhythm, spatial composition, and noise basis.' },
    },
    outputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'The painting before tracer ink is composited.' } },
    controls: {},
    controlDescriptions: {},
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
      boundary: ShaderFieldResource,
      phrasingField: ShaderFieldResource,
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
      const boundaryData = boundary.data;
      if (boundaryData.version !== 1 || boundaryData.abi !== boundaryAbi) {
        throw Error(`Living Painting requires shader field ${boundaryAbi}.`);
      }
      if (!hasExactKeys(boundaryData.fragments, boundaryFragmentKeys)) {
        throw Error(`Living Painting ${boundaryAbi} requires exactly the finish fragment.`);
      }
      if (!hasExactKeys(boundaryData.values, boundaryValueKeys)) {
        throw Error(`Living Painting ${boundaryAbi} requires exactly the grain, handDrawn, inkWarmth, and outline values.`);
      }
      const phrasingData = phrasingField.data;
      if (phrasingData.version !== 1 || phrasingData.abi !== phrasingAbi) {
        throw Error(`Living Painting requires shader field ${phrasingAbi}.`);
      }
      if (!hasExactKeys(phrasingData.fragments, phrasingFragmentKeys)) {
        throw Error(`Living Painting ${phrasingAbi} requires exactly the lpPhrase and noiseBasis fragments.`);
      }
      if (!hasExactKeys(phrasingData.values, phrasingValueKeys)) {
        throw Error(`Living Painting ${phrasingAbi} requires exactly its artistic time and five control values.`);
      }

      const source = paintingBeforeRegions
        + regionData.fragments.regionGeometry
        + watercolorData.fragments.wash
        + paintingAfterWatercolor
        + boundaryData.fragments.finish
        + hatchingData.fragments.lpRegionMarks
        + paintingAfterHatching
        + phrasingData.fragments.lpPhrase
        + regionData.fragments.lpRegion
        + phrasingData.fragments.noiseBasis;
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

      scale.value = regionData.values.scale!;
      warp.value = regionData.values.warp!;
      growth.value = regionData.values.growth!;
      seed.value = regionData.values.seed!;
      motion.value = regionData.values.motion!;
      coverage.value = hatchingData.values.coverage!;
      spacing.value = hatchingData.values.spacing!;
      curvature.value = hatchingData.values.curvature!;
      angle.value = hatchingData.values.angle!;
      hatchWidth.value = hatchingData.values.hatchWidth!;
      relation.value = hatchingData.values.relation!;
      spacingVar.value = hatchingData.values.spacingVar!;
      curvatureVar.value = hatchingData.values.curvatureVar!;
      angleVar.value = hatchingData.values.angleVar!;
      widthVar.value = hatchingData.values.widthVar!;
      palette.value = watercolorData.values.palette!;
      warmth.value = watercolorData.values.warmth!;
      contrast.value = watercolorData.values.contrast!;
      pooling.value = watercolorData.values.pooling!;
      blooms.value = watercolorData.values.blooms!;
      outline.value = boundaryData.values.outline!;
      inkWarmth.value = boundaryData.values.inkWarmth!;
      handDrawn.value = boundaryData.values.handDrawn!;
      grain.value = boundaryData.values.grain!;
      time.value = phrasingData.values.time!;
      composition.value = phrasingData.values.composition!;
      tension.value = phrasingData.values.tension!;
      phrasing.value = phrasingData.values.phrasing!;
      hierarchy.value = phrasingData.values.hierarchy!;
      return scene!;
    }
    return {
      update() {},
      async evaluate(inputs, evaluation) {
        const scene = preparePainting(
          inputs.regions as ShaderFieldResource,
          inputs.hatching as ShaderFieldResource,
          inputs.watercolor as ShaderFieldResource,
          inputs.boundary as ShaderFieldResource,
          inputs.phrasing as ShaderFieldResource,
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
      reset() {},
      dispose() {
        geometry.dispose();
        material?.dispose();
        pathTexture.dispose();
      },
    };
  },
});
