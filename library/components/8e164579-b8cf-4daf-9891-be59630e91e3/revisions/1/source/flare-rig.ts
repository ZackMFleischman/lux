import {
  AdditiveBlending, Color, Group, Mesh, MeshBasicNodeMaterial,
  PlaneGeometry, Vector3, Vector4, PerspectiveCamera, OrthographicCamera,
} from 'three/webgpu';
import { uniform, uv, wgslFn } from 'three/tsl';

// Screen-space photometric shapes: no textures, temporal noise, or frame allocations.
const diffraction = wgslFn(`
fn diffraction(st: vec2f, shape: vec4f, tint: vec3f) -> vec4f {
  let p = (st - 0.5) * 2.0;
  let cs = cos(shape.z); let sn = sin(shape.z);
  let q = vec2f(cs*p.x-sn*p.y, sn*p.x+cs*p.y);
  let r = length(q);
  var rays = 0.0;
  for (var i = 0; i < 3; i = i + 1) {
    let a = 1.5707963 + f32(i)*1.04719755;
    let along = abs(dot(q,vec2f(cos(a),sin(a))));
    let across = abs(dot(q,vec2f(-sin(a),cos(a))));
    let width = 0.0018 + 0.0035*exp(-along*7.0);
    rays += exp(-across/width) * pow(max(0.0,1.0-along),2.4) * 0.72;
    rays += exp(-across/(width*4.0)) * exp(-along*9.0) * 0.075;
  }
  let horizontal = exp(-abs(q.y)/0.0025) * pow(max(0.0,1.0-abs(q.x)*2.4),2.0);
  rays += horizontal * shape.y;
  let core = exp(-r*r/0.000045)*2.6;
  let halo = exp(-r*36.0)*0.15;
  let ring = exp(-pow((r-0.038)/0.004,2.0))*0.024;
  let edge = 1.0-smoothstep(0.85,0.99,r);
  let energy = (rays + core + halo + ring)*shape.x*edge;
  let rgb = mix(tint,vec3f(1.0),exp(-r*90.0)*0.88)*energy;
  return vec4f(rgb, clamp(energy,0.0,1.0));
}`);

const optical = wgslFn(`
fn optical(st: vec2f, shape: vec4f, tint: vec3f) -> vec4f {
  let p = (st-0.5)*2.0;
  let r = length(p);
  var energy = 0.0;
  if (shape.y < 0.5) {
    energy = exp(-r*r/0.0006)*2.0 + exp(-r*13.0)*0.16;
    energy += exp(-abs(p.y)/0.005)*pow(max(0.0,1.0-abs(p.x)),3.0)*shape.z;
  } else {
    let angle = atan2(p.y,p.x);
    let sector = angle + 0.52359878;
    let folded = sector - floor(sector/1.04719755)*1.04719755 - 0.52359878;
    let polygon = mix(r,r*cos(folded),shape.w);
    let edge = exp(-pow((polygon-0.65)/0.11,2.0));
    let fill = (1.0-smoothstep(0.35,0.80,polygon))*0.035;
    let arc = exp(-pow((r-0.71)/0.035,2.0))*(0.45+0.55*p.y);
    energy = edge*0.13 + fill + arc*0.10;
  }
  energy *= shape.x*(1.0-smoothstep(0.86,0.99,r));
  return vec4f(tint*energy,clamp(energy,0.0,1.0));
}`);

export type FlareOptions = {
  brightness?: number; visibility?: number; scale?: number; tint?: Color;
  rotation?: number; secondarySpikes?: number; ghosts?: number; streak?: number;
};

export function createFlareRig(kind: 'optical' | 'diffraction') {
  const root = new Group();
  const geometry = new PlaneGeometry(2, 2);
  const defaultTint = new Color('#c7ddff');
  const shapes = Array.from({ length: kind === 'optical' ? 7 : 1 }, () => uniform(new Vector4()));
  const tints = shapes.map(() => uniform(defaultTint.clone()));
  const materials = shapes.map((shape, i) => {
    const material = new MeshBasicNodeMaterial({
      transparent: true, blending: AdditiveBlending, depthTest: false,
      depthWrite: false, toneMapped: false, premultipliedAlpha: true,
    });
    material.fragmentNode = (kind === 'optical' ? optical : diffraction)(uv(), shape, tints[i]);
    return material;
  });
  const meshes = materials.map(material => {
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1000;
    root.add(mesh);
    return mesh;
  });
  const point = new Vector3();
  const cameraPosition = new Vector3();
  const right = new Vector3();
  const up = new Vector3();
  const forward = new Vector3();
  const direction = new Vector3();
  const spectral = [new Color('#ffffff'), new Color('#f0cddd'), new Color('#bfdcd0'), new Color('#c4ceef'), new Color('#e5d4c4'), new Color('#c2d9ea'), new Color('#e3c5dc')];
  const ghostLocations = [0, -0.28, 0.18, 0.42, 0.71, 1.02, 1.34];
  const ghostSizes = [1, 0.38, 0.15, 0.26, 0.70, 0.16, 0.43];
  return {
    root,
    // Camera must have an updated world matrix. worldLight can be camera.position
    // plus a fixed sky direction; translation then cannot disturb constellations.
    update(camera: PerspectiveCamera | OrthographicCamera, worldLight: Vector3, options: FlareOptions = {}) {
      camera.updateMatrixWorld();
      point.copy(worldLight).project(camera);
      camera.getWorldPosition(cameraPosition);
      camera.getWorldDirection(forward);
      const inFront = direction.copy(worldLight).sub(cameraPosition).dot(forward) > 0;
      const edge = Math.max(0, Math.min(1, (1.22 - Math.max(Math.abs(point.x), Math.abs(point.y))) / 0.20));
      const energy = (options.brightness ?? 1) * (options.visibility ?? 1) * edge;
      root.visible = inFront && energy > 0.00001;
      if (!root.visible) return;
      for (let i = 0; i < tints.length; i++) tints[i].value.copy(options.tint ?? defaultTint).multiply(spectral[i]);
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      const distance = Math.max(camera.near * 4, 1);
      const halfHeight = camera instanceof PerspectiveCamera
        ? Math.tan(camera.fov * Math.PI / 360) * distance
        : (camera.top - camera.bottom) / (2 * camera.zoom);
      const aspect = camera instanceof PerspectiveCamera ? camera.aspect : (camera.right - camera.left) / (camera.top - camera.bottom);
      for (let i = 0; i < meshes.length; i++) {
        const mesh = meshes[i];
        const location = 1 - ghostLocations[i];
        mesh.position.copy(cameraPosition).addScaledVector(forward, distance)
          .addScaledVector(right, point.x * halfHeight * aspect * location)
          .addScaledVector(up, point.y * halfHeight * location);
        mesh.quaternion.copy(camera.quaternion);
        mesh.scale.setScalar(halfHeight * (options.scale ?? 0.28) * ghostSizes[i]);
        shapes[i].value.set(
          energy * (i === 0 ? 1 : (options.ghosts ?? 0.55) * 1.5),
          kind === 'optical' ? (i === 0 ? 0 : 1) : (options.secondarySpikes ?? 0.12),
          kind === 'optical' ? (options.streak ?? 0.08) : (options.rotation ?? 0), i === 4 || i === 2 ? 0 : 0.72,
        );
      }
    },
    dispose() {
      geometry.dispose();
      for (const material of materials) material.dispose();
      root.removeFromParent();
      root.clear();
    },
  };
}
