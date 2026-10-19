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
