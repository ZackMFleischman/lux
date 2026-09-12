import { defineVisual } from '@lux/visual-sdk';
import { Scene, Mesh, PlaneGeometry, MeshBasicNodeMaterial, OrthographicCamera } from 'three/webgpu';
import { uniform, vec4 } from 'three/tsl';

export default defineVisual({
  async create(context) {
    const level = uniform(0.5);
    const material = new MeshBasicNodeMaterial();
    material.fragmentNode = vec4(level, 0.2, 0.4, 1);
    const geometry = new PlaneGeometry(1.4, 1.4);
    const scene = new Scene();
    const shape = new Mesh(geometry, material);
    scene.add(shape);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return {
      update(frame) { level.value = frame.controls.intensity; shape.rotation.z = frame.timeSeconds * 0.35; },
      render(target) { return context.renderer.render(scene, camera, target); },
      reset(_seed) {},
      dispose() { geometry.dispose(); material.dispose(); },
    };
  },
});
