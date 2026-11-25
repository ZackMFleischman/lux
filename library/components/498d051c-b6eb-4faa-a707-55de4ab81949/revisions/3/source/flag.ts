import { CylinderGeometry, DataTexture, DoubleSide, Group, LinearFilter, Mesh, MeshBasicNodeMaterial, PlaneGeometry, RGBAFormat, SRGBColorSpace, UnsignedByteType } from 'three/webgpu';
import { positionLocal, sin, uniform, uv, vec3 } from 'three/tsl';
import { pilotPixels } from './pilot-pixels.ts';

export function createAlienFlag() {
  const root = new Group();
  const clock = uniform(0);
  const poleGeometry = new CylinderGeometry(0.018, 0.025, 1.5, 12);
  const clothGeometry = new PlaneGeometry(0.88, 0.66, 20, 12);
  clothGeometry.translate(0.44, 1.08, 0);
  const poleMaterial = new MeshBasicNodeMaterial({ color: 0xb9d9e2 });
  const pole = new Mesh(poleGeometry, poleMaterial);
  pole.position.y = 0.75;
  root.add(pole);
  const wave = sin(positionLocal.x.mul(9).sub(clock.mul(2.6))).mul(uv().x.pow(1.5)).mul(0.095);
  const clothMaterial = new MeshBasicNodeMaterial({ color: 0xd1eee7, side: DoubleSide });
  clothMaterial.positionNode = positionLocal.add(vec3(0, wave.mul(0.17), wave));
  root.add(new Mesh(clothGeometry, clothMaterial));
  const texture = new DataTexture(pilotPixels(), 192, 192, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = true;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  const emblemMaterial = new MeshBasicNodeMaterial({ map: texture, transparent: true, alphaTest: 0.02, side: DoubleSide });
  emblemMaterial.positionNode = positionLocal.add(vec3(0, wave.mul(0.17), wave.add(0.005)));
  const emblemGeometry = new PlaneGeometry(0.6, 0.6, 20, 12);
  emblemGeometry.translate(0.45, 1.08, 0);
  // Identical displacement coordinates keep the emblem attached to the cloth.
  const emblemWave = sin(positionLocal.x.mul(9).sub(clock.mul(2.6))).mul(positionLocal.x.div(0.88).pow(1.5)).mul(0.095);
  emblemMaterial.positionNode = positionLocal.add(vec3(0, emblemWave.mul(0.17), emblemWave.add(0.005)));
  root.add(new Mesh(emblemGeometry, emblemMaterial));
  return {
    root,
    update(time: number, deployed: number, size: number) {
      clock.value = time;
      root.visible = deployed > 0.001;
      root.scale.set(size, size * deployed, size);
    },
    dispose() {
      root.removeFromParent();
      poleGeometry.dispose();
      clothGeometry.dispose();
      emblemGeometry.dispose();
      poleMaterial.dispose();
      clothMaterial.dispose();
      emblemMaterial.dispose();
      texture.dispose();
    },
  };
}
