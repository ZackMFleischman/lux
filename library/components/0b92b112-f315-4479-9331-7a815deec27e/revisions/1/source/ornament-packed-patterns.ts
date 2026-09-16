// Packed ornament patterns for lux/ornament-regions/v1. LoRegion.local and
// LoRegion.tangent are both expressed in the region's attached local frame.
export const ornamentPackedPatterns = `fn loPatternFrame(r: LoRegion) -> mat2x2f {
  let tangent = normalize(r.tangent);
  return mat2x2f(tangent, vec2f(-tangent.y, tangent.x));
}

fn loSpirals(r: LoRegion, p: vec2f, t: f32, settings: vec4f) -> f32 {
  let density = max(settings.x, 0.05);
  let width = max(settings.y, 0.05);
  let variation = clamp(settings.z, 0.0, 1.5);
  let motion = max(settings.w, 0.0);
  let frequency = 7.0 * density;
  let attached = transpose(loPatternFrame(r)) * r.local;
  let grid = attached * frequency;
  let home = floor(grid);
  let pixel = max(max(fwidth(p.x), fwidth(p.y)) * frequency, 0.0008);
  var coverage = 0.0;

  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let cell = home + vec2f(f32(x), f32(y));
      let seed = cell + vec2f(r.identity * 0.071, r.identity * 0.113);
      let hx = loHash(seed + 17.3);
      let hy = loHash(seed + 43.7);
      let hr = loHash(seed + 91.1);
      let phase = loHash(seed + 131.9) * 6.2831853;
      let jitter = (vec2f(hx, hy) - 0.5) * (0.14 + variation * 0.20);
      let drift = vec2f(cos(t * 0.083 * motion + phase), sin(t * 0.067 * motion + phase));
      let center = cell + vec2f(0.5) + jitter + drift * motion * 0.018;
      let q = grid - center;
      let radius = mix(0.22, 0.47, hr) * mix(0.92, 1.08, clamp(variation, 0.0, 1.0));
      let radial = length(q);
      let angle = atan2(q.y, q.x) + t * motion * (0.045 + hr * 0.035);
      let turns = 2.15 + variation * mix(0.65, 1.55, hx);
      let pitch = radius / max(turns, 0.5);
      let winding = abs(fract(radial / pitch - angle / 6.2831853 + 0.5) - 0.5) * pitch;
      let inkWidth = radius * (0.038 + hr * 0.014) * width;
      let line = 1.0 - smoothstep(inkWidth, inkWidth + pixel, winding);
      let packed = 1.0 - smoothstep(radius - pixel, radius + pixel, radial);
      coverage = max(coverage, line * packed);
    }
  }
  return clamp(coverage, 0.0, 1.0);
}

fn loRings(r: LoRegion, p: vec2f, t: f32, settings: vec4f) -> f32 {
  let density = max(settings.x, 0.05);
  let width = max(settings.y, 0.05);
  let variation = clamp(settings.z, 0.0, 1.5);
  let motion = max(settings.w, 0.0);
  let frequency = 6.2 * density;
  let attached = transpose(loPatternFrame(r)) * r.local;
  let grid = attached * frequency;
  let home = floor(grid);
  let pixel = max(max(fwidth(p.x), fwidth(p.y)) * frequency, 0.0008);
  var coverage = 0.0;

  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let cell = home + vec2f(f32(x), f32(y));
      let seed = cell + vec2f(r.identity * 0.097, r.identity * 0.149);
      let hx = loHash(seed + 11.7);
      let hy = loHash(seed + 37.1);
      let hr = loHash(seed + 79.9);
      let hd = loHash(seed + 151.3);
      let phase = loHash(seed + 211.7) * 6.2831853;
      let jitter = (vec2f(hx, hy) - 0.5) * (0.14 + variation * 0.19);
      let drift = vec2f(sin(t * 0.061 * motion + phase), cos(t * 0.073 * motion + phase));
      let center = cell + vec2f(0.5) + jitter + drift * motion * 0.016;
      let q = grid - center;
      let baseRadius = mix(0.17, 0.48, hr);
      let pulse = 1.0 + motion * 0.025 * sin(t * 0.052 + phase);
      let radius = baseRadius * mix(0.92, 1.10, variation * hr) * pulse;
      let radial = length(q);
      let inkWidth = (0.023 + hx * 0.012) * width;
      let ringDistance = abs(radial - radius);
      let ring = 1.0 - smoothstep(inkWidth, inkWidth + pixel, ringDistance);
      let dotRadius = radius * mix(0.18, 0.31, hy);
      let dot = (1.0 - smoothstep(dotRadius - pixel, dotRadius + pixel, radial))
        * step(0.82 - variation * 0.035, hd);
      coverage = max(coverage, max(ring, dot));
    }
  }
  return clamp(coverage, 0.0, 1.0);
}
`;
