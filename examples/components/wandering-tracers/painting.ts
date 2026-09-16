import { defineComponent, type Paths2DResource } from '@lux/visual-sdk';
import {
  Scene,
  DataTexture,
  FloatType,
  RGBAFormat,
  NearestFilter,
  Mesh,
  PlaneGeometry,
  MeshBasicNodeMaterial,
  OrthographicCamera,
} from 'three/webgpu';
import { uniform, texture, uv, vec4, wgslFn } from 'three/tsl';

// A deliberately self-contained painting study. All pattern coordinates share
// the same slowly deforming sheet; region identities never reseed each frame.
const painting = wgslFn(`
fn livingPainting(st: vec2f, view: vec4f, form: vec4f, hatch: vec4f, pigment: vec4f, ink: vec4f, character: vec4f, music: vec4f, variety: vec4f, tracers: vec4f, trailData: texture_2d<f32>) -> vec4f {
  let t = view.x;
  let p = (st - 0.5) * vec2f(view.y, 1.0) * form.x;
  let seed = vec2f(view.z * 3.17, view.z * 7.31);
  // Compact regions: a gentle turning current and bounded local perturbations.
  // Avoid stacked directional shears, which stretched the earlier study.
  var q = p;
  let phrase = lpPhrase(p, t);
  let energy = music.x * (1.0 + music.y * (phrase - 0.5) * 0.85);
  let turn = form.y * 0.075 * sin(t * 0.055) * exp(-dot(p, p) * 0.035);
  q += vec2f(-p.y, p.x) * turn;
  let drift = vec2f(t * 0.009, -t * 0.007);
  q += form.y * 0.19 * (vec2f(lpNoise(p * 1.25 + seed + drift), lpNoise(p * 1.25 + seed + 48.9 - drift)) - 0.5);
  q += form.y * 0.065 * (0.65 + energy * 0.35)
    * (vec2f(lpNoise(p * 3.2 + seed + drift), lpNoise(p * 3.2 + seed + 17.8 - drift)) - 0.5);
  q += character.y * 0.022 * (vec2f(lpNoise(p * 7.0 + seed), lpNoise(p * 7.0 + seed + 13.8)) - 0.5);
  let cell = floor(q);
  var first = 1000.0;
  var owner = vec2f(0.0);
  var center = vec2f(0.0);
  // Nearby weighted seeds trade territory continuously. No frame-wise randomness.
  for (var y = -2; y <= 2; y++) {
    for (var x = -2; x <= 2; x++) {
      let id = cell + vec2f(f32(x), f32(y));
      let region = lpRegion(id, seed, t, form, music);
      let site = region.xy;
      let weight = region.z;
      let d = dot(q - site, q - site) - weight;
      if (d < first) {
        first = d;
        owner = id;
        center = site;
      }
    }
  }
  let r = lpHash2(owner + seed + 7.0);
  let local = q - center;
  // True minimum distance to the competing weighted bisectors. The original
  // first/second shortcut changed denominator abruptly, creating stray arcs.
  // Reuse the weighted cell's half planes for every tracer.
  var cellPlanes: array<vec3f, 25>;
  var planeCount = 0;
  let ownerWeight = lpRegion(owner, seed, t, form, music).z;
  var edge = 1000.0;
  for (var y = -2; y <= 2; y++) {
    for (var x = -2; x <= 2; x++) {
      let id = cell + vec2f(f32(x), f32(y));
      if (any(id != owner)) {
        let region = lpRegion(id, seed, t, form, music);
        let site = region.xy;
        let weight = region.z;
        let d = dot(q - site, q - site) - weight;
        let normal = 2.0 * (site - center);
        let plane = dot(site, site) - weight - dot(center, center) + ownerWeight;
        cellPlanes[planeCount] = vec3f(normal, plane);
        planeCount += 1;
        edge = min(edge, max(0.0, d - first) / max(2.0 * length(site - center), 0.01));
      }
    }
  }
  let pixelSize = max(length(dpdx(q)), length(dpdy(q)));
  let edgeAA = clamp(fwidth(edge), 0.0001, pixelSize * 1.4);

  // Broad translucent washes cross region boundaries; local tints add identity.
  // Pigment has its own gentle movement, so a changing boundary cannot drag
  // the wash into ribbons. The color phrase answers the shape phrase later.
  let colorPhrase = lpPhrase(p, t - 7.0);
  let cloud = lpFbm(p * 1.31 + seed * 0.1 + vec2f(t * 0.008, -t * 0.006));
  let broad = lpFbm(p * 0.46 + vec2f(3.7 + t * 0.006, 8.2 - t * 0.007));
  let wash = clamp(broad * 0.4 + cloud * 0.6 + pigment.x * 0.2, 0.0, 1.0);
  let palettePhase = 0.5 + 0.5 * sin(t * 0.065 + broad * 2.0);
  let deepPigment = mix(vec3f(0.075, 0.17, 0.31), vec3f(0.065, 0.25, 0.25), palettePhase);
  let lightPigment = mix(vec3f(0.29, 0.49, 0.68), vec3f(0.30, 0.61, 0.54), palettePhase);
  var color = mix(deepPigment, lightPigment, smoothstep(0.27, 0.66, wash));
  let green = smoothstep(0.50, 0.79, lpNoise(p * 0.62 + vec2f(8.0, 2.0) + t * 0.014));
  color = mix(color, vec3f(0.31, 0.49, 0.31), green * 0.83);
  let lightCenter = vec2f(sin(t * 0.043 - 0.65) * form.x * view.y * 0.32,
    cos(t * 0.057 + 0.6) * form.x * 0.26);
  let secondCenter = vec2f(cos(t * 0.037 + 0.6) * form.x * view.y * 0.34,
    sin(t * 0.051 - 0.6) * form.x * 0.29);
  let paleCenter = vec2f(sin(t * 0.029 + 0.1) * form.x * 0.30,
    cos(t * 0.041 + 1.4) * form.x * 0.23);
  let lightPool = exp(-dot(p - lightCenter, p - lightCenter) * (0.72 + colorPhrase * 0.30));
  let secondLight = exp(-dot(p - secondCenter, p - secondCenter) * 0.90);
  let palePool = exp(-dot(p - paleCenter, p - paleCenter) * 0.62);
  color = mix(color, vec3f(0.67, 0.74, 0.73), palePool * 0.68);
  let warmPigment = mix(vec3f(0.90, 0.79, 0.43), vec3f(0.82, 0.63, 0.49), 0.5 + 0.5 * sin(t * 0.033));
  color = mix(color, warmPigment, clamp((lightPool * 0.85 + secondLight * 0.62) * pigment.y
    * (1.0 + music.y * 0.13 * (colorPhrase - 0.5)), 0.0, 0.93));
  let regionTone = lpHash(owner + seed + 61.0);
  color *= 1.0 + (regionTone - 0.5) * pigment.z * 0.50;
  color = mix(color, vec3f(0.12, 0.145, 0.30), smoothstep(0.76, 0.98, regionTone) * min(0.82, pigment.z * 0.64));
  color += (cloud - 0.5) * 0.23;
  let wet = lpFbm(p * 3.8 + seed * 0.13);
  let bloomRim = exp(-abs(wet - 0.51) * 82.0);
  color += character.z * ((wet - 0.5) * 0.18 - bloomRim * 0.023);
  let pooling = exp(-edge * 23.0) * (0.35 + 0.65 * lpNoise(q * 3.0 + seed));
  color *= 1.0 - pooling * pigment.w * 0.18;

  let baseWash = color;
  var underpainting = color;
  let cream = mix(vec3f(0.89, 0.86, 0.70), vec3f(0.94, 0.79, 0.75), ink.z);
  let parentDrawing = lpRegionMarks(color, owner, center, local, edge, seed, t,
    form, hatch, ink, character, music, variety);
  color = parentDrawing;
  // Each cut contributes its own daughter style. Combining changes relative to
  // the parent preserves earlier divisions where different tracers intersect.
  var totalSplit = 0.0;
  var styleDelta = vec3f(0.0);
  var washDelta = vec3f(0.0);
  for (var traceIndex = 0; traceIndex < 4; traceIndex++) {
    if (textureLoad(trailData, vec2i(256 + traceIndex, 0), 0).x > 1.0) {
      let split = lpTracerSplit(p, q, center, owner, cellPlanes, planeCount,
        t, form.x, view.y, tracers, seed.x, f32(traceIndex), trailData);
      let childOwner = split.yz;
      let childTone = lpHash(childOwner + seed + 61.0);
      // Related but visibly distinct pigments on opposite sides of each cut.
      let family = lpHash(owner + seed + f32(traceIndex) * 31.7 + 407.0);
      let coolPigment = mix(vec3f(0.13, 0.28, 0.48), vec3f(0.16, 0.51, 0.43), family);
      let warmPigment = mix(vec3f(0.85, 0.64, 0.32), vec3f(0.67, 0.43, 0.48), family);
      let daughterPigment = mix(coolPigment, warmPigment, split.w);
      let washLight = dot(baseWash, vec3f(0.2126, 0.7152, 0.0722));
      let childWash = mix(baseWash * (0.84 + childTone * 0.30),
        daughterPigment * (0.70 + washLight * 0.65), 0.62);
      let daughterColor = lpRegionMarks(childWash, childOwner, center, local,
        edge, seed, t, form, hatch, ink, character, music, variety);
      totalSplit += split.x;
      styleDelta += (daughterColor - parentDrawing) * split.x;
      washDelta += (childWash - baseWash) * split.x;
    }
  }
  color += styleDelta / max(1.0, totalSplit);
  underpainting += washDelta / max(1.0, totalSplit);

  let edgePressure = 0.57 + 0.68 * lpNoise(q * 7.0 + seed)
    + character.y * 0.13 * sin(q.x * 37.0 + q.y * 21.0);
  let boundaryWidth = ink.x * 140.0 * pixelSize * edgePressure;
  let boundary = 1.0 - smoothstep(boundaryWidth - edgeAA * 0.55, boundaryWidth + edgeAA * 0.55, edge);
  color = mix(color, cream, boundary * (0.62 + 0.32 * lpNoise(q * 2.3 + seed)));
  // Stationary paper grain avoids animated video noise.
  let grain = lpHash(floor(st * vec2f(1920.0, 1080.0))) - 0.5;
  let fibers = lpNoise(p * 92.0) - 0.5;
  color += (grain * 0.026 + fibers * 0.037) * ink.w;
  color *= 0.96 + 0.04 * smoothstep(0.0, 0.25, min(min(st.x, 1.0 - st.x), min(st.y, 1.0 - st.y)));
  return vec4f(pow(clamp(color, vec3f(0.0), vec3f(1.0)), vec3f(2.2)), 1.0);
}


fn lpRegionMarks(baseColor: vec3f, owner: vec2f, center: vec2f, local: vec2f,
  edge: f32, seed: vec2f, t: f32, form: vec4f, hatch: vec4f, ink: vec4f,
  character: vec4f, music: vec4f, variety: vec4f) -> vec3f {
  var color = baseColor;
  let r = lpHash2(owner + seed + 7.0);
  // Each region has a durable line family. Angles, fans and wave amplitudes
  // vary across regions; adjacent strokes inside one family bend together.
  let linePhrase = lpPhrase(center, t - 3.5);
  let lineEnergy = music.x * (1.0 + music.y * (linePhrase - 0.5) * 0.85);
  // Persistent region styles: restrained parallel marks, broad sweeps, fans,
  // and occasional contours. Shared family traits relate spacing and weight;
  // independent small variations prevent adjacent regions feeling stamped.
  let style = lpHash(owner + seed + 211.0);
  let detail = lpHash2(owner + seed + 317.0);
  let quietStyle = 1.0 - step(0.25, style);
  let fanStyle = step(0.65, style) * (1.0 - step(0.90, style));
  let contourStyle = step(0.90, style);
  let intrinsicBend = mix(0.72 + detail.x * 0.55, 0.12 + detail.x * 0.22, quietStyle)
    + fanStyle * 0.43;
  let regionCurvature = hatch.z * mix(1.0, intrinsicBend, variety.y);
  let sharedAngle = (lpNoise(center * 0.34 + seed * 0.01) - 0.5) * 2.5;
  let counterpoint = step(0.77, lpHash(owner + seed + 203.0));
  let localDirection = (r.x - 0.5) * mix(4.9, 1.35, music.z)
    + counterpoint * (1.05 + lineEnergy * 0.32) + (detail.y - 0.5) * 0.65;
  let angle = sharedAngle + localDirection * variety.z + hatch.w
    + music.y * 0.09 * (linePhrase - 0.5);
  let axis = vec2f(cos(angle), sin(angle));
  let along = dot(local, vec2f(-axis.y, axis.x));
  let across = dot(local, axis);
  let bend = 0.18 * sin(along * (1.3 + r.y) + r.y * 8.0 + t * 0.10)
    + 0.16 * (lpNoise(vec2f(along * 2.1 + t * 0.016, r.x * 21.0)) - 0.5)
    + 0.02 * sin(along * 6.1 - t * 0.07 + r.x * 13.0);
  let fan = (r.y - 0.5) * (0.28 + fanStyle * 0.85) * along * along;
  var path = across + regionCurvature * (bend + fan) * (0.82 + lineEnergy * 0.18);
  if (contourStyle > 0.5) {
    path = length(local + vec2f(0.68, -0.60)) + regionCurvature * bend * 0.45;
  }
  // Three related spacing bands create dense phrases, ordinary passages, rests.
  let intrinsicSpacing = select(select(0.58, 1.0, detail.x > 0.30), 1.55, detail.x > 0.75)
    * (0.90 + r.y * 0.20);
  let spacingBand = mix(1.0, intrinsicSpacing, variety.x);
  let spacing = hatch.y * spacingBand
    * (1.0 - music.y * music.x * 0.14 * (linePhrase - 0.5));
  let phase = path / spacing;
  let lineId = floor(phase + 0.5);
  let lineJitter = (lpHash(vec2f(lineId, r.x * 79.0)) - 0.5) * 0.17
    + character.y * 0.065 * (lpNoise(vec2f(along * 10.0, lineId + r.y * 91.0)) - 0.5);
  let stripeDistance = abs(fract(phase + 0.5 + lineJitter) - 0.5);
  let stripeAA = max(fwidth(phase), 0.001);
  let pressure = 0.73 + 0.36 * lpNoise(vec2f(along * 5.0, lineId * 1.7 + r.y * 4.0))
    + character.y * 0.20 * sin(along * 18.0 + lineId * 1.9);
  let intrinsicWeight = clamp(sqrt(intrinsicSpacing) * (0.68 + detail.y * 0.66)
    * (1.0 + quietStyle * 0.12), 0.48, 1.65);
  let regionWeight = ink.y * mix(1.0, intrinsicWeight, variety.w);
  let halfWidth = min(0.28, regionWeight * 4.0 * pressure * stripeAA);
  let stripe = 1.0 - smoothstep(halfWidth - stripeAA * 0.5, halfWidth + stripeAA * 0.5, stripeDistance);
  // Dense at lower/right, breathing room upper/left, slowly shifting overall.
  let position = center / form.x;
  let activity = smoothstep(-0.28, 0.30, position.x * 0.67 - position.y * 0.9 + 0.035 + 0.055 * sin(t * 0.045));
  let quiet = exp(-dot(center - vec2f(-0.8, 0.65), center - vec2f(-0.8, 0.65)) * 0.40);
  let eligibility = lpHash(owner + seed + 103.0);
  let score = hatch.x + character.x * ((activity - 0.5) * 0.92 - quiet * 0.29)
    + music.y * 0.07 * (linePhrase - 0.5);
  var coverage = smoothstep(eligibility - 0.045, eligibility + 0.045, score);
  coverage *= smoothstep(0.0, 0.1, hatch.x);
  coverage = mix(coverage, 1.0, smoothstep(0.94, 1.0, hatch.x));
  let growth = 0.80 + music.y * 0.23 * linePhrase + 0.05 * r.y;
  let reveal = 1.0 - smoothstep(growth - 0.08, growth + 0.08, along * 0.31 + 0.40);
  let inset = smoothstep(0.003, 0.012, edge);
  // A few small empty islands give the drawing secondary scale and punctuation.
  let islandDistance = length((local - vec2f(0.08, -0.05)) * vec2f(0.9, 1.3)) - (0.045 + r.x * 0.055);
  let islandAA = max(fwidth(islandDistance), 0.001);
  let islandActive = step(0.89, r.y) * smoothstep(0.025, 0.065, edge);
  let island = (1.0 - smoothstep(-islandAA, islandAA, islandDistance)) * islandActive;
  // A sparse, stable second family runs perpendicular to the primary axis.
  // Keep it lighter and more open so crosshatched regions remain accents.
  let crossStyle = lpHash(owner + seed + 509.0);
  let crossEligible = step(0.81, crossStyle) * (1.0 - contourStyle);
  let crossBend = regionCurvature * 0.065
    * sin(across * (1.5 + detail.y) + r.x * 9.0 + t * 0.08);
  let crossPhase = (along + crossBend) / (spacing * (1.18 + detail.y * 0.40));
  let crossId = floor(crossPhase + 0.5);
  let crossJitter = (lpHash(vec2f(crossId, r.y * 91.0)) - 0.5) * 0.12;
  let crossDistance = abs(fract(crossPhase + crossJitter + 0.5) - 0.5);
  let crossAA = max(fwidth(crossPhase), 0.001);
  let crossWidth = min(0.24, regionWeight * 3.2 * pressure * crossAA);
  let crossStripe = 1.0 - smoothstep(crossWidth - crossAA * 0.5,
    crossWidth + crossAA * 0.5, crossDistance);
  let drawing = 1.0 - (1.0 - stripe) * (1.0 - crossStripe * crossEligible * 0.72);
  let hatchAlpha = drawing * coverage * reveal * inset * (1.0 - island) * 0.92;
  let cream = mix(vec3f(0.89, 0.86, 0.70), vec3f(0.94, 0.79, 0.75), ink.z);
  color = mix(color, cream, hatchAlpha);
  color = mix(color, color * 0.78, island * 0.38);
  let islandLine = (1.0 - smoothstep(ink.x, ink.x + islandAA, abs(islandDistance))) * islandActive;
  color = mix(color, cream, islandLine * 0.70);

  return color;
}


// Consume the exact geometry published by Tracer Paths. The region transition
// intentionally retains the uneven per-pixel wash behavior of the saved study.
fn lpTracerSplit(p: vec2f, q: vec2f, center: vec2f, owner: vec2f,
  planes: array<vec3f, 25>, planeCount: i32, time: f32, scale: f32,
  aspect: f32, settings: vec4f, seed: f32, index: f32,
  trailData: texture_2d<f32>) -> vec4f {
  let slot = i32(index);
  let metadata = textureLoad(trailData, vec2i(256 + slot, 0), 0);
  let count = i32(metadata.x);
  let offset = slot * 64;
  let sheetOffset = q - p;
  var crossingEntry = 1000.0;
  var crossingExit = -1000.0;
  var nearest = 1000.0;
  var signedSide = 0.0;
  for (var j = 0; j < 63; j++) {
    if (j + 1 >= count) { break; }
    let a = textureLoad(trailData, vec2i(offset + j, 0), 0);
    let b = textureLoad(trailData, vec2i(offset + j + 1, 0), 0);
    let start = a.xy * scale;
    let direction = (b.xy - a.xy) * scale;
    let ratio = clamp(dot(p - start, direction) / max(dot(direction, direction), 0.000001), 0.0, 1.0);
    let delta = p - (start + direction * ratio);
    let distance = dot(delta, delta);
    if (distance < nearest) {
      nearest = distance;
      signedSide = direction.x * delta.y - direction.y * delta.x;
    }
    let origin = start + sheetOffset;
    // Skip distant segments before clipping against the cell half planes.
    if (length(origin + direction * 0.5 - center) < 3.5) {
      var low = 0.0;
      var high = 1.0;
      for (var k = 0; k < planeCount; k++) {
        let numerator = planes[k].z - dot(planes[k].xy, origin);
        let denominator = dot(planes[k].xy, direction);
        if (abs(denominator) < 0.00001) {
          if (numerator < 0.0) { high = -1.0; }
        } else if (denominator > 0.0) {
          high = min(high, numerator / denominator);
        } else {
          low = max(low, numerator / denominator);
        }
      }
      if (high > low) {
        crossingEntry = min(crossingEntry, mix(a.w, b.w, low) * scale);
        crossingExit = max(crossingExit, mix(a.w, b.w, high) * scale);
      }
    }
  }
  let headDistance = textureLoad(trailData, vec2i(offset + max(count - 1, 0), 0), 0).w * scale;
  let blend = smoothstep(0.08, 0.25, crossingExit - crossingEntry)
    * smoothstep(0.0, 0.48, headDistance - crossingExit) * metadata.y;
  let side = step(0.0, signedSide);
  let childOwner = owner + vec2f(137.7 + side * 79.3 + index * 53.1,
    213.1 + metadata.w * 31.7 + side * 43.9 + index * 117.3);
  return vec4f(blend, childOwner, side);
}

// A slow rise, a short crest, then a longer release and a quiet interval.
// Nearby regions share a phrase; its position-dependent delay prevents a pulse
// that makes the entire image breathe in lockstep.
fn lpPhrase(position: vec2f, time: f32) -> f32 {
  let phase = fract(time * 0.028 + lpNoise(position * 0.28 + 19.7) * 0.32);
  return smoothstep(0.10, 0.58, phase) * (1.0 - smoothstep(0.66, 0.91, phase));
}

fn lpRegion(id: vec2f, seed: vec2f, time: f32, form: vec4f, music: vec4f) -> vec3f {
  let random = lpHash2(id + seed);
  let group = floor(id * 0.5);
  let slot = id - group * 2.0;
  let anchorSlot = floor(lpHash(group + seed + 137.0) * 4.0);
  let anchor = select(0.0, 1.0, slot.x + slot.y * 2.0 == anchorSlot);
  let phrase = lpPhrase(id + 0.5, time);
  let groupAngle = lpHash(group + seed + 51.0) * 6.283185;
  let localAngle = lpHash(id + seed + 87.0) * 6.283185;
  let motionGate = 0.42 + music.y * 0.58 * phrase;
  let movement = vec2f(sin(time * 0.10 + groupAngle), cos(time * 0.085 + groupAngle)) * 0.10
    + vec2f(cos(time * 0.13 + localAngle), sin(time * 0.11 + localAngle)) * 0.045;
  let site = id + 0.5 + (random - 0.5) * 0.83 + form.z * motionGate * movement;
  let hierarchy = music.w * (anchor * 0.86 - 0.17);
  let staticWeight = (lpHash(id + seed + 13.0) - 0.5) * 0.72 + hierarchy;
  let response = mix(-0.65, 1.0, anchor);
  let growth = form.w * music.x * 0.37 * response * music.y * (phrase - 0.45);
  return vec3f(site, staticWeight + growth);
}

fn lpHash(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.x, p.y, p.x) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn lpHash2(p: vec2f) -> vec2f {
  return vec2f(lpHash(p), lpHash(p + vec2f(39.7, 17.2)));
}

fn lpNoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(lpHash(i), lpHash(i + vec2f(1.0, 0.0)), u.x),
    mix(lpHash(i + vec2f(0.0, 1.0)), lpHash(i + vec2f(1.0, 1.0)), u.x), u.y);
}

fn lpFbm(p: vec2f) -> f32 {
  return lpNoise(p) * 0.56 + lpNoise(p * 2.03 + 7.1) * 0.27 + lpNoise(p * 4.09 + 19.3) * 0.12 + lpNoise(p * 8.13 + 31.7) * 0.05;
}
`);

