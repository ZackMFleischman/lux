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

// A foreground cut-out of a plate: the pixels inside `poly` (plate pixel
// coordinates) redrawn above the cast, so figures can stand behind painted
// set pieces (tables, railings). Drawn once; costs one extra quad.
export function matte(image: ImageData8, plateW: number, plateH: number, poly: readonly (readonly [number, number])[], feather = 2): DrawnLayer {
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs))), y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const x1 = Math.min(image.width, Math.ceil(Math.max(...xs))), y1 = Math.min(image.height, Math.ceil(Math.max(...ys)));
  const w = x1 - x0, h = y1 - y0;
  const ppu = image.width / plateW;
  const layer = drawnLayer(w / ppu, h / ppu, ppu);
  const src = new OffscreenCanvas(w, h);
  const sctx = src.getContext('2d') as OffscreenCanvasRenderingContext2D;
  const pixels = sctx.createImageData(w, h);
  for (let y = 0; y < h; y += 1) {
    const row = ((y + y0) * image.width + x0) * 4;
    pixels.data.set(image.data.subarray(row, row + w * 4), y * w * 4);
  }
  sctx.putImageData(pixels, 0, 0);
  const { ctx, canvas } = layer;
  ctx.save();
  ctx.filter = `blur(${feather}px)`;
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(x - x0, y - y0) : ctx.moveTo(x - x0, y - y0)));
  ctx.closePath();
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-in';
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  ctx.restore();
  layer.update();
  layer.mesh.position.set((x0 + w / 2) / ppu - plateW / 2, plateH / 2 - (y0 + h / 2) / ppu, 0);
  return layer;
}
