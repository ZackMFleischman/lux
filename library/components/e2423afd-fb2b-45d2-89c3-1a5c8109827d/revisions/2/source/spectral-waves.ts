import { uniform, uv, sin } from 'three/tsl';
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide,
  DynamicDrawUsage, Group, Mesh, MeshBasicNodeMaterial,
} from 'three/webgpu';

// Four related voices per audio band form a smoothly sampled spectral veil.
export function createSpectralWaves() {
  const group = new Group();
  const segments = 640;
  const geometries: BufferGeometry[] = [];
  const materials: MeshBasicNodeMaterial[] = [];
  const attributes: BufferAttribute[] = [];
  const glowAttributes: BufferAttribute[] = [];
  const glowMaterials: MeshBasicNodeMaterial[] = [];
  const glowLevels = Array.from({ length: 12 }, () => uniform(0));
  const colors = ['#66d5c5', '#bb91e0', '#e6b87f'];
  const spectrumHistory = Array.from({ length: 48 }, () => new Float32Array(128));
  let spectrumCursor = 0;
  let spectrumTime = -1;
  function sampleSpectrum(data: Float32Array, s: number) {
    const p = Math.max(0, Math.min(127, s * 127));
    const i = Math.floor(p);
    const f = p - i;
    const a = data[Math.max(0, i - 1)];
    const b = data[i];
    const c = data[Math.min(127, i + 1)];
    const d = data[Math.min(127, i + 2)];
    return Math.max(0, Math.min(1, b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)))));
  }
  for (let strand = 0; strand < 12; strand++) {
    const band = strand % 3;
    const voice = Math.floor(strand / 3);
    const geometry = new BufferGeometry();
    const positions = new BufferAttribute(new Float32Array((segments + 1) * 6), 3).setUsage(DynamicDrawUsage);
    const indices: number[] = [];
    for (let i = 0; i < segments; i++) {
      const n = i * 2;
      indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
    geometry.setAttribute('position', positions);
    geometry.setIndex(indices);
    const haloGeometry = new BufferGeometry();
    const haloPositions = new BufferAttribute(new Float32Array((segments + 1) * 6), 3).setUsage(DynamicDrawUsage);
    haloGeometry.setAttribute('position', haloPositions);
    haloGeometry.setIndex(indices);
    const haloUv = new Float32Array((segments + 1) * 4);
    for (let i = 0; i <= segments; i++) haloUv.set([0, i / segments, 1, i / segments], i * 4);
    haloGeometry.setAttribute('uv', new BufferAttribute(haloUv, 2));
    const haloMaterial = new MeshBasicNodeMaterial({ color: voice === 1 && band === 0 ? '#ef8d98' : colors[band], transparent: true, opacity: 0, side: DoubleSide, blending: AdditiveBlending, depthWrite: false });
    const haloLevel = glowLevels[strand];
    haloMaterial.opacity = 1;
    haloMaterial.opacityNode = sin(uv().x.mul(Math.PI)).pow(2).mul(haloLevel);

    const halo = new Mesh(haloGeometry, haloMaterial);
    halo.position.z = -2.21 - band * 0.14 - voice * 0.035;
    halo.frustumCulled = false;
    group.add(halo);
    geometries.push(haloGeometry);
    glowAttributes.push(haloPositions);
    glowMaterials.push(haloMaterial);
    const material = new MeshBasicNodeMaterial({
      color: voice === 1 && band === 0 ? '#ef8d98' : colors[band], transparent: true, opacity: 0,
      side: DoubleSide, blending: AdditiveBlending, depthWrite: false,
    });
    const mesh = new Mesh(geometry, material);
    mesh.position.z = -2.2 - band * 0.14 - voice * 0.035;
    mesh.frustumCulled = false;
    group.add(mesh);
    geometries.push(geometry);
    materials.push(material);
    attributes.push(positions);
  }
  return {
    group,
    update(time: number, bass: number, mids: number, highs: number, voiceCount = 4, spectrum?: readonly number[], strength = 1) {
      const energies = [bass, mids, highs];
      const hasSpectrum = !!spectrum && spectrum.length > 3;
      if (hasSpectrum && time !== spectrumTime) {
        spectrumCursor = (spectrumCursor + 1) % spectrumHistory.length;
        const target = spectrumHistory[spectrumCursor];
        for (let k = 0; k < 128; k++) {
          let sum = 0;
          for (let offset = -2; offset <= 2; offset++) {
            const at = Math.round(Math.max(0, Math.min(127, k + offset)) * (spectrum.length - 1) / 127);
            sum += Math.max(0, Math.min(1, spectrum[at]));
          }
          target[k] = sum / 5;
        }
        if (spectrumTime < 0 || time < spectrumTime) for (const row of spectrumHistory) row.set(target);
        spectrumTime = time;
      }
      for (let strand = 0; strand < 12; strand++) {
        const visible = strand < Math.round(voiceCount);
        group.children[strand * 2].visible = visible;
        group.children[strand * 2 + 1].visible = visible;
        if (!visible) continue;
        const band = strand % 3;
        const voice = Math.floor(strand / 3);
        const energy = Math.sqrt(Math.max(0, Math.min(1, energies[band])));
        const positions = attributes[strand];
        const weight = hasSpectrum ? (strand === 0 ? 1 : 0.45 / (1 + strand * 0.3)) : (voice === 0 ? 1 : 0.48 - voice * 0.075);
        const trace = spectrumHistory[(spectrumCursor - strand * 3 + spectrumHistory.length) % spectrumHistory.length];
        const brightness = hasSpectrum ? Math.sqrt(Math.max(...trace)) : energy;
        materials[strand].opacity = Math.min(0.8, brightness * 1.15) * weight * strength;
        glowLevels[strand].value = brightness * 0.2 * weight * strength;
        const haloPositions = glowAttributes[strand];
        const frequency = (2.3 + band * 1.9) * (1 + voice * 0.137);
        for (let i = 0; i <= segments; i++) {
          const s = i / segments;
          const x = (s - 0.5) * 11;
          const envelope = Math.pow(Math.sin(s * Math.PI), 0.65);
          const phase = x * frequency - time * (1.1 + band * 0.35 + voice * 0.09) + voice * 1.3;
          const y = hasSpectrum ? -0.55 + sampleSpectrum(trace, s) * 1.6 * envelope - strand * 0.045 * envelope
            : (Math.sin(phase) + Math.sin(phase * 1.618 + time * 0.4) * 0.16) * energy * (1.1 - band * 0.15) * envelope
            + Math.sin(x * 0.6 + time * 0.13 + voice * 0.7) * 0.12 + (band - 1) * 0.1 + (voice - 1.5) * 0.1 * envelope;
          const width = (0.018 + energy * 0.032) * envelope * (voice === 0 ? 1 : 0.5);
          const derivative = hasSpectrum ? (sampleSpectrum(trace, s + 0.001) - sampleSpectrum(trace, s - 0.001)) * 1.6 / 0.022
            : (Math.cos(phase) + Math.cos(phase * 1.618 + time * 0.4) * 0.16 * 1.618)
            * frequency * energy * (1.1 - band * 0.15) * envelope;
          const inverse = 1 / Math.hypot(1, derivative);
          const nx = -derivative * inverse;
          const ny = inverse;
          positions.setXYZ(i * 2, x - nx * width, y - ny * width, 0);
          positions.setXYZ(i * 2 + 1, x + nx * width, y + ny * width, 0);
          haloPositions.setXYZ(i * 2, x - nx * width * 5, y - ny * width * 5, 0);
          haloPositions.setXYZ(i * 2 + 1, x + nx * width * 5, y + ny * width * 5, 0);
        }
        positions.needsUpdate = true;
        haloPositions.needsUpdate = true;
      }
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const material of glowMaterials) material.dispose();
    },
  };
}





