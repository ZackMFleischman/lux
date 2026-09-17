import { defineComponent } from '@lux/visual-sdk';
import { DataTexture, Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, Scene, Vector4, type Texture } from 'three/webgpu';
import { texture, uniform, uv, vec2, wgslFn } from 'three/tsl';

const surfaceShader = wgslFn(`
fn pigmentSurface(st: vec2f, base: vec4f, dragged: vec4f, settings: vec4f, paper: vec4f) -> vec4f {
  let p = st * vec2f(paper.x, 1.0);
  let tooth = psNoise(p * 650.0);
  let fiber = psNoise(p * vec2f(20.0, 320.0));
  let sweep = 0.5 + 0.5 * sin(p.y * 560.0 + psNoise(p * 18.0) * 14.0);
  let breaks = smoothstep(0.55, 0.9, fiber * 0.55 + sweep * 0.45);
  let pigment = base.rgb / max(base.a, 0.00001);
  let underpaint = dragged.rgb / max(dragged.a, 0.00001);
  var color = mix(pigment, underpaint, breaks * settings.y * 0.25);
  color *= 1.0 - settings.x * (tooth - 0.4) * 0.22;
  color = mix(color, vec3f(0.69, 0.64, 0.49), breaks * settings.z * 0.16);
  let borderDistance = min(min(st.x, 1.0 - st.x) * paper.x, min(st.y, 1.0 - st.y));
  let roughness = (psNoise(p * 37.0) - 0.5) * 0.007;
  let aa = max(fwidth(borderDistance), 0.0001);
  let margin = select(0.0, 1.0 - smoothstep(settings.w + roughness - aa, settings.w + roughness + aa, borderDistance), settings.w > 0.0001);
  let sheet = vec3f(0.56, 0.49, 0.36) + (tooth - 0.5) * 0.11;
  color = mix(color, sheet, margin);
  let cell = floor(p * 60.0);
  let local = fract(p * 60.0) - vec2f(psHash(cell), psHash(cell + 9.1));
  let fleck = 1.0 - smoothstep(0.055, 0.12, length(local));
  let choose = step(0.88, psHash(cell + 33.0));
  let marginOrEdge = max(margin, 0.15 * (1.0 - smoothstep(0.0, 0.12, borderDistance)));
  color = mix(color, vec3f(0.55, 0.013, 0.07), fleck * choose * paper.y * marginOrEdge);
  let alpha = mix(base.a, 1.0, margin);
  return vec4f(max(color, vec3f(0.0)) * alpha, alpha);
}

fn psHash(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

fn psNoise(p: vec2f) -> f32 {
  let cell = floor(p);
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  return mix(mix(psHash(cell), psHash(cell + vec2f(1.0, 0.0)), w.x),
    mix(psHash(cell + vec2f(0.0, 1.0)), psHash(cell + vec2f(1.0, 1.0)), w.x), w.y);
}
`);

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'pigment-rivers/dry-brush-paper',
    label: 'Dry Brush & Paper',
    description: 'Stationary paper tooth, directional paint breaks, dragged pigment and optional splattered margins over any image.',
    tags: ['painting', 'paper', 'texture', 'effect'],
    inputs: {
      image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Paint', description: 'Input painting to give a physical surface.' },
    },
    outputs: {
      image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'Textured painting; preserves input alpha outside optional opaque margins.' },
    },
    controls: {
      tooth: { type: 'number', group: 'Surface', label: 'Paper tooth', default: 0.7, min: 0, max: 2, step: 0.01 },
      drag: { type: 'number', group: 'Surface', label: 'Pigment drag', default: 0.6, min: 0, max: 1, step: 0.01 },
      dryBrush: { type: 'number', group: 'Surface', label: 'Dry brush', default: 0.8, min: 0, max: 2, step: 0.01 },
      margin: { type: 'number', group: 'Paper edge', label: 'Margin', default: 0.018, min: 0, max: 0.08, step: 0.001 },
      splatter: { type: 'number', group: 'Paper edge', label: 'Splatter', default: 0.6, min: 0, max: 1, step: 0.01 },
    },
    controlDescriptions: {
      tooth: 'Static fine grain. The paper never moves with the pigment.',
      drag: 'Small sideways pigment smear through intermittent bristle marks.',
      dryBrush: 'Warm paper showing through dry paint gaps.',
      margin: 'Rough paper border in canvas-height units. Zero removes it.',
      splatter: 'Seeded-looking static pink flecks concentrated near the paper edge.',
    },
    lifecycle: { state: 'stateless', reset: 'seed' },
  },
  async create(context) {
    const fallback = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    fallback.needsUpdate = true;
    const base = texture(fallback, uv().flipY());
    const dragged = texture(fallback, uv().flipY().add(vec2(0.002, 0)).clamp(0, 1));
    const settings = uniform(new Vector4(0.7, 0.6, 0.8, 0.018));
    const paper = uniform(new Vector4(context.settings.width / context.settings.height, 0.6, 0, 0));
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    material.fragmentNode = surfaceShader(uv(), base, dragged, settings, paper);
    const geometry = new PlaneGeometry(2, 2);
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    const scene = new Scene();
    scene.add(mesh);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return {
      update(frame) {
        settings.value.set(frame.controls.tooth, frame.controls.drag, frame.controls.dryBrush, frame.controls.margin);
        paper.value.y = frame.controls.splatter;
      },
      async evaluate(inputs, evaluation) {
        base.value = inputs.image.texture as Texture;
        dragged.value = inputs.image.texture as Texture;
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {},
      dispose() {
        geometry.dispose();
        material.dispose();
        fallback.dispose();
      },
    };
  },
});
