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
import { uniform, uv, wgslFn, texture, vec2, float } from 'three/tsl';
import { jellyShared } from './jelly-shared.ts';

// Wave vec4: x, y, r (bell p-space), w = amp. Per-wave band scale comes from s0..s3 (4 waves each).
// ctl: x = aspect, y = width, z = unused, w = unused.
// Returns xy = uv displacement in sampling space (y negated), z = ring band energy.
const warpField = `
fn jellyWarpField(st: vec2f, ctl: vec4f, s0: vec4f, s1: vec4f, s2: vec4f, s3: vec4f, w0: vec4f, w1: vec4f, w2: vec4f, w3: vec4f, w4: vec4f, w5: vec4f, w6: vec4f, w7: vec4f, w8: vec4f, w9: vec4f, w10: vec4f, w11: vec4f, w12: vec4f, w13: vec4f, w14: vec4f, w15: vec4f) -> vec4f {
  let p = (st - vec2f(0.5, 0.42)) * vec2f(ctl.x, 1.0) * 2.0;
  var acc = vec3f(0.0, 0.0, 0.0);
  acc += warpWave(p, w0, s0.x, ctl);
  acc += warpWave(p, w1, s0.y, ctl);
  acc += warpWave(p, w2, s0.z, ctl);
  acc += warpWave(p, w3, s0.w, ctl);
  acc += warpWave(p, w4, s1.x, ctl);
  acc += warpWave(p, w5, s1.y, ctl);
  acc += warpWave(p, w6, s1.z, ctl);
  acc += warpWave(p, w7, s1.w, ctl);
  acc += warpWave(p, w8, s2.x, ctl);
  acc += warpWave(p, w9, s2.y, ctl);
  acc += warpWave(p, w10, s2.z, ctl);
  acc += warpWave(p, w11, s2.w, ctl);
  acc += warpWave(p, w12, s3.x, ctl);
  acc += warpWave(p, w13, s3.y, ctl);
  acc += warpWave(p, w14, s3.z, ctl);
  acc += warpWave(p, w15, s3.w, ctl);
  let o = acc.xy / vec2f(ctl.x, 1.0);
  return vec4f(o.x, -o.y, acc.z, 0.0);
}

fn warpWave(p: vec2f, w: vec4f, sc: f32, ctl: vec4f) -> vec3f {
  let amp = w.w;
  let scale = max(sc, 0.05);
  let q = p - w.xy;
  let r = length(q);
  let dir = q / max(r, 0.0001);
  let bw = max(0.12 * ctl.y * scale, 0.005);
  let x = (r - w.z) / bw;
  let g = exp(-x * x);
  // Derivative-of-gaussian: push out ahead of the front, pull in behind. Peak |x e^-x^2| = 0.4289.
  // 0.03 uv peak = 0.06 p-units; 0.06 / 0.4289 = 0.14.
  let push = x * g * 0.14 * amp;
  return vec3f(dir * push, g * amp);
}
`;

// Displaced sampling uv, kept finite and in range: m = 0 clamps to the edge, m = 1 mirrors.
const warpUv = `
fn jellyWarpUv(base: vec2f, field: vec4f, k: f32, m: f32) -> vec2f {
  let o = clamp(field.xy * k, vec2f(-1000.0), vec2f(1000.0));
  let u = base + o;
  let mir = vec2f(1.0) - abs(fract(u * 0.5) * 2.0 - vec2f(1.0));
  let cl = clamp(u, vec2f(0.0), vec2f(1.0));
  return clamp(mix(cl, mir, step(0.5, m)), vec2f(0.0), vec2f(1.0));
}
`;

