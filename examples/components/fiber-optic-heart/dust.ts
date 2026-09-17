import { defineComponent } from '@lux/visual-sdk';
import {
  AdditiveBlending, DataTexture, Mesh, MeshBasicNodeMaterial, OrthographicCamera,
  PlaneGeometry, Scene, type Texture,
} from 'three/webgpu';
import { texture, uniform, uv, vec4, wgslFn } from 'three/tsl';

const dustShader = wgslFn(`
fn fiberDust(st: vec2f, strength: f32) -> vec4f {
  let p = st * 2.0 - 1.0;
  let glow = exp(-dot(p, p) * 6.0);
  let edge = 1.0 - smoothstep(0.7, 1.0, length(p));
  return vec4f(vec3f(1.0, 0.63, 0.22) * strength, glow * edge);
}
`);

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'fiber-heart/dust-field',
    label: 'Luminous Dust',
    description: 'Sparse seeded golden dust with scene-clock drift and soft additive sprites.',
    tags: ['particles', 'dust', 'overlay'],
    inputs: {
      image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Background', description: 'Image under the dust.' },
    },
    outputs: {
      image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'Background with luminous dust.' },
    },
    controls: {
      count: { type: 'number', group: 'Dust', label: 'Particles', default: 44, min: 0, max: 96, step: 1 },
      size: { type: 'number', group: 'Dust', label: 'Size', default: 0.009, min: 0.002, max: 0.03, step: 0.001 },
      drift: { type: 'number', group: 'Dust', label: 'Drift', default: 0.35, min: 0, max: 2, step: 0.01 },
      brightness: { type: 'number', group: 'Dust', label: 'Brightness', default: 0.55, min: 0, max: 3, step: 0.01 },
    },
    controlDescriptions: {
      count: 'Visible particles out of a fixed pool of 96; identities do not shuffle.',
      size: 'Base sprite diameter in canvas-height units. Supports stable per-instance variation.',
      drift: 'Slow upward flow and lateral sway; zero freezes dust motion and twinkle.',
      brightness: 'Additive golden light strength; zero removes dust light.',
    },
    lifecycle: { state: 'stateless', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    const camera = new OrthographicCamera(-aspect / 2, aspect / 2, 0.5, -0.5, 0.1, 10);
    camera.position.z = 2;
    const scene = new Scene();
    const fallback = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    fallback.needsUpdate = true;
    const base = texture(fallback, uv().flipY());
    const backgroundMaterial = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    backgroundMaterial.fragmentNode = base;
    const backgroundGeometry = new PlaneGeometry(aspect, 1);
    const background = new Mesh(backgroundGeometry, backgroundMaterial);
    background.renderOrder = -1;
    scene.add(background);

    const brightness = uniform(0.55);
    const material = new MeshBasicNodeMaterial({
      transparent: true, blending: AdditiveBlending, depthTest: false, depthWrite: false,
    });
    // wgslFn's declarations do not infer the WGSL vec4f return type.
    const color = dustShader(uv(), brightness) as ReturnType<typeof vec4>;
    material.colorNode = color.rgb;
    material.opacityNode = color.a;
    const geometry = new PlaneGeometry(1, 1);
    const particles = Array.from({ length: 96 }, (_, index) => {
      const mesh = new Mesh(geometry, material);
      mesh.renderOrder = 1;
      mesh.frustumCulled = false;
      scene.add(mesh);
      return { mesh, index };
    });
    let seed = context.settings.seed;
    function random(index: number): number {
      const value = Math.sin(index * 127.1 + seed * 0.73) * 43758.5453;
      return value - Math.floor(value);
    }
    return {
      update(frame) {
        const time = frame.timeSeconds * frame.controls.drift;
        brightness.value = frame.controls.brightness;
        for (const particle of particles) {
          const { mesh, index } = particle;
          mesh.visible = index < Math.round(frame.controls.count);
          if (!mesh.visible) continue;
          const phase = random(index * 3) * Math.PI * 2;
          const y = ((random(index * 3 + 1) + time * 0.012) % 1) - 0.5;
          const x = (random(index * 3 + 2) - 0.5) * aspect + Math.sin(time * 0.2 + phase) * 0.03;
          const edgeFade = Math.max(0, Math.min(1, (0.5 - Math.abs(y)) * 15));
          const size = frame.sampleControl?.('size', index) ?? frame.controls.size;
          mesh.position.set(x, y, 0);
          mesh.scale.setScalar(size * (0.55 + 0.45 * Math.sin(time * 0.7 + phase) ** 2) * edgeFade);
        }
      },
      async evaluate(inputs, evaluation) {
        base.value = inputs.image.texture as Texture;
        return { image: await evaluation.render(scene, camera) };
      },
      reset(nextSeed) { seed = nextSeed; },
      dispose() {
        geometry.dispose();
        material.dispose();
        backgroundGeometry.dispose();
        backgroundMaterial.dispose();
        fallback.dispose();
      },
    };
  },
});
