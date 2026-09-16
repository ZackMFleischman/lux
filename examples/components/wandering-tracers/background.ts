import { defineComponent } from '@lux/visual-sdk';
import {
  Mesh,
  MeshBasicNodeMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
} from 'three/webgpu';
import { uniform, uv, wgslFn } from 'three/tsl';

const paperWash = wgslFn(`
fn wanderingTracerPaper(st: vec2f, time: f32, motion: f32) -> vec4f {
  let centered = st - 0.5;
  let broad = 0.5 + 0.5 * sin(centered.x * 5.1 - centered.y * 3.4 + time * 0.13 * motion);
  let cross = 0.5 + 0.5 * cos(centered.y * 7.3 + centered.x * 2.2 - time * 0.09 * motion);
  let pool = smoothstep(0.18, 0.92, broad * 0.58 + cross * 0.42);
  let cool = vec3f(0.12, 0.20, 0.29);
  let pale = vec3f(0.60, 0.66, 0.61);
  let warm = vec3f(0.69, 0.57, 0.39);
  var color = mix(cool, pale, pool);
  color = mix(color, warm, 0.18 * smoothstep(0.66, 0.95, cross));
  let vignette = 1.0 - 0.12 * smoothstep(0.28, 0.72, length(centered));
  return vec4f(color * vignette, 1.0);
}
`);

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'examples/wandering-tracer-background',
    label: 'Slow Paper Wash',
    description: 'An independent moving paper wash used to demonstrate tracer overlay reuse.',
    tags: ['background', 'demo'],
    inputs: {},
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Slow paper wash image.',
      },
    },
    controls: {
      motion: { type: 'number', group: 'Background', label: 'Motion', default: 0.55, min: 0, max: 2, step: 0.01 },
    },
    controlDescriptions: {
      motion: 'Sets the speed of the independent background wash.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create() {
    const time = uniform(0);
    const motion = uniform(0.55);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    material.fragmentNode = paperWash(uv(), time, motion);
    const geometry = new PlaneGeometry(2, 2);
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    const scene = new Scene();
    scene.add(mesh);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return {
      update(frame) {
        time.value = frame.timeSeconds;
        motion.value = frame.controls.motion;
      },
      async evaluate(_inputs, evaluation) {
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {
        time.value = 0;
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  },
});
