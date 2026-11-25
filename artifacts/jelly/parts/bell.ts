import { defineComponent } from '@lux/visual-sdk';
import {
  Scene,
  Mesh,
  PlaneGeometry,
  MeshBasicNodeMaterial,
  OrthographicCamera,
  Vector4,
  DataTexture,
  RGBAFormat,
  FloatType,
  NearestFilter,
} from 'three/webgpu';
import { uniform, uv, wgslFn, texture } from 'three/tsl';
import { jellyShared } from './jelly-shared.ts';

// Data texture layout (64 x 13, RGBA32F), column = jelly / wave index:
// row 0: jelly cx, cy, scale, angle
// row 1: jelly bell contraction (signed, 0 = rest), glow boost, flow phase, tentacle stretch
// row 2: jelly main tint rgb, lateral tentacle lag
// row 3: jelly accent rgb, tentacle furl (lagged; >0 streams in, <0 spreads)
// row 4: wave cx, cy, radius, strength (0 = inactive)
// row 5: wave colour rgb
// row 6: neighbour glow tint rgb, neighbour glow envelope (0..1)
// row 7..9: trail lunge point k (newest first): x, y, age seconds (99 = inactive), 0
const MAX = 64; // max jellies
const MAXW = 16; // max active waves
// row 10: texels 0..31 smoothed auto-gained 32-band spectrum (x); texel 32: overall level, spectral centroid 0..1
// row 11: jelly wave push in local frame (x lateral, y tentacle lengthening), splay fan, lateral sway factor (hero < 1)
// row 12: comet tail direction in the jelly local frame (unit, opposite velocity), dust-tail bend (signed), speed
const ROWS = 13;
const SPEC_ROW = 10;
const TAIL_ROW = 12;
const NB = 32;

// Theme stages (Aquarium 0 -> Space 1): tentacles straighten first, then the bell rounds, then colours shift.
function smooth01(x: number): number {
  const u = Math.max(0, Math.min(1, x));
  return u * u * (3 - 2 * u);
}

