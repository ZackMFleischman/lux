// Rounded cartoon primitives. Shapes are baked into geometry (not mesh
// scale) so the ink outline keeps an even weight.

import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  LatheGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three/webgpu';

const cache = new Map<string, BufferGeometry>();

function cached(key: string, make: () => BufferGeometry): BufferGeometry {
  let geometry = cache.get(key);
  if (!geometry) {
    geometry = make();
    cache.set(key, geometry);
  }
  return geometry;
}

export function disposeShapes(): void {
  for (const geometry of cache.values()) {
    geometry.dispose();
  }
  cache.clear();
}

// Superellipsoid: e = 2 is an ellipsoid, larger values give a "squircle"
// box. w, h, d are full sizes.
export function blob(w: number, h: number, d: number, e = 2, segments = 44): BufferGeometry {
  return cached(`blob:${w}:${h}:${d}:${e}:${segments}`, () => {
    const geometry = new SphereGeometry(1, segments, Math.round(segments * 0.75));
    const p = geometry.getAttribute('position') as BufferAttribute;
    const power = 2 / e;
    const shaped = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), power);
    for (let i = 0; i < p.count; i += 1) {
      p.setXYZ(i, shaped(p.getX(i)) * w * 0.5, shaped(p.getY(i)) * h * 0.5, shaped(p.getZ(i)) * d * 0.5);
    }
    geometry.computeVertexNormals();
    return geometry;
  });
}

export function ball(r: number, segments = 36): BufferGeometry {
  return cached(`ball:${r}:${segments}`, () => new SphereGeometry(r, segments, Math.round(segments * 0.75)));
}

export function rod(rTop: number, rBottom: number, h: number, segments = 18): BufferGeometry {
  return cached(`rod:${rTop}:${rBottom}:${h}:${segments}`, () => new CylinderGeometry(rTop, rBottom, h, segments));
}

export function ring(r: number, tube: number, arc = Math.PI * 2): BufferGeometry {
  return cached(`ring:${r}:${tube}:${arc}`, () => new TorusGeometry(r, tube, 16, 96, arc));
}

// Lathe from [radius, height] pairs; used for skirts, hats, gowns, throne.
export function lathe(name: string, profile: readonly (readonly [number, number])[], segments = 72, phiStart = 0, phiLength = Math.PI * 2): BufferGeometry {
  return cached(`lathe:${name}`, () => {
    // LatheGeometry faces outward when the profile runs bottom to top.
    const ordered = profile[0][1] > profile[profile.length - 1][1] ? [...profile].reverse() : profile;
    const points = ordered.map(([r, y]) => new Vector2(r, y));
    const geometry = new LatheGeometry(points, segments, phiStart, phiLength);
    geometry.computeVertexNormals();
    return geometry;
  });
}

// Smooth bell profile helper: radius eased between r0 at y0 and r1 at y1.
export function bell(r0: number, r1: number, y0: number, y1: number, flare = 1.6, steps = 10): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const u = i / steps;
    out.push([r0 + (r1 - r0) * Math.pow(u, flare), y0 + (y1 - y0) * u]);
  }
  return out;
}

export const UP = new Vector3(0, 1, 0);

// Hard-surface kit: rounded box (small bevel), bevelled can, dome.
export function rbox(w: number, h: number, d: number): BufferGeometry {
  return blob(w, h, d, 9, 56);
}

export function can(r: number, h: number, segments = 64): BufferGeometry {
  return cached(`can:${r}:${h}:${segments}`, () => {
    const bevel = Math.min(r, h) * 0.12;
    const profile: [number, number][] = [
      [0, -h / 2],
      [r - bevel, -h / 2],
      [r, -h / 2 + bevel],
      [r, h / 2 - bevel],
      [r - bevel, h / 2],
      [0, h / 2],
    ];
    const geometry = new LatheGeometry(profile.map(([x, y]) => new Vector2(x, y)), segments);
    geometry.computeVertexNormals();
    return geometry;
  });
}

export function dome(r: number, squash = 1, segments = 64): BufferGeometry {
  return cached(`dome:${r}:${squash}:${segments}`, () => {
    const geometry = new SphereGeometry(r, segments, Math.round(segments / 2), 0, Math.PI * 2, 0, Math.PI / 2);
    geometry.scale(1, squash, 1);
    geometry.computeVertexNormals();
    return geometry;
  });
}
