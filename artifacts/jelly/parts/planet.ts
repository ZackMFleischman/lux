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

// Aquarium: a glowing nacre pearl with a tilted ring of orbiting bubbles.
// Space: a distant Saturn (hexagon at the north pole, turbulent bands, Keplerian rings).
// Theme morph: the nacre swirl stretches into bands and shifts to Saturn colours; each bubble seeds a
// ring arc that grows along its orbit to the next bubble (inner C/B rings first, then the A ring),
// the bubble riding the tip until the arcs join. Pearl and planet share position and size.
// Units: one unit is the planet radius (size * screen height).
// Planet frame (q): screen space rolled by tilt, sphere radius 1, +z toward the viewer, orthographic rays.
// Ring plane normal n = (0, cos(ringTilt), sin(ringTilt)) is also the planet's north pole.
// Uniforms:
//   view   = (time, aspect, theme, pearl spin phase)
//   place  = (posX, posY, planet radius in screen heights, tilt radians)
//   ring   = (outer ring radius in planet radii, ring tilt radians, bass 0..1, highs 0..1)
//   look   = (brightness, hue radians, 1 / output height, unused)
//   motion = (ring orbit phase, Saturn spin phase, unused, unused)
const planetPass = `
fn jellyPlanet(st: vec2f, base: vec4f, view: vec4f, place: vec4f, ring: vec4f, look: vec4f, motion: vec4f) -> vec4f {
  let t = view.x;
  let th = clamp(view.z, 0.0, 1.0);
  let spin = view.w;
  let bright = look.x;
  let hueA = look.y;
  let bass = ring.z;
  let highs = ring.w;
  let rOrb = motion.x;
  let satSpin = motion.y;

  // Staged morph (0 = pearl and bubble ring, 1 = distant Saturn).
  let mFlat = smoothstep(0.0, 0.45, th);
  let mSwirl = smoothstep(0.1, 0.6, th);
  let mColor = smoothstep(0.3, 0.8, th);
  let fd = smoothstep(0.55, 1.0, th);
  // Ring growth from the bubbles, inside out: bubbles settle onto seed radii, each grows an arc
  // along its orbit to the next seed, the arcs widen into the ring groups, then fine detail arrives.
  let seedIn = smoothstep(0.08, 0.26, th);
  let seedOut = smoothstep(0.18, 0.4, th);
  let gIn = smoothstep(0.18, 0.55, th);
  let gOut = smoothstep(0.38, 0.75, th);
  let wIn = smoothstep(0.5, 0.72, th);
  let wOut = smoothstep(0.66, 0.85, th);
  let grow = vec4f(gIn, gOut, wIn, wOut);
  let mDetail = smoothstep(0.72, 0.92, th);
  let mFull = smoothstep(0.84, 0.98, th);

  let S = max(place.z, 0.005);
  let px = max(look.z / S, 0.0001);
  let ca = cos(place.w);
  let sa = sin(place.w);
  let p0 = (st - place.xy) * vec2f(view.y, 1.0) / S;
  let q = vec2f(ca * p0.x + sa * p0.y, -sa * p0.x + ca * p0.y);
  let rr = length(q);
  let pxq = px;

  let outerR = max(ring.x, 1.1);
  let innerR = min(1.22, outerR * 0.85);
  if (rr > outerR + 0.45) {
    return vec4f(base.rgb, 1.0);
  }

  // Key light at the upper left, expressed in the rolled frame.
  let ls = normalize(vec3f(-0.62, 0.58, 0.52));
  let L = vec3f(ca * ls.x + sa * ls.y, -sa * ls.x + ca * ls.y, ls.z);

  // Ring plane (equatorial).
  let sRaw = sin(ring.y);
  let sgn = select(-1.0, 1.0, sRaw >= 0.0) * max(abs(sRaw), 0.035);
  let n = normalize(vec3f(0.0, cos(ring.y), sgn));
  let e2 = vec3f(0.0, n.z, -n.y);
  let zr = -q.y * n.y / n.z;
  let H = vec3f(q, zr);
  let rH = length(H);
  let hy = dot(H, e2);
  let angP = atan2(hy, H.x);
  let angB = atan2(clamp(hy, -outerR * 1.2, outerR * 1.2), H.x);

  // Sphere coverage and depth (softer edges when far away).
  let aa = pxq * mix(1.25, 2.6, fd);
  let cov = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, rr);
  let r2 = dot(q, q);
  let zs = sqrt(max(1.0 - r2, 0.0));
  let zHit = select(-1000.0, zs, r2 < 1.0);

  var planetCol = vec3f(0.0);
  if (cov > 0.0) {
    let N = normalize(vec3f(q, zs + 0.0001));
    let a0 = N.x;
    let b0 = dot(N, e2);
    let c0 = dot(N, n);
    let ang = spin * (1.0 + 0.12 * cos(c0 * 7.0));
    let cs = cos(ang);
    let sn = sin(ang);
    let P = vec3f(a0 * cs - b0 * sn, a0 * sn + b0 * cs, c0);

    // Pearl nacre: isotropic swirl that stretches toward bands during the morph.
    var nacre = vec3f(0.0);
    if (mColor < 0.999) {
      let horiz = mix(1.9, 1.15, mSwirl);
      let vert = mix(1.9, 7.5, mSwirl);
      let Ps = vec3f(P.x * horiz, P.y * horiz, P.z * vert) + vec3f(t * 0.01, -t * 0.007, 0.0);
      let wq = Ps * 1.3;
      let warp = vec3f(
        plFbm3(wq + vec3f(3.1, 1.7, 0.4)),
        plFbm3(wq + vec3f(7.7, 2.9, 5.3)),
        plFbm3(wq + vec3f(1.3, 8.2, 2.6))
      ) - vec3f(0.5);
      let wAmp = mix(1.5, 0.55, mSwirl);
      let w = plFbm3(Ps + warp * wAmp);
      let film = w * 1.7 + (1.0 - N.z) * 0.85 + t * 0.025 + warp.x * 0.6;
      let iri = 0.5 + 0.5 * cos(6.2832 * (film + vec3f(0.0, 0.33, 0.67)));
      let layers = 0.5 + 0.5 * sin(w * 38.0 + warp.y * 6.0);
      nacre = vec3f(0.95, 0.91, 0.90) * (0.92 + 0.08 * layers);
      nacre = mix(nacre, nacre * (0.5 + 0.7 * iri), 0.5);
    }
    // Saturn surface in latitude/longitude.
    var gas = vec3f(0.0);
    if (mColor > 0.001) {
      gas = plSaturn(N, n, e2, satSpin);
    }
    let albedo = mix(nacre, gas, mColor);

    // Ring shadow on the planet.
    var ringShadow = 0.0;
    let den = dot(L, n);
    if (gIn > 0.0005 && abs(den) > 0.001) {
      let ps3 = vec3f(q, zs);
      let ts = -dot(ps3, n) / den;
      if (ts > 0.0) {
        let hp = ps3 + L * ts;
        let hs = length(hp);
        let uS = (hs - innerR) / max(outerR - innerR, 0.05);
        // Only the arcs grown so far cast shadows.
        var sMask = 1.0;
        if (mFull < 0.999) {
          let sx = (atan2(dot(hp, e2), hp.x) - rOrb * 0.175) / 6.2832 * 34.0;
          sMask = mix(plArcFill(sx, uS, 34.0, grow, vec2f(0.02, 0.05)).x, 1.0, mFull);
        }
        let tauS = plRingProfile(uS, 0.01 + 0.1 * (1.0 - mDetail)).x * sMask;
        ringShadow = 1.0 - exp(-tauS / max(abs(den), 0.05));
      }
    }
    ringShadow = clamp(ringShadow, 0.0, 0.9);

    // Lighting: wrapped pearl glow -> terminator + limb darkening.
    let ndl = dot(N, L);
    let mu = max(N.z, 0.0001);
    let ld = 0.38 + 0.62 * pow(mu, 0.55);
    let diffG = (max(ndl, 0.0) * 0.9 + smoothstep(-0.18, 0.12, ndl) * 0.1) * ld;
    let diffP = (0.38 + 0.62 * (ndl * 0.5 + 0.5)) * mix(1.0, ld, 0.35);
    let diff = mix(diffP, diffG, mColor) * (1.0 - ringShadow);
    let hv = normalize(L + vec3f(0.0, 0.0, 1.0));
    let nh = max(dot(N, hv), 0.0001);
    let spec = (pow(nh, 70.0) * 0.9 + pow(nh, 9.0) * 0.12) * (1.0 - mColor * 0.92) * (1.0 - ringShadow);
    let om = 1.0 - min(mu, 1.0);
    let fres = om * om * om;
    let rimP = vec3f(1.0, 0.92, 0.78) * fres * 0.55;
    let rimG = vec3f(0.95, 0.80, 0.58) * fres * 0.6 * smoothstep(-0.35, 0.45, ndl);
    let caus = plCaustic(N.xy * 4.5 + P.xy * 1.5, t) * (0.35 + 0.65 * max(ndl, 0.0)) * (1.0 - mColor);
    planetCol = albedo * diff * 0.82 + mix(rimP, rimG, mColor) + vec3f(1.0, 0.97, 0.92) * spec + vec3f(1.0, 0.95, 0.85) * caus * 0.14;
  }

  // Outer glow: creamy pearl halo -> thin lit atmosphere.
  let dirLit = dot(normalize(q + vec2f(0.0001, 0.0)), normalize(L.xy)) * 0.5 + 0.5;
  let haloK = exp(-max(rr - 1.0, 0.0) * mix(11.0, 26.0, th));
  let haloCol = mix(vec3f(1.0, 0.93, 0.8) * 0.3, vec3f(0.95, 0.78, 0.5) * 0.22 * (0.25 + 0.75 * dirLit), th);
  let halo = haloCol * haloK * (1.0 - cov) * (1.0 - 0.5 * fd);

  // Saturn's rings.
  var back = vec4f(0.0);
  var front = vec4f(0.0);
  if (gIn > 0.0005) {
    let span = max(outerR - innerR, 0.05);
    let u = (rH - innerR) / span;
    let nz2 = max(n.z * n.z, 0.0012);
    let gR = length(vec2f(q.x, q.y / nz2)) / max(rH, 0.001);
    let fpU = pxq * gR / span * (1.0 + fd);
    // Arc coverage (x) and fresh glow behind the growing tips (y); full ring once connected.
    var arc = vec2f(1.0, 0.0);
    if (mFull < 0.999) {
      let ax = (angP - rOrb * 0.175) / 6.2832 * 34.0;
      let fpA = pxq / (max(rH, 0.3) * max(abs(n.z), 0.12)) * 34.0 / 6.2832;
      arc = plArcFill(ax, u, 34.0, grow, vec2f(fpU, fpA));
      arc = vec2f(mix(arc.x, 1.0, mFull), arc.y * (1.0 - mDetail));
    }
    // Ringlets and narrow gaps come into focus after the arcs connect.
    let prof = plRingProfile(u, fpU + 0.1 * (1.0 - mDetail));
    let kep = pow(max(rH, 0.6) / 1.6, -1.5);

    // Clumps and azimuthal density waves on Keplerian orbits (inner faster).
    // Two crossfaded generations keep the shear bounded.
    let fC1 = 1.0 - smoothstep(0.3, 1.0, fpU * span * 55.0);
    let fC2 = 1.0 - smoothstep(0.3, 1.0, fpU * span * 160.0);
    let fW = 1.0 - smoothstep(1.0, 3.0, fpU * 160.0);
    var clump = 0.0;
    var dwave = 0.0;
    for (var g = 0; g < 2; g++) {
      let o = rOrb + f32(g) * 3.0;
      let slot = floor(o / 6.0);
      let age = o - slot * 6.0;
      let sw = sin(3.14159265 * age / 6.0);
      let wt = sw * sw;
      let a = angP - kep * age - plHash(vec2f(slot, f32(g) + 1.0)) * 6.2832;
      let n1 = plNoise3(vec3f(cos(a) * 22.0, sin(a) * 22.0, rH * 55.0));
      let n2 = plNoise3(vec3f(cos(a) * 60.0, sin(a) * 60.0, rH * 160.0 + 7.0));
      clump += wt * ((n1 - 0.5) * fC1 + (n2 - 0.5) * 0.6 * fC2);
      dwave += wt * (sin(2.0 * a + u * 160.0) * 0.6 + sin(5.0 * a + u * 95.0 + 1.0) * 0.4);
    }

    // Spokes in the B ring: short-lived radial wedges, sheared as they orbit.
    var spoke = 0.0;
    for (var g = 0; g < 2; g++) {
      let o = rOrb + f32(g) * 0.6;
      let slot = floor(o / 1.2);
      let age = o - slot * 1.2;
      let sw = sin(3.14159265 * age / 1.2);
      let a = angP - kep * age - plHash(vec2f(slot * 1.7, f32(g) + 9.0)) * 6.2832;
      let sk = plNoise3(vec3f(cos(a) * 7.0, sin(a) * 7.0, rH * 0.7 + slot * 3.1 + f32(g) * 11.0));
      spoke += sw * sw * smoothstep(0.68, 0.86, sk);
    }
    spoke *= plBox(u, 0.33, 0.62, 0.04) * mDetail;

    // Fine particle grain, carried by the Keplerian flow.
    let aG = angP - kep * rOrb;
    let gF = 0.55 / max(pxq, 0.0005);
    let grain = plNoise(vec2f(cos(aG), sin(aG)) * rH * gF) - 0.5;

    // Braided, knotted F ring.
    let rF = innerR + 0.975 * span;
    let aF = angP - rOrb * pow(rF / 1.6, -1.5);
    let s1 = 0.975 + 0.004 * sin(aF * 5.0 + 0.6 * sin(aF * 17.0));
    let s2 = 0.975 + 0.004 * sin(aF * 5.0 + 3.14159 + 0.6 * sin(aF * 13.0 + 1.0));
    let knots = 0.55 + 0.9 * smoothstep(0.55, 0.85, plNoise3(vec3f(cos(aF) * 14.0, sin(aF) * 14.0, 2.0)));
    let fTau = (plLine(u - 0.975, 0.0015, fpU) * 0.35 + (plLine(u - s1, 0.0009, fpU) + plLine(u - s2, 0.0009, fpU)) * 0.3) * knots * mDetail;

    let fA = plBox(u, 0.716, 0.932, 0.01);
    let tauR = prof.x * max(1.0 + 0.45 * clump + 0.12 * dwave * fW * fA, 0.1);
    let tau = tauR + fTau;
    let dust = (prof.y * tauR + 0.9 * fTau) / max(tau, 0.0001);

    // Single scattering: reflection on the lit face, diffuse transmission on the unlit face.
    // Dusty, translucent regions use a forward-scattering phase function.
    let mu = max(abs(n.z), 0.035);
    let nl = dot(n, L);
    let mu0 = max(abs(nl), 0.03);
    let litSide = nl * n.z > 0.0;
    let tV = tau / mu;
    let tL = tau / mu0;
    let cph = L.z;
    let pBig = 1.0 + 0.45 * cph;
    let gHG = 0.65;
    let hgD = 1.0 + gHG * gHG + 2.0 * gHG * cph;
    let pDust = (1.0 - gHG * gHG) / pow(hgD, 1.5) * 1.6;
    let phaseF = mix(pBig, pDust, dust);
    var I = 0.0;
    if (litSide) {
      I = mu0 / (mu0 + mu) * (1.0 - exp(-tV - tL));
    } else {
      let dm = mu - mu0;
      let isNear = abs(dm) < 0.02;
      let dmS = select(dm, 0.02, isNear);
      I = select(mu0 / dmS * (exp(-tV) - exp(-tL)), tV * exp(-tV), isNear);
    }
    let ringAlpha = clamp(1.0 - exp(-tV), 0.0, 0.97) * arc.x;

    // Planet shadow on the rings.
    let bl = dot(H, L);
    let dperp = sqrt(max(dot(H, H) - bl * bl, 0.0));
    let pShadow = (1.0 - smoothstep(0.96, 1.06, dperp)) * (1.0 - smoothstep(-0.15, 0.0, bl));
    let spokeK = select(0.7, -0.4, litSide);
    let bri = I * phaseF * 2.1 * (1.0 + spokeK * spoke) * (1.0 + 0.3 * grain) * (1.0 - pShadow * 0.95) * (1.0 + 1.6 * arc.y);

    // Audio sparkle on Keplerian orbits.
    let angR = angP - rOrb * kep;
    let cellUV = vec2f(angR / 6.2832 * 1100.0, rH * 70.0);
    let cell = floor(cellUV);
    let fc = fract(cellUV) - vec2f(0.5);
    let h1 = plHash(cell);
    let h2 = plHash(cell + vec2f(17.3, 4.1));
    let spOn = smoothstep(0.955 - highs * 0.06, 1.0, h1);
    let tw = 0.5 + 0.5 * sin(t * (2.0 + h2 * 9.0) + h2 * 40.0);
    let spDot = 1.0 - smoothstep(0.05, 0.5, length(fc));
    let spark = spOn * tw * spDot * (0.4 + highs * 3.0) * min(tau * 2.0, 1.0) * (1.0 - pShadow);
    let ringCol = plRingColor(u) * bri * (1.0 + bass * 0.45) + vec3f(1.0, 0.95, 0.85) * spark + vec3f(1.0, 0.92, 0.78) * arc.y * 0.35 * (1.0 - pShadow * 0.8);
    let ringPm = vec4f(ringCol * arc.x, ringAlpha);
    let ringFront = zr > zHit;
    back = select(ringPm, vec4f(0.0), ringFront);
    front = select(vec4f(0.0), ringPm, ringFront);
  }

  // Bubble ring: round bubbles settle onto seed radii and become the glowing tips of the growing arcs.
  let bubbleR = (innerR + outerR) * 0.5;
  let bSpan = max(outerR - innerR, 0.05);
  let flatY = mix(1.0, max(abs(n.z), 0.12), mFlat);
  let anim = vec4f(flatY, rOrb * 0.175, t, px);
  let bigA = 1.0 - smoothstep(0.85, 1.0, th);
  if (bigA > 0.001) {
    let cfg = vec4f(34.0, bubbleR, bSpan * 0.45, 0.075);
    let growB = vec4f(gIn, gOut, seedIn, seedOut);
    let geo = vec4f(innerR, bSpan, 0.0, 0.0);
    front = front + plBubbles(q, n, angB, zHit, 1.0, cfg, anim, growB, geo) * bigA * (1.0 - front.a);
    back = back + plBubbles(q, n, angB, zHit, -1.0, cfg, anim, growB, geo) * bigA * (1.0 - back.a);
  }

  // Composite back to front: far rings/bubbles, pearl/planet, near rings/bubbles.
  var obj = back;
  obj = vec4f(planetCol * cov, cov) + obj * (1.0 - cov);
  obj = front + obj * (1.0 - front.a);

  var rgb = plHue(obj.rgb, hueA) * bright;
  let glowAdd = plHue(halo, hueA) * bright;
  // Distance: lower saturation and contrast, haze toward the nebula.
  if (fd > 0.001) {
    let haze = mix(vec3f(0.12, 0.08, 0.2) * bright, min(base.rgb, vec3f(0.3)), 0.4);
    let un = rgb / max(obj.a, 0.001);
    rgb = plFar(un, haze, fd) * obj.a;
  }
  // Behind the jellies: bright input shows through the planet.
  let lumIn = dot(base.rgb, vec3f(0.2126, 0.7152, 0.0722));
  let see = 1.0 - 0.6 * smoothstep(0.15, 0.5, lumIn) * fd;
  let col = base.rgb * (1.0 - obj.a * see) + (rgb + glowAdd) * see;
  return vec4f(col, 1.0);
}

fn plHash(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.x, p.y, p.x) * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn plHash3(p: vec3f) -> f32 {
  var p3 = fract(p * 0.1031);
  p3 = p3 + dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

fn plNoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = plHash(i);
  let b = plHash(i + vec2f(1.0, 0.0));
  let c = plHash(i + vec2f(0.0, 1.0));
  let d = plHash(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn plNoise3(p: vec3f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = plHash3(i);
  let b = plHash3(i + vec3f(1.0, 0.0, 0.0));
  let c = plHash3(i + vec3f(0.0, 1.0, 0.0));
  let d = plHash3(i + vec3f(1.0, 1.0, 0.0));
  let e = plHash3(i + vec3f(0.0, 0.0, 1.0));
  let g = plHash3(i + vec3f(1.0, 0.0, 1.0));
  let h = plHash3(i + vec3f(0.0, 1.0, 1.0));
  let k = plHash3(i + vec3f(1.0, 1.0, 1.0));
  let lo = mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  let hi = mix(mix(e, g, u.x), mix(h, k, u.x), u.y);
  return mix(lo, hi, u.z);
}

fn plFbm3(p0: vec3f) -> f32 {
  var p = p0;
  var amp = 0.5;
  var sum = 0.0;
  for (var i = 0; i < 4; i++) {
    sum += amp * plNoise3(p);
    p = p * 2.02 + vec3f(17.1, 4.3, 9.7);
    amp *= 0.5;
  }
  return sum;
}

// Smooth box: 1 between a and b, edge softness s.
fn plBox(x: f32, a: f32, b: f32, s: f32) -> f32 {
  return smoothstep(a - s, a + s, x) * (1.0 - smoothstep(b - s, b + s, x));
}

// Thin line of width w at x = 0; fades instead of aliasing when narrower than the footprint fp.
fn plLine(x: f32, w: f32, fp: f32) -> f32 {
  let ww = max(w, fp);
  return (1.0 - smoothstep(0.0, ww, abs(x))) * sqrt(w / ww);
}

// Ring optical depth (x) and dusty fraction (y) across u = 0 (inner edge) .. 1 (outer edge).
// C ring, B ring, Cassini Division, A ring with Encke and Keeler gaps, Roche division.
fn plRingProfile(u: f32, fp: f32) -> vec2f {
  if (u <= -0.02 || u >= 1.02) {
    return vec2f(0.0);
  }
  let s = max(fp, 0.0015);
  var c = plBox(u, 0.02, 0.27, s) * (0.06 + 0.05 * smoothstep(0.02, 0.27, u));
  c += (plBox(u, 0.115, 0.125, s) + plBox(u, 0.163, 0.171, s) + plBox(u, 0.205, 0.214, s) + plBox(u, 0.232, 0.24, s)) * 0.28;
  c *= 1.0 - 0.9 * plBox(u, 0.188, 0.193, s);
  var b = plBox(u, 0.27, 0.645, s);
  b *= mix(0.9, 2.2, smoothstep(0.27, 0.36, u)) + 1.3 * plBox(u, 0.43, 0.58, 0.02) - 0.5 * smoothstep(0.58, 0.645, u);
  var cd = plBox(u, 0.645, 0.716, s) * 0.06;
  cd *= 1.0 - plBox(u, 0.645, 0.652, s);
  cd += plBox(u, 0.6535, 0.6575, s) * 0.5 + plBox(u, 0.676, 0.682, s) * 0.12 + plBox(u, 0.695, 0.699, s) * 0.12;
  cd += smoothstep(0.70, 0.716, u) * plBox(u, 0.70, 0.716, s) * 0.25;
  var a = plBox(u, 0.716, 0.932, s) * mix(0.62, 0.45, smoothstep(0.75, 0.93, u));
  a *= 1.0 - plBox(u, 0.884, 0.890, s) * 0.97;
  a += plBox(u, 0.8865, 0.8875, s) * 0.05;
  a *= 1.0 - plBox(u, 0.9265, 0.9285, s) * 0.95;
  let rd = plBox(u, 0.932, 0.968, s) * 0.012;
  var d = c + b + cd + a + rd;
  // Ringlets and irregular structure, filtered by the pixel footprint.
  let r1 = sin(u * 310.0 + 1.3) * (1.0 - smoothstep(0.3, 1.5, fp * 310.0));
  let r2 = sin(u * 820.0 + 0.4 * sin(u * 97.0)) * (1.0 - smoothstep(0.3, 1.5, fp * 820.0));
  let r3 = (plNoise(vec2f(u * 260.0, 3.7)) - 0.5) * (1.0 - smoothstep(0.2, 1.0, fp * 260.0));
  let r4 = (plNoise(vec2f(u * 1400.0, 9.1)) - 0.5) * (1.0 - smoothstep(0.2, 1.0, fp * 1400.0));
  d = d * max(1.0 + 0.18 * r1 + 0.1 * r2 + 0.6 * r3 + 0.5 * r4, 0.2);
  let dust = clamp(0.06 + 0.8 * exp(-d * 3.0), 0.0, 0.9);
  return vec2f(max(d, 0.0), dust);
}

fn plRingColor(u: f32) -> vec3f {
  var c = vec3f(0.50, 0.47, 0.45);
  c = mix(c, vec3f(0.86, 0.76, 0.60), smoothstep(0.25, 0.3, u));
  c = mix(c, vec3f(0.95, 0.86, 0.70), plBox(u, 0.40, 0.60, 0.04) * 0.7);
  c = mix(c, vec3f(0.55, 0.56, 0.58), smoothstep(0.64, 0.65, u));
  c = mix(c, vec3f(0.80, 0.74, 0.65), smoothstep(0.71, 0.72, u));
  c = mix(c, vec3f(0.88, 0.87, 0.84), smoothstep(0.94, 0.96, u));
  return c;
}

fn plSdHex(p0: vec2f, r: f32) -> f32 {
  let k = vec3f(-0.866025404, 0.5, 0.577350269);
  var p = abs(p0);
  p = p - 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p = p - vec2f(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

// Saturn albedo from latitude/longitude on the sphere (pole n). sp = spin phase.
fn plSaturn(N: vec3f, n: vec3f, e2: vec3f, sp: f32) -> vec3f {
  let sl = clamp(dot(N, n), -1.0, 1.0);
  let lat = asin(sl);
  let cl = sqrt(max(1.0 - sl * sl, 0.0));
  let lon = atan2(dot(N, e2), N.x);
  // Zonal winds: strong equatorial jet, alternating jets toward the poles.
  let wind = 0.55 * exp(-lat * lat * 10.0) + 0.14 * cos(lat * 13.0) + 0.06 * sin(lat * 29.0);
  // Domain-warped turbulence advected by the winds; two crossfaded generations bound the shear.
  var tb = 0.0;
  var wv = vec2f(0.0);
  var ed = 0.0;
  for (var g = 0; g < 2; g++) {
    let o = sp + f32(g) * 2.5;
    let slot = floor(o / 5.0);
    let age = o - slot * 5.0;
    let sw = sin(3.14159265 * age / 5.0);
    let wt = sw * sw;
    let seed = plHash(vec2f(slot, f32(g) * 5.0 + 1.0)) * 40.0;
    let lw = lon - sp - age * wind;
    let cp = vec3f(cos(lw) * cl * 2.6 + seed, sin(lw) * cl * 2.6, lat * 11.0 + age * 0.12);
    let w1 = vec2f(plFbm3(cp + vec3f(1.7, 9.2, 3.1)), plFbm3(cp + vec3f(8.3, 2.8, 5.5))) - vec2f(0.5);
    let cp2 = cp + vec3f(w1.x, w1.y, w1.y * 0.5) * 2.2;
    tb += wt * plFbm3(cp2);
    ed += wt * plFbm3(cp2 * 2.7 + vec3f(4.0, 1.0, 0.0) + vec3f(w1, 0.0) * 2.0);
    wv += wt * w1;
  }
  // Bands with festoons and eddies along their edges.
  let yW = lat + (tb - 0.5) * 0.06 + wv.y * 0.04;
  let edgeM = 1.0 - abs(sin(yW * 15.0 + 0.4));
  let yF = yW + edgeM * (ed - 0.5) * 0.07;
  let b1 = 0.5 + 0.5 * sin(yF * 15.0 + 0.4);
  let b2 = 0.5 + 0.5 * sin(yF * 41.0 + tb * 3.0);
  let b3 = 0.5 + 0.5 * sin(yF * 6.0 + 1.1);
  let zone = vec3f(0.93, 0.85, 0.66);
  let belt = vec3f(0.78, 0.63, 0.42);
  let dbelt = vec3f(0.60, 0.46, 0.31);
  var c = mix(belt, zone, smoothstep(0.25, 0.75, b1));
  c = mix(c, dbelt, smoothstep(0.65, 0.95, b3) * 0.35);
  c *= 0.92 + 0.08 * b2;
  c = mix(c, vec3f(0.97, 0.91, 0.76), (1.0 - smoothstep(0.0, 0.15, abs(yW))) * 0.5);
  let eddy = smoothstep(0.6, 0.78, ed) * edgeM;
  c = mix(c, vec3f(0.97, 0.94, 0.86), eddy * 0.45);
  c = mix(c, dbelt * 0.9, smoothstep(0.66, 0.85, tb) * (1.0 - edgeM) * 0.3);
  c = mix(c, vec3f(0.62, 0.65, 0.66), smoothstep(0.8, 1.15, abs(lat)) * 0.55);

  // North pole: hexagonal jet near 78 degrees latitude and a spiral polar vortex.
  if (sl > 0.8) {
    let rho = acos(sl);
    let lh = lon - sp;
    let v = vec2f(cos(lh), sin(lh)) * rho + wv * 0.012;
    let dH = plSdHex(v, 0.19);
    let hexBand = 1.0 - smoothstep(0.012, 0.03, abs(dH));
    let inHex = 1.0 - smoothstep(-0.01, 0.01, dH);
    let streak = 0.5 + 0.5 * sin(dH * 240.0 + tb * 5.0);
    // Swirls inside the hexagon: faster rotation and logarithmic winding toward the pole.
    let rotA = sp * (0.5 + 2.5 * exp(-rho / 0.06)) + 2.2 * log(max(rho, 0.004) / 0.2);
    let cr = cos(rotA);
    let sr = sin(rotA);
    let vr = vec2f(cr * v.x + sr * v.y, -sr * v.x + cr * v.y);
    let swl = plFbm3(vec3f(vr * 30.0, 1.7 + sp * 0.05));
    var pc = mix(c, vec3f(0.56, 0.63, 0.68) * (0.8 + 0.4 * swl), inHex);
    pc = mix(pc, vec3f(0.34, 0.41, 0.50) * (0.85 + 0.25 * streak), hexBand * 0.92);
    let outRib = smoothstep(0.03, 0.04, dH) * (1.0 - smoothstep(0.045, 0.07, dH));
    pc = mix(pc, vec3f(0.84, 0.82, 0.76), outRib * 0.35);
    let pv = rho / 0.06;
    let aV = lh - sp * 3.0 * exp(-pv * 0.7);
    let arms = 0.5 + 0.5 * sin(2.0 * aV + 5.0 * log(max(pv, 0.02)) + swl * 2.5);
    pc = mix(pc, vec3f(0.80, 0.82, 0.82), arms * (1.0 - smoothstep(1.0, 2.6, pv)) * 0.5);
    pc = mix(pc, vec3f(0.85, 0.86, 0.84), smoothstep(0.3, 0.5, pv) * (1.0 - smoothstep(0.55, 0.9, pv)) * 0.4);
    pc = mix(pc, vec3f(0.24, 0.28, 0.34), (1.0 - smoothstep(0.12, 0.45, pv)) * 0.85);
    c = mix(c, pc, smoothstep(0.8, 0.9, sl));
  }
  return c;
}

// Distant look: desaturate, compress contrast, blend toward the haze colour.
fn plFar(c: vec3f, haze: vec3f, k: f32) -> vec3f {
  let l = dot(c, vec3f(0.2126, 0.7152, 0.0722));
  var o = mix(vec3f(l), c, 1.0 - 0.45 * k);
  let piv = vec3f(0.12);
  o = max(piv + (o - piv) * (1.0 - 0.3 * k), vec3f(0.0));
  return mix(o, haze, 0.28 * k);
}

// Premultiplied bubbles on the ring ellipse. side > 0: bubbles nearer than the sphere at this pixel.
// cfg = (count, orbit radius, radial spread, bubble radius). anim = (y squash, orbit phase, time, pixel).
// grow = (inner arc growth, outer arc growth, inner seeding, outer seeding). geo = (inner ring radius, ring span, -, -).
// Even slots seed the inner (C/B) rings, odd slots the A ring. While its arc grows, a bubble settles onto
// its seed radius, travels ahead as the arc's tip to the next seed of its set, shrinks, glows and fades.
fn plBubbles(q: vec2f, n: vec3f, angP: f32, zHit: f32, side: f32, cfg: vec4f, anim: vec4f, grow: vec4f, geo: vec4f) -> vec4f {
  let K = cfg.x;
  let e2 = vec3f(0.0, n.z, -n.y);
  let a0 = (angP - anim.y) / 6.2832 * K;
  let ci = floor(a0);
  // Travelling tips can be several slots ahead of their seed.
  let kLo = select(-3, -7, max(grow.x, grow.y) > 0.0);
  var acc = vec4f(0.0);
  for (var k = kLo; k <= 3; k++) {
    let idx = ci + f32(k);
    let id = idx - K * floor(idx / K);
    let h1 = plHash(vec2f(id, K));
    let h2 = plHash(vec2f(id + 7.1, K * 0.37));
    let h3 = plHash(vec2f(id * 1.37 + 3.3, K + 9.0));
    if (h3 < 0.18) {
      continue;
    }
    let isOuter = id - 2.0 * floor(id * 0.5) > 0.5;
    let g = select(grow.x, grow.y, isOuter);
    let sd = select(grow.z, grow.w, isOuter);
    let sp = idx + 0.5 + (h1 - 0.5) * 0.7;
    var tip = sp;
    if (g > 0.0) {
      var nx = idx + 10.5;
      for (var m = 1; m <= 4; m++) {
        let j = idx + 2.0 * f32(m);
        let jd = j - K * floor(j / K);
        if (plHash(vec2f(jd * 1.37 + 3.3, K + 9.0)) >= 0.18) {
          nx = j + 0.5 + (plHash(vec2f(jd, K)) - 0.5) * 0.7;
          break;
        }
      }
      tip = sp + g * (nx - sp);
    }
    let ang = tip / K * 6.2832 + anim.y;
    let radSeed = geo.x + select(0.42, 0.83, isOuter) * geo.y;
    let rad = mix(cfg.y + (h2 - 0.5) * cfg.z, radSeed, sd);
    let bob = ((h1 - 0.5) * 0.06 + 0.025 * sin(anim.z * (0.6 + h2) + h3 * 30.0)) * (1.0 - sd);
    let c = vec3f(cos(ang) * rad, 0.0, 0.0) + e2 * (sin(ang) * rad) + n * bob;
    let isFront = c.z > zHit;
    if (isFront != (side > 0.0)) {
      continue;
    }
    let br = cfg.w * (0.55 + 0.9 * h3) * mix(1.0, 0.4, smoothstep(0.3, 1.0, g));
    var d = (q - c.xy) / br;
    d.y = d.y / anim.x;
    let dist = length(d);
    let edgeW = anim.w / br + 0.02;
    let body = 1.0 - smoothstep(1.0 - edgeW, 1.0 + edgeW, dist);
    if (body <= 0.0) {
      continue;
    }
    let rim = smoothstep(0.45, 0.98, dist) * body;
    let hl = 1.0 - smoothstep(0.0, 0.3, length(d - vec2f(-0.38, 0.4)));
    let filmT = 0.5 + 0.5 * cos(6.2832 * (dist * 1.3 + h2 + anim.z * 0.05 + vec3f(0.0, 0.33, 0.67)));
    let col0 = mix(vec3f(0.7, 0.93, 1.0), filmT, 0.35) * (0.35 + 0.65 * rim) + vec3f(1.0) * hl * body;
    let al0 = clamp(body * 0.1 + rim * 0.5 + hl * body * 0.75, 0.0, 1.0);
    // Growing: the bubble turns into a warm glowing head, then fades as its arc joins the next one.
    let hot = smoothstep(0.0, 0.2, g);
    let col = mix(col0, vec3f(1.0, 0.9, 0.72) * (1.4 - 0.8 * dist), hot * 0.65);
    let al = max(al0, body * hot * 0.9) * (1.0 - smoothstep(0.7, 1.0, g));
    acc = acc + vec4f(col * al, al) * (1.0 - acc.a);
  }
  return acc;
}

// Ring arcs grown from the bubble seeds (same slots and hashes as plBubbles with K slots).
// x = angle in the bubbles' co-rotating frame, in slots. u = ring radius (0 inner edge .. 1 outer edge).
// grow = (inner growth, outer growth, inner widening, outer widening). fp = footprint (u, slots).
// Returns (coverage, fresh glow just behind the growing tips).
fn plArcFill(x: f32, u: f32, K: f32, grow: vec4f, fp: vec2f) -> vec2f {
  var cover = 0.0;
  var fresh = 0.0;
  for (var s = 0; s < 2; s++) {
    let isOuter = s == 1;
    let g = select(grow.x, grow.y, isOuter);
    if (g <= 0.0005) {
      continue;
    }
    let w = select(grow.z, grow.w, isOuter);
    let sf = f32(s);
    // Seeds of this set sit in slots 2m + s: find the last one behind x and the next one ahead.
    let m0 = floor((x - sf) * 0.5);
    var prev = -1.0e9;
    var next = 1.0e9;
    for (var j = -4; j <= 3; j++) {
      let idx = 2.0 * (m0 + f32(j)) + sf;
      let id = idx - K * floor(idx / K);
      if (plHash(vec2f(id * 1.37 + 3.3, K + 9.0)) < 0.18) {
        continue;
      }
      let sp = idx + 0.5 + (plHash(vec2f(id, K)) - 0.5) * 0.7;
      if (sp <= x) {
        prev = sp;
      } else if (next > 1.0e8) {
        next = sp;
      }
    }
    if (prev < -1.0e8 || next > 1.0e8) {
      continue;
    }
    // Angular: the arc runs from its seed to the travelling tip; at g = 1 it meets the next seed.
    let gap = next - prev;
    let frac = (x - prev) / gap;
    let e = clamp(fp.y / gap, 0.004, 0.2);
    let gh = g * (1.0 + 2.0 * e);
    var am = 1.0 - smoothstep(gh - e, gh + e, frac);
    am *= mix(smoothstep(0.0, 2.0 * e, frac), 1.0, smoothstep(0.6, 0.95, g));
    am *= smoothstep(0.0, 0.03, g);
    // Radial: a thin line on the seed radius (tapered at the tip) widens to the whole ring group.
    let dh = (prev + g * gap) - x;
    let taper = smoothstep(0.0, 1.2, dh);
    let uc = select(0.42, 0.83, isOuter);
    let lo = select(-0.05, 0.64, isOuter);
    let hi = select(0.70, 1.05, isOuter);
    let cU = mix(uc, 0.5 * (lo + hi), w);
    let hw = mix(0.02 + 0.03 * taper, 0.5 * (hi - lo), w);
    let soft = clamp(fp.x, 0.006, 0.03);
    let rm = 1.0 - smoothstep(hw - soft, hw + soft, abs(u - cU));
    let cv = am * rm;
    cover = max(cover, cv);
    let hot = smoothstep(0.0, 0.08, g) * (1.0 - smoothstep(0.8, 1.0, g));
    fresh = max(fresh, exp(-max(dh, 0.0) * 1.4) * cv * hot);
  }
  return vec2f(cover, fresh);
}

fn plCaustic(p: vec2f, t: f32) -> f32 {
  let n1 = plNoise(p + vec2f(t * 0.31, t * 0.17));
  let n2 = plNoise(p * 1.37 + vec2f(5.2 - t * 0.23, 1.7 + t * 0.29));
  let c = clamp(1.0 - abs(n1 - n2) * 5.0, 0.0, 1.0);
  return c * c * c * c;
}

fn plHue(c: vec3f, a: f32) -> vec3f {
  let k = vec3f(0.57735);
  let ca = cos(a);
  let r = c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
  return max(r, vec3f(0.0));
}
`;