const bellPass = `
fn jellyBell(st: vec2f, view: vec4f, shape: vec4f, tint: vec4f, tent: vec4f, flow: vec4f, arms: vec4f, swarm: vec4f, audio: vec4f, look: vec4f, fx: vec4f, thm: vec4f, data: texture_2d<f32>) -> vec4f {
  let t = view.x;
  let aspect = view.y;
  // Theme (thm): x master (0 aquarium, 1 space), y tails stage, z coma stage, w colour stage.
  let th = thm.x;
  var p = (st - vec2f(0.5, 0.42)) * vec2f(aspect, 1.0) * 2.0;

  // Shockwaves: displace the whole layer, then add glowing rings.
  var ring = vec3f(0.0);
  for (var w = 0; w < 16; w++) {
    let wv = textureLoad(data, vec2i(w, 4), 0);
    if (wv.w <= 0.0) {
      continue;
    }
    let wd = textureLoad(data, vec2i(w, 5), 0);
    // Space: shockwaves become solar-flare bursts with a warmer ring.
    let wc = mix(wd.rgb, vec3f(1.0, 0.62, 0.25), th * 0.85);
    let wsc = max(wd.w, 0.05);
    let dv = p - wv.xy;
    let dist = length(dv);
    let width = (0.07 + wv.z * 0.03) * wsc;
    let x = (dist - wv.z) / width;
    let g = exp(-x * x);
    let dir = dv / max(dist, 0.0001);
    p -= dir * (x * g * 1.65) * 0.0075 * audio.z * wv.w * wsc;
    // Concentric rings: bright leading ring, fainter trailing ones, soft inner fade.
    let nr = i32(swarm.y + 0.5);
    for (var k = 0; k < 6; k++) {
      if (k >= nr) {
        break;
      }
      let rk = wv.z - f32(k) * swarm.z * wsc;
      if (rk <= 0.0) {
        break;
      }
      let xk = (dist - rk) / width;
      let fadeIn = smoothstep(0.0, 0.12 * wsc + 0.02, rk);
      // Flare: leading ring hot yellow-white, trailing rings deeper orange.
      let rc = mix(wc, mix(vec3f(1.0, 0.85, 0.55), vec3f(1.0, 0.42, 0.14), min(f32(k) * 0.6, 1.0)), th * 0.6);
      ring += rc * exp(-xk * xk * 3.0) * wv.w * 0.22 * pow(0.55, f32(k)) * fadeIn * (1.0 + 0.5 * th);
    }
    // Flare flash at the emitter while the burst is young.
    ring += vec3f(1.0, 0.8, 0.5) * exp(-dist * dist / (0.012 * wsc * wsc)) * exp(-wv.z * 4.0) * wv.w * th * 0.5;
  }
  let sd = (p / vec2f(aspect, 1.0)) * 0.5 + vec2f(0.5, 0.42);

  // Space: deep violet gradient (cooler, blacker in full space).
  var col = mix(mix(vec3f(0.0004, 0.0003, 0.002), vec3f(0.004, 0.001, 0.012), sd.y), mix(vec3f(0.0002, 0.0003, 0.0009), vec3f(0.0016, 0.0012, 0.006), sd.y), th);
  // Sparse twinkling stars, highs make them sparkle; space makes them crisper, steadier and denser.
  let cell = floor(sd * vec2f(aspect, 1.0) * 90.0);
  let h = fract(sin(dot(cell, vec2f(12.9898, 78.233))) * 43758.5453);
  let sp = fract(sd * vec2f(aspect, 1.0) * 90.0) - 0.5;
  let twS = sin(t * (2.0 + audio.x * 10.0) + h * 40.0);
  let tw = mix(0.6 + 0.4 * twS, 0.85 + 0.15 * twS, th);
  let starMask = step(0.985, h) + (step(0.972, h) - step(0.985, h)) * th;
  let star = starMask * exp(-dot(sp, sp) * mix(60.0, 170.0, th)) * tw * (1.0 + audio.x * 2.5);
  col += vec3f(0.7, 0.8, 1.0) * star * mix(0.6, 1.0, th);
  if (th > 0.0) {
    // Fine dense star field, warm and cool, fading in with the theme.
    let cell2 = floor(sd * vec2f(aspect, 1.0) * 230.0);
    let h2 = fract(sin(dot(cell2, vec2f(41.37, 17.91))) * 24634.6345);
    let sp2 = fract(sd * vec2f(aspect, 1.0) * 230.0) - 0.5;
    let tw2 = 0.8 + 0.2 * sin(t * (1.5 + audio.x * 8.0) + h2 * 60.0);
    let sc2 = mix(vec3f(1.0, 0.85, 0.7), vec3f(0.7, 0.85, 1.0), fract(h2 * 7.31));
    col += sc2 * step(0.955, h2) * exp(-dot(sp2, sp2) * 90.0) * tw2 * (0.25 + 0.5 * fract(h2 * 13.7)) * th * (1.0 + audio.x * 1.5);
  }

  let count = i32(swarm.x);
  var jc = vec3f(0.0);
  // Light trails: dissolving specks along the last lunge segments (current -> L0 -> L1 -> L2).
  if (look.z > 0.0) {
    for (var i = 0; i < 64; i++) {
      if (i >= count) {
        break;
      }
      let t0 = textureLoad(data, vec2i(i, 7), 0);
      if (t0.z > 1.6) {
        continue;
      }
      let t1 = textureLoad(data, vec2i(i, 8), 0);
      let t2 = textureLoad(data, vec2i(i, 9), 0);
      let pl = textureLoad(data, vec2i(i, 0), 0);
      let tw0 = max(shape.x * pl.z * 0.03, 0.002);
      let sd0 = f32(i) * 3.1;
      // Grow each segment from the jelly side toward its stored point over ~0.4 s of that point's age.
      let gr0 = smoothstep(0.0, 0.4, t0.z);
      var g = trailSeg(p, pl.xy, mix(pl.xy, t0.xy, gr0), t0.z, t0.z, tw0, sd0, t);
      if (t1.z < 1.6) {
        let gr1 = smoothstep(0.0, 0.4, t1.z);
        g += trailSeg(p, t0.xy, mix(t0.xy, t1.xy, gr1), t0.z, t1.z, tw0, sd0 + 11.0, t);
      }
      if (t2.z < 1.6 && t1.z < 1.6) {
        let gr2 = smoothstep(0.0, 0.4, t2.z);
        g += trailSeg(p, t1.xy, mix(t1.xy, t2.xy, gr2), t1.z, t2.z, tw0, sd0 + 23.0, t);
      }
      let tc = textureLoad(data, vec2i(i, 2), 0).rgb;
      let farT = 1.0 - clamp(pl.z / max(swarm.w, 0.0001), 0.0, 1.0);
      jc += g * mix(tc, vec3f(1.0), 0.35) * look.z * 0.35 * mix(1.0, 0.5, farT) * (1.0 - 0.6 * th);
    }
  }
  for (var i = 0; i < 64; i++) {
    if (i >= count) {
      break;
    }
    let s = f32(i) + 1.0;
    let pl = textureLoad(data, vec2i(i, 0), 0);
    let rx = textureLoad(data, vec2i(i, 1), 0);
    let scale = pl.z;
    let dv = p - pl.xy;
    // Comet tails are longer (up to ~1.9x) and can point any way: widen the cull radius with the tail stage.
    if (length(dv) > scale * shape.x * (tent.y * (1.8 + rx.w * 0.5) * (1.0 + 1.1 * thm.y) + 2.0)) {
      continue;
    }
    let ta = textureLoad(data, vec2i(i, 2), 0);
    let a = ta.rgb;
    let rd3 = textureLoad(data, vec2i(i, 3), 0);
    let b = rd3.rgb;
    let ca = cos(pl.w);
    let sa = sin(pl.w);
    let lp = vec2f(ca * dv.x + sa * dv.y, -sa * dv.x + ca * dv.y) / scale;
    let ng = textureLoad(data, vec2i(i, 6), 0);
    // Depth: scale relative to the largest allowed jelly (swarm.w); the hero clamps to nearest.
    let depthN = clamp(scale / max(swarm.w, 0.0001), 0.0, 1.0);
    jc += jellyInstance(lp, t, s, view, shape, a, b, tent, flow, arms, audio, rx, ta.w, rd3.w, ng, look, 1.0 - depthN, fx, thm, data) * mix(0.45, 1.0, depthN) * mix(1.0, 0.5, thm.x) * select(1.0, 1.0 - smoothstep(0.2, 0.7, thm.x), i == 0);
  }
  // Brightness (tint.w) before a soft shoulder (arms.w) to avoid white blowouts on overlap.
  jc *= tint.w;
  col += jc / (1.0 + jc * arms.w);
  col += ring;
  return vec4f(col, 1.0);
}

fn hash11(x: f32) -> f32 {
  return fract(sin(x * 127.1 + 311.7) * 43758.5453);
}

// Sparkly dots along segment a->b; ages interpolate along it and fade over about 1.5 s.
fn trailSeg(p: vec2f, a: vec2f, b: vec2f, ageA: f32, ageB: f32, w: f32, seed: f32, t: f32) -> f32 {
  let ab = b - a;
  let L = length(ab);
  if (L < 0.0001) {
    return 0.0;
  }
  let dir = ab / L;
  let rel = p - a;
  let s = dot(rel, dir);
  if (s < -w * 3.0 || s > L + w * 3.0) {
    return 0.0;
  }
  let perp = dot(rel, vec2f(-dir.y, dir.x));
  if (abs(perp) > w * 4.0) {
    return 0.0;
  }
  let sp = w * 2.5;
  let k = floor(s / sp);
  let hs = hash11(k * 1.37 + seed * 17.0);
  let hs2 = hash11(k * 2.91 + seed * 5.3 + 3.0);
  let center = vec2f((k + 0.5) * sp, (hs2 - 0.5) * w * 3.0);
  let age = mix(ageA, ageB, clamp(center.x / L, 0.0, 1.0)) + hs * 0.3;
  let life = clamp(1.0 - age / 1.5, 0.0, 1.0);
  let rad = w * (0.25 + 0.3 * hs) * (0.4 + 0.6 * life);
  let dd = vec2f(s, perp) - center;
  let tw = 0.55 + 0.45 * sin(t * (9.0 + hs * 14.0) + hs * 40.0);
  let onSeg = select(0.0, 1.0, center.x <= L);
  return exp(-dot(dd, dd) / (rad * rad)) * life * life * tw * step(0.3, hs) * onSeg;
}

// Medusa stroke pinch: 1 at the apex, narrowing toward the margin (rim and lip) as the bell contracts.
fn bellPinch(qy: f32, lowK: f32, contract: f32) -> f32 {
  let sw = 1.0 - smoothstep(-0.1, 1.0, qy);
  let pw = sw * sw + 0.3 * smoothstep(0.0, 1.0, -qy / lowK);
  return exp(-0.5 * contract * pw);
}

// One jellyfish in its local space; returns additive colour.
fn jellyInstance(lp: vec2f, t0: f32, seed: f32, view: vec4f, shape: vec4f, aIn: vec3f, bIn: vec3f, tent: vec4f, flow: vec4f, arms: vec4f, audio: vec4f, react: vec4f, lag: f32, furl: f32, ng: vec4f, look: vec4f, farD: f32, fx: vec4f, sp: vec4f, data: texture_2d<f32>) -> vec3f {
  let t = t0 + seed * 7.0;
  let p = lp;
  var col = vec3f(0.0);
  // Theme stages: th master, sT tentacles -> comet tails, sB bell -> coma, sC colour shift.
  let th = sp.x;
  let sT = sp.y;
  let sB = sp.z;
  let sC = sp.w;
  let contractRaw = react.x;
  // Strokes shape the bell; once it rounds into a coma they only drive a gentle pulse.
  let contract = contractRaw * (1.0 - sB);
  // Hero lead (instance 0, seed 1): level-driven inner glow, hue slides warm (low centroid) -> cool (high).
  let heroAud = textureLoad(data, vec2i(32, 10), 0);
  let isHero = select(0.0, 1.0, seed < 1.5);
  let heroCol = mix(vec3f(1.0, 0.5, 0.2), vec3f(0.25, 0.6, 1.0), clamp(heroAud.y, 0.0, 1.0));
  let heroMix = clamp(fx.z * 0.3, 0.0, 0.8) * isHero;
  // Neighbour glow: a passing shockwave tints and brightens this jelly toward the emitter's hue.
  // In space the neighbour glow warms toward the solar-flare colour.
  let ngc = mix(ng.rgb, vec3f(1.0, 0.62, 0.25), th * 0.6);
  let a = mix(mix(aIn, heroCol, heroMix), ngc, ng.w * 0.7);
  let b = mix(mix(bIn, heroCol, heroMix * 0.7), ngc, ng.w * 0.5);
  // Comet palette: icy white-cyan nucleus, hue-tinted coma.
  let ice = vec3f(0.78, 0.95, 1.0);
  let comaCol = mix(a, mix(a, ice, 0.45), sC);
  let boost = 1.0 + react.y + ng.w * 1.2;
  let bg = look.x;
  let haze = look.y;
  // Depth haze: far jellies get wider, softer falloffs.
  let soft = 1.0 + farD * haze * 1.6;
  let nearD = 1.0 - farD;

  let flowPhase = react.z;
  let stretch = react.w;
  // Contraction closes the margin like an umbrella (inward and down); the dome stays rounded, slightly taller.
  let radius = shape.x;
  let height = shape.x * shape.y * exp(0.06 * contract);
  let lowK = 0.3 * exp(0.3 * contract);
  // Coma: a circle around the dome centre that the bell condenses into, pulsing gently with each stroke.
  let ccY = 0.05 + shape.x * shape.y * 0.3;
  let comaR = radius * 0.72 * (1.0 + 0.05 * clamp(contractRaw, -0.5, 1.6));
  // Comet tail direction (local frame, opposite the velocity) and dust-tail bend from the CPU sim.
  let tr = textureLoad(data, vec2i(i32(seed - 0.5), 12), 0);
  let tdl = select(vec2f(0.0, -1.0), tr.xy / max(length(tr.xy), 0.0001), dot(tr.xy, tr.xy) > 0.000001);
  let thetaT = atan2(tdl.x, -tdl.y);
  let bendT = tr.z;

  let qy = (p.y - 0.05) / height;
  let pinch = bellPinch(qy, lowK, contract);
  let qB = vec2f(p.x / (radius * pinch), qy);
  let qC = (p - vec2f(0.0, ccY)) / comaR;
  // Shape morph: the dome (with its compressed skirt below) blends into the round coma.
  let q = mix(qB, qC, sB);
  let qq = mix(vec2f(qB.x, select(qB.y, qB.y / lowK, qB.y < 0.0)), qC, sB);
  let ang = atan2(q.x, q.y);
  let scallop = 0.06 * sin(ang * 16.0 + t * 0.6) * smoothstep(0.2, 1.4, abs(ang)) * (1.0 - sB);
  let rl = length(qq);
  // Circular equaliser: rim angle -> band (interpolated), magnitude swells the rim outward.
  let rbf = clamp(ang / 3.14159265 * 0.5 + 0.5, 0.0, 1.0) * 31.0;
  let rb0 = i32(floor(rbf));
  let rb1 = min(rb0 + 1, 31);
  let rimMag = mix(textureLoad(data, vec2i(rb0, 10), 0).x, textureLoad(data, vec2i(rb1, 10), 0).x, fract(rbf));
  let rimEq = fx.y * rimMag * (1.0 - 0.6 * sB);
  let d = rl - 1.0 - scallop - rimEq * 0.05 * (0.3 + 0.7 * smoothstep(0.2, 1.4, abs(ang)));
  let inside = 1.0 - smoothstep(-0.02, 0.02, d);
  // Skirt, margin, ribs and apex shrink away as the bell rounds.
  let lower = smoothstep(0.05, -0.25, q.y) * (1.0 - sB);

  // The coma edge is much softer than the bell rim.
  let rimW = 18.0 / soft * mix(1.0, 0.22, sB);
  let margin = smoothstep(0.35, -0.15, q.y) * (1.0 - sB);
  let rim = exp(-abs(d) * rimW) * (0.75 + 0.55 * margin) * mix(1.0, 0.3, sB);
  let ribFade = 1.0 - smoothstep(0.45, 0.92, rl);
  let ribs = pow(0.5 + 0.5 * cos(ang * 12.0), 4.0 * soft) * inside * (1.0 - rl) * ribFade * (1.0 - sB);
  // Core glow slides to the coma centre and condenses into the nucleus.
  let coreC = vec2f(0.0, 0.35 * (1.0 - sB));
  let core = exp(-dot(q - coreC, q - coreC) * mix(6.0, 16.0, sB) / soft) * inside * (1.0 - lower);
  let apex = exp(-dot(q - vec2f(0.0, 0.72), q - vec2f(0.0, 0.72)) * 3.0 / soft) * inside * (1.0 - sB);
  let lip = lower * exp(-pow((d + 0.1) / (0.07 * soft), 2.0));
  let thick = clamp(1.0 - rl, 0.0, 1.0);

  // Translucent body lit from within: subsurface fill, apex glow, glowing margin, faint luminous ribs.
  let sub = mix(mix(a, b, 0.3 + 0.3 * clamp(q.y, 0.0, 1.0)), comaCol, sC);
  col += inside * sub * (0.07 + 0.12 * thick) * (0.6 + 0.4 * bg) * boost;
  col += apex * mix(vec3f(1.0, 0.92, 0.98), a, 0.45) * 0.22 * bg * (1.0 + view.z * 0.5) * boost;
  col += rim * mix(mix(b, a, 0.3), comaCol, sC) * (0.85 + view.z * 0.9 + rimEq * 1.5) * (0.7 + 0.3 * bg) * boost;
  col += (core * 0.8 + apex * 0.4 + inside * 0.12) * heroCol * clamp(heroAud.x, 0.0, 1.0) * fx.z * isHero * boost;
  col += exp(-abs(d) * rimW * 0.25) * margin * mix(b, a, 0.5) * 0.12 * bg * boost;
  col += ribs * mix(a, vec3f(1.0), 0.35) * 0.14 * (0.5 + 0.5 * bg) * boost;
  col += core * mix(mix(vec3f(1.0, 0.85, 0.95), a, 0.3), ice, sC) * (0.35 + view.z * 0.6) * mix(1.0, 1.6, sB) * boost;
  col += lip * mix(a, b, 0.5) * 0.25 * bg * boost;
  col += ng.w * inside * ngc * 0.25 * boost;
  let bellK = 1.0 - sB;
  if (bellK > 0.0) {
    // Richer translucency: a brighter shell toward the edge of the bell (thin tissue seen edge-on).
    let shell = pow(clamp(rl, 0.0, 1.0), 4.0) * inside;
    col += shell * mix(b, a, 0.6) * 0.09 * (0.6 + 0.4 * bg) * bellK * boost;
    // Iridescent rim: thin-film hue shift along a band just inside the margin, by grazing angle (rl) and rim angle.
    let film = 0.5 + 0.5 * cos(6.2831853 * (rl * 1.6 + ang * 0.12 + 0.08 * sin(t * 0.4)) + vec3f(0.0, 2.1, 4.2));
    let iri = exp(-abs(d + 0.035) * rimW * 1.6) * (0.6 + 0.4 * margin);
    col += iri * film * 0.16 * (0.6 + 0.4 * bg) * bellK * boost;
    // Soft caustic light rippling through the dome.
    let cq = q * vec2f(1.0, 1.3);
    let c1 = sin(cq.x * 9.0 + sin(cq.y * 7.0 + t * 0.7) * 1.6 + t * 0.35);
    let c2 = sin(cq.y * 8.0 + sin(cq.x * 6.0 - t * 0.55) * 1.6 - t * 0.3);
    let caus = pow(1.0 - abs(c1 * c2), 10.0) * inside * (1.0 - lower) * smoothstep(1.0, 0.4, rl);
    col += caus * mix(a, vec3f(1.0, 0.97, 0.9), 0.55) * 0.07 * bg * bellK * boost;
  }
  if (sB > 0.0) {
    // Comet: HDR-feeling nucleus (tight hot core), layered coma, front hood; swells on each (former) stroke.
    let pc = p - vec2f(0.0, ccY);
    let rc = length(pc);
    let nR = radius * 0.075 * soft;
    let nucleus = exp(-rc * rc / (nR * nR));
    let hot = exp(-rc * rc / (nR * nR * 0.09));
    let pulse = 1.0 + 0.25 * clamp(contractRaw, -0.3, 1.6);
    // Outer coma is drawn out toward the tail.
    let ax = dot(pc, tdl);
    let rcE = length(pc - tdl * max(ax, 0.0) * 0.55);
    let comaIn = exp(-rc / (comaR * 0.16));
    let comaMid = exp(-rc / (comaR * 0.42));
    let comaOut = exp(-rcE / (comaR * 1.1));
    let front = max(-ax / max(rc, 0.0001), 0.0);
    let hx = (rc / comaR - 0.8) / 0.15;
    let hood = exp(-hx * hx) * front * front;
    var cc = hot * vec3f(1.0, 0.98, 0.94) * 3.0 + nucleus * mix(mix(a, ice, sC), vec3f(1.0), 0.5) * (1.4 + view.z * 0.6);
    cc += comaIn * mix(ice, comaCol, 0.3) * 0.45 + comaMid * comaCol * 0.3 * pulse * (0.6 + 0.4 * bg);
    cc += (comaOut * 0.08 + hood * 0.12) * comaCol * pulse;
    col += cc * sB * boost;
  }

  col += exp(-length(p) * 3.0 * (0.42 / max(shape.x, 0.01))) * comaCol * 0.025 * shape.w * boost;
  // Close jellies: slight bloom-like soft halo.
  col += exp(-length(p - vec2f(0.0, 0.05)) * 2.2 / max(shape.x, 0.01)) * comaCol * 0.035 * nearD * nearD * nearD * haze * boost;

  let mids = view.w;
  let highs = audio.x;
  // Tentacles stream back (longer, narrower, calmer) while furled during the lunge, then billow and spread.
  let tflow = audio.w;
  let billow = exp(-0.8 * furl);
  let pull = (1.0 + stretch * 0.4) * (1.0 + 0.08 * furl);
  let calm = 1.0 / (1.0 + stretch * 2.0 + furl * furl * 0.8);
  // Tips fan wider than the roots at rest (flow > 0); the furl narrows them during the lunge.
  let fanK = 0.6 * tflow / (1.0 + 0.4 * tflow);
  let narrow0 = 0.3 * (1.0 + 0.7 * stretch) + 0.25 * furl - fanK * billow;
  // Slow sideways water current, different per jelly (t already carries a per-jelly offset).
  let wp = textureLoad(data, vec2i(i32(seed - 0.5), 11), 0);
  let latK = wp.w;
  let cSpread = look.w;
  let current = (0.65 * sin(t * 0.21 + seed * 3.1) + 0.35 * sin(t * 0.093 + seed * 7.7)) * 0.07 * shape.x * tflow * (1.0 + 0.8 * cSpread) * latK;
  // Slow per-jelly current fan: tips spread wider, breathing slowly.
  let cFan = cSpread * 0.22 * tflow * billow * (0.75 + 0.25 * sin(t * 0.13 + seed * 2.3));
  // Shockwave push (local units x bell size) and splay, both from the CPU spring.
  let wPush = wp.x * shape.x;
  let wSplay = max(wp.z, -0.3);
  let narrow = narrow0 - cFan - wSplay;
  let driftK = 0.13 * shape.x * tflow * billow / (1.0 + stretch * 1.2) * latK;
  let n = i32(tent.x);
  // 3-5 long main tentacles spread evenly through the set; the rest are short fringe.
  let nmf = 3.0 + floor(hash11(seed * 3.71 + 0.5) * 2.999);
  let dstep = nmf / max(tent.x, 1.0);

  // Comet tails: the tentacle set rotates about the coma centre toward the anti-velocity direction.
  // Dust strands sit slightly toward the bend side, the ion bundle slightly opposite.
  let sgnB = select(-1.0, 1.0, bendT >= 0.0);
  let pivot = vec2f(0.0, ccY);
  let pr = p - pivot;
  let thD = (thetaT + 0.08 * sgnB) * sT;
  let thI = (thetaT - 0.06 * sgnB) * sT;
  let ptD = vec2f(cos(thD) * pr.x + sin(thD) * pr.y, -sin(thD) * pr.x + cos(thD) * pr.y) + pivot;
  let ptI = vec2f(cos(thI) * pr.x + sin(thI) * pr.y, -sin(thI) * pr.x + cos(thI) * pr.y) + pivot;
  let dustCol = mix(vec3f(1.0, 0.76, 0.46), a, 0.2);
  let ionCol = vec3f(0.35, 0.65, 1.0);
  if (sT > 0.0) {
    // Broad dust sheet with fine striations radiating from the nucleus.
    let lenS = shape.x * tent.y * 1.45 * pull;
    let alongS = (ccY - ptD.y) / max(lenS, 0.0001);
    if (alongS > 0.0 && alongS < 1.0) {
      let xs = bendT * alongS * alongS * lenS * 0.4 + wPush * alongS * alongS;
      let hwS = radius * 0.25 + alongS * lenS * 0.24;
      let us = (ptD.x - xs) / hwS;
      let striae = 0.7 + 0.3 * sin(us * 17.0 + seed * 4.3 + t * 0.15) * sin(us * 6.0 - seed * 2.1);
      let sheet = exp(-us * us * 1.5) * (1.0 - smoothstep(0.08, 1.0, alongS)) * smoothstep(0.0, 0.12, alongS) * striae;
      col += sheet * mix(mix(a, b, alongS), dustCol, sC) * 0.13 * sT * tent.z * boost / soft;
    }
  }
  for (var i = 0; i < 64; i++) {
    if (i >= n) {
      break;
    }
    let fi = f32(i);
    let h1 = fract(sin(fi * 12.9898 + 4.1 + seed * 31.7) * 43758.5453);
    let h2 = fract(sin(fi * 78.233 + 1.7 + seed * 17.3) * 24634.6345);
    let h5 = fract(sin(fi * 91.7 + 5.3 + seed * 23.9) * 41381.37);
    // About a third of the tentacles merge into the narrow ion tail; the rest form the dust tail.
    let isIon = h5 < 0.32;
    let ion = select(0.0, 1.0, isIon);
    let pt = select(ptD, ptI, isIon);
    let u = select((fi + 0.5) / tent.x * 2.0 - 1.0, 0.0, n == 1);
    let ux = u * 0.8;
    let rootY0 = 0.05 - height * lowK * sqrt(max(1.0 - ux * ux, 0.0)) * 0.88;
    let pinchR = bellPinch((rootY0 - 0.05) / height, lowK, contract);
    // Roots gather into the coma as the bell rounds.
    let rootY = mix(rootY0, ccY, 0.85 * sB);
    let isMain = (floor((fi + 1.0) * dstep) != floor(fi * dstep)) || (dstep >= 1.0);
    // Tails straighten and lengthen: fringe tentacles grow to join, ion strands longest.
    let lenK0 = select(0.3 + 0.3 * h1, 1.0 - tent.w * 0.25 * h1, isMain);
    let lenKc = select(0.8 + 0.35 * h1, 1.0 + 0.2 * h1, isIon);
    let lenK = mix(lenK0, lenKc, sT) * mix(1.0, select(0.75, 1.0, isIon), sT);
    let len = shape.x * tent.y * lenK * pull;
    let along = (rootY - pt.y - wp.y * shape.x * 0.5 * clamp((rootY - pt.y) / len, 0.0, 1.0)) / len;
    if (along < 0.0 || along > 1.0) {
      continue;
    }
    let wave = (sin(along * 7.0 - t * 1.8 + fi * 1.7) * along * (0.05 + mids * flow.w * 0.2) * shape.x
      + sin(along * 13.0 - t * 2.9 + fi) * along * 0.015) * calm * latK;
    let h3 = fract(sin(fi * 39.425 + 8.3 + seed * 5.9) * 15731.743);
    let h4 = fract(sin(fi * 53.17 + 2.9 + seed * 11.3) * 31718.927);
    // Per-tentacle slow lateral drift: two low-frequency travelling sines, growing toward the tip.
    let dsp = 0.7 + 0.6 * h4;
    let drift = (0.6 * sin(along * 2.3 - t * 0.42 * dsp + h3 * 6.2831)
      + 0.4 * sin(along * 4.1 - t * 0.67 * dsp + h1 * 6.2831 + fi)) * along * sqrt(along) * (0.6 + 0.8 * h4) * driftK;
    // Main tentacles: slow, low-frequency, high-amplitude curls.
    let curl = select(0.0, 1.0, isMain) * (sin(along * 2.4 - t * 0.45 * dsp + h3 * 6.2831) * 0.16
      + sin(along * 4.3 - t * 0.7 * dsp + fi * 2.3) * 0.05) * along * shape.x * (0.4 + 0.6 * min(tflow, 1.5)) * calm * latK;
    // Water motion (aquarium only) damps out as the tails straighten; ion strands go fully straight.
    let wiggle = wave + drift + curl + current * along * along * (1.0 - sT) + lag * latK * along * along;
    let xBase = u * radius * 0.8 * pinchR * (1.0 - along * narrow);
    let fanU = h4 * 2.0 - 1.0;
    // Ion: tight bundle with turbulent kinks travelling outward. Dust: broad, curved fan.
    let kink = (sin(along * 17.0 - t * 6.0 + h3 * 6.2831) * 0.5 + sin(along * 31.0 - t * 9.3 + fi + seed) * 0.25
      + sin(along * 7.0 - t * 2.3 + seed * 1.7) * 0.6) * along * radius * 0.07;
    let xIon = fanU * radius * 0.05 * (1.0 + along) + kink;
    let xDust = fanU * (radius * 0.22 + along * len * 0.2) + bendT * along * along * len * 0.4;
    let xTail = select(xDust, xIon, isIon);
    let x = mix(xBase, xTail, sT) + wiggle * (1.0 - sT * mix(0.8, 1.0, ion)) + wPush * along * along;
    let dxs = pt.x - x;
    let dx = abs(dxs);
    let width0 = mix(0.012, 0.002, along) * (shape.x / 0.42) * select(0.6, 1.9, isMain) * soft;
    let widthC = (shape.x / 0.42) * soft * select(0.006 + 0.028 * along, 0.0035 * (1.0 - 0.4 * along), isIon);
    let width = mix(width0, widthC, sT);
    let tipStart0 = select(0.35 + 0.35 * h2, 0.7 + 0.15 * h2, isMain);
    let tipStart = mix(tipStart0, select(0.15, 0.3, isIon), sT);
    let fade = (1.0 - smoothstep(tipStart, 1.0, along)) * smoothstep(0.0, 0.04, along) * mix(select(0.75, 1.0, isMain), 1.0, sT);
    let line = exp(-dx / width) * fade / soft;
    // Fine detail: a thin bright core thread and faint nematocyst banding along the length.
    let threadL = exp(-dx / (width * 0.28)) * fade / soft;
    let bandK = 0.86 + 0.14 * sin(along * 95.0 - t * 2.5 + fi * 3.7);
    // Constant per-tentacle multiplier (0.6-1.4 at full variation) and hashed offset.
    // sin(k*along - phase) travels toward larger along: root -> tip.
    let mult = 1.0 + flow.y * 0.4 * (h2 * 2.0 - 1.0);
    // fx.w: eased beat phase in dot spacings; increasing phase moves dots toward the tip (downward).
    let pearlArg = along * flow.z - flowPhase * mult * 4.0 - fx.w * 6.2831853 + h3 * 6.2831;
    let pearl = pow(0.5 + 0.5 * sin(pearlArg), 12.0 / soft);
    let sparkle = 1.0 + highs * (2.0 + 2.0 * sin(t * 23.0 + fi * 5.1 + seed * 3.0));
    // Spectrum across tentacles: low band on one side, high on the other.
    let tbi = i32(clamp((fi + 0.5) / max(tent.x, 1.0), 0.0, 1.0) * 31.0 + 0.5);
    let tSpec = 1.0 + fx.x * textureLoad(data, vec2i(tbi, 10), 0).x * 1.5;
    // Ion flicker: global shimmer times bright knots streaming outward.
    let flick = (0.72 + 0.28 * sin(t * 13.0 + fi * 2.7 + seed)) * (0.55 + 0.45 * sin(along * 11.0 - t * 5.0 + h3 * 6.2831));
    let ionMod = mix(1.0, flick, sT * ion);
    // Dust strands carry fine striations across their width.
    let striae = mix(1.0, 0.7 + 0.3 * sin(dxs / width * 3.0 + along * 4.0 + h3 * 6.2831), sT * (1.0 - ion));
    let baseK = mix(0.35, select(0.22, 0.8, isIon), sT);
    let pearlK = pearl * 1.2 * sparkle * (1.0 - sT);
    let tcol = mix(mix(a, b, along), select(dustCol, ionCol, isIon), sC);
    col += line * tcol * (baseK * ionMod * striae * bandK + pearlK) * tent.z * boost * tSpec;
    col += threadL * mix(tcol, vec3f(1.0), 0.4) * 0.12 * mix(1.0, 1.0 + ion * 1.5 * flick, sT) * tent.z * boost * tSpec;
    if (sT > 0.0 && !isIon) {
      // Dots become dust grains: same flow phase and direction (outward), scattered across the strand.
      let gs = flow.z * 1.6 / 6.2831853;
      let gPos = pearlArg * 1.6 / 6.2831853;
      let gk = floor(gPos);
      let gA = hash11(gk * 1.37 + fi * 7.13 + seed * 3.31);
      let gB = hash11(gk * 2.71 + fi * 3.17 + seed * 5.93 + 1.0);
      let gC = hash11(gk * 4.13 + fi * 1.91 + seed * 9.17 + 2.0);
      let da = (fract(gPos) - 0.5 - (gB - 0.5) * 0.5) / max(gs, 0.0001) * len;
      let dl = dxs - (gA - 0.5) * width * 5.0;
      let gr = 0.005 * (shape.x / 0.42) * (0.6 + 0.8 * gC) * soft * (1.0 + along);
      let tw = 0.6 + 0.4 * sin(t * (7.0 + gC * 9.0) + gA * 40.0);
      let grain = exp(-(da * da + dl * dl) / (gr * gr)) * step(0.35, gB) * (1.0 - smoothstep(0.55, 1.0, along)) * smoothstep(0.0, 0.08, along) * tw;
      col += grain * mix(mix(a, b, along), vec3f(1.0, 0.88, 0.7), sC) * 1.4 * sparkle * sT * tent.z * boost * tSpec / soft;
    }
  }

  let na = i32(arms.x);
  // Oral arms shorten and fade into the coma.
  let armFade = (1.0 - sB) * (1.0 - 0.4 * sT);
  for (var k = 0; k < 16; k++) {
    if (k >= na || armFade <= 0.0) {
      break;
    }
    let fk = f32(k);
    let ua = select((fk + 0.5) / arms.x * 2.0 - 1.0, 0.0, na == 1);
    let rootA0 = 0.05 - height * lowK * 0.45 * sqrt(max(1.0 - ua * ua * 0.1, 0.0));
    let pinchA = bellPinch((rootA0 - 0.05) / height, lowK, contract);
    let rootA = mix(rootA0, ccY, 0.85 * sB);
    let lenA = shape.x * tent.y * arms.y * (0.85 + 0.3 * fract(sin(fk * 7.7 + 2.0 + seed * 13.1) * 9631.1)) * pull * mix(1.0, 0.35, sB);
    let alongA = (rootA - p.y) / lenA;
    if (alongA < 0.0 || alongA > 1.0) {
      continue;
    }
    let wv = (sin(alongA * 5.0 - t * 1.3 + fk * 2.1) * alongA * (0.08 + mids * flow.w * 0.18) * shape.x
      + sin(alongA * 11.0 - t * 2.2 + fk * 1.3) * alongA * 0.02) * calm * latK + (lag * latK + wPush) * alongA * alongA * 0.7;
    let xa = ua * radius * 0.28 * pinchA * (1.0 - alongA * (0.35 * furl - 0.3 * fanK * billow - 0.5 * (cFan + wSplay))) + wv + current * alongA * alongA * 0.8 * (1.0 - sT);
    let frill = 1.0 + 0.45 * sin(alongA * 34.0 - t * 2.0 + fk * 3.0);
    let wA = mix(0.022, 0.012, alongA) * (shape.x / 0.42) * frill * soft;
    let dxa = (p.x - xa) / wA;
    let ribbon = exp(-dxa * dxa) * (1.0 - smoothstep(0.6, 1.0, alongA)) * smoothstep(0.0, 0.06, alongA);
    // Fine detail: bright frilled edges on each ribbon.
    let ex = abs(dxa) - 0.8;
    let edgeA = exp(-ex * ex * 10.0) * (1.0 - smoothstep(0.6, 1.0, alongA)) * smoothstep(0.0, 0.06, alongA);
    col += (ribbon + edgeA * 0.35) * mix(mix(a, b, 0.35 + 0.4 * alongA), comaCol, sC) * 0.32 * arms.z * boost / soft * armFade;
  }
  // Depth haze: tint far jellies toward deep violet-blue and lower their contrast (underwater cue, fades in space).
  let hz = clamp(farD * haze * 0.5, 0.0, 0.85) * (1.0 - 0.7 * th);
  let lum = dot(col, vec3f(0.3, 0.5, 0.2));
  col = mix(col, vec3f(0.32, 0.28, 0.85) * lum * 1.3 + vec3f(lum) * 0.15, hz);
  col = col / (1.0 + col * hz * 1.5);
  return col;
}
`;

