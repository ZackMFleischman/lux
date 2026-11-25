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
  NearestFilter,
} from 'three/webgpu';
import { uniform, uv, wgslFn, texture, vec2 } from 'three/tsl';
import { jellyShared } from './jelly-shared.ts';

const MAX_FRONDS = 40;
const BAND_TEX = 64;

// Dim spectrum kelp forest behind the jellies. One frond per band, grown in uneven clumps
// on three depth layers (near, mid, far) with parallax drift and water fog.
// view: x time, y aspect, z count, w brightness
// shape: x height, y sway, z hue (0..1), w theme (0 aquarium, 1 space plasma)
// extra: x strongest transient kick, y mean level, z parallax drift (aspect units), w unused
// data texture row 0, texel i: r smoothed magnitude, g transient kick, b wave phase
// data texture row 1, texel i: r baseX (0..1 of width), g thickness, b depth (0 near, 0.5 mid, 1 far), a base y offset
// data texture row 2, texel i: r seconds since the last flare eruption, g eruption strength
// Space theme: a dark sun surface with sunspots at the bottom, and swirling coronal loops for fronds.
const kelpPass = `
fn jellyKelp(st: vec2f, base: vec4f, bands: texture_2d<f32>, view: vec4f, shape: vec4f, extra: vec4f, flA: vec4f, flB: vec4f, flC: vec4f, flD: vec4f) -> vec4f {
  let t = view.x;
  let aspect = view.y;
  let count = i32(clamp(view.z, 1.0, 40.0));
  let fc = f32(count);
  // Lux uv: y = 0 at the bottom of the frame. x spans the full aspect width.
  let p = vec2f(st.x * aspect, st.y);
  var glow = vec3f(0.0, 0.0, 0.0);
  let th = clamp(shape.w, 0.0, 1.0);
  let sBlade = smoothstep(0.0, 0.45, th);
  let sStraight = smoothstep(0.15, 0.65, th);
  let sCol = smoothstep(0.1, 0.8, th);
  let sLimb = smoothstep(0.4, 1.0, th);
  let aqW = 1.0 - sCol;
  // Solar flare controls, blended so theme 0 always sees the neutral values.
  let fBright = mix(1.0, flA.x, sCol);
  let fHeight = mix(1.0, flA.y, sCol);
  let fWidth = mix(1.0, flA.z, sCol);
  let fThick = mix(1.0, flA.w, sCol);
  let fSwirl = mix(1.0, flB.x, sCol);
  let fBraid = mix(1.0, flB.y, sCol);
  let fSpeed = mix(1.0, flB.z, sCol);
  let fHue = flB.w * sCol;
  let hueR = clamp(fHue, 0.0, 1.0);
  let hueM = clamp(fHue - 1.0, 0.0, 1.0);
  let eSize = mix(1.0, flC.y, sCol);
  let sunDark = mix(1.0, flC.z, sLimb);
  let spotSize = mix(1.0, flC.w, sLimb);
  let sunSwirl = mix(1.0, flD.x, sLimb);
  let rimGlow = mix(1.0, flD.y, sLimb);
  let sunH = mix(0.13, flD.z, sLimb);
  let tf = t * fSpeed;
  let bladeW = 1.0 - sBlade;
  // Sun dapple: one moving caustic net shared by every frond, stronger toward the surface.
  var dap = 0.0;
  if (aqW > 0.001) {
    dap = kelpCaustic(p * 8.0, t) * (0.3 + 0.7 * smoothstep(-0.1, 1.0, p.y));
  }
  let fogCol = mix(vec3f(0.10, 0.34, 0.38), vec3f(0.45, 0.10, 0.04), sCol);
  var prox = 0.0;
  // Space: one shared turbulent warp makes every loop swirl and shimmer.
  var pw = p;
  if (sCol > 0.001) {
    let wq = p * 6.0;
    let wv = vec2f(kelpNoise(wq + vec2f(tf * 0.31, 3.7)), kelpNoise(wq * 1.3 + vec2f(9.1, -tf * 0.27))) - vec2f(0.5, 0.5);
    pw = p + wv * 0.03 * fSwirl * (1.0 + 0.8 * extra.x);
  }
  for (var i = 0; i < 40; i++) {
    if (i >= count) { break; }
    let fi = f32(i);
    let d0 = textureLoad(bands, vec2i(i, 0), 0);
    let d1 = textureLoad(bands, vec2i(i, 1), 0);
    let d2 = textureLoad(bands, vec2i(i, 2), 0);
    let mag = d0.r;
    let kick = d0.g;
    let phase = d0.b;
    let depth = d1.b;
    let nearK = 1.0 - depth;
    // Far layers are thinner, a little shorter, drift less and sit slightly higher.
    let thick = d1.g * mix(0.65, 1.25, nearK);
    // Quiet bands rest at 25% of the reach; loud bands climb well past it. Kicks stretch them further.
    let h0 = shape.x * (0.25 + 1.1 * mag) * (1.0 + 0.35 * kick) * (1.0 - 0.3 * depth);
    let h = h0 * fHeight;
    let baseX = d1.r * aspect + extra.z * mix(0.25, 1.0, nearK);
    let baseY = mix(d1.a + depth * 0.035, kelpLimb(baseX, aspect, sunH) - 0.004, sLimb);
    let current = sin(t * 0.45 + fi * 1.7) + 0.35 * sin(t * 0.83 + fi * 0.6);
    // Space: each band is a coronal loop arching from its foot to a second foot beside it.
    let ejAct = d2.g * (1.0 - smoothstep(0.55, 1.0, clamp(d2.r / 1.6, 0.0, 1.0)));
    let hs = kelpHash(fi * 4.7 + 1.3);
    let hs2 = kelpHash(fi * 2.9 + 6.1);
    let dirL = select(-1.0, 1.0, hs > 0.5);
    let rx = clamp(h0 * (0.14 + 0.2 * hs2), 0.02, 0.16) * mix(0.8, 1.2, nearK) * fWidth;
    let ry = max(h, 0.001);
    let leanL = shape.y * (0.12 * sin(tf * 0.21 + fi * 1.7) + 0.06 * current);
    let curlA = shape.y * rx * (0.3 + 0.4 * mag + 0.5 * kick);
    let curlP = tf * (0.5 + 0.6 * mag) + fi * 2.3;
    // Both loop feet sit on the curved limb at their own x, sunk slightly into the sun body.
    let footSink = 0.012;
    let footAY = kelpLimb(baseX, aspect, sunH) - footSink;
    let footBY = kelpLimb(baseX + 2.0 * dirL * rx, aspect, sunH) - footSink;
    let footSlope = (footBY - footAY) / (2.0 * dirL * rx);
    let lc = vec2f(baseX + dirL * rx, 0.5 * (footAY + footBY));
    // Sway grows strongly with level.
    let amp = (1.0 - 0.8 * sStraight) * shape.y * (0.025 + 0.24 * mag) * (1.0 + 0.6 * kick);
    // Evaluation bounds cover the full frond: height plus the longest blade (with lift and flutter) plus margin.
    let lenK = clamp(0.7 + 0.5 * h, 1.0, 1.7);
    let bladeR = 0.1 * thick * lenK;
    let reachY = bladeR * 2.2 + 0.06;
    let reachX = bladeR * 1.3 + 0.06 + amp * 2.0 + 0.03;
    let wy0 = p.y - baseY;
    if (wy0 > h + reachY + sCol * select(0.0, (0.3 + 0.5 * h) * max(eSize, 1.0), ejAct > 0.002) || wy0 < -0.06 - 0.06 * sCol) { continue; }
    if (abs(p.x - baseX - dirL * rx * sCol) > reachX + sCol * (rx + 0.2 * shape.y * h + curlA + max(eSize - 1.0, 0.0) * 0.15 * select(0.0, 1.0, ejAct > 0.002))) { continue; }
    let y = wy0 / max(h, 0.001);
    let yc = clamp(y, 0.0, 1.0);
    let cx = kelpAxis(baseX, yc, p.y, amp, current, phase, fi, mag, t, sStraight);
    let dx = p.x - cx;
    let dim = 1.0 - 0.55 * depth;
    let soft = mix(1.0, 2.6, depth);
    let band = select(fi / max(fc - 1.0, 1.0), 0.0, count < 2);
    let hh = (shape.z + band * 0.35) * 6.2831853;
    let tipTint = vec3f(0.55 + 0.45 * cos(hh), 0.55 + 0.45 * cos(hh - 2.1), 0.55 + 0.45 * cos(hh + 2.1));
    // Solar palette: orange to red across bands, gold toward the loop tops.
    let aur = mix(mix(vec3f(1.0, 0.5, 0.1), vec3f(0.95, 0.26, 0.06), fract(band * 2.7 + 0.3)), vec3f(1.0, 0.72, 0.25), smoothstep(0.35, 1.0, yc) * 0.5);
    let aurS = mix(mix(aur, vec3f(1.0, 0.14, 0.06), hueR), vec3f(0.95, 0.15, 0.75), hueM);
    let tint = mix(tipTint, aurS, sCol);
    let live = tint * (0.6 + 0.8 * mag + 0.8 * kick);
    prox = max(prox, exp(-dx * dx * 60.0) * (1.0 - smoothstep(0.85, 1.25, y)) * step(-0.05, y) * mix(0.5, 1.0, nearK));
    var fl = vec3f(0.0, 0.0, 0.0);
    // The stipe tapers to a fine tip and fades out softly instead of ending at a hard edge.
    let sw = 0.0035 * thick * fThick * mix(1.4, 0.9, yc) * mix(1.0, mix(0.3, 1.0, sCol), smoothstep(0.7, 1.0, yc));
    let topFade = (1.0 - smoothstep(0.82, 1.06, y)) * step(0.0, y);

    if (aqW > 0.001) {
      // Stipe: a translucent cylinder lit from the upper left, dappled by the sun, with an edge sheen.
      let s = clamp(dx / sw, -1.0, 1.0);
      let sd = abs(dx) - sw;
      let stem = (1.0 - smoothstep(-0.0012 * soft, 0.0012 * soft, sd)) * topFade;
      let stipeCol = mix(vec3f(0.12, 0.15, 0.04), vec3f(0.05, 0.26, 0.18), smoothstep(0.0, 0.6, yc));
      let stCol = mix(stipeCol, live, smoothstep(0.6, 1.0, yc) * 0.6);
      let lightS = clamp(0.3 - 0.7 * s, 0.0, 1.0);
      let shadeS = (0.45 + 0.55 * lightS) * (0.75 + 0.9 * dap);
      let sheen = exp(-(sd * sd) / (0.0012 * 0.0012 * soft * soft)) * topFade * (0.15 + 0.5 * dap);
      let haze = exp(-(dx * dx) / (sw * sw * 40.0)) * 0.15 * (1.0 - smoothstep(0.9, 1.04, y));
      fl += (stCol * (stem * shadeS * 0.9 + haze) + vec3f(0.6, 0.85, 0.4) * sheen * 0.3) * aqW;
    }
    if (sCol > 0.001) {
      // Coronal loop: elliptical arch, leaned by the current and curled by a travelling twist.
      var q = pw - lc;
      // Shear so the loop baseline follows the line between the two limb feet.
      q.y -= footSlope * q.x;
      // Below the foot line the legs continue straight down into the sun (no horizontal cut).
      let qyRaw = q.y;
      q.y = max(q.y, 0.0);
      q.x -= kelpLoopX(clamp(q.y / ry, 0.0, 1.2), ry, leanL, curlA, curlP);
      let qn = q / vec2f(rx, ry);
      let k0 = length(qn);
      let k1 = length(q / vec2f(rx * rx, ry * ry));
      // sL runs 0 at this band's foot to 1 at the far foot.
      let sL = atan2(max(qn.y, 0.0), -dirL * qn.x) * 0.31830989;
      let turb = sin(sL * 40.0 - tf * 4.1 + fi * 2.3) * sin(sL * 13.0 + tf * 1.7 + fi);
      let dL = k0 * (k0 - 1.0) / max(k1, 0.0001) + 0.0012 * thick * fSwirl * turb;
      // Inside the sun body the loop fades with depth below the limb as a bright footpoint glow.
      let under = max(kelpLimb(pw.x, aspect, sunH) - pw.y, 0.0);
      let vfoot = exp(-under / 0.012) * (1.0 - smoothstep(0.0, 0.05, -qyRaw));
      let footGlow = (1.0 - exp(-under / 0.004)) * vfoot;
      // Eruption: a kick tears the loop top open and throws a plasma blob upward.
      let prog = clamp(d2.r / 1.6, 0.0, 1.0);
      let gap = ejAct * exp(-(sL - 0.5) * (sL - 0.5) / 0.008) * smoothstep(0.0, 0.06, prog);
      // Magnetic rope: three strands braid around the loop axis; the far side of the twist dims.
      let coreW = sw * 0.55;
      let ropeR = sw * (1.4 + 1.2 * mag + 1.5 * kick);
      let tw = sL * 3.14159265 * (6.0 + 4.0 * hs2) * fBraid - tf * (1.2 + 2.5 * mag) + fi;
      var braid = 0.0;
      for (var b = 0; b < 3; b++) {
        let ph = tw + f32(b) * 2.0943951;
        let db = dL - ropeR * sin(ph);
        braid += exp(-(db * db) / (coreW * coreW)) * (0.5 + 0.5 * cos(ph));
      }
      let shW = sw * (3.2 + 2.0 * mag) * (1.0 + 0.3 * turb) + ropeR;
      let sheath = exp(-(dL * dL) / (shW * shW));
      let cw = sw * 10.0 * (1.0 + 0.6 * mag);
      let halo = exp(-(dL * dL) / (cw * cw));
      let climbW = 0.5 + 0.5 * sin(sL * 14.0 - tf * (2.0 + 4.0 * mag) + fi * 1.7);
      let c3 = climbW * climbW * climbW;
      let climb = c3 * c3;
      let footB = 1.0 + 0.7 * (exp(-sL * 10.0) + exp(-(1.0 - sL) * 10.0));
      let whiteHot = mix(mix(vec3f(1.0, 0.93, 0.7), vec3f(1.0, 0.55, 0.5), hueR), vec3f(1.0, 0.55, 0.85), hueM);
      let redEdge = vec3f(0.85, 0.14, 0.03);
      var sol = (whiteHot * braid * 0.85 * (1.0 + 1.2 * climb + 0.6 * kick) * footB + live * sheath * 0.5 * (0.7 + 0.3 * turb) + redEdge * halo * 0.2) * (1.0 - 0.9 * gap) * vfoot;
      sol += mix(live, whiteHot, 0.5) * (sheath * 0.9 + halo * 0.3) * footGlow;
      if (ejAct > 0.002) {
        // Ejected blob: a twisting bubble that rises and swells, tied to the torn loop top by a strand.
        let ease = 1.0 - (1.0 - prog) * (1.0 - prog);
        let topX = lc.x + kelpLoopX(1.0, ry, leanL, curlA, curlP);
        let topP = vec2f(topX, lc.y + footSlope * (topX - lc.x) + ry);
        let bp = topP + vec2f(leanL * 0.4 * ease, (0.08 + 0.4 * ry) * ease * eSize);
        let rb = sw * (3.0 + 14.0 * prog) * (0.7 + 0.5 * d2.g) * eSize;
        let bv = (pw - bp) / rb;
        let bd = length(bv);
        let shell = exp(-(bd - 0.75) * (bd - 0.75) * 9.0) * (0.65 + 0.35 * sin(atan2(bv.y, bv.x) * 3.0 + bd * 4.0 - tf * 3.0));
        let blobCore = exp(-bd * bd * 3.0);
        let sa = pw - topP;
        let sb = bp - topP;
        let hseg = clamp(dot(sa, sb) / max(dot(sb, sb), 0.000001), 0.0, 1.0);
        let sd = sa - sb * hseg;
        let tw2 = sw * (1.5 + 2.5 * prog);
        let trail = exp(-dot(sd, sd) / (tw2 * tw2)) * (0.3 + 0.7 * hseg);
        sol += (mix(live, whiteHot, 0.6) * (shell * 0.7 + blobCore * 0.9) * (1.0 - 0.5 * prog) + live * trail * 0.5 + redEdge * exp(-bd * bd * 0.25) * 0.25) * ejAct * 1.6;
      }
      fl += sol * sCol * fBright;
      prox = max(prox, exp(-dL * dL * 60.0) * vfoot * mix(0.5, 1.0, nearK) * sCol);
    }

    // Blades (lamina), gas bladders / plasma knots and charged particles along the stipe.
    let nb = i32(clamp(4.0 + h * 5.0, 6.0, 12.0));
    let nbf = f32(nb);
    let energy = 0.7 + 0.8 * kick + 0.5 * mag;
    for (var k = 0; k < 12; k++) {
      if (k >= nb) { break; }
      let kf = f32(k);
      let hk = kelpHash(fi * 7.3 + kf * 1.9);
      let hk2 = kelpHash(fi * 3.1 + kf * 5.7 + 2.0);
      let yk = clamp(0.1 + kf * (0.9 / nbf) + (hk - 0.5) * (0.45 / nbf), 0.0, 1.0);
      let sgn = select(-1.0, 1.0, ((k + i) % 2) == 0);
      let ay = baseY + yk * h;
      let L = (0.05 + 0.05 * hk2) * thick * lenK;
      if (sBlade > 0.0) {
        let py = fract(yk + hk2 + t * (0.06 + 0.12 * mag) * (0.7 + hk));
        let pwy = baseY + py * h;
        let pxx = kelpAxis(baseX, py, pwy, amp, current, phase, fi, mag, t, sStraight) + sgn * 0.006 * sin(t * 2.0 + kf * 3.1 + fi) * thick;
        var ppos = vec2f(pxx, pwy);
        if (sCol > 0.001) {
          // Space: plasma knots stream along the coronal loop from foot to foot.
          let la = py * 3.14159265;
          let lqx = -dirL * rx * cos(la);
          let lpos = vec2f(lc.x + lqx + kelpLoopX(sin(la), ry, leanL, curlA, curlP), lc.y + footSlope * lqx + ry * sin(la));
          ppos = mix(ppos, lpos, sCol);
        }
        let pd = mix(p, pw, sCol) - ppos;
        let pr = dot(pd, pd) / (0.0022 * 0.0022 * thick);
        let fadeEnds = smoothstep(0.0, 0.1, py) * (1.0 - smoothstep(0.8, 1.0, py));
        fl += fBright * mix(live, vec3f(1.0, 0.9, 0.65), 0.4 * sCol) * (exp(-pr) * 1.6 + exp(-pr * 0.08) * 0.15) * fadeEnds * sBlade;
      }
      if (aqW <= 0.001) { continue; }
      // Lifted, fluttering blades can rise about two blade lengths above their node.
      if (abs(p.y - ay) > L * 2.2 + 0.03) { continue; }
      let ax = kelpAxis(baseX, yk, ay, amp, current, phase, fi, mag, t, sStraight);
      if (abs(p.x - ax) > L * 1.3 + 0.03) { continue; }

      // Bladder: a glowing amber sphere with fresnel rim, specular glint and a soft bloom halo.
      let rad = 0.0055 * thick * (0.9 + 0.4 * hk);
      let bq = vec2f(p.x - ax - sgn * 0.004 * thick, p.y - ay - 0.004 * thick);
      let bn = bq / rad;
      let br2 = dot(bn, bn);
      let br = sqrt(br2);
      if (aqW > 0.001) {
        let sph = 1.0 - smoothstep(0.85, 1.0 + 0.15 * soft, br);
        let z = sqrt(max(1.0 - br2, 0.0));
        let fres = (1.0 - z) * (1.0 - z) * sph;
        let sg = bn - vec2f(-0.35, 0.4);
        let spec = exp(-dot(sg, sg) * 22.0) * sph;
        let amber = mix(vec3f(1.0, 0.62, 0.18), live, 0.35);
        let halo = exp(-br2 * 0.3) * 0.3 + exp(-br * 0.8) * 0.12;
        let inner = amber * (0.35 + 0.65 * z) * sph * 0.55;
        fl += (inner + vec3f(1.0, 0.85, 0.5) * fres * 0.6 + vec3f(1.0, 0.97, 0.85) * spec * 0.7 + amber * halo) * energy * 0.5 * aqW;
      }

      if (bladeW > 0.001) {
        let q = vec2f(p.x - ax, p.y - ay) / L;
        let u = q.x * sgn;
        if (u >= 0.0 && u <= 1.15 && abs(q.y) <= 2.0) {
          let lift = select(0.1, 0.45, k == nb - 1) + 0.3 * hk2 - 0.15;
          let droop = 0.45 + 0.5 * hk;
          let flutter = 0.14 * u * u * sin(t * (1.5 + 2.0 * mag) + fi * 1.3 + kf * 2.1 - u * 4.0) * (0.6 + mag + kick);
          let trail = 0.18 * current * u * u;
          let v = q.y - (lift * u - droop * u * u + flutter + trail);
          let ruffle = 1.0 + 0.25 * sin(u * 18.0 + kf * 1.7 + t * 2.0 * (0.5 + mag)) + 0.1 * sin(u * 37.0 + fi);
          let hw = (0.09 + 0.05 * hk) * smoothstep(0.0, 0.18, u) * (1.0 - u * u * 0.8) * ruffle * select(1.0, 1.4, k == nb - 1);
          let dd = (abs(v) - hw) * L;
          let aa = 0.0015 * soft;
          let tipF = 1.0 - smoothstep(0.95, 1.15, u);
          let ins = (1.0 - smoothstep(-aa, aa, dd)) * tipF;
          let rimW = 0.0025 * soft;
          let rim = exp(-(dd * dd) / (rimW * rimW)) * tipF;
          let s = clamp(v / max(hw, 0.001), -1.0, 1.0);
          let vein = exp(-(v * v * L * L) / (0.0009 * 0.0009)) * ins;
          // Herringbone side veins, fine lengthwise striations and bullate corrugations.
          let sv = abs(sin(u * 26.0 - abs(s) * 4.0 + kf * 1.3 + fi));
          let sv2 = sv * sv * sv * sv;
          let side = sv2 * sv2 * sv2 * smoothstep(0.1, 0.5, abs(s)) * ins;
          let stria = 0.85 + 0.15 * sin(s * 13.0 + u * 2.0);
          let bump = 0.5 + 0.5 * sin(u * 31.0 + kf * 2.0) * sin(s * 5.5 + fi);
          // Translucency: thin edges and lit bumps glow gold-green, the thicker centre stays olive.
          let thinness = 0.45 + 0.55 * s * s;
          let lightB = (0.3 + 1.1 * dap) * (0.55 + 0.45 * yk);
          let bodyCol = mix(vec3f(0.12, 0.14, 0.03), vec3f(0.62, 0.66, 0.16), clamp(thinness * lightB * (0.7 + 0.5 * bump), 0.0, 1.0));
          let topTint = mix(bodyCol, live * 0.8 + bodyCol * 0.3, smoothstep(0.5, 1.0, yk) * 0.5);
          var lam = topTint * ins * 0.42 * stria * (1.0 - 0.35 * vein);
          lam += vec3f(0.8, 0.95, 0.5) * rim * (0.12 + 0.3 * dap + 0.1 * mag);
          lam += vec3f(0.75, 0.85, 0.3) * side * 0.12 * (0.4 + dap);
          fl += lam * 0.8 * bladeW;
        }
      }
    }
    // Atmospheric fade: distant layers lose contrast and sink into the water / void color.
    let flum = dot(fl, vec3f(0.3333, 0.3333, 0.3333));
    glow += mix(fl, fogCol * flum * 1.3, depth * 0.6) * dim;
  }

  // Particulate: two parallax layers of motes that sink through the water, or rise as sparks in space.
  let hg = shape.z * 6.2831853;
  let gTint = vec3f(0.55 + 0.45 * cos(hg), 0.55 + 0.45 * cos(hg - 2.1), 0.55 + 0.45 * cos(hg + 2.1));
  let rise = mix(-1.0, 1.0, sBlade);
  var snow = 0.0;
  for (var l = 0; l < 2; l++) {
    let lf = f32(l);
    let sc = mix(34.0, 19.0, lf);
    let off = vec2f(extra.z * mix(0.3, 1.0, lf) + t * 0.004, rise * t * mix(0.007, 0.013, lf));
    let g = (p - off) * sc + vec2f(lf * 17.3, lf * 5.1);
    let cellRaw = floor(g);
    let cell = cellRaw - 289.0 * floor(cellRaw / 289.0);
    let f = fract(g) - 0.5;
    let hc = kelpHash(dot(cell, vec2f(12.9898, 78.233)) + lf * 31.7);
    let jo = (vec2f(kelpHash(hc * 91.3 + 1.0), kelpHash(hc * 37.9 + 2.0)) - 0.5) * 0.4;
    let wob = vec2f(sin(t * 0.6 + hc * 40.0), cos(t * 0.45 + hc * 23.0)) * 0.08;
    let md = f - jo - wob;
    let rr = mix(0.05, 0.08, lf) * (0.6 + 0.6 * kelpHash(hc * 13.1 + 3.0));
    let tw = 0.55 + 0.45 * sin(t * (0.8 + 2.0 * hc) + hc * 50.0);
    snow += exp(-dot(md, md) / (rr * rr)) * step(0.5, hc) * tw * mix(0.55, 1.0, lf);
  }
  // Space: coverage of the opaque sun body below the curved limb (always 0 at theme 0).
  var sunCov = 0.0;
  if (sLimb > 0.001) {
    let sunLd = length(p - vec2f(aspect * 0.5, sunH - 2.6)) - 2.6;
    sunCov = (1.0 - smoothstep(-0.0015, 0.0015, sunLd)) * sLimb;
  }
  let snowCol = mix(vec3f(0.55, 0.8, 0.75), mix(vec3f(1.0, 0.5, 0.15), vec3f(1.0, 0.85, 0.5), 0.4), sCol);
  glow += snowCol * snow * (0.2 + 0.8 * prox) * (0.5 + 0.9 * dap + 0.4 * sCol) * (1.0 + 0.5 * extra.x) * 0.6 * (1.0 - sunCov);

  // Soft-knee cap keeps the forest a background layer without flattening its highlights.
  let cap = 0.12 * view.w * (1.0 + 2.2 * sCol) + 0.0001;
  let gl = glow * 0.12 * view.w;
  let added = cap * (vec3f(1.0, 1.0, 1.0) - exp(-1.2 * gl / cap));
  let lum = dot(base.rgb, vec3f(0.2126, 0.7152, 0.0722));
  let mask = 1.0 - smoothstep(0.08, 0.35, lum);
  // The opaque sun replaces the input, so its glow mask no longer depends on the input brightness.
  let maskS = mix(mask, 1.0, sunCov);

  // Dark sun surface rising in at the bottom: an opaque body with dark granulation, swirling sunspots,
  // faint magnetic loop traces, slow churning, subtle limb darkening, a bright chromosphere rim,
  // fine spicules and a soft corona.
  var air = vec3f(0.0, 0.0, 0.0);
  var surfCol = vec3f(0.0, 0.0, 0.0);
  if (sLimb > 0.001) {
    let R = 2.6;
    let sunC = vec2f(aspect * 0.5, sunH - R);
    let rel = p - sunC;
    let rl = length(rel);
    let ld = rl - R;
    let hgt = max(ld, 0.0);
    let sunAct = 0.7 + 0.4 * extra.y + 0.5 * extra.x;
    let rim = select(exp(ld / 0.002), exp(-ld / 0.0025), ld > 0.0);
    let chromo = exp(-hgt / 0.009) * step(0.0, ld);
    let corona = exp(-hgt / 0.06) * step(0.0, ld);
    // Spicules: fine tilted jets along the edge, each with its own height and slow pulse.
    var spic = 0.0;
    if (ld > -0.002 && ld < 0.045) {
      let arcX = atan2(rel.x, rel.y) * R;
      for (var sl = 0; sl < 2; sl++) {
        let slf = f32(sl);
        let freq = mix(140.0, 90.0, slf);
        let u = arcX * freq + slf * 7.3;
        let hsp = kelpHash(floor(u) * 1.731 + slf * 13.1);
        let hS = (0.008 + 0.022 * hsp) * (0.6 + 0.4 * sin(t * (0.7 + hsp) + hsp * 40.0)) * (1.0 + 0.5 * extra.x);
        let tilt = (kelpHash(hsp * 7.7 + 3.0) - 0.5) * 0.7;
        let fx = fract(u) - 0.5 - tilt * min(hgt / 0.03, 1.0);
        spic += exp(-fx * fx / 0.045) * (1.0 - smoothstep(0.0, hS, hgt)) * step(0.0, ld) * (0.4 + 0.6 * hsp) * mix(1.0, 0.6, slf);
      }
    }
    air = vec3f(1.0, 0.8, 0.45) * rim * 1.5 * sunAct + vec3f(1.0, 0.32, 0.12) * chromo * 0.45 * sunAct + vec3f(1.0, 0.45, 0.18) * spic * 0.3 + vec3f(0.55, 0.16, 0.05) * corona * 0.18 * (0.8 + 0.4 * extra.y);
    air *= 0.3 * view.w * sLimb * rimGlow * (0.5 + 0.5 * maskS);
    if (ld < 0.0015) {
      let n = rel / R;
      let z = sqrt(max(1.0 - dot(n, n), 0.0));
      // Surface coordinates in frame units, foreshortened toward the limb, dragged by a slow churning flow.
      let S0 = vec2f(rel.x, z * R * 0.55);
      let churn = vec2f(kelpNoise(S0 * 4.0 + vec2f(t * 0.04, 0.0)), kelpNoise(S0 * 4.0 + vec2f(7.3, -t * 0.035))) - vec2f(0.5, 0.5);
      let S = S0 + churn * 0.05;
      // Granulation: dark cells with faint warm edges; each cell slowly bubbles on its own beat.
      let gr = kelpGran(S * 34.0, t);
      let pulse = 0.6 + 0.4 * sin(t * (0.9 + 0.8 * gr.y) + gr.y * 40.0);
      let meso = 0.6 + 0.8 * kelpNoise(S * 7.0 + vec2f(t * 0.03, 1.7));
      let fade = smoothstep(0.015, 0.07, z);
      let lane = exp(-gr.x / 0.07) * fade;
      let cellC = smoothstep(0.15, 0.5, gr.x) * pulse * fade;
      var surf = vec3f(0.018, 0.004, 0.001) * meso + vec3f(0.03, 0.007, 0.001) * cellC + vec3f(0.17, 0.05, 0.008) * lane * (0.5 + 0.5 * pulse) * meso + vec3f(0.06, 0.015, 0.003) * (1.0 - fade);
      // Faint magnetic loop traces: dipole field lines arching between the two sunspots, slowly drifting.
      let a1 = atan2(S.y - 0.32, S.x + 0.32);
      let a2 = atan2(S.y - 0.3, S.x - 0.55);
      let psi = (a1 - a2) * 0.15915494 * 14.0 + 0.4 * kelpNoise(S * 9.0 + vec2f(0.0, t * 0.05)) + t * 0.03;
      let pf = fract(psi) - 0.5;
      let traceL = exp(-pf * pf / 0.0025) * fade;
      surf += vec3f(0.14, 0.045, 0.01) * traceL * 0.35 * (0.4 + 0.6 * exp(-length(S - vec2f(0.115, 0.31)) * 2.0));
      // Sunspots: near-black umbra with faint umbral dots, inside a penumbra of radial filaments
      // that spiral and slowly rotate as a domain-warped vortex.
      for (var si = 0; si < 2; si++) {
        let sif = f32(si);
        let spC = mix(vec2f(-0.32, 0.32), vec2f(0.55, 0.3), sif);
        let rP = mix(0.19, 0.09, sif) * spotSize;
        let dq = S - spC;
        let r = length(dq);
        if (r > rP * 1.3) { continue; }
        let rn = r / rP;
        let spin = mix(1.0, -1.0, sif);
        let wv = kelpNoise(dq * 22.0 + vec2f(sif * 5.0, t * 0.06)) - 0.5;
        let ang = atan2(dq.y, dq.x) + spin * (t * 0.05 * sunSwirl + (1.0 - rn) * 1.6) + wv * 0.5;
        let fil = kelpPNoise(vec2f(ang * 0.15915494 * 48.0, rn * 3.0 - t * 0.08 * sunSwirl), 48.0);
        let fil2 = kelpPNoise(vec2f(ang * 0.15915494 * 96.0, rn * 5.0 + 3.0), 96.0);
        let filament = smoothstep(0.3, 0.8, fil * 0.65 + fil2 * 0.35);
        let pen = 1.0 - smoothstep(0.9, 1.08, rn + wv * 0.12);
        let umb = 1.0 - smoothstep(0.39, 0.49, rn + wv * 0.1);
        let penCol = mix(vec3f(0.015, 0.003, 0.0), vec3f(0.2, 0.055, 0.01), filament * (0.4 + 0.6 * smoothstep(0.4, 1.0, rn)));
        let ug = dq * 70.0 + vec2f(sif * 31.0, 0.0);
        let hu = kelpHash(dot(floor(ug), vec2f(7.1, 113.3)) + 4.0);
        let uf = fract(ug) - 0.5;
        let dots = exp(-dot(uf, uf) * 40.0) * step(0.72, hu) * (0.5 + 0.5 * sin(t * (1.0 + 2.0 * hu) + hu * 30.0));
        let umbCol = vec3f(0.004, 0.0008, 0.0) + vec3f(0.1, 0.025, 0.004) * dots;
        surf = mix(surf, mix(penCol, umbCol, umb), pen);
      }
      // Subtle limb darkening toward the edge, with a narrow hot orange band right at the rim.
      surf = surf * (0.55 + 0.45 * smoothstep(0.0, 0.22, z)) + vec3f(0.9, 0.42, 0.08) * exp(-z / 0.01) * 0.25;
      surfCol = surf * (1.0 + 0.35 * extra.x) * 0.75 * view.w * sunDark;
    }
  }
  // Inside the limb the opaque surface replaces the input; flares, sparks and the rim draw on top.
  let shown = mix(base.rgb, surfCol, sunCov);
  return vec4f(shown + added * maskS + air, 1.0);
}

fn kelpLimb(x: f32, aspect: f32, sh: f32) -> f32 {
  let R = 2.6;
  let dx = x - aspect * 0.5;
  return sh - (R - sqrt(max(R * R - dx * dx, 0.0)));
}

fn kelpAxis(baseX: f32, yf: f32, wy: f32, amp: f32, current: f32, phase: f32, fi: f32, mag: f32, t: f32, s: f32) -> f32 {
  let bent = kelpCenter(baseX, yf, wy, amp, current, phase, fi, mag);
  let c = clamp(yf, 0.0, 1.0);
  let straight = baseX + amp * c * current * 0.5 + 0.0025 * sin(t * 3.0 + c * 18.0 + fi * 2.1) * c;
  return mix(bent, straight, s);
}

fn kelpCenter(baseX: f32, yf: f32, wy: f32, amp: f32, current: f32, phase: f32, fi: f32, mag: f32) -> f32 {
  let c = clamp(yf, 0.0, 1.0);
  let bend = pow(c, 1.5);
  let travel = sin(wy * 9.0 - phase + fi * 2.3) * 0.18;
  return baseX + amp * bend * (current + travel * (0.6 + 1.5 * mag)) + 0.012 * sin(c * 4.0 + fi * 1.9) * c;
}

fn kelpHash(x: f32) -> f32 {
  return fract(sin(x * 127.1 + 11.7) * 43758.5453);
}

fn kelpNoise(x: vec2f) -> f32 {
  let i = floor(x);
  let f = fract(x);
  let u = f * f * (3.0 - 2.0 * f);
  let a = kelpHash(dot(i, vec2f(1.0, 57.0)));
  let b = kelpHash(dot(i + vec2f(1.0, 0.0), vec2f(1.0, 57.0)));
  let c = kelpHash(dot(i + vec2f(0.0, 1.0), vec2f(1.0, 57.0)));
  let d = kelpHash(dot(i + vec2f(1.0, 1.0), vec2f(1.0, 57.0)));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Horizontal offset of a coronal loop at height fraction yr: a lean plus a travelling curl.
fn kelpLoopX(yr: f32, ry: f32, lean: f32, curlA: f32, curlP: f32) -> f32 {
  return lean * yr * ry + curlA * sin(yr * 4.0 + curlP) * yr;
}

// Value noise that wraps in x with the given integer period (seamless around a sunspot).
fn kelpPNoise(x: vec2f, period: f32) -> f32 {
  let i = floor(x);
  let f = fract(x);
  let u = f * f * (3.0 - 2.0 * f);
  let i0 = i.x - period * floor(i.x / period);
  let i1 = i0 + 1.0 - period * floor((i0 + 1.0) / period);
  let a = kelpHash(i0 + i.y * 57.0);
  let b = kelpHash(i1 + i.y * 57.0);
  let c = kelpHash(i0 + (i.y + 1.0) * 57.0);
  let d = kelpHash(i1 + (i.y + 1.0) * 57.0);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Animated Voronoi granulation. x: lane distance (F2 - F1), y: cell hash.
fn kelpGran(x: vec2f, t: f32) -> vec2f {
  let i = floor(x);
  let f = fract(x);
  var d1 = 8.0;
  var d2 = 8.0;
  var id = 0.0;
  for (var yy = -1; yy <= 1; yy++) {
    for (var xx = -1; xx <= 1; xx++) {
      let o = vec2f(f32(xx), f32(yy));
      let c = i + o;
      let hb = dot(c, vec2f(1.0, 57.0));
      let h1 = kelpHash(hb);
      let h2 = kelpHash(hb + 19.19);
      let jp = vec2f(0.5, 0.5) + 0.38 * vec2f(sin(t * (0.35 + 0.3 * h1) + h1 * 6.2831853), cos(t * (0.3 + 0.3 * h2) + h2 * 6.2831853));
      let r = o + jp - f;
      let d = dot(r, r);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = h1;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return vec2f(sqrt(d2) - sqrt(d1), id);
}

fn kelpCaustic(a: vec2f, t: f32) -> f32 {
  let w1 = sin(a.x + sin(a.y * 0.8 + t * 0.7) * 1.3 + t * 0.5);
  let w2 = sin(a.y * 1.1 + sin(a.x * 0.9 - t * 0.6) * 1.4 - t * 0.4);
  let w3 = sin((a.x + a.y) * 0.7 + sin(a.x * 1.3 + t * 0.3) + t * 0.6);
  let c = 1.0 - abs(w1 + w2 + w3) / 3.0;
  let c2 = c * c;
  return c2 * c2 * c;
}
`;

