import { defineComponent } from '@lux/visual-sdk';
import {
  Scene,
  Mesh,
  PlaneGeometry,
  MeshBasicNodeMaterial,
  OrthographicCamera,
  Vector4,
  Texture,
  DataTexture,
  RGBAFormat,
  FloatType,
  UnsignedByteType,
  NearestFilter,
} from 'three/webgpu';
import { uniform, uv, wgslFn, texture, vec2 } from 'three/tsl';
import { jellyShared } from './jelly-shared.ts';
import { pilotPixels } from './pilot-pixels.ts';

// Small glowing fish that wander, hide in jelly tentacles and dart away.
// Theme (jellyShared.theme, 0 aquarium -> 1 space) morphs each fish into a DJ hippo alien in a flying saucer
// that hovers near the comet coma or tail instead of hiding in tentacles. Behavior is otherwise the same.
// Per-fish data texture (12 x 14): row 0 = (x, y, heading, speed), row 1 = (hide, tailPhase, hueVar, wake),
// rows 2..13 = tail-root history (x, y, age seconds, valid), newest first, sampled every 0.05 s.
// The entry fn MUST stay first in this string.
const fishPass = `
fn jellyFish(st: vec2f, base: vec4f, view: vec4f, look: vec4f, look2: vec4f, space: vec4f, mom: vec4f, mom2: vec4f, mom3: vec4f, data: texture_2d<f32>, pilot: texture_2d<f32>) -> vec4f {
  // view = (time, aspect, count, tailWiggle); look = (glow, hue, wakeLength, bandWidth);
  // look2 = (outline, finSize, hueVariety, wake); space = (theme, 0, 0, 0).
  // mom, mom2, mom3 = mothership over the hero jelly (see motherShip).
  // Row 14 of the data texture holds per-fish size. pilot = 192 px hippo sprite, raw sRGB bytes, row 0 = top.
  let aspect = view.y;
  let p = (st - vec2f(0.5, 0.42)) * vec2f(aspect, 1.0) * 2.0;
  // Pixel size in screen units, taken in uniform control flow before any loop.
  let px = max(length(fwidth(p)) * 0.7071, 0.00001);
  let n = i32(view.z);
  let lifeT = 0.6 * max(look.z, 0.05);
  let th = clamp(space.x, 0.0, 1.0);
  // Stage where the hull grows; the wake turns into an ion trail with it.
  let s2 = smoothstep(0.2, 0.7, th);
  // Screen-space twinkle field for the ion sparkles, re-rolled 16 times a second.
  let tick = floor(fract(view.x * 0.25) * 64.0);
  let spark = smoothstep(0.86, 1.0, hash21(floor(p * 150.0) + vec2f(tick * 37.0, tick * 11.0)));
  var col = base.rgb;
  // Mothership first, under the wakes and the small craft so they pass in front of it.
  if (mom2.x > 0.001) {
    let ms = motherShip(p, mom, mom2, mom3, look, view, px, pilot);
    col = col * (1.0 - ms.a) + ms.rgb;
  }
  // Wakes next, under the fish: polyline through the recorded tail-root history.
  if (look2.w > 0.001) {
    for (var i = 0; i < 40; i++) {
      if (i >= n) {
        break;
      }
      let a = textureLoad(data, vec2i(i, 0), 0);
      let b = textureLoad(data, vec2i(i, 1), 0);
      let size = max(textureLoad(data, vec2i(i, 14), 0).x, 0.001);
      // In space the exhaust also shows while cruising, not only when darting.
      let strength = look2.w * ((0.12 + 0.18 * s2) * clamp(a.w, 0.0, 2.0) + 0.55 * b.w) * mix(1.0, 0.5, b.x);
      if (strength < 0.001) {
        continue;
      }
      let rt = a.xy - vec2f(cos(a.z), sin(a.z)) * size * 1.1;
      var prev = rt;
      var prevAge = 0.0;
      var g = 0.0;
      for (var k = 0; k < 12; k++) {
        let h = textureLoad(data, vec2i(i, 2 + k), 0);
        if (h.w < 0.5) {
          break;
        }
        g += wakeSeg(p, prev, h.xy, prevAge, h.z, size, px, lifeT);
        prev = h.xy;
        prevAge = h.z;
      }
      let fishTc = mix(fishOrange(look.y, b.z, look2.z), vec3f(1.0, 0.9, 0.75), 0.35);
      let ionTc = mix(ringColor(look.y, b.z, look2.z), vec3f(0.7, 0.85, 1.0), 0.35);
      let tc = mix(fishTc, ionTc, s2);
      col += tc * g * strength * mix(1.0, 0.5 + 3.5 * spark, s2);
    }
  }
  for (var i = 0; i < 40; i++) {
    if (i >= n) {
      break;
    }
    let a = textureLoad(data, vec2i(i, 0), 0);
    let b = textureLoad(data, vec2i(i, 1), 0);
    let size = max(textureLoad(data, vec2i(i, 14), 0).x, 0.001);
    let dv = p - a.xy;
    // Whole fish (tail, fins, wiggle, glow) fits inside 2.6 body units (more with big fins).
    // The saucer, its halo and tractor beam fit inside 2.7 units of the grown hull.
    if (length(dv) > size * max(2.6 * max(1.0, look2.y), 2.7 * s2)) {
      continue;
    }
    let f = craftShape(dv, a, b, size, look, look2, view, th, px, pilot);
    col = col * (1.0 - f.a) + f.rgb;
  }
  return vec4f(col, 1.0);
}

fn hueShift(c: vec3f, ang: f32) -> vec3f {
  let k = vec3f(0.57735);
  let ca = cos(ang);
  return c * ca + cross(k, c) * sin(ang) + k * dot(k, c) * (1.0 - ca);
}

fn fishOrange(hue: f32, v: f32, hv: f32) -> vec3f {
  return max(hueShift(vec3f(1.0, 0.42, 0.04), (hue - 0.08) * 6.2831853 + (v - 0.5) * 0.2 * hv), vec3f(0.0));
}

// Saucer light-ring color: the stripe light, moved with the same Hue shift and Hue variety controls.
fn ringColor(hue: f32, v: f32, hv: f32) -> vec3f {
  return max(hueShift(vec3f(0.25, 1.0, 0.82), (hue - 0.08) * 6.2831853 + (v - 0.5) * 0.6 * hv), vec3f(0.0));
}

fn hash21(q: vec2f) -> f32 {
  return fract(sin(dot(q, vec2f(127.1, 311.7))) * 43758.5453);
}

// Premultiplied "top over under".
fn overC(top: vec4f, under: vec4f) -> vec4f {
  return top + under * (1.0 - top.a);
}

fn pilotTap(pilot: texture_2d<f32>, ij: vec2i) -> vec4f {
  let c = textureLoad(pilot, ij, 0);
  // Raw sRGB bytes with straight alpha: decode to linear, then premultiply before filtering.
  let lin = pow(max(c.rgb, vec3f(0.0)), vec3f(2.2));
  return vec4f(lin * c.a, c.a);
}

// Manual bilinear sample (no sampler needed, safe in non-uniform control flow). st.y = 0 is the sprite top.
fn pilotTexel(pilot: texture_2d<f32>, st: vec2f) -> vec4f {
  return pilotTexelSharp(pilot, st, 1.0);
}

// As pilotTexel; k = screen pixels per sprite texel. Above 1 the blend narrows to about one screen pixel,
// so a magnified sprite keeps crisp pixel edges.
fn pilotTexelSharp(pilot: texture_2d<f32>, st: vec2f, k: f32) -> vec4f {
  if (st.x <= 0.0 || st.x >= 1.0 || st.y <= 0.0 || st.y >= 1.0) {
    return vec4f(0.0);
  }
  let dims = vec2i(textureDimensions(pilot, 0));
  let fp = st * vec2f(dims) - 0.5;
  let fl = floor(fp);
  let fr = clamp((fp - fl - 0.5) * max(k, 1.0) + 0.5, vec2f(0.0), vec2f(1.0));
  let hi = dims - vec2i(1);
  let i0 = clamp(vec2i(fl), vec2i(0), hi);
  let i1 = clamp(vec2i(fl) + vec2i(1), vec2i(0), hi);
  let c00 = pilotTap(pilot, i0);
  let c10 = pilotTap(pilot, vec2i(i1.x, i0.y));
  let c01 = pilotTap(pilot, vec2i(i0.x, i1.y));
  let c11 = pilotTap(pilot, i1);
  return mix(mix(c00, c10, fr.x), mix(c01, c11, fr.x), fr.y);
}

// Fish -> saucer morph. Stages: s1 squash + stripe flash, s2 hull grows from the fish centre while the fish
// shrinks into the dome, s3 the hippo pilot replaces the fish. At theme 0 this is exactly the plain fish.
fn craftShape(dv: vec2f, a: vec4f, b: vec4f, size: f32, look: vec4f, look2: vec4f, view: vec4f, th: f32, px: f32, pilot: texture_2d<f32>) -> vec4f {
  let s1 = smoothstep(0.0, 0.35, th);
  let s2 = smoothstep(0.2, 0.7, th);
  let s3 = smoothstep(0.55, 0.95, th);
  // Stripes flash brightest just as the hull starts to grow, then hand their light to the ring.
  let flash = smoothstep(0.08, 0.3, th) * (1.0 - smoothstep(0.4, 0.65, th));
  let t = view.x;
  let wig = view.w;
  let spd = clamp(a.w, 0.0, 2.0);
  let rc = ringColor(look.y, b.z, look2.z);
  // Saucer pose: banks into its travel direction; tail wiggle becomes a wobble.
  // The craft is centred exactly on the fish's sim position (no extra offset); it only rotates in place.
  let wob = sin(b.y * 0.35) * (0.04 + 0.05 * spd) * wig;
  let bank = -cos(a.z) * 0.16 * min(spd, 1.5) + wob;
  let cb = cos(bank);
  let sb = sin(bank);
  // Dome centre relative to the craft centre: the fish slides up into it while it shrinks.
  let domeW = vec2f(-sb * 0.4, cb * 0.4) * size * s2;
  let fSize = size * mix(1.0, 0.28, s2);

  var fishL = vec4f(0.0);
  if (s3 < 0.999) {
    let morph = vec4f(mix(1.0, 0.62, s1), flash, mix(1.0, 1.15, s1), 0.0);
    fishL = fishShape(dv - domeW, a, b, fSize, look, look2, wig * (1.0 - s2), t, px / fSize, morph, rc) * (1.0 - s3);
  }
  if (s2 < 0.001) {
    return fishL;
  }

  let hs = size * s2;
  let w = dv;
  // Saucer frame (unrotated by bank), in grown-hull units. Clamp AA so a tiny hull never smears.
  let u = vec2f(cb * w.x + sb * w.y, -sb * w.x + cb * w.y) / hs;
  let aa = min(px / hs, 0.06);
  let dim = mix(1.0, 0.8, b.x);
  let dark = vec3f(0.03, 0.03, 0.05);
  var acc = vec4f(0.0);

  // 1. Shimmering tractor beam with rising motes while the craft hovers at a comet (additive).
  let hideK = b.x * s3;
  if (hideK > 0.001) {
    let by = -(u.y + 0.26);
    if (by > 0.0) {
      let halfW = 0.28 + by * 0.3;
      let edge = 1.0 - smoothstep(halfW * 0.55, halfW, abs(u.x));
      let fall = 1.0 - smoothstep(0.1, 2.1, by);
      let rings = 0.65 + 0.35 * sin(by * 16.0 - t * 8.0);
      let shimmer = 0.75 + 0.25 * sin(u.x * 31.0 / halfW + t * 13.0) * sin(by * 9.0 - t * 5.0);
      let core = exp(-u.x * u.x / (halfW * halfW * 0.12));
      // Motes drift up into the hull: at most one per jittered cell.
      let mc = vec2f(u.x / 0.14, (by + t * 0.6) / 0.14);
      let mid = floor(mc);
      let mh = hash21(mid + vec2f(b.z * 91.0, 0.0));
      let mpos = vec2f(hash21(mid + vec2f(3.1, 7.7)), fract(mh * 13.0)) * 0.7 + 0.15;
      let md = length(fract(mc) - mpos) * 0.14;
      let mote = step(0.55, mh) * exp(-md * md / 0.0003) * (0.6 + 0.4 * sin(t * 9.0 + mh * 40.0));
      let bc = mix(rc, vec3f(0.75, 1.0, 0.9), 0.4);
      let beamL = edge * fall * ((rings * 0.22 + core * 0.18) * shimmer + mote * 0.9);
      acc = vec4f(bc * beamL * hideK, 0.0);
    }
  }

  // 2. Dome cavity behind the pilot, lit from below by the console.
  let dc = u - vec2f(0.0, 0.1);
  let dDome = sdEll(dc, vec2f(0.6, 0.66));
  let domeM = 1.0 - smoothstep(-aa, aa, dDome);
  let dr = length(dc / vec2f(0.6, 0.66));
  let cavity = vec3f(0.02, 0.04, 0.06) + rc * 0.12 * (1.0 - smoothstep(0.1, 0.5, u.y));
  acc = overC(vec4f(cavity, 1.0) * domeM * 0.5, acc);

  // 3. The shrinking fish, then the DJ hippo pilot fading in. The pilot grooves and faces its travel direction.
  acc = overC(fishL, acc);
  if (s3 > 0.001) {
    // Glass refraction: magnify toward the dome centre, compress toward its rim.
    let ru = vec2f(0.0, 0.1) + dc * (0.9 + 0.14 * dr * dr);
    let groove = abs(sin(t * 4.2 + b.z * 9.0)) * 0.035;
    var sq = (ru - vec2f(0.0, 0.4 + groove)) / 0.68;
    if (cos(a.z) < 0.0) {
      sq.x = -sq.x;
    }
    let pc = pilotTexel(pilot, vec2f(sq.x + 0.5, 0.5 - sq.y));
    // Lighting: warm key from the upper left, ring-colored underglow from the console, glowing alpha fringe.
    let key = 0.95 + 0.35 * clamp(0.5 + sq.y * 0.8 - sq.x * 0.5, 0.0, 1.0);
    let under = 1.0 - smoothstep(-0.45, -0.1, sq.y);
    let fringe = clamp(pc.a * (1.0 - pc.a) * 4.0, 0.0, 1.0);
    let lit = pc.rgb * key * dim + rc * (0.35 * under * pc.a + 0.5 * fringe);
    let inDome = 1.0 - smoothstep(-aa, aa, dDome + 0.015);
    acc = overC(vec4f(lit, pc.a) * inDome * s3, acc);
  }

  // 4. Glass dome: fresnel edge, chromatic rim fringe, curved highlight, specular dot, ring reflection.
  let fres = smoothstep(0.55, 1.0, dr);
  let hlE = (dr - 0.8) / 0.06;
  let hl = exp(-hlE * hlE) * smoothstep(0.0, 0.35, (u.y - 0.1) - u.x * 0.6) * smoothstep(0.1, 0.3, u.y);
  let sdot = length(u - vec2f(-0.24, 0.52));
  let spec = exp(-sdot * sdot / 0.0012);
  let rflE = (u.y - 0.2) / 0.04;
  let rfl = exp(-rflE * rflE) * (1.0 - smoothstep(0.3, 0.55, abs(u.x)));
  let glassC = mix(vec3f(0.6, 1.0, 0.95), rc, 0.3) * (0.08 + 0.35 * fres) + vec3f(1.0) * (0.5 * hl + 0.9 * spec)
    + vec3f(0.3, 0.0, 0.4) * smoothstep(0.85, 1.0, dr) * 0.3 + rc * rfl * 0.3;
  let glassA = (0.08 + 0.35 * fres + 0.5 * hl + 0.9 * spec) * domeM;
  acc = overC(vec4f(glassC * domeM, glassA * 0.6), acc);

  // 5. Chrome hull: wide upper disc and a smaller belly.
  let dUp = sdEll(u - vec2f(0.0, -0.06), vec2f(1.3, 0.24));
  let dLo = sdEll(u - vec2f(0.0, -0.2), vec2f(0.78, 0.2));
  let dHull = sminF(dUp, dLo, 0.08);
  let hullM = 1.0 - smoothstep(-aa, aa, dHull);
  // Fake environment reflection: the ellipse normal mirrors a sky / horizon / ground gradient.
  // Belly normals only where the upper disc does not cover it.
  let belly = smoothstep(-0.02, 0.02, dUp);
  let ny = mix(clamp((u.y + 0.06) / 0.24, -1.0, 1.0), clamp((u.y + 0.2) / 0.2, -1.0, 1.0), belly);
  let nx = u.x / mix(1.3, 0.78, belly);
  let r = ny - 0.25 * nx * nx + 0.05;
  let sky = mix(vec3f(0.75, 0.85, 1.0), vec3f(0.18, 0.22, 0.38), smoothstep(0.05, 0.9, r));
  let ground = mix(vec3f(0.12, 0.09, 0.14), vec3f(0.03, 0.03, 0.05), smoothstep(0.05, 0.8, -r));
  var hc = mix(ground, sky, smoothstep(-0.02, 0.02, r));
  let hzE = r / 0.025;
  hc += vec3f(1.0) * exp(-hzE * hzE) * 0.6;
  hc += rc * 0.25 * smoothstep(0.0, 0.6, -r);
  // Specular streak, hot spot and a slow glint sweeping across the chrome.
  let stX = (u.x + 0.5) / 0.28;
  let stY = (u.y - 0.06) / 0.03;
  hc += vec3f(1.0, 0.98, 0.95) * exp(-stX * stX - stY * stY) * 1.2;
  let spX = (u.x + 0.55) / 0.08;
  let spY = (u.y - 0.06) / 0.04;
  hc += vec3f(1.0) * exp(-spX * spX - spY * spY) * 0.9;
  let gx = fract(t * 0.12 + b.z) * 4.0 - 2.0;
  let glE = (u.x - gx + u.y * 0.6) / 0.06;
  hc += vec3f(0.9, 0.95, 1.0) * exp(-glE * glE) * 0.5;
  hc = mix(hc, hc * (rc * 0.6 + 0.4), 0.15);
  hc += rc * 0.3 * smoothstep(-0.12, 0.0, dHull) * look.x;
  let ol = 0.03 * look2.x;
  hc = mix(hc, dark, smoothstep(-ol - aa, -ol + aa, dHull) * 0.7);
  acc = overC(vec4f(hc * dim, 1.0) * hullM, acc);

  // 6. Rim light ring around the widest edge (the stripes' light ends up here), back arc dimmer, with bloom.
  let rq = u - vec2f(0.0, -0.08);
  let dRing = abs(sdEll(rq, vec2f(1.18, 0.12))) - 0.022;
  let ringK = (1.0 - smoothstep(-aa, aa, dRing)) * hullM * mix(0.45, 1.0, step(rq.y, 0.0));
  let ringBloom = exp(-max(dRing, 0.0) / 0.05) * 0.22;
  acc += vec4f(mix(rc, vec3f(1.0), 0.35) * (ringK + ringBloom) * (1.0 + 2.5 * flash) * dim, 0.0);
  // Colored lights along the front arc, blinking in a chase sequence, with bloom and a horizontal flare.
  for (var k = 0; k < 8; k++) {
    let fk = f32(k);
    let ang = 3.1415927 * (1.0 + (fk + 0.5) / 8.0);
    let lv = rq - vec2f(cos(ang) * 1.18, sin(ang) * 0.12);
    let dl = length(lv);
    let pulse = exp(-fract(t * 1.4 - fk / 8.0 + b.z) * 5.0);
    let lc = max(hueShift(vec3f(1.0, 0.2, 0.3), fk * 0.785 + t * 0.6), vec3f(0.0));
    let lcore = (1.0 - smoothstep(0.035, 0.035 + aa, dl)) * (0.35 + 1.8 * pulse);
    let bloom = (exp(-dl * dl / 0.003) * 0.8 + exp(-dl * dl / 0.03) * 0.25) * pulse;
    let flare = exp(-lv.y * lv.y / 0.00008 - lv.x * lv.x / 0.03) * 0.4 * pulse;
    acc += vec4f(lc * (lcore + bloom + flare) * s3, 0.0);
  }

  // 7. Soft halo around the craft, fading before the cull radius.
  let gd = max(min(dHull, dDome), 0.0);
  let fade = 1.0 - smoothstep(1.9, 2.5, length(u));
  let glow = exp(-gd * 5.0) * 0.3 * look.x * dim * fade * (1.0 - clamp(acc.a, 0.0, 1.0)) * s2;
  acc += vec4f(mix(rc, vec3f(1.0), 0.3) * glow, 0.0);
  return acc;
}

// Mothership that replaces the hero jelly in space. mom = (x, y, hull half-width R, bank);
// mom2 = (materialize 0..1, glow, beam, spin angle); mom3 = (beat pulse, beam pulse, facing sign, 0).
// Hull units: main disc half-width 1, +y up. Warp-in: a light line grows sideways and opens vertically into a
// shimmering hull, then the dome and running lights come on. Returns premultiplied color.
fn motherShip(p: vec2f, mom: vec4f, mom2: vec4f, mom3: vec4f, look: vec4f, view: vec4f, px: f32, pilot: texture_2d<f32>) -> vec4f {
  let R = max(mom.z, 0.0001);
  let w = p - mom.xy;
  // Hull, halo and beam fit in this box (bank included).
  if (abs(w.x) > R * 2.6 || w.y > R * 1.7 || w.y < -R * 4.6) {
    return vec4f(0.0);
  }
  let m = mom2.x;
  let t = view.x;
  let cb = cos(mom.w);
  let sb = sin(mom.w);
  var u = vec2f(cb * w.x + sb * w.y, -sb * w.x + cb * w.y) / R;
  let aa = min(px / R, 0.05);
  let rc = ringColor(look.y, 0.5, 0.0);
  let lineW = smoothstep(0.0, 0.25, m);
  let opening = smoothstep(0.18, 0.62, m);
  let shim = 1.0 - smoothstep(0.5, 0.9, m);
  let litK = smoothstep(0.68, 1.0, m);
  // Hologram glitch: rows shear sideways while the hull forms.
  u.x += sin(u.y * 70.0 + t * 37.0) * sin(u.y * 13.0 - t * 11.0) * 0.025 * shim * opening;
  let cy = 0.12;
  let dy = abs(u.y - cy);
  let H = opening * 0.78;
  let reveal = (1.0 - smoothstep(H - 0.03, H + aa, dy)) * smoothstep(0.0, 0.04, opening);
  var acc = vec4f(0.0);

  // 1. Big soft tractor beam: rising rings, motes, and a bass wave sucked up into the hull (additive).
  let bK = mom2.z * litK;
  if (bK > 0.001) {
    let by = -(u.y + 0.33);
    if (by > 0.0) {
      let halfW = 0.24 + by * 0.32;
      let ax = abs(u.x) / halfW;
      let edge = 1.0 - smoothstep(0.55, 1.0, ax);
      let fall = 1.0 - smoothstep(0.4, 3.8, by);
      let pulse = 0.55 + 0.9 * mom3.y;
      let rings = 0.6 + 0.4 * sin(by * 9.0 + t * 5.0);
      let shimmer = 0.8 + 0.2 * sin(u.x / halfW * 25.0 + t * 11.0) * sin(by * 7.0 - t * 4.0);
      let core = exp(-ax * ax * 5.0);
      let mc = vec2f(u.x / 0.12, (by + t * 0.5) / 0.12);
      let mid = floor(mc);
      let mh = hash21(mid + vec2f(17.0, 0.0));
      let mpos = vec2f(hash21(mid + vec2f(3.1, 7.7)), fract(mh * 13.0)) * 0.7 + 0.15;
      let md = length(fract(mc) - mpos) * 0.12;
      let mote = step(0.6, mh) * exp(-md * md / 0.0004) * (0.6 + 0.4 * sin(t * 9.0 + mh * 40.0));
      let wv = (by - 3.4 * mom3.x) / 0.12;
      let wave = exp(-wv * wv) * mom3.x * 0.7;
      let bc = mix(rc, vec3f(0.75, 1.0, 0.9), 0.45);
      let beamL = edge * fall * ((rings * 0.16 + core * 0.2) * shimmer * pulse + mote * 0.8 + wave);
      acc = vec4f(bc * beamL * bK, 0.0);
    }
  }

  // 2. Hull, built on its own so the warp can reveal and shimmer it as one piece.
  var hull = vec4f(0.0);
  let dc = u - vec2f(0.0, 0.2);
  let dDome = sdEll(dc, vec2f(0.5, 0.48));
  let domeM = 1.0 - smoothstep(-aa, aa, dDome);
  let dr = length(dc / vec2f(0.5, 0.48));
  if (domeM > 0.001) {
    // Dome cavity, lit from below by the console once the lights come on.
    let cavity = vec3f(0.02, 0.035, 0.06) + rc * (0.05 + 0.25 * litK) * (1.0 - smoothstep(0.15, 0.55, u.y));
    hull = vec4f(cavity, 1.0) * domeM * 0.6;
    // DJ hippo pilot: larger and crisp, grooving, jumping on bass onsets, facing the travel direction.
    if (litK > 0.001) {
      let ru = vec2f(0.0, 0.2) + dc * (0.94 + 0.08 * dr * dr);
      let beat = mom3.x;
      let bob = beat * 0.05 + abs(sin(t * 4.2)) * 0.012;
      let S = 0.5;
      var sq = (ru - vec2f(sin(t * 2.1) * 0.012, 0.41 + bob)) / vec2f(S * (1.0 - 0.03 * beat), S * (1.0 + 0.05 * beat));
      if (mom3.z < 0.0) {
        sq.x = -sq.x;
      }
      let pc = pilotTexelSharp(pilot, vec2f(sq.x + 0.5, 0.5 - sq.y), S * R / (192.0 * px));
      let key = 0.95 + 0.35 * clamp(0.5 + sq.y * 0.8 - sq.x * 0.5, 0.0, 1.0);
      let under = 1.0 - smoothstep(-0.45, -0.1, sq.y);
      let fringe = clamp(pc.a * (1.0 - pc.a) * 4.0, 0.0, 1.0);
      let pl = pc.rgb * key + rc * (0.35 * under * pc.a + 0.5 * fringe);
      let inDome = 1.0 - smoothstep(-aa, aa, dDome + 0.012);
      hull = overC(vec4f(pl, pc.a) * inDome * litK, hull);
    }
    // Glass: fresnel edge, curved highlight, specular dot, inner glow when lit.
    let fres = smoothstep(0.55, 1.0, dr);
    let hlE = (dr - 0.82) / 0.05;
    let hl = exp(-hlE * hlE) * smoothstep(0.0, 0.3, (u.y - 0.2) - u.x * 0.6) * smoothstep(0.2, 0.36, u.y);
    let sdot = length(u - vec2f(-0.19, 0.52));
    let spec = exp(-sdot * sdot / 0.0008);
    let glassC = mix(vec3f(0.6, 1.0, 0.95), rc, 0.3) * (0.08 + 0.35 * fres) + vec3f(1.0) * (0.5 * hl + 0.9 * spec)
      + vec3f(0.3, 0.0, 0.4) * smoothstep(0.85, 1.0, dr) * 0.3 + rc * 0.15 * litK * (1.0 - dr);
    let glassA = (0.08 + 0.35 * fres + 0.5 * hl + 0.9 * spec) * domeM;
    hull = overC(vec4f(glassC * domeM, glassA * 0.6), hull);
  }
  // Tiers, bottom to top: beam emitter plate, belly with docking bays, light band, main disc, crown.
  hull = overC(motherTier(u, vec2f(0.0, -0.3), vec2f(0.32, 0.05), aa, rc, 0.5, 0.0), hull);
  hull = overC(motherTier(u, vec2f(0.0, -0.19), vec2f(0.58, 0.13), aa, rc, 0.8, 10.0), hull);
  hull = overC(motherTier(u, vec2f(0.0, -0.08), vec2f(0.9, 0.09), aa, rc, 0.55, 0.0), hull);
  hull = overC(motherTier(u, vec2f(0.0, 0.02), vec2f(1.0, 0.11), aa, rc, 1.0, 18.0), hull);
  hull = overC(motherTier(u, vec2f(0.0, 0.13), vec2f(0.66, 0.12), aa, rc, 0.9, 12.0), hull);
  // Warp reveal with hologram shimmer: flickering noise, scanlines and a ring-colored tint that settle.
  let tick = floor(t * 24.0);
  let nz = hash21(floor(vec2f(u.x * 18.0, u.y * 90.0)) + vec2f(tick * 7.0, tick * 3.0));
  let scan = 0.8 + 0.2 * sin(u.y / max(aa, 0.0005) * 2.1);
  let shA = reveal * mix(1.0, (0.35 + 0.65 * nz) * scan, shim * 0.85);
  let hv = hull * shA;
  acc = overC(vec4f(hv.rgb + rc * hull.a * reveal * shim * (0.25 + 0.35 * nz), hv.a), acc);

  // 3. Lights (additive): band strip, rotating band lights, spinning underside ring, docking bays, dome lights.
  let em = litK * reveal;
  if (em > 0.001 && abs(u.x) < 1.35 && u.y > -0.6 && u.y < 0.6) {
    let gk = mom2.y;
    var e = vec3f(0.0);
    let bq = (u - vec2f(0.0, -0.08)) / vec2f(0.9, 0.09);
    let bandIn = 1.0 - smoothstep(-aa, aa, sdEll(u - vec2f(0.0, -0.08), vec2f(0.9, 0.09)));
    e += rc * 0.3 * exp(-(bq.y + 0.45) * (bq.y + 0.45) / 0.05) * bandIn;
    for (var k = 0; k < 18; k++) {
      let fk = f32(k);
      let a = -2.0 * mom2.w + fk * 0.34906585;
      let sa = sin(a);
      let facing = 1.0 - smoothstep(-0.35, 0.05, sa);
      if (facing < 0.001) {
        continue;
      }
      let lv = u - vec2f(0.88 * cos(a), -0.085 + 0.075 * sa);
      let dl = length(lv);
      let pulse = 0.55 + 0.45 * sin(t * 6.0 - fk * 1.3);
      let lc = max(hueShift(vec3f(1.0, 0.25, 0.35), fk * 0.7 + t * 0.4), vec3f(0.0));
      let lcore = 1.0 - smoothstep(0.026, 0.026 + aa, dl);
      let bloom = (exp(-dl * dl / 0.002) * 0.7 + exp(-dl * dl / 0.02) * 0.2) * gk;
      let flare = exp(-lv.y * lv.y / 0.00006 - lv.x * lv.x / 0.02) * 0.3 * gk;
      e += lc * (lcore * (0.6 + 1.2 * pulse) + (bloom + flare) * pulse) * facing;
    }
    let uq = u - vec2f(0.0, -0.3);
    let dU = abs(sdEll(uq, vec2f(0.3, 0.045))) - 0.008;
    let lowArc = 1.0 - smoothstep(-0.01, 0.01, uq.y);
    e += rc * ((1.0 - smoothstep(-aa, aa, dU)) * 0.6 + exp(-max(dU, 0.0) / 0.03) * 0.25 * gk) * lowArc * (0.7 + 0.6 * mom3.y);
    let srcE = length(uq / vec2f(0.25, 0.07));
    e += mix(rc, vec3f(1.0), 0.5) * exp(-srcE * srcE) * 0.5 * mom2.z * (0.3 + 0.7 * mom3.y);
    for (var k = 0; k < 10; k++) {
      let a = mom2.w + f32(k) * 0.62831853;
      let sa = sin(a);
      let facing = 1.0 - smoothstep(-0.3, 0.0, sa);
      if (facing < 0.001) {
        continue;
      }
      let lv = uq - vec2f(0.3 * cos(a), 0.045 * sa);
      let dl = length(lv);
      let lcore = 1.0 - smoothstep(0.018, 0.018 + aa, dl);
      let bloom = exp(-dl * dl / 0.0025) * 0.6 * gk;
      e += mix(rc, vec3f(1.0), 0.5) * (lcore * 1.4 + bloom) * facing;
    }
    for (var k = 0; k < 3; k++) {
      let ph = (f32(k) - 1.0) * 0.7;
      let bq2 = u - vec2f(0.58 * sin(ph), -0.2);
      let db = sdRBox(bq2, vec2f(0.075 * cos(ph), 0.034), 0.015);
      let inner = 1.0 - smoothstep(-aa, aa, db + 0.008);
      let glowB = exp(-max(db, 0.0) / 0.03) * 0.35 * gk;
      let flick = 0.75 + 0.25 * sin(t * 1.3 + f32(k) * 2.1);
      let grad = 0.6 + 0.6 * (1.0 - smoothstep(-0.03, 0.03, bq2.y));
      e += mix(vec3f(1.0, 0.7, 0.38), rc, 0.25) * (inner * grad + glowB) * flick;
    }
    for (var k = 0; k < 6; k++) {
      let a = 3.1415927 * (1.0 + (f32(k) + 0.5) / 6.0);
      let lv = u - vec2f(0.6 * cos(a), 0.12 + 0.1 * sin(a));
      let dl = length(lv);
      let pulse = 0.5 + 0.5 * sin(t * 3.0 + f32(k) * 1.7);
      let lcore = 1.0 - smoothstep(0.016, 0.016 + aa, dl);
      let bloom = exp(-dl * dl / 0.0015) * 0.5 * gk;
      e += vec3f(1.0, 0.92, 0.75) * (lcore * (0.5 + pulse) + bloom * pulse);
    }
    acc += vec4f(e * em, 0.0);
  }

  // 4. Soft halo around the hull, fading before the cull box.
  let gd = max(min(min(sdEll(u - vec2f(0.0, 0.02), vec2f(1.0, 0.11)), dDome), sdEll(u - vec2f(0.0, -0.19), vec2f(0.58, 0.13))), 0.0);
  let hfade = 1.0 - smoothstep(1.5, 2.3, length(u));
  let halo = exp(-gd * 4.0) * 0.28 * mom2.y * hfade * opening * (0.4 + 0.6 * litK) * (1.0 + 0.4 * mom3.y) * (1.0 - clamp(acc.a, 0.0, 1.0));
  acc += vec4f(mix(rc, vec3f(1.0), 0.3) * halo, 0.0);

  // 5. Warp line: grows sideways, then splits into two scan edges that sweep open the hull, plus a lens streak.
  let lineK = smoothstep(0.0, 0.05, m) * (1.0 - smoothstep(0.6, 0.85, m));
  if (lineK > 0.001) {
    let hw = 1.25 * lineW * sqrt(max(1.0 - (dy / 0.85) * (dy / 0.85), 0.05)) + 0.001;
    let xEnv = 1.0 - smoothstep(hw * 0.75, hw + aa, abs(u.x));
    let lw = 0.012 + aa;
    let e1 = (dy - H) / lw;
    let edgeL = exp(-e1 * e1) * xEnv * (1.6 - 0.6 * opening) * (1.0 - smoothstep(0.5, 0.95, opening));
    let sy = (u.y - cy) / 0.02;
    let hw0 = 1.25 * lineW + 0.001;
    let streak = exp(-sy * sy - u.x * u.x / (hw0 * hw0 * 1.4)) * (1.0 - smoothstep(1.9, 2.4, abs(u.x))) * (1.0 - 0.7 * opening) * 0.8;
    acc += vec4f(mix(rc, vec3f(1.0), 0.6) * (edgeL + streak) * lineK, 0.0);
  }
  return acc;
}

// One chrome tier of the mothership hull: ellipse (c, r) with a fake environment reflection, meridian panel lines
// (panels per half turn, 0 = none), a latitude seam and a dark outline. Premultiplied.
fn motherTier(u: vec2f, c: vec2f, r: vec2f, aa: f32, rc: vec3f, tone: f32, panels: f32) -> vec4f {
  let d = sdEll(u - c, r);
  let mk = 1.0 - smoothstep(-aa, aa, d);
  if (mk < 0.001) {
    return vec4f(0.0);
  }
  let q = (u - c) / r;
  let nx = clamp(q.x, -1.0, 1.0);
  let ny = clamp(q.y, -1.0, 1.0);
  let rr = ny - 0.25 * nx * nx + 0.1;
  let sky = mix(vec3f(0.7, 0.78, 0.95), vec3f(0.14, 0.16, 0.3), smoothstep(0.05, 0.9, rr));
  let ground = mix(vec3f(0.1, 0.08, 0.13), vec3f(0.025, 0.025, 0.04), smoothstep(0.05, 0.8, -rr));
  var hc = mix(ground, sky, smoothstep(-0.02, 0.02, rr)) * tone;
  let hz = rr / 0.03;
  hc += vec3f(1.0) * exp(-hz * hz) * 0.45 * tone;
  hc += rc * 0.22 * smoothstep(0.0, 0.7, -rr);
  let sx = (q.x + 0.45) / 0.25;
  let sy = (q.y - 0.3) / 0.2;
  hc += vec3f(1.0, 0.98, 0.95) * exp(-sx * sx - sy * sy) * 0.7;
  if (panels > 0.0) {
    let cz = max(sqrt(1.0 - nx * nx), 0.12);
    let lon = asin(nx) / 3.1415927 * panels;
    let fl = abs(fract(lon + 0.5) - 0.5);
    let lw = 0.035 + aa * panels / (3.1415927 * r.x * cz);
    let pl = (1.0 - smoothstep(lw * 0.5, lw, fl)) * (1.0 - smoothstep(0.8, 0.97, abs(nx)));
    let sw = 0.04 + aa / r.y;
    let seam = 1.0 - smoothstep(sw * 0.5, sw, abs(q.y + 0.15));
    hc *= 1.0 - 0.5 * max(pl, seam);
  }
  let ol = 0.022;
  hc = mix(hc, vec3f(0.02, 0.02, 0.035), smoothstep(-ol - aa, -ol + aa, d) * 0.7);
  return vec4f(hc * mk, mk);
}

fn sdRBox(q: vec2f, b: vec2f, r: f32) -> f32 {
  let d = abs(q) - b + vec2f(r);
  return length(max(d, vec2f(0.0))) + min(max(d.x, d.y), 0.0) - r;
}

fn sminF(a: f32, b: f32, k: f32) -> f32 {
  let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

fn sdEll(q: vec2f, r: vec2f) -> f32 {
  let k0 = length(q / r);
  let k1 = length(q / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 0.00001);
}

fn wakeSeg(p: vec2f, a: vec2f, b: vec2f, ageA: f32, ageB: f32, size: f32, px: f32, lifeT: f32) -> f32 {
  let ab = b - a;
  let l2 = dot(ab, ab);
  if (l2 < 0.00000001) {
    return 0.0;
  }
  let h = clamp(dot(p - a, ab) / l2, 0.0, 1.0);
  let d = length(p - a - ab * h);
  let age = mix(ageA, ageB, h);
  let life = clamp(1.0 - age / lifeT, 0.0, 1.0);
  let w = size * (0.06 + 0.16 * life) + px;
  return exp(-d * d / (w * w)) * life * life * 0.5;
}

// morph = (squashY, stripeFlash, stretchX, 0); (1, 0, 1, 0) is the plain fish. rc = saucer ring color.
fn fishShape(dv: vec2f, a: vec4f, b: vec4f, size: f32, look: vec4f, look2: vec4f, wig: f32, t: f32, aa: f32, morph: vec4f, rc: vec3f) -> vec4f {
  let fs = max(look2.y, 0.05);
  let bw = look.w;
  let ca = cos(a.z);
  let sa = sin(a.z);
  // Local frame: +x forward (head), +y up (back). Mirror y when heading left so the fish is never upside down.
  var q = vec2f(ca * dv.x + sa * dv.y, -sa * dv.x + ca * dv.y) / size;
  if (ca < 0.0) {
    q.y = -q.y;
  }
  // Squash flat and a little wider as it turns into a saucer.
  q = q / vec2f(morph.z, morph.x);
  let spd = clamp(a.w, 0.0, 2.0);
  let amp = (0.04 + 0.07 * spd) * wig;
  let tailW = clamp((0.3 - q.x) / 1.8, 0.0, 1.0);
  q.y += sin(b.y - q.x * 2.4) * amp * tailW * tailW;

  // Body: rounded oval plus rounded head.
  let dB0 = sdEll(q - vec2f(-0.1, 0.0), vec2f(0.85, 0.44));
  let dH = length(q - vec2f(0.45, -0.02)) - 0.38;
  let dBody = sminF(dB0, dH, 0.12);
  // Tail fin: rounded fan hinged at the tail root, swaying with swim speed.
  let sw = sin(b.y) * (0.15 + 0.25 * spd) * wig;
  let tp = q - vec2f(-0.85, 0.0);
  let cs = cos(sw);
  let sn = sin(sw);
  let tq = vec2f(cs * tp.x - sn * tp.y, sn * tp.x + cs * tp.y);
  var dT = sdEll(tq - vec2f(-0.3 * fs, 0.0), vec2f(0.3 * fs, 0.36 * fs));
  dT = max(dT, -(length(tq - vec2f(-0.68 * fs, 0.0)) - 0.14 * fs));
  // Soft scalloped dorsal fin and a small ventral fin.
  let dq = q - vec2f(-0.15, 0.2 + 0.16 * fs);
  let dD = sdEll(dq, vec2f(0.5 * fs, 0.2 * fs)) + 0.02 * cos(q.x * 20.0 + 1.0) * smoothstep(0.0, 0.15, dq.y);
  let dV = sdEll(q - vec2f(-0.35, -0.23 - 0.13 * fs), vec2f(0.26 * fs, 0.13 * fs));
  let dFin = min(min(dT, dD), dV);
  let d = sminF(dBody, dFin, 0.06);
  // Pectoral fin, fluttering more when slow.
  let fl = sin(t * 9.0 + b.z * 20.0) * (0.25 + 0.3 * (1.0 - min(spd, 1.0)));
  let pp = q - vec2f(0.2, -0.12);
  let cp = cos(-0.5 + fl);
  let spp = sin(-0.5 + fl);
  let pq = vec2f(cp * pp.x + spp * pp.y, -spp * pp.x + cp * pp.y) - vec2f(-0.14 * fs, 0.0);
  let dP = sdEll(pq, vec2f(0.17 * fs, 0.08 * fs));

  let orange = fishOrange(look.y, b.z, look2.z);
  let dark = vec3f(0.04, 0.02, 0.02);
  let ol = 0.035 * look2.x;
  let fill = 1.0 - smoothstep(-aa, aa, d);
  let inBody = 1.0 - smoothstep(-aa, aa, dBody);
  // Lighter belly, darker back.
  let shadeT = smoothstep(-0.45, 0.45, q.y);
  var c = orange * mix(1.25, 0.7, shadeT);
  // Darker orange fins.
  let finOnly = (1.0 - smoothstep(-aa, aa, dFin)) * (1.0 - inBody);
  c = mix(c, orange * 0.62 + vec3f(0.04, 0.0, 0.0), finOnly);
  // Translucent fins with glowing edges.
  let finEdge = smoothstep(-0.09, 0.0, dFin) * finOnly;
  c = mix(c, mix(orange, vec3f(1.0, 0.9, 0.7), 0.45) * 1.5, finEdge * 0.55);
  // Subtle scales: offset rows of arcs, faded out once they shrink to a few pixels.
  let scY = q.y * 13.0;
  let scRow = floor(scY);
  let scC = vec2f(fract(q.x * 13.0 + scRow * 0.5) - 0.5, fract(scY));
  let scaleA = smoothstep(0.32, 0.5, length(vec2f(scC.x, scC.y * 1.15))) * (1.0 - smoothstep(0.015, 0.05, aa));
  c *= 1.0 - 0.14 * scaleA * inBody;
  // Three white bands with thin dark outlines: head, mid-body, tail base.
  let bc = q.y * q.y;
  let db1 = abs(q.x - 0.42 + bc * 0.3) - 0.09 * bw;
  let db2 = abs(q.x + 0.12 - bc * 0.1) - 0.1 * bw;
  let db3 = abs(q.x + 0.68) - 0.055 * bw;
  let db = min(min(db1, db2), db3);
  let white = (1.0 - smoothstep(-aa, aa, db)) * inBody;
  let bandLine = smoothstep(-aa, aa, db) * (1.0 - smoothstep(ol - aa, ol + aa, db)) * inBody;
  // Stripes flash into the saucer ring light during the morph.
  let bandCol = mix(vec3f(0.97, 0.97, 1.0) * mix(1.1, 0.82, shadeT), mix(rc, vec3f(1.0), 0.3) * 2.6, morph.y);
  c = mix(c, bandCol, white);
  c = mix(c, dark, bandLine * 0.9 * (1.0 - morph.y));
  // Silhouette outline (body and fin edges).
  c = mix(c, dark, smoothstep(-ol - aa, -ol + aa, d) * 0.85);
  // Pectoral fin on top.
  let pf = 1.0 - smoothstep(-aa, aa, dP);
  let pc = mix(orange * 0.7, dark, smoothstep(-ol - aa, -ol + aa, dP) * 0.85);
  c = mix(c, pc, pf * 0.85);
  // Eye: dark ring, white eye, pupil, tiny highlight.
  let e = q - vec2f(0.6, 0.1);
  let de = length(e) - 0.085;
  c = mix(c, dark, 1.0 - smoothstep(-aa, aa, de - 0.025));
  c = mix(c, vec3f(1.0), 1.0 - smoothstep(-aa, aa, de));
  c = mix(c, vec3f(0.02), 1.0 - smoothstep(-aa, aa, length(e - vec2f(0.02, 0.0)) - 0.045));
  c = mix(c, vec3f(1.0), (1.0 - smoothstep(-aa, aa, length(e - vec2f(0.04, 0.025)) - 0.015)) * 0.8);
  // Soft rim light, stronger along the back.
  let rimL = smoothstep(-0.18, 0.0, d) * (0.6 + 0.4 * smoothstep(-0.3, 0.4, q.y));
  c += mix(orange, vec3f(1.0), 0.3) * rimL * 0.3 * look.x;
  // Glossy specular streak along the upper body and a small hot spot behind the eye.
  let gsx = (q.x - 0.15) / 0.42;
  let gsy = (q.y - 0.24 + q.x * q.x * 0.12) / 0.06;
  let gloss = exp(-gsx * gsx - gsy * gsy) * inBody * (1.0 - white * 0.5);
  let hsx = (q.x - 0.5) / 0.07;
  let hsy = (q.y - 0.27) / 0.04;
  let hot = exp(-hsx * hsx - hsy * hsy) * inBody;
  c += vec3f(1.0, 0.98, 0.95) * (gloss * 0.45 + hot * 0.8);

  // Fins let a little of the background through, except their glowing edges.
  let finClear = finOnly * (1.0 - finEdge) * 0.25;
  let alpha = max(fill * (1.0 - finClear), pf * 0.85);
  let dim = mix(1.0, 0.5, b.x);
  c *= dim;
  // Bioluminescent rim glow outside the silhouette, fading well before the cull radius.
  let gd = max(min(d, dP), 0.0);
  let fade = 1.0 - smoothstep(1.9, 2.5, length(dv) / size);
  let glow = exp(-gd * 5.0) * 0.35 * look.x * dim * fade * (1.0 - alpha);
  let gcol = mix(orange, vec3f(1.0, 0.85, 0.6), 0.4);
  return vec4f(c * alpha + gcol * glow, alpha);
}
`;

