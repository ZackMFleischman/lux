import {
  AdditiveBlending,
  Color,
  InstancedMesh,
  Object3D,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  DataTexture,
  DoubleSide,
  Euler,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  Vector3,
} from 'three/webgpu';
import { float, mix, smoothstep, uniform, uv, vec2, vec3 } from 'three/tsl';

export interface OrbitalComet {
  update(
    timeSeconds: number,
    reveal: number,
    period: number,
    trailSize: number,
    brightness: number,
    size: number,
    activity: number,
    trailLength: number,
    sunRadius?: number,
  ): void;
  reset(): void;
  dispose(): void;
}

const tau = Math.PI * 2;
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));

/**
 * A high-eccentricity, sun-focused record comet. The trail samples prior points
 * on the same orbit, so it remains a fixed world-space passage through the system.
 */
export function createOrbitalComet(
  scene: Scene,
  camera: PerspectiveCamera,
  texture: DataTexture,
): OrbitalComet {
  const root = new Group();
  const head = new Group();
  const orbitRotation = new Quaternion().setFromEuler(new Euler(0.72, -0.34, 0.48));
  const semiMajor = 9;
  const eccentricity = 0.78;
  const minorFactor = Math.sqrt(1 - eccentricity * eccentricity);
  let orbitScale = 1;
  const samples = 72;
  const headGeometry = new CircleGeometry(1, 96);
  const tailGeometry = new BufferGeometry();
  const tailPositions = new Float32Array((samples + 1) * 6);
  const tailUvs = new Float32Array((samples + 1) * 4);
  const indices: number[] = [];
  const gain = uniform(0);
  const clock = uniform(0);
  const materials: MeshBasicNodeMaterial[] = [];
  const current = new Vector3();
  const previous = new Vector3();
  const next = new Vector3();
  const tangent = new Vector3();
  const cameraLine = new Vector3();
  const side = new Vector3();
  const outward = new Vector3();

  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    tailUvs.set([t, 0, t, 1], index * 4);
    if (index < samples) {
      const offset = index * 2;
      indices.push(offset, offset + 1, offset + 2, offset + 1, offset + 3, offset + 2);
    }
  }
  tailGeometry.setAttribute('position', new BufferAttribute(tailPositions, 3));
  tailGeometry.setAttribute('uv', new BufferAttribute(tailUvs, 2));
  tailGeometry.setIndex(indices);

  const face = new MeshBasicNodeMaterial({ map: texture, side: DoubleSide });
  face.toneMapped = false;
  const record = new Mesh(headGeometry, face);
  head.add(record);

  const glow = new MeshBasicNodeMaterial();
  const radial = float(1).sub(smoothstep(0.14, 0.5, uv().sub(vec2(0.5)).length()));
  glow.colorNode = mix(vec3(0.18, 0.8, 1), vec3(1, 0.25, 0.65), uv().x);
  glow.opacityNode = radial.pow(3).mul(gain).mul(0.42);
  glow.transparent = true;
  glow.blending = AdditiveBlending;
  glow.depthWrite = false;
  glow.toneMapped = false;
  materials.push(glow);
  const glowMesh = new Mesh(new PlaneGeometry(2.8, 2.8), glow);
  glowMesh.position.z = -0.01;
  head.add(glowMesh);

  const tailMaterial = new MeshBasicNodeMaterial();
  const crossFade = float(1).sub(smoothstep(0.05, 1, uv().y.sub(0.5).abs().mul(2))).pow(2);
  const endFade = float(1).sub(smoothstep(0.22, 1, uv().x));
  tailMaterial.colorNode = mix(vec3(0.12, 0.76, 1), vec3(0.65, 0.08, 0.94), uv().x);
  tailMaterial.opacityNode = crossFade.mul(endFade).mul(gain).mul(0.42);
  tailMaterial.transparent = true;
  tailMaterial.blending = AdditiveBlending;
  tailMaterial.depthWrite = false;
  tailMaterial.side = DoubleSide;
  tailMaterial.toneMapped = false;
  materials.push(tailMaterial);
  const tail = new Mesh(tailGeometry, tailMaterial);
  tail.frustumCulled = false;

  scene.add(root);
  root.add(tail, head);

  function pointAt(timeSeconds: number, periodSeconds: number, target: Vector3): Vector3 {
    const mean = ((timeSeconds / periodSeconds) * tau - 0.8) % tau;
    const normalizedMean = mean < 0 ? mean + tau : mean;
    let eccentric = normalizedMean;
    for (let iteration = 0; iteration < 8; iteration += 1) {
      const residual = eccentric - eccentricity * Math.sin(eccentric) - normalizedMean;
      eccentric -= residual / (1 - eccentricity * Math.cos(eccentric));
    }
    target.set(
      semiMajor * (Math.cos(eccentric) - eccentricity),
      semiMajor * minorFactor * Math.sin(eccentric),
      0,
    );
    return target.applyQuaternion(orbitRotation).multiplyScalar(orbitScale);
  }

  return {
    update(timeSeconds, reveal, period, trailSize, brightness, size, activity, trailLength, sunRadius = 1.5) {
      orbitScale = Math.max(1, (sunRadius + 0.17 * clamp(size, 0.2, 3) + 0.55) / (semiMajor * (1 - eccentricity)));
      const periodSeconds = Math.max(10, period);
      const visible = clamp(reveal) * clamp(activity);
      root.visible = visible > 0.0005;
      if (!root.visible) return;
      const intensity = visible * clamp(brightness, 0, 2.5);
      gain.value = intensity;
      clock.value = timeSeconds;
      pointAt(timeSeconds, periodSeconds, current);
      pointAt(timeSeconds - 0.015, periodSeconds, previous);
      tangent.subVectors(current, previous).normalize();

      head.position.copy(current);
      head.quaternion.copy(camera.quaternion);
      head.rotateZ(timeSeconds * 0.8 + 0.3);
      head.rotateX(0.12);
      head.scale.setScalar(0.17 * clamp(size, 0.2, 3));

      const tailSeconds = Math.min(periodSeconds * 0.23, 7.5) * clamp(trailLength, 0.3, 3);
      const widthScale = clamp(trailSize, 0.2, 3);
      for (let index = 0; index <= samples; index += 1) {
        const age = (index / samples) * tailSeconds;
        pointAt(timeSeconds - age, periodSeconds, current);
        pointAt(timeSeconds - age - 0.012, periodSeconds, previous);
        pointAt(timeSeconds - age + 0.012, periodSeconds, next);
        tangent.subVectors(next, previous).normalize();
        cameraLine.subVectors(camera.position, current).normalize();
        side.crossVectors(tangent, cameraLine).normalize();
        if (side.lengthSq() < 0.0001) side.set(0, 1, 0).applyQuaternion(orbitRotation);
        outward.copy(current).normalize();
        const trail = index / samples;
        const dustBias = trail * trail * 0.3;
        current.addScaledVector(outward, dustBias);
        current.addScaledVector(cameraLine, -0.08 * clamp(size, 0.2, 3));
        const width = (0.018 + trail * trail * 0.2) * widthScale;
        const offset = index * 6;
        tailPositions[offset] = current.x - side.x * width;
        tailPositions[offset + 1] = current.y - side.y * width;
        tailPositions[offset + 2] = current.z - side.z * width;
        tailPositions[offset + 3] = current.x + side.x * width;
        tailPositions[offset + 4] = current.y + side.y * width;
        tailPositions[offset + 5] = current.z + side.z * width;
      }
      (tailGeometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    },
    reset() {
      root.visible = false;
      gain.value = 0;
    },
    dispose() {
      root.removeFromParent();
      headGeometry.dispose();
      tailGeometry.dispose();
      face.dispose();
      glowMesh.geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
