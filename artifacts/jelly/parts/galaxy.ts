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

// Adds one slowly rotating two-arm spiral galaxy far in the background, only where the
// input is dark. Bass slightly brightens the nucleus.
// Space: crisp arms with pink HII knots and blue young clusters, dust lanes, a yellow bulge,
// warm inner disc and blue outer arms. Through water: a soft, wavering, dreamy bloom.
// view: x=spin, y=aspect, z=bass, w=theme  shape: x=level, y/z=centre, w=size  aux: x=time
const galaxyPass = `
fn jellyGalaxy(st: vec2f, base: vec4f, view: vec4f, shape: vec4f, aux: vec4f) -> vec4f {
  let spin = view.x;
  let aspect = view.y;
  let bass = view.z;
  let th = clamp(view.w, 0.0, 1.0);
  let wet = 1.0 - th;
  let tm = aux.x;
  let level = shape.x * (1.0 + th * 3.0);
  let center = vec2f(shape.y, shape.z);
  let size = max(shape.w, 0.02);

  // Screen offset, aspect corrected, then tilted into an inclined disc.
  let d = (st - center) * vec2f(aspect, 1.0);
  let tilt = 0.55;
  let ct = cos(tilt);
  let stl = sin(tilt);
  let tp = vec2f(ct * d.x + stl * d.y, -stl * d.x + ct * d.y);
  var g = vec2f(tp.x, tp.y / 0.42) / size;
  // Through water the image wavers with slow refraction.
  g += wet * 0.06 * vec2f(sin(tm * 0.53 + g.y * 2.6), cos(tm * 0.47 + g.x * 2.2));
  let r = length(g);
  if (r > 2.4) {
    return vec4f(base.rgb, 1.0);
  }

  // Co-rotating frame so the texture and the arms turn together.
  let cs = cos(spin);
  let sn = sin(spin);
  let gr = vec2f(cs * g.x + sn * g.y, -sn * g.x + cs * g.y);
  let theta = atan2(gr.y, gr.x);

  // Two logarithmic arms with a little irregularity.
  let irr = galaxyFbm(gr * 1.7 + vec2f(5.3, 1.1)) - 0.5;
  let a = theta - 1.75 * log(r + 0.04) + irr * mix(0.5, 1.1, th);
  let armWave = 0.5 + 0.5 * cos(2.0 * a);
  let arm = pow(armWave, mix(1.2, 3.0, th));

  // Mottled starlight. Space adds fine clumps; water blurs them away.
  let grain = galaxyFbm(gr * mix(2.0, 4.2, th) + vec2f(1.7, 3.9));
  var fine = 0.5;
  var dustN = 0.5;
  if (th > 0.001) {
    fine = galaxyFbm(gr * 13.0 + vec2f(2.2, 9.4));
    dustN = galaxyFbm(gr * 5.5 + vec2f(3.1, 7.7));
  }
  let mottle = (0.45 + 0.9 * grain) * mix(1.0, 0.55 + 0.9 * fine, th);
  let disc = exp(-r * 2.1) * (1.0 - smoothstep(0.85, 1.55, r));
  let armBody = (0.16 + 0.84 * arm) * mottle * disc;

  // Dust lanes on the inner edge of each arm.
  let lane = pow(0.5 + 0.5 * cos(2.0 * a - 0.8), 5.0);
  let dust = lane * smoothstep(0.3, 0.7, dustN) * smoothstep(0.06, 0.22, r) * th;

  // Rounder yellow bulge and a bright nucleus.
  let bq = g * vec2f(1.0, 0.6);
  let rb2 = dot(bq, bq);
  let bulge = exp(-rb2 * mix(10.0, 16.0, th));
  let nucleus = exp(-rb2 * mix(40.0, 220.0, th)) * (1.0 + 0.8 * bass);

  // HII regions (pink) and young blue clusters on the arm crests.
  let onArm = smoothstep(0.55, 0.9, armWave) * smoothstep(0.14, 0.32, r) * (1.0 - smoothstep(0.9, 1.4, r));
  var knots = vec3f(0.0);
  if (th > 0.001) {
    knots = galaxyKnots(gr, onArm * (1.0 - 0.8 * dust) * (0.35 + 0.65 * exp(-r * 1.2)));
  }
  // Resolved stars across the disc.
  let sgp = gr * 110.0;
  let stars = step(0.982, galaxyHash(floor(sgp))) * (1.0 - smoothstep(0.0, 0.3, length(fract(sgp) - vec2f(0.5)))) * disc * th;

  let bulgeCol = vec3f(1.0, 0.8, 0.46);
  let armCol = mix(vec3f(1.0, 0.9, 0.76), vec3f(0.45, 0.62, 1.0), smoothstep(0.12, 0.7, r));
  var gal = armCol * armBody * (1.0 - 0.85 * dust) * 1.1
    + bulgeCol * bulge * (1.0 - 0.45 * dust) * 0.75
    + vec3f(1.0, 0.93, 0.8) * nucleus * 1.3
    + knots
    + vec3f(0.9, 0.95, 1.0) * stars * 1.2;

  // Through water: soft dreamy bloom, a hint of pink in the arms, cooler and less saturated.
  if (wet > 0.001) {
    let halo = exp(-r * r * 1.4) * 0.35 + exp(-rb2 * 4.0) * 0.4;
    let gl = dot(gal, vec3f(0.2126, 0.7152, 0.0722));
    var dream = mix(gal, gl * vec3f(0.78, 0.95, 1.0), 0.3);
    dream += vec3f(1.0, 0.45, 0.7) * onArm * disc * 0.25;
    dream += vec3f(0.42, 0.6, 0.85) * halo;
    gal = mix(gal, dream, wet);
  }

  // Add only where the input is dark.
  let lum = dot(base.rgb, vec3f(0.2126, 0.7152, 0.0722));
  let mask = 1.0 - smoothstep(0.05, 0.25, lum);

  let add = gal * level * mask;
  return vec4f(base.rgb + add, 1.0);
}

fn galaxyKnots(gr: vec2f, gate: f32) -> vec3f {
  var outc = vec3f(0.0);
  // Pink HII regions.
  let kg = gr * 9.0;
  let kc = floor(kg);
  let kh = galaxyHash(kc + vec2f(0.7, 0.0));
  let kd = fract(kg) - vec2f(0.3 + 0.4 * galaxyHash(kc + vec2f(4.1, 7.3)), 0.3 + 0.4 * galaxyHash(kc + vec2f(1.9, 2.6)));
  let kr2 = dot(kd, kd);
  outc += vec3f(1.0, 0.3, 0.58) * step(0.5, kh) * (exp(-kr2 * 70.0) * 1.6 + exp(-kr2 * 30.0) * 0.35) * (0.4 + 0.6 * kh);
  // Young blue-white star clusters.
  let bg = gr * 17.0 + vec2f(3.3, 8.8);
  let bc = floor(bg);
  let bh = galaxyHash(bc + vec2f(0.0, 5.5));
  let bd = fract(bg) - vec2f(0.3 + 0.4 * galaxyHash(bc + vec2f(2.2, 0.4)), 0.3 + 0.4 * galaxyHash(bc + vec2f(6.6, 1.2)));
  let br2 = dot(bd, bd);
  outc += vec3f(0.65, 0.8, 1.0) * step(0.55, bh) * exp(-br2 * 140.0) * 1.2;
  return outc * gate;
}

fn galaxyHash(p: vec2f) -> f32 {
  let h = dot(p, vec2f(127.1, 311.7));
  return fract(sin(h) * 43758.5453);
}

fn galaxyNoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = galaxyHash(i);
  let b = galaxyHash(i + vec2f(1.0, 0.0));
  let c = galaxyHash(i + vec2f(0.0, 1.0));
  let d = galaxyHash(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn galaxyFbm(p0: vec2f) -> f32 {
  var p = p0;
  var amp = 0.5;
  var sum = 0.0;
  for (var i = 0; i < 4; i++) {
    sum += amp * galaxyNoise(p);
    p = p * 2.03 + vec2f(17.1, 4.3);
    amp *= 0.5;
  }
  return sum;
}
`;

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'jellyfish/galaxy',
    label: 'Distant Galaxy',
    description: 'Adds one slowly rotating spiral galaxy far in the background: pink HII knots, a yellow bulge and blue outer arms in space, a soft dreamy blur through water. Bass brightens its core slightly.',
    tags: ['jellyfish', 'cosmic'],
    inputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image to add the galaxy behind.',
      },
    },
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image with a faint distant galaxy added.',
      },
    },
    controls: {
      brightness: { type: 'number', group: 'Galaxy', label: 'Brightness', default: 1, min: 0, max: 2, step: 0.01 },
      rotationSpeed: { type: 'number', group: 'Galaxy', label: 'Rotation speed', default: 1, min: 0, max: 4, step: 0.01 },
      positionX: { type: 'number', group: 'Placement', label: 'Position X', default: 0.78, min: 0, max: 1, step: 0.01 },
      positionY: { type: 'number', group: 'Placement', label: 'Position Y', default: 0.72, min: 0, max: 1, step: 0.01 },
      size: { type: 'number', group: 'Placement', label: 'Size', default: 0.25, min: 0.08, max: 0.6, step: 0.01 },
    },
    controlDescriptions: {
      brightness: 'Overall galaxy strength. It stays very dim at every setting.',
      rotationSpeed: 'How fast the spiral turns. Zero holds it still.',
      positionX: 'Horizontal position of the galaxy centre across the frame.',
      positionY: 'Vertical position of the galaxy centre across the frame.',
      size: 'Radius of the galaxy as a fraction of the frame height.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    const view = uniform(new Vector4(0, aspect, 0, 0));
    const shape = uniform(new Vector4(0.05, 0.78, 0.72, 0.25));
    const aux = uniform(new Vector4(0, 0, 0, 0));
    const baseTex = texture(new Texture(), vec2(uv().x, uv().y.oneMinus()));
    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    material.fragmentNode = wgslFn(galaxyPass)(uv(), baseTex, view, shape, aux);
    const scene = new Scene();
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    let bass = 0;
    let peak = 0.0001;
    let spin = 0;
    let lastTime = 0;

    let th = 0;

    return {
      update(frame) {
        th += ((jellyShared.theme ?? 0) - th) * 0.1;
        const dt = Math.max(0, Math.min(0.1, frame.timeSeconds - lastTime));
        lastTime = frame.timeSeconds;
        spin += dt * 0.03 * frame.controls.rotationSpeed;

        const spectrum = frame.audioSpectrum;
        let target = 0;
        if (spectrum?.available) {
          let sum = 0;
          for (let i = 6; i < 24; i++) {
            sum += spectrum.magnitudes[i] ?? 0;
          }
          const raw = sum / 18;
          peak = Math.max(raw, peak * 0.995, 0.0001);
          target = Math.min(raw / peak, 1);
        }
        bass += (target - bass) * 0.1;

        view.value.set(spin, aspect, bass, th);
        aux.value.set(frame.timeSeconds, 0, 0, 0);
        shape.value.set(
          0.05 * frame.controls.brightness,
          frame.controls.positionX,
          frame.controls.positionY,
          frame.controls.size,
        );
      },
      async evaluate(inputs, evaluation) {
        baseTex.value = inputs.image.texture as Texture;
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {
        bass = 0;
        peak = 0.0001;
        spin = 0;
        lastTime = 0;
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  },
});