const HIST = 12;
const SZROW = 2 + HIST; // row 14: per-fish size in .x
const ROWS = SZROW + 1;

const MAXF = 40;
const WANDER = 0;
const SEEK = 1;
const HIDE = 2;
const DART = 3;

type Fish = {
  x: number;
  y: number;
  h: number; // heading (radians, 0 = +x)
  v: number; // speed (world units / s)
  state: number;
  timer: number;
  jelly: number; // jelly index or -1
  hx: number; // random hide point when no jellies
  hy: number;
  ox: number; // hide offset in jelly local space
  oy: number;
  wanderH: number;
  pause: number;
  tail: number;
  wake: number;
  dim: number;
  jitX: number;
  jitY: number;
  jitT: number;
  // Personality.
  bold: number;
  skittish: number;
  cruise: number;
  turn: number;
  hueVar: number;
  hist: number[]; // HIST * 3: tail-root x, y, age
  histT: number;
  sA: number; // stable size randoms
  sB: number;
  sC: number;
  sz: number; // current world size
};

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'jellyfish/fish',
    label: 'Clownfish',
    description: 'Adds a few small warm glowing fish that wander, hide among jelly tentacles and dart away when startled. In the space theme they become DJ hippo aliens in flying saucers that hover near the comets, and the hero jelly becomes a warping-in mothership with a tractor beam.',
    tags: ['jellyfish', 'creatures'],
    inputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image to add the fish on top of.',
      },
    },
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image with glowing fish added.',
      },
    },
    controls: {
      count: { type: 'number', group: 'Fish', label: 'Count', default: 3, min: 0, max: 40, step: 1 },
      size: { type: 'number', group: 'Fish', label: 'Size', default: 0.045, min: 0.005, max: 0.4, step: 0.001 },
      sizeMin: { type: 'number', group: 'Fish', label: 'Size min', default: 0.7, min: 0.05, max: 6, step: 0.01 },
      sizeMax: { type: 'number', group: 'Fish', label: 'Size max', default: 1.3, min: 0.05, max: 6, step: 0.01 },
      sizeVariety: { type: 'number', group: 'Fish', label: 'Size variety', default: 0.6, min: 0, max: 1, step: 0.01 },
      speed: { type: 'number', group: 'Behavior', label: 'Speed', default: 1, min: 0, max: 10, step: 0.01 },
      dartSpeed: { type: 'number', group: 'Behavior', label: 'Dart speed', default: 1, min: 0, max: 8, step: 0.01 },
      hideTime: { type: 'number', group: 'Behavior', label: 'Hide time', default: 3.5, min: 0, max: 30, step: 0.1 },
      boldness: { type: 'number', group: 'Behavior', label: 'Boldness', default: 1, min: 0, max: 10, step: 0.01 },
      wanderiness: { type: 'number', group: 'Behavior', label: 'Wanderiness', default: 1, min: 0, max: 5, step: 0.01 },
      curiosity: { type: 'number', group: 'Behavior', label: 'Curiosity', default: 1, min: 0, max: 1, step: 0.01 },
      schooling: { type: 'number', group: 'Behavior', label: 'Schooling', default: 0.3, min: 0, max: 1, step: 0.01 },
      startle: { type: 'number', group: 'Behavior', label: 'Startle', default: 1, min: 0, max: 8, step: 0.01 },
      edgeAvoid: { type: 'number', group: 'Behavior', label: 'Edge avoid', default: 1, min: 0, max: 4, step: 0.01 },
      hue: { type: 'number', group: 'Look', label: 'Hue shift', default: 0.08, min: -1, max: 2, step: 0.01 },
      hueVariety: { type: 'number', group: 'Look', label: 'Hue variety', default: 1, min: 0, max: 5, step: 0.01 },
      bandWidth: { type: 'number', group: 'Look', label: 'Band width', default: 1, min: 0, max: 4, step: 0.01 },
      outline: { type: 'number', group: 'Look', label: 'Outline', default: 1, min: 0, max: 5, step: 0.01 },
      finSize: { type: 'number', group: 'Look', label: 'Fin size', default: 1, min: 0, max: 3, step: 0.01 },
      tailWiggle: { type: 'number', group: 'Look', label: 'Tail wiggle', default: 1, min: 0, max: 4, step: 0.01 },
      glow: { type: 'number', group: 'Look', label: 'Glow', default: 1, min: 0, max: 8, step: 0.01 },
      wake: { type: 'number', group: 'Look', label: 'Wake', default: 1, min: 0, max: 8, step: 0.01 },
      wakeLength: { type: 'number', group: 'Look', label: 'Wake length', default: 1, min: 0.1, max: 5, step: 0.01 },
      motherSize: { type: 'number', group: 'Mothership', label: 'Size (x hero)', default: 1.5, min: 0, max: 8, step: 0.01 },
      motherGlow: { type: 'number', group: 'Mothership', label: 'Glow', default: 1, min: 0, max: 8, step: 0.01 },
      motherBeam: { type: 'number', group: 'Mothership', label: 'Beam', default: 1, min: 0, max: 8, step: 0.01 },
      motherSpin: { type: 'number', group: 'Mothership', label: 'Spin', default: 1, min: -10, max: 10, step: 0.01 },
    },
    controlDescriptions: {
      count: 'Number of fish swimming in the scene (up to 40).',
      size: 'Global size multiplier: base fish length in screen units (screen height is 2).',
      sizeMin: 'Smallest fish size as a multiple of Size. Swapped with Size max if larger.',
      sizeMax: 'Largest fish size as a multiple of Size. Swapped with Size min if smaller.',
      sizeVariety: 'How evenly fish sizes spread between min and max. 0 clusters them at the middle size, 1 spreads them fully.',
      speed: 'Master multiplier for cruise and dart speed.',
      dartSpeed: 'Extra multiplier for the burst speed when a fish darts away.',
      hideTime: 'Average seconds a fish lingers hidden in the tentacles before darting out. 0 means no hiding.',
      boldness: 'Extra multiplier on hide time per fish personality. Higher means longer hiding.',
      wanderiness: 'How randomly free-swimming fish change direction. 0 swims straight, higher meanders.',
      curiosity: 'Chance that a fish heads for a jelly to hide instead of keeping on wandering. 0 never hides.',
      schooling: 'How strongly wandering fish follow and align with their nearest neighbor. 0 swims independently.',
      startle: 'How easily bass onsets and nearby shockwaves startle hiding fish into darting. 0 disables.',
      edgeAvoid: 'How early fish turn away from the screen edges. 0 lets them swim right to the edge.',
      hue: 'Shifts the warm gold and coral fish colors around the color wheel.',
      hueVariety: 'How much each fish differs in color from the others. 0 makes every fish the same.',
      bandWidth: 'Width of the white stripes. 0 removes them.',
      outline: 'Thickness of the dark outline around the body, fins and stripes. 0 removes it.',
      finSize: 'Scale of the tail, dorsal, ventral and pectoral fins.',
      tailWiggle: 'Amount of tail sway and body ripple while swimming. 0 holds the tail rigid. In space it sets the saucer wobble.',
      glow: 'Strength of the soft glow halo around each fish.',
      wake: 'Brightness of the trail left behind swimming and darting fish (a sparkly ion trail in space). 0 disables it.',
      wakeLength: 'How long the wake trail lingers behind a fish. Longer means a longer trail.',
      motherSize: 'Size of the space-theme mothership that replaces the hero jelly, as a multiple of 2.4 bell radii. 0 hides it.',
      motherGlow: 'Strength of the mothership halo and the bloom around its lights.',
      motherBeam: 'Brightness of the mothership tractor beam, which pulses on bass. 0 turns it off.',
      motherSpin: 'Rotation speed of the mothership light rings. Negative values spin the other way.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    const view = uniform(new Vector4(0, aspect, 0, 1));
    const look = uniform(new Vector4(1, 0.08, 1, 1));
    const look2 = uniform(new Vector4(1, 1, 1, 1));
    const space = uniform(new Vector4(0, 0, 0, 0));
    const mom = uniform(new Vector4(0, 0, 0, 0));
    const mom2 = uniform(new Vector4(0, 1, 1, 0));
    const mom3 = uniform(new Vector4(0, 0, 1, 0));
    const buf = new Float32Array(MAXF * ROWS * 4);
    const dataTex = new DataTexture(buf, MAXF, ROWS, RGBAFormat, FloatType);
    dataTex.minFilter = NearestFilter;
    dataTex.magFilter = NearestFilter;
    dataTex.generateMipmaps = false;
    dataTex.needsUpdate = true;
    // Hippo pilot sprite. ref/saucer.ts used SRGBColorSpace + flipY for a mesh map; here the shader reads texels
    // directly, so keep the raw bytes (default NoColorSpace, flipY false: row 0 = sprite top) and decode sRGB
    // and premultiply in WGSL. Filtering is done manually in the shader.
    const pilotTex = new DataTexture(pilotPixels(), 192, 192, RGBAFormat, UnsignedByteType);
    pilotTex.flipY = false;
    pilotTex.minFilter = NearestFilter;
    pilotTex.magFilter = NearestFilter;
    pilotTex.generateMipmaps = false;
    pilotTex.needsUpdate = true;
    const baseTex = texture(new Texture(), (vec2 as any)(uv().x, uv().y.oneMinus()));
    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    material.fragmentNode = (wgslFn(fishPass) as any)(
      uv(),
      baseTex,
      view,
      look,
      look2,
      space,
      mom,
      mom2,
      mom3,
      (texture as any)(dataTex),
      (texture as any)(pilotTex),
    );
    const scene = new Scene();
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    let seed = 1;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const XR = aspect * 0.95;
    const YR = 0.95;
    const randPoint = (): [number, number] => [(rand() * 2 - 1) * XR * 0.85, (rand() * 2 - 1) * YR * 0.8];

    const makeFish = (): Fish => {
      const [x, y] = randPoint();
      return {
        x, y, h: rand() * Math.PI * 2, v: 0.1, state: WANDER, timer: 2 + rand() * 4, jelly: -1,
        hx: 0, hy: 0, ox: 0, oy: 0, wanderH: rand() * Math.PI * 2, pause: 0, tail: rand() * 10,
        wake: 0, dim: 0, jitX: 0, jitY: 0, jitT: 0,
        bold: 0.5 + rand(), skittish: 0.3 + rand() * 0.7, cruise: 0.7 + rand() * 0.6,
        turn: 1.5 + rand() * 2.5, hueVar: rand(), hist: [], histT: 0,
        sA: rand(), sB: rand(), sC: rand(), sz: 0.045,
      };
    };
    let fish: Fish[] = [];
    let slowBass = 0;
    let lastBassOn = -10;

    // Master theme (0 aquarium, 1 space), read from jellyShared each update.
    let theme = 0;
    // Mothership state (hero jelly, index 0): hull half-width, smoothed velocity, light spin, bass pulses.
    let motherR = 0;
    let mHas = false;
    let mPrevX = 0;
    let mPrevY = 0;
    let mVx = 0;
    let mFace = 1;
    let mSpin = 0;
    let mBeat = 0;
    let mBeamP = 0;

    const jellyPoint = (f: Fish): [number, number] | null => {
      const j = f.jelly;
      if (j < 0) return [f.hx, f.hy];
      if (j >= jellyShared.count) return null;
      const a = jellyShared.angle[j];
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const r = jellyShared.radius[j];
      const tl = jellyShared.tentacleLen[j];
      const lx = f.ox * r;
      const ly = -(r * 0.3 + f.oy * tl);
      const jx = jellyShared.x[j];
      const jy = jellyShared.y[j];
      const ax = jx + ca * lx - sa * ly;
      const ay = jy + sa * lx + ca * ly;
      if (theme <= 0) return [ax, ay];
      // The hero (index 0) is the mothership in space: hover inside its tractor beam, below the hull.
      if (j === 0 && motherR > 0) {
        const bx = jx + f.ox * motherR * 0.5;
        const by = jy - motherR * (0.75 + 1.4 * (f.oy - 0.5));
        return [ax + (bx - ax) * theme, ay + (by - ay) * theme];
      }
      // Space: hover above the comet coma (beam pointing down at it) or along its tail, where the tentacles hung.
      // Coma vs tail is derived from the existing hide offsets so the random sequence is unchanged.
      const pick = (((f.ox * 13.7 + f.oy * 7.1) % 1) + 1) % 1;
      let sx: number;
      let sy: number;
      if (pick < 0.5) {
        sx = jx + f.ox * r * 1.6;
        sy = jy + r * (0.9 + 0.5 * f.oy);
      } else {
        const tx = f.ox * r * 0.9;
        const ty = -(r * 0.6 + f.oy * tl * 1.1);
        sx = jx + ca * tx - sa * ty;
        sy = jy + sa * tx + ca * ty;
      }
      return [ax + (sx - ax) * theme, ay + (sy - ay) * theme];
    };

    const pickHide = (f: Fish) => {
      const n = jellyShared.count;
      if (n > 0) {
        let j = Math.floor(rand() * n);
        if (j === f.jelly && n > 1) j = (j + 1) % n;
        f.jelly = j;
      } else {
        f.jelly = -1;
        [f.hx, f.hy] = randPoint();
      }
      f.ox = (rand() * 2 - 1) * 0.5;
      f.oy = 0.5 + rand() * 0.6;
      f.state = SEEK;
      f.timer = 12;
    };

    const startDart = (f: Fish) => {
      f.state = DART;
      f.timer = 0.5 + rand() * 0.5;
      // Burst away from the jelly, slightly randomized.
      const j = f.jelly;
      let ax = Math.cos(f.h);
      let ay = Math.sin(f.h);
      if (j >= 0 && j < jellyShared.count) {
        ax = f.x - jellyShared.x[j];
        ay = f.y - jellyShared.y[j];
      }
      f.h = Math.atan2(ay, ax) + (rand() - 0.5) * 1.6;
      f.jelly = -1;
    };

    const wrapAngle = (a: number) => {
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    };

    return {
      update(frame) {
        const c = frame.controls as any;
        const t = frame.timeSeconds;
        const dt = Math.min(Math.max(frame.deltaSeconds ?? 0.016, 0), 0.1);
        const n = Math.max(0, Math.min(MAXF, Math.round(c.count ?? 3)));
        while (fish.length < n) fish.push(makeFish());
        const spd = Math.max(0, c.speed ?? 1);
        const size = c.size ?? 0.045;
        const startle = Math.max(0, c.startle ?? 1);
        let sMin = c.sizeMin ?? 0.7;
        let sMax = c.sizeMax ?? 1.3;
        if (sMin > sMax) [sMin, sMax] = [sMax, sMin];
        const variety = Math.max(0, Math.min(1, c.sizeVariety ?? 0.6));
        const dartSpeed = Math.max(0, c.dartSpeed ?? 1);
        const hideTime = Math.max(0, c.hideTime ?? 3.5);
        const wander = Math.max(0, c.wanderiness ?? 1);
        const curiosity = Math.max(0, Math.min(1, c.curiosity ?? 1));
        const schooling = Math.max(0, Math.min(1, c.schooling ?? 0.3));
        const edgeAvoid = Math.max(0, c.edgeAvoid ?? 1);
        const wakeLen = Math.max(0.05, c.wakeLength ?? 1);
        const histStep = 0.05 * wakeLen;
        const th = Number(jellyShared.theme);
        theme = Number.isFinite(th) ? Math.max(0, Math.min(1, th)) : 0;

        // Bass onset detector.
        let rawB = 0;
        const spectrum = frame.audioSpectrum;
        if (spectrum?.available) {
          for (let i = 1; i < 10; i++) rawB += spectrum.magnitudes[i] ?? 0;
          rawB /= 9;
        }
        const bassOn = rawB > slowBass * 1.5 && rawB > 0.02 && t - lastBassOn > 0.25;
        if (bassOn) lastBassOn = t;
        slowBass += (rawB - slowBass) * Math.min(1, dt / 1.0);

        // Mothership at the hero jelly: level, banked from its smoothed horizontal velocity.
        const hero = jellyShared.count > 0;
        const mx = hero ? jellyShared.x[0] : 0;
        const my = hero ? jellyShared.y[0] : 0;
        motherR = hero ? 1.2 * Math.max(0, jellyShared.radius[0]) * Math.max(0, c.motherSize ?? 1) : 0;
        if (hero && mHas && dt > 0) {
          const ivx = (mx - mPrevX) / dt;
          const ivy = (my - mPrevY) / dt;
          if (Math.hypot(ivx, ivy) < 5) mVx += (ivx - mVx) * Math.min(1, dt * 3);
        }
        mHas = hero;
        mPrevX = mx;
        mPrevY = my;
        if (mVx > 0.015) mFace = 1;
        else if (mVx < -0.015) mFace = -1;
        const mBank = Math.max(-0.22, Math.min(0.22, -mVx * 0.9));
        mSpin = (mSpin + dt * (c.motherSpin ?? 1) * 0.5) % (Math.PI * 2);
        mBeat = bassOn ? 1 : mBeat * Math.exp(-dt * 5);
        mBeamP = Math.max(bassOn ? 1 : 0, mBeamP * Math.exp(-dt * 2.2));
        const mT = Math.max(0, Math.min(1, (theme - 0.2) / 0.6));
        const mMat = motherR > 0 ? mT * mT * (3 - 2 * mT) : 0;
        mom.value.set(mx, my, motherR, mBank);
        mom2.value.set(mMat, Math.max(0, c.motherGlow ?? 1), Math.max(0, c.motherBeam ?? 1), mSpin);
        mom3.value.set(mBeat, mBeamP, mFace, 0);

        for (let i = 0; i < n; i++) {
          const f = fish[i];
          f.timer -= dt;
          {
            const cl = (f.sA + f.sB + f.sC) / 3;
            const raw = cl + (f.sA - cl) * variety;
            const st = Math.max(0, Math.min(1, 0.5 + (raw - 0.5) * (0.35 + 0.65 * variety)));
            f.sz = Math.max(0.001, size * (sMin + (sMax - sMin) * st));
          }
          let tx = f.x;
          let ty = f.y;
          let want = f.cruise * 0.18;
          let turn = f.turn;

          if (f.state === WANDER) {
            if (f.pause > 0) {
              f.pause -= dt;
              want = 0.02;
            } else if (rand() < dt * 0.15) {
              f.pause = 0.4 + rand() * 1.2;
            }
            f.wanderH += (rand() - 0.5) * dt * 3.0 * wander;
            if (rand() < dt * 0.1 * Math.min(wander, 3)) f.wanderH += (rand() - 0.5) * 2.5 * wander;
            // Schooling: loosely follow and align with the nearest neighbor.
            let dirX = Math.cos(f.wanderH);
            let dirY = Math.sin(f.wanderH);
            if (schooling > 0 && n > 1) {
              let nb = -1;
              let nd = 1e9;
              for (let j = 0; j < n; j++) {
                if (j === i) continue;
                const dd = Math.hypot(fish[j].x - f.x, fish[j].y - f.y);
                if (dd < nd) {
                  nd = dd;
                  nb = j;
                }
              }
              if (nb >= 0) {
                const o = fish[nb];
                const near = f.sz * 2.5;
                const ux = (o.x - f.x) / Math.max(nd, 0.0001);
                const uy = (o.y - f.y) / Math.max(nd, 0.0001);
                const pull = nd > near ? schooling * 0.7 : -schooling * 0.5;
                f.wanderH += wrapAngle(o.h - f.wanderH) * Math.min(1, dt * 1.5 * schooling);
                dirX = Math.cos(f.wanderH) * (1 - Math.abs(pull)) + ux * pull;
                dirY = Math.sin(f.wanderH) * (1 - Math.abs(pull)) + uy * pull;
              }
            }
            // Steer back from the edges.
            if (edgeAvoid > 0) {
              const th = Math.max(0.2, 1 - 0.2 * edgeAvoid);
              const ex = f.x / XR;
              const ey = f.y / YR;
              if (Math.abs(ex) > th || Math.abs(ey) > th) {
                f.wanderH = Math.atan2(-f.y, -f.x) + (rand() - 0.5);
                dirX = Math.cos(f.wanderH);
                dirY = Math.sin(f.wanderH);
              }
            }
            tx = f.x + dirX;
            ty = f.y + dirY;
            if (f.timer <= 0) {
              if (rand() < curiosity) pickHide(f);
              else f.timer = 2 + rand() * 5;
            }
          } else if (f.state === SEEK) {
            const pt = jellyPoint(f);
            if (!pt) {
              pickHide(f);
            } else {
              [tx, ty] = pt;
              const d = Math.hypot(tx - f.x, ty - f.y);
              want = f.cruise * 0.22 * Math.min(1, d / 0.15 + 0.2);
              turn *= 1.3;
              if (d < f.sz * 0.8 + 0.02) {
                f.state = HIDE;
                f.timer = hideTime * (0.6 + rand() * 0.8) * f.bold * Math.max(0.05, c.boldness ?? 1);
                f.jitT = 0;
              } else if (f.timer <= 0) {
                pickHide(f);
              }
            }
          } else if (f.state === HIDE) {
            const pt = jellyPoint(f);
            if (!pt) {
              startDart(f);
            } else {
              f.jitT -= dt;
              if (f.jitT <= 0) {
                const j = 0.04 * f.skittish;
                f.jitX = (rand() * 2 - 1) * j;
                f.jitY = (rand() * 2 - 1) * j;
                f.jitT = 0.25 + rand() * (1.2 - f.skittish);
              }
              tx = pt[0] + f.jitX;
              ty = pt[1] + f.jitY;
              // Follow the jelly's drift directly, plus a small nervous dart toward the jitter target.
              const k = Math.min(1, dt * (3 + 6 * f.skittish));
              f.x += (tx - f.x) * k;
              f.y += (ty - f.y) * k;
              want = 0.03 + 0.05 * f.skittish;
              turn *= 0.6;
              // Startle by bass onset or a nearby shockwave front.
              let scared = false;
              if (startle > 0) {
                if (bassOn && rand() < 0.35 * f.skittish * startle) scared = true;
                for (let w = 0; w < jellyShared.waveCount && !scared; w++) {
                  const dw = Math.hypot(f.x - jellyShared.waveX[w], f.y - jellyShared.waveY[w]);
                  if (Math.abs(dw - jellyShared.waveR[w]) < 0.06 && rand() < dt * 30 * f.skittish * startle) scared = true;
                }
                if (rand() < dt * 0.03 * f.skittish * startle) scared = true;
              }
              if (scared || f.timer <= 0) startDart(f);
            }
          } else if (f.state === DART) {
            tx = f.x + Math.cos(f.h);
            ty = f.y + Math.sin(f.h);
            want = f.cruise * 0.9 * dartSpeed;
            turn *= 0.3;
            if (f.timer <= 0) {
              if (rand() < 0.5 || rand() >= curiosity) {
                f.state = WANDER;
                f.timer = 2 + rand() * 5;
                f.wanderH = f.h;
              } else {
                pickHide(f);
              }
            }
          }

          // Steering: turn toward the target at the fish's turn rate.
          if (f.state !== HIDE || Math.hypot(tx - f.x, ty - f.y) > 0.005) {
            const dh = wrapAngle(Math.atan2(ty - f.y, tx - f.x) - f.h);
            f.h = wrapAngle(f.h + Math.max(-1, Math.min(1, dh)) * turn * dt * (f.state === DART ? 1 : 1.5));
          }
          const accel = f.state === DART ? 10 : 2;
          f.v += (want * spd - f.v) * Math.min(1, dt * accel);
          if (f.state !== HIDE) {
            f.x += Math.cos(f.h) * f.v * dt;
            f.y += Math.sin(f.h) * f.v * dt;
          }
          f.x = Math.max(-XR * 1.05, Math.min(XR * 1.05, f.x));
          f.y = Math.max(-YR * 1.05, Math.min(YR * 1.05, f.y));

          const vn = f.v / Math.max(0.0001, 0.18 * Math.max(spd, 0.0001));
          f.tail += dt * (4 + 14 * Math.min(vn, 3) + (f.state === HIDE ? 3 * f.skittish : 0));
          f.wake += ((f.state === DART ? 1 : 0) - f.wake) * Math.min(1, dt * (f.state === DART ? 8 : 2.5));
          f.dim += ((f.state === HIDE ? 1 : 0) - f.dim) * Math.min(1, dt * 2);

          buf[i * 4] = f.x;
          buf[i * 4 + 1] = f.y;
          buf[i * 4 + 2] = f.h;
          buf[i * 4 + 3] = Math.min(vn, 3);
          const o = (MAXF + i) * 4;
          buf[o] = f.dim;
          buf[o + 1] = f.tail % 6283.1853;
          buf[o + 2] = f.hueVar;
          buf[o + 3] = f.wake;

          // Tail-root history: starts collapsed on the fish so the wake grows from zero length.
          const rx = f.x - Math.cos(f.h) * f.sz * 1.1;
          const ry = f.y - Math.sin(f.h) * f.sz * 1.1;
          if (f.hist.length !== HIST * 3) {
            f.hist = [];
            for (let k = 0; k < HIST; k++) f.hist.push(rx, ry, 0);
            f.histT = 0;
          }
          for (let k = 0; k < HIST; k++) f.hist[k * 3 + 2] += dt;
          f.histT += dt;
          if (f.histT >= histStep) {
            f.histT = Math.min(f.histT - histStep, histStep);
            f.hist.splice(HIST * 3 - 3, 3);
            f.hist.unshift(rx, ry, 0);
          }
          for (let k = 0; k < HIST; k++) {
            const ho = ((2 + k) * MAXF + i) * 4;
            buf[ho] = f.hist[k * 3];
            buf[ho + 1] = f.hist[k * 3 + 1];
            buf[ho + 2] = f.hist[k * 3 + 2];
            buf[ho + 3] = 1;
          }
          buf[(SZROW * MAXF + i) * 4] = f.sz;
        }
        dataTex.needsUpdate = true;

        view.value.set(t, aspect, n, c.tailWiggle ?? 1);
        look.value.set(c.glow ?? 1, c.hue ?? 0.08, wakeLen, c.bandWidth ?? 1);
        look2.value.set(c.outline ?? 1, c.finSize ?? 1, c.hueVariety ?? 1, c.wake ?? 1);
        space.value.set(theme, 0, 0, 0);
      },
      async evaluate(inputs, evaluation) {
        baseTex.value = inputs.image.texture as Texture;
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {
        seed = 1;
        fish = [];
        slowBass = 0;
        lastBassOn = -10;
        motherR = 0;
        mHas = false;
        mVx = 0;
        mFace = 1;
        mSpin = 0;
        mBeat = 0;
        mBeamP = 0;
      },
      dispose() {
        geometry.dispose();
        material.dispose();
        dataTex.dispose();
        pilotTex.dispose();
      },
    };
  },
});
