// Shared LoRegion, loHash and loNoise are supplied by the ornament consumer.
// This fragment preserves the prototype hatching math verbatim.
export const ornamentHatchingFragments = Object.freeze({
  helpers: `
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
`,
});
