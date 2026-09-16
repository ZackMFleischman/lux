// ABI lux/ornament-regions/v1 supplies this exact helper fragment. The
// ornament renderer combines it with the shared lo-prefixed phrasing helpers.
export const ornamentRegionFragments = Object.freeze({
  helpers: `struct LoRegion {
  identity: f32,
  parent: f32,
  edge: f32,
  age: f32,
  // local and tangent use the same owner-attached local frame.
  local: vec2f,
  tangent: vec2f,
}

fn loRotate(p: vec2f, angle: f32) -> vec2f {
  let c = cos(angle);
  let s = sin(angle);
  return vec2f(c * p.x + s * p.y, -s * p.x + c * p.y);
}

fn loUnrotate(p: vec2f, angle: f32) -> vec2f {
  let c = cos(angle);
  let s = sin(angle);
  return vec2f(c * p.x - s * p.y, s * p.x + c * p.y);
}

fn loEllipse(p: vec2f, radii: vec2f) -> f32 {
  let safeRadii = max(radii, vec2f(0.001));
  return (length(p / safeRadii) - 1.0) * min(safeRadii.x, safeRadii.y);
}

fn loCapsule(p: vec2f, a: vec2f, b: vec2f, radius: f32) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h) - radius;
}

fn loSmoothUnion(a: f32, b: f32, radius: f32) -> f32 {
  let h = clamp(0.5 + 0.5 * (b - a) / max(radius, 0.0001), 0.0, 1.0);
  return mix(b, a, h) - radius * h * (1.0 - h);
}

fn loSmoothSubtract(shape: f32, hole: f32, radius: f32) -> f32 {
  return -loSmoothUnion(-shape, hole, radius);
}

fn loWaveBand(p: vec2f, angle: f32, offset: f32, amplitude: f32, frequency: f32,
  phase: f32, halfWidth: f32, halfLength: f32) -> f32 {
  let q = loRotate(p, angle);
  let curve = q.y - offset - amplitude * sin(q.x * frequency + phase)
    - amplitude * 0.28 * sin(q.x * frequency * 2.17 - phase * 0.63);
  let limits = vec2f(abs(q.x) - halfLength, abs(curve) - halfWidth);
  return length(max(limits, vec2f(0.0))) + min(max(limits.x, limits.y), 0.0);
}

fn loAnchorIndex(index: i32) -> i32 {
  var anchor = index;
  if (index == 11) { anchor = 1; }
  if (index == 12) { anchor = 3; }
  if (index == 13) { anchor = 2; }
  if (index == 14) { anchor = 7; }
  if (index == 15) { anchor = 4; }
  return anchor;
}

fn loRegionCenter(index: i32, t: f32, seed: f32, motion: f32) -> vec2f {
  var center = vec2f(0.0);
  switch index {
    case 1: { center = vec2f(-1.22, 0.42); }
    case 2: { center = vec2f(-0.78, -0.53); }
    case 3: { center = vec2f(0.52, 0.50); }
    case 4: { center = vec2f(1.38, -0.37); }
    case 5: { center = vec2f(-0.42, 0.32); }
    case 6: { center = vec2f(0.35, -0.34); }
    case 7: { center = vec2f(1.13, 0.26); }
    case 8: { center = vec2f(-1.42, -0.42); }
    case 11: { center = vec2f(-1.28, 0.43); }
    case 12: { center = vec2f(0.61, 0.52); }
    case 13: { center = vec2f(-0.68, -0.55); }
    case 14: { center = vec2f(1.12, 0.27); }
    case 15: { center = vec2f(1.38, -0.37); }
    default: {}
  }
  let anchor = loAnchorIndex(index);
  let id = vec2f(f32(anchor) * 7.31, seed * 0.193 + 17.0);
  let jitter = (loHash2(id) - 0.5) * vec2f(0.34, 0.24);
  let phase = loHash(id + 29.0) * 6.283185;
  let drift = vec2f(sin(t * 0.071 + phase), cos(t * 0.057 + phase * 1.23));
  return center + jitter + drift * motion * 0.34;
}

fn loRegionAngle(index: i32, seed: f32) -> f32 {
  var base = 0.0;
  let anchor = loAnchorIndex(index);
  switch anchor {
    case 1: { base = -0.18; }
    case 2: { base = 0.18; }
    case 3: { base = -0.13; }
    case 4: { base = 0.22; }
    case 5: { base = 0.44; }
    case 6: { base = -0.36; }
    case 7: { base = 0.14; }
    case 8: { base = -0.48; }
    default: {}
  }
  return base + (loHash(vec2f(f32(anchor) * 3.1, seed + 41.0)) - 0.5) * 0.42;
}

// This frame follows each shape's stable anchor. Islands inherit their parent
// anchor phase, so their paint and line work stretch with the owning form.
fn loAttachedLocal(index: i32, p: vec2f, t: f32, seed: f32, motion: f32) -> vec2f {
  let center = loRegionCenter(index, t, seed, motion);
  let angle = loRegionAngle(index, seed);
  let local = loRotate(p - center, angle);
  if (index == 9 || index == 10) { return local; }
  let anchor = loAnchorIndex(index);
  let anchorSeed = vec2f(f32(anchor) * 5.17, seed * 0.137 + 23.0);
  let phrase = loPhrase(vec2f((101.0 + f32(anchor)) * 0.17, 0.0), t);
  let phase = loHash(anchorSeed + 47.0) * 6.283185;
  let tension = (phrase - 0.42) * motion * 0.11;
  let bend = sin(local.y * 4.1 + phase) * motion * (0.006 + phrase * 0.012);
  return vec2f(
    local.x * (1.0 + tension) + bend * local.y,
    local.y * (1.0 - tension * 0.72) + bend * local.x * 0.35,
  );
}

fn loShapeSdf(index: i32, p: vec2f, t: f32, seed: f32, shape: vec4f,
  detail: vec4f, sharedNoise: f32) -> f32 {
  let size = shape.x;
  let complexity = shape.y;
  let concavity = shape.z;
  let corridorWidth = shape.w;
  let nesting = detail.x;
  let motion = detail.y;
  let growth = detail.z;
  let hierarchy = detail.w;
  // Center the hierarchy response on the published default so existing scenes
  // keep their composition while the full control range changes the tier rhythm.
  let hierarchyDelta = hierarchy - 0.99;
  let broadSize = size * clamp(1.0 + hierarchyDelta * 0.22, 0.78, 1.12);
  let mediumSize = size * clamp(1.0 - hierarchyDelta * 0.16, 0.92, 1.16);
  let smallScale = clamp(1.0 + hierarchyDelta * 0.28, 0.72, 1.15);
  let angle = loRegionAngle(index, seed);
  let q = loAttachedLocal(index, p, t, seed, motion);
  let identity = loHash(vec2f(f32(index) * 11.0, seed + 73.0));
  let phase = identity * 6.283185;
  let breathe = growth * sin(t * (0.031 + identity * 0.018) + phase) * 0.045;
  let seededScale = 0.88 + identity * 0.22;
  var d = 1000.0;

  switch index {
    case 1: {
      let body = loEllipse(q, vec2f(0.44, 0.38) * broadSize * seededScale * (1.0 + breathe));
      let upper = loEllipse(q - vec2f(0.20, 0.29), vec2f(0.29, 0.24) * broadSize);
      let shoulder = loEllipse(q - vec2f(0.34, -0.15), vec2f(0.25, 0.20) * broadSize);
      d = loSmoothUnion(loSmoothUnion(body, upper, 0.13), shoulder, 0.10);
      let bay = loEllipse(q - vec2f(-0.24, 0.14), vec2f(0.22, 0.28) * (0.70 + concavity * 0.34));
      d = loSmoothSubtract(d, bay, 0.065);
    }
    case 2: {
      let body = loEllipse(q, vec2f(0.48, 0.32) * broadSize * seededScale * (1.0 + breathe));
      let tail = loEllipse(q - vec2f(-0.34, 0.17), vec2f(0.24, 0.20) * broadSize);
      let chin = loEllipse(q - vec2f(0.31, -0.17), vec2f(0.27, 0.19) * broadSize);
      d = loSmoothUnion(loSmoothUnion(body, tail, 0.11), chin, 0.09);
      let bay = loEllipse(q - vec2f(0.10, 0.23), vec2f(0.25, 0.20) * (0.72 + concavity * 0.30));
      d = loSmoothSubtract(d, bay, 0.060);
    }
    case 3: {
      let anchor = loEllipse(q, vec2f(0.48, 0.40) * broadSize * (1.0495 + breathe));
      let crown = loEllipse(q - vec2f(-0.28, 0.22), vec2f(0.29, 0.22) * broadSize);
      let lower = loEllipse(q - vec2f(0.31, -0.19), vec2f(0.27, 0.23) * broadSize);
      d = loSmoothUnion(loSmoothUnion(anchor, crown, 0.14), lower, 0.11);
      let bay = loEllipse(q - vec2f(0.29, 0.11), vec2f(0.25, 0.32) * (0.68 + concavity * 0.35));
      d = loSmoothSubtract(d, bay, 0.070);
    }
    case 4: {
      let body = loEllipse(q, vec2f(0.42, 0.34) * broadSize * seededScale * (1.0 + breathe));
      let high = loEllipse(q - vec2f(-0.15, 0.29), vec2f(0.23, 0.25) * broadSize);
      let side = loEllipse(q - vec2f(-0.32, -0.08), vec2f(0.22, 0.25) * broadSize);
      d = loSmoothUnion(loSmoothUnion(body, high, 0.11), side, 0.09);
      let bay = loEllipse(q - vec2f(0.23, -0.15), vec2f(0.20, 0.25) * (0.72 + concavity * 0.29));
      d = loSmoothSubtract(d, bay, 0.055);
    }
    case 5: {
      let body = loEllipse(q, vec2f(0.37, 0.27) * mediumSize * seededScale);
      let lobe = loEllipse(q - vec2f(0.27, 0.12), vec2f(0.23, 0.20) * mediumSize);
      d = loSmoothUnion(body, lobe, 0.10);
      let bite = loEllipse(q - vec2f(-0.24, -0.12), vec2f(0.17, 0.20) * (0.75 + concavity * 0.22));
      d = loSmoothSubtract(d, bite, 0.045);
    }
    case 6: {
      let body = loEllipse(q, vec2f(0.42, 0.29) * mediumSize * seededScale);
      let lobe = loEllipse(q - vec2f(-0.29, 0.14), vec2f(0.24, 0.21) * mediumSize);
      let neck = loCapsule(q, vec2f(0.05, -0.04), vec2f(0.43, -0.22), corridorWidth * 0.68);
      d = loSmoothUnion(loSmoothUnion(body, lobe, 0.10), neck, 0.07);
      let bite = loEllipse(q - vec2f(0.20, 0.20), vec2f(0.19, 0.18) * (0.72 + concavity * 0.25));
      d = loSmoothSubtract(d, bite, 0.045);
    }
    case 7: {
      let body = loEllipse(q, vec2f(0.35, 0.30) * mediumSize * seededScale);
      let head = loEllipse(q - vec2f(0.28, 0.16), vec2f(0.22, 0.20) * mediumSize);
      let foot = loEllipse(q - vec2f(-0.25, -0.18), vec2f(0.20, 0.19) * mediumSize);
      d = loSmoothUnion(loSmoothUnion(body, head, 0.10), foot, 0.08);
      let cleft = loEllipse(q - vec2f(-0.03, 0.24), vec2f(0.16, 0.21) * (0.72 + concavity * 0.26));
      d = loSmoothSubtract(d, cleft, 0.040);
    }
    case 8: {
      let body = loEllipse(q, vec2f(0.34, 0.24) * mediumSize * seededScale);
      let lobe = loEllipse(q - vec2f(-0.25, 0.12), vec2f(0.19, 0.18) * mediumSize);
      d = loSmoothUnion(body, lobe, 0.09);
      let cleft = loEllipse(q - vec2f(0.21, -0.10), vec2f(0.14, 0.16) * (0.75 + concavity * 0.20));
      d = loSmoothSubtract(d, cleft, 0.040);
    }
    case 9: {
      let bandPhase = phase + t * motion * 0.10;
      d = loWaveBand(p, -0.06, -0.05, 0.16 + complexity * 0.035, 2.05,
        bandPhase, corridorWidth * 0.46, 2.35);
    }
    case 10: {
      let bandPhase = phase + 1.7 + t * motion * 0.10;
      d = loWaveBand(p - vec2f(0.10, 0.0), 0.82, 0.0, 0.13 + complexity * 0.04, 2.55,
        bandPhase, corridorWidth * 0.34, 1.55);
    }
    case 11: {
      let radius = nesting * 0.3184615 * smallScale;
      let outer = loEllipse(q - vec2f(0.04, -0.03), vec2f(radius * 1.26, radius * 0.78));
      let notch = loEllipse(q - vec2f(-radius * 0.78, radius * 0.34), vec2f(radius * 0.48));
      d = loSmoothSubtract(outer, notch, radius * 0.22) + (1.0 - nesting) * 0.025
        + (1.0 - smoothstep(0.0, 0.12, nesting)) * 0.08;
      let parentQ = q + loRotate(vec2f(-0.06, 0.01), angle);
      let parentBody = loEllipse(parentQ, vec2f(0.40, 0.34) * broadSize);
      let parentBay = loEllipse(parentQ - vec2f(-0.24, 0.14), vec2f(0.22, 0.28) * (0.70 + concavity * 0.34));
      d = max(d, loSmoothSubtract(parentBody, parentBay, 0.05) + 0.025);
    }
    case 12: {
      let radius = nesting * 0.3007692 * smallScale;
      let a = loEllipse(q, vec2f(radius * 1.18, radius * 0.80));
      let b = loEllipse(q - vec2f(radius * 0.72, radius * 0.34), vec2f(radius * 0.68));
      d = loSmoothUnion(a, b, radius * 0.28) + (1.0 - nesting) * 0.025
        + (1.0 - smoothstep(0.0, 0.12, nesting)) * 0.08;
      let parentQ = q + loRotate(vec2f(0.09, 0.02), angle);
      let parentBody = loEllipse(parentQ, vec2f(0.43, 0.35) * broadSize);
      let parentBay = loEllipse(parentQ - vec2f(0.29, 0.11), vec2f(0.25, 0.32) * (0.68 + concavity * 0.35));
      d = max(d, loSmoothSubtract(parentBody, parentBay, 0.055) + 0.025);
    }
    case 13: {
      let radius = nesting * 0.2730769 * smallScale;
      let outer = loEllipse(q, vec2f(radius * 1.34, radius * 0.72));
      let notch = loEllipse(q - vec2f(radius * 0.64, -radius * 0.36), vec2f(radius * 0.46));
      d = loSmoothSubtract(outer, notch, radius * 0.20) + (1.0 - nesting) * 0.025
        + (1.0 - smoothstep(0.0, 0.12, nesting)) * 0.08;
      let parentQ = q + loRotate(vec2f(0.10, -0.02), angle);
      let parentBody = loEllipse(parentQ, vec2f(0.43, 0.28) * broadSize);
      let parentBay = loEllipse(parentQ - vec2f(0.10, 0.23), vec2f(0.25, 0.20) * (0.72 + concavity * 0.30));
      d = max(d, loSmoothSubtract(parentBody, parentBay, 0.05) + 0.022);
    }
    case 14: {
      let radius = nesting * 0.2653846 * smallScale;
      let outer = loEllipse(q, vec2f(radius * 0.82, radius * 1.28));
      let bud = loEllipse(q - vec2f(-radius * 0.46, radius * 0.64), vec2f(radius * 0.62));
      d = loSmoothUnion(outer, bud, radius * 0.24) + (1.0 - nesting) * 0.025
        + (1.0 - smoothstep(0.0, 0.12, nesting)) * 0.08;
      let parentQ = q + loRotate(vec2f(-0.01, 0.01), angle);
      let parentBody = loEllipse(parentQ, vec2f(0.31, 0.26) * mediumSize);
      let parentCleft = loEllipse(parentQ - vec2f(-0.03, 0.24), vec2f(0.16, 0.21) * (0.72 + concavity * 0.26));
      d = max(d, loSmoothSubtract(parentBody, parentCleft, 0.04) + 0.020);
    }
    case 15: {
      let radius = nesting * 0.2476923 * smallScale;
      let outer = loEllipse(q - vec2f(0.10, 0.02), vec2f(radius * 1.30, radius * 0.82));
      let notch = loEllipse(q - vec2f(0.10 + radius * 0.58, 0.02), vec2f(radius * 0.70));
      d = loSmoothSubtract(outer, notch, radius * 0.20) + (1.0 - nesting) * 0.025
        + (1.0 - smoothstep(0.0, 0.12, nesting)) * 0.08;
      let parentBody = loEllipse(q, vec2f(0.38, 0.30) * broadSize);
      let parentBay = loEllipse(q - vec2f(0.23, -0.15), vec2f(0.20, 0.25) * (0.72 + concavity * 0.29));
      d = max(d, loSmoothSubtract(parentBody, parentBay, 0.045) + 0.020);
    }
    default: {}
  }
  let quiet = select(1.0, 0.42, index <= 4);
  return d + sharedNoise * quiet * (0.010 + complexity * 0.014) * (0.74 + identity * 0.34);
}

fn loRegion(p: vec2f, t: f32, seed: f32, shape: vec4f, detail: vec4f) -> LoRegion {
  // One front-to-back traversal is enough for layered ownership. On entry to
  // a foreground shape its own interior distance replaces all hidden lower
  // boundaries; while outside, its positive distance is a shared visible edge.
  let sharedNoise = loFbm(p * (1.35 + shape.y * 0.38) + vec2f(seed * 0.071, -seed * 0.043)) - 0.5;
  var owner = 0;
  var edge = 1000.0;
  for (var index = 1; index <= 15; index++) {
    let distance = loShapeSdf(index, p, t, seed, shape, detail, sharedNoise);
    if (distance <= 0.0) {
      owner = index;
      edge = -distance;
    } else {
      edge = min(edge, distance);
    }
  }

  let center = loRegionCenter(owner, t, seed, detail.y);
  let angle = loRegionAngle(owner, seed);
  // Tangents are expressed in the same attached frame as local coordinates.
  var attachedLocal = loAttachedLocal(owner, p, t, seed, detail.y);
  var tangent = vec2f(1.0, 0.0);
  if (owner == 9) {
    let bandAngle = -0.06;
    let bandLocal = loRotate(p, bandAngle);
    let amplitude = 0.16 + shape.y * 0.035;
    let frequency = 2.05;
    let phase = loHash(vec2f(99.0, seed + 73.0)) * 6.283185 + t * detail.y * 0.10;
    let centerline = -0.05 + amplitude * sin(bandLocal.x * frequency + phase)
      + amplitude * 0.28 * sin(bandLocal.x * frequency * 2.17 - phase * 0.63);
    attachedLocal = vec2f(bandLocal.x, bandLocal.y - centerline);
  }
  if (owner == 10) {
    let bandAngle = 0.82;
    let bandLocal = loRotate(p - vec2f(0.10, 0.0), bandAngle);
    let amplitude = 0.13 + shape.y * 0.04;
    let frequency = 2.55;
    let phase = loHash(vec2f(110.0, seed + 73.0)) * 6.283185 + 1.7 + t * detail.y * 0.10;
    let centerline = amplitude * sin(bandLocal.x * frequency + phase)
      + amplitude * 0.28 * sin(bandLocal.x * frequency * 2.17 - phase * 0.63);
    attachedLocal = vec2f(bandLocal.x, bandLocal.y - centerline);
  }
  var parent = 0.0;
  if (owner == 11) { parent = 102.0; }
  if (owner == 12) { parent = 104.0; }
  if (owner == 13) { parent = 103.0; }
  if (owner == 14) { parent = 108.0; }
  if (owner == 15) { parent = 105.0; }
  return LoRegion(
    101.0 + f32(owner),
    parent,
    max(edge, 0.0),
    1.0,
    attachedLocal,
    tangent
  );
}

// A hundred-second clock leaves a quiet opening, then prepares, grows, holds,
// and releases each structural event before returning to quiet. Offsets keep
// the two bisections and island birth from occurring in lockstep.
fn loStructuralAge(t: f32, offset: f32, activity: f32) -> f32 {
  let phase = fract(t / 100.0 - offset);
  let prepare = smoothstep(0.10, 0.22, phase);
  let release = 1.0 - smoothstep(0.46, 0.68, phase);
  return prepare * release * clamp(activity, 0.0, 1.0);
}

// This wrapper is opt-in so the published loRegion path remains exact. It
// performs one base traversal, then derives temporary ownership from that
// result in the same owner-attached coordinates used by paint and patterns.
fn loRegionEvolving(p: vec2f, t: f32, seed: f32, shape: vec4f, detail: vec4f,
  activity: f32) -> LoRegion {
  let region = loRegion(p, t, seed, shape, detail);
  if (activity <= 0.0) { return region; }

  // 102 and 107 each divide along a curved local half-plane. The finite cut
  // begins as a small central neck and reaches the outer form as it grows;
  // cutStrength keeps its edge distance broad and quiet during preparation.
  var daughterIdentity = 0.0;
  var parentIdentity = 0.0;
  var age = 0.0;
  if (region.identity == 102.0) {
    daughterIdentity = 117.0;
    parentIdentity = 102.0;
    age = loStructuralAge(t, 0.0, activity);
  }
  if (region.identity == 107.0) {
    daughterIdentity = 118.0;
    parentIdentity = 107.0;
    age = loStructuralAge(t, 0.10, activity);
  }
  if (daughterIdentity > 0.0 && age > 0.0) {
    let cut = region.local.x + select(0.0, 0.13, parentIdentity == 102.0)
      + sin(region.local.y * 5.0 + seed * 0.13 + parentIdentity) * 0.055;
    let span = mix(0.045, 0.72, smoothstep(0.0, 0.78, age));
    let cutDistance = length(vec2f(cut, max(abs(region.local.y) - span, 0.0)));
    let cutStrength = smoothstep(0.04, 0.34, age);
    let gap = 0.025 * smoothstep(0.60, 0.95, age);
    if (cutDistance < gap) {
      return LoRegion(
        101.0,
        0.0,
        gap - cutDistance,
        1.0,
        loAttachedLocal(0, p, t, seed, detail.y),
        vec2f(1.0, 0.0)
      );
    }
    let splitEdge = min(region.edge, (cutDistance - gap) / max(cutStrength, 0.001));
    let daughterSide = cut > 0.0;
    let daughterAge = age * (1.0 - smoothstep(span - 0.06, span + 0.06,
      abs(region.local.y)));
    return LoRegion(
      select(parentIdentity, daughterIdentity, daughterSide),
      select(0.0, parentIdentity, daughterSide),
      splitEdge,
      select(age, daughterAge, daughterSide),
      region.local,
      region.tangent
    );
  }

  // 119 is a known child of 104. Its rounded bud grows from a point inside
  // the parent, while the shared edge and age allow paint to inherit smoothly.
  let islandAge = loStructuralAge(t, 0.20, activity);
  if (region.identity == 104.0 && islandAge > 0.0) {
    let islandCenter = vec2f(-0.15, 0.13);
    let growth = smoothstep(0.0, 0.72, islandAge);
    let islandRadius = vec2f(0.18, 0.125) * growth;
    let islandLocal = region.local - islandCenter;
    let islandBody = loEllipse(islandLocal, islandRadius);
    let islandBud = loEllipse(islandLocal - vec2f(0.07, 0.035) * growth, islandRadius * 0.62);
    let islandDistance = loSmoothUnion(islandBody, islandBud, 0.026 * growth);
    if (islandDistance <= 0.0) {
      return LoRegion(
        119.0,
        104.0,
        min(region.edge, -islandDistance / max(smoothstep(0.04, 0.34, islandAge), 0.001)),
        islandAge,
        region.local,
        region.tangent
      );
    }
    return LoRegion(
      region.identity,
      region.parent,
      min(region.edge, islandDistance / max(smoothstep(0.04, 0.34, islandAge), 0.001)),
      islandAge,
      region.local,
      region.tangent
    );
  }
  return region;
}
`,
});
