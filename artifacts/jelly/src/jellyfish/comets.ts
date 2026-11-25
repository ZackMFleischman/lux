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
import { uniform, uv, wgslFn, texture } from 'three/tsl';

// Beat-driven shooting stars (space) and bubble groups (aquarium). Up to 8 at once.
// Star slot:   slot = (head x in aspect space, head y with y up, direction angle, 1)
//              attr = (tail length, size multiplier, brightness * theme, 0)
// Bubble slot: slot = (origin x, origin y, size scale, 2)
//              attr = (age s, code = seed*32 + count*2 + chain, rise speed, bubble weight)
// Params: (time, aspect, mean bubble brightness, unused).
// IMPORTANT: each wgslFn uses its FIRST function as the entry point; helpers follow it.
// The three sources below must not share helper names (they all land in one shader).

// Pass 1: find the dominant bubble under this pixel -> (local x, local y, radius, weight).
const bubbleHitSrc = `
fn cometBubbleHit(st: vec2f,
  s0: vec4f, s1: vec4f, s2: vec4f, s3: vec4f, s4: vec4f, s5: vec4f, s6: vec4f, s7: vec4f,
  a0: vec4f, a1: vec4f, a2: vec4f, a3: vec4f, a4: vec4f, a5: vec4f, a6: vec4f, a7: vec4f,
  params: vec4f) -> vec4f {
  let p = vec2f(st.x * params.y, st.y);
  var best = vec4f(0.0);
  best = cometHitGroup(best, p, s0, a0);
  best = cometHitGroup(best, p, s1, a1);
  best = cometHitGroup(best, p, s2, a2);
  best = cometHitGroup(best, p, s3, a3);
  best = cometHitGroup(best, p, s4, a4);
  best = cometHitGroup(best, p, s5, a5);
  best = cometHitGroup(best, p, s6, a6);
  best = cometHitGroup(best, p, s7, a7);
  return best;
}

fn cometHitGroup(cur: vec4f, p: vec2f, slot: vec4f, attr: vec4f) -> vec4f {
  if (slot.w < 1.5 || attr.w < 0.001) {
    return cur;
  }
  let age = attr.x;
  let code = attr.y;
  let chain = code - 2.0 * floor(code * 0.5);
  let n = i32(floor(code * 0.5) - 16.0 * floor(code / 32.0));
  let seed = floor(code / 32.0);
  let spd = attr.z;
  let rmin = 0.0035 * slot.z;
  // Whole-group reject.
  let reach = spd * 1.75 * age;
  if (p.y < slot.y - 0.08 || p.y > slot.y + reach + 0.1 || abs(p.x - slot.x) > 0.11 + 0.1 * reach) {
    return cur;
  }
  var res = cur;
  var bestRR = select(9.0, length(cur.xy), cur.w > 0.0);
  for (var i = 0; i < 14; i++) {
    if (i >= n) {
      break;
    }
    let fi = f32(i);
    let h = cometHash22(vec2f(seed * 1.7 + fi * 3.1, seed * 0.37 + fi * 7.9));
    let h2 = cometHash22(vec2f(fi * 5.3 + seed, fi * 1.1 + 13.0 + seed * 2.3));
    // Power-law sizes: many tiny, a few big.
    let rn = min(pow(1.0 - h.x * 0.985, -0.6), 7.0);
    let r = rmin * rn;
    // Staggered release (or one after another for a chain stream).
    let delay = mix(h.y * 0.5, fi * 0.13 + h.y * 0.04, chain);
    let tr = age - delay;
    if (tr <= 0.0) {
      continue;
    }
    // Bigger bubbles rise faster.
    let v = spd * (0.7 + 0.3 * sqrt(rn)) * (0.9 + 0.2 * h2.x);
    let rise = v * tr;
    let cl = mix(vec2f((h2.x - 0.5) * 0.11, (h2.y - 0.5) * 0.05), vec2f((h2.x - 0.5) * 0.006, 0.0), chain);
    let drift = (fract(h.y * 7.31 + h2.x * 3.7) - 0.5) * 0.14 * (1.0 - 0.7 * chain);
    let wf = 3.0 + 4.5 * h2.y;
    let wph = h.y * 6.2831853 + h2.x * 3.0;
    let wa = (0.0015 + 0.3 * r) * (0.5 + h2.y);
    let c = vec2f(slot.x + cl.x + drift * rise + wa * sin(wf * tr + wph), slot.y + cl.y + rise);
    let q0 = (p - c) / r;
    if (dot(q0, q0) > 1.3) {
      continue;
    }
    // Shape wobble: squash and stretch with a slow tilt, stronger on big bubbles.
    let sq = min(0.02 + 1.6 * r, 0.16) * sin(wf * 1.7 * tr + wph * 1.3);
    let tilt = 0.5 * sin(wf * 0.5 * tr + wph);
    let cs = cos(tilt);
    let sn = sin(tilt);
    let qr = vec2f(q0.x * cs - q0.y * sn, q0.x * sn + q0.y * cs);
    let q = vec2f(qr.x * (1.0 - sq), qr.y * (1.0 + sq));
    let rr = length(q);
    if (rr < 1.08 && rr < bestRR) {
      bestRR = rr;
      res = vec4f(q, r, attr.w);
    }
  }
  return res;
}

fn cometHash22(p: vec2f) -> vec2f {
  var q = vec3f(p.x, p.y, p.x) * vec3f(0.1031, 0.1030, 0.0973);
  q = fract(q);
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}
`;

