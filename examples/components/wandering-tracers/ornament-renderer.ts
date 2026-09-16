import { createOrnamentBirds } from './ornament-birds.ts';
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

// wgslFn selects the first function as its entry. Keep the paint pass before
// the supplied helpers, including the LoRegion declaration and noise basis.
const paintPass = `
fn livingOrnament(st: vec2f, view: vec4f, shape: vec4f, detail: vec4f, pigment: vec4f, material: vec4f, ink: vec4f, pattern: vec4f, patternStyle: vec4f, spirals: vec4f, rings: vec4f, membranes: vec4f, contours: vec4f, hatching: vec4f, ribbons: vec4f, structuralActivity: f32) -> vec4f {
  let p = (st - 0.5) * vec2f(view.y, 1.0) * 2.0;
  let region = loRegionEvolving(p, view.x, view.z, shape, detail, structuralActivity);
  var color = loOrnamentStyle(region, p, view, shape, detail, pigment, material, ink, pattern, patternStyle, spirals, rings, membranes, contours, hatching, ribbons);
  if (region.identity >= 117.0 && region.parent > 0.0) {
    var inherited = region;
    inherited.identity = region.parent;
    inherited.parent = 0.0;
    inherited.age = 1.0;
    let parentColor = loOrnamentStyle(inherited, p, view, shape, detail, pigment, material, ink, pattern, patternStyle, spirals, rings, membranes, contours, hatching, ribbons);
    color = mix(parentColor, color, smoothstep(0.06, 0.92, region.age));
  }
  return vec4f(color, 1.0);
}

fn loOrnamentStyle(region: LoRegion, p: vec2f, view: vec4f, shape: vec4f, detail: vec4f, pigment: vec4f, material: vec4f, ink: vec4f, pattern: vec4f, patternStyle: vec4f, spirals: vec4f, rings: vec4f, membranes: vec4f, contours: vec4f, hatching: vec4f, ribbons: vec4f) -> vec3f {
  var wash = loWash(region, p, view.x, pigment, material);
  let id = i32(region.identity + 0.5);
  if (id == 110) { wash = mix(wash, vec3f(0.56, 0.78, 0.84), 0.78); }
  // Each owner keeps its identity while shapes, marks and pigment phrase at
  // different delays. Density stays fixed so integer motif counts never pop.
  let phraseOwner = select(region.identity, region.parent, region.parent > 0.0);
  let phrasePosition = vec2f(phraseOwner * 0.17, 0.0);
  let pressure = loPhrase(phrasePosition, view.x - 3.0);
  let release = loPhrase(phrasePosition, view.x - 8.0);
  let expression = material.w * view.w;
  let anchor = select(1.0, 0.28, id == 102 || id == 104 || id == 108);
  var motifRegion = region;
  motifRegion.local += region.tangent * sin(view.x * 0.085 + region.identity * 1.71)
    * patternStyle.z * 0.20 * anchor;
  let expressive = pattern * vec4f(1.0, 1.0 + (pressure - 0.5) * expression * 0.20,
    1.0, 0.35 + pressure * material.w * 1.25);
  var marks = 0.0;
  switch id {
    case 101, 105, 109, 113, 117: { marks = loSpirals(motifRegion, p, view.x, expressive * spirals); }
    case 103, 112, 114, 118: { marks = loRings(motifRegion, p, view.x, expressive * rings); }
    case 102, 104, 107, 108: { marks = loMembranes(motifRegion, p, view.x, expressive * membranes); }
    case 115, 119: { marks = loContours(motifRegion, p, view.x, expressive * contours); }
    case 110, 111: { marks = loRibbonMarks(motifRegion, p, view.x, expressive * ribbons); }
    default: { marks = loHatchMarks(motifRegion, p, view.x, expressive * hatching); }
  }
  let ribbon = id == 110 || id == 111;
  let reach = select(length(region.local), region.local.x + 1.8, ribbon);
  let front = select(0.18 + release * 0.72, 0.65 + release * 3.2, ribbon);
  let drawn = 1.0 - smoothstep(front, front + 0.20, reach);
  marks *= mix(1.0, 0.22 + drawn * 0.78, patternStyle.w * material.w * anchor);
  var rest = select(1.0, 1.0 - patternStyle.y, id == 115);
  if (id == 101) {
    let clusteredGround = 1.0 - smoothstep(-0.45, 0.2, p.x + p.y * 0.35);
    rest = mix(1.0, clusteredGround, min(patternStyle.y * 1.2, 1.0));
  }
  rest *= select(1.0, mix(0.60, 1.0, clamp(material.z, 0.0, 1.0)), id == 102 || id == 115);
  let inset = smoothstep(ink.x * 1.7, ink.x * 3.2, region.edge);
  let light = dot(wash, vec3f(0.2126, 0.7152, 0.0722));
  var motifInk = select(vec3f(0.006, 0.004, 0.009), vec3f(0.86, 0.75, 0.60), light < 0.16);
  if (id == 110 || id == 111) { motifInk = vec3f(0.015, 0.19, 0.25); }
  let patterned = mix(wash, motifInk, clamp(marks * patternStyle.x * rest * inset, 0.0, 1.0));
  let color = loFinish(patterned, region, p, ink);
  return color;
}
`;

