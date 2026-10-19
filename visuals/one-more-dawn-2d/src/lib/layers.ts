// 2.5D layer kit: painted plates as textured quads, and "drawn" layers that
// render with Canvas 2D every frame (characters, crowd, light shapes) and are
// uploaded as textures. World units: the stage frame is 16 x 9, centred.

import {
  CanvasTexture,
  DataTexture,
  LinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  NormalBlending,
  AdditiveBlending,
  PlaneGeometry,
  SRGBColorSpace,
  Texture,
} from 'three/webgpu';
import { texture, uniform, uv, vec4 } from 'three/tsl';

// TSL node typings are too narrow for freely composed shader graphs.
type Node = any;

export interface ImageData8 {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface Plate {
  mesh: Mesh;
  opacity: Node;
  dispose(): void;
}

// A painted background plate covering `width` x `height` world units.
export function plate(image: ImageData8, width: number, height: number): Plate {
  const tex = new DataTexture(image.data, image.width, image.height);
  tex.colorSpace = SRGBColorSpace;
  tex.flipY = true;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  const opacity: Node = uniform(1);
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, depthTest: false });
  const sample: Node = texture(tex, uv());
  material.colorNode = vec4(sample.rgb, opacity);
  const geometry = new PlaneGeometry(width, height);
  const mesh = new Mesh(geometry, material);
  return {
    mesh,
    opacity,
    dispose() {
      geometry.dispose();
      material.dispose();
      tex.dispose();
    },
  };
}

export interface DrawnLayer {
  mesh: Mesh;
  texture: Texture;
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  // Pixels per world unit on the canvas.
  ppu: number;
  opacity: Node;
  update(): void;
  dispose(): void;
}

// A Canvas 2D layer of `width` x `height` world units at `ppu` pixels per
// unit. Draw with ctx in canvas pixels, then call update() once per frame.
export function drawnLayer(width: number, height: number, ppu: number, additive = false): DrawnLayer {
  const canvas = new OffscreenCanvas(Math.max(2, Math.round(width * ppu)), Math.max(2, Math.round(height * ppu)));
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  const tex = new CanvasTexture(canvas as unknown as HTMLCanvasElement) as Texture;
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.premultiplyAlpha = true;
  const opacity: Node = uniform(1);
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: additive ? AdditiveBlending : NormalBlending,
    premultipliedAlpha: true,
  });
  const sample: Node = texture(tex, uv());
  material.colorNode = vec4(sample.rgb.mul(opacity), sample.a.mul(opacity));
  const geometry = new PlaneGeometry(width, height);
  const mesh = new Mesh(geometry, material);
  return {
    mesh,
    texture: tex,
    canvas,
    ctx,
    ppu,
    opacity,
    update() {
      tex.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      tex.dispose();
    },
  };
}
