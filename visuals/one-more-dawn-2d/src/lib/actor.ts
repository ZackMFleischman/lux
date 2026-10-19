// An actor is a drawn layer placed in the 16x9 world, with an optional floor
// reflection that reuses the same texture upside down (no second draw).

import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Scene } from 'three/webgpu';
import { float, smoothstep, texture, uniform, uv, vec2, vec4 } from 'three/tsl';
import { drawnLayer, DrawnLayer } from './layers.ts';
import type { Ctx } from './ink.ts';

type Node = any;

export interface Actor {
  layer: DrawnLayer;
  reflect: Node;
  draw(paint: (ctx: Ctx) => void): void;
  place(footX: number, footY: number, scale?: number): void;
  fade(v: number): void;
  setVisible(on: boolean): void;
  dispose(): void;
}

export interface ActorOptions {
  width: number;         // layer size, world units
  height: number;
  footX: number;         // design origin inside the layer, world units from bottom-left
  footY: number;
  designPerUnit: number; // design units per world unit
  z: number;             // render order
  reflection?: number;   // floor reflection strength (0 = none)
  shadow?: number;       // contact shadow half-width in design units (0 = none)
  light?: boolean;       // stage lighting pass: warm top rim + cool falloff toward the feet
}

export function actor(scene: Scene, ppu: number, o: ActorOptions): Actor {
  const layer = drawnLayer(o.width, o.height, ppu);
  layer.mesh.renderOrder = o.z;
  scene.add(layer.mesh);
  const reflect: Node = uniform(o.reflection ?? 0);
  let mirror: Mesh | undefined;
  let mirrorMaterial: MeshBasicNodeMaterial | undefined;
  if (o.reflection) {
    mirrorMaterial = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, depthTest: false, premultipliedAlpha: true });
    const st: Node = vec2(uv().x, float(1).sub(uv().y));
    const sample: Node = texture(layer.texture, st);
    // Strongest right under the feet, fading away from them.
    const fade: Node = smoothstep(0.35, 1.0, uv().y).mul(reflect);
    mirrorMaterial.colorNode = vec4(sample.rgb.mul(fade), sample.a.mul(fade));
    mirror = new Mesh(new PlaneGeometry(o.width, o.height), mirrorMaterial);
    mirror.renderOrder = o.z - 0.5;
    scene.add(mirror);
  }
  const centreAboveFeet = o.height / 2 - o.footY;
  const rimCanvas = o.light ? new OffscreenCanvas(layer.canvas.width, layer.canvas.height) : undefined;
  const rimCtx = rimCanvas?.getContext('2d') as OffscreenCanvasRenderingContext2D | undefined;
  return {
    layer,
    reflect,
    draw(paint) {
      const { ctx, canvas, ppu: p } = layer;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const k = p / o.designPerUnit;
      ctx.setTransform(k, 0, 0, k, o.footX * p, canvas.height - o.footY * p);
      paint(ctx);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (rimCanvas && rimCtx) {
        // Rim: the silhouette minus itself shifted down leaves a band along
        // every top edge; tint it warm and lay it over the figure.
        const d = Math.max(1, Math.round(3.2 * k));
        rimCtx.globalCompositeOperation = 'copy';
        rimCtx.drawImage(canvas, 0, 0);
        rimCtx.globalCompositeOperation = 'destination-out';
        rimCtx.drawImage(canvas, -d * 0.4, d);
        rimCtx.globalCompositeOperation = 'source-in';
        rimCtx.fillStyle = 'rgba(255,226,160,0.75)';
        rimCtx.fillRect(0, 0, rimCanvas.width, rimCanvas.height);
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        // Cool falloff toward the feet, warm key toward the head.
        const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
        g.addColorStop(0, 'rgba(255,214,150,0.10)');
        g.addColorStop(0.55, 'rgba(255,214,150,0)');
        g.addColorStop(1, 'rgba(40,24,80,0.28)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(rimCanvas, 0, 0);
        ctx.restore();
      }
      if (o.shadow) {
        ctx.save();
        ctx.setTransform(k, 0, 0, k, o.footX * p, canvas.height - o.footY * p);
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.filter = `blur(${Math.max(1, 6 * k)}px)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, o.shadow, o.shadow * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      layer.update();
    },
    place(footX, footY, scale = 1) {
      layer.mesh.scale.set(scale, scale, 1);
      layer.mesh.position.x = footX + (o.width / 2 - o.footX) * scale;
      layer.mesh.position.y = footY + centreAboveFeet * scale;
      if (mirror) {
        mirror.scale.set(scale, scale, 1);
        mirror.position.x = layer.mesh.position.x;
        mirror.position.y = footY - centreAboveFeet * scale;
      }
    },
    fade(v) {
      layer.opacity.value = v;
      reflect.value = (o.reflection ?? 0) * v;
      layer.mesh.visible = v > 0.002;
      if (mirror) mirror.visible = v > 0.002;
    },
    setVisible(on) {
      layer.mesh.visible = on;
      if (mirror) mirror.visible = on;
    },
    dispose() {
      layer.dispose();
      mirror?.geometry.dispose();
      mirrorMaterial?.dispose();
    },
  };
}
