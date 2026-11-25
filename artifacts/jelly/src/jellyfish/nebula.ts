import { defineComponent } from '@lux/visual-sdk';
import {
  Scene,
  Mesh,
  PlaneGeometry,
  MeshBasicNodeMaterial,
  OrthographicCamera,
  Vector4,
  Texture,
} from 'three/webgpu';
import { jellyShared } from './jelly-shared.ts';
import { uniform, uv, wgslFn, texture, vec2 } from 'three/tsl';

// Adds a dim, slowly drifting fbm nebula, mostly in the corners and edges.
// Bass gently brightens it. The centered jellyfish stays readable.
const nebulaPass = `
fn jellyNebula(st: vec2f, base: vec4f, view: vec4f, shape: vec4f, tint: vec4f) -> vec4f {
  let t = view.x;
  let p = (st - vec2f(0.5, 0.42)) * vec2f(view.y, 1.0);
  let q = p * shape.y + vec2f(t * shape.x * 0.05, -t * shape.x * 0.03);
  let warp = vec2f(
    nebulaFbm(q + vec2f(1.7, 9.2) + t * shape.x * 0.02),
    nebulaFbm(q + vec2f(8.3, 2.8) - t * shape.x * 0.02)
  );
  let gas = nebulaFbm(q + warp * 1.5);
  let gas2 = nebulaFbm(q * 1.7 + warp * 2.0 + vec2f(5.2, 1.3));
  let th = tint.w;
  let cloud0 = smoothstep(0.35, 0.85, gas);
  let cloud1 = smoothstep(0.4, 0.62, gas) * (0.55 + 0.9 * smoothstep(0.3, 0.8, gas2));
  // Dust lanes: dark filaments carved out of the gas in space mode.
  let lanes = smoothstep(0.5, 0.72, nebulaFbm(q * 2.6 + warp * 3.0 + vec2f(2.4, 6.1)));
  let cloud = mix(cloud0, cloud1 * (1.0 - 0.85 * lanes), th);

  // Mask: dark at the jellyfish, strongest toward the corners.
  let r = length(p / vec2f(max(view.y, 1.0) * 0.5, 0.5));
  let edge0 = smoothstep(0.35, 1.1, r);
  let edge = mix(edge0, 0.3 + 0.7 * edge0, th);

  let magenta = vec3f(0.55, 0.06, 0.45);
  let teal = vec3f(0.04, 0.42, 0.5);
  var col = mix(magenta, teal, smoothstep(0.3, 0.7, gas2));
  col = mix(col, tint.rgb, 0.35);
  let vMag = vec3f(1.0, 0.12, 0.75);
  let vTeal = vec3f(0.1, 0.8, 1.0);
  let vGold = vec3f(1.0, 0.6, 0.15);
  var vcol = mix(vMag, vTeal, smoothstep(0.3, 0.7, gas2));
  vcol = mix(vcol, vGold, smoothstep(0.62, 0.9, gas) * 0.8);
  col = mix(col, mix(vcol, tint.rgb, 0.15), th);

  let level = 0.06 * shape.z * (1.0 + view.z * shape.w) * (1.0 + th * 4.0);
  let neb = col * cloud * edge * level;
  return vec4f(base.rgb + neb, 1.0);
}

fn nebulaHash(p: vec2f) -> f32 {
  let h = dot(p, vec2f(127.1, 311.7));
  return fract(sin(h) * 43758.5453);
}

fn nebulaNoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = nebulaHash(i);
  let b = nebulaHash(i + vec2f(1.0, 0.0));
  let c = nebulaHash(i + vec2f(0.0, 1.0));
  let d = nebulaHash(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn nebulaFbm(p0: vec2f) -> f32 {
  var p = p0;
  var amp = 0.5;
  var sum = 0.0;
  for (var i = 0; i < 5; i++) {
    sum += amp * nebulaNoise(p);
    p = p * 2.03 + vec2f(17.1, 4.3);
    amp *= 0.5;
  }
  return sum;
}
`;

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'jellyfish/nebula',
    label: 'Cosmic Nebula',
    description: 'Adds a dim drifting magenta and teal gas nebula near the screen edges; bass brightens it gently.',
    tags: ['jellyfish', 'cosmic'],
    inputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image to add the nebula behind.',
      },
    },
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image with a faint nebula added.',
      },
    },
    controls: {
      brightness: { type: 'number', group: 'Nebula', label: 'Brightness', default: 1, min: 0, max: 2, step: 0.01 },
      drift: { type: 'number', group: 'Nebula', label: 'Drift speed', default: 1, min: 0, max: 4, step: 0.01 },
      scale: { type: 'number', group: 'Nebula', label: 'Scale', default: 1.6, min: 0.5, max: 5, step: 0.01 },
      hue: { type: 'number', group: 'Color', label: 'Hue shift', default: 0.5, min: 0, max: 1, step: 0.01 },
      bassGlow: { type: 'number', group: 'Audio', label: 'Bass glow', default: 1, min: 0, max: 3, step: 0.01 },
    },
    controlDescriptions: {
      brightness: 'Overall nebula strength. It stays dim at every setting.',
      drift: 'How fast the gas clouds drift.',
      scale: 'Size of the cloud features. Higher values give smaller clouds.',
      hue: 'Tint blended into the magenta and teal gas.',
      bassGlow: 'How strongly bass brightens the nebula.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    const view = uniform(new Vector4(0, aspect, 0, 0));
    const shape = uniform(new Vector4(1, 1.6, 1, 1));
    const tint = uniform(new Vector4(0.8, 0.3, 1, 0));
    const baseTex = texture(new Texture(), vec2(uv().x, uv().y.oneMinus()));
    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    material.fragmentNode = wgslFn(nebulaPass)(uv(), baseTex, view, shape, tint);
    const scene = new Scene();
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    let bass = 0;

    let th = 0;

    return {
      update(frame) {
        th += ((jellyShared.theme ?? 0) - th) * 0.1;
        const spectrum = frame.audioSpectrum;
        let target = 0;
        if (spectrum?.available) {
          for (let i = 8; i < 28; i++) {
            target += spectrum.magnitudes[i] ?? 0;
          }
          target /= 20;
        }
        bass += (target - bass) * 0.1;

        const h = frame.controls.hue * Math.PI * 2;
        tint.value.set(
          0.55 + 0.45 * Math.cos(h),
          0.55 + 0.45 * Math.cos(h - 2.1),
          0.55 + 0.45 * Math.cos(h + 2.1),
          0,
        );
        tint.value.w = th;
        view.value.set(frame.timeSeconds, aspect, Math.min(bass * 3, 1), 0);
        shape.value.set(
          frame.controls.drift,
          frame.controls.scale,
          frame.controls.brightness,
          frame.controls.bassGlow,
        );
      },
      async evaluate(inputs, evaluation) {
        baseTex.value = inputs.image.texture as Texture;
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {
        bass = 0;
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  },
});
