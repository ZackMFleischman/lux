import { wgslFn } from 'three/tsl';

// UV.x is cumulative arc distance, UV.y spans the strip. Style: 0 neon,
// 1 broad opaque ribbon, 2 stylized glass. No physical transmission or bloom pass.
export const strandShader = wgslFn(`
fn fiberStrand(st: vec2f, paint: vec4f, pulse: vec4f, appearance: vec4f) -> vec4f {
  let across = st.y * 2.0 - 1.0;
  let edge = abs(across);
  let aa = max(fwidth(across), 0.002);
  let coverage = 1.0 - smoothstep(1.0 - aa, 1.0, edge);
  let tint = mix(vec3f(0.01, 0.85, 0.63), vec3f(0.95, 0.015, 0.40), paint.x);
  let along = fract(st.x / max(appearance.z, 0.001) - pulse.x * pulse.y + paint.z);
  let packetDistance = min(along, 1.0 - along);
  let packet = exp(-pow(packetDistance / max(pulse.z, 0.005), 2.0));
  let light = 1.0 + packet * pulse.w;
  let core = exp(-across * across * 350.0);
  let halo = exp(-across * across * 7.0);
  var color = tint * paint.y * light;
  var alpha = (core + halo * 0.16) * coverage;
  if (appearance.x > 0.5) {
    let rim = exp(-pow((edge - 0.86) / 0.07, 2.0));
    let shine = pow(max(0.0, 1.0 - abs(across + 0.30)), 14.0);
    let twist = 0.6 + 0.4 * sin(st.x * 6.0 + paint.z * 6.28318 + pulse.x * 0.14);
    let stripes = pow(0.5 + 0.5 * cos(across * 44.0), 12.0);
    color = vec3f(0.003, 0.009, 0.028) + tint * (0.025 + rim * 0.35 + shine * twist * 0.6);
    color += tint * packet * pulse.w * stripes * 0.18;
    alpha = coverage * 0.98;
    if (appearance.x > 1.5) {
      color += tint * stripes * 0.12 + vec3f(0.35, 0.53, 0.48) * shine;
      alpha = coverage * (0.22 + rim * 0.65 + shine * 0.35);
    }
    color *= paint.y;
  }
  return vec4f(color, clamp(alpha * appearance.y, 0.0, 1.0));
}
`);

export const collarShader = wgslFn(`
fn fiberCollar(st: vec2f) -> vec4f {
  let side = abs(st.y * 2.0 - 1.0);
  let band = 1.0 - smoothstep(0.78, 1.0, side);
  let rim = smoothstep(0.78, 0.93, abs(st.x * 2.0 - 1.0));
  let shine = exp(-pow((st.y - 0.68) * 12.0, 2.0));
  let color = vec3f(0.015, 0.027, 0.045) + vec3f(0.35, 0.48, 0.42) * shine
    + vec3f(0.75, 0.59, 0.25) * rim * 0.7;
  return vec4f(color, band);
}
`);