function mulberry32(seed: number) {
  let a = (Math.floor(seed) * 9973 + 12345) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Edge-to-edge clump layout. The width is split into one slot per clump and each clump
// centre is jittered inside its slot, so no large gap opens and both edges always hold kelp.
// The outer clumps hug the frame edges. Every clump gets a minimum share of fronds; the rest
// go out by uneven weights. A few strays fill in between. Depth uses three layers.
function buildLayout(count: number, clumping: number, seed: number, aspect: number, out: Float32Array) {
  const rng = mulberry32(seed);
  const nClumps = Math.max(3, Math.min(count, Math.round(aspect * 2.2) + Math.floor(rng() * 2)));
  const centers: number[] = [];
  const weights: number[] = [];
  const spreads: number[] = [];
  let total = 0;
  for (let c = 0; c < nClumps; c++) {
    let center = (c + 0.15 + rng() * 0.7) / nClumps;
    if (c === 0) center = 0.02 + rng() * (0.4 / nClumps);
    if (c === nClumps - 1) center = 0.98 - rng() * (0.4 / nClumps);
    centers.push(center);
    const w = 0.15 + Math.pow(rng(), 1.6);
    weights.push(w);
    total += w;
    spreads.push(0.018 + rng() * 0.05);
  }
  const strays = count >= 8 ? 1 + Math.floor(rng() * 3) : 0;
  const clumped = count - strays;
  const minEach = Math.max(1, Math.floor((clumped * 0.5) / nClumps));
  const xs: number[] = [];
  for (let i = 0; i < strays; i++) xs.push((i + 0.15 + rng() * 0.7) / strays);
  for (let i = 0; i < clumped; i++) {
    let c = 0;
    if (i < minEach * nClumps) {
      c = i % nClumps;
    } else {
      let r = rng() * total;
      while (c < nClumps - 1 && r > weights[c]) {
        r -= weights[c];
        c++;
      }
    }
    xs.push(centers[c] + (rng() + rng() + rng() - 1.5) * 2 * spreads[c]);
  }
  xs.sort((a, b) => a - b);
  for (let i = 0; i < count; i++) {
    const even = (i + 0.5) / count;
    const x = even + (xs[i] - even) * clumping;
    out[BAND_TEX * 4 + i * 4] = Math.max(0.012, Math.min(0.988, x));
    out[BAND_TEX * 4 + i * 4 + 1] = 0.6 + rng() * 1.0;
    const layer = rng();
    out[BAND_TEX * 4 + i * 4 + 2] = (layer < 0.3 ? 0 : layer < 0.65 ? 0.5 : 1) + (rng() - 0.5) * 0.08;
    out[BAND_TEX * 4 + i * 4 + 3] = -rng() * 0.05;
  }
}

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'jellyfish/kelp',
    label: 'Spectrum Kelp',
    description: 'Adds a dim, layered background of sun-dappled kelp fronds in uneven clumps across the full width. Each frond follows one spectrum band.',
    tags: ['jellyfish', 'audio', 'background'],
    inputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image to add the kelp behind.',
      },
    },
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image with faint kelp added in dark areas.',
      },
    },
    controls: {
      count: { type: 'number', group: 'Kelp', label: 'Frond count', default: 16, min: 6, max: 40, step: 1 },
      clumping: { type: 'number', group: 'Kelp', label: 'Clumping', default: 0.8, min: 0, max: 1, step: 0.01 },
      seed: { type: 'number', group: 'Kelp', label: 'Seed', default: 7, min: 0, max: 999, step: 1 },
      height: { type: 'number', group: 'Kelp', label: 'Height', default: 1.2, min: 0.1, max: 6, step: 0.01 },
      sway: { type: 'number', group: 'Kelp', label: 'Sway', default: 1, min: 0, max: 4, step: 0.01 },
      brightness: { type: 'number', group: 'Color', label: 'Brightness', default: 1, min: 0, max: 2, step: 0.01 },
      hue: { type: 'number', group: 'Color', label: 'Tip hue', default: 0.45, min: 0, max: 1, step: 0.01 },
      bandMapping: { type: 'number', group: 'Audio', label: 'Band mapping', default: 0, min: 0, max: 1, step: 1 },
      response: { type: 'number', group: 'Audio', label: 'Response', default: 2, min: 0, max: 5, step: 0.01 },
      sensitivity: { type: 'number', group: 'Audio', label: 'Sensitivity', default: 1.5, min: 0, max: 5, step: 0.01 },
      smoothing: { type: 'number', group: 'Audio', label: 'Smoothing', default: 0.5, min: 0, max: 1, step: 0.01 },
      flareBrightness: { type: 'number', group: 'Solar flares', label: 'Flare brightness', default: 1, min: 0, max: 6, step: 0.01 },
      flareHeight: { type: 'number', group: 'Solar flares', label: 'Flare height', default: 1, min: 0.1, max: 4, step: 0.01 },
      flareWidth: { type: 'number', group: 'Solar flares', label: 'Flare width', default: 1, min: 0.2, max: 4, step: 0.01 },
      flareThickness: { type: 'number', group: 'Solar flares', label: 'Flare thickness', default: 1, min: 0.2, max: 6, step: 0.01 },
      flareSwirl: { type: 'number', group: 'Solar flares', label: 'Flare swirl', default: 1, min: 0, max: 8, step: 0.01 },
      flareBraid: { type: 'number', group: 'Solar flares', label: 'Flare braid', default: 1, min: 0, max: 4, step: 0.01 },
      flareSpeed: { type: 'number', group: 'Solar flares', label: 'Flare speed', default: 1, min: 0, max: 6, step: 0.01 },
      flareHue: { type: 'number', group: 'Solar flares', label: 'Flare hue', default: 0, min: 0, max: 2, step: 0.01 },
      eruptionChance: { type: 'number', group: 'Solar flares', label: 'Eruption threshold', default: 1, min: 0.1, max: 8, step: 0.01 },
      eruptionSize: { type: 'number', group: 'Solar flares', label: 'Eruption size', default: 1, min: 0.2, max: 4, step: 0.01 },
      sunDarkness: { type: 'number', group: 'Solar flares', label: 'Sun surface brightness', default: 1, min: 0, max: 6, step: 0.01 },
      sunspotSize: { type: 'number', group: 'Solar flares', label: 'Sunspot size', default: 1, min: 0.2, max: 3, step: 0.01 },
      sunSwirl: { type: 'number', group: 'Solar flares', label: 'Sunspot swirl speed', default: 1, min: -4, max: 8, step: 0.01 },
      rimGlow: { type: 'number', group: 'Solar flares', label: 'Rim glow', default: 1, min: 0, max: 6, step: 0.01 },
      sunHeight: { type: 'number', group: 'Solar flares', label: 'Sun height', default: 0.13, min: -0.3, max: 0.8, step: 0.005 },
    },
    controlDescriptions: {
      count: 'Number of kelp fronds. Each frond is one spectrum band.',
      clumping: '0 spaces fronds evenly. 1 groups them in uneven clumps spread edge to edge, with a few strays.',
      seed: 'Changes the random clump layout and depth layers.',
      height: 'Frond reach as a fraction of the frame height. Quiet bands rest at 25% of it; loud bands climb to about 135%, and kicks stretch them further.',
      sway: 'Strength of the slow current and traveling waves along each frond.',
      brightness: 'Overall kelp glow. It stays dim and only shows in dark areas.',
      hue: 'Tint of the emissive tips and nodes. Bands spread the hue across the row.',
      bandMapping: '0 maps low to high frequencies from left to right. 1 assigns bands in a hashed order.',
      response: 'How strongly band loudness raises and kicks the fronds.',
      sensitivity: 'Scales each auto-gained band before the response curve. Raise it to make quiet music move the fronds more.',
      smoothing: 'Spring time of the frond motion. 0 is quick and tight, 0.5 rises in about 120 ms and settles in about 600 ms, 1 is slow and fluid.',
      flareBrightness: "Brightness of the solar flare loops, strands and knots.",
      flareHeight: "Multiplier on the arch height of the flare loops.",
      flareWidth: "Multiplier on how far each loop spreads between its two feet.",
      flareThickness: "Multiplier on the line thickness of the flare loops.",
      flareSwirl: "Amount of turbulence that warps and ripples the loops. 0 is smooth.",
      flareBraid: "Twist rate of the strands braided along each loop. 0 collapses them into one line.",
      flareSpeed: "Speed of flare animation and pulses. 0 freezes the flares.",
      flareHue: "Colour shift of the flares. 0 is gold and orange, 1 is red, 2 is magenta.",
      eruptionChance: "Multiplier on the beat strength needed to throw a plasma eruption. Lower gives more eruptions, higher fewer.",
      eruptionSize: "Size and throw distance of the ejected plasma blobs.",
      sunDarkness: "Brightness of the sun surface. 0 is black, 1 is the dark default, higher glows.",
      sunspotSize: "Multiplier on the radius of the sunspots.",
      sunSwirl: "Rotation speed of the sunspot vortices. Negative values reverse them.",
      rimGlow: "Strength of the chromosphere, spicules and corona around the sun's edge.",
      sunHeight: "Vertical position of the sun's limb as a fraction of frame height, from the bottom.",
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    const view = uniform(new Vector4(0, aspect, 16, 1));
    const shape = uniform(new Vector4(1.2, 1, 0.45, 0));
    const extra = uniform(new Vector4(0, 0, 0, 0));
    const flareA = uniform(new Vector4(1, 1, 1, 1));
    const flareB = uniform(new Vector4(1, 1, 1, 0));
    const flareC = uniform(new Vector4(1, 1, 1, 1));
    const flareD = uniform(new Vector4(1, 1, 0.13, 0));
    const bandData = new Float32Array(BAND_TEX * 3 * 4);
    const bandTex = new DataTexture(bandData, BAND_TEX, 3, RGBAFormat, FloatType);
    bandTex.minFilter = NearestFilter;
    bandTex.magFilter = NearestFilter;
    bandTex.needsUpdate = true;
    const bandsNode = texture(bandTex);
    const baseTex = texture(new Texture(), vec2(uv().x, uv().y.oneMinus()) as any);
    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    material.fragmentNode = (wgslFn(kelpPass) as any)(uv(), baseTex, bandsNode, view, shape, extra, flareA, flareB, flareC, flareD);
    const scene = new Scene();
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    const level = new Float32Array(MAX_FRONDS);
    const levelVel = new Float32Array(MAX_FRONDS);
    const kick = new Float32Array(MAX_FRONDS);
    const kickVel = new Float32Array(MAX_FRONDS);
    const impulse = new Float32Array(MAX_FRONDS);
    const phase = new Float32Array(MAX_FRONDS);
    const peak = new Float32Array(MAX_FRONDS).fill(0.05);
    const ejAge = new Float32Array(MAX_FRONDS).fill(99);
    const ejStr = new Float32Array(MAX_FRONDS);
    // Exact critically damped spring step toward target with angular frequency w.
    const spring = (x: number, v: number, target: number, w: number, dt: number): [number, number] => {
      const c1 = x - target;
      const c2 = v + w * c1;
      const e = Math.exp(-w * dt);
      return [target + (c1 + c2 * dt) * e, (c2 - w * (c1 + c2 * dt)) * e];
    };
    let lastTime = -1;
    let layoutKey = '';
    let theme = 0;

    return {
      update(frame) {
        const c = frame.controls;
        const count = Math.max(1, Math.min(MAX_FRONDS, Math.round(c.count)));
        const key = `${count}|${c.clumping}|${c.seed}`;
        if (key !== layoutKey) {
          layoutKey = key;
          buildLayout(count, Math.max(0, Math.min(1, c.clumping)), c.seed, aspect, bandData);
        }
        const dt = lastTime < 0 ? 1 / 60 : Math.max(0, Math.min(0.1, frame.timeSeconds - lastTime));
        lastTime = frame.timeSeconds;
        const themeTarget = Math.max(0, Math.min(1, jellyShared.theme || 0));
        theme += (themeTarget - theme) * (1 - Math.exp(-dt / 0.35));
        if (Math.abs(theme - themeTarget) < 1e-4) theme = themeTarget;
        const spectrum = frame.audioSpectrum;
        const mags = spectrum?.available ? spectrum.magnitudes : undefined;
        const n = mags ? mags.length : 0;
        // Critically damped springs: about 120 ms rise and 600 ms settle at smoothing 0.5.
        const springTime = 0.25 + 1.5 * Math.max(0, Math.min(1, c.smoothing ?? 0.5));
        const wUp = 28 / springTime;
        const wDown = 9.7 / springTime;
        const wKick = 30 / springTime;
        const sensitivity = Math.max(0, c.sensitivity ?? 1.5);
        const peakDecay = Math.exp(-dt / 2);
        const impulseDecay = Math.exp(-dt / 0.2);
        const gain = 0.5 * c.response;
        let maxKick = 0;
        let sumLevel = 0;
        for (let i = 0; i < count; i++) {
          let raw = 0;
          if (n > 0) {
            // Log-spaced band, skipping the lowest bins, like spectral-waves' smoothed sampling.
            let slot = i;
            if (c.bandMapping >= 0.5) slot = Math.floor(((Math.sin(i * 91.7 + 3.3) * 43758.5453) % 1 + 1) % 1 * count);
            const a = Math.floor(2 + Math.pow(slot / count, 1.6) * (n - 3));
            const b = Math.max(a + 1, Math.floor(2 + Math.pow((slot + 1) / count, 1.6) * (n - 3)));
            for (let k = a; k < b; k++) raw += Math.max(0, Math.min(1, mags![k] ?? 0));
            raw /= b - a;
          }
          // Strong per-band auto-gain (peak decays over ~2 s), scaled by sensitivity, then a soft expansion curve.
          peak[i] = Math.max(raw, peak[i] * peakDecay, 0.01);
          const target = Math.min(1, Math.pow((sensitivity * raw) / peak[i], 0.7) * Math.min(1, raw * 60) * gain);
          // Transient: a jump above the lagging spring feeds an impulse; the kick eases toward it.
          const onset = target - level[i];
          if (onset > 0.15) {
            impulse[i] = Math.max(impulse[i], Math.min(1, onset * 2.5));
          }
          // A strong onset also starts a flare eruption in space mode.
          if (onset > 0.15 * Math.max(0.01, c.eruptionChance ?? 1)) {
            const strength = Math.min(1, onset * 2.5);
            if (ejAge[i] > 0.9 || strength > ejStr[i] + 0.25) {
              ejAge[i] = 0;
              ejStr[i] = strength;
            }
          }
          impulse[i] *= impulseDecay;
          ejAge[i] = Math.min(99, ejAge[i] + dt);
          [kick[i], kickVel[i]] = spring(kick[i], kickVel[i], impulse[i], wKick, dt);
          [level[i], levelVel[i]] = spring(level[i], levelVel[i], target, target > level[i] ? wUp : wDown, dt);
          phase[i] += dt * (1.2 + Math.max(0, level[i]) * 5);
          bandData[i * 4] = Math.max(0, Math.min(1.2, level[i]));
          bandData[i * 4 + 1] = Math.max(0, Math.min(1, kick[i]));
          bandData[i * 4 + 2] = phase[i];
          bandData[BAND_TEX * 8 + i * 4] = ejAge[i];
          bandData[BAND_TEX * 8 + i * 4 + 1] = ejStr[i];
          maxKick = Math.max(maxKick, kick[i]);
          sumLevel += level[i];
        }
        for (let i = count; i < BAND_TEX; i++) {
          bandData[i * 4] = 0;
          bandData[i * 4 + 1] = 0;
          bandData[BAND_TEX * 8 + i * 4] = 99;
          bandData[BAND_TEX * 8 + i * 4 + 1] = 0;
        }
        bandTex.needsUpdate = true;
        const t = frame.timeSeconds;
        // Slow lateral camera drift; near layers move most, which reads as parallax.
        const drift = 0.022 * Math.sin(t * 0.031) + 0.012 * Math.sin(t * 0.0171 + 1.3);
        view.value.set(t, aspect, count, c.brightness);
        shape.value.set(c.height, c.sway, c.hue, theme);
        extra.value.set(maxKick, sumLevel / count, drift, 0);
        const g = (v: number | undefined, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
        flareA.value.set(g(c.flareBrightness, 1), g(c.flareHeight, 1), g(c.flareWidth, 1), g(c.flareThickness, 1));
        flareB.value.set(g(c.flareSwirl, 1), g(c.flareBraid, 1), g(c.flareSpeed, 1), g(c.flareHue, 0));
        flareC.value.set(g(c.eruptionChance, 1), g(c.eruptionSize, 1), g(c.sunDarkness, 1), g(c.sunspotSize, 1));
        flareD.value.set(g(c.sunSwirl, 1), g(c.rimGlow, 1), g(c.sunHeight, 0.13), 0);
      },
      async evaluate(inputs, evaluation) {
        baseTex.value = inputs.image.texture as Texture;
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {
        level.fill(0);
        levelVel.fill(0);
        kick.fill(0);
        kickVel.fill(0);
        impulse.fill(0);
        phase.fill(0);
        peak.fill(0.05);
        ejAge.fill(99);
        ejStr.fill(0);
        lastTime = -1;
        layoutKey = '';
      },
      dispose() {
        geometry.dispose();
        material.dispose();
        bandTex.dispose();
      },
    };
  },
});
