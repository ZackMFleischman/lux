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

// Adds drifting bioluminescent plankton (aquarium) or stardust plus tumbling asteroids (space).
// Four depth layers: far crisp specks -> near soft bokeh discs. Highs make them sparkle.
// st.y is up.
// view  = (time, aspect, highs, sparkle)
// shape = (density, size, drift speed, brightness)
// scat  = (scatter, scatter radius, scatter glow, theme)
// IMPORTANT: wgslFn uses the FIRST function as the entry point; helpers follow it.
const planktonPass = `
fn jellyPlankton(st: vec2f, base: vec4f, view: vec4f, shape: vec4f, s0: vec4f, s1: vec4f, s2: vec4f, s3: vec4f, scat: vec4f) -> vec4f {
  let t = view.x;
  let aspect = view.y;
  let highs = view.z;
  let sparkle = view.w;
  let th = scat.w;
  let p = vec2f(st.x * aspect, st.y);

  // Surges are smooth fields, so evaluate them once per pixel and warp the mote lookup.
  let sg = planktonSurge(s0, p, t, aspect, scat.y) + planktonSurge(s1, p, t, aspect, scat.y)
    + planktonSurge(s2, p, t, aspect, scat.y) + planktonSurge(s3, p, t, aspect, scat.y);

  var rgb = base.rgb;
  if (th > 0.002) {
    rgb = planktonAsteroids(p, rgb, t, aspect, th);
  }

  var glow = vec3f(0.0);
  // Layer 0 = far (tiny, crisp, slow) ... layer 3 = near (soft bokeh, fast parallax).
  for (var layer = 0; layer < 4; layer++) {
    let fl = f32(layer);
    let nearW = fl / 3.0;
    let scale = 30.0 / (1.0 + fl * 0.55 + fl * fl * 0.25);
    let par = 0.5 + 0.3 * fl;
    let seed = fl * 17.31 + 3.7;
    let sway = vec2f(sin(t * 0.07 + fl) * 0.4 + th * t * 0.04 * par, t * shape.z * par * mix(1.0, 0.1, th));
    let q = p * scale + vec2f(seed, 0.0) - sway - sg.xy * scat.x * 0.25;
    let cell = floor(q);
    let local = fract(q);
    let h = planktonHash22(cell + seed);
    let h2 = planktonHash22(cell * 1.37 + 5.2 + seed);
    let dens = shape.x * (1.0 - 0.45 * step(2.5, fl) - 0.4 * step(fl, 0.5));
    if (h.x > dens) {
      continue;
    }
    // Mote stays inside its own cell, so one lookup per layer is enough.
    let wob = vec2f(sin(t * (0.6 + h2.x) + h.y * 6.28), cos(t * (0.5 + h2.y) + h.x * 6.28)) * 0.13 * (1.0 - 0.85 * th);
    let center = vec2f(0.5) + (h2 - 0.5) * 0.4 + wob;
    let cellPx = 1080.0 / scale;
    let dv = (local - center) * cellPx;
    let dp = length(dv);
    let e = max(abs(local.x - 0.5), abs(local.y - 0.5));
    let win = 1.0 - smoothstep(0.42, 0.5, e);

    let twinkle0 = 0.55 + 0.45 * sin(t * (0.4 + h2.y * 3.5) + h.x * 40.0 + h2.x * 17.0);
    let twinkle1 = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(t * (1.5 + h2.y * 5.0) + h.x * 40.0), 2.0);
    let twinkle = mix(twinkle0, twinkle1, th);
    let gate = step(0.65, fract(h.x * 13.7 + floor(t * (0.7 + h2.x) + h.y * 7.0) * 0.618));
    let flash = pow(max(0.0, sin(t * (4.0 + h2.x * 9.0) + h.y * 60.0)), 6.0);
    let boost = (1.0 + highs * sparkle * 5.0 * flash * gate) * (1.0 + sg.z * scat.z * 3.0);

    var amt = 0.0;
    if (layer == 3) {
      // Near: out of focus. Soft disc with a faint brighter rim, lower peak.
      let rb = (2.6 + 1.6 * shape.y) * (0.8 + 0.5 * h2.y);
      let disc = 1.0 - smoothstep(rb - 1.2, rb + 0.4, dp);
      let rimv = smoothstep(rb * 0.45, rb, dp) * disc;
      amt = (disc * 0.7 + rimv * 0.35) * 0.38;
    } else {
      // Far and mid: crisp point with a faint halo.
      let rr = max((0.55 + 0.4 * fl) * shape.y * (0.8 + 0.5 * h2.y), 0.7);
      let g = (dp * dp) / (rr * rr);
      amt = exp(-g) + exp(-g / 6.0) * 0.06;
      // Glints: a few motes flash a tiny four-point star now and then.
      let gl = step(0.78, h2.y) * step(0.5, fl) * pow(0.5 + 0.5 * sin(t * (0.9 + h.y * 2.3) + h.x * 50.0), 24.0);
      if (gl > 0.001) {
        let sl = 2.0 + fl * 1.5;
        let cx = exp(-abs(dv.x) / sl) * exp(-(dv.y * dv.y) / 0.35);
        let cy = exp(-abs(dv.y) / sl) * exp(-(dv.x * dv.x) / 0.35);
        amt += gl * (cx + cy) * (1.0 + 0.5 * fl) * (1.0 + highs * sparkle);
      }
    }

    // Aquarium: cyan and gold bioluminescence, nearer ones paler. Space: star colour temperatures.
    let gold = step(0.72, h2.x);
    let col0 = mix(mix(vec3f(0.35, 0.95, 1.0), vec3f(1.0, 0.82, 0.38), gold), vec3f(0.7, 0.95, 1.0), nearW * 0.35);
    let col1 = planktonTemp(fract(h2.x * 3.17 + h.y * 0.5));
    let col = mix(col0, col1, th);
    let lb = 0.5 + 0.5 * nearW;
    glow += col * amt * win * twinkle * boost * lb * shape.w * (1.0 + th);
  }
  let dc = length(vec2f((st.x - 0.5) * aspect, st.y - 0.42));
  glow *= 0.45 + 0.55 * smoothstep(0.0, 0.35, dc);
  let a = clamp(max(glow.r, max(glow.g, glow.b)), 0.0, 1.0);
  return vec4f(rgb + glow, max(base.a, a));
}

// Returns (radial push * weight, glow weight) for one surge; zero when inactive.
// The push fades to zero at the epicentre so the warp stays smooth.
fn planktonSurge(s: vec4f, pos: vec2f, t: f32, aspect: f32, radius: f32) -> vec3f {
  let age = t - s.z;
  if (s.w <= 0.0 || age < 0.0 || age > 0.6) {
    return vec3f(0.0);
  }
  let env = smoothstep(0.0, 0.04, age) * (1.0 - smoothstep(0.04, 0.54, age));
  let dv = pos - vec2f(s.x * aspect, s.y);
  let dist = length(dv);
  let fall = 1.0 - smoothstep(0.0, radius, dist);
  let w = env * fall * s.w;
  return vec3f(dv / max(dist, radius * 0.2) * w, w);
}

// Approximate star colours from cool red-orange to hot blue; most are white or blue-white.
fn planktonTemp(x: f32) -> vec3f {
  var c = mix(vec3f(1.0, 0.55, 0.32), vec3f(1.0, 0.82, 0.58), smoothstep(0.0, 0.12, x));
  c = mix(c, vec3f(1.0, 0.96, 0.9), smoothstep(0.12, 0.3, x));
  c = mix(c, vec3f(0.82, 0.88, 1.0), smoothstep(0.45, 0.7, x));
  c = mix(c, vec3f(0.6, 0.72, 1.0), smoothstep(0.85, 1.0, x));
  return c;
}

// A few tumbling asteroid chunks lit by the top-left star, with warm key rim and cool back rim.
fn planktonAsteroids(p: vec2f, inRgb: vec3f, t: f32, aspect: f32, th: f32) -> vec3f {
  return inRgb;
  var rgb = inRgb;
  let sun = vec2f(0.13 * aspect, 0.86);
  for (var i = 0; i < 4; i++) {
    let fi = f32(i);
    let h = planktonHash22(vec2f(fi * 7.13 + 1.3, fi * 3.71 + 9.2));
    let h2 = planktonHash22(vec2f(fi * 2.17 + 4.1, fi * 5.33 + 0.7));
    let rad = 0.012 + 0.02 * h.x;
    let dirx = select(-1.0, 1.0, h2.x > 0.5);
    let cx = fract(h.y + t * (0.004 + 0.007 * h2.y) * dirx) * (aspect + 0.4) - 0.2;
    let cy = 0.12 + 0.76 * h2.y + 0.04 * sin(t * 0.05 + fi * 2.0);
    let c = vec2f(cx, cy);
    let d = p - c;
    if (dot(d, d) > rad * rad * 2.0) {
      continue;
    }
    let spin = t * (0.12 + 0.3 * h.x) * select(-1.0, 1.0, h.y > 0.5) + fi * 1.7;
    let cs = cos(spin);
    let sn = sin(spin);
    let l = vec2f(d.x * cs + d.y * sn, -d.x * sn + d.y * cs) / rad;
    let ang = atan2(l.y, l.x);
    let edgeR = 1.0 + 0.14 * sin(ang * 2.0 + h.x * 6.0) + 0.08 * sin(ang * 3.0 + h2.y * 9.0) + 0.04 * sin(ang * 7.0 + h.y * 4.0);
    let rr = length(l) / edgeR;
    let aa = 1.5 / (1080.0 * rad * edgeR);
    let mask = (1.0 - smoothstep(1.0 - aa, 1.0, rr)) * th;
    if (mask <= 0.0) {
      continue;
    }
    // Fake rounded normal from the lumpy silhouette, roughened by value noise.
    let bump = planktonNoise2(l * 2.6 + h * 13.0);
    let bump2 = planktonNoise2(l * 6.0 + h2 * 7.0);
    let nxy = l / edgeR * 0.92 + (vec2f(bump, bump2) - 0.5) * 0.25;
    let nz = sqrt(max(1.0 - dot(nxy, nxy), 0.0));
    let n = normalize(vec3f(nxy, nz));
    let ld = normalize(sun - c);
    let lb = vec2f(ld.x * cs + ld.y * sn, -ld.x * sn + ld.y * cs);
    let lgt = normalize(vec3f(lb * 0.85, 0.45));
    let diff = max(dot(n, lgt), 0.0);
    let albedo = 0.16 * (0.7 + 0.5 * bump) * (1.0 - 0.35 * smoothstep(0.55, 0.75, bump2));
    let outv = l / max(length(l), 0.0001);
    let rimw = pow(clamp(rr, 0.0, 1.0), 6.0);
    let key = rimw * max(dot(outv, lb), 0.0);
    let back = rimw * max(-dot(outv, lb), 0.0);
    let body = vec3f(0.6, 0.55, 0.5) * albedo * (0.06 + diff * 1.4)
      + vec3f(1.0, 0.85, 0.65) * key * 0.85
      + vec3f(0.35, 0.75, 1.0) * back * 0.12;
    rgb = mix(rgb, body, mask);
  }
  return rgb;
}

fn planktonNoise2(x: vec2f) -> f32 {
  let i = floor(x);
  let f = fract(x);
  let u = f * f * (3.0 - 2.0 * f);
  let a = planktonHash22(i).x;
  let b = planktonHash22(i + vec2f(1.0, 0.0)).x;
  let c = planktonHash22(i + vec2f(0.0, 1.0)).x;
  let d = planktonHash22(i + vec2f(1.0, 1.0)).x;
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn planktonHash22(p: vec2f) -> vec2f {
  var q = vec3f(p.x, p.y, p.x) * vec3f(0.1031, 0.1030, 0.0973);
  q = fract(q);
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}
`;

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'jellyfish/plankton',
    label: 'Star Plankton',
    description: 'Adds drifting bioluminescent motes with bokeh depth (aquarium) or colourful stardust and tumbling asteroids (space); highs make them sparkle.',
    tags: ['jellyfish', 'cosmic'],
    inputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image to add plankton over.',
      },
    },
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image with drifting plankton.',
      },
    },
    controls: {
      density: { type: 'number', group: 'Plankton', label: 'Density', default: 0.08, min: 0.01, max: 1, step: 0.01 },
      size: { type: 'number', group: 'Plankton', label: 'Size', default: 1, min: 0.3, max: 3, step: 0.01 },
      drift: { type: 'number', group: 'Motion', label: 'Drift speed', default: 0.25, min: 0, max: 1.5, step: 0.01 },
      sparkle: { type: 'number', group: 'Audio', label: 'Highs sparkle', default: 1, min: 0, max: 3, step: 0.01 },
      brightness: { type: 'number', group: 'Plankton', label: 'Brightness', default: 0.13, min: 0, max: 3, step: 0.01 },
      scatter: { type: 'number', group: 'Audio', label: 'Scatter', default: 1, min: 0, max: 3, step: 0.01 },
      scatterRadius: { type: 'number', group: 'Audio', label: 'Scatter radius', default: 0.45, min: 0.05, max: 1.5, step: 0.01 },
      scatterGlow: { type: 'number', group: 'Audio', label: 'Scatter glow', default: 1.5, min: 0, max: 4, step: 0.01 },
    },
    controlDescriptions: {
      density: 'How many grid cells hold a plankton mote.',
      size: 'Size of each glowing mote; near motes are also softly out of focus.',
      drift: 'How fast the motes rise and drift.',
      sparkle: 'How strongly highs make motes flash brighter.',
      brightness: 'Overall mote glow strength.',
      scatter: 'How far hi-hat surges push nearby motes outward before they resettle.',
      scatterRadius: 'Size of the area around each surge epicenter that is affected.',
      scatterGlow: 'How much motes brighten while a surge passes through them.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    const view = uniform(new Vector4(0, aspect, 0, 1));
    const shape = uniform(new Vector4(0.08, 1, 0.25, 0.13));
    const surge = [0, 1, 2, 3].map(() => uniform(new Vector4(0.5, 0.5, -1000, 0)));
    const scat = uniform(new Vector4(1, 0.45, 1.5, 0));
    const baseTex = texture(new Texture(), vec2(uv().x, uv().y.oneMinus()));
    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    // Order matches jellyPlankton(st, base, view, shape, s0, s1, s2, s3, scat).
    material.fragmentNode = (wgslFn(planktonPass) as any)(uv(), baseTex, view, shape, surge[0], surge[1], surge[2], surge[3], scat);
    const scene = new Scene();
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    let highs = 0;
    let peak = 0.0001;
    let slow = 0;
    let lastT = -1;
    let lastOnset = -10;
    let next = 0;

    let th = 0;

    return {
      update(frame) {
        th += ((jellyShared.theme ?? 0) - th) * 0.1;
        const spectrum = frame.audioSpectrum;
        let target = 0;
        if (spectrum?.available) {
          for (let i = 80; i < 120; i++) {
            target += spectrum.magnitudes[i] ?? 0;
          }
          target /= 40;
        }
        highs += (target - highs) * 0.2;

        // Hi-hat onset: bins 85-120, auto-gained against a decaying peak.
        const t = frame.timeSeconds;
        const dt = lastT < 0 || t < lastT ? 0.016 : Math.min(t - lastT, 0.25);
        lastT = t;
        if (t < lastOnset) lastOnset = -10;
        if (spectrum?.available) {
          let hi = 0;
          for (let i = 85; i < 120; i++) hi += spectrum.magnitudes[i] ?? 0;
          hi /= 35;
          peak = Math.max(hi, peak * Math.exp(-dt * 0.4), 0.0001);
          const level = hi / peak;
          if (level > slow * 1.4 && level > 0.2 && t - lastOnset > 0.08) {
            lastOnset = t;
            surge[next].value.set(Math.random(), Math.random(), t, 0.6 + 0.4 * Math.min(level, 1));
            next = (next + 1) % 4;
          }
          slow += (level - slow) * (1 - Math.exp(-dt / 0.8));
        }
        scat.value.set(frame.controls.scatter, frame.controls.scatterRadius, frame.controls.scatterGlow, th);

        view.value.set(frame.timeSeconds, aspect, Math.min(highs * 6, 1.5), frame.controls.sparkle);
        shape.value.set(
          frame.controls.density,
          frame.controls.size,
          frame.controls.drift,
          frame.controls.brightness,
        );
      },
      async evaluate(inputs, evaluation) {
        baseTex.value = inputs.image.texture as Texture;
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {
        highs = 0;
        peak = 0.0001;
        slow = 0;
        lastT = -1;
        lastOnset = -10;
        for (const s of surge) s.value.set(0.5, 0.5, -1000, 0);
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  },
});
