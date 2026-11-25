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
import { uniform, uv, wgslFn, texture, vec2 } from 'three/tsl';
import { jellyShared } from './jelly-shared.ts';

// A distant humpback-style whale silhouette that slowly crosses the frame
// behind everything. It only shows where the input is dark and stays dim.
// view:  x=time, y=aspect, z=bass, w=bank angle
// pose:  x,y=screen position (aspect units), z=facing sign, w=visibility
// shape: x=size, y=depth haze, z=brightness, w=song
// tint:  rgb=glow tint, w=theme (0 aquarium, 1 constellation)
const whalePass = `
fn distantWhale(st: vec2f, base: vec4f, view: vec4f, pose: vec4f, shape: vec4f, tint: vec4f) -> vec4f {
  let t = view.x;
  let size = max(shape.x, 0.02);
  let p = (st - vec2f(0.5, 0.5)) * vec2f(view.y, 1.0);

  let lum = dot(base.rgb, vec3f(0.2126, 0.7152, 0.0722));
  let dark = 1.0 - smoothstep(0.08, 0.35, lum);
  let vis = pose.w * dark;
  if (vis < 0.002) { return vec4f(base.rgb, 1.0); }

  // Whale-local space: head at +x, tail at -x, body length about 2 units.
  var q = (p - pose.xy) / size;
  q.x = q.x * pose.z;
  let ca = cos(view.w);
  let sa = sin(view.w);
  q = vec2f(ca * q.x + sa * q.y, -sa * q.x + ca * q.y);
  if (dot(q, q) > 16.0) { return vec4f(base.rgb, 1.0); }

  let haze = clamp(shape.y, 0.0, 1.0);
  let th = clamp(tint.w, 0.0, 1.0);
  let sFade = smoothstep(0.1, 0.7, th);
  let sStar = smoothstep(0.3, 0.9, th);
  let soft = 0.015 + 0.09 * haze;

  // Body with an undulation that travels from head to tail.
  let tailW = 1.0 - smoothstep(-1.0, 0.6, q.x);
  let c = whaleCenter(q.x, t, tailW);
  let r = whaleRadius(q.x);
  var d = abs(q.y - c) - r;
  d = max(d, abs(q.x - 0.0) - 1.08);

  // Dorsal hump.
  let hump = length((q - vec2f(-0.38, whaleCenter(-0.38, t, 1.0 - smoothstep(-1.0, 0.6, -0.38)) + whaleRadius(-0.38))) * vec2f(1.0, 1.6)) - 0.05;
  d = whaleSmin(d, hump, 0.05);

  // Tail flukes beating up and down.
  let tailX = -1.02;
  let tailC = whaleCenter(tailX, t, 1.0);
  let beat = 0.5 * sin(t * 0.7 - 2.2);
  let root = vec2f(tailX, tailC);
  let tipA = root + vec2f(-0.26 * cos(beat + 0.35), 0.26 * sin(beat + 0.35));
  let tipB = root + vec2f(-0.26 * cos(beat - 0.35), 0.26 * sin(beat - 0.35));
  let flA = whaleSeg(q, root, tipA, 0.045, 0.012);
  let flB = whaleSeg(q, root, tipB, 0.045, 0.012);
  d = whaleSmin(d, min(flA, flB), 0.06);

  // Long pectoral flipper with a slow sweep.
  let fBase = vec2f(0.42, whaleCenter(0.42, t, 0.0) - whaleRadius(0.42) * 0.55);
  let sweep = -2.35 + 0.35 * sin(t * 0.45);
  let fTip = fBase + vec2f(cos(sweep), sin(sweep)) * 0.62;
  let flip = whaleSeg(q, fBase, fTip, 0.05, 0.012);
  d = whaleSmin(d, flip, 0.04);

  let body = 1.0 - smoothstep(-soft, soft, d);
  let rim = exp(-abs(d) * (60.0 - 40.0 * haze)) * smoothstep(-0.12, 0.0, d);
  // -1 at the belly line, +1 along the back.
  let rel = clamp((q.y - c) / max(r, 0.02), -1.5, 1.5);

  let deep = vec3f(0.05, 0.08, 0.22);
  let glowCol = mix(vec3f(0.25, 0.55, 1.0), tint.rgb, 0.6);
  let fogCol = vec3f(0.06, 0.07, 0.16);
  var col = vec3f(0.0, 0.0, 0.0);

  if (th < 1.0) {
    // Jaw line and ventral throat grooves on the head.
    let headMask = smoothstep(0.45, 0.7, q.x) * body;
    let jawY = c - r * 0.15 - (q.x - 0.6) * 0.12;
    let jaw = exp(-abs(q.y - jawY) * 120.0) * headMask;
    let below = smoothstep(jawY, jawY - 0.06, q.y);
    let grooves = (0.5 + 0.5 * sin((q.y - c) * 140.0)) * below * headMask * smoothstep(0.98, 0.7, q.x);

    // Soft glowing spots along the flank.
    var spots = 0.0;
    for (var i = 0; i < 6; i++) {
      let fi = f32(i);
      let sx = 0.75 - fi * 0.3;
      let sy = whaleCenter(sx, t, 1.0 - smoothstep(-1.0, 0.6, sx)) + whaleRadius(sx) * (0.2 - 0.3 * fract(fi * 0.618));
      let pulse = 0.6 + 0.4 * sin(t * 0.8 + fi * 1.7);
      spots += exp(-dot(q - vec2f(sx, sy), q - vec2f(sx, sy)) * mix(900.0, 6000.0, sStar)) * pulse;
    }

    // Song: a faint slow ring from the head on bass.
    let head = vec2f(1.0, whaleCenter(1.0, t, 0.0));
    let ph = fract(t * 0.12);
    let rd = length(q - head);
    let rr = (rd - ph * 2.5) * 10.0;
    let ring = exp(-rr * rr) * (1.0 - ph) * clamp(view.z, 0.0, 1.0) * shape.w;

    // Countershaded, mottled skin: dark back, paler belly.
    let belly = smoothstep(0.1, -0.85, rel);
    let mott = whaleNoise(q * vec2f(9.0, 14.0) + vec2f(3.1, 0.7)) * 0.6 + whaleNoise(q * 23.0 + vec2f(1.7, 9.2)) * 0.4;
    let skin = mix(deep, vec3f(0.17, 0.22, 0.34), belly) * (0.75 + 0.5 * mott);

    // Barnacle speckle clustered on the head, chin and flipper edge.
    let bc = q * 36.0;
    let bcell = floor(bc);
    let bh = whaleHash(bcell);
    let bo = (vec2f(whaleHash(bcell + vec2f(17.0, 3.0)), whaleHash(bcell + vec2f(41.0, 9.0))) - 0.5) * 0.45;
    let bdd = fract(bc) - 0.5 - bo;
    let bd2 = dot(bdd, bdd);
    let headZone = smoothstep(0.35, 0.85, q.x) * (0.5 + 0.5 * smoothstep(-0.2, 0.7, rel));
    let finZone = (1.0 - smoothstep(-0.01, 0.03, flip)) * 0.7;
    let barnOn = step(0.68, bh) * max(headZone, finZone) * body;
    let barn = exp(-bd2 * 110.0) * barnOn * (0.6 + 0.4 * fract(bh * 9.1));
    let pits = exp(-bd2 * 320.0) * barnOn;

    // Volumetric god-light: slanted shafts through the water catch the back and dapple it.
    let x2 = p.x + p.y * 0.35;
    let sh = clamp(0.5 + 0.35 * sin(x2 * 23.0 + sin(x2 * 7.0 + t * 0.13) * 1.2 + t * 0.05) + 0.15 * sin(x2 * 41.0 - t * 0.09 + 1.7), 0.0, 1.0);
    let shaft = sh * sh * sh;
    let dap = whaleCaustic(p * 16.0, t);
    let backLit = body * smoothstep(-0.2, 0.95, rel);
    let rimTop = rim * smoothstep(-0.15, 0.6, rel);
    let lit = shaft * (0.45 + 0.9 * dap) * (backLit * 0.32 + rimTop) * 0.7;
    let ab = q.y - c;
    let beam = shaft * exp(-(q.x * q.x) * 0.35 - (ab - 0.6) * (ab - 0.6) * 1.6) * smoothstep(0.0, 0.35, ab) * (1.0 - body) * 0.14;

    // Softly glowing eye just above the corner of the mouth, with a rare slow blink.
    let eX = 0.5;
    let eC = whaleCenter(eX, t, 1.0 - smoothstep(-1.0, 0.6, eX));
    let eP = vec2f(eX, eC - whaleRadius(eX) * 0.15 + 0.042);
    let ed = q - eP;
    let e2 = dot(ed, ed);
    let bk = (fract(t * 0.083 + 0.3) - 0.5) * 70.0;
    let blink = 1.0 - exp(-bk * bk);
    let eyeGlow = (exp(-e2 * 9000.0) * 1.3 + exp(-e2 * 900.0) * 0.28 + exp(-e2 * 110.0) * 0.06) * blink * (0.85 + 0.15 * sin(t * 0.6));
    let eyeCol = mix(vec3f(1.0, 0.78, 0.45), glowCol, 0.35);

    var aq = skin * body * 0.6;
    aq += glowCol * (rim * 0.75 + spots * 0.75 + jaw * 0.25 + grooves * 0.16);
    aq += vec3f(0.7, 0.78, 0.85) * barn * 0.3 - vec3f(0.03, 0.03, 0.03) * pits;
    aq += vec3f(0.55, 0.78, 0.95) * (lit + beam);
    aq += glowCol * ring * 0.5;
    // Depth fog: blend toward a hazy blue and lose contrast with distance.
    aq = mix(aq, fogCol * (body + rim * 0.5), haze * 0.55) * (1.0 - haze * 0.45);
    aq += eyeCol * eyeGlow * (1.0 - haze * 0.3);
    col = max(aq, vec3f(0.0, 0.0, 0.0));
  }

  // Constellation: the silhouette becomes a faint nebula; stars with spikes and halos are
  // joined by gradient lines that carry a slow pulse from head to tail.
  if (th > 0.0) {
    let nbody = smoothstep(0.14, -0.1, d);
    let outer = exp(-max(d, 0.0) * 8.0);
    let n1 = whaleNoise(q * 3.2 + vec2f(t * 0.03, 1.3));
    let n2 = whaleNoise(q * 7.5 + vec2f(-t * 0.02, t * 0.04) + vec2f(n1 * 1.6, 0.0));
    let nebB = vec3f(glowCol.b * 0.9, glowCol.r * 0.5 + 0.25, glowCol.g);
    let nebCol = mix(glowCol, nebB, smoothstep(0.3, 0.7, n1));
    let breath = 0.85 + 0.15 * sin(t * 0.35);
    let neb = nebCol * (nbody * (0.05 + 0.16 * n2 * (0.5 + n1)) + outer * 0.05) * breath;
    col = mix(col, neb, sFade);
    // Ordered outline loop. Every star and link endpoint comes from the same points below.
    let pSnout = whaleBP(1.04, 0.0, t);
    let pHead = whaleBP(0.84, 0.9, t);
    let pNeck = whaleBP(0.5, 1.0, t);
    let pBack = whaleBP(0.08, 1.0, t);
    let pHump = whaleBP(-0.38, 1.0, t) + vec2f(0.0, 0.05);
    let pSpine = whaleBP(-0.68, 1.0, t);
    let pStockU = whaleBP(-0.95, 1.0, t);
    let pTipU = tipA;
    let pNotch = root + vec2f(-0.07, 0.0);
    let pTipL = tipB;
    let pStockL = whaleBP(-0.95, -1.0, t);
    let pBelly1 = whaleBP(-0.6, -1.0, t);
    let pBelly2 = whaleBP(-0.1, -1.0, t);
    let cfBase = whaleBP(0.42, -0.55, t);
    let cfTip = cfBase + vec2f(cos(sweep), sin(sweep)) * 0.62;
    let pJaw = whaleBP(0.74, -0.6, t);
    let pEye = whaleBP(0.5, -0.15, t) + vec2f(0.0, 0.042);
    let lA = mix(glowCol, vec3f(0.95, 0.97, 1.0), 0.45);
    let lB = mix(nebB, vec3f(1.0, 1.0, 1.0), 0.3);
    var lines = vec3f(0.0, 0.0, 0.0);
    lines += whaleLink(q, pSnout, pHead, t, 0.0, size, lA, lB);
    lines += whaleLink(q, pHead, pNeck, t, 1.0, size, lA, lB);
    lines += whaleLink(q, pNeck, pBack, t, 2.0, size, lA, lB);
    lines += whaleLink(q, pBack, pHump, t, 3.0, size, lA, lB);
    lines += whaleLink(q, pHump, pSpine, t, 4.0, size, lA, lB);
    lines += whaleLink(q, pSpine, pStockU, t, 5.0, size, lA, lB);
    lines += whaleLink(q, pStockU, pTipU, t, 6.0, size, lA, lB);
    lines += whaleLink(q, pTipU, pNotch, t, 7.0, size, lA, lB);
    lines += whaleLink(q, pNotch, pTipL, t, 8.0, size, lA, lB);
    lines += whaleLink(q, pTipL, pStockL, t, 9.0, size, lA, lB);
    lines += whaleLink(q, pStockL, pBelly1, t, 10.0, size, lA, lB);
    lines += whaleLink(q, pBelly1, pBelly2, t, 11.0, size, lA, lB);
    lines += whaleLink(q, pBelly2, cfBase, t, 12.0, size, lA, lB);
    lines += whaleLink(q, cfBase, cfTip, t, 13.0, size, lA, lB);
    lines += whaleLink(q, cfBase, pJaw, t, 14.0, size, lA, lB);
    lines += whaleLink(q, pJaw, pSnout, t, 15.0, size, lA, lB);
    // A few bright anchors; the rest dimmer.
    var stars = whaleStar(q, pSnout, 1.3, t, 1.0, glowCol) + whaleStar(q, pHump, 1.2, t, 2.0, glowCol);
    stars += whaleStar(q, pTipU, 1.15, t, 3.0, glowCol) + whaleStar(q, pTipL, 1.05, t, 4.0, glowCol) + whaleStar(q, cfTip, 1.0, t, 5.0, glowCol);
    stars += whaleStar(q, pHead, 0.6, t, 6.0, glowCol) + whaleStar(q, pNeck, 0.5, t, 7.0, glowCol) + whaleStar(q, pBack, 0.55, t, 8.0, glowCol);
    stars += whaleStar(q, pSpine, 0.5, t, 9.0, glowCol) + whaleStar(q, pStockU, 0.6, t, 10.0, glowCol) + whaleStar(q, pNotch, 0.45, t, 11.0, glowCol);
    stars += whaleStar(q, pStockL, 0.5, t, 12.0, glowCol) + whaleStar(q, pBelly1, 0.45, t, 13.0, glowCol) + whaleStar(q, pBelly2, 0.5, t, 14.0, glowCol);
    stars += whaleStar(q, cfBase, 0.55, t, 15.0, glowCol) + whaleStar(q, pJaw, 0.6, t, 16.0, glowCol) + whaleStar(q, pEye, 0.35, t, 17.0, glowCol);
    col += (stars * 3.5 + min(lines, vec3f(1.5, 1.5, 1.5)) * 0.5) * sStar;
  }

  let added = col * 0.08 * shape.z * vis;
  let occlude = 1.0 - body * 0.22 * vis * (1.0 - sFade);
  return vec4f(base.rgb * occlude + added, 1.0);
}

fn whaleStar(q: vec2f, c: vec2f, b: f32, t: f32, seed: f32, glow: vec3f) -> vec3f {
  let dd = q - c;
  let d2 = dot(dd, dd);
  if (d2 > 0.09) { return vec3f(0.0, 0.0, 0.0); }
  let tw = 0.75 + 0.25 * sin(t * (1.3 + fract(seed * 0.618) * 2.0) + seed * 4.1);
  let temp = mix(vec3f(0.72, 0.84, 1.0), vec3f(1.0, 0.86, 0.68), fract(seed * 0.618 + 0.2));
  let core = exp(-d2 * 9000.0);
  let ax = abs(dd);
  let k = 20.0 / b;
  // Four main diffraction spikes plus four faint diagonals; brighter stars throw longer spikes.
  let sp = exp(-dd.y * dd.y * 30000.0 - ax.x * k) + exp(-dd.x * dd.x * 30000.0 - ax.y * k);
  let rd = vec2f(dd.x + dd.y, dd.x - dd.y) * 0.7071;
  let sp2 = exp(-rd.y * rd.y * 45000.0 - abs(rd.x) * k * 1.8) + exp(-rd.x * rd.x * 45000.0 - abs(rd.y) * k * 1.8);
  let halo = exp(-d2 * 600.0) * 0.12 + exp(-d2 * 80.0) * 0.03;
  return (mix(temp, vec3f(1.0, 1.0, 1.0), 0.6) * core + temp * (sp * 0.4 + sp2 * 0.15) * tw + mix(glow, temp, 0.5) * halo) * b * tw;
}

fn whaleLink(q: vec2f, a: vec2f, b: vec2f, t: f32, s: f32, size: f32, colA: vec3f, colB: vec3f) -> vec3f {
  let pa = q - a;
  let ba = b - a;
  let len = max(length(ba), 0.0001);
  let h = clamp(dot(pa, ba) / (len * len), 0.0, 1.0);
  // Distance in approximate pixels (screen height ~ 1000 px), so width is uniform on screen.
  let px = length(pa - ba * h) * size * 1000.0;
  if (px > 4.0) { return vec3f(0.0, 0.0, 0.0); }
  let ln = 1.0 - smoothstep(0.4, 1.4, px);
  // Fade out near each star so the line does not overlap its glow.
  let ends = smoothstep(0.035, 0.1, h * len) * smoothstep(0.035, 0.1, (1.0 - h) * len);
  // One gentle pulse travels around the loop.
  let g = s + h;
  let pk = (g - fract(t * 0.05) * 18.0) * 1.2;
  let pulse = 0.75 + 0.35 * exp(-pk * pk);
  return mix(colA, colB, clamp(g / 16.0, 0.0, 1.0)) * ln * ends * pulse * 0.6;
}

fn whaleBP(x: f32, k: f32, t: f32) -> vec2f {
  return vec2f(x, whaleCenter(x, t, 1.0 - smoothstep(-1.0, 0.6, x)) + whaleRadius(x) * k);
}

fn whaleCenter(x: f32, t: f32, tailW: f32) -> f32 {
  let arch = 0.04 * (1.0 - x * x);
  let wave = 0.07 * tailW * sin(x * 2.4 + t * 0.7);
  return arch + wave;
}

fn whaleRadius(x: f32) -> f32 {
  let h = clamp((x + 1.05) / 2.1, 0.0, 1.0);
  let taper = pow(h, 0.75);
  let nose = sqrt(max(1.0 - pow(max(h - 0.82, 0.0) / 0.18, 2.0), 0.0));
  return 0.2 * taper * nose + 0.02 * h;
}

fn whaleSeg(p: vec2f, a: vec2f, b: vec2f, ra: f32, rb: f32) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}

fn whaleSmin(a: f32, b: f32, k: f32) -> f32 {
  let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

fn whaleHash(c: vec2f) -> f32 {
  return fract(sin(dot(c, vec2f(127.1, 311.7))) * 43758.5453);
}

fn whaleNoise(x: vec2f) -> f32 {
  let i = floor(x);
  let f = fract(x);
  let u = f * f * (3.0 - 2.0 * f);
  let a = whaleHash(i);
  let b = whaleHash(i + vec2f(1.0, 0.0));
  let c = whaleHash(i + vec2f(0.0, 1.0));
  let d = whaleHash(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn whaleCaustic(a: vec2f, t: f32) -> f32 {
  let w1 = sin(a.x + sin(a.y * 0.8 + t * 0.7) * 1.3 + t * 0.5);
  let w2 = sin(a.y * 1.1 + sin(a.x * 0.9 - t * 0.6) * 1.4 - t * 0.4);
  let w3 = sin((a.x + a.y) * 0.7 + sin(a.x * 1.3 + t * 0.3) + t * 0.6);
  let c = 1.0 - abs(w1 + w2 + w3) / 3.0;
  let c2 = c * c;
  return c2 * c2 * c;
}
`;

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'jellyfish/whale',
    label: 'Distant Whale',
    description: 'A dim, hazy humpback silhouette slowly crosses far in the background; bass can make it sing a faint ring.',
    tags: ['jellyfish', 'ocean'],
    inputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image to add the whale behind.',
      },
    },
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image with a faint distant whale added in dark areas.',
      },
    },
    controls: {
      size: { type: 'number', group: 'Whale', label: 'Size', default: 0.22, min: 0.05, max: 0.8, step: 0.01 },
      depth: { type: 'number', group: 'Whale', label: 'Depth haze', default: 0.6, min: 0, max: 1, step: 0.01 },
      crossTime: { type: 'number', group: 'Motion', label: 'Cross time (s)', default: 90, min: 10, max: 300, step: 1 },
      height: { type: 'number', group: 'Motion', label: 'Height', default: 0.18, min: -0.45, max: 0.45, step: 0.01 },
      direction: { type: 'number', group: 'Motion', label: 'Direction', default: 2, min: 0, max: 2, step: 1 },
      brightness: { type: 'number', group: 'Look', label: 'Brightness', default: 1, min: 0, max: 3, step: 0.01 },
      hue: { type: 'number', group: 'Look', label: 'Hue', default: 0.65, min: 0, max: 1, step: 0.01 },
      song: { type: 'number', group: 'Audio', label: 'Song', default: 1, min: 0, max: 3, step: 0.01 },
    },
    controlDescriptions: {
      size: 'Whale length relative to screen height. Small values read as farther away.',
      depth: 'Amount of depth fog and softness. Higher values push the whale farther back.',
      crossTime: 'Seconds the whale takes to cross the frame. A pause follows each crossing.',
      height: 'Vertical lane of the swim path. Zero is the screen center.',
      direction: '0 swims left to right, 1 swims right to left, 2 alternates each crossing.',
      brightness: 'Strength of the silhouette, rim light and glowing spots. It stays dim.',
      hue: 'Tint of the bioluminescent rim and spots.',
      song: 'How strongly bass makes the whale emit a faint ring from its head.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    const view = uniform(new Vector4(0, aspect, 0, 0));
    const pose = uniform(new Vector4(0, 0, 1, 0));
    const shape = uniform(new Vector4(0.22, 0.6, 1, 1));
    const tint = uniform(new Vector4(0.5, 0.4, 1, 0));
    const baseTex = texture(new Texture(), vec2(uv().x, uv().y.oneMinus()) as any);
    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    material.fragmentNode = (wgslFn(whalePass) as any)(uv(), baseTex, view, pose, shape, tint);
    const scene = new Scene();
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    let bass = 0;
    let theme = 0;

    return {
      update(frame) {
        const spectrum = frame.audioSpectrum;
        let target = 0;
        if (spectrum?.available) {
          for (let i = 2; i < 12; i++) {
            target += spectrum.magnitudes[i] ?? 0;
          }
          target /= 10;
        }
        bass += (target - bass) * 0.05;
        const themeTarget = Math.max(0, Math.min(1, jellyShared.theme || 0));
        theme += (themeTarget - theme) * 0.05;
        if (Math.abs(theme - themeTarget) < 1e-4) theme = themeTarget;

        const c = frame.controls;
        const t = frame.timeSeconds;
        const cross = Math.max(c.crossTime, 1);
        const cycle = cross * 1.35;
        const index = Math.floor(t / cycle);
        const u = (t - index * cycle) / cross;
        const dirMode = Math.round(c.direction);
        const dir = dirMode === 0 ? 1 : dirMode === 1 ? -1 : index % 2 === 0 ? 1 : -1;

        const span = aspect * 0.5 + c.size * 1.4;
        const x = (u * 2 - 1) * span * dir;
        const bob = 0.012 * Math.sin(t * 0.21) + 0.006 * Math.sin(t * 0.47 + 1.3);
        const fade = u <= 1 ? 1 : 0;
        const bank = 0.05 * Math.sin(t * 0.17 + 0.8);

        view.value.set(t, aspect, Math.min(bass * 3, 1), bank);
        pose.value.set(x, c.height + bob, dir, fade);
        shape.value.set(c.size, c.depth, c.brightness, c.song);

        const h = c.hue * Math.PI * 2;
        tint.value.set(
          0.55 + 0.45 * Math.cos(h),
          0.55 + 0.45 * Math.cos(h - 2.1),
          0.55 + 0.45 * Math.cos(h + 2.1),
          theme,
        );
      },
      async evaluate(inputs, evaluation) {
        baseTex.value = inputs.image.texture as Texture;
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {
        bass = 0;
        theme = 0;
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  },
});
