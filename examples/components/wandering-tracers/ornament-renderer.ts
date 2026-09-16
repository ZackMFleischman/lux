import { defineComponent, type ShaderFieldResource } from '@lux/visual-sdk';
import {
  Scene,
  Mesh,
  PlaneGeometry,
  MeshBasicNodeMaterial,
  OrthographicCamera,
  Vector4,
} from 'three/webgpu';
import { uniform, uv, wgslFn } from 'three/tsl';
import { ornamentPackedPatterns } from './ornament-packed-patterns.ts';
import { ornamentLinePatternHelpers } from './ornament-line-patterns.ts';
import { ornamentRibbonPatternHelpers } from './ornament-ribbon-patterns.ts';

// wgslFn selects the first function as its entry. Keep the paint pass before
// the supplied helpers, including the LoRegion declaration and noise basis.
const paintPass = `
fn livingOrnament(st: vec2f, view: vec4f, shape: vec4f, detail: vec4f,
  pigment: vec4f, material: vec4f, ink: vec4f, pattern: vec4f, patternStyle: vec4f) -> vec4f {
  let p = (st - 0.5) * vec2f(view.y, 1.0) * 2.0;
  let region = loRegion(p, view.x, view.z, shape, detail);
  let wash = loWash(region, p, view.x, pigment, material);
  let id = i32(region.identity + 0.5);
  var marks = 0.0;
  switch id {
    case 101, 105, 109, 113: { marks = loSpirals(region, p, view.x, pattern); }
    case 103, 112, 114: { marks = loRings(region, p, view.x, pattern); }
    case 102, 104, 108: { marks = loMembranes(region, p, view.x, pattern); }
    case 107, 115: { marks = loContours(region, p, view.x, pattern); }
    case 110, 111: { marks = loRibbonMarks(region, p, view.x, pattern); }
    default: { marks = loHatchMarks(region, p, view.x, pattern); }
  }
  var rest = select(1.0, 1.0 - patternStyle.y, id == 107 || id == 115);
  if (id == 101) {
    let clusteredGround = 1.0 - smoothstep(-0.45, 0.2, p.x + p.y * 0.35);
    rest = mix(1.0, clusteredGround, min(patternStyle.y * 1.2, 1.0));
  }
  let inset = smoothstep(ink.x * 1.7, ink.x * 3.2, region.edge);
  let light = dot(wash, vec3f(0.2126, 0.7152, 0.0722));
  let motifInk = select(vec3f(0.006, 0.004, 0.009), vec3f(0.86, 0.75, 0.60), light < 0.16);
  let patterned = mix(wash, motifInk, clamp(marks * patternStyle.x * rest * inset, 0.0, 1.0));
  let color = loFinish(patterned, region, p, ink);
  return vec4f(color, 1.0);
}
`;

const regionValues = ['complexity', 'concavity', 'corridorWidth', 'growth', 'motion', 'nesting', 'seed', 'size'] as const;
const watercolorValues = ['blooms', 'contrast', 'palette', 'pooling', 'saturation', 'warmth'] as const;
const boundaryValues = ['accent', 'grain', 'handDrawn', 'width'] as const;
const phrasingValues = ['composition', 'hierarchy', 'pace', 'phrasing', 'tension', 'time'] as const;