export default defineComponent({
  metadata: {
    declarationVersion: 1, key: 'lux/living-painting', label: 'Living Painting',
    description: 'Organic watercolor regions that adopt new colors and hatch styles when shared tracer paths cross them.',
    tags: ['painting', 'regions', 'watercolor'],
    inputs: { paths: { type: { kind: 'paths2d', version: 1, coordinateSpace: 'canvas-height' }, label: 'Paths', description: 'Shared tracer geometry used to carve the regions.' } },
    outputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'The painting before tracer ink is composited.' } },
  controls: {
    pace: { type: 'number', group: 'Motion', label: 'Pace', default: 1.24, min: 0, max: 3, step: 0.01 },
    motion: { type: 'number', group: 'Motion', label: 'Drift', default: 1.08, min: 0, max: 1.5, step: 0.01 },
    phrasing: { type: 'number', group: 'Motion', label: 'Tension and release', default: 1, min: 0, max: 1, step: 0.01, description: 'Slow build, crest, release, and rest. Shapes lead; linework and color follow.' },

    scale: { type: 'number', group: 'Regions', label: 'Scale', default: 6.2, min: 2, max: 10, step: 0.01 },
    warp: { type: 'number', group: 'Regions', label: 'Flowing bends', default: 2.65, min: 0, max: 3, step: 0.01 },
    growth: { type: 'number', group: 'Regions', label: 'Region growth', default: 0.88, min: 0, max: 1.5, step: 0.01 },
    seed: { type: 'number', group: 'Regions', label: 'Variation', default: 7, min: 0, max: 100, step: 1 },

    composition: { type: 'number', group: 'Composition', label: 'Quiet to intricate', default: 0.44, min: 0, max: 1.5, step: 0.01 },
    tension: { type: 'number', group: 'Composition', label: 'Tension', default: 0.72, min: 0, max: 1.5, step: 0.01, description: 'Strength of local pressure, contrasting line directions, and rhythmic compression.' },
    hierarchy: { type: 'number', group: 'Composition', label: 'Large and small rhythm', default: 0.99, min: 0, max: 1.5, step: 0.01, description: 'Large anchor regions alternate with smaller supporting regions.' },

    coverage: { type: 'number', group: 'Hatching', label: 'Coverage', default: 0.23, min: 0, max: 1, step: 0.01 },
    spacing: { type: 'number', group: 'Hatching', label: 'Average spacing', default: 0.096, min: 0.015, max: 0.12, step: 0.001, description: 'Overall spacing scale. Each region keeps its own spacing ratio.' },
    curvature: { type: 'number', group: 'Hatching', label: 'Overall bend', default: 1.52, min: 0, max: 3, step: 0.01, description: 'Strength of distinct regional styles: restrained lines, sweeping curves, fans, and contours.' },
    angle: { type: 'number', group: 'Hatching', label: 'Direction bias', default: 2.31, min: -3.1416, max: 3.1416, step: 0.01, description: 'Shifts the overall direction while preserving regional relationships.' },
    hatchWidth: { type: 'number', group: 'Hatching', label: 'Average ink weight', default: 0.12, min: 0.035, max: 0.4, step: 0.005, description: 'Overall stroke weight. Dense patterns tend toward finer strokes; open patterns can carry heavier marks.' },
    relation: { type: 'number', group: 'Hatching', label: 'Neighboring harmony', default: 0.54, min: 0, max: 1, step: 0.01, description: 'Neighboring patterns share direction, with occasional opposing accents.' },

    spacingVar: { type: 'number', group: 'Regional variety', label: 'Spacing variety', default: 1, min: 0, max: 1, step: 0.01 },
    curvatureVar: { type: 'number', group: 'Regional variety', label: 'Bend variety', default: 1, min: 0, max: 1, step: 0.01 },
    angleVar: { type: 'number', group: 'Regional variety', label: 'Direction variety', default: 1.19, min: 0, max: 1.5, step: 0.01 },

    palette: { type: 'number', group: 'Color & watercolor', label: 'Wash lightness', default: 0.07, min: -1, max: 1, step: 0.01 },
    warmth: { type: 'number', group: 'Color & watercolor', label: 'Warm pools', default: 1.3, min: 0, max: 2, step: 0.01 },
    contrast: { type: 'number', group: 'Color & watercolor', label: 'Region contrast', default: 1.05, min: 0, max: 2, step: 0.01 },
    pooling: { type: 'number', group: 'Color & watercolor', label: 'Pigment pooling', default: 0.74, min: 0, max: 2, step: 0.01 },
    blooms: { type: 'number', group: 'Color & watercolor', label: 'Watercolor blooms', default: 0.94, min: 0, max: 2, step: 0.01 },

    outline: { type: 'number', group: 'Ink & paper', label: 'Boundary width', default: 0.005, min: 0.002, max: 0.03, step: 0.001 },
    inkWarmth: { type: 'number', group: 'Ink & paper', label: 'Warmth', default: 0.15, min: 0, max: 1, step: 0.01 },
    handDrawn: { type: 'number', group: 'Ink & paper', label: 'Hand-drawn character', default: 1.34, min: 0, max: 1.5, step: 0.01 },
    grain: { type: 'number', group: 'Ink & paper', label: 'Grain', default: 1.48, min: 0, max: 2, step: 0.01 },


  },
    controlDescriptions: {pace: 'pace setting for the painting.',
      motion: 'motion setting for the painting.',
      phrasing: 'phrasing setting for the painting.',
      scale: 'scale setting for the painting.',
      warp: 'warp setting for the painting.',
      growth: 'growth setting for the painting.',
      seed: 'seed setting for the painting.',
      composition: 'composition setting for the painting.',
      tension: 'tension setting for the painting.',
      hierarchy: 'hierarchy setting for the painting.',
      coverage: 'coverage setting for the painting.',
      spacing: 'spacing setting for the painting.',
      curvature: 'curvature setting for the painting.',
      angle: 'angle setting for the painting.',
      hatchWidth: 'hatchWidth setting for the painting.',
      relation: 'relation setting for the painting.',
      spacingVar: 'spacingVar setting for the painting.',
      curvatureVar: 'curvatureVar setting for the painting.',
      angleVar: 'angleVar setting for the painting.',
      palette: 'palette setting for the painting.',
      warmth: 'warmth setting for the painting.',
      contrast: 'contrast setting for the painting.',
      pooling: 'pooling setting for the painting.',
      blooms: 'blooms setting for the painting.',
      outline: 'outline setting for the painting.',
      inkWarmth: 'inkWarmth setting for the painting.',
      handDrawn: 'handDrawn setting for the painting.',
      grain: 'grain setting for the painting.'},
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const time = uniform(0);
    const aspect = context.settings.width / context.settings.height;
    const seed = uniform(7);
    const scale = uniform(5.4);
    const warp = uniform(1.3);
    const motion = uniform(0.8);
    const growth = uniform(0.65);
    const coverage = uniform(0.58);
    const spacing = uniform(0.042);
    const curvature = uniform(1.3);
    const angle = uniform(0);
    const palette = uniform(0.1);
    const warmth = uniform(1);
    const contrast = uniform(1);
    const pooling = uniform(0.8);
    const outline = uniform(0.008);
    const hatchWidth = uniform(0.15);
    const inkWarmth = uniform(0.23);
    const grain = uniform(1);
    const composition = uniform(0.9);
    const handDrawn = uniform(0.85);
    const blooms = uniform(1.1);
    const tension = uniform(0.72);
    const phrasing = uniform(0.85);
    const relation = uniform(0.74);
    const hierarchy = uniform(1.0);
    const spacingVar = uniform(1);
    const curvatureVar = uniform(1);
    const angleVar = uniform(1);
    // Preserve the saved study’s regional weight variety.
    const widthVar = uniform(0.81);
    // Bounded texture upload avoids large uniform arrays and uses the exact shared paths.
    const pathData = new Float32Array(260 * 4);
    const pathTexture = new DataTexture(pathData, 260, 1, RGBAFormat, FloatType);
    pathTexture.minFilter = pathTexture.magFilter = NearestFilter;
    pathTexture.generateMipmaps = false;
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    material.fragmentNode = painting(
      uv(),
      vec4(time, aspect, seed, 0),
      vec4(scale, warp, motion, growth),
      vec4(coverage, spacing, curvature, angle),
      vec4(palette, warmth, contrast, pooling),
      vec4(outline, hatchWidth, inkWarmth, grain),
      vec4(composition, handDrawn, blooms, 0),
      vec4(tension, phrasing, relation, hierarchy),
      vec4(spacingVar, curvatureVar, angleVar, widthVar),
      vec4(4, 0, 0, 0),
      texture(pathTexture),
    );
    const geometry = new PlaneGeometry(2, 2);
    const scene = new Scene();
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    let artisticTime = 0;
    let previousTime = 0;
    return {
      update(frame) {
        const c = frame.controls;
        artisticTime += Math.max(0, frame.timeSeconds - previousTime) * c.pace;
        previousTime = frame.timeSeconds;
        time.value = artisticTime;
        seed.value = c.seed;
        scale.value = c.scale;
        warp.value = c.warp;
        motion.value = c.motion;
        growth.value = c.growth;
        coverage.value = c.coverage;
        spacing.value = c.spacing;
        curvature.value = c.curvature;
        angle.value = c.angle;
        palette.value = c.palette;
        warmth.value = c.warmth;
        contrast.value = c.contrast;
        pooling.value = c.pooling;
        outline.value = c.outline;
        hatchWidth.value = c.hatchWidth;
        inkWarmth.value = c.inkWarmth;
        grain.value = c.grain;
        composition.value = c.composition;
        handDrawn.value = c.handDrawn;
        blooms.value = c.blooms;
        tension.value = c.tension;
        phrasing.value = c.phrasing;
        relation.value = c.relation;
        hierarchy.value = c.hierarchy;
        spacingVar.value = c.spacingVar;
        curvatureVar.value = c.curvatureVar;
        angleVar.value = c.angleVar;
      },
      async evaluate(inputs, evaluation) {
        const paths = (inputs.paths as Paths2DResource).data.paths;
        if (paths.length > 4 || paths.some(path => path.points.length > 64)) {
          throw Error('Living Painting supports at most four paths of 64 points.');
        }
        pathData.fill(0);
        paths.forEach((path, index) => {
          pathData.set([path.points.length, path.opacity, path.styleSeed, path.generation], (256 + index) * 4);
          path.points.forEach((point, j) => pathData.set([point.x, point.y, point.width, point.distance], (index * 64 + j) * 4));
        });
        pathTexture.needsUpdate = true;
        return { image: await evaluation.render(scene, camera) };
      },
      reset(_seed) {
        artisticTime = 0;
        previousTime = 0;
      },
      dispose() {
        geometry.dispose();
        material.dispose();
        pathTexture.dispose();
      },
    };
  },
});