const DEG = Math.PI / 180;

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'jellyfish/planet',
    label: 'Ringed Planet',
    description:
      'Adds a glowing pearl with an orbiting bubble ring in the aquarium, or a distant ringed Saturn with a polar hexagon in space; the pearl swirl stretches into bands and the bubbles grow ring arcs that join into the rings as the theme morphs.',
    tags: ['jellyfish', 'cosmic', 'planet'],
    inputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image to place the planet over.',
      },
    },
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image with the planet or pearl added.',
      },
    },
    controls: {
      posX: { type: 'number', group: 'Placement', label: 'Position X', default: 0.18, min: -0.5, max: 1.5, step: 0.001 },
      posY: { type: 'number', group: 'Placement', label: 'Position Y', default: 0.78, min: -0.5, max: 1.5, step: 0.001 },
      size: { type: 'number', group: 'Placement', label: 'Size', default: 0.07, min: 0.01, max: 1, step: 0.001 },
      tilt: { type: 'number', group: 'Placement', label: 'Axis tilt (deg)', default: -16, min: -180, max: 180, step: 0.5 },
      ringSize: { type: 'number', group: 'Rings', label: 'Ring size', default: 2.3, min: 1.3, max: 5, step: 0.01 },
      ringTilt: { type: 'number', group: 'Rings', label: 'Ring opening (deg)', default: 20, min: -85, max: 85, step: 0.5 },
      rotationSpeed: { type: 'number', group: 'Motion', label: 'Rotation speed', default: 1, min: -10, max: 10, step: 0.01 },
      brightness: { type: 'number', group: 'Look', label: 'Brightness', default: 1, min: 0, max: 4, step: 0.01 },
      hue: { type: 'number', group: 'Look', label: 'Hue shift', default: 0, min: 0, max: 1, step: 0.005 },
      audio: { type: 'number', group: 'Audio', label: 'Audio response', default: 1, min: 0, max: 5, step: 0.01 },
    },
    controlDescriptions: {
      posX: 'Horizontal centre of the planet as a fraction of the screen width. 0 is the left edge and 1 is the right edge. The pearl uses the same position.',
      posY: 'Vertical centre of the planet as a fraction of the screen height. 0 is the bottom and 1 is the top. The pearl uses the same position.',
      size: 'Planet and pearl radius as a fraction of the screen height. The rings and the bubble ring scale with it.',
      tilt: 'Roll of the planet axis and ring system on screen, in degrees.',
      ringSize: 'Outer edge of the rings and the bubble ring, in planet radii.',
      ringTilt: 'How open the ring ellipse appears, in degrees. Space adds 15 degrees so the north pole and its hexagon face the viewer. Negative values view from below.',
      rotationSpeed: 'Speed of the cloud bands, polar vortex, ring and bubble orbits, and pearl swirl. Negative values reverse them.',
      brightness: 'Overall brightness of the pearl, bubbles, planet and rings. Space is dimmed to about 0.55 of this so the planet sits in the background.',
      hue: 'Hue rotation applied to the pearl, bubbles, planet and rings. 0 keeps the natural colours.',
      audio: 'Strength of the audio response: bass brightens the rings and highs make the ring particles sparkle.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    const view = uniform(new Vector4(0, aspect, 0, 0));
    const place = uniform(new Vector4(0.18, 0.78, 0.07, -16 * DEG));
    const ring = uniform(new Vector4(2.3, 20 * DEG, 0, 0));
    const look = uniform(new Vector4(1, 0, 1 / Math.max(1, context.settings.height), 0));
    const motion = uniform(new Vector4(0, 0, 0, 0));
    const baseTex = texture(new Texture(), vec2(uv().x as any, uv().y.oneMinus() as any) as any);
    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    material.fragmentNode = (wgslFn(planetPass) as any)(uv(), baseTex, view, place, ring, look, motion);
    const scene = new Scene();
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    let th = jellyShared.theme ?? 0;
    let bass = 0;
    let highs = 0;
    let peak = 0.02;
    let spin = 0;
    let ringOrbit = 0;
    let satSpin = 0;
    let lastT = -1;

    return {
      update(frame) {
        th += ((jellyShared.theme ?? 0) - th) * 0.08;
        const t = frame.timeSeconds;
        const dt = lastT < 0 || t < lastT ? 0 : Math.min(t - lastT, 0.25);
        lastT = t;
        const c = frame.controls;

        spin += dt * c.rotationSpeed * 0.035;
        ringOrbit += dt * c.rotationSpeed * 0.2;
        satSpin += dt * c.rotationSpeed * 0.06;

        const spectrum = frame.audioSpectrum;
        let lo = 0;
        let hi = 0;
        if (spectrum?.available) {
          for (let i = 1; i < 12; i++) lo += spectrum.magnitudes[i] ?? 0;
          lo /= 11;
          for (let i = 80; i < 120; i++) hi += spectrum.magnitudes[i] ?? 0;
          hi /= 40;
        }
        // Bass: quick rise, slow fall.
        bass += (lo - bass) * (lo > bass ? 0.35 : 0.06);
        // Highs: auto-gained against a decaying peak.
        peak = Math.max(hi, peak * Math.exp(-dt * 0.3), 0.02);
        const level = Math.min(hi / peak, 1);
        highs += (level * level - highs) * 0.25;

        // Space: tilt the north pole toward the viewer and dim the planet into the background.
        const tiltBoost = (c.ringTilt >= 0 ? 1 : -1) * 15 * th;
        const ringTilt = Math.max(-85, Math.min(85, c.ringTilt + tiltBoost));

        view.value.set(t, aspect, th, spin);
        place.value.set(c.posX, c.posY, c.size, c.tilt * DEG);
        ring.value.set(
          c.ringSize,
          ringTilt * DEG,
          Math.min(bass * 3, 1) * c.audio,
          Math.min(highs * c.audio, 3),
        );
        look.value.set(c.brightness * (1 - 0.45 * th), c.hue * Math.PI * 2, 1 / Math.max(1, context.settings.height), 0);
        motion.value.set(ringOrbit, satSpin, 0, 0);
      },
      async evaluate(inputs, evaluation) {
        baseTex.value = inputs.image.texture as Texture;
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {
        th = jellyShared.theme ?? 0;
        bass = 0;
        highs = 0;
        peak = 0.02;
        spin = 0;
        ringOrbit = 0;
        satSpin = 0;
        lastT = -1;
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  },
});
