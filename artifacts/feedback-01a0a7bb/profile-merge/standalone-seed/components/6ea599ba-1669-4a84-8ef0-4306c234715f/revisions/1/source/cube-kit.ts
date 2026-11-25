import { BoxGeometry, Mesh, MeshStandardNodeMaterial } from 'three/webgpu';

// Shared cube primitive. The caller owns the kit and disposes it once.
export function createCubeKit() {
  const geometry = new BoxGeometry(1, 1, 1);
  const palette = [0x36dccc, 0x368dff, 0x9568eb, 0xf078af, 0xffc678, 0xa4e7f5];
  const materials = palette.map(color => new MeshStandardNodeMaterial({
    color,
    metalness: 0.82,
    roughness: 0.23,
  }));
  return {
    makeCube(paletteIndex: number) {
      return new Mesh(geometry, materials[paletteIndex % materials.length]);
    },
    dispose() {
      geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
