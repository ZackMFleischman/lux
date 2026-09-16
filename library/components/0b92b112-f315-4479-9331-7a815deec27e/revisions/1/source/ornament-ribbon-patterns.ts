// Shared LoRegion, loHash and loNoise come from the ornament geometry/phrasing
// fields. settings = (density, width, variation, motion); defaults (1,1,.7,.2).
// Coverage is independent of pigment, so the consumer can draw light or dark ink.
export const ornamentRibbonPatternHelpers = `
fn loRibbonMarks(r: LoRegion, p: vec2f, t: f32, settings: vec4f) -> f32 {
  let density = max(settings.x, 0.08);
  let width = clamp(settings.y, 0.1, 3.0);
  let variety = clamp(settings.z, 0.0, 1.5);
  let identity = vec2f(r.identity * 1.731, r.parent * 0.913 + 23.7);
  let family = loHash(identity + 41.3);
  let character = loHash(identity + 83.1);
  let axis = normalize(r.tangent + vec2f(0.00001, 0.0));
  let side = vec2f(-axis.y, axis.x);
  let along = dot(r.local, axis);
  let across = dot(r.local, side);
  let sway = settings.w * 0.018 * sin(t * 0.17 + character * 6.28318);
  let bend = variety * 0.025 * sin(along * 3.4 + character * 8.0 + sway);
  let laneWidth = mix(0.13, 0.22, character) / sqrt(density);
  let transverse = (across + bend) / laneWidth;
  let spacing = mix(0.085, 0.14, loHash(identity + 107.0)) / density;
  let phase = along / spacing + character * 7.0;
  let rungId = floor(phase + 0.5);
  let jitter = (loHash(vec2f(rungId, r.identity + 11.0)) - 0.5) * 0.13 * variety;
  let rungDistance = abs(fract(phase + jitter + 0.5) - 0.5);
  let rungAA = max(fwidth(phase), 0.006);
  let transverseAA = max(fwidth(transverse), 0.006);

  // A long ladder follows the shape: two calm rails and individual crossbars.
  let band = 1.0 - smoothstep(0.84, 0.84 + transverseAA, abs(transverse));
  let railDistance = abs(abs(transverse) - 0.80);
  let rails = 1.0 - smoothstep(0.028 * width, 0.028 * width + transverseAA, railDistance);
  let rungs = (1.0 - smoothstep(0.048 * width, 0.048 * width + rungAA, rungDistance)) * band;
  let ladder = 1.0 - (1.0 - rails) * (1.0 - rungs);

  // Alternating bead sizes make a necklace rather than a uniform dotted line.
  let beadSize = 0.23 + 0.07 * loHash(vec2f(rungId + 67.0, r.identity));
  let beadPoint = vec2f((fract(phase + jitter + 0.5) - 0.5), transverse * 0.56);
  let beadDistance = length(beadPoint);
  let beadAA = max(fwidth(beadDistance), 0.008);
  let pearl = 1.0 - smoothstep(beadSize * sqrt(width), beadSize * sqrt(width) + beadAA, beadDistance);
  let beadRim = 1.0 - smoothstep(0.032 * width, 0.032 * width + beadAA, abs(beadDistance - beadSize));
  let beads = mix(pearl, beadRim, step(0.58, character));

  // The third family is a broad ribbon of closely spaced transverse bands.
  let ribbonBand = 1.0 - smoothstep(0.91, 0.91 + transverseAA, abs(transverse));
  let stripes = (1.0 - smoothstep(0.15 * width, 0.15 * width + rungAA, rungDistance)) * ribbonBand;
  let pattern = mix(mix(ladder, beads, step(0.36, family)), stripes, step(0.73, family));
  let boundaryAA = max(fwidth(r.edge), 0.0004);
  let inset = smoothstep(0.006, 0.018 + boundaryAA, r.edge);
  return clamp(pattern * inset, 0.0, 1.0);
}

fn loHatchMarks(r: LoRegion, p: vec2f, t: f32, settings: vec4f) -> f32 {
  let density = max(settings.x, 0.08);
  let width = clamp(settings.y, 0.1, 3.0);
  let variety = clamp(settings.z, 0.0, 1.5);
  let identity = vec2f(r.identity * 1.317 + 71.0, r.parent * 0.739 + 19.0);
  let angle = (loHash(identity) - 0.5) * 2.8 * variety;
  let flow = normalize(r.tangent + vec2f(0.00001, 0.0));
  let axis = vec2f(flow.x * cos(angle) - flow.y * sin(angle), flow.x * sin(angle) + flow.y * cos(angle));
  let along = dot(r.local, axis);
  let across = dot(r.local, vec2f(-axis.y, axis.x));
  let character = loHash(identity + 43.7);
  let drift = settings.w * 0.12 * sin(t * 0.15 + character * 6.28318);
  let bend = variety * (0.022 * sin(along * (3.0 + character * 2.0) + character * 9.0 + drift)
    + 0.014 * (loNoise(vec2f(along * 5.0, character * 17.0)) - 0.5));
  let spacing = mix(0.027, 0.067, loHash(identity + 103.0)) / density;
  let phase = (across + bend) / spacing;
  let lineId = floor(phase + 0.5);
  let jitter = (loHash(vec2f(lineId, r.identity + 149.0)) - 0.5) * 0.12 * variety;
  let distance = abs(fract(phase + jitter + 0.5) - 0.5);
  let aa = max(fwidth(phase), 0.006);
  let pressure = 0.83 + 0.28 * loNoise(vec2f(along * 8.0, lineId * 1.7 + character * 3.0));
  let strokeWidth = min(0.23, 0.035 * width * pressure + aa * 0.35);
  let stroke = 1.0 - smoothstep(strokeWidth, strokeWidth + aa, distance);

  let crossPhase = (along + variety * 0.012 * sin(across * 5.0 + character * 7.0 + drift)) / (spacing * 1.43);
  let crossDistance = abs(fract(crossPhase + 0.5) - 0.5);
  let crossAA = max(fwidth(crossPhase), 0.006);
  let crossStroke = 1.0 - smoothstep(strokeWidth * 0.76, strokeWidth * 0.76 + crossAA, crossDistance);
  let crossFamily = step(0.77, loHash(identity + 211.0));
  let drawing = 1.0 - (1.0 - stroke) * (1.0 - crossStroke * crossFamily * 0.74);
  let boundaryAA = max(fwidth(r.edge), 0.0004);
  let inset = smoothstep(0.009, 0.022 + boundaryAA, r.edge);
  return clamp(drawing * inset, 0.0, 1.0);
}
`;