const patternValues = ['density', 'motion', 'variation', 'width'] as const;
const patternPorts = ['spirals', 'rings', 'membranes', 'contours', 'hatching', 'ribbons'] as const;

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
      spirals: { type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-spirals/v1' }, label: 'Spirals', description: 'Independent spirals motif field and local controls.' },
      rings: { type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-rings/v1' }, label: 'Rings', description: 'Independent rings motif field and local controls.' },
      membranes: { type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-membranes/v1' }, label: 'Membranes', description: 'Independent membranes motif field and local controls.' },
      contours: { type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-contours/v1' }, label: 'Contours', description: 'Independent contours motif field and local controls.' },
      hatching: { type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-hatching/v1' }, label: 'Hatching', description: 'Independent hatching motif field and local controls.' },
      ribbons: { type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-ribbons/v1' }, label: 'Ribbons', description: 'Independent ribbons motif field and local controls.' },
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
      birdSize: { type: 'number', group: 'Birds', label: 'Subject size', default: 1, min: 0, max: 2, step: 0.01 },
      birdSpeed: { type: 'number', group: 'Birds', label: 'Flight speed', default: 1, min: 0, max: 2, step: 0.01 },
      birdOrbit: { type: 'number', group: 'Birds', label: 'Spiral radius', default: 1, min: 0, max: 2, step: 0.01 },
      birdVisits: { type: 'number', group: 'Birds', label: 'Perching excursions', default: 1, min: 0, max: 1, step: 0.01 },
      structuralActivity: { type: 'number', group: 'Structural Changes', label: 'Split and island activity', default: 1, min: 0, max: 1, step: 0.01 },
      patternDensity: { type: 'number', group: 'Patterns', label: 'Density', default: 1, min: 0.3, max: 2, step: 0.01 },
      patternWidth: { type: 'number', group: 'Patterns', label: 'Line width', default: 1, min: 0.3, max: 2, step: 0.01 },
      patternVariation: { type: 'number', group: 'Patterns', label: 'Variation', default: 0.7, min: 0, max: 1, step: 0.01 },
      patternStrength: { type: 'number', group: 'Patterns', label: 'Ink strength', default: 1, min: 0, max: 1, step: 0.01 },
      patternRest: { type: 'number', group: 'Patterns', label: 'Quiet areas', default: 0.9, min: 0, max: 1, step: 0.01 },
      patternMotion: { type: 'number', group: 'Pattern Motion', label: 'Flow', default: 0.2, min: 0, max: 1, step: 0.01 },
      patternTravel: { type: 'number', group: 'Pattern Motion', label: 'Attached to flowing', default: 0.24, min: 0, max: 1, step: 0.01 },
      patternGrowth: { type: 'number', group: 'Pattern Motion', label: 'Drawing and release', default: 0.48, min: 0, max: 1, step: 0.01 },
    },
    controlDescriptions: {
      birdSize: 'Size of the five companion birds; zero hides them.',
      birdSpeed: 'Flight, wingbeat and visit tempo relative to the painting clock.',
      birdOrbit: 'Depth and width of the spiral around each ribbon.',
      birdVisits: 'Blend from uninterrupted ribbon flight to occasional landing and departure.',
      structuralActivity: 'Zero preserves the previous scene. Higher values grow curved splits, close narrow connections, and birth islands with gradual inherited styles.',
      patternDensity: 'Sets the scale and spacing of region motifs.',
      patternWidth: 'Sets motif stroke thickness.',
      patternVariation: 'Varies motif size and curvature within each family.',
      patternStrength: 'Blends motif ink into the watercolor.',
      patternRest: 'Keeps selected regions quiet between dense patterns.',
      patternMotion: 'Adds slow movement within attached patterns.',
      patternTravel: 'Zero keeps motifs attached; higher values add deliberate slow flow inside their region.',
      patternGrowth: 'Reveals and releases marks through staggered local phrases, with longitudinal growth along ribbons.',
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
    const structuralActivity = uniform(1);
    const pattern = uniform(new Vector4(1, 1, 0.7, 0.2));
    const patternStyle = uniform(new Vector4(1, 0.9, 0, 0));
    const motifSettings = patternPorts.map(() => uniform(new Vector4(1, 1, 1, 1)));
    const geometry = new PlaneGeometry(2, 2);
    // Match the existing painting plane and uv orientation. This component
    // creates an image directly; it does not resample a render-target texture.
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    let birds: ReturnType<typeof createOrnamentBirds> | undefined;
    let birdControls = [1, 1, 1, 1];
    let material: MeshBasicNodeMaterial | undefined;
    let scene: Scene | undefined;
    let capturedHelpers: readonly string[] | undefined;

    return {
      update(frame) {
        birdControls = [frame.controls.birdSize, frame.controls.birdSpeed, frame.controls.birdOrbit, frame.controls.birdVisits];
        birds?.update(birdControls[0]!, birdControls[1]!, birdControls[2]!, birdControls[3]!);
        structuralActivity.value = frame.controls.structuralActivity;
        pattern.value.set(frame.controls.patternDensity, frame.controls.patternWidth, frame.controls.patternVariation, frame.controls.patternMotion);
        patternStyle.value.set(frame.controls.patternStrength, frame.controls.patternRest, frame.controls.patternTravel, frame.controls.patternGrowth);
      },
      async evaluate(inputs, evaluation) {
        const regions = fieldData(inputs.regions, 'lux/ornament-regions/v1', regionValues);
        const watercolor = fieldData(inputs.watercolor, 'lux/ornament-watercolor/v1', watercolorValues);
        const boundary = fieldData(inputs.boundary, 'lux/ornament-boundary-ink/v1', boundaryValues);
        const phrasing = fieldData(inputs.phrasing, 'lux/ornament-phrasing/v1', phrasingValues);
        const motifFields = patternPorts.map(port => fieldData(inputs[port], 'lux/ornament-' + port + '/v1', patternValues));
        const helpers = [phrasing.fragments.helpers!, regions.fragments.helpers!, watercolor.fragments.helpers!, boundary.fragments.helpers!, ...motifFields.map(field => field.fragments.helpers!)];
        motifFields.forEach((field, index) => motifSettings[index]!.value.set(field.values.density!, field.values.width!, field.values.variation!, field.values.motion!));
        if (capturedHelpers && helpers.some((source, index) => source !== capturedHelpers![index])) {
          throw Error('Living Ornament shader field source changed; rebuild the component to apply it.');
        }
        if (!capturedHelpers) {
          capturedHelpers = Object.freeze(helpers);
          material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
          material.fragmentNode = wgslFn(paintPass + '\n' + helpers.join('\n'))(
            uv(), view, shape, detail, pigment, materialSettings, ink, pattern, patternStyle,
            motifSettings[0]!, motifSettings[1]!, motifSettings[2]!, motifSettings[3]!, motifSettings[4]!, motifSettings[5]!, structuralActivity,
          );
          scene = new Scene();
          const mesh = new Mesh(geometry, material);
          mesh.frustumCulled = false;
          scene.add(mesh);
          birds = createOrnamentBirds(view, shape, detail, helpers.slice(0, 2).join('\n'));
          scene.add(...birds.meshes);
          birds.update(birdControls[0]!, birdControls[1]!, birdControls[2]!, birdControls[3]!);
        }

        // The four producers remain the sole owners of their live controls.
        // Reuse the uniform nodes and material as their scalar snapshots change.
        view.value.set(phrasing.values.time!, aspect, regions.values.seed!, phrasing.values.tension!);
        birds?.advance(view.value.x);
        shape.value.set(regions.values.size!, regions.values.complexity!, regions.values.concavity!, regions.values.corridorWidth!);
        const pressureAmount = 0.35 + phrasing.values.tension! * 0.90;
        detail.value.set(regions.values.nesting!, regions.values.motion! * pressureAmount, regions.values.growth! * pressureAmount, phrasing.values.hierarchy!);
        pigment.value.set(watercolor.values.palette!, watercolor.values.warmth!, watercolor.values.contrast!, watercolor.values.pooling!);
        materialSettings.value.set(watercolor.values.blooms!, watercolor.values.saturation!, phrasing.values.composition!, phrasing.values.phrasing!);
        ink.value.set(boundary.values.width!, boundary.values.accent!, boundary.values.handDrawn!, boundary.values.grain!);
        return { image: await evaluation.render(scene!, camera) };
      },
      reset() { birds?.reset(); },
      dispose() {
        birds?.dispose();
        geometry.dispose();
        material?.dispose();
      },
    };
  },
});
