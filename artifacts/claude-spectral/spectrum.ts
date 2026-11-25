import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  RingGeometry,
} from 'three/webgpu';
import { atan, attribute, color, mix, positionLocal, sin, uniform, uv } from 'three/tsl';

/**
 * Sinusoidal spectral halo behind the pearl.
 *
 * Lux gives visuals band envelopes (bass, mids, highs, kick), not raw FFT
 * bins. Each band drives its own closed sine ribbon around the pearl:
 * bass = few slow lobes, mids = medium waves, highs = many fast ripples.
 * The ribbons interfere on a shared "sum" ribbon, so loud passages braid.
 * A kick sends an expanding shock ring outward.
 */
type Wave = { lobes: number; speed: number; base: number; width: number; tint: [string, string]; amp: number };
const waves: Wave[] = [
  { lobes: 3, speed: 0.35, base: 2.05, width: 0.035, tint: ['#21d6c3', '#5fa8ff'], amp: 0.55 },
  { lobes: 7, speed: -0.8, base: 2.3, width: 0.026, tint: ['#7d63e6', '#c58cff'], amp: 0.4 },
  { lobes: 17, speed: 1.7, base: 2.55, width: 0.018, tint: ['#ffc98a', '#ff8fc8'], amp: 0.22 },
  { lobes: 0, speed: 0, base: 2.85, width: 0.022, tint: ['#9ff3e8', '#e0c2ff'], amp: 1 },
];

