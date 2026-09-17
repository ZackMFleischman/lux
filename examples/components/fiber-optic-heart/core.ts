import { defineComponent } from '@lux/visual-sdk';
import { Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, Scene } from 'three/webgpu';
import { uniform, uv, vec4, wgslFn } from 'three/tsl';

const coreShader = wgslFn(`
fn fiberCore(st: vec2f, view: vec4f, settings: vec4f) -> vec4f {
  let p = (st - 0.5) * vec2f(view.x, 1.0);
  let breath = 1.0 + 0.1 * settings.y * sin(view.y * 0.65);
  let radius = max(view.z * breath, 0.005);
  let d = length(p / vec2f(0.9, 1.1));
  let core = exp(-pow(d / radius, 2.0) * 2.5);
  let aura = exp(-pow(d / (radius * 3.4), 2.0));
  let magentaMist = exp(-pow((p.y - 0.10) / 0.24, 2.0)) * exp(-p.x * p.x * 0.7);
  let flare = exp(-abs(p.y) * 160.0) * exp(-abs(p.x) * 2.8);
  let vignette = 1.0 - 0.65 * smoothstep(0.25, 0.9, length(st - 0.5));
  var color = vec3f(0.0015, 0.001, 0.012);
  color += vec3f(0.32, 0.002, 0.15) * magentaMist * settings.x;
  color += vec3f(0.65, 0.012, 0.19) * aura * view.w * 0.48;
  color += vec3f(1.0, 0.79, 0.35) * core * view.w;
  color += vec3f(0.5, 0.72, 0.65) * flare * settings.z;
  return vec4f(color * vignette, 1.0);
}
`);

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'fiber-heart/radial-core',
    label: 'Radiant Core',
    description: 'White-gold breathing core with magenta atmosphere and a horizontal optical flare.',
    tags: ['glow', 'core', 'background'],
    inputs: {},
    outputs: {
      image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'Opaque radiant core background.' },
    },
    controls: {
      radius: { type: 'number', group: 'Core', label: 'Radius', default: 0.14, min: 0.02, max: 0.35, step: 0.005 },
      brightness: { type: 'number', group: 'Core', label: 'Brightness', default: 2.3, min: 0, max: 5, step: 0.01 },
      haze: { type: 'number', group: 'Atmosphere', label: 'Magenta haze', default: 0.7, min: 0, max: 2, step: 0.01 },
      breath: { type: 'number', group: 'Core', label: 'Breathing', default: 0.55, min: 0, max: 1, step: 0.01 },
      flare: { type: 'number', group: 'Atmosphere', label: 'Horizontal flare', default: 0.45, min: 0, max: 2, step: 0.01 },
    },
    controlDescriptions: {
      radius: 'Radius of the central light in canvas-height units.',
      brightness: 'Linear light strength; values above one intentionally produce an exposed center.',
      haze: 'Amount of broad magenta atmosphere behind the strands.',
      breath: 'Depth of slow breathing driven by the Lux scene clock.',
      flare: 'Strength of the thin horizontal flare through the core.',
    },
    lifecycle: { state: 'stateless', reset: 'seed' },
  },
  async create(context) {
    const aspect = uniform(context.settings.width / context.settings.height);
    const time = uniform(0);
    const radius = uniform(0.14);
    const brightness = uniform(2.3);
    const haze = uniform(0.7);
    const breath = uniform(0.55);
    const flare = uniform(0.45);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    material.fragmentNode = coreShader(uv(), vec4(aspect, time, radius, brightness), vec4(haze, breath, flare, 0));
    const geometry = new PlaneGeometry(2, 2);
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    const scene = new Scene();
    scene.add(mesh);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return {
      update(frame) {
        time.value = frame.timeSeconds;
        radius.value = frame.controls.radius;
        brightness.value = frame.controls.brightness;
        haze.value = frame.controls.haze;
        breath.value = frame.controls.breath;
        flare.value = frame.controls.flare;
      },
      async evaluate(_inputs, evaluation) {
        return { image: await evaluation.render(scene, camera) };
      },
      reset() { time.value = 0; },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  },
});
