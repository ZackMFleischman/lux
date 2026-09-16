// The Ornament renderer supplies LoRegion plus loHash and loNoise. Both
// helpers return coverage, letting the renderer keep a single paint pass.
export const ornamentLinePatternHelpers = `fn loLineCoverage(distance: f32, halfWidth: f32, aa: f32) -> f32 {
  return 1.0 - smoothstep(halfWidth - aa, halfWidth + aa, abs(distance));
}

fn loMembranes(r: LoRegion, p: vec2f, t: f32, settings: vec4f) -> f32 {
  let density = settings.x;
  let width = settings.y;
  let variation = settings.z;
  let motion = settings.w;
  let along = dot(r.local, r.tangent);
  let across = dot(r.local, vec2f(-r.tangent.y, r.tangent.x));
  let identity = vec2f(r.identity, r.parent);
  let hubCount = 1 + i32(floor(loHash(identity + 12.7) * 2.0));
  let aa = max(fwidth(along) + fwidth(across), 0.0010);
  var membrane = 0.0;
  for (var hubIndex = 0; hubIndex < 3; hubIndex++) {
    if (hubIndex >= hubCount) { break; }
    let hubSeed = identity + vec2f(f32(hubIndex) * 19.1, 71.3);
    let hub = vec2f(
      mix(-0.10, 0.10, loHash(hubSeed)),
      mix(-0.08, 0.08, loHash(hubSeed + 7.9)),
    );
    let q = vec2f(along, across) - hub;
    let angle = atan2(q.y, q.x);
    let radius = length(q);
    let petalCount = 7.0 + floor(loHash(hubSeed + 31.0) * 4.0);
    let bowedAngle = angle + sin(radius * 4.6 + hubSeed.x + t * motion * 0.05)
      * variation * 0.78;
    let phase = bowedAngle * petalCount / 6.283185 + loHash(hubSeed + 43.0);
    // The angular distance is converted to a world-space distance by radius,
    // so each fan line stays clean and reaches its owning cell boundary.
    let angularDistance = (fract(phase + 0.5) - 0.5) * 6.283185 / petalCount;
    let spokeDistance = radius * sin(angularDistance);
    let spokeWidth = max(0.0045 * width, aa * (1.25 + width * 0.85));
    let spoke = loLineCoverage(spokeDistance, spokeWidth, aa);
    membrane = max(membrane, spoke);
  }
  let gate = smoothstep(0.08, 0.46, density);
  return membrane * gate;
}

fn loContours(r: LoRegion, p: vec2f, t: f32, settings: vec4f) -> f32 {
  let density = settings.x;
  let width = settings.y;
  let variation = settings.z;
  let motion = settings.w;
  let along = dot(r.local, r.tangent);
  let across = dot(r.local, vec2f(-r.tangent.y, r.tangent.x));
  let identity = vec2f(r.identity, r.parent);
  let offset = vec2f(
    (loHash(identity + 103.0) - 0.5) * 0.42,
    (loHash(identity + 211.0) - 0.5) * 0.34,
  );
  let q = vec2f(along, across) - offset;
  let angle = atan2(q.y, q.x);
  let stretch = vec2f(0.82 + loHash(identity + 17.0) * 0.52,
    0.70 + loHash(identity + 29.0) * 0.42);
  let radius = length(q / stretch);
  let lobes = 2.0 + floor(loHash(identity + 37.0) * 3.0);
  let waviness = sin(angle * lobes + identity.x * 0.17) * (0.040 + variation * 0.085)
    + sin(angle * (lobes + 2.0) - t * motion * 0.07) * 0.018;
  let contourRadius = radius + waviness;
  let spacing = mix(0.29, 0.105, clamp(density * 0.55, 0.0, 1.0));
  let phase = contourRadius / spacing + loHash(identity + 61.0) * 0.42;
  let contour = abs(fract(phase + 0.5) - 0.5) * spacing;
  let aa = max(fwidth(contourRadius), 0.0010);
  let lineWidth = max(0.0052 * width, aa * (1.10 + width * 0.78));
  let line = loLineCoverage(contour, lineWidth, aa);
  let taper = smoothstep(0.04, 0.24, r.edge) * (1.0 - smoothstep(1.15, 1.75, contourRadius));
  return line * taper;
}
`;