export function createSpectralHalo(random: () => number) {
  const group = new Group();
  const segments = 360;
  const z = -1.6;
  const gain = uniform(1);
  const flash = uniform(0);
  const makeRibbon = (wave: Wave, index: number, opacityScale: number) => {
    const positions = new Float32Array((segments + 1) * 2 * 3);
    const across = new Float32Array((segments + 1) * 2);
    const indices: number[] = [];
    for (let i = 0; i <= segments; i++) {
      across[i * 2] = 0;
      across[i * 2 + 1] = 1;
      if (i < segments) {
        const k = i * 2;
        indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const geometry = new BufferGeometry();
    const attributePositions = new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', attributePositions);
    geometry.setAttribute('across', new BufferAttribute(across, 1));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    geometry.boundingSphere!.radius = 6;
    const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
    const a = attribute('across', 'float');
    const core = sin(a.mul(Math.PI)).pow(1.5);
    const level = uniform(0);
    material.colorNode = mix(color(wave.tint[0]), color(wave.tint[1]), uv().x.add(a).mul(0.5)).mul(flash.mul(0.6).add(1));
    material.opacityNode = core.mul(level.mul(0.7).add(0.18)).mul(gain.min(1.5).mul(0.6).add(0.2)).mul(opacityScale);
    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = -5 + index;
    group.add(mesh);
    return { wave, mesh, positions, attributePositions, geometry, material, level, phase: random() * Math.PI * 2 };
  };
  const ribbons = waves.map((wave, index) => makeRibbon(wave, index, 1.25));
  // Bloom rings: extra copies that appear occasionally and spread to fill the screen.
  const extraCount = 10;
  const extras = Array.from({ length: extraCount }, (_, j) => ({ ...makeRibbon(waves[j % 3], -9, 0.7), w: j % 3, j }));
  // Out-of-phase echo copies of each ring: dimmer, drifting at their own pace.
  const echoes = waves.flatMap((wave, w) => [1, 2].map(k => ({
    ...makeRibbon(wave, -8 - k, k === 1 ? 0.22 : 0.12), w, k,
    drift: 0, driftRate: (0.12 + random() * 0.1) * k * (random() < 0.5 ? -1 : 1),
  })));

  // Shockwaves: a pool of thick glowing rings with a soft trailing wake.
  // Kicks fire a full blast; strong bass surges fire a smaller one.
  const ringGeometry = new RingGeometry(0.7, 1, 220, 1);
  const shocks = Array.from({ length: 5 }, (_, k) => {
    const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
    const fade = uniform(0);
    // uv().y runs inner (0) to outer (1) on RingGeometry: bright crest, soft wake.
    const across = positionLocal.xy.length().sub(0.7).div(0.3);
    const crest = across.sub(0.93).abs().mul(-28).exp();
    const wake = across.pow(3).mul(0.35);
    const ripple = sin(atan(positionLocal.y, positionLocal.x).mul(48).add(k * 1.7)).mul(0.5).add(0.5);
    m.colorNode = mix(color('#9bfff0'), color('#e2b8ff'), ripple).mul(crest.mul(1.6).add(0.4));
    m.opacityNode = fade.mul(crest.add(wake)).mul(ripple.mul(0.3).add(0.7));
    const mesh = new Mesh(ringGeometry, m);
    mesh.position.z = z - 0.05 - k * 0.01;
    mesh.renderOrder = -6;
    mesh.visible = false;
    group.add(mesh);
    return { mesh, material: m, fade, age: 1, power: 0 };
  });
  let nextShock = 0;
  let lastBass = 0;
  const fire = (power: number) => {
    const sh = shocks[nextShock];
    nextShock = (nextShock + 1) % shocks.length;
    sh.age = 0;
    sh.power = power;
  };
  let lastKick = 0;
  let lastTime = Number.NaN;
  const smooth = [0, 0, 0];
  const phases = ribbons.map(r => r.phase);

  const writeRibbon = (r: number, positions: Float32Array, rotation: number, phaseShift: number,
    amp: number, width: number, wave: Wave, radiusScale = 1) => {
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2 + rotation;
      let offset;
      if (r < 3) {
        offset = Math.sin(theta * wave.lobes + phases[r] + phaseShift) * amp
          + Math.sin(theta * (wave.lobes * 2 + 1) - (phases[r] + phaseShift) * 1.3) * amp * 0.25;
      } else {
        offset = (Math.sin(theta * 3 + phases[0] + phaseShift) * smooth[0] * 0.5
          + Math.sin(theta * 7 + phases[1] + phaseShift) * smooth[1] * 0.35
          + Math.sin(theta * 17 + phases[2] + phaseShift) * smooth[2] * 0.2) * gainNow + 0.03 * Math.sin(theta * 5 + phases[3]);
      }
      const radius = (wave.base + offset + kickNow * 0.16) * radiusScale;
      const c = Math.cos(theta);
      const sn = Math.sin(theta);
      const o = i * 6;
      positions[o] = c * (radius - width); positions[o + 1] = sn * (radius - width); positions[o + 2] = z;
      positions[o + 3] = c * (radius + width); positions[o + 4] = sn * (radius + width); positions[o + 5] = z;
    }
  };
  let gainNow = 1;
  let kickNow = 0;
  return {
    group,
    update(t: number, bass: number, mids: number, highs: number, kick: number, gainValue: number, spin: number, echoCount = 2, bloom = 0) {
      const dt = Number.isFinite(lastTime) ? Math.min(0.1, Math.max(0, t - lastTime)) : 0;
      lastTime = t;
      gain.value = gainValue;
      flash.value = kick;
      if (kick > 0.4 && lastKick <= 0.4) fire(1);
      lastKick = kick;
      if (bass > 0.7 && lastBass <= 0.7) fire(0.55);
      lastBass = bass;
      for (const sh of shocks) {
        sh.age = Math.min(1, sh.age + dt * 0.95);
        const live = sh.age < 1;
        sh.mesh.visible = live;
        if (!live) continue;
        const ease = 1 - Math.pow(1 - sh.age, 3);
        sh.mesh.scale.setScalar(1.7 + ease * (3.5 + sh.power * 4.5));
        sh.fade.value = Math.pow(1 - sh.age, 1.7) * (0.35 + sh.power * 0.75) * Math.max(0.4, gainValue);
      }

      gainNow = gainValue;
      kickNow = kick;
      const bands = [bass, mids, highs];
      for (let b = 0; b < 3; b++) smooth[b] += (bands[b] - smooth[b]) * Math.min(1, dt * 10);
      for (let r = 0; r < ribbons.length; r++) {
        const { wave, positions, attributePositions, level } = ribbons[r];
        const energy = r < 3 ? smooth[r] : (smooth[0] + smooth[1] + smooth[2]) / 3;
        level.value = energy;
        // Louder bands travel faster: the waves surge with the music.
        phases[r] += dt * (wave.speed || 0.2) * (0.4 + energy * 2.2);
        const amp = 0.04 + energy * wave.amp * gainValue;
        const width = wave.width * (1 + energy * 1.4) + kick * 0.01;
        writeRibbon(r, positions, spin * (r % 2 ? -1 : 1), 0, amp, width, wave);
        attributePositions.needsUpdate = true;
        for (const e of echoes) {
          if (e.w !== r) continue;
          e.mesh.visible = e.k <= echoCount;
          if (!e.mesh.visible) continue;
          e.level.value = energy;
          // Drift faster when the band is loud; phase is pushed out of step.
          e.drift += dt * e.driftRate * (1 + energy * 2.5);
          const breathe = 1 + Math.sin(t * 0.4 + e.k * 1.9 + r) * 0.04 * e.k;
          writeRibbon(r, e.positions, spin * (r % 2 ? -1 : 1) + e.drift, e.k * 2.3, amp * 0.9, width * 0.35, wave, breathe);
          e.attributePositions.needsUpdate = true;
        }
      }
      // Bloom: ring count grows with the envelope, each new ring pushing further out.
      for (const x of extras) {
        const appear = Math.min(1, Math.max(0, bloom * extraCount - x.j));
        x.mesh.visible = appear > 0.001;
        if (!x.mesh.visible) continue;
        const energy = smooth[x.w];
        x.level.value = energy * appear;
        const spread = 1 + (x.j + 1) * 0.36 * Math.pow(bloom, 0.8);
        writeRibbon(x.w, x.positions, spin * (x.j % 2 ? 1 : -1) * 1.3 + x.j * 0.7, x.j * 1.13,
          (0.04 + energy * x.wave.amp * gainValue) * spread * 0.8, x.wave.width * (1 + energy) * spread * appear, x.wave, spread);
        x.attributePositions.needsUpdate = true;
      }
    },
    reset() {
      for (const sh of shocks) { sh.age = 1; sh.mesh.visible = false; } lastKick = 0; lastBass = 0; nextShock = 0; lastTime = Number.NaN; smooth.fill(0);
      ribbons.forEach((r, i) => { phases[i] = r.phase; });
      for (const e of echoes) e.drift = 0;
    },
    dispose() {
      for (const r of [...ribbons, ...echoes, ...extras]) { r.geometry.dispose(); r.material.dispose(); }
      ringGeometry.dispose();
      for (const sh of shocks) sh.material.dispose();
    },
  };
}