// Pass 2: refracted sample position. An air bubble in water is a diverging lens:
// the scene behind looks shrunk, bending hardest near the rim.
const refractSrc = `
fn cometRefractUv(st: vec2f, hit: vec4f, params: vec4f) -> vec2f {
  let rr = length(hit.xy);
  let inside = (1.0 - smoothstep(0.92, 1.02, rr)) * step(0.0001, hit.w);
  let k = (0.35 + 1.4 * rr * rr * rr) * inside * min(hit.w * 1.5, 1.0);
  let off = hit.xy * hit.z * k;
  return vec2f(st.x + off.x / params.y, 1.0 - (st.y + off.y));
}
`;

// Pass 3: composite stars and bubble shading over the (refracted) base.
const cometPass = `
fn jellyComets(st: vec2f, base: vec4f, hit: vec4f,
  s0: vec4f, s1: vec4f, s2: vec4f, s3: vec4f, s4: vec4f, s5: vec4f, s6: vec4f, s7: vec4f,
  a0: vec4f, a1: vec4f, a2: vec4f, a3: vec4f, a4: vec4f, a5: vec4f, a6: vec4f, a7: vec4f,
  params: vec4f) -> vec4f {
  let t = params.x;
  let p = vec2f(st.x * params.y, st.y);
  var add = vec3f(0.0);
  add += cometStar(p, s0, a0, t);
  add += cometStar(p, s1, a1, t);
  add += cometStar(p, s2, a2, t);
  add += cometStar(p, s3, a3, t);
  add += cometStar(p, s4, a4, t);
  add += cometStar(p, s5, a5, t);
  add += cometStar(p, s6, a6, t);
  add += cometStar(p, s7, a7, t);
  add += cometBubbleShade(hit, t) * (0.55 * params.z);
  return vec4f(base.rgb + add, 1.0);
}

fn cometBubbleShade(hit: vec4f, t: f32) -> vec3f {
  if (hit.w <= 0.0) {
    return vec3f(0.0);
  }
  let q = hit.xy;
  let rr = length(q);
  let z = sqrt(max(1.0 - rr * rr, 0.0));
  let inner = 1.0 - smoothstep(0.9, 1.02, rr);
  // Silvery Fresnel band toward the rim (total internal reflection) and a crisp edge line.
  let fres = pow(1.0 - z, 3.0);
  let edgeD = (rr - 0.975) / 0.03;
  let edgeL = exp(-edgeD * edgeD);
  // Thin film: thinner on top as it drains, swirling over time; strongest at grazing angles.
  let film = 0.9 + 0.55 * q.y + 0.25 * sin(q.x * 4.0 + t * 1.7 + hit.z * 900.0) + 0.6 * (1.0 - z);
  let irid = 0.5 + 0.5 * cos(6.2831853 * (film + vec3f(0.0, 0.33, 0.67)));
  let refl = mix(vec3f(0.78, 0.92, 1.0), irid, 0.6);
  // Window highlight top-left and a small caustic glint bottom-right.
  let hq = q - vec2f(-0.38, 0.42);
  let spec = exp(-dot(hq, hq) / 0.018) * 1.4 + exp(-dot(hq, hq) / 0.09) * 0.15;
  let hq2 = q - vec2f(0.42, -0.5);
  let spec2 = exp(-dot(hq2, hq2) / 0.01) * 0.35;
  let body = refl * (fres * inner * 0.55 + edgeL * 0.8 + inner * 0.025) + vec3f(1.0) * (spec + spec2) * inner;
  return body * hit.w;
}

fn cometStar(p: vec2f, slot: vec4f, attr: vec4f, t: f32) -> vec3f {
  if (slot.w < 0.5 || slot.w > 1.5 || attr.z <= 0.0) {
    return vec3f(0.0);
  }
  let dir = vec2f(cos(slot.z), sin(slot.z));
  let nrm = vec2f(-dir.y, dir.x);
  let d = p - slot.xy;
  let along = -dot(d, dir);
  let perp = dot(d, nrm);
  let tailLen = max(attr.x, 0.01);
  let sz = max(attr.y, 0.05);
  if (along < -0.06 * sz - 0.01 || along > tailLen + 0.02 || abs(perp) > 0.06 * sz + 0.01) {
    return vec3f(0.0);
  }

  // Tail: tapered, with red and blue offset across it for a slight colour fringe.
  let u = clamp(along / tailLen, 0.0, 1.0);
  let inTail = smoothstep(-0.002, 0.004, along) * (1.0 - smoothstep(tailLen * 0.9, tailLen, along));
  let w = mix(0.0026, 0.0005, u) * sz;
  let fr = w * 0.55;
  let tR = exp(-((perp - fr) * (perp - fr)) / (w * w));
  let tG = exp(-(perp * perp) / (w * w));
  let tB = exp(-((perp + fr) * (perp + fr)) / (w * w));
  let fall = pow(1.0 - u, 1.8) * inTail;
  let grad = mix(mix(vec3f(1.0, 0.93, 0.78), vec3f(0.5, 0.78, 1.0), smoothstep(0.0, 0.35, u)),
    vec3f(0.62, 0.48, 1.0), smoothstep(0.5, 1.0, u));
  var col = vec3f(tR, tG, tB) * grad * fall * 0.9;

  // Sparkles shed along the path: fixed in the world, twinkling, scattering wider further back.
  let sAxis = dot(p, dir) * 90.0;
  let kc = floor(sAxis);
  let hs = cometSparkHash(vec2f(kc, slot.z * 13.0));
  let sp = vec2f((sAxis - kc - 0.3 - 0.4 * hs.x) / 90.0, perp - (hs.y - 0.5) * w * 5.0 * (0.5 + u * 2.0));
  let tw = pow(0.5 + 0.5 * sin(t * (14.0 + hs.x * 20.0) + hs.y * 40.0), 3.0);
  let spark = exp(-dot(sp, sp) / 0.0000012) * tw * step(0.35, fract(hs.x * 7.7)) * inTail * pow(1.0 - u, 1.2);
  col += mix(vec3f(1.0, 0.9, 0.7), vec3f(0.6, 0.85, 1.0), u) * spark * 1.4;

  // Hot head: white core, warm bloom, small glint along and across the path.
  let hsz = sz * sz;
  let dd = dot(d, d);
  let core = exp(-dd / (0.000006 * hsz));
  let glow = exp(-dd / (0.00008 * hsz)) * 0.6 + exp(-dd / (0.0012 * hsz)) * 0.12;
  let spikeA = exp(-abs(along) / (0.02 * sz)) * exp(-(perp * perp) / (0.000001 * hsz));
  let spikeP = exp(-abs(perp) / (0.012 * sz)) * exp(-(along * along) / (0.000001 * hsz));
  col += vec3f(1.0) * core * 2.0 + vec3f(1.0, 0.9, 0.76) * glow + vec3f(0.9, 0.95, 1.0) * (spikeA + spikeP) * 0.25;

  return col * (0.55 * attr.z);
}

fn cometSparkHash(p: vec2f) -> vec2f {
  var q = vec3f(p.x, p.y, p.x) * vec3f(0.1031, 0.1030, 0.0973);
  q = fract(q);
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}
`;

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'jellyfish/comets',
    label: 'Shooting Stars',
    description: 'Adds shooting stars (space) or refracting bubble groups (aquarium) on bass and onset beats.',
    tags: ['jellyfish', 'cosmic'],
    inputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image to add shooting stars on top of.',
      },
    },
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image with beat-driven shooting stars added.',
      },
    },
    controls: {
      beatSensitivity: { type: 'number', group: 'Beats', label: 'Beat sensitivity', default: 1, min: 0.3, max: 3, step: 0.01 },
      minGap: { type: 'number', group: 'Beats', label: 'Min gap (s)', default: 0.25, min: 0, max: 3, step: 0.01 },
      idleSpawn: { type: 'number', group: 'Beats', label: 'Idle spawn (per min)', default: 0, min: 0, max: 30, step: 0.5 },
      lengthMin: { type: 'number', group: 'Stars', label: 'Length min', default: 0.12, min: 0.03, max: 1.2, step: 0.01 },
      lengthMax: { type: 'number', group: 'Stars', label: 'Length max', default: 0.55, min: 0.03, max: 1.2, step: 0.01 },
      sizeMin: { type: 'number', group: 'Stars', label: 'Size min', default: 0.6, min: 0.2, max: 4, step: 0.01 },
      sizeMax: { type: 'number', group: 'Stars', label: 'Size max', default: 2, min: 0.2, max: 4, step: 0.01 },
      brightnessMin: { type: 'number', group: 'Stars', label: 'Brightness min', default: 0.5, min: 0, max: 3, step: 0.01 },
      brightnessMax: { type: 'number', group: 'Stars', label: 'Brightness max', default: 1.6, min: 0, max: 3, step: 0.01 },
      speed: { type: 'number', group: 'Stars', label: 'Speed', default: 1, min: 0.3, max: 3, step: 0.01 },
    },
    controlDescriptions: {
      beatSensitivity: 'How easily a bass or broadband onset counts as a beat. Higher values trigger on weaker hits.',
      minGap: 'Shortest time in seconds between two beat-spawned stars.',
      idleSpawn: 'Random stars per minute with no beat. Zero turns idle stars off.',
      lengthMin: 'Shortest tail a new star can pick.',
      lengthMax: 'Longest tail a new star can pick.',
      sizeMin: 'Thinnest head and tail (or smallest bubble scale) a new spawn can pick.',
      sizeMax: 'Thickest head and tail (or largest bubble scale) a new spawn can pick.',
      brightnessMin: 'Dimmest glow a new star can pick.',
      brightnessMax: 'Brightest glow a new star can pick.',
      speed: 'How fast each star crosses the frame, or bubbles rise.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    const N = 8;
    const slots = Array.from({ length: N }, () => uniform(new Vector4(0, 0, 0, 0)));
    const attrs = Array.from({ length: N }, () => uniform(new Vector4(0.3, 1, 1, 0)));
    const params = uniform(new Vector4(0, aspect, 0.5, 0));
    const hit = (wgslFn(bubbleHitSrc) as any)(uv(), ...slots, ...attrs, params);
    const refrUv = (wgslFn(refractSrc) as any)(uv(), hit, params);
    const baseTex = (texture as any)(new Texture(), refrUv);
    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    // Order matches jellyComets(st, base, hit, s0..s7, a0..a7, params).
    material.fragmentNode = (wgslFn(cometPass) as any)(uv(), baseTex, hit, ...slots, ...attrs, params);
    const scene = new Scene();
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    type Comet = {
      bubble: boolean;
      x: number;
      y: number;
      dx: number;
      dy: number;
      len: number;
      speed: number;
      bright: number;
      life: number;
      seen: boolean;
      age: number;
    };
    const comets: (Comet | null)[] = new Array(N).fill(null);
    let lastTime = -1;
    let lastSpawn = -100;
    let nextIdle = -1;
    let bassAvg = 0;
    let fluxAvg = 0;
    let warm = 0;
    let prevMags: number[] | null = null;
    let th = 0;

    const lerp = (a: number, b: number) => a + Math.random() * (b - a);
    const order = (lo: number, hi: number): [number, number] => (lo <= hi ? [lo, hi] : [hi, lo]);

    const spawn = (now: number, c: Record<string, number>): boolean => {
      const slot = comets.indexOf(null);
      if (slot < 0) return false;
      const [l0, l1] = order(c.lengthMin, c.lengthMax);
      const [s0, s1] = order(c.sizeMin, c.sizeMax);
      const [b0, b1] = order(c.brightnessMin, c.brightnessMax);
      const len = lerp(l0, l1);
      const m = 0.03;
      if (th <= 0.5) {
        // Bubble group: count, sizes, delays and wobble are derived in the shader from a packed code.
        const chain = Math.random() < 0.15;
        const count = chain ? 8 + Math.floor(Math.random() * 7) : 2 + Math.floor(Math.pow(Math.random(), 1.6) * 13);
        const seed = Math.floor(Math.random() * 100);
        const rise = 0.45 * c.speed * lerp(0.85, 1.15);
        const oy = -0.06;
        const maxDelay = chain ? count * 0.13 + 0.05 : 0.5;
        comets[slot] = {
          bubble: true,
          x: lerp(0.08, aspect - 0.08),
          y: oy,
          dx: 0,
          dy: 1,
          len,
          speed: rise,
          bright: 1,
          life: maxDelay + (1.25 - oy) / (rise * 0.9 * 0.7) + 0.5,
          seen: false,
          age: 0,
        };
        const k = comets[slot]!;
        slots[slot].value.set(k.x, oy, 0.6 + 0.6 * lerp(s0, s1), 2);
        attrs[slot].value.set(0, seed * 32 + count * 2 + (chain ? 1 : 0), rise, 1 - th);
      } else {
        // Diagonal heading, y up. Enter from the top edge or from a side edge high in the frame.
        const down = 0.3 + Math.random() * 0.75;
        const goingRight = Math.random() < 0.5;
        const angle = goingRight ? -down : Math.PI + down;
        let x: number;
        let y: number;
        if (Math.random() < 0.6) {
          x = goingRight ? lerp(-0.1, aspect * 0.7) : lerp(aspect * 0.3, aspect + 0.1);
          y = 1 + m;
        } else {
          x = goingRight ? -m : aspect + m;
          y = lerp(0.55, 1);
        }
        comets[slot] = {
          bubble: false,
          x,
          y,
          dx: Math.cos(angle),
          dy: Math.sin(angle),
          len,
          speed: 0.9 * c.speed * lerp(0.8, 1.25),
          bright: lerp(b0, b1),
          life: 20,
          seen: false,
          age: 0,
        };
        attrs[slot].value.set(len, lerp(s0, s1), comets[slot]!.bright * th, 0);
      }
      lastSpawn = now;
      return true;
    };

    // True when any part of the star (head to tail end, plus glow margin) is inside the frame.
    const onScreen = (k: Comet): boolean => {
      const pad = 0.04;
      for (let i = 0; i <= 12; i++) {
        const t = (i / 12) * k.len;
        const px = k.x - k.dx * t;
        const py = k.y - k.dy * t;
        if (px > -pad && px < aspect + pad && py > -pad && py < 1 + pad) return true;
      }
      return false;
    };

    const clear = () => {
      comets.fill(null);
      for (let s = 0; s < N; s++) slots[s].value.set(0, 0, 0, 0);
      lastSpawn = -100;
      nextIdle = -1;
      bassAvg = 0;
      fluxAvg = 0;
      warm = 0;
      prevMags = null;
    };

    return {
      update(frame) {
        th += ((jellyShared.theme ?? 0) - th) * 0.1;
        const now = frame.timeSeconds;
        if (lastTime < 0 || now < lastTime) clear();
        const dt = Math.min(Math.max(now - lastTime, 0), 0.1);
        lastTime = now;
        const c = frame.controls as unknown as Record<string, number>;

        // Beat detection: bass (bins 6..24) or broadband flux against a slow average.
        const spectrum = frame.audioSpectrum;
        if (spectrum?.available) {
          const mags = spectrum.magnitudes;
          let bass = 0;
          for (let i = 6; i <= 24; i++) bass += mags[i] ?? 0;
          bass /= 19;
          let flux = 0;
          if (prevMags) {
            for (let i = 1; i <= 120; i++) flux += Math.max(0, (mags[i] ?? 0) - prevMags[i]);
            flux /= 120;
          }
          prevMags = Array.from({ length: 121 }, (_, i) => mags[i] ?? 0);
          const sens = Math.max(c.beatSensitivity, 0.05);
          const thr = 1 + 0.6 / sens;
          warm += dt;
          const bassHit = bassAvg > 1e-5 && bass > bassAvg * thr;
          const fluxHit = fluxAvg > 1e-6 && flux > fluxAvg * (thr + 0.4);
          if (warm > 0.5 && (bassHit || fluxHit) && now - lastSpawn >= c.minGap) {
            spawn(now, c);
          }
          const a = 1 - Math.exp(-dt / 1.2);
          bassAvg += (bass - bassAvg) * a;
          fluxAvg += (flux - fluxAvg) * a;
        }

        if (c.idleSpawn > 0) {
          if (nextIdle < 0) nextIdle = now + (Math.random() * 60) / c.idleSpawn;
          if (now >= nextIdle) {
            spawn(now, c);
            nextIdle = now + (60 / c.idleSpawn) * lerp(0.5, 1.5);
          }
        } else {
          nextIdle = -1;
        }

        for (let s = 0; s < N; s++) {
          const k = comets[s];
          if (!k) {
            slots[s].value.w = 0;
            continue;
          }
          k.age += dt;
          if (k.bubble) {
            // Bubbles move in the shader from their age; fade them out if the theme turns to space.
            attrs[s].value.x = k.age;
            attrs[s].value.w = 1 - th;
            if (k.age > k.life || th > 0.995) {
              comets[s] = null;
              slots[s].value.w = 0;
            }
            continue;
          }
          k.x += k.dx * k.speed * dt;
          k.y += k.dy * k.speed * dt;
          attrs[s].value.z = k.bright * th;
          const vis = onScreen(k);
          if (vis) k.seen = true;
          if ((k.seen && !vis) || k.age > k.life || th < 0.005) {
            comets[s] = null;
            slots[s].value.w = 0;
            continue;
          }
          slots[s].value.set(k.x, k.y, Math.atan2(k.dy, k.dx), 1);
        }

        params.value.set(now % 1000, aspect, 0.5 * (c.brightnessMin + c.brightnessMax), 0);
      },
      async evaluate(inputs, evaluation) {
        baseTex.value = inputs.image.texture as Texture;
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {
        clear();
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  },
});
