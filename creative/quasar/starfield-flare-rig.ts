import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Vector3,
  Vector4,
} from 'three/webgpu';
import { uniform, uv, wgslFn } from 'three/tsl';

const diffraction = wgslFn(`
fn diffraction(st: vec2f, shape: vec4f, tint: vec3f) -> vec4f {
  let p = (st - 0.5) * 2.0;
  let cs = cos(shape.z);
  let sn = sin(shape.z);
  let q = vec2f(cs * p.x - sn * p.y, sn * p.x + cs * p.y);
  let r = length(q);
  var rays = 0.0;
  for (var i = 0; i < 3; i = i + 1) {
    let a = 1.5707963 + f32(i) * 1.04719755;
    let along = abs(dot(q, vec2f(cos(a), sin(a))));
    let across = abs(dot(q, vec2f(-sin(a), cos(a))));
    let width = max(0.0018 + 0.0035 * exp(-along * 7.0), fwidth(across) * 0.7);
    rays += exp(-across / width) * pow(max(0.0, 1.0 - along), 2.4) * 0.72;
    rays += exp(-across / (width * 4.0)) * exp(-along * 9.0) * 0.075;
  }
  let horizontal = exp(-abs(q.y) / 0.0025) * pow(max(0.0, 1.0 - abs(q.x) * 2.4), 2.0);
  rays += horizontal * shape.y;
  let coreWidth = max(0.0067, fwidth(r) * 0.65);
  let core = exp(-r * r / (coreWidth * coreWidth)) * 2.6;
  let halo = exp(-r * 36.0) * 0.15;
  let ring = exp(-pow((r - 0.038) / 0.004, 2.0)) * 0.024;
  let edge = 1.0 - smoothstep(0.85, 0.99, r);
  let energy = (rays + core + halo + ring) * shape.x * edge;
  let rgb = mix(tint, vec3f(1.0), exp(-r * 90.0) * 0.88) * energy;
  return vec4f(rgb, clamp(energy, 0.0, 1.0));
}`);

export type FlareOptions = {
  brightness?: number;
  visibility?: number;
  scale?: number;
  tint?: Color;
  rotation?: number;
  secondarySpikes?: number;
};

export function createFlareRig() {
  const root = new Group();
  const geometry = new PlaneGeometry(2, 2);
  const defaultTint = new Color('#c7ddff');
  const shape = uniform(new Vector4());
  const tint = uniform(defaultTint.clone());
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    premultipliedAlpha: true,
  });
  material.fragmentNode = diffraction(uv(), shape, tint);
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000;
  root.add(mesh);

  const point = new Vector3();
  const cameraPosition = new Vector3();
  const right = new Vector3();
  const up = new Vector3();
  const forward = new Vector3();
  const direction = new Vector3();

  return {
    root,
    update(
      camera: PerspectiveCamera | OrthographicCamera,
      worldLight: Vector3,
      options: FlareOptions = {},
    ) {
      camera.updateMatrixWorld();
      point.copy(worldLight).project(camera);
      camera.getWorldPosition(cameraPosition);
      camera.getWorldDirection(forward);
      const inFront = direction.copy(worldLight).sub(cameraPosition).dot(forward) > 0;
      const edge = Math.max(
        0,
        Math.min(1, (1.22 - Math.max(Math.abs(point.x), Math.abs(point.y))) / 0.20),
      );
      const energy = (options.brightness ?? 1) * (options.visibility ?? 1) * edge;
      root.visible = inFront && energy > 0.00001;
      if (!root.visible) return;

      tint.value.copy(options.tint ?? defaultTint);
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      const distance = Math.max(camera.near * 4, 1);
      const halfHeight = camera instanceof PerspectiveCamera
        ? Math.tan(camera.fov * Math.PI / 360) * distance
        : (camera.top - camera.bottom) / (2 * camera.zoom);
      const aspect = camera instanceof PerspectiveCamera
        ? camera.aspect
        : (camera.right - camera.left) / (camera.top - camera.bottom);

      mesh.position.copy(cameraPosition)
        .addScaledVector(forward, distance)
        .addScaledVector(right, point.x * halfHeight * aspect)
        .addScaledVector(up, point.y * halfHeight);
      mesh.quaternion.copy(camera.quaternion);
      mesh.scale.setScalar(halfHeight * (options.scale ?? 0.28));
      shape.value.set(
        energy,
        options.secondarySpikes ?? 0.035,
        options.rotation ?? 0,
        0,
      );
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      root.removeFromParent();
      root.clear();
    },
  };
}