function exactKeys(record: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean {
  const keys = Object.keys(record).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function fieldData(resource: ShaderFieldResource, abi: string, expectedValues: readonly string[]) {
  const data = resource.data;
  if (data.version !== 1 || data.abi !== abi) {
    throw Error(`Living Ornament requires shader field ${abi}.`);
  }
  if (!exactKeys(data.fragments, ['helpers']) || !exactKeys(data.values, expectedValues)) {
    throw Error(`Living Ornament ${abi} requires exactly its helpers fragment and declared value keys.`);
  }
  return data;
}

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'lux/ornament-region-styles',
    label: 'Ornament Region Styles',
    description: 'Paints fitted organic silhouettes with animated watercolor, bold boundaries, and a shared artistic clock.',
    tags: ['ornament', 'regions', 'watercolor'],
    inputs: {
      regions: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-regions/v1' },
        label: 'Regions', description: 'Fitted organic region geometry, local coordinates, and visible boundary distance.',
      },
      watercolor: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-watercolor/v1' },
        label: 'Watercolor', description: 'Shape-aware pigment, quiet washes, and selective dark masses.',
      },
      boundary: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-boundary-ink/v1' },
        label: 'Boundary ink', description: 'Coherent organic ink around visible owning boundaries.',
      },
      phrasing: {
        type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-phrasing/v1' },
        label: 'Phrasing', description: 'Shared artistic time, deterministic noise, quiet balance, and size hierarchy.',
      },
    },
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image', description: 'Opaque living ornament painting.',
      },
    },
    controls: {
      patternDensity: { type: 'number', group: 'Patterns', label: 'Density', default: 1, min: 0.3, max: 2, step: 0.01 },
      patternWidth: { type: 'number', group: 'Patterns', label: 'Line width', default: 1, min: 0.3, max: 2, step: 0.01 },
      patternVariation: { type: 'number', group: 'Patterns', label: 'Variation', default: 0.7, min: 0, max: 1, step: 0.01 },
      patternStrength: { type: 'number', group: 'Patterns', label: 'Ink strength', default: 1, min: 0, max: 1, step: 0.01 },
      patternRest: { type: 'number', group: 'Patterns', label: 'Quiet areas', default: 0.9, min: 0, max: 1, step: 0.01 },
      patternMotion: { type: 'number', group: 'Pattern Motion', label: 'Flow', default: 0.2, min: 0, max: 1, step: 0.01 },
    },
    controlDescriptions: {
      patternDensity: 'Sets the scale and spacing of region motifs.',
      patternWidth: 'Sets motif stroke thickness.',
      patternVariation: 'Varies motif size and curvature within each family.',
      patternStrength: 'Blends motif ink into the watercolor.',
      patternRest: 'Keeps selected regions quiet between dense patterns.',
      patternMotion: 'Adds slow movement within attached patterns.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    const view = uniform(new Vector4(0, aspect, 7, 0));
    const shape = uniform(new Vector4(1, 0.7, 0.85, 0.11));
    const detail = uniform(new Vector4(0.65, 0.15, 0.25, 0.99));
    const pigment = uniform(new Vector4(0.07, 1.3, 1.05, 0.74));
    const materialSettings = uniform(new Vector4(0.94, 1, 0.44, 0));
    const ink = uniform(new Vector4(0.008, 0.55, 1.34, 1.48));
    const pattern = uniform(new Vector4(1, 1, 0.7, 0.2));
    const patternStyle = uniform(new Vector4(1, 0.9, 0, 0));
    const geometry = new PlaneGeometry(2, 2);
    // Match the existing painting plane and uv orientation. This component
    // creates an image directly; it does not resample a render-target texture.
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    let material: MeshBasicNodeMaterial | undefined;
    let scene: Scene | undefined;
    let capturedHelpers: readonly string[] | undefined;

    return {
      update(frame) {
        pattern.value.set(frame.controls.patternDensity, frame.controls.patternWidth, frame.controls.patternVariation, frame.controls.patternMotion);
        patternStyle.value.set(frame.controls.patternStrength, frame.controls.patternRest, 0, 0);
      },
      async evaluate(inputs, evaluation) {
        const regions = fieldData(inputs.regions, 'lux/ornament-regions/v1', regionValues);
        const watercolor = fieldData(inputs.watercolor, 'lux/ornament-watercolor/v1', watercolorValues);
        const boundary = fieldData(inputs.boundary, 'lux/ornament-boundary-ink/v1', boundaryValues);
        const phrasing = fieldData(inputs.phrasing, 'lux/ornament-phrasing/v1', phrasingValues);
        const helpers = [phrasing.fragments.helpers!, regions.fragments.helpers!, watercolor.fragments.helpers!, boundary.fragments.helpers!];
        if (capturedHelpers && helpers.some((source, index) => source !== capturedHelpers![index])) {
          throw Error('Living Ornament shader field source changed; rebuild the component to apply it.');
        }
        if (!capturedHelpers) {
          capturedHelpers = Object.freeze(helpers);
          material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
          material.fragmentNode = wgslFn(paintPass + '\n' + helpers.join('\n') + '\n' + ornamentPackedPatterns + '\n' + ornamentLinePatternHelpers + '\n' + ornamentRibbonPatternHelpers)(
            uv(), view, shape, detail, pigment, materialSettings, ink, pattern, patternStyle,
          );
          scene = new Scene();
          const mesh = new Mesh(geometry, material);
          mesh.frustumCulled = false;
          scene.add(mesh);
        }

        // The four producers remain the sole owners of their live controls.
        // Reuse the uniform nodes and material as their scalar snapshots change.
        view.value.set(phrasing.values.time!, aspect, regions.values.seed!, 0);
        shape.value.set(regions.values.size!, regions.values.complexity!, regions.values.concavity!, regions.values.corridorWidth!);
        detail.value.set(regions.values.nesting!, regions.values.motion!, regions.values.growth!, phrasing.values.hierarchy!);
        pigment.value.set(watercolor.values.palette!, watercolor.values.warmth!, watercolor.values.contrast!, watercolor.values.pooling!);
        materialSettings.value.set(watercolor.values.blooms!, watercolor.values.saturation!, phrasing.values.composition!, 0);
        ink.value.set(boundary.values.width!, boundary.values.accent!, boundary.values.handDrawn!, boundary.values.grain!);
        return { image: await evaluation.render(scene!, camera) };
      },
      reset() {},
      dispose() {
        geometry.dispose();
        material?.dispose();
      },
    };
  },
});