function hash11(x: number): number {
  const v = Math.sin(x * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function fract(x: number): number {
  return x - Math.floor(x);
}

function hueRGB(h: number): [number, number, number] {
  const a = h * Math.PI * 2;
  return [0.55 + 0.45 * Math.cos(a), 0.55 + 0.45 * Math.cos(a - 2.1), 0.55 + 0.45 * Math.cos(a + 2.1)];
}

interface Wave {
  x: number;
  y: number;
  r: number;
  born: number;
  src: number;
  hit: boolean[];
  color: [number, number, number];
  sc: number;
}

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'jellyfish/bell',
    label: 'Jellyfish Bell',
    description: 'Glowing translucent jellyfish swarm over deep space; bass onsets make one jelly emit a shockwave.',
    tags: ['jellyfish', 'cosmic'],
    inputs: {},
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Bell over space.',
      },
    },
    controls: {
      theme: { type: 'number', group: 'Theme', label: 'Aquarium ↔ Space', default: 0, min: 0, max: 1, step: 0.001 },
      autoTheme: { type: 'number', group: 'Theme', label: 'Auto toggle', default: 1, min: 0, max: 1, step: 1 },
      autoMin: { type: 'number', group: 'Theme', label: 'Toggle min (s)', default: 5, min: 0.5, max: 120, step: 0.1 },
      autoMax: { type: 'number', group: 'Theme', label: 'Toggle max (s)', default: 15, min: 0.5, max: 240, step: 0.1 },
      autoBlend: { type: 'number', group: 'Theme', label: 'Transition (s)', default: 2.5, min: 0.05, max: 20, step: 0.05 },
      cometTrail: { type: 'number', group: 'Theme', label: 'Comet trail brightness', default: 0.4, min: 0, max: 3, step: 0.01 },
      size: { type: 'number', group: 'Bell', label: 'Size', default: 0.42, min: 0.05, max: 3.2, step: 0.01 },
      height: { type: 'number', group: 'Bell', label: 'Dome height', default: 0.8, min: 0.1, max: 3, step: 0.01 },
      pulse: { type: 'number', group: 'Audio', label: 'Bass pulse', default: 0.6, min: 0, max: 4, step: 0.01 },
      halo: { type: 'number', group: 'Bell', label: 'Halo', default: 1, min: 0, max: 8, step: 0.01 },
      hue: { type: 'number', group: 'Color', label: 'Hue', default: 0.8, min: 0, max: 1, step: 0.01 },
      hueVariety: { type: 'number', group: 'Color', label: 'Hue variety', default: 0.8, min: 0, max: 3, step: 0.01 },
      tentacleCount: { type: 'number', group: 'Tentacles', label: 'Count', default: 11, min: 0, max: 64, step: 1 },
      tentacleLength: { type: 'number', group: 'Tentacles', label: 'Length', default: 1.95, min: 0, max: 48, step: 0.01 },
      lengthVariation: { type: 'number', group: 'Tentacles', label: 'Length variation', default: 0.6, min: 0, max: 0.98, step: 0.01 },
      tentacleGlow: { type: 'number', group: 'Tentacles', label: 'Glow', default: 1, min: 0, max: 8, step: 0.01 },
      dotSpeed: { type: 'number', group: 'Dot flow', label: 'Speed', default: 1, min: 0, max: 16, step: 0.01 },
      dotSpeedVariation: { type: 'number', group: 'Dot flow', label: 'Speed variation', default: 0.5, min: 0, max: 3, step: 0.01 },
      dotSpacing: { type: 'number', group: 'Dot flow', label: 'Density', default: 40, min: 1, max: 400, step: 1 },
      armCount: { type: 'number', group: 'Oral arms', label: 'Count', default: 4, min: 0, max: 16, step: 1 },
      armLength: { type: 'number', group: 'Oral arms', label: 'Length', default: 0.5, min: 0, max: 3, step: 0.01 },
      armGlow: { type: 'number', group: 'Oral arms', label: 'Glow', default: 1, min: 0, max: 8, step: 0.01 },
      sway: { type: 'number', group: 'Audio', label: 'Mids sway', default: 0.8, min: 0, max: 6, step: 0.01 },
      reactivity: { type: 'number', group: 'Audio', label: 'Reactivity', default: 1, min: 0, max: 8, step: 0.01 },
      count: { type: 'number', group: 'Swarm', label: 'Count', default: 7, min: 1, max: 64, step: 1 },
      sizeMin: { type: 'number', group: 'Swarm', label: 'Size min', default: 0.61, min: 0.02, max: 4, step: 0.01 },
      sizeMax: { type: 'number', group: 'Swarm', label: 'Size max', default: 1, min: 0.02, max: 4, step: 0.01 },
      tilt: { type: 'number', group: 'Swarm', label: 'Tilt', default: 0.35, min: 0, max: 2.4, step: 0.01 },
      driftSpeed: { type: 'number', group: 'Swarm', label: 'Drift speed', default: 0.04, min: 0, max: 1.2, step: 0.001 },
      waveSpeed: { type: 'number', group: 'Shockwave', label: 'Wave speed', default: 1.2, min: 0, max: 16, step: 0.01 },
      cooldown: { type: 'number', group: 'Shockwave', label: 'Cooldown', default: 0.35, min: 0, max: 5, step: 0.05 },
      triggerSensitivity: { type: 'number', group: 'Shockwave', label: 'Trigger sensitivity', default: 1, min: 0, max: 4, step: 0.01 },
      idleInterval: { type: 'number', group: 'Shockwave', label: 'Idle interval', default: 2.5, min: 0, max: 20, step: 0.1 },
      brightness: { type: 'number', group: 'Look', label: 'Brightness', default: 1.8, min: 0, max: 6, step: 0.01 },
      toneSoftness: { type: 'number', group: 'Look', label: 'Tone softness', default: 0.6, min: 0, max: 3, step: 0.01 },
      swimFrequency: { type: 'number', group: 'Swim', label: 'Swim frequency', default: 0.15, min: 0, max: 4, step: 0.01 },
      thrust: { type: 'number', group: 'Swim', label: 'Thrust', default: 0.6, min: 0, max: 8, step: 0.01 },
      strokeDepth: { type: 'number', group: 'Swim', label: 'Stroke depth', default: 1, min: 0, max: 2, step: 0.01 },
      lunge: { type: 'number', group: 'Swim', label: 'Lunge', default: 1.5, min: 0, max: 5, step: 0.01 },
      waveDistortion: { type: 'number', group: 'Shockwave', label: 'Distortion', default: 20, min: 0, max: 60, step: 0.01 },
      ringCount: { type: 'number', group: 'Shockwave', label: 'Ring count', default: 3, min: 1, max: 6, step: 1 },
      ringSpacing: { type: 'number', group: 'Shockwave', label: 'Ring spacing', default: 0.12, min: 0.02, max: 0.6, step: 0.005 },
      spread: { type: 'number', group: 'Swarm', label: 'Spread', default: 1, min: 0, max: 2, step: 0.01 },
      waveReach: { type: 'number', group: 'Shockwave', label: 'Reach', default: 3, min: 0.1, max: 6, step: 0.01 },
      tentacleFlow: { type: 'number', group: 'Tentacles', label: 'Flow', default: 1, min: 0, max: 3, step: 0.01 },
      headingSpread: { type: 'number', group: 'Swim', label: 'Heading spread', default: 0.7, min: 0, max: 1, step: 0.01 },
      speedVariation: { type: 'number', group: 'Swim', label: 'Speed variation', default: 0.6, min: 0, max: 1, step: 0.01 },
      depthSpeed: { type: 'number', group: 'Swim', label: 'Depth speed', default: 1, min: 0, max: 2, step: 0.01 },
      bellGlow: { type: 'number', group: 'Bell', label: 'Inner glow', default: 1.5, min: 0, max: 5, step: 0.01 },
      depthHaze: { type: 'number', group: 'Look', label: 'Depth haze', default: 1, min: 0, max: 2, step: 0.01 },
      heroSize: { type: 'number', group: 'Swarm', label: 'Hero size', default: 2.2, min: 0, max: 5, step: 0.01 },
      trails: { type: 'number', group: 'Swim', label: 'Light trails', default: 1, min: 0, max: 3, step: 0.01 },
      tentacleSpectrum: { type: 'number', group: 'Audio FX', label: 'Tentacle spectrum', default: 1, min: 0, max: 3, step: 0.01 },
      rimSpectrum: { type: 'number', group: 'Audio FX', label: 'Rim spectrum', default: 1, min: 0, max: 3, step: 0.01 },
      heroLead: { type: 'number', group: 'Audio FX', label: 'Hero lead', default: 1, min: 0, max: 3, step: 0.01 },
      beatDots: { type: 'number', group: 'Audio FX', label: 'Beat dots', default: 1, min: 0, max: 3, step: 0.01 },
      beatStep: { type: 'number', group: 'Audio FX', label: 'Beat step', default: 0.5, min: 0, max: 4, step: 0.01 },
      heroRoam: { type: 'number', group: 'Swarm', label: 'Hero roam', default: 0.8, min: 0, max: 1, step: 0.01 },
      currentSpread: { type: 'number', group: 'Tentacles', label: 'Current spread', default: 1, min: 0, max: 3, step: 0.01 },
      wavePush: { type: 'number', group: 'Shockwave', label: 'Tentacle push', default: 1.5, min: 0, max: 4, step: 0.01 },
    },
    controlDescriptions: {
      autoTheme: 'When 1, the theme toggles between Aquarium and Space on its own at random intervals.',
      autoMin: 'Shortest time between automatic theme toggles.',
      autoMax: 'Longest time between automatic theme toggles.',
      autoBlend: 'How long an automatic theme transition takes.',
      cometTrail: 'Brightness of comet tails in space mode, relative to the tentacle glow.',
      theme:
        'Master scene theme. 0 is the aquarium; 1 is space, where each jellyfish morphs in place into a comet: tentacles straighten into a curved warm dust tail and a straight flickering blue ion tail, then the bell rounds into an icy nucleus and glowing coma, then colours shift. Strokes become coma pulses, motion turns ballistic and shockwaves become solar flares. Other scene parts follow this value.',
      size: 'Bell radius.',
      height: 'Dome height relative to width.',
      pulse: 'How strongly bass contracts the bell.',
      halo: 'Soft glow around the bell.',
      hue: 'Base bell color.',
      hueVariety: 'How far each jellyfish hue spreads around the color wheel; 0 uses the base hue for all.',
      tentacleCount: 'Number of tentacles.',
      tentacleLength: 'Longest tentacle length relative to bell size.',
      lengthVariation: 'How much shorter some tentacles are.',
      tentacleGlow: 'Tentacle brightness.',
      dotSpeed: 'How fast glowing dots flow down the tentacles.',
      dotSpeedVariation: 'How much dot speed differs between tentacles.',
      dotSpacing: 'How many dots appear along each tentacle.',
      armCount: 'Number of frilly oral arms near the centre.',
      armLength: 'Oral arm length relative to the tentacles.',
      armGlow: 'Oral arm brightness.',
      sway: 'How strongly mids make the tentacles sway.',
      reactivity: 'Master scale for all audio reactions.',
      count: 'Number of jellyfish floating on screen.',
      sizeMin: 'Smallest jellyfish scale, as a multiplier of Size. Each jelly picks a stable random scale between min and max (swapped if min > max).',
      sizeMax: 'Largest jellyfish scale, as a multiplier of Size. The largest scale is the nearest depth: full brightness and full speed.',
      tilt: 'Extra slow wandering of each heading, in radians.',
      driftSpeed: 'How fast jellyfish drift upward.',
      waveSpeed: 'How fast shockwaves expand, in screen units per second.',
      cooldown: 'Minimum seconds between shockwave triggers.',
      triggerSensitivity: 'How easily bass, broadband-flux and snare onsets fire shockwaves; higher lowers the onset thresholds.',
      idleInterval: 'Fire a shockwave anyway if nothing fired for this many seconds; 0 disables.',
      brightness: 'Multiplies jelly color before the soft tone curve.',
      toneSoftness: 'Coefficient k in col/(1+col*k); higher compresses highlights more.',
      waveDistortion: 'Directly scales how strongly shockwaves bend the image (refraction amplitude); 20 is a strong warp.',
      ringCount: 'Concentric rings per shockwave: one bright leading ring plus fainter trailing ones.',
      ringSpacing: 'Gap between successive rings, in screen units, scaled by the jelly size.',
      spread: 'Horizontal spread of the swarm; 1 spans the full screen width, 0 stacks them at the centre, 2 spreads past both edges.',
      waveReach: 'How far a shockwave travels, in aspect-corrected screen units, before it fades out and is recycled.',
      swimFrequency: 'Average pulse bursts per second for each jellyfish; bursts come at random intervals.',
      strokeDepth: 'How far the bell margin closes inward and down during each contraction (the dome stays rounded); 0 disables the squeeze.',
      lunge: 'Forward distance a jellyfish lunges along its heading during each contraction (power stroke); it then coasts.',
      tentacleFlow: 'How much tentacles drift, fan out and sway in the water current; 0 keeps them trailing straight.',
      headingSpread: 'How widely jellyfish headings spread away from up; 1 gives about plus or minus 100 degrees, with a few drifting down-diagonal.',
      speedVariation: 'Per-jelly differences in speed, lunge and stroke tempo; 1 gives about 0.4x to 1.8x.',
      depthSpeed: 'Parallax: scales drift, lunge and glide speed by each jelly size relative to Size max, so closer jellies move faster; 0 disables.',
      thrust: 'How far each bell stroke pushes a jellyfish along its heading.',
      bellGlow: 'Inner light of each translucent bell: apex glow, glowing margin, subsurface tint and luminous ribs.',
      depthHaze: 'Smaller (farther) jellies get softer, blurred and tinted toward violet-blue haze; close ones gain a soft halo. 0 disables.',
      heroSize: 'Jelly 0 becomes a slow hero this many times Size max, drifting in the left or right third and staying on screen; 0 disables.',
      tentacleSpectrum: 'Maps the spectrum across each jelly\'s tentacles (low on one side, high on the other); each band brightens its tentacle line and dots.',
      rimSpectrum: 'Circular equaliser: the bell rim glows and swells outward with the spectrum band at each rim angle.',
      heroLead: 'Hero jelly inner glow follows the overall level; its hue slides from warm (low spectral centroid) to cool (high).',
      beatDots: 'Amount of the eased downward dot-flow step added on each detected beat, on top of the continuous flow.',
      beatStep: 'Beat step size in dot spacings (scaled by Beat dots and Reactivity); eases in over about 0.15 s.',
      heroRoam: 'How freely the hero roams: it swims toward a new random point every 8-15 s within about 80% of the screen and stays on screen; 0 keeps it in its home box.',
      currentSpread: 'Slow per-jelly water current: tentacle tips fan wider and drift together in a slowly changing direction; 0 disables.',
      wavePush: 'A passing shockwave pushes and splays tentacles away from its origin, then they spring back over about 1.5 s; 0 disables.',
      trails: 'Brightness of the dissolving glowing specks left behind each lunge (last 3 lunges, fade in about 1.5 s); 0 disables.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    const view = uniform(new Vector4(0, aspect, 0, 0));
    const shape = uniform(new Vector4(0.42, 0.8, 0.6, 1));
    const tint = uniform(new Vector4(0.8, 0.3, 1, 0));
    const tent = uniform(new Vector4(11, 1.95, 1, 0.6));
    const flow = uniform(new Vector4(1, 0.5, 40, 0.8));
    const arms = uniform(new Vector4(4, 0.5, 1, 0));
    const swarm = uniform(new Vector4(7, 3, 0.12, 1)); // count, ring count, ring spacing, largest jelly scale
    const audio = uniform(new Vector4(0, 1, 1, 1)); // highs, reactivity, wave distortion, tentacle flow
    const look = uniform(new Vector4(1.5, 1, 1, 1)); // bell glow, depth haze, trails, current spread
    const fx = uniform(new Vector4(0, 0, 0, 0)); // tentacle spectrum, rim spectrum, hero lead (all x reactivity), beat phase
    const space = uniform(new Vector4(0, 0, 0, 0)); // theme, tail stage, coma stage, colour stage

    const buf = new Float32Array(MAX * ROWS * 4);
    const dataTex = new DataTexture(buf, MAX, ROWS, RGBAFormat, FloatType);
    dataTex.minFilter = NearestFilter;
    dataTex.magFilter = NearestFilter;
    dataTex.generateMipmaps = false;
    dataTex.needsUpdate = true;

    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    material.fragmentNode = (wgslFn(bellPass) as any)(uv(), view, shape, tint, tent, flow, arms, swarm, audio, look, fx, space, texture(dataTex));
    const scene = new Scene();
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    // Audio state.
    let bass = 0;
    let mids = 0;
    let highs = 0;
    let peakB = 0.02;
    let peakM = 0.02;
    let peakH = 0.02;
    let slowBass = 0;
    let slowFlux = 0;
    let slowSnare = 0;
    let peakFlux = 0.001;
    const prevMags = new Float32Array(128);
    let lastOnset = -10;
    let lastFired = -1;
    // Audio FX state: 32-band smoothed spectrum with per-band auto-gain, beat-stepped dot phase.
    const spec = new Float32Array(NB);
    const specPeak = new Float32Array(NB).fill(0.02);
    let beatTarget = 0;
    let beatPhase = 0;
    let lastBeat = -10;
    const wobbleAt = new Float64Array(MAX).fill(-100);
    const nGlowAt = new Float64Array(MAX).fill(-100);
    const nGlowCol: [number, number, number][] = Array.from({ length: MAX }, () => [0, 0, 0] as [number, number, number]);
    // Trails: last 3 lunge points per jelly (slot 0 newest).
    const trX = new Float32Array(MAX * 3);
    const trY = new Float32Array(MAX * 3);
    const trT = new Float64Array(MAX * 3).fill(-100);

    // Jelly state.
    const px = new Float32Array(MAX);
    const py = new Float32Array(MAX);
    const ps = new Float32Array(MAX);
    const lastTrig = new Float64Array(MAX).fill(-100);
    const pendingAt = new Float64Array(MAX).fill(-1);
    const emitAt = new Float64Array(MAX).fill(-1);
    let waves: Wave[] = [];
    // Swim state.
    const vx = new Float32Array(MAX);
    const vy = new Float32Array(MAX);
    const head = new Float32Array(MAX);
    const sq = new Float32Array(MAX);
    const sqV = new Float32Array(MAX);
    const phase = new Float64Array(MAX);
    const stretch = new Float32Array(MAX);
    const lag = new Float32Array(MAX);
    const nextBurst = new Float64Array(MAX);
    const strokeStart = new Float64Array(MAX).fill(-100);
    const strokesLeft = new Int32Array(MAX);
    let inited = false;
    // Wave push springs (world-space push, splay) per jelly.
    const wpX = new Float32Array(MAX);
    const wpY = new Float32Array(MAX);
    const wpVx = new Float32Array(MAX);
    const wpVy = new Float32Array(MAX);
    const wpS = new Float32Array(MAX);
    const wpSv = new Float32Array(MAX);
    // Comet tail direction (world, unit, opposite velocity, smoothed), its angle and smoothed turn rate.
    const tdX = new Float32Array(MAX);
    const tdY = new Float32Array(MAX).fill(-1);
    const tdPhi = new Float32Array(MAX);
    const tdOm = new Float32Array(MAX);
    // Theme (lightly smoothed; snaps on the first frame so a saved scene opens in its theme).
    let themeS = 0;
    let themeInit = false;
    let autoTarget = 0;
    let autoNext = 0;
    let autoPos = 0;
    // Hero roam target.
    let heroTx = 0;
    let heroTy = 0.3;
    let heroNext = -1;
    // Medusa stroke, C1 piecewise cosine in stroke-relative time (seconds / per-stroke duration multiplier):
    // contraction 0 -> 1 (margin closes, power stroke), slow recovery 1 -> -OV (gentle widening), settle -OV -> 0.
    const TC = 0.3;
    const TR = 0.75;
    const TS = 0.55;
    const OV = 0.14;
    const CARRY = 0.35; // fade-out time of an interrupted stroke (keeps value and slope continuous)
    const strokeDur = new Float32Array(MAX).fill(1);
    const strokeNextAt = new Float64Array(MAX).fill(-100);
    const carryC = new Float32Array(MAX);
    const carryV = new Float32Array(MAX);
    const carryT = new Float64Array(MAX).fill(-100);
    const trigDur = new Float32Array(MAX).fill(1);
    const prevC = new Float32Array(MAX);
    const bellC = new Float32Array(MAX);
    const furl = new Float32Array(MAX);
    const furlV = new Float32Array(MAX);
    const spdM = new Float32Array(MAX).fill(1);
    const tempo = new Float32Array(MAX).fill(1);
    const strokeShape = (x: number) => {
      if (x <= 0) return 0;
      if (x < TC) return 0.5 - 0.5 * Math.cos((Math.PI * x) / TC);
      if (x < TC + TR) {
        const u = (x - TC) / TR;
        return 1 - (1 + OV) * (0.5 - 0.5 * Math.cos(Math.PI * u));
      }
      if (x < TC + TR + TS) {
        const u = (x - TC - TR) / TS;
        return -OV * (0.5 + 0.5 * Math.cos(Math.PI * u));
      }
      return 0;
    };
    // Current stroke plus the fading remainder of an interrupted one (linear extrapolation, cosine fade).
    const strokeEval = (i: number, tau: number) => {
      const base = strokeShape((tau - strokeStart[i]) / strokeDur[i]);
      const ca = tau - carryT[i];
      if (ca <= -0.01 || ca >= CARRY) return base;
      const f = ca <= 0 ? 1 : 0.5 + 0.5 * Math.cos((Math.PI * ca) / CARRY);
      return base + (carryC[i] + carryV[i] * ca) * f;
    };
    const STROKE_IN = 0.2;
    const STROKE_OUT = 0.6;
    // Contract 0.2 s ease-in-out, relax 0.6 s ease-out.
    const strokeEnv = (a: number) => {
      if (a < 0 || a >= STROKE_IN + STROKE_OUT) return 0;
      if (a < STROKE_IN) {
        const x = a / STROKE_IN;
        return x * x * (3 - 2 * x);
      }
      const x = (a - STROKE_IN) / STROKE_OUT;
      return (1 - x) * (1 - x);
    };
    const FADE = 2.5;
    let rng = 1;
    const rand = () => {
      rng = (rng * 16807) % 2147483647;
      return rng / 2147483647;
    };
    // Start a stroke at `at`; whatever stroke is in progress at `now` hands over smoothly via the carry.
    const startStroke = (i: number, now: number, at: number) => {
      const c0 = strokeEval(i, now);
      const c1 = strokeEval(i, now - 0.001);
      carryC[i] = c0;
      carryV[i] = (c0 - c1) / 0.001;
      carryT[i] = now;
      strokeStart[i] = at;
      // Record the lunge origin for the light trail.
      for (let k = 2; k > 0; k--) {
        trX[i * 3 + k] = trX[i * 3 + k - 1];
        trY[i * 3 + k] = trY[i * 3 + k - 1];
        trT[i * 3 + k] = trT[i * 3 + k - 1];
      }
      trX[i * 3] = px[i];
      trY[i * 3] = py[i];
      trT[i * 3] = at;
      const tp = Math.max(0.3, tempo[i]);
      strokeDur[i] = ((0.85 + 0.3 * hash11((i + 1) * 17 + 21.3)) * (0.9 + 0.2 * rand())) / Math.sqrt(tp);
      strokeNextAt[i] = at + strokeDur[i] * (TC + TR) + (0.05 + 0.3 * rand()) / tp;
    };

    const band = (mags: ArrayLike<number>, lo: number, hi: number) => {
      let s = 0;
      for (let i = lo; i < hi; i++) s += mags[i] ?? 0;
      return s / (hi - lo);
    };
    const set = (col: number, row: number, a: number, b: number, c: number, d: number) => {
      const o = (row * MAX + col) * 4;
      buf[o] = a;
      buf[o + 1] = b;
      buf[o + 2] = c;
      buf[o + 3] = d;
    };

    return {
      update(frame) {
        const c = frame.controls as any;
        const t = frame.timeSeconds;
        const dt = Math.min(Math.max(frame.deltaSeconds ?? 0.016, 0), 0.1);
        const react = c.reactivity ?? 1;
        const count = Math.max(1, Math.min(MAX, Math.round(c.count)));

        // Master theme: owned here, lightly smoothed, published for the other parts.
        let themeT = Math.max(0, Math.min(1, c.theme ?? 0));
        if ((c.autoTheme ?? 0) >= 0.5) {
          const tNow = frame.timeSeconds;
          const lo = Math.min(c.autoMin ?? 5, c.autoMax ?? 15);
          const hi = Math.max(c.autoMin ?? 5, c.autoMax ?? 15);
          if (autoNext <= 0 || tNow < autoNext - hi - 1) autoNext = tNow + lo + Math.random() * (hi - lo);
          if (tNow >= autoNext) {
            autoTarget = autoTarget > 0.5 ? 0 : 1;
            autoNext = tNow + lo + Math.random() * (hi - lo);
          }
          const step = dt / Math.max(0.05, c.autoBlend ?? 2.5);
          autoPos += Math.max(-step, Math.min(step, autoTarget - autoPos));
          themeT = autoPos * autoPos * (3 - 2 * autoPos);
        } else {
          autoPos = themeT;
          autoTarget = themeT > 0.5 ? 1 : 0;
        }
        if (!themeInit) {
          themeInit = true;
          themeS = themeT;
        } else themeS += (themeT - themeS) * (1 - Math.exp(-dt / 0.2));
        if (Math.abs(themeT - themeS) < 1e-4) themeS = themeT;
        const th = themeS;
        jellyShared.theme = th;
        const stTail = smooth01(th / 0.55);
        const stComa = smooth01((th - 0.2) / 0.55);
        const stColor = smooth01((th - 0.45) / 0.55);
        // Space: strokes damp out (they remain as coma pulses); drag drops and a gentle steady push keeps comets gliding.
        const strokeK = 1 - 0.92 * th;
        const cruiseK = 0.12 * Math.min(2, Math.max(0.25, (c.lunge ?? 1.5) / 1.5)) * th;

        // Auto-gained audio bands.
        const spectrum = frame.audioSpectrum;
        let rawB = 0;
        let rawM = 0;
        let rawH = 0;
        if (spectrum?.available) {
          rawB = band(spectrum.magnitudes, 6, 24);
          rawM = band(spectrum.magnitudes, 40, 80);
          rawH = band(spectrum.magnitudes, 85, 120);
        }
        const decay = Math.exp(-dt / 4);
        peakB = Math.max(rawB, peakB * decay, 0.02);
        peakM = Math.max(rawM, peakM * decay, 0.02);
        peakH = Math.max(rawH, peakH * decay, 0.02);
        const nB = Math.min(1, rawB / peakB);
        const nM = Math.min(1, rawM / peakM);
        const nH = Math.min(1, rawH / peakH);
        const rel = Math.exp(-dt / 0.15);
        bass = nB > bass ? bass + (nB - bass) * 0.7 : bass * rel;
        mids += (nM - mids) * Math.min(1, dt * 8);
        highs = nH > highs ? highs + (nH - highs) * 0.6 : highs * Math.exp(-dt / 0.2);

        // Swim simulation on CPU.
        // Tentacle hang length (world units, worst case) so long tentacles leave the screen before respawn.
        // Per-jelly scale: stable uniform pick between sizeMin and sizeMax (multipliers of Size), swapped if reversed.
        const sA = Math.max(0.02, c.sizeMin ?? 0.61);
        const sB = Math.max(0.02, c.sizeMax ?? 1);
        const sizeLo = Math.min(sA, sB);
        const sizeHi = Math.max(sA, sB);
        // Tentacle hang length (world units, worst case) so long tentacles leave the screen before respawn.
        const hang = Math.min(10, (c.size ?? 0.42) * sizeHi * (c.tentacleLength ?? 1.95) * 1.7);
        const pad = 0.2 + (c.size ?? 0.42) * sizeHi + Math.max(0, hang - 0.3);
        const hw = Math.max(0.01, aspect * Math.max(0, c.spread ?? 1));
        const xB = Math.max(aspect, hw) + pad;
        const yB = 1 + pad;
        const freq = Math.max(0, c.swimFrequency ?? 0.15);
        const thrustK = c.thrust ?? 0.6;
        const tiltC = c.tilt ?? 0.35;
        const hSpread = Math.max(0, Math.min(1, c.headingSpread ?? 0.7));
        const depthS = Math.max(0, c.depthSpeed ?? 1);
        // Size (depth) stays the dominant speed cue: per-jelly variation shrinks as depth speed grows.
        const sVar = Math.max(0, Math.min(1, c.speedVariation ?? 0.6)) / (1 + 1.5 * depthS);
        const sVarTempo = Math.max(0, Math.min(1, c.speedVariation ?? 0.6));
        for (let i = 0; i < MAX; i++) {
          const s = i + 1;
          spdM[i] = Math.max(0.2, 1 + sVar * (1.4 * hash11(s * 17 + 24.1) - 0.6));
          tempo[i] = Math.max(0.3, 1 + sVarTempo * 0.6 * (2 * hash11(s * 17 + 27.3) - 1));
        }
        // Preferred heading per jelly: wide spread around up, a few drifting down-diagonal.
        const prefHead = (i: number) => {
          const s = i + 1;
          const h6 = hash11(s * 17 + 18.9);
          const h7 = hash11(s * 17 + 21.7);
          if (h7 < 0.15) return (h6 < 0.5 ? -1 : 1) * hSpread * (2.8 + 0.6 * fract(h6 * 7.13));
          return hSpread * 1.75 * (2 * h6 - 1);
        };
        const scheduleBurst = (i: number) => {
          const mean = 1 / Math.max(freq * tempo[i], 0.01);
          nextBurst[i] = t + mean * (0.3 + 1.4 * rand());
        };
        // Re-enter from the screen edge opposite the heading (side or top/bottom, weighted by direction).
        const respawn = (i: number) => {
          const ux = -Math.sin(head[i]);
          const uy = Math.cos(head[i]);
          const ax = Math.abs(ux);
          const ay = Math.abs(uy);
          if (rand() * (ax + ay) < ax) {
            px[i] = -Math.sign(ux) * (xB - 0.05);
            py[i] = (rand() * 2 - 1) * 1.1;
          } else {
            py[i] = -Math.sign(uy) * (yB - 0.05);
            px[i] = (rand() * 2 - 1) * hw;
          }
          vx[i] = vy[i] = 0;
          for (let k = 0; k < 3; k++) trT[i * 3 + k] = -100;
          tdX[i] = -ux;
          tdY[i] = -uy;
          tdPhi[i] = Math.atan2(tdY[i], tdX[i]);
          tdOm[i] = 0;
        };
        if (!inited) {
          inited = true;
          for (let i = 0; i < MAX; i++) {
            const s = i + 1;
            px[i] = (hash11(s * 17 + 0.3) * 2 - 1) * hw;
            py[i] = (hash11(s * 17 + 3.4) * 2 - 1) * yB;
            head[i] = prefHead(i);
            vx[i] = vy[i] = sq[i] = sqV[i] = phase[i] = stretch[i] = lag[i] = 0;
            furl[i] = furlV[i] = prevC[i] = bellC[i] = carryC[i] = carryV[i] = 0;
            carryT[i] = -100;
            strokeDur[i] = 1;
            strokeNextAt[i] = -100;
            strokeStart[i] = -100;
            strokesLeft[i] = 0;
            tdX[i] = Math.sin(head[i]);
            tdY[i] = -Math.cos(head[i]);
            tdPhi[i] = Math.atan2(tdY[i], tdX[i]);
            tdOm[i] = 0;
            scheduleBurst(i);
          }
        }
        const heroK = Math.max(0, c.heroSize ?? 2.2);
        // Hero home: centre of the left or right third (stable), upper half.
        const heroCx = (hash11(7.7) < 0.5 ? -1 : 1) * aspect * (2 / 3);
        const heroCy = 0.3;
        const heroHx = aspect * 0.2;
        const heroHy = 0.3;
        const roam = Math.max(0, Math.min(1, c.heroRoam ?? 0.8));
        if (heroNext < 0 || t >= heroNext) {
          heroNext = t + 8 + 7 * rand();
          heroTx = (rand() * 2 - 1) * aspect * 0.8;
          heroTy = 0.16 + (rand() * 2 - 1) * 0.68;
        }
        // Steering goal and confinement box blend from the home box (roam 0) to most of the screen.
        const hGx = heroCx + (heroTx - heroCx) * roam;
        const hGy = heroCy + (heroTy - heroCy) * roam;
        const bCx = heroCx * (1 - roam);
        const bCy = heroCy + (0.16 - heroCy) * roam;
        const bHx = heroHx + (aspect * 0.85 - heroHx) * roam;
        const bHy = heroHy + (0.8 - heroHy) * roam;
        const sHx = heroHx + (0.25 - heroHx) * roam;
        const sHy = heroHy + (0.25 - heroHy) * roam;
        for (let i = 0; i < count; i++) {
          const s = i + 1;
          const isHero = i === 0 && heroK > 0;
          const h3 = hash11(s * 17 + 6.5);
          const h4 = hash11(s * 17 + 9.6);
          const h5 = hash11(s * 17 + 12.7);
          const scale = isHero ? sizeHi * heroK : sizeHi - (sizeHi - sizeLo) * h5;
          ps[i] = scale;
          // Parallax speed: proportional to scale relative to the largest jelly, times per-jelly variation.
          const mv = isHero ? 0.35 : Math.pow(scale / sizeHi, depthS) * spdM[i];

          // Bursts: a few strokes, then rest for a random interval (per-jelly tempo).
          if (strokesLeft[i] > 0 && t >= strokeNextAt[i]) {
            startStroke(i, t, t);
            strokesLeft[i]--;
            if (strokesLeft[i] === 0) scheduleBurst(i);
          } else if (strokesLeft[i] === 0 && freq > 0 && t >= nextBurst[i] && t >= strokeNextAt[i]) {
            strokesLeft[i] = Math.floor(rand() * 4);
            startStroke(i, t, t);
            if (strokesLeft[i] === 0) scheduleBurst(i);
          } else if (freq <= 0) {
            nextBurst[i] = t + 1;
          }

          // Spring target: stroke + shockwave trigger + bass punch, all additive.
          const wob = strokeEnv(t - wobbleAt[i]) * 0.25;
          const target = wob + bass * react * (c.pulse ?? 0.6) * 0.8;
          // Critically damped spring (omega 14 rad/s), sub-stepped for stability.
          const w = 14;
          const sub = 4;
          const hdt = dt / sub;
          for (let k = 0; k < sub; k++) {
            sqV[i] += (w * w * (target - sq[i]) - 2 * w * sqV[i]) * hdt;
            sq[i] += sqV[i] * hdt;
          }

          // Bell contraction: smooth stroke curve plus the bass/wobble spring, soft-limited (C-infinity tanh).
          const cS = strokeEval(i, t);
          const dC = cS - prevC[i];
          prevC[i] = cS;
          const dCdt = dt > 0 ? dC / dt : 0;
          const depth = Math.max(0, c.strokeDepth ?? 1);
          bellC[i] = 1.6 * Math.tanh((depth * (cS + sq[i])) / 1.6);
          // Tentacle furl: underdamped follower of the stroke, so tentacles lag the bell
          // (stream in during the lunge, billow out with slight overshoot during recovery).
          const fT = Math.max(-0.4, Math.min(1.2, cS + 0.5 * sq[i]));
          const fw = 7;
          for (let k = 0; k < sub; k++) {
            furlV[i] += (fw * fw * (fT - furl[i]) - 2 * 0.7 * fw * furlV[i]) * hdt;
            furl[i] += furlV[i] * hdt;
          }

          // Heading: ease toward this jelly's own preferred heading plus slow wander; no upright pull.
          const wAmp = 0.35 * hSpread + 0.25 * tiltC;
          const wander = wAmp * (0.65 * Math.sin(t * 0.05 * (0.5 + h4) + s * 7.1) + 0.35 * Math.sin(t * 0.13 * (0.5 + h3) + s * 3.3));
          let desired = prefHead(i) + wander;
          if (isHero) {
            // Soft steering: mostly upright, turning toward home when drifting away from it.
            const dxT = hGx - px[i];
            const dyT = hGy - py[i];
            const lim = 1.3 + 1.5 * roam;
            const toH = Math.max(-lim, Math.min(lim, Math.atan2(-dxT, dyT)));
            const dist = Math.hypot(dxT / Math.max(sHx, 0.01), dyT / Math.max(sHy, 0.01));
            const wgt = Math.max(0, Math.min(1, (dist - 0.3) / 0.9));
            desired = wander * 0.6 * (1 - wgt) + toH * wgt;
          }
          const resting = 1 / (1 + Math.max(0, sqV[i]) * 0.5 + Math.max(0, dCdt) * 0.15);
          const dHead = (desired - head[i]) * (1 - Math.exp(-dt * 0.5)) * resting;
          head[i] += dHead;
          const angVel = dt > 0 ? dHead / dt : 0;

          // Thrust: the power stroke (margin closing, dC > 0) lunges along the heading (local up axis);
          // the body then coasts, with extra drag while the bell refills during recovery.
          const upX = -Math.sin(head[i]);
          const upY = Math.cos(head[i]);
          const push = Math.max(0, sqV[i]) * thrustK * 0.35 * mv * strokeK;
          vx[i] += upX * push * dt;
          vy[i] += upY * push * dt;
          const lungeV = Math.max(0, dC) * (c.lunge ?? 1.5) * 0.24 * mv * strokeK;
          vx[i] += upX * lungeV;
          vy[i] += upY * lungeV;
          // Ballistic glide in space: low drag (0.3/s) with a push whose terminal speed is cruiseK * mv.
          const dragR = (1.1 + 0.5 * Math.max(0, -dCdt)) * (1 - th) + 0.3 * th;
          vx[i] += upX * cruiseK * mv * 0.3 * dt;
          vy[i] += upY * cruiseK * mv * 0.3 * dt;
          const damp = Math.exp(-dt * dragR);
          vx[i] *= damp;
          vy[i] *= damp;
          const drift = c.driftSpeed * (0.6 + 0.8 * h3) * mv;
          px[i] += (vx[i] + upX * drift) * dt;
          py[i] += (vy[i] + upY * drift) * dt;

          if (isHero) {
            // Stay on screen: soft pull back inside the home box (no wrapping).
            const ex = px[i] - bCx;
            const ey = py[i] - bCy;
            const bx = Math.sign(ex) * Math.max(0, Math.abs(ex) - bHx);
            const by = Math.sign(ey) * Math.max(0, Math.abs(ey) - bHy);
            const kk = 1 - Math.exp(-dt * 1.2);
            px[i] -= bx * kk;
            py[i] -= by * kk;
            vx[i] -= bx * dt * 0.8;
            vy[i] -= by * dt * 0.8;
          }
          // Wrap / respawn past any screen edge (including tentacle margin).
          else if (px[i] > xB || px[i] < -xB || py[i] > yB || py[i] < -yB) respawn(i);

          // Tentacles trail: stretch lags speed; lateral lag opposes sideways motion and turning.
          const spd = Math.hypot(vx[i], vy[i]);
          stretch[i] += (Math.min(spd * 2.5, 1.5) - stretch[i]) * (1 - Math.exp(-dt * 3));
          const side = -(vx[i] * upY - vy[i] * upX);
          const lagT = (side * 0.6 - angVel * 0.4) * scale;
          lag[i] += (lagT - lag[i]) * (1 - Math.exp(-dt * 2.5));

          // Comet tail: smoothed direction opposite the full velocity (coast + drift), not the heading.
          const Vx = vx[i] + upX * drift;
          const Vy = vy[i] + upY * drift;
          const vm = Math.hypot(Vx, Vy);
          if (vm > 1e-4) {
            const kT = 1 - Math.exp(-dt / 0.45);
            tdX[i] += (-Vx / vm - tdX[i]) * kT;
            tdY[i] += (-Vy / vm - tdY[i]) * kT;
          }
          const tl = Math.hypot(tdX[i], tdY[i]);
          if (tl > 1e-4) {
            tdX[i] /= tl;
            tdY[i] /= tl;
          } else {
            tdX[i] = -upX;
            tdY[i] = -upY;
          }
          const phi = Math.atan2(tdY[i], tdX[i]);
          let dPhi = phi - tdPhi[i];
          if (dPhi > Math.PI) dPhi -= Math.PI * 2;
          else if (dPhi < -Math.PI) dPhi += Math.PI * 2;
          tdPhi[i] = phi;
          const om = dt > 0 ? dPhi / dt : 0;
          tdOm[i] += (om - tdOm[i]) * (1 - Math.exp(-dt / 0.6));
          // Dust lags along the past path: it bends toward the turn (tail-frame +x = tail dir rotated +90 deg).
          const bendTail = Math.max(-1, Math.min(1, -tdOm[i] * 2.5)) * 0.7 + (hash11(s * 17 + 31.9) < 0.5 ? -0.25 : 0.25);

          // Monotonic dot-flow phase (mids already smoothed and non-negative).
          phase[i] += dt * Math.max(0, c.dotSpeed) * (1 + Math.max(0, mids * react) * 1.5);

          const angOut = head[i] + 0.04 * Math.sin(t * 0.4 + s * 9);
          set(i, 0, px[i], py[i], scale, angOut);
          // Tail direction into the jelly frame (same rotation as the shader's lp).
          const cA = Math.cos(angOut);
          const sAo = Math.sin(angOut);
          set(i, TAIL_ROW, cA * tdX[i] + sAo * tdY[i], -sAo * tdX[i] + cA * tdY[i], bendTail, vm);
          // Publish for other parts (same space and units as the shader).
          const sz = c.size ?? 0.42;
          jellyShared.x[i] = px[i];
          jellyShared.y[i] = py[i];
          jellyShared.radius[i] = scale * sz;
          jellyShared.angle[i] = angOut;
          jellyShared.tentacleLen[i] = scale * sz * Math.max(0, c.tentacleLength ?? 1.95) * (1 + stretch[i] * 0.4) * (1 + 0.08 * furl[i]) * (1 + 0.7 * stTail);
        }

        // Per-jelly colours.
        const variety = c.hueVariety ?? 0.8;
        const jellyCol: [number, number, number][] = [];
        for (let i = 0; i < MAX; i++) {
          const hh = c.hue + variety * (i * 0.618034 + 0.15 * hash11(i * 3.7 + 2));
          const a = hueRGB(fract(hh));
          const acc = hueRGB(fract(hh + 0.33 + 0.2 * hash11(i * 5.1 + 9)));
          const b: [number, number, number] = [
            0.35 + (acc[0] - 0.35) * variety,
            0.9 + (acc[1] - 0.9) * variety,
            1.0 + (acc[2] - 1.0) * variety,
          ];
          jellyCol.push(a);
          set(i, 2, a[0], a[1], a[2], i < count ? lag[i] : 0);
          set(i, 3, b[0], b[1], b[2], i < count ? furl[i] : 0);
        }

        const cool = Math.max(0.02, c.cooldown ?? 0.35);
        const trigger = (i: number, delay: number) => {
          // Full stroke now (smooth hand-over from any stroke in progress); the wave is emitted at
          // peak contraction thrust, the fastest margin closing (midpoint of the cosine contraction).
          startStroke(i, t, t + delay);
          strokesLeft[i] = 0;
          lastTrig[i] = t + delay;
          trigDur[i] = strokeDur[i];
          emitAt[i] = t + delay + 0.5 * TC * strokeDur[i];
        };

        // Onset detectors (each auto-gained against its own slow average), OR-ed with a shared cooldown.
        let flux = 0;
        let rawS = 0;
        if (spectrum?.available) {
          const mg = spectrum.magnitudes;
          for (let i = 0; i < 128; i++) {
            const v = mg[i] ?? 0;
            const d = v - prevMags[i];
            if (d > 0) flux += d;
            prevMags[i] = v;
          }
          rawS = band(mg, 30, 70);
        }
        peakFlux = Math.max(flux, peakFlux * decay, 0.002);
        const sens = Math.max(0.01, c.triggerSensitivity ?? 1);
        const ratio = (base: number) => 1 + (base - 1) / sens;
        const bassOn = rawB > slowBass * ratio(1.45) && rawB > 0.01;
        const fluxOn = flux > slowFlux * ratio(1.7) && flux > 0.12 * peakFlux && flux > 0.002;
        const snareOn = rawS > slowSnare * ratio(1.5) && rawS > 0.01;
        slowBass += (rawB - slowBass) * Math.min(1, dt / 1.2);
        slowFlux += (flux - slowFlux) * Math.min(1, dt / 1.2);
        slowSnare += (rawS - slowSnare) * Math.min(1, dt / 1.2);
        // Beat dots: each real onset adds an eased downward phase step (target only grows, so motion is monotonic).
        if ((bassOn || fluxOn || snareOn) && t - lastBeat > cool) {
          lastBeat = t;
          beatTarget += Math.max(0, c.beatStep ?? 0.5) * Math.max(0, c.beatDots ?? 1) * react;
        }
        // Exponential ease, ~95% of each step in 0.15 s; wrap both together to keep precision.
        beatPhase += (beatTarget - beatPhase) * (1 - Math.exp(-dt / 0.05));
        if (beatPhase > 1000) {
          beatPhase -= 1000;
          beatTarget -= 1000;
        }

        // 32-band spectrum: fast attack, ~120 ms release, per-band auto-gain; plus level and centroid.
        let lvl = 0;
        let cw = 0;
        const relS = Math.exp(-dt / 0.12);
        for (let k = 0; k < NB; k++) {
          const raw = spectrum?.available ? band(spectrum.magnitudes, k * 4, k * 4 + 4) : 0;
          specPeak[k] = Math.max(raw, specPeak[k] * decay, 0.02);
          const nv = Math.min(1, raw / specPeak[k]);
          spec[k] = nv > spec[k] ? spec[k] + (nv - spec[k]) * 0.7 : spec[k] * relS;
          set(k, SPEC_ROW, spec[k], 0, 0, 0);
          lvl += spec[k];
          cw += spec[k] * k;
        }
        const centroid = lvl > 0.001 ? cw / lvl / (NB - 1) : 0.5;
        set(NB, SPEC_ROW, lvl / NB, centroid, 0, 0);

        const idle = c.idleInterval ?? 2.5;
        const idleOn = idle > 0 && t - lastOnset > idle;

        // An onset fires ONE random jelly (never the same one twice in a row).
        if ((bassOn || fluxOn || snareOn || idleOn) && t - lastOnset > cool && react > 0) {
          lastOnset = t;
          let pick = Math.floor(rand() * count);
          if (count > 1 && pick === lastFired) pick = (pick + 1 + Math.floor(rand() * (count - 1))) % count;
          if (pick < count && pendingAt[pick] < 0 && emitAt[pick] < 0) {
            lastFired = pick;
            trigger(pick, 0);
          }
        }

        // Emit each wave at its jelly's peak contraction thrust.
        for (let i = 0; i < count; i++) {
          if (emitAt[i] >= 0 && t >= emitAt[i]) {
            emitAt[i] = -1;
            if (waves.length >= MAXW) waves.shift();
            const hit = new Array<boolean>(MAX).fill(false);
            hit[i] = true;
            waves.push({ x: px[i], y: py[i], r: 0, born: t, src: i, hit, color: jellyCol[i], sc: (ps[i] * c.size) / 0.42 });
          }
        }

        // Advance waves; fronts trigger neighbours.
        const reach = Math.max(0.1, c.waveReach ?? 3);
        for (const w of waves) w.r += c.waveSpeed * dt;
        // Recycle by distance travelled; the age cap only guards against a stalled (speed 0) wave.
        waves = waves.filter((w) => w.r < reach && t - w.born < 120 && t >= w.born);
        for (const w of waves) {
          for (let j = 0; j < count; j++) {
            if (w.hit[j]) continue;
            if (Math.hypot(px[j] - w.x, py[j] - w.y) <= w.r) {
              w.hit[j] = true;
              wobbleAt[j] = t; // small smooth wobble only, no new wave
              // Tentacle push away from the wave origin (radial), plus a splay impulse.
              const rxw = px[j] - w.x;
              const ryw = py[j] - w.y;
              const rlw = Math.max(Math.hypot(rxw, ryw), 1e-4);
              const wk = Math.max(0, c.wavePush ?? 1.5) * Math.min(1.5, 0.4 + w.sc * 0.6);
              wpVx[j] += (rxw / rlw) * wk * 2.2;
              wpVy[j] += (ryw / rlw) * wk * 2.2;
              wpSv[j] += wk * 1.6;
              nGlowAt[j] = t;
              nGlowCol[j] = w.color;
            }
          }
        }

        // Per-jelly contraction and glow (smooth flash peaking at full contraction of a triggered stroke).
        for (let i = 0; i < MAX; i++) {
          let glow = 0;
          const a = t - lastTrig[i];
          if (i < count && a >= 0 && a < 3) {
            const td = trigDur[i];
            const x = a / td;
            const flash = x < TC ? 0.5 - 0.5 * Math.cos((Math.PI * x) / TC) : Math.exp(-(((a - TC * td) / 0.7) ** 2));
            glow = Math.max(0, strokeShape(x)) * 1.4 + flash * 0.8;
          }
          // Wave push: damped spring (omega 4.5, zeta 0.55), settles in about 1.5 s.
          const pw = 4.5;
          const pz = 2 * 0.55 * pw;
          const hs = dt / 4;
          for (let k = 0; k < 4; k++) {
            wpVx[i] += (-pw * pw * wpX[i] - pz * wpVx[i]) * hs;
            wpVy[i] += (-pw * pw * wpY[i] - pz * wpVy[i]) * hs;
            wpSv[i] += (-pw * pw * wpS[i] - pz * wpSv[i]) * hs;
            wpX[i] += wpVx[i] * hs;
            wpY[i] += wpVy[i] * hs;
            wpS[i] += wpSv[i] * hs;
          }
          if (i < count) {
            // Rotate into the jelly frame (same rotation as the shader's lp). Local down is -y,
            // so a push along local -y lengthens the tentacles (stored as positive .y).
            const an = buf[i * 4 + 3];
            const ca = Math.cos(an);
            const sa = Math.sin(an);
            const lx = ca * wpX[i] + sa * wpY[i];
            const ly = -sa * wpX[i] + ca * wpY[i];
            // Hero sway scales sublinearly with its size: 1/sqrt(hero scale relative to Size max).
            const latK = i === 0 && heroK > 0 ? 1 / Math.sqrt(Math.max(1, ps[0] / Math.max(sizeHi, 0.01))) : 1;
            set(i, 11, lx * 0.35, -ly * 0.35, wpS[i] * 0.25, latK);
          } else set(i, 11, 0, 0, 0, 1);
          if (i < count) set(i, 1, bellC[i], glow, phase[i] % 10000, stretch[i]);
          else {
            set(i, 1, 0, 0, 0, 0);
            set(i, TAIL_ROW, 0, -1, 0, 0);
          }
          // Neighbour glow: smooth 0.6 s envelope after a wave front passes.
          const ga = t - nGlowAt[i];
          const genv = i < count && ga >= 0 && ga < 0.6 ? Math.sin((Math.PI * ga) / 0.6) ** 2 : 0;
          const gc = nGlowCol[i];
          set(i, 6, gc[0], gc[1], gc[2], genv);
          for (let k = 0; k < 3; k++) {
            const ta = t - trT[i * 3 + k];
            const age = i < count && ta >= 0 && ta < 1.8 ? ta : 99;
            set(i, 7 + k, trX[i * 3 + k], trY[i * 3 + k], age, 0);
          }
        }

        // Wave rows.
        for (let k = 0; k < MAXW; k++) {
          const w = waves[k];
          if (!w) {
            set(k, 4, 0, 0, 0, 0);
            set(k, 5, 0, 0, 0, 0);
            continue;
          }
          const life = Math.max(0, 1 - w.r / Math.max(0.1, c.waveReach ?? 3));
          const strength = life * life * Math.min(1, w.r * 8) / (1 + w.r * 0.25);
          set(k, 4, w.x, w.y, w.r, strength);
          set(k, 5, w.color[0], w.color[1], w.color[2], w.sc);
        }
        dataTex.needsUpdate = true;
        jellyShared.count = count;
        jellyShared.frame = t;
        const nw = Math.min(waves.length, MAXW);
        jellyShared.waveCount = nw;
        for (let k = 0; k < nw; k++) {
          jellyShared.waveX[k] = waves[k].x;
          jellyShared.waveY[k] = waves[k].y;
          jellyShared.waveR[k] = waves[k].r;
        }

        const h = c.hue * Math.PI * 2;
        tint.value.set(0.55 + 0.45 * Math.cos(h), 0.55 + 0.45 * Math.cos(h - 2.1), 0.55 + 0.45 * Math.cos(h + 2.1), c.brightness ?? 1.8);
        view.value.set(t, aspect, Math.min(bass * react, 1.5), Math.min(mids * react * 1.2, 2.5));
        audio.value.set(Math.min(highs * react, 2), react, c.waveDistortion ?? 20, Math.max(0, c.tentacleFlow ?? 1));
        tent.value.set(c.tentacleCount, c.tentacleLength, c.tentacleGlow * (1 + ((c.cometTrail ?? 0.4) - 1) * stTail), c.lengthVariation);
        flow.value.set(c.dotSpeed, c.dotSpeedVariation, c.dotSpacing, c.sway);
        arms.value.set(c.armCount, c.armLength, c.armGlow, c.toneSoftness ?? 0.6);
        swarm.value.set(count, Math.max(1, Math.min(6, Math.round(c.ringCount ?? 3))), c.ringSpacing ?? 0.12, sizeHi);
        shape.value.set(c.size, c.height, c.pulse, c.halo);
        look.value.set(c.bellGlow ?? 1.5, c.depthHaze ?? 1, c.trails ?? 1, Math.max(0, c.currentSpread ?? 1));
        fx.value.set((c.tentacleSpectrum ?? 1) * react, (c.rimSpectrum ?? 1) * react, (c.heroLead ?? 1) * react, beatPhase);
        space.value.set(th, stTail, stComa, stColor);
      },
      async evaluate(_inputs, evaluation) {
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {
        bass = 0;
        mids = 0;
        highs = 0;
        peakB = peakM = peakH = 0.02;
        slowBass = 0;
        slowFlux = 0;
        slowSnare = 0;
        peakFlux = 0.001;
        prevMags.fill(0);
        lastOnset = -10;
        lastTrig.fill(-100);
        pendingAt.fill(-1);
        emitAt.fill(-1);
        waves = [];
        rng = 1;
        inited = false;
        lastFired = -1;
        spec.fill(0);
        specPeak.fill(0.02);
        beatTarget = beatPhase = 0;
        lastBeat = -10;
        wobbleAt.fill(-100);
        nGlowAt.fill(-100);
        jellyShared.count = 0;
        jellyShared.waveCount = 0;
        trT.fill(-100);
        strokeStart.fill(-100);
        strokesLeft.fill(0);
        strokeDur.fill(1);
        strokeNextAt.fill(-100);
        carryC.fill(0);
        carryV.fill(0);
        carryT.fill(-100);
        trigDur.fill(1);
        prevC.fill(0);
        bellC.fill(0);
        furl.fill(0);
        furlV.fill(0);
        wpX.fill(0);
        wpY.fill(0);
        wpVx.fill(0);
        wpVy.fill(0);
        wpS.fill(0);
        wpSv.fill(0);
        heroNext = -1;
        themeInit = false;
        tdOm.fill(0);
      },
      dispose() {
        geometry.dispose();
        material.dispose();
        dataTex.dispose();
      },
    };
  },
});
