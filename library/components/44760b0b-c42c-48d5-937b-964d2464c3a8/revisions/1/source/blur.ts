import { defineComponent } from '@lux/visual-sdk';
import { DataTexture, Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, Scene, Texture } from 'three/webgpu';
import { createGaussianBlur } from './gaussian-blur.ts';
export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'effects/gaussian-blur',
    label: 'Gaussian Blur',
    description: 'Soft Gaussian-weighted blur with premultiplied alpha and a live pixel radius.',
    tags: ['blur', 'effect'],
    inputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'Image to soften.' } },
    outputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'Blurred image.' } },
    controls: { radius: { type: 'number', label: 'Blur radius', default: 8, min: 0, max: 32, step: 0.1, unit: 'px' } },
    controlDescriptions: { radius: 'Kernel extent in pixels. Zero preserves the sharp image.' },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create() {
    const fallback = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    const blur = createGaussianBlur(fallback, false, true);
    const geometry = new PlaneGeometry(2, 2);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    material.fragmentNode = blur.node;
    material.toneMapped = false;
    const scene = new Scene();
    scene.add(new Mesh(geometry, material));
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    let radius = 8;
    return {
      update(frame) { radius = frame.controls.radius; },
      async evaluate(inputs, evaluation) {
        blur.bind(inputs.image.texture as Texture);
        blur.radius.value.set(radius / inputs.image.width, radius / inputs.image.height);
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {},
      dispose() { geometry.dispose(); material.dispose(); fallback.dispose(); },
    };
  },
});
