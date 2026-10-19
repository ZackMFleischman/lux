// Flat broadcast-cartoon shading: one base colour and one hard-edged,
// hue-shifted shadow tone, with theatrical spot pools that brighten whole
// areas rather than shade them. Ink lines are not drawn here; the stage
// renderer writes an ID/normal buffer and the ink pass draws even,
// screen-space lines from it (see ../engine/ink.ts).

import {
  BufferGeometry,
  Color,
  Mesh,
  MeshBasicNodeMaterial,
  Object3D,
  Vector2,
  Vector3,
  Vector4,
} from 'three/webgpu';
import {
  dot,
  float,
  length,
  mix,
  normalize,
  normalWorld,
  positionWorld,
  transformedNormalView,
  smoothstep,
  uniform,
  vec3,
  vec4,
} from 'three/tsl';

// TSL node typings are too narrow for freely composed shader graphs.
type Node = any;

// Uniform with a loosely typed node so colours and vectors combine freely.
export function u(value: number | Color | Vector2 | Vector3 | Vector4): Node {
  return uniform(value as never);
}

function spotUniforms() {
  return {
    // x, z on the stage floor, radius, intensity
    shape: u(new Vector4(0, 0, 1.5, 0)),
    color: u(new Color(1, 1, 1)),
    // Height of the lamp, used for the beam meshes.
    height: u(9),
  };
}

export const light = {
  keyDir: u(new Vector3(-0.75, 0.6, 0.45).normalize()),
  key: u(new Color(1, 1, 1)),
  fill: u(new Color(0.12, 0.12, 0.2)),
  shadowTint: u(new Color(0.58, 0.5, 0.66)),
  spots: [spotUniforms(), spotUniforms(), spotUniforms(), spotUniforms(), spotUniforms()],
};

export type Spot = (typeof light.spots)[number];

// Flat-topped disc of light on the floor plane for one spot (0..1).
export function spotPool(spot: Spot): Node {
  const d = length(positionWorld.xz.sub(spot.shape.xy));
  const r = spot.shape.z;
  return float(1).sub(smoothstep(r.mul(0.97), r, d)).mul(spot.shape.w);
}

export function spotLight(): Node {
  let sum: Node = vec3(0, 0, 0);
  for (const spot of light.spots) {
    sum = sum.add(spot.color.mul(spotPool(spot)));
  }
  return sum;
}

export interface ToonOptions {
  // Hard white highlight shape for glossy metal or glass (0 = none).
  shine?: number;
  // Self-lit amount (screens, bulbs on a costume).
  emissive?: number;
  // Shadow tone strength: 1 = full two-tone, 0 = flat.
  shadow?: number;
}

export function toon(hex: number, options: ToonOptions = {}): MeshBasicNodeMaterial {
  const base: Node = u(new Color(hex));
  const material = new MeshBasicNodeMaterial();
  const n: Node = normalize(normalWorld);
  const ndl = dot(n, light.keyDir);
  // One hard terminator, very slightly anti-aliased.
  const lit = smoothstep(0.0, 0.03, ndl);
  const shadowAmount = options.shadow ?? 1;
  const shadow = base.mul(mix(vec3(1, 1, 1), light.shadowTint, shadowAmount));
  const tone: Node = mix(shadow, base, lit);
  const light3: Node = light.fill.add(light.key).add(spotLight());
  let color: Node = tone.mul(light3);
  const shine = options.shine ?? 0;
  if (shine > 0) {
    // Painted cartoon highlight: a hard "bean" where the view-space normal
    // faces up-left toward the viewer, so it stays put like a drawn decal.
    const nv: Node = normalize(transformedNormalView);
    const bean = smoothstep(0.946, 0.95, dot(nv, normalize(vec3(-0.45, 0.55, 0.7))));
    color = mix(color, base.mul(0.35).add(vec3(0.75, 0.75, 0.72)).mul(light.key.add(light.fill).add(spotLight()).min(1.4)), bean.mul(shine));
  }
  const emissive = options.emissive ?? 0;
  if (emissive > 0) {
    color = color.add(base.mul(emissive));
  }
  material.colorNode = vec4(color, 1);
  material.userData.base = base;
  return material;
}

// Unlit glowing colour, e.g. bulbs and eyes; intensity can be animated.
export function glow(hex: number, intensity = 1): MeshBasicNodeMaterial & { userData: { level: Node } } {
  const base = u(new Color(hex));
  const level = u(intensity);
  const material = new MeshBasicNodeMaterial();
  material.colorNode = vec4(base.mul(level), 1);
  material.userData.level = level;
  material.userData.base = base;
  return material as MeshBasicNodeMaterial & { userData: { level: Node } };
}

// A mesh that takes part in the ink pass. `ink: false` keeps it out of line
// detection (e.g. tiny glints), `line` picks the line class.
export function inked(geometry: BufferGeometry, material: MeshBasicNodeMaterial, _scale = 1): Mesh {
  return new Mesh(geometry, material);
}

// Place a part: position and rotation.
export function place<T extends Object3D>(
  object: T,
  parent: Object3D,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0,
): T {
  object.position.set(x, y, z);
  object.rotation.set(rx, ry, rz);
  parent.add(object);
  return object;
}

export function blendHex(a: number, b: number, t: number): number {
  return new Color(a).lerp(new Color(b), t).getHex();
}

export { mix };
