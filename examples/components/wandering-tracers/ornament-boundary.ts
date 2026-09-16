// The Ornament renderer supplies LoRegion and a visible ownership distance in
// r.edge. This helper deliberately never reconstructs primitive boundaries.
export const ornamentBoundaryFragments = Object.freeze({
  helpers: `fn loFinish(color: vec3f, r: LoRegion, p: vec2f, ink: vec4f) -> vec3f {
  let edgeAA = max(fwidth(r.edge), 0.00012);
  let edgePressure = 0.72 + 0.42 * loNoise(r.local * 8.0 + vec2f(r.identity, r.parent))
    + ink.z * 0.12 * sin(dot(r.local, r.tangent) * 34.0 + r.identity * 13.0);
  let width = ink.x * edgePressure;
  let boundary = 1.0 - smoothstep(width - edgeAA, width + edgeAA, r.edge);
  let nearBlack = vec3f(0.040, 0.027, 0.027);
  let teal = vec3f(0.045, 0.34, 0.35);
  let violet = vec3f(0.25, 0.12, 0.38);
  let secondaryTone = mix(teal, violet, loHash(vec2f(r.identity, r.parent) + 29.0));
  let secondaryWidth = width * (1.12 + ink.y * 0.38);
  let secondary = (1.0 - smoothstep(secondaryWidth - edgeAA, secondaryWidth + edgeAA, r.edge))
    * (1.0 - boundary) * ink.y * 0.17;
  var finished = mix(color, secondaryTone, secondary);
  finished = mix(finished, nearBlack, boundary * (0.84 + 0.16 * ink.z));
  let paper = loNoise(floor(p * vec2f(1560.0, 980.0))) - 0.5;
  let fibers = loNoise(p * 96.0 + r.tangent * 7.0) - 0.5;
  let grainStrength = clamp(ink.w, 0.0, 2.0);
  finished += (paper * 0.017 + fibers * 0.023) * grainStrength;
  return clamp(finished, vec3f(0.0), vec3f(1.0));
}
`,
});
