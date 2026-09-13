import { defineVisual } from '@lux/visual-sdk';
import {
  Scene, Mesh, PlaneGeometry, MeshBasicNodeMaterial, OrthographicCamera,
  DataTexture, RGBAFormat, UnsignedByteType, NearestFilter, SRGBColorSpace,
} from 'three/webgpu';

// SDK 0.2; pair with an admitted source-v2 asset named assets/image.png.
export default defineVisual({
  controls: {
    opacity: { type: 'number', label: 'Opacity', min: 0, max: 1, default: 1, step: 0.01 },
  },
  async create(context) {
    const pixels = context.images.get('assets/image.png');
    if (!pixels) throw Error('Missing required image: assets/image.png');
    const texture = new DataTexture(pixels.data, pixels.width, pixels.height, RGBAFormat, UnsignedByteType);
    texture.colorSpace = SRGBColorSpace;
    texture.flipY = true;
    texture.minFilter = NearestFilter; texture.magFilter = NearestFilter;
    texture.generateMipmaps = false; texture.premultiplyAlpha = false; texture.needsUpdate = true;
    const material = new MeshBasicNodeMaterial();
    material.map = texture; material.transparent = true; material.depthWrite = false; material.toneMapped = false;
    const aspect = context.settings.width / context.settings.height;
    const imageAspect = pixels.width / pixels.height;
    const height = Math.min(2, 2 * aspect / imageAspect);
    const geometry = new PlaneGeometry(height * imageAspect, height);
    const scene = new Scene(); scene.add(new Mesh(geometry, material));
    const camera = new OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 10);
    camera.position.z = 1;
    return {
      update(frame) { material.opacity = frame.controls.opacity; },
      render(target) { return context.renderer.render(scene, camera, target); },
      reset(_seed) {},
      dispose() { texture.dispose(); material.dispose(); geometry.dispose(); },
    };
  },
});
