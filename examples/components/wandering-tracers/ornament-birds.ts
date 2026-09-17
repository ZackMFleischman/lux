import { hummingbirdShader } from './ornament-hummingbird.ts';
import { createBirdSocial } from './ornament-bird-social.ts';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector4 } from 'three/webgpu';
import { positionLocal, uniform, uv, wgslFn } from 'three/tsl';

// A small patch per bird: path and perch queries run over these patches rather
// than the full canvas. Coordinates share the painting's actual region helpers.
const birdHelpers = `
struct LoBirdPose {
  center: vec3f,
  heading: f32,
  rest: f32,
  bank: f32,
}

fn loBirdRoute(s: f32, route: f32, view: vec4f, shape: vec4f, detail: vec4f) -> vec2f {
  let angle = select(-0.06, 0.82, route > 0.5);
  let amplitude = select(0.16 + shape.y * 0.035, 0.13 + shape.y * 0.04, route > 0.5);
  let frequency = select(2.05, 2.55, route > 0.5);
  let phase = loHash(vec2f(select(99.0, 110.0, route > 0.5), view.z + 73.0)) * 6.283185
    + select(0.0, 1.7, route > 0.5) + view.x * detail.y * 0.10;
  let y = select(-0.05, 0.0, route > 0.5) + amplitude * sin(s * frequency + phase)
    + amplitude * 0.28 * sin(s * frequency * 2.17 - phase * 0.63);
  return loUnrotate(vec2f(s, y), angle) + vec2f(select(0.0, 0.1, route > 0.5), 0.0);
}

fn loBirdPose(index: f32, view: vec4f, shape: vec4f, detail: vec4f, settings: vec4f, motion: vec4f, social: vec4f, mood: vec4f) -> LoBirdPose {
  let route = select(0.0, 1.0, index > 1.5);
  let member = index - route * 2.0;
  let time = settings.y;
  // Companions share forward travel, with a tiny breathing offset.
  let cycle = fract(time / 48.0 + route * 0.43);
  let extent = select(view.y + 0.30, 1.85, route > 0.5);
  let lead = mix(-extent, extent, cycle);
  let s = lead + sin(time * 0.3 + member * 2.1) * 0.008 + (member - select(0.5, 1.0, route > 0.5)) * 0.12 * (1.0 - smoothstep(0.0, 0.8, settings.z));
  let centerline = loBirdRoute(s, route, view, shape, detail);
  let tangent = normalize(loBirdRoute(s + 0.01, route, view, shape, detail) - centerline);
  let normal = vec2f(-tangent.y, tangent.x);
  let orbit = motion.x + member * 6.283185 / select(2.0, 3.0, route > 0.5) + route * 2.1;
  let radius = settings.z * 0.105;
  var position = vec3f(centerline + normal * cos(orbit) * radius, sin(orbit) * radius);
  var heading = atan2(tangent.y, tangent.x) + sin(orbit) * 0.32;
  var rest = 0.0;
  let excursion = social.x;
  if (excursion > 0.0) {
    let owner = i32(social.z);
    let anchor = loRegionCenter(owner, view.x, view.z, detail.y);
    var perch = anchor + vec2f(social.w, shape.x * 0.82);
    for (var step = 0; step < 12; step++) {
      let noise = loFbm(perch * (1.35 + shape.y * 0.38) + vec2f(view.z * 0.071, -view.z * 0.043)) - 0.5;
      let distance = loShapeSdf(owner, perch, view.x, view.z, shape, detail, noise);
      perch.y -= clamp(distance * 0.8, -0.025, 0.12);
    }
    rest = social.y;
    position = mix(position, vec3f(perch + vec2f(0.0, 0.024 * settings.x), 0.04), excursion);
    position.y += sin(excursion * 3.141593) * 0.18;
    let idle = mood.y;
    let hop = pow(max(0.0, sin(motion.z * 5.0 + index)), 8.0) * 0.016;
    position.y += select(0.0, hop, idle > 4.5) * rest;
    heading = select(0.10, 3.041593, mood.x < -0.1);
    heading += sin(motion.z * 2.2 + index) * select(0.03, 0.15, idle > 1.5 && idle < 2.5) * rest;
  }
  return LoBirdPose(position, heading, rest, sin(orbit) * (1.0 - rest));
}

fn loBirdTriangle(p: vec2f, a: vec2f, b: vec2f, c: vec2f) -> f32 {
  let ab = b - a; let bc = c - b; let ca = a - c;
  let pa = p - a; let pb = p - b; let pc = p - c;
  let da = pa - ab * clamp(dot(pa, ab) / dot(ab, ab), 0.0, 1.0);
  let db = pb - bc * clamp(dot(pb, bc) / dot(bc, bc), 0.0, 1.0);
  let dc = pc - ca * clamp(dot(pc, ca) / dot(ca, ca), 0.0, 1.0);
  let side = sign(ab.x * ca.y - ab.y * ca.x);
  let d = min(min(vec2f(dot(da, da), side * (pa.x * ab.y - pa.y * ab.x)),
    vec2f(dot(db, db), side * (pb.x * bc.y - pb.y * bc.x))),
    vec2f(dot(dc, dc), side * (pc.x * ca.y - pc.y * ca.x)));
  return -sqrt(d.x) * sign(d.y);
}
`;

