// Story props: the king's throne, "the future" (a glowing globe) and the
// chain that binds the old robot to the crown.

import { Group, Mesh, MeshBasicNodeMaterial, Vector3 } from 'three/webgpu';
import { mx_noise_float, normalize, positionLocal, smoothstep, vec3, vec4 } from 'three/tsl';
import { ball, bell, blob, lathe, ring, rod } from './shapes.ts';
import { glow, inked, light, place, toon, u } from './toon.ts';

export const DAIS = 0.6;

export function buildThrone(): Group {
  const outer = new Group();
  const throne = new Group();
  throne.position.y = DAIS;
  outer.add(throne);
  const gold = toon(0xdcaa45);
  const velvet = toon(0xa0182e);
  // Stepped dais.
  place(inked(lathe('dais-low', [[0, 0], [1.9, 0], [1.9, 0.3], [0, 0.3]], 48), toon(0x3a1d4a)), outer, 0, 0, 0);
  place(inked(ring(1.9, 0.04), gold), outer, 0, 0.3, 0, Math.PI / 2);
  place(inked(lathe('dais-high', [[0, 0], [1.45, 0], [1.45, 0.3], [0, 0.3]], 48), toon(0x4c2560)), outer, 0, 0.3, 0);
  place(inked(ring(1.45, 0.04), gold), outer, 0, 0.6, 0, Math.PI / 2);
  place(inked(lathe('throne-base', [[0, 0.3], [0.95, 0.3], [1.05, 0.2], [1.0, 0.0], [0, 0]], 40), gold), throne, 0, 0, 0);
  place(inked(blob(1.2, 0.5, 1.0, 4), velvet), throne, 0, 0.55, 0.05);
  place(inked(blob(1.3, 0.12, 1.1, 4), gold), throne, 0, 0.32, 0.05);
  place(inked(blob(1.3, 2.3, 0.3, 3.2), velvet), throne, 0, 1.45, -0.5);
  place(inked(blob(1.5, 2.5, 0.22, 3.2), gold), throne, 0, 1.5, -0.62);
  for (const side of [-1, 1]) {
    place(inked(blob(0.22, 0.6, 1.0, 3.5), gold), throne, side * 0.72, 0.85, 0.05);
    place(inked(ball(0.13, 14), gold), throne, side * 0.72, 1.2, 0.5);
    place(inked(ball(0.14, 14), gold), throne, side * 0.75, 2.85, -0.6);
  }
  place(inked(ring(0.32, 0.06), gold), throne, 0, 2.95, -0.62);
  place(new Mesh(ball(0.14, 14), glow(0xff3a5a, 1.2)), throne, 0, 2.95, -0.58);
  return outer;
}

export interface Globe {
  group: Group;
  glowLevel: ReturnType<typeof u>;
}

export function buildGlobe(): Globe {
  const group = new Group();
  const glowLevel = u(1);
  const material = new MeshBasicNodeMaterial();
  const p = normalize(positionLocal);
  const land = smoothstep(0.05, 0.12, mx_noise_float(p.mul(2.6)).add(mx_noise_float(p.mul(6.0)).mul(0.3)));
  const ocean = vec3(0.12, 0.45, 0.95);
  const green = vec3(0.35, 0.9, 0.5);
  const base = ocean.mul(land.oneMinus()).add(green.mul(land));
  const facing = p.dot(light.keyDir).mul(0.5).add(0.5);
  const shade = smoothstep(0.25, 0.3, facing).mul(0.4).add(0.6);
  material.colorNode = vec4(base.mul(shade).mul(glowLevel.mul(0.6).add(0.5)), 1);
  group.add(inked(ball(0.26, 32), material));
  const aura = glow(0x9fdcff, 0.35);
  aura.transparent = true;
  aura.depthWrite = false;
  place(new Mesh(ring(0.34, 0.012), glow(0xbfefff, 1.2)), group, 0, 0, 0, 1.2, 0.3, 0);
  place(new Mesh(ring(0.38, 0.008), glow(0xffe2a0, 1.0)), group, 0, 0, 0, -0.4, 0.9, 0);
  return { group, glowLevel };
}

export class Chain {
  readonly group = new Group();
  private readonly links: Mesh[] = [];
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly p = new Vector3();
  private readonly next = new Vector3();

  constructor(count = 26) {
    const material = toon(0xb8bccb);
    for (let i = 0; i < count; i += 1) {
      const link = inked(ring(0.085, 0.021), material);
      this.links.push(link);
      this.group.add(link);
    }
  }

  private at(u: number, sag: number, out: Vector3): Vector3 {
    out.copy(this.a).lerp(this.b, u);
    out.y -= Math.sin(u * Math.PI) * sag;
    return out;
  }

  // Draws links from world-space a to b with a sag; reveal grows it from a.
  update(a: Vector3, b: Vector3, reveal: number, sag: number): void {
    this.a.copy(a);
    this.b.copy(b);
    const n = this.links.length;
    this.group.visible = reveal > 0.001;
    for (let i = 0; i < n; i += 1) {
      const link = this.links[i];
      const u = (i + 0.5) / n;
      link.visible = u <= reveal;
      if (!link.visible) {
        continue;
      }
      this.at(u, sag, this.p);
      this.at(Math.min(1, u + 0.01), sag, this.next);
      link.position.copy(this.p);
      link.lookAt(this.next);
      link.rotateZ(i % 2 ? Math.PI / 2 : 0);
      const pop = Math.min(1, (reveal - u) * n * 0.5 + 0.2);
      link.scale.setScalar(Math.max(0.01, pop));
    }
  }
}

export { bell, blob, rod };
