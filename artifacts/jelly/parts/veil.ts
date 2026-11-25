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

// Light layer added only where the input is dark. Audio level slightly brightens it.
// Aquarium (theme 0): soft caustic light ribbons rippling across the frame; a broad sunlit
// patch drifts diagonally and the ribbons are brightest inside it.
// Space (theme 1): the Milky Way: dense star fields, dark dust rifts, a warm core and fine star grain.
// view: x=time, y=aspect, z=audio level, w=unused
// shape: x=brightness, y=period (s), z=width (fraction of screen), w=angle (radians)
// hue: x=hue shift (0..1), y=theme
const veilPass = `
fn jellyVeil(st: vec2f, base: vec4f, view: vec4f, shape: vec4f, hue: vec4f) -> vec4f {
  let t = view.x;
  let ang = shape.w;
  let dir = vec2f(cos(ang), sin(ang));
  let perp = vec2f(-dir.y, dir.x);
  let p = (st - vec2f(0.5)) * vec2f(view.y, 1.0);

  // Coordinate across the band and along its length.
  let across = dot(p, dir);
  let along = dot(p, perp);

  // Extent of the frame along the drift direction, so a band fully enters and leaves.
  let extent = abs(dir.x) * view.y + abs(dir.y);
  let width = max(shape.z, 0.05) * extent;
  let th = clamp(hue.y, 0.0, 1.0);

  // Only where the input is dark.
  let lum = dot(base.rgb, vec3f(0.2126, 0.7152, 0.0722));
  let dark = 1.0 - smoothstep(0.1, 0.4, lum);

  var water = vec3f(0.0);
  if (th < 0.999) {
    water = veilCaustics(st, across, along, extent, width, max(shape.y, 1.0), t, hue.x);
  }
  var sky = vec3f(0.0);
  if (th > 0.001) {
    sky = veilMilkyWay(p, across, along, extent, width, t, hue.x);
  }
  let level = shape.x * (1.0 + view.z * 0.5);
  let add = mix(water, sky * 0.3, th) * dark * level;
  return vec4f(base.rgb + add, base.a);
}

fn veilCaustics(st: vec2f, across: f32, along: f32, extent: f32, width: f32, period: f32, t: f32, hueX: f32) -> vec3f {
  // A broad sunlit patch drifts across the frame; caustics are brightest inside it.
  let travel = extent + width * 2.0;
  let center = -travel * 0.5 + fract(t / period) * travel;
  let wob = (veilFbm(vec2f(along * 1.3, t * 0.04) + vec2f(3.1, 7.7)) - 0.5) * width * 0.9;
  let d = (across - center + wob) / (width * 0.5);
  let sun = 0.3 + 0.7 * exp(-d * d * 1.2);

  // Caustic ribbons: contour lines of two warped noise sheets drifting against each other.
  let cq = vec2f(along, across) * 3.4;
  let w = vec2f(
    veilFbm(cq * 0.32 + vec2f(t * 0.05, 1.3)),
    veilFbm(cq * 0.32 + vec2f(4.2, -t * 0.04))
  ) - vec2f(0.5);
  let q = cq + w * 2.4;
  let na = veilNoise(q + vec2f(t * 0.13, -t * 0.05));
  let nb = veilNoise(q * 1.41 + vec2f(5.1 - t * 0.1, 2.3 + t * 0.08));
  let ra = 1.0 - abs(2.0 * na - 1.0);
  let rb = 1.0 - abs(2.0 * nb - 1.0);
  let caus = pow(ra, 5.0) + 0.7 * pow(rb, 5.0) + 0.6 * pow(ra * rb, 3.0);
  // Gentle ripple of brightness travelling along the ribbons.
  let rip = 0.75 + 0.25 * sin(t * 0.8 + along * 5.0 + w.x * 9.0);
  // Caustics fade with depth below the surface.
  let depthF = 0.3 + 0.7 * smoothstep(0.0, 1.0, st.y);

  // Hue along the length: teal -> violet -> faint gold, washed toward aqua-white light.
  let s = clamp(along / max(extent, 0.001) + 0.5 + (hueX - 0.5) * 1.2, 0.0, 1.0);
  var col = mix(vec3f(0.08, 0.75, 0.7), vec3f(0.5, 0.25, 0.9), smoothstep(0.0, 0.5, s));
  col = mix(col, vec3f(0.9, 0.7, 0.25), smoothstep(0.55, 1.0, s) * 0.7);
  col = mix(vec3f(0.62, 1.0, 0.94), col, 0.4);
  // Faint chromatic fringe: warm on one side of each ribbon, cool on the other.
  let fr = clamp((na - 0.5) * 6.0, -1.0, 1.0) * 0.22;
  let fringe = vec3f(1.0 + fr, 1.0, 1.0 - fr);
  return col * fringe * caus * sun * rip * depthF * 0.03;
}

fn veilMilkyWay(p: vec2f, across: f32, along: f32, extent: f32, width: f32, t: f32, hueX: f32) -> vec3f {
  // Galactic plane with gently wandering edges.
  let wa = veilFbm(vec2f(along * 1.1, 2.7)) - 0.5;
  let a = across + wa * width * 0.35;
  let d = a / (width * 0.5);
  let glow = exp(-d * d * 1.5);
  let spine = exp(-d * d * 6.0);

  // Warm core bulge. Hue shift slides it along the band.
  let cpos = (hueX - 0.5) * extent * 0.9 + 0.2 * extent;
  let ca = (along - cpos) / max(width, 0.05);
  let bulge = exp(-ca * ca * 1.3 - d * d * 1.1);
  let coreHot = exp(-ca * ca * 5.0 - d * d * 4.5);

  // Star clouds: mottled unresolved starlight.
  let sp = vec2f(along * 2.6, a * 5.0);
  let cloud = veilFbm(sp + vec2f(1.3, 8.1));
  let clouds = 0.3 + 1.2 * smoothstep(0.28, 0.8, cloud);

  // Dust rifts: dark filamentary lanes hugging the plane.
  let rw = veilFbm(sp * 0.55 + vec2f(6.4, 2.2));
  let rn = veilFbm(vec2f(along * 3.6, a * 8.5) + vec2f(rw * 1.8 + 4.4, rw * 0.9 + 1.9));
  let ridge = 1.0 - abs(2.0 * rn - 1.0);
  let riftBody = clamp(smoothstep(0.5, 0.7, rn) + 0.55 * pow(ridge, 10.0), 0.0, 1.0);
  let rift = riftBody * exp(-(d - 0.12) * (d - 0.12) * 2.2);
  let clear = 1.0 - 0.9 * rift;

  // Fine granularity of unresolved stars (mean 1).
  let gh = veilHash(floor(p * 540.0));
  let grain = 0.4 + 2.4 * gh * gh * gh;

  var col = mix(vec3f(0.5, 0.62, 1.0), vec3f(0.92, 0.9, 0.96), spine) * glow * clouds * grain * 0.1;
  col += vec3f(1.0, 0.7, 0.4) * (bulge * 0.14 + coreHot * 0.12) * (0.75 + 0.25 * grain);
  // Pink emission knots along the plane.
  let pink = smoothstep(0.66, 0.84, cloud) * smoothstep(0.45, 0.7, rw) * spine;
  col += vec3f(1.0, 0.28, 0.45) * pink * 0.07;
  col = col * clear;
  // Rift edges glow faintly brown where dust is backlit.
  col += vec3f(0.3, 0.16, 0.08) * rift * (1.0 - rift) * glow * 0.12;

  // Dense star fields, crowded inside the band and thinned in the rifts.
  let sd = clamp(glow * clouds * clear, 0.0, 1.0);
  let stars = veilStars(p, 320.0, 0.04 + 0.4 * sd, t, 1.0) * 0.45
    + veilStars(p, 120.0, 0.03 + 0.25 * sd, t, 2.0) * 0.6
    + veilStars(p, 38.0, 0.05 + 0.12 * sd, t, 3.0) * 0.9;
  return col + stars;
}

fn veilStars(p: vec2f, scale: f32, dens: f32, t: f32, seed: f32) -> vec3f {
  let g = p * scale + vec2f(seed * 13.7, seed * 7.1);
  let cell = floor(g);
  let h = veilHash(cell);
  if (h > dens) {
    return vec3f(0.0);
  }
  let h2 = veilHash(cell + vec2f(3.7, seed));
  let h3 = veilHash(cell + vec2f(seed, 9.1));
  let dv = fract(g) - vec2f(0.25 + 0.5 * h2, 0.25 + 0.5 * h3);
  let r2 = dot(dv, dv);
  let px = scale / 1000.0;
  let mag = 0.25 + 0.75 * pow(h3, 4.0);
  let core = exp(-r2 / (px * px * 0.9));
  let halo = exp(-r2 * 40.0) * pow(h3, 6.0) * 0.5;
  let tw = 0.75 + 0.25 * sin(t * (1.5 + 3.0 * h2) + h2 * 60.0);
  let tcol = mix(vec3f(0.68, 0.78, 1.0), vec3f(1.0, 0.86, 0.66), h2);
  return tcol * (core * mag + halo) * tw;
}

fn veilHash(p: vec2f) -> f32 {
  let h = dot(p, vec2f(127.1, 311.7));
  return fract(sin(h) * 43758.5453);
}

fn veilNoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = veilHash(i);
  let b = veilHash(i + vec2f(1.0, 0.0));
  let c = veilHash(i + vec2f(0.0, 1.0));
  let d = veilHash(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn veilFbm(p0: vec2f) -> f32 {
  var p = p0;
  var amp = 0.5;
  var sum = 0.0;
  for (var i = 0; i < 3; i++) {
    sum += amp * veilNoise(p);
    p = p * 2.03 + vec2f(17.1, 4.3);
    amp *= 0.5;
  }
  return sum / 0.875;
}

`;

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'jellyfish/veil',
    label: 'Aurora Veil',
    description: 'Adds soft caustic light ribbons under water, or the Milky Way with dense stars, dust rifts and a warm core in space, over dark areas.',
    tags: ['jellyfish', 'atmosphere'],
    inputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image to add the veil to.',
      },
    },
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image with a faint drifting veil of light added to dark areas.',
      },
    },
    controls: {
      brightness: { type: 'number', group: 'Veil', label: 'Brightness', default: 1, min: 0, max: 3, step: 0.01 },
      period: { type: 'number', group: 'Veil', label: 'Period', default: 25, min: 8, max: 90, step: 0.5 },
      width: { type: 'number', group: 'Veil', label: 'Width', default: 0.4, min: 0.15, max: 0.8, step: 0.01 },
      angle: { type: 'number', group: 'Veil', label: 'Angle', default: 0.6, min: -3.14, max: 3.14, step: 0.01 },
      hueShift: { type: 'number', group: 'Color', label: 'Hue shift', default: 0.5, min: 0, max: 1, step: 0.01 },
    },
    controlDescriptions: {
      brightness: 'Strength of the veil. It stays very faint at every setting.',
      period: 'Seconds between one band and the next crossing the frame.',
      width: 'Band width as a fraction of the screen.',
      angle: 'Drift direction in radians. 0 drifts left to right.',
      hueShift: 'Slides the teal, violet and gold colors along the band. In space it slides the warm Milky Way core.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    const view = uniform(new Vector4(0, aspect, 0, 0));
    const shape = uniform(new Vector4(1, 25, 0.4, 0.6));
    const hue = uniform(new Vector4(0.5, 0, 0, 0));
    const baseTex = texture(new Texture(), vec2(uv().x, uv().y.oneMinus()));
    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    material.fragmentNode = wgslFn(veilPass)(uv(), baseTex, view, shape, hue);
    const scene = new Scene();
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    let level = 0;
    let gain = 0.05;

    let th = 0;

    return {
      update(frame) {
        th += ((jellyShared.theme ?? 0) - th) * 0.1;
        const spectrum = frame.audioSpectrum;
        let target = 0;
        if (spectrum?.available) {
          let sum = 0;
          const n = spectrum.magnitudes.length;
          for (let i = 0; i < n; i++) {
            sum += spectrum.magnitudes[i] ?? 0;
          }
          const avg = n > 0 ? sum / n : 0;
          // Auto-gain: track a slow-decaying peak.
          gain = Math.max(avg, gain * 0.999, 0.02);
          target = Math.min(avg / gain, 1);
        }
        level += (target - level) * 0.05;

        view.value.set(frame.timeSeconds, aspect, level, 0);
        shape.value.set(
          frame.controls.brightness,
          frame.controls.period,
          frame.controls.width,
          frame.controls.angle,
        );
        hue.value.set(frame.controls.hueShift, th, 0, 0);
      },
      async evaluate(inputs, evaluation) {
        baseTex.value = inputs.image.texture as Texture;
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {
        level = 0;
        gain = 0.05;
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  },
});
