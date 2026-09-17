// Dedicated hummingbird anatomy and feather material. The view is orthographic,
// so ellipsoid/feather normals supply the local 3D relief on this small sprite.
// Interference color follows the light/view angle and feather orientation;
// it is not an RGB animation driven by time.
export const hummingbirdShader = `
// Straight-alpha source-over, including partially covered feather edges.
fn loHumOver(base: vec4f, rgb: vec3f, mask: f32) -> vec4f {
  let a = mask + base.a * (1.0 - mask);
  return vec4f((rgb * mask + base.rgb * base.a * (1.0 - mask)) / max(a, 0.00001), a);
}
fn loHumFeather(p: vec2f, a: vec2f, b: vec2f, width: f32) -> vec3f {
  let axis = b - a;
  let len = max(length(axis), 0.0001);
  let along = clamp(dot(p - a, axis) / (len * len), 0.0, 1.0);
  let across = dot(p - a, vec2f(-axis.y, axis.x) / len);
  let radius = width * pow(max(sin(along * 3.141593), 0.0), 0.65);
  let distance = length(p - a - axis * along) - radius;
  return vec3f(distance, along, across / max(width, 0.0001));
}

fn loHumWing(p: vec2f, phase: f32, rest: f32, side: f32) -> vec4f {
  var feather = vec4f(1.0, 0.0, 0.0, 0.0);
  let sweep = sin(phase) * 0.024;
  let lift = 0.79 + cos(phase) * 0.21;
  for (var i = 0; i < 8; i++) {
    let t = f32(i) / 7.0;
    let root = vec2f(0.006 - t * 0.012, side * 0.004);
    let flyingTip = vec2f(mix(-0.015, -0.047, t) + sweep * (1.0 - t * 0.45), side * mix(0.074, 0.032, t) * lift);
    let foldedTip = vec2f(-0.030 + t * 0.008, -0.003 - t * 0.007);
    let tip = mix(flyingTip, foldedTip, rest);
    let f = loHumFeather(p, root, tip, mix(0.0075, 0.0060, t) * mix(1.0, 0.72, rest));
    if (f.x < feather.x) { feather = vec4f(f, f32(i)); }
  }
  return feather;
}

fn loHumOpal(normal: vec3f, axis: vec3f, thickness: f32, pigment: vec3f, roughness: f32) -> vec3f {
  let light = normalize(vec3f(-0.32, 0.62, 0.83));
  let eye = vec3f(0.0, 0.0, 1.0);
  let halfVector = normalize(light + eye);
  let n = normalize(normal);
  let angle = clamp(dot(n, halfVector), 0.0, 1.0);
  // Three visible wavelengths approximate a thin layered feather reflector.
  let transmittedCosine = sqrt(max(0.0, 1.0 - (1.0 - angle * angle) / (1.38 * 1.38)));
  let interference = 0.5 + 0.5 * cos(12.566371 * 1.38 * thickness * transmittedCosine / vec3f(650.0, 510.0, 440.0));
  let diffuse = 0.22 + 0.60 * max(dot(n, light), 0.0);
  let glint = pow(angle, mix(55.0, 12.0, roughness));
  let tangent = normalize(axis);
  let anisotropic = pow(max(0.0, 1.0 - abs(dot(tangent, halfVector))), 8.0);
  let fresnel = 0.08 + 0.50 * pow(1.0 - max(dot(n, eye), 0.0), 3.0);
  let jewel = interference * interference;
  return pigment * diffuse + jewel * (0.10 + glint * 0.50 + fresnel * 0.25)
    + vec3f(0.75, 0.91, 0.89) * glint * anisotropic * 0.30;
}

fn loHumWingColor(feather: vec4f, phase: f32, bank: f32, side: f32, palette: f32) -> vec3f {
  let ridge = sqrt(max(0.0, 1.0 - min(feather.z * feather.z, 1.0)));
  let normal = normalize(vec3f(feather.z * 0.52, side * (0.18 + sin(phase) * 0.24 + bank * 0.25), 0.62 + ridge * 0.30));
  let thickness = 320.0 + feather.w * 3.0 + feather.y * 20.0 + palette * 12.0;
  var color = loHumOpal(normal, vec3f(-0.48, side * 0.84, 0.1), thickness, vec3f(0.12, 0.20, 0.26), 0.34);
  let barbs = 0.5 + 0.5 * sin(feather.y * 140.0 + abs(feather.z) * 12.0);
  let resolution = 1.0 - smoothstep(0.12, 0.40, fwidth(feather.y) * 10.0);
  color *= 0.82 + 0.18 * mix(1.0, barbs, resolution);
  color += vec3f(0.12, 0.17, 0.16) * (1.0 - smoothstep(0.035, 0.10, abs(feather.z)));
  return color;
}

fn loHummingbird(p: vec2f, time: f32, bank: f32, rest: f32, idle: f32, identity: f32, palette: f32) -> vec4f {
  let phase = time * 47.0 + identity * 2.7;
  let preen = select(0.0, rest * (0.5 + 0.5 * sin(time * 3.0)), idle > 0.5 && idle < 1.5);
  let headCenter = vec2f(0.014 - preen * 0.006, 0.014 - preen * 0.004);
  let bodyPoint = loRotate(p - vec2f(-0.005, -0.001), 0.24);
  let bodySdf = loEllipse(bodyPoint, vec2f(0.023, 0.0118));
  let headSdf = length(p - headCenter) - 0.0087;
  let neckSdf = loEllipse(p - vec2f(0.008, 0.007), vec2f(0.009, 0.009));
  let body = min(bodySdf, min(headSdf, neckSdf));
  let nearWing = loHumWing(p, phase, rest, 1.0);
  let farWing = loHumWing(p, phase + 0.75, rest, -0.82);
  let billStart = headCenter + vec2f(0.006, 0.001);
  let billEnd = billStart + vec2f(0.036, 0.0008);
  let billAxis = billEnd - billStart;
  let billAlong = clamp(dot(p - billStart, billAxis) / dot(billAxis, billAxis), 0.0, 1.0);
  let bill = length(p - mix(billStart, billEnd, billAlong)) - mix(0.0016, 0.00035, billAlong);
  var tail = 1.0;
  for (var i = 0; i < 5; i++) {
    let t = f32(i) / 4.0;
    tail = min(tail, loHumFeather(p, vec2f(-0.019, -0.004), vec2f(-0.042 + abs(t - 0.5) * 0.008, -0.011 + t * 0.013), 0.0028).x);
  }
  let reach = smoothstep(0.1, 0.9, rest);
  let feet = min(loCapsule(p, vec2f(-0.005, -0.007), vec2f(-0.010, -0.023), 0.00085),
    loCapsule(p, vec2f(0.004, -0.007), vec2f(0.002, -0.023), 0.00085));
  let aa = max(fwidth(body), 0.00030);
  var alpha = 0.0;
  var color = vec3f(0.0);
  // Two exposure samples make fast wings read as a soft fan instead of a
  // triangle snapping between distant poses at the display frame rate.
  if (rest < 0.98) {
    let ghostA = loHumWing(p, phase - 1.0, rest, 1.0);
    let ghostB = loHumWing(p, phase + 1.0, rest, 1.0);
    let ghost = (1.0 - smoothstep(-aa, aa, min(ghostA.x, ghostB.x))) * 0.17 * (1.0 - rest);
    color = vec3f(0.53, 0.72, 0.78);
    alpha = ghost;
  }
  let farMask = (1.0 - smoothstep(-aa, aa, farWing.x)) * mix(0.66, 1.0, rest);
  let layer1 = loHumOver(vec4f(color, alpha), loHumWingColor(farWing, phase + 0.75, bank, -0.82, palette) * 0.80, farMask);
  color = layer1.rgb;
  alpha = layer1.a;
  let tailMask = 1.0 - smoothstep(-aa, aa, tail);
  let layer2 = loHumOver(vec4f(color, alpha), loHumOpal(normalize(vec3f(0.2, bank * 0.35, 1.0)), vec3f(1.0, 0.0, 0.0), 360.0, vec3f(0.015, 0.06, 0.055), 0.5), tailMask);
  color = layer2.rgb;
  alpha = layer2.a;
  let bodyMask = 1.0 - smoothstep(-aa, aa, body);
  let ellipsoid = clamp(bodyPoint / vec2f(0.025, 0.015), vec2f(-0.98), vec2f(0.98));
  let row = floor((p.y + 0.04) / 0.0025);
  let cell = fract(vec2f(p.x / 0.0030 + row * 0.5, (p.y + 0.04) / 0.0025)) - 0.5;
  let featherRelief = sin(cell.x * 6.283185) * 0.05;
  let normal = normalize(vec3f(ellipsoid.x * 0.24 + featherRelief, ellipsoid.y * 0.65 + bank * 0.23, sqrt(max(0.06, 1.0 - dot(ellipsoid, ellipsoid) * 0.48))));
  let featherEdge = smoothstep(0.32, 0.49, length(vec2f(cell.x * 0.75, cell.y)));
  let microVisibility = 1.0 - smoothstep(0.0016, 0.0045, fwidth(p.x) + fwidth(p.y));
  var bodyColor = loHumOpal(normal, vec3f(0.92, 0.28, 0.1), 360.0 + cell.y * 8.0 + palette * 10.0, vec3f(0.02, 0.38, 0.18), 0.35);
  bodyColor *= 1.0 - featherEdge * 0.12 * microVisibility;
  let belly = 1.0 - smoothstep(-0.002, 0.002, loEllipse(p - vec2f(-0.002, -0.009), vec2f(0.012, 0.0048)));
  bodyColor = mix(bodyColor, vec3f(0.49, 0.64, 0.54) * (0.55 + normal.z * 0.35), belly * 0.6);
  let throat = 1.0 - smoothstep(-0.001, 0.001, loEllipse(p - headCenter - vec2f(0.002, -0.008), vec2f(0.006, 0.007)));
  let gorget = loHumOpal(normalize(normal + vec3f(0.20, -0.12, 0.0)), vec3f(0.1, 1.0, 0.0), 445.0 + cell.y * 10.0, vec3f(0.25, 0.015, 0.11), 0.18);
  bodyColor = mix(bodyColor, gorget, throat);
  let layer3 = loHumOver(vec4f(color, alpha), bodyColor, bodyMask);
  color = layer3.rgb;
  alpha = layer3.a;
  let nearMask = 1.0 - smoothstep(-aa, aa, nearWing.x);
  let shoulderCover = 1.0 - smoothstep(-0.002, 0.002, loEllipse(p - vec2f(0.003, 0.004), vec2f(0.010, 0.006)));
  let wingLayer = loHumOver(vec4f(color, alpha), loHumWingColor(nearWing, phase, bank, 1.0, palette), nearMask * (1.0 - shoulderCover * 0.82));
  color = wingLayer.rgb;
  alpha = wingLayer.a;
  let billMask = 1.0 - smoothstep(-aa, aa, bill);
  let layer4 = loHumOver(vec4f(color, alpha), vec3f(0.015, 0.025, 0.029), billMask);
  color = layer4.rgb;
  alpha = layer4.a;
  let footMask = (1.0 - smoothstep(-aa, aa, feet)) * reach;
  let layer5 = loHumOver(vec4f(color, alpha), vec3f(0.12, 0.10, 0.13), footMask);
  color = layer5.rgb;
  alpha = layer5.a;
  let eyeCenter = headCenter + vec2f(0.0030, 0.0014);
  let eyeRing = 1.0 - smoothstep(0.0022, 0.0027, length(p - eyeCenter));
  let eye = 1.0 - smoothstep(0.0015, 0.0020, length(p - eyeCenter));
  color = mix(color, vec3f(0.64, 0.75, 0.62), eyeRing * bodyMask);
  color = mix(color, vec3f(0.004, 0.009, 0.012), eye * bodyMask);
  let catchlight = 1.0 - smoothstep(0.0004, 0.0008, length(p - eyeCenter - vec2f(-0.0005, 0.0006)));
  color = mix(color, vec3f(0.95, 1.0, 0.93), catchlight * bodyMask);
  return vec4f(max(color, vec3f(0.0)), alpha);
}
`;