const vertex = `
fn loBirdVertex(local: vec3f, index: f32, view: vec4f, shape: vec4f, detail: vec4f, settings: vec4f, motion: vec4f, social: vec4f, mood: vec4f) -> vec3f {
  let pose = loBirdPose(index, view, shape, detail, settings, motion, social, mood);
  let scale = settings.x * clamp(1.0 + pose.center.z * 0.55, 0.65, 1.5);
  let point = pose.center.xy + local.xy * scale;
  return vec3f(point.x / view.y, point.y, 0.0);
}
`;

const fragment = `
fn loBirdInk(st: vec2f, index: f32, view: vec4f, shape: vec4f, detail: vec4f, settings: vec4f, motion: vec4f, style: vec4f, social: vec4f, mood: vec4f, rates: vec4f) -> vec4f {
  let pose = loBirdPose(index, view, shape, detail, settings, motion, social, mood);
  let scale = settings.x * clamp(1.0 + pose.center.z * 0.55, 0.65, 1.5);
  let offset = (st - 0.5) * 0.40;
  let world = pose.center.xy + offset * scale;
  // Follow actual travel as before. A short forward sample avoids numerical
  // noise, while shortest-angle blending only settles into the perch heading.
  let look = 0.045;
  let nextSettings = vec4f(settings.x, settings.y + look * rates.z, settings.zw);
  let nextMotion = vec4f(motion.x + look * rates.z * 0.86 / max(0.15, rates.w), motion.y, motion.z + look, motion.w);
  let nextSocial = vec4f(clamp(social.x + look * rates.x, 0.0, 1.0), clamp(social.y + look * rates.y, 0.0, 1.0), social.zw);
  let nextPose = loBirdPose(index, vec4f(view.x + look, view.yzw), shape, detail, nextSettings, nextMotion, nextSocial, mood);
  let velocity = nextPose.center.xy - pose.center.xy;
  var heading = select(pose.heading, atan2(velocity.y, velocity.x), dot(velocity, velocity) > 0.00000001);
  let settle = smoothstep(0.15, 0.85, pose.rest);
  heading += atan2(sin(pose.heading - heading), cos(pose.heading - heading)) * settle;
  let facingLeft = cos(heading) < 0.0;
  let bodyAngle = select(heading, atan2(-sin(heading), -cos(heading)), facingLeft);
  var q = loRotate(offset, bodyAngle);
  q.x *= select(1.0, -1.0, facingLeft);
  let time = motion.z;
  let species = style.x;
  let humming = select(0.0, 1.0, species > 0.5 && species < 1.5);
  let swallow = select(0.0, 1.0, species > 1.5 && species < 2.5);
  let broad = select(0.0, 1.0, species > 2.5);
  let glide = smoothstep(0.20, 0.70, sin(time * 0.73 + index * 1.7));
  let flap = mix(sin(time * mix(9.5 + index * 0.47, 24.0, humming) - index * 2.0), 0.32, glide * 0.74 * (1.0 - humming));
  var spread = mix(0.046 + flap * mix(0.022, 0.013, humming) + swallow * 0.009, 0.009, pose.rest);
  if (mood.y > 2.5 && mood.y < 3.5) { spread += pose.rest * 0.028 * (0.5 + 0.5 * sin(time * 2.4)); }
  q.x *= 1.0 + humming * 0.12 - swallow * 0.1;
  let bank = 0.86 + pose.bank * 0.18;
  var body = loEllipse(q, vec2f(0.023, 0.010 + broad * 0.004));
  let preen = select(0.0, pose.rest * (0.5 + 0.5 * sin(time * 3.0)), mood.y > 0.5 && mood.y < 1.5);
  let headCenter = vec2f(0.020 - preen * 0.012, 0.007 - preen * 0.007 + pose.rest * sin(time * 2.2) * 0.002);
  let head = length(q - headCenter) - 0.010;
  body = min(body, head);
  var tail = loBirdTriangle(q, vec2f(-0.013, 0.0), vec2f(-0.041, 0.011), vec2f(-0.034, -0.010));
  if (swallow > 0.5) {
    tail = min(loBirdTriangle(q, vec2f(-0.012, 0.0), vec2f(-0.057, 0.019), vec2f(-0.031, 0.0)),
      loBirdTriangle(q, vec2f(-0.012, 0.0), vec2f(-0.052, -0.018), vec2f(-0.031, 0.0)));
  }
  let topWing = loBirdTriangle(q, vec2f(0.012, 0.004), vec2f(-0.023 - broad * 0.012, 0.009), vec2f(-0.025 + flap * 0.005 + humming * 0.024, spread * bank));
  let bottomWing = loBirdTriangle(q, vec2f(0.009, -0.003), vec2f(-0.022, -0.006), vec2f(-0.027 + humming * 0.02, -spread / bank));
  let beak = loBirdTriangle(q, vec2f(0.025, 0.003), vec2f(0.025, 0.011), vec2f(0.041 + humming * 0.027, 0.006));
  var silhouette = min(min(body, tail), min(topWing, bottomWing));
  silhouette = min(silhouette, beak);
  if (pose.rest > 0.01) {
    let reach = smoothstep(0.1, 0.9, pose.rest);
    let feet = min(loCapsule(q, vec2f(-0.004, -0.006), vec2f(-0.004 - 0.006 * reach, -0.006 - 0.015 * reach), 0.0015),
      loCapsule(q, vec2f(0.008, -0.006), vec2f(0.008 + 0.002 * reach, -0.006 - 0.015 * reach), 0.0015));
    silhouette = min(silhouette, feet);
  }
  let aa = max(fwidth(silhouette), 0.0007);
  // Warm paper keyline keeps the small subjects readable on dark motifs.
  let outline = 1.0 - smoothstep(0.002, 0.002 + aa, silhouette);
  let fill = 1.0 - smoothstep(-aa, aa, silhouette);
  var ink = vec3f(0.012, 0.008, 0.035);
  let breast = 1.0 - smoothstep(-0.001, 0.001, loEllipse(q - vec2f(0.007, -0.003), vec2f(0.012, 0.005)));
  let hue = style.y + index * 0.173;
  let accent = 0.50 + 0.44 * cos(6.283185 * (hue + vec3f(0.0, 0.33, 0.67)));
  let wingMask = 1.0 - smoothstep(-aa, aa, min(topWing, bottomWing));
  let iridescence = 0.62 + 0.35 * cos(vec3f(0.1, 2.1, 4.2) + time * 1.8 + q.y * 90.0 + pose.bank * 3.0);
  ink = mix(ink, accent * 0.64, 0.55);
  ink = mix(ink, mix(accent * 0.8, iridescence, humming), wingMask * mix(0.65, 0.94, humming));
  ink = mix(ink, accent, breast * 0.95);
  ink = mix(ink, vec3f(0.95, 0.53, 0.10), 1.0 - smoothstep(-aa, aa, beak));
  var eye = 1.0 - smoothstep(0.0015, 0.0023, length(q - vec2f(0.022, 0.009)));
  if (mood.y > 3.5 && mood.y < 4.5 && pose.rest > 0.5) {
    eye = 1.0 - smoothstep(0.0010, 0.0018, loCapsule(q, vec2f(0.019, 0.009), vec2f(0.024, 0.008), 0.0005));
  }
  ink = mix(ink, vec3f(1.0, 0.93, 0.70), eye);
  var opacity = outline;
  var birdColor = mix(vec3f(0.99, 0.91, 0.68), ink, fill);
  if (humming > 0.5) {
    let hum = loHummingbird(q, time, pose.bank, pose.rest, mood.y, index, style.y);
    birdColor = hum.rgb;
    opacity = hum.a;
  }
  if (pose.center.z < 0.0 && pose.rest < 0.05) {
    let noise = loFbm(world * (1.35 + shape.y * 0.38) + vec2f(view.z * 0.071, -view.z * 0.043)) - 0.5;
    let ribbons = min(loShapeSdf(9, world, view.x, view.z, shape, detail, noise),
      loShapeSdf(10, world, view.x, view.z, shape, detail, noise));
    opacity *= smoothstep(0.006, 0.012, ribbons);
  }
  var color = birdColor;
  if (mood.w > 0.001) {
    let b = offset - vec2f(0.014, 0.110);
    let bubbleSdf = loEllipse(b, vec2f(0.038, 0.030));
    let bubbleMask = (1.0 - smoothstep(-aa, aa, bubbleSdf)) * mood.w;
    let bead = min(length(offset - vec2f(0.014, 0.066)) - 0.006, length(offset - vec2f(0.012, 0.052)) - 0.003);
    var symbol = 1.0;
    var feeling = vec3f(0.17, 0.35, 0.50);
    let emotion = mood.z;
    if (emotion > 2.5 && emotion < 3.5) {
      symbol = min(min(length(b - vec2f(-0.007, 0.007)) - 0.009, length(b - vec2f(0.007, 0.007)) - 0.009), loBirdTriangle(b, vec2f(-0.015, 0.006), vec2f(0.015, 0.006), vec2f(0.0, -0.017)));
      feeling = vec3f(0.88, 0.13, 0.31);
    } else if (emotion > 3.5 && emotion < 4.5) {
      symbol = min(length(b - vec2f(0.0, -0.006)) - 0.009, loBirdTriangle(b, vec2f(-0.008, -0.003), vec2f(0.008, -0.003), vec2f(0.0, 0.017)));
      feeling = vec3f(0.10, 0.44, 0.75);
    } else if (emotion > 4.5 && emotion < 5.5) {
      symbol = min(loCapsule(b, vec2f(-0.019, 0.0), vec2f(0.019, 0.0), 0.002), loCapsule(b, vec2f(0.0, -0.021), vec2f(0.0, 0.021), 0.002));
      symbol = min(symbol, min(loCapsule(b, vec2f(-0.013, -0.013), vec2f(0.013, 0.013), 0.0018), loCapsule(b, vec2f(-0.013, 0.013), vec2f(0.013, -0.013), 0.0018)));
      feeling = vec3f(0.95, 0.53, 0.06);
    } else if (emotion < 1.5 || (emotion > 5.5 && emotion < 6.5)) {
      symbol = min(loEllipse(b, vec2f(0.020, 0.009)), length(b - vec2f(-0.004, 0.007)) - 0.012);
      symbol = min(symbol, loCapsule(b, vec2f(0.005, -0.009), vec2f(-0.003, -0.020), 0.002));
      feeling = select(vec3f(0.25, 0.35, 0.58), vec3f(0.57, 0.24, 0.46), emotion > 5.5);
    } else {
      // A tiny smiling companion/feather: avian symbols instead of human faces.
      symbol = min(loEllipse(b + vec2f(0.005, 0.002), vec2f(0.014, 0.010)), length(b - vec2f(0.009, 0.006)) - 0.008);
      symbol = min(symbol, loBirdTriangle(b, vec2f(0.014, 0.008), vec2f(0.014, 0.002), vec2f(0.023, 0.005)));
      symbol = min(symbol, loBirdTriangle(b, vec2f(-0.011, 0.0), vec2f(-0.024, 0.012), vec2f(-0.021, -0.007)));
      feeling = accent * 0.7;
    }
    let glyph = 1.0 - smoothstep(-aa, aa, symbol);
    let edge = smoothstep(-0.0025, -0.001, bubbleSdf);
    let bubbleColor = mix(mix(vec3f(1.0, 0.97, 0.86), vec3f(0.20, 0.14, 0.22), edge), feeling, glyph);
    color = mix(color, bubbleColor, bubbleMask);
    opacity = max(opacity, bubbleMask);
    let beadMask = (1.0 - smoothstep(-aa, aa, bead)) * mood.w;
    color = mix(color, vec3f(1.0, 0.96, 0.84), beadMask);
    opacity = max(opacity, beadMask);
  }
  // Standard transparent blending consumes straight RGB and writes the
  // correctly premultiplied contribution over the opaque painting.
  return vec4f(color, opacity);
}
`;

