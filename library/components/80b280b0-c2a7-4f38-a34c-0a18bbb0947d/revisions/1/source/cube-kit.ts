import { BoxGeometry, InstancedMesh, Mesh, MeshStandardNodeMaterial } from 'three/webgpu';

// Shared cube primitive. The caller owns the kit and disposes it once.
export function createCubeKit() {
  const geometry = new BoxGeometry(1, 1, 1);
  const palette = [0x36dccc, 0x368dff, 0x9568eb, 0xf078af, 0xffc678, 0xa4e7f5];
  const materials = palette.map(color => new MeshStandardNodeMaterial({
    color,
    metalness: 0.82,
    roughness: 0.23,
  }));
  const instanceMaterial = new MeshStandardNodeMaterial({
    color: 0xffffff, metalness: 0.82, roughness: 0.23,
  });
  return {
    makeInstances(count: number) {
      return new InstancedMesh(geometry, instanceMaterial, count);
    },
    makeCube(paletteIndex: number) {
      return new Mesh(geometry, materials[paletteIndex % materials.length]);
    },
    dispose() {
      geometry.dispose();
      instanceMaterial.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
