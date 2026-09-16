// The Ornament renderer supplies LoRegion plus the shared phrasing helpers.
// This field keeps color attached to an owning lobe/corridor instead of using
// a screen-space palette wash that would cross the visible boundaries.
export const ornamentWatercolorFragments = Object.freeze({
  helpers: `fn loWash(r: LoRegion, p: vec2f, t: f32, pigment: vec4f, material: vec4f) -> vec3f {
  let along = dot(r.local, r.tangent);
  let across = dot(r.local, vec2f(-r.tangent.y, r.tangent.x));
  let phraseOwner = select(r.identity, r.parent, r.parent > 0.0);
  let phrase = loPhrase(vec2f(phraseOwner * 0.17, 0.0), t - 5.0);
  let phraseStrength = clamp(material.w, 0.0, 1.5);
  let softGradient = 0.5 + 0.5 * tanh(along * 1.35 + across * 0.42
    + (loNoise(r.local * 2.6 + vec2f(r.identity, r.parent) * 0.17) - 0.5) * 0.58);
  let yellow = mix(vec3f(0.90, 0.62, 0.11), vec3f(1.0, 0.80, 0.29), softGradient);
  let ivory = mix(vec3f(0.88, 0.84, 0.73), vec3f(0.98, 0.94, 0.84), softGradient);
  let blush = mix(vec3f(0.86, 0.54, 0.58), vec3f(0.98, 0.72, 0.70), softGradient);
  let teal = mix(vec3f(0.08, 0.40, 0.42), vec3f(0.20, 0.63, 0.58), softGradient);
  let violet = mix(vec3f(0.20, 0.16, 0.38), vec3f(0.43, 0.31, 0.62), softGradient);
  let nearBlack = mix(vec3f(0.025, 0.030, 0.047), vec3f(0.075, 0.052, 0.105), softGradient);
  // Stable assignments alternate neighboring owners. Nested islands contrast
  // with their parents, while three deliberately quiet regions remain ivory.
  let id = i32(abs(floor(r.identity + 0.5)));
  let quietFamily = id == 101 || id == 113 || id == 116;
  let yellowFamily = id == 102 || id == 106 || id == 111 || id == 114 || id == 118;
  let blushFamily = id == 104 || id == 108;
  let tealFamily = id == 103 || id == 107 || id == 110 || id == 117;
  let violetFamily = id == 105 || id == 112 || id == 119;
  let darkFamily = id == 109 || id == 115;
  var color = ivory;
  if (yellowFamily) {
    color = yellow;
  } else if (blushFamily) {
    color = blush;
  } else if (violetFamily) {
    color = violet;
  } else if (tealFamily) {
    color = teal;
  } else if (darkFamily) {
    color = nearBlack;
  }

  // Each owner receives a permanent delay. A slow attached wave crosses the
  // region over tens of seconds, producing warm blooms without family changes.
  let warmth = clamp(pigment.y * 0.5, 0.0, 1.0);
  let regionDelay = loHash(vec2f(r.identity * 0.193, r.parent + 37.1)) * 6.2831853;
  let migrating = 0.5 + 0.5 * sin(t * 0.12 - regionDelay + along * 1.05 + across * 0.32);
  let phraseEnvelope = mix(0.58, phrase, min(phraseStrength, 1.0));
  let warmBloom = smoothstep(0.16, 0.86, migrating) * (0.42 + phraseEnvelope * 0.58);
  let activeWeight = select(1.0, 0.16, quietFamily) * select(1.0, 0.42, darkFamily);
  let warmMass = mix(blush, yellow, 0.18 + 0.18 * phraseEnvelope);
  let warmWeight = (0.035 + warmth * 0.20) * warmBloom * activeWeight * phraseStrength;
  color = mix(color, warmMass, warmWeight);
  color = mix(color, ivory, select(0.0, 0.12 + material.z * 0.08, quietFamily));
  let paletteShift = clamp(pigment.x, -1.0, 1.0);
  let coolPalette = mix(teal, violet, 0.46 + 0.08 * warmBloom);
  let warmPalette = mix(yellow, blush, 0.42 + 0.12 * warmBloom);
  color = mix(color, select(coolPalette, warmPalette, paletteShift >= 0.0), abs(paletteShift) * 0.10);
  let localEvolution = (warmBloom - 0.5) * 0.075 * phraseStrength * select(1.0, 0.25, quietFamily);
  color *= 1.0 + localEvolution;
  let poolingStrength = clamp(pigment.w * 0.5, 0.0, 1.0);
  let pooledEdge = exp(-r.edge * mix(72.0, 26.0, poolingStrength)) * poolingStrength;
  color = mix(color, color * (0.70 + 0.10 * warmth), pooledEdge * 0.16);
  color = mix(color, color * 1.06, pooledEdge * 0.06);
  let contrast = clamp(pigment.z * 0.5, 0.0, 1.0);
  color = mix(vec3f(0.5), color, 0.80 + contrast * 0.35);
  let pigmentGrain = loNoise(p * 74.0 + vec2f(r.identity, r.parent) * 9.1) - 0.5;
  let bloom = loFbm(r.local * 4.2 + vec2f(t * 0.006, -t * 0.004) + vec2f(regionDelay)) - 0.5;
  color += (pigmentGrain * 0.045 + bloom * 0.070 * material.x * (0.7 + warmBloom * 0.3)) * material.y;
  color = mix(vec3f(0.5), color, material.y);
  return clamp(color, vec3f(0.0), vec3f(1.0));
}
`,
});