export function createOrnamentBirds(
  view: ReturnType<typeof uniform<'vec4'>>,
  shape: ReturnType<typeof uniform<'vec4'>>,
  detail: ReturnType<typeof uniform<'vec4'>>,
  helpers: string,
) {
  const settings = Array.from({ length: 5 }, () => uniform(new Vector4(1, 0, 1, 1)));
  const motions = Array.from({ length: 5 }, () => uniform(new Vector4(0, 0, 0, 0)));
  const socialEngine = createBirdSocial();
  const socials = Array.from({ length: 5 }, () => uniform(new Vector4(0, 0, 5, 0)));
  const moods = Array.from({ length: 5 }, () => uniform(new Vector4(0, 0, 0, 0)));
  const rates = Array.from({ length: 5 }, () => uniform(new Vector4(0, 0, 1, 2.5)));
  const styles = Array.from({ length: 5 }, (_, i) => uniform(new Vector4(i % 4, 0.03, 0, 0)));
  let controls: Record<string, number> = {};
  let sampler: ((id: string, key: number) => number) | undefined;
  const flockTime = [0, 0];
  const flockOrbit = [0, 0];
  const visitsTime = [0, 0, 0, 0, 0];
  let wingTime = 0;
  let previousTime: number | undefined;
  let flightSpeed = 1;

  const geometry = new PlaneGeometry(0.40, 0.40);
  const materials: MeshBasicNodeMaterial[] = [];
  const meshes: Mesh[] = [];
  for (let index = 0; index < 5; index++) {
    const identity = uniform(index);
    const material = new MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false });
    material.positionNode = wgslFn(vertex + birdHelpers + helpers)(positionLocal, identity, view, shape, detail, settings[index]!, motions[index]!, socials[index]!, moods[index]!);
    material.fragmentNode = wgslFn(fragment + hummingbirdShader + birdHelpers + helpers)(uv(), identity, view, shape, detail, settings[index]!, motions[index]!, styles[index]!, socials[index]!, moods[index]!, rates[index]!);
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 10 + index;
    materials.push(material);
    meshes.push(mesh);
  }
  return {
    meshes,
    update(values: Record<string, number>, sample?: (id: string, key: number) => number) {
      controls = values;
      sampler = sample;
      flightSpeed = values.birdSpeed ?? 1;
      for (let i = 0; i < meshes.length; i++) {
        const size = sample?.('birdSize', i) ?? values.birdSize ?? 1;
        settings[i]!.value.x = size;
        settings[i]!.value.z = sample?.('birdOrbit', i) ?? values.birdOrbit ?? 1;
        settings[i]!.value.w = values.birdVisits ?? 1;
        styles[i]!.value.x = (i + Math.round(values.birdSpecies ?? 0)) % 4;
        styles[i]!.value.y = values.birdPalette ?? 0.03;
        meshes[i]!.visible = size > 0;
      }
    },
    advance(time: number) {
      const dt = previousTime === undefined || time < previousTime ? 0 : Math.min(time - previousTime, 0.1);
      previousTime = time;
      for (let flock = 0; flock < 2; flock++) {
        const speed = sampler?.('birdSpeed', flock) ?? flightSpeed;
        const pitch = sampler?.('birdPitch', flock) ?? controls.birdPitch ?? 1;
        flockTime[flock]! += dt * speed;
        flockOrbit[flock]! += dt * speed * 0.86 / Math.max(0.15, pitch);
      }
      wingTime += dt;
      socialEngine.advance(dt, {
        frequency: controls.birdVisits ?? 1,
        speed: Array.from({ length: 5 }, (_, i) => sampler?.('birdExcursionSpeed', i) ?? controls.birdExcursionSpeed ?? 1),
        perchDuration: controls.birdPerchDuration ?? 10,
        sociability: controls.birdSociability ?? 0.65,
        seed: view.value.z,
      });
      for (let i = 0; i < 5; i++) {
        const state = socialEngine.states[i]!;
        const old = socials[i]!.value;
        rates[i]!.value.set(dt > 0 ? (state.excursion - old.x) / dt : 0, dt > 0 ? (state.rest - old.y) / dt : 0,
          sampler?.('birdSpeed', i < 2 ? 0 : 1) ?? flightSpeed, sampler?.('birdPitch', i < 2 ? 0 : 1) ?? controls.birdPitch ?? 1);
        old.set(state.excursion, state.rest, state.owner, state.slot);
        moods[i]!.value.set(state.facing, state.idle, state.emotion, state.bubble * (controls.birdThoughts ?? 0.7));
        const speed = sampler?.('birdExcursionSpeed', i) ?? controls.birdExcursionSpeed ?? 1;
        visitsTime[i]! += dt * speed * Math.max(0.1, controls.birdVisits ?? 1);
        settings[i]!.value.y = flockTime[i < 2 ? 0 : 1]!;
        motions[i]!.value.set(flockOrbit[i < 2 ? 0 : 1]!, visitsTime[i]!, wingTime, 0);
      }
    },
    reset() {
      socialEngine.reset();
      previousTime = undefined;
      wingTime = 0;
      visitsTime.fill(0);
      flockTime.fill(0);
      flockOrbit.fill(0);
    },
    dispose() {
      geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
