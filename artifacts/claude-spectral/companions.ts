import {
  AdditiveBlending,
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  InstancedMesh,
  Material,
  Matrix4,
  MeshBasicNodeMaterial,
  Quaternion,
  RingGeometry,
  Vector3,
} from 'three/webgpu';
import { atan, color, instanceIndex, positionLocal, sin, uniform, vec3 } from 'three/tsl';

/**
 * Small companion pearls that stream out of the main pearl along curling
 * tentacle paths into the distance, like particles on streamers.
 * - They are instances of the main pearl: same live geometry and skin.
 * - Pulses (bass, kick) push their orbits outward.
 * - A shockwave (kick onset) hurls them down their streamers; the loop then
 *   brings fresh ones out from behind the pearl.
 * - Each carries its own three sine "spectral" rings (bass, mids, highs).
 */
type Band = { lobes: number; amp: number; scale: number; tint: string };
export const companionRingBands: Band[] = [
  { lobes: 3, amp: 0.22, scale: 1.55, tint: '#2fe0cc' },
  { lobes: 7, amp: 0.14, scale: 1.85, tint: '#9b7bff' },
  { lobes: 13, amp: 0.08, scale: 2.15, tint: '#ffc58f' },
];

export function createCompanions(random: () => number, geometry: BufferGeometry, material: Material, maxCount = 96) {
  const mesh = new InstancedMesh(geometry, material, maxCount);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;

  // Spectral rings: one instanced ribbon per band, displaced on the GPU.
  const ringGeometry = new RingGeometry(0.965, 1.035, 128, 1);
  const rings = ([] as Band[]).map(band => { // per-companion rings removed (too busy)
    const level = uniform(0);
    const phase = uniform(0);
    const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
    const angle = atan(positionLocal.y, positionLocal.x);
    const wobble = sin(angle.mul(band.lobes).add(phase).add(instanceIndex.toFloat().mul(1.73)))
      .mul(level.mul(band.amp * 2.2).add(0.02));
    m.positionNode = vec3(positionLocal.xy.mul(wobble.add(1)), positionLocal.z);
    m.colorNode = color(band.tint);
    m.opacityNode = level.mul(0.75).add(0.12);
    const instanced = new InstancedMesh(ringGeometry, m, maxCount);
    instanced.instanceMatrix.setUsage(DynamicDrawUsage);
    instanced.frustumCulled = false;
    instanced.renderOrder = -1;
    return { band, mesh: instanced, material: m, level, phase };
  });

  const arms = 7;
  const seeds = Array.from({ length: maxCount }, (_, i) => ({
    arm: i % arms,
    offset: random(),
    speed: 0.06 + random() * 0.05,
    jitter: random() * Math.PI * 2,
    size: 0.6 + random() * 0.7,
  }));
  const armTilt = Array.from({ length: arms }, () => (random() - 0.5) * 1.4);
  const armTwist = Array.from({ length: arms }, () => (random() < 0.5 ? -1 : 1) * (1.6 + random() * 1.4));
  const m4 = new Matrix4();
  const q = new Quaternion();
  const identity = new Quaternion();
  const pos = new Vector3();
  const scl = new Vector3();
  const ringScale = new Vector3();
  let travel = 0;
  let blast = 0;
  let lastKick = 0;
  let lastT = Number.NaN;
  const phases = [0, 0, 0];

  const group = [mesh, ...rings.map(r => r.mesh)];
  return {
    meshes: group,
    update(t: number, count: number, size: number, reach: number, bass: number, mids: number, highs: number, kick: number) {
      const dt = Number.isFinite(lastT) ? Math.min(0.1, Math.max(0, t - lastT)) : 0;
      lastT = t;
      // Shockwave: a kick onset hurls the companions down their streamers.
      if (kick > 0.4 && lastKick <= 0.4) blast = Math.max(blast, 10);
      lastKick = kick;
      blast *= Math.exp(-dt * 2.6);
      travel += dt * (1 + mids * 2.2 + blast);
      // Pulse: orbits breathe outward with the body and the blast.
      const push = 1 + bass * 0.35 + kick * 0.25 + Math.min(1, blast / 10) * 0.35;

      const levels = [bass, mids, highs];
      for (let b = 0; b < rings.length; b++) {
        phases[b] += dt * (0.6 + levels[b] * 3) * (b % 2 ? -1 : 1);
        rings[b].level.value = levels[b];
        rings[b].phase.value = phases[b];
      }

      const n = Math.max(0, Math.min(maxCount, Math.round(count)));
      mesh.count = n;
      for (const r of rings) r.mesh.count = n;
      for (let i = 0; i < n; i++) {
        const s = seeds[i];
        const u = (travel * s.speed + s.offset) % 1; // 0 = born behind the pearl, 1 = gone
        const a = s.arm;
        const base = (a / arms) * Math.PI * 2 + Math.sin(t * 0.11 + a) * 0.35;
        const curl = base + u * armTwist[a] + Math.sin(u * 5 - t * 0.7 + a) * 0.25;
        const radius = (1.25 + u * 4.6 * reach) * push;
        const wave = Math.sin(u * 9 - t * 1.3 + s.jitter) * 0.18 * u;
        pos.set(
          Math.cos(curl) * radius + wave,
          (Math.sin(curl) * radius * 0.62 + armTilt[a] * u * 2.2 + wave),
          -u * 7 * reach + Math.sin(u * 6 + a) * 0.6 - 0.4 * (1 - Math.min(1, u * 9)),
        );
        const life = Math.min(1, u * 9) * Math.pow(1 - u, 1.15);
        const scale = Math.max(0.0001, 0.16 * size * s.size * life * (1 + bass * 0.45 + kick * 0.3));
        scl.setScalar(scale);
        q.setFromAxisAngle(pos.clone().normalize(), t * 0.4 + s.jitter);
        m4.compose(pos, q, scl);
        mesh.setMatrixAt(i, m4);
        for (const r of rings) {
          ringScale.setScalar(scale * r.band.scale * (1 + kick * 0.25));
          m4.compose(pos, identity, ringScale);
          r.mesh.setMatrixAt(i, m4);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      for (const r of rings) r.mesh.instanceMatrix.needsUpdate = true;
    },
    reset() { travel = 0; blast = 0; lastKick = 0; lastT = Number.NaN; phases.fill(0); },
    dispose() {
      mesh.dispose();
      for (const r of rings) { r.mesh.dispose(); r.material.dispose(); }
      ringGeometry.dispose();
    },
  };
}
