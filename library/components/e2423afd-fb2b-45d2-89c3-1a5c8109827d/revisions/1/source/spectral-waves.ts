import { uniform, uv, sin } from 'three/tsl';
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide,
  DynamicDrawUsage, Group, Mesh, MeshBasicNodeMaterial,
} from 'three/webgpu';

// Three audio-band sine ribbons, behind the organism and in front of its habitat.
export function createSpectralWaves() {
  const group = new Group();
  const segments = 192;
  const geometries: BufferGeometry[] = [];
  const materials: MeshBasicNodeMaterial[] = [];
  const attributes: BufferAttribute[] = [];
  const glowAttributes: BufferAttribute[] = [];
  const glowMaterials: MeshBasicNodeMaterial[] = [];
  const glowLevels = [uniform(0), uniform(0), uniform(0)];
  const colors = ['#36ddc2', '#9d84e8', '#e5be93'];
  for (let band = 0; band < 3; band++) {
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
    const haloMaterial = new MeshBasicNodeMaterial({ color: colors[band], transparent: true, opacity: 0, side: DoubleSide, blending: AdditiveBlending, depthWrite: false });
    const haloLevel = glowLevels[band];
    haloMaterial.opacity = 1;
    haloMaterial.opacityNode = sin(uv().x.mul(Math.PI)).pow(2).mul(haloLevel);

    const halo = new Mesh(haloGeometry, haloMaterial);
    halo.position.z = -2.21 - band * 0.14;
    halo.frustumCulled = false;
    group.add(halo);
    geometries.push(haloGeometry);
    glowAttributes.push(haloPositions);
    glowMaterials.push(haloMaterial);
    const material = new MeshBasicNodeMaterial({
      color: colors[band], transparent: true, opacity: 0,
      side: DoubleSide, blending: AdditiveBlending, depthWrite: false,
    });
    const mesh = new Mesh(geometry, material);
    mesh.position.z = -2.2 - band * 0.14;
    mesh.frustumCulled = false;
    group.add(mesh);
    geometries.push(geometry);
    materials.push(material);
    attributes.push(positions);
  }
  return {
    group,
    update(time: number, bass: number, mids: number, highs: number) {
      const energies = [bass, mids, highs];
      for (let band = 0; band < 3; band++) {
        const energy = Math.max(0, Math.min(1, energies[band]));
        const positions = attributes[band];
        materials[band].opacity = energy * 0.85;
        glowLevels[band].value = energy * 0.18;
        const haloPositions = glowAttributes[band];
        const frequency = 2.3 + band * 1.9;
        for (let i = 0; i <= segments; i++) {
          const s = i / segments;
          const x = (s - 0.5) * 11;
          const envelope = Math.pow(Math.sin(s * Math.PI), 0.65);
          const phase = x * frequency - time * (1.1 + band * 0.35);
          const y = (Math.sin(phase) + Math.sin(phase * 1.618 + time * 0.4) * 0.16) * energy * (0.75 - band * 0.12) * envelope
            + Math.sin(x * 0.6 + time * 0.13) * 0.12 + (band - 1) * 0.1;
          const width = (0.012 + energy * 0.014) * envelope;
          positions.setXYZ(i * 2, x, y - width, 0);
          positions.setXYZ(i * 2 + 1, x, y + width, 0);
          haloPositions.setXYZ(i * 2, x, y - width * 5, 0);
          haloPositions.setXYZ(i * 2 + 1, x, y + width * 5, 0);
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



