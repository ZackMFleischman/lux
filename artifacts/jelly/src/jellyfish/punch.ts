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

// Kick punch: each detected kick triggers a short envelope that zooms the frame
// slightly toward the center, blooms the bright parts and lifts exposure.
// The entry function must stay first in the string.
const punchPass = `
fn jellyPunch(st: vec2f, c0: vec4f, c1: vec4f, c2: vec4f, c3: vec4f, c4: vec4f, c5: vec4f, c6: vec4f, c7: vec4f, c8: vec4f, p: vec4f) -> vec4f {
  let flash = p.x;
  let bloom = p.y;
  var glow = vec3f(0.0);
  glow += punchBright(c0.rgb);
  glow += punchBright(c1.rgb);
  glow += punchBright(c2.rgb);
  glow += punchBright(c3.rgb);
  glow += punchBright(c4.rgb);
  glow += punchBright(c5.rgb);
  glow += punchBright(c6.rgb);
  glow += punchBright(c7.rgb);
  glow += punchBright(c8.rgb);
  glow = glow / 9.0;
  let col = (c0.rgb + glow * bloom * 2.0) * (1.0 + flash);
  return vec4f(col, c0.a);
}

fn punchBright(c: vec3f) -> vec3f {
  let l = max(c.r, max(c.g, c.b));
  let k = smoothstep(0.25, 0.9, l);
  return c * k;
}
`;

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'jellyfish/punch',
    label: 'Kick Punch',
    description: 'On each bass kick, zooms slightly toward the center, blooms bright areas and lifts exposure, then eases back.',
    tags: ['jellyfish', 'audio'],
    inputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image to punch on each kick.',
      },
    },
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image with a zoom, bloom and flash on each kick.',
      },
    },
    controls: {
      sensitivity: { type: 'number', group: 'Detection', label: 'Sensitivity', default: 1, min: 0, max: 2, step: 0.01 },
      zoom: { type: 'number', group: 'Punch', label: 'Zoom', default: 0.025, min: 0, max: 0.2, step: 0.001 },
      bloom: { type: 'number', group: 'Punch', label: 'Bloom', default: 0.5, min: 0, max: 3, step: 0.01 },
      flash: { type: 'number', group: 'Punch', label: 'Flash', default: 0.12, min: 0, max: 1, step: 0.01 },
      release: { type: 'number', group: 'Punch', label: 'Release', default: 0.35, min: 0.05, max: 1.5, step: 0.01 },
    },
    controlDescriptions: {
      sensitivity: 'How easily a bass hit counts as a kick. Higher values trigger on softer hits.',
      zoom: 'How far the frame pushes toward the center on a kick. 0 turns the zoom off.',
      bloom: 'Strength of the soft glow added to bright parts on a kick.',
      flash: 'Small exposure lift on a kick.',
      release: 'Seconds the punch takes to ease back after the peak.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const params = uniform(new Vector4(0, 0, 0, 0));
    const zoomAmt = uniform(0);
    const blurAmt = uniform(0);
    const sharedTex = new Texture();
    const center = vec2(0.5, 0.5);
    const flipped = vec2(uv().x, uv().y.oneMinus());
    const zoomed = (flipped as any).sub(center).mul(float(1).sub(zoomAmt as any)).add(center);
    const taps: any[] = [];
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const tapUv = (zoomed as any)
        .sub(center)
        .mul(float(1).sub((blurAmt as any).mul(t)))
        .add(center)
        .clamp(0, 1);
      taps.push(texture(sharedTex, tapUv as any));
    }
    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    material.fragmentNode = (wgslFn(punchPass) as any)(
      uv(),
      taps[0], taps[1], taps[2], taps[3], taps[4], taps[5], taps[6], taps[7], taps[8],
      params,
    );
    const scene = new Scene();
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    let env = 0;
    let rising = false;
    let peak = 0.02;
    let avg = 0;
    let lastTime = -1;
    let lastKick = -10;

    return {
      update(frame) {
        const now = frame.timeSeconds;
        const dt = lastTime < 0 ? 1 / 60 : Math.min(Math.max(now - lastTime, 0), 0.1);
        lastTime = now;
        const c = frame.controls;

        const spectrum = frame.audioSpectrum;
        if (spectrum?.available) {
          let v = 0;
          for (let i = 2; i <= 14; i++) {
            v += spectrum.magnitudes[i] ?? 0;
          }
          v /= 13;
          peak = Math.max(v, peak * Math.exp(-dt * 0.25), 1e-4);
          const n = v / peak;
          const ratio = Math.max(1.15, 1.9 - 0.45 * c.sensitivity);
          if (n > ratio * avg && n > 0.2 && now - lastKick > 0.12) {
            lastKick = now;
            rising = true;
          }
          avg += (n - avg) * (1 - Math.exp(-dt / 0.8));
        }

        if (rising) {
          env += dt / 0.03;
          if (env >= 1) {
            env = 1;
            rising = false;
          }
        } else {
          env *= Math.exp((-dt * 3) / Math.max(c.release, 0.05));
          if (env < 0.001) env = 0;
        }
        const e = env * env * (3 - 2 * env);

        zoomAmt.value = c.zoom * e;
        blurAmt.value = 0.06 * e;
        params.value.set(c.flash * e, c.bloom * e, 0, 0);
      },
      async evaluate(inputs, evaluation) {
        const tex = inputs.image.texture as Texture;
        for (const t of taps) {
          t.value = tex;
        }
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {
        env = 0;
        rising = false;
        peak = 0.02;
        avg = 0;
        lastTime = -1;
        lastKick = -10;
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  },
});