const warpComposite = `
fn jellyWarpComposite(r: vec4f, g: vec4f, b: vec4f, field: vec4f, look: vec4f) -> vec4f {
  let base = vec3f(r.r, g.g, b.b);
  let e = clamp(field.z, 0.0, 4.0);
  let lift = base * e * 0.25 * look.x + vec3f(0.6, 0.8, 1.0) * e * 0.03 * look.x;
  return vec4f(base + lift, max(max(r.a, g.a), b.a));
}
`;

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'jellyfish/warp',
    label: 'Shockwave Warp',
    description: 'Refracts the whole frame at every jellyfish shockwave front, with a chromatic split and a slight ring brightening.',
    tags: ['jellyfish', 'cosmic'],
    inputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Finished frame to distort.',
      },
    },
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Frame with shockwave refraction.',
      },
    },
    controls: {
      strength: { type: 'number', group: 'Warp', label: 'Strength', default: 1, min: 0, max: 100, step: 0.01 },
      width: { type: 'number', group: 'Warp', label: 'Band width', default: 1, min: 0, max: 20, step: 0.01 },
      chroma: { type: 'number', group: 'Warp', label: 'Chroma split', default: 1, min: 0, max: 4, step: 0.01 },
      highlight: { type: 'number', group: 'Warp', label: 'Ring highlight', default: 1, min: 0, max: 4, step: 0.01 },
      mirror: { type: 'number', group: 'Warp', label: 'Mirror edges', default: 0, min: 0, max: 1, step: 1 },
    },
    controlDescriptions: {
      strength: 'Displacement amount. At 1 the peak shift is about 3% of the frame height; high values push pixels beyond the screen.',
      width: 'Thickness of the refracting band around each shockwave front.',
      chroma: 'How far the red and blue channels separate inside the band.',
      highlight: 'Brightening along each shockwave front.',
      mirror: 'Off (0): pixels pushed past the frame edge repeat the edge. On (1): the frame mirrors, so huge displacements stay detailed.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    const ctl = uniform(new Vector4(aspect, 1, 0, 0));
    const look = uniform(new Vector4(1, 0, 0, 0));
    const chroma = uniform(0.06);
    const mirror = uniform(0);
    const scales = Array.from({ length: 4 }, () => uniform(new Vector4(1, 1, 1, 1)));
    const waves = Array.from({ length: 16 }, () => uniform(new Vector4(0, 0, 0, 0)));

    const field = wgslFn(warpField)(uv(), ctl, ...scales, ...waves);
    const src = new Texture();
    const baseUv = vec2(uv().x, uv().y.oneMinus());
    const uvFn = wgslFn(warpUv);
    const texR = texture(src, uvFn(baseUv, field, chroma.oneMinus(), mirror) as any);
    const texG = texture(src, uvFn(baseUv, field, float(1), mirror) as any);
    const texB = texture(src, uvFn(baseUv, field, chroma.add(1), mirror) as any);
    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    material.fragmentNode = wgslFn(warpComposite)(texR, texG, texB, field, look);
    const scene = new Scene();
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    return {
      update(frame) {
        const c = frame.controls;
        const shared = jellyShared as typeof jellyShared & {
          waveStrength?: Float32Array;
          waveScale?: Float32Array;
          waveReach?: Float32Array;
        };
        const n = Math.min(shared.waveCount | 0, 16);
        for (let i = 0; i < 16; i++) {
          const v = waves[i].value as Vector4;
          const sv = scales[i >> 2].value as Vector4;
          if (i >= n) {
            v.set(0, 0, -10, 0);
            continue;
          }
          const r = shared.waveR[i];
          const ws = shared.waveStrength?.[i] || 1;
          const sc = Math.min(Math.max(shared.waveScale?.[i] || 1, 0.05), 8);
          const reach = shared.waveReach?.[i] || 2.5;
          const t = Math.min(Math.max(r / reach, 0), 1);
          const fadeOut = 1 - t * t * (3 - 2 * t);
          const fadeIn = Math.min(r / 0.08, 1);
          const amp = Math.min(Math.max(c.strength * ws * fadeOut * fadeIn, 0), 1000);
          sv.setComponent(i & 3, Number.isFinite(sc) ? sc : 1);
          v.set(shared.waveX[i], shared.waveY[i], r, Number.isFinite(amp) ? amp : 0);
        }
        ctl.value.set(aspect, c.width, 0, 0);
        look.value.set(c.highlight, 0, 0, 0);
        chroma.value = 0.06 * c.chroma;
        mirror.value = c.mirror ? 1 : 0;
      },
      async evaluate(inputs, evaluation) {
        const tex = inputs.image.texture as Texture;
        texR.value = tex;
        texG.value = tex;
        texB.value = tex;
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {},
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  },
});
