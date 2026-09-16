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

fn loBirdPose(index: f32, view: vec4f, shape: vec4f, detail: vec4f, settings: vec4f) -> LoBirdPose {
  let route = select(0.0, 1.0, index > 1.5);
  let member = index - route * 2.0;
  let time = settings.y;
  // Each flock remains together. A companion lags, catches up, then glides.
  let cycle = fract(time / 48.0 + route * 0.43);
  let extent = select(view.y + 0.30, 1.85, route > 0.5);
  let lead = mix(-extent, extent, cycle);
  let s = lead - member * 0.145 + sin(time * 0.63 - member * 1.4) * member * 0.018;
  let centerline = loBirdRoute(s, route, view, shape, detail);
  let tangent = normalize(loBirdRoute(s + 0.01, route, view, shape, detail) - centerline);
  let normal = vec2f(-tangent.y, tangent.x);
  let orbit = time * (0.83 + route * 0.09) - member * 1.6 + route * 2.1;
  let radius = settings.z * (0.105 + member * 0.018);
  var position = vec3f(centerline + normal * cos(orbit) * radius, sin(orbit) * radius);
  var heading = atan2(tangent.y, tangent.x) + sin(orbit) * 0.32;
  var rest = 0.0;
  // One bird in each flock is curious. The triplet's last bird hesitates longer.
  if (member == select(1.0, 2.0, route > 0.5) && settings.w > 0.0) {
    let visit = fract(time / 48.0 + route * 0.43);
    let approach = smoothstep(0.40, 0.49, visit);
    let leave = smoothstep(0.62, 0.73, visit);
    let excursion = approach * (1.0 - leave) * settings.w;
    if (excursion > 0.0) {
      let owner = select(5, 6, route > 0.5);
      let anchor = loRegionCenter(owner, view.x, view.z, detail.y);
      var perch = anchor + vec2f(select(-0.18, 0.05, route > 0.5), shape.x * 0.82);
      // March down to the upper contour, including its attached deformation.
      for (var step = 0; step < 12; step++) {
        let noise = loFbm(perch * (1.35 + shape.y * 0.38) + vec2f(view.z * 0.071, -view.z * 0.043)) - 0.5;
        let distance = loShapeSdf(owner, perch, view.x, view.z, shape, detail, noise);
        perch.y -= clamp(distance * 0.8, -0.025, 0.12);
      }
      rest = smoothstep(0.475, 0.51, visit) * (1.0 - smoothstep(0.60, 0.65, visit)) * settings.w;
      position = mix(position, vec3f(perch + vec2f(0.0, 0.037 * settings.x), 0.04), excursion);
      position.y += sin(excursion * 3.141593) * 0.18;
      heading = mix(heading, 0.12 + sin(time * 1.8) * 0.10, excursion);
    }
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
fn loBirdVertex(local: vec3f, index: f32, view: vec4f, shape: vec4f, detail: vec4f, settings: vec4f) -> vec3f {
  let pose = loBirdPose(index, view, shape, detail, settings);
  let scale = settings.x * (1.0 + pose.center.z * 1.2);
  let point = pose.center.xy + local.xy * scale;
  return vec3f(point.x / view.y, point.y, 0.0);
}
`;

const fragment = `
fn loBirdInk(st: vec2f, index: f32, view: vec4f, shape: vec4f, detail: vec4f, settings: vec4f, speed: f32) -> vec4f {
  let pose = loBirdPose(index, view, shape, detail, settings);
  let scale = settings.x * (1.0 + pose.center.z * 1.2);
  let offset = (st - 0.5) * 0.24;
  let world = pose.center.xy + offset * scale;
  let nextView = vec4f(view.x + 0.025, view.yzw);
  let nextSettings = vec4f(settings.x, settings.y + 0.025 * speed, settings.zw);
  let nextPose = loBirdPose(index, nextView, shape, detail, nextSettings);
  let velocity = nextPose.center.xy - pose.center.xy;
  let travelHeading = atan2(velocity.y, velocity.x);
  let restingDirection = vec2f(cos(pose.heading), sin(pose.heading));
  let travelDirection = vec2f(cos(travelHeading), sin(travelHeading));
  let facing = mix(travelDirection, restingDirection, smoothstep(0.3, 0.95, pose.rest));
  var q = loRotate(offset, atan2(facing.y, facing.x));
  let time = settings.y;
  let glide = smoothstep(0.20, 0.70, sin(time * 0.73 + index * 1.7));
  let flap = mix(sin(time * (9.5 + index * 0.47) - index * 2.0), 0.32, glide * 0.74);
  let spread = mix(0.046 + flap * 0.022, 0.009, pose.rest);
  let bank = 0.86 + pose.bank * 0.18;
  var body = loEllipse(q, vec2f(0.023, 0.010));
  let head = length(q - vec2f(0.020, 0.007 + pose.rest * sin(time * 2.2) * 0.002)) - 0.010;
  body = min(body, head);
  let tail = loBirdTriangle(q, vec2f(-0.013, 0.0), vec2f(-0.041, 0.011), vec2f(-0.034, -0.010));
  let topWing = loBirdTriangle(q, vec2f(0.012, 0.004), vec2f(-0.023, 0.009), vec2f(-0.025 + flap * 0.009, spread * bank));
  let bottomWing = loBirdTriangle(q, vec2f(0.009, -0.003), vec2f(-0.022, -0.006), vec2f(-0.027, -spread / bank));
  let beak = loBirdTriangle(q, vec2f(0.025, 0.003), vec2f(0.025, 0.011), vec2f(0.041, 0.006));
  var silhouette = min(min(body, tail), min(topWing, bottomWing));
  silhouette = min(silhouette, beak);
  if (pose.rest > 0.01) {
    let reach = smoothstep(0.1, 0.9, pose.rest);
    let feet = min(loCapsule(q, vec2f(-0.004, -0.006), vec2f(-0.004 - 0.006 * reach, -0.006 - 0.028 * reach), 0.0015),
      loCapsule(q, vec2f(0.008, -0.006), vec2f(0.008 + 0.002 * reach, -0.006 - 0.028 * reach), 0.0015));
    silhouette = min(silhouette, feet);
  }
  let aa = max(fwidth(silhouette), 0.0007);
  // Warm paper keyline keeps the small subjects readable on dark motifs.
  let outline = 1.0 - smoothstep(0.002, 0.002 + aa, silhouette);
  let fill = 1.0 - smoothstep(-aa, aa, silhouette);
  var ink = vec3f(0.012, 0.008, 0.035);
  let breast = 1.0 - smoothstep(-0.001, 0.001, loEllipse(q - vec2f(0.007, -0.003), vec2f(0.012, 0.005)));
  let accent = select(vec3f(0.95, 0.19, 0.055), vec3f(0.02, 0.62, 0.66), index > 1.5);
  ink = mix(ink, accent, breast * 0.95);
  ink = mix(ink, vec3f(0.95, 0.53, 0.10), 1.0 - smoothstep(-aa, aa, beak));
  let eye = 1.0 - smoothstep(0.0015, 0.0023, length(q - vec2f(0.022, 0.009)));
  ink = mix(ink, vec3f(1.0, 0.93, 0.70), eye);
  var opacity = outline;
  if (pose.center.z < 0.0 && pose.rest < 0.05) {
    let noise = loFbm(world * (1.35 + shape.y * 0.38) + vec2f(view.z * 0.071, -view.z * 0.043)) - 0.5;
    let ribbons = min(loShapeSdf(9, world, view.x, view.z, shape, detail, noise),
      loShapeSdf(10, world, view.x, view.z, shape, detail, noise));
    opacity *= smoothstep(0.006, 0.012, ribbons);
  }
  let color = mix(vec3f(0.99, 0.91, 0.68), ink, fill);
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
  const settings = uniform(new Vector4(1, 0, 1, 1));
  let previousTime: number | undefined;
  let flightTime = 0;
  let flightSpeed = 1;
  const speedValue = uniform(1);
  const geometry = new PlaneGeometry(0.24, 0.24);
  const materials: MeshBasicNodeMaterial[] = [];
  const meshes: Mesh[] = [];
  for (let index = 0; index < 5; index++) {
    const identity = uniform(index);
    const material = new MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false });
    material.positionNode = wgslFn(vertex + birdHelpers + helpers)(positionLocal, identity, view, shape, detail, settings);
    material.fragmentNode = wgslFn(fragment + birdHelpers + helpers)(uv(), identity, view, shape, detail, settings, speedValue);
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 10 + index;
    materials.push(material);
    meshes.push(mesh);
  }
  return {
    meshes,
    update(size: number, speed: number, orbit: number, visits: number) {
      flightSpeed = speed;
      speedValue.value = speed;
      settings.value.set(size, flightTime, orbit, visits);
      for (const mesh of meshes) mesh.visible = size > 0;
    },
    advance(time: number) {
      if (previousTime === undefined || time < previousTime) flightTime = time * flightSpeed;
      else flightTime += (time - previousTime) * flightSpeed;
      previousTime = time;
      settings.value.y = flightTime;
    },
    reset() {
      previousTime = undefined;
      flightTime = 0;
      settings.value.y = 0;
    },
    dispose() {
      geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}

