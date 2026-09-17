import { defineComponent } from '@lux/visual-sdk';
import { Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, Scene, Vector4 } from 'three/webgpu';
import { uniform, uv, wgslFn } from 'three/tsl';
import { BAND_ABI, BAND_VALUE_KEYS, readField } from './field-contract.ts';

// Entry must precede provider helper functions for Three's WGSL parser.
const paintPass = `fn pigmentRivers(st: vec2f, view: vec4f, shape: vec4f,
  pigment: vec4f, wash: vec4f, ink: vec4f, contours: vec4f, style: vec4f) -> vec4f {
  let p = (st - 0.5) * vec2f(view.y, 1.0) * 5.0;
  let region = prRegion(p, view.x, shape);
  let family = i32(region.identity - 101.0) % 8;
  var paint = vec3f(0.43, 0.70, 0.025);
  switch family {
    case 1: { paint = vec3f(0.91, 0.30, 0.58); }
    case 2: { paint = vec3f(0.06, 0.33, 0.21); }
    case 3: { paint = vec3f(0.025, 0.53, 0.80); }
    case 4: { paint = vec3f(0.89, 0.94, 0.35); }
    case 5: { paint = vec3f(0.97, 0.21, 0.10); }
    case 6: { paint = vec3f(0.66, 0.78, 0.42); }
    case 7: { paint = vec3f(0.66, 0.23, 0.44); }
    default: {}
  }
  let existingWash = loWash(region, p, view.x, pigment, wash);
  // Keep the reference's acid palette while borrowing real wash behavior.
  var color = mix(existingWash, paint * (0.75 + 0.30 * existingWash), style.x);
  let pool = exp(-region.edge * 28.0) * pigment.w * 0.15;
  color *= 1.0 - pool;
  let chalk = loFbm(region.local * 4.0 + region.identity) - 0.5;
  color += chalk * style.z * 0.12;
  let quiet = select(0.0, 1.0, family == 3 || family == 4 || family == 6);
  let marks = loContours(region, p, view.x, contours) * style.y * quiet;
  color = mix(color, vec3f(0.025, 0.30, 0.36), marks * 0.72);
  color = loFinish(color, region, p, ink);
  // Existing paint helpers produce display-like pigment colors; convert once.
  return vec4f(pow(clamp(color, vec3f(0.0), vec3f(1.0)), vec3f(2.2)), 1.0);
}
`;

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'pigment-rivers/renderer',
    label: 'Pigment River Paint',
    description: 'Acid-green and pink flowing paint with reusable watercolor, ink and contour fields.',
    tags: ['painting', 'renderer', 'pigment'],
    inputs: {
      bands: { type: { kind: 'shader-field', version: 1, abi: 'examples/folded-pigment-bands/v1' }, label: 'Bands', description: 'Folded LoRegion geometry helpers.' },
      phrasing: { type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-phrasing/v1' }, label: 'Phrasing', description: 'Existing artistic clock and noise helpers.' },
      watercolor: { type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-watercolor/v1' }, label: 'Watercolor', description: 'Existing wash and pigment pooling.' },
      boundary: { type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-boundary-ink/v1' }, label: 'Ink', description: 'Existing hand-drawn dark seams.' },
      contours: { type: { kind: 'shader-field', version: 1, abi: 'lux/ornament-contours/v1' }, label: 'Contours', description: 'Existing nested contour line pattern.' },
    },
    outputs: {
      image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'Opaque pigment painting.' },
    },
    controls: {
      acidPalette: { type: 'number', group: 'Pigment', label: 'Acid palette', default: 0.9, min: 0, max: 1, step: 0.01 },
      contourStrength: { type: 'number', group: 'Pigment', label: 'Contour ink', default: 0.55, min: 0, max: 1, step: 0.01 },
      scumble: { type: 'number', group: 'Pigment', label: 'Uneven pigment', default: 0.7, min: 0, max: 2, step: 0.01 },
    },
    controlDescriptions: {
      acidPalette: 'Blends the existing wash palette toward green, hot pink, cyan and lemon.',
      contourStrength: 'Adds nested contour scribbles only in selected quieter color families.',
      scumble: 'Irregular light and dark pigment attached to each flowing band.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    const view = uniform(new Vector4(0, aspect, 0, 0));
    const shape = uniform(new Vector4(1, 1.15, 0.3, 7));
    const pigment = uniform(new Vector4(0.07, 1.3, 1.05, 0.74));
    const wash = uniform(new Vector4(0.94, 1, 0.44, 1));
    const ink = uniform(new Vector4(0.008, 0.55, 1.34, 1.48));
    const contours = uniform(new Vector4(1, 1, 1, 1));
    const style = uniform(new Vector4(0.9, 0.55, 0.7, 0));
    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const scene = new Scene();
    let material: MeshBasicNodeMaterial | undefined;
    let capturedHelpers: string | undefined;
    return {
      update(frame) {
        style.value.set(frame.controls.acidPalette, frame.controls.contourStrength, frame.controls.scumble, 0);
      },
      async evaluate(inputs, evaluation) {
        const bands = readField(inputs.bands.data, BAND_ABI, BAND_VALUE_KEYS);
        const clock = readField(inputs.phrasing.data, 'lux/ornament-phrasing/v1', ['time', 'pace', 'phrasing', 'composition', 'tension', 'hierarchy']);
        const water = readField(inputs.watercolor.data, 'lux/ornament-watercolor/v1', ['palette', 'warmth', 'contrast', 'pooling', 'blooms', 'saturation']);
        const boundary = readField(inputs.boundary.data, 'lux/ornament-boundary-ink/v1', ['width', 'accent', 'handDrawn', 'grain']);
        const contour = readField(inputs.contours.data, 'lux/ornament-contours/v1', ['density', 'width', 'variation', 'motion']);
        const helpers = [bands, clock, water, boundary, contour].map(field => field.fragments.helpers!).join('\n');
        if (capturedHelpers !== undefined && capturedHelpers !== helpers) {
          throw Error('Pigment Rivers field source changed; rebuild to apply it');
        }
        if (!material) {
          material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
          material.fragmentNode = wgslFn(paintPass + '\n' + helpers)(uv(), view, shape, pigment, wash, ink, contours, style);
          const mesh = new Mesh(geometry, material);
          mesh.frustumCulled = false;
          scene.add(mesh);
          capturedHelpers = helpers;
        }
        view.value.x = clock.values.time!;
        shape.value.set(bands.values.scale!, bands.values.fold!, bands.values.flow!, bands.values.seed!);
        pigment.value.set(water.values.palette!, water.values.warmth!, water.values.contrast!, water.values.pooling!);
        wash.value.set(water.values.blooms!, water.values.saturation!, clock.values.composition!, clock.values.phrasing!);
        ink.value.set(boundary.values.width!, boundary.values.accent!, boundary.values.handDrawn!, boundary.values.grain!);
        contours.value.set(contour.values.density!, contour.values.width!, contour.values.variation!, contour.values.motion!);
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {},
      dispose() {
        geometry.dispose();
        material?.dispose();
      },
    };
  },
});
