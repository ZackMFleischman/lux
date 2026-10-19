// Opera-house balconies: three curved tiers with columns, rails and doors
// along the back wall, filled with a robot crowd. Spectators rise into
// view as their doors open ("a billion minds awaken") and turn their heads
// toward whoever is performing. Everything is real geometry so the ink pass
// draws it with thin set lines.

import {
  BackSide,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  MeshBasicNodeMaterial,
  Object3D,
  TorusGeometry,
  Vector3,
} from 'three/webgpu';
import {
  abs,
  dot,
  float,
  floor,
  fract,
  hash,
  instancedBufferAttribute,
  max,
  mix,
  normalize,
  normalWorld,
  smoothstep,
  step,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { ball, blob, can, dome, lathe, rbox } from './shapes.ts';
import { light, spotLight, toon, u } from './toon.ts';

type Node = any;

export const CENTER_Z = 7.4;
export const RADIUS = 14;
const ARC = 0.95;
const TIERS = [
  { floor: 0.0, height: 1.9, seats: 30 },
  { floor: 1.9, height: 1.8, seats: 34 },
  { floor: 3.7, height: 1.8, seats: 38 },
];
const BOXES = 9;

export const crowdState = {
  now: u(0),
  wakeAt: u(1000),
  wallLevel: u(1),
  eyesOpen: 1,
  // Expression mix: awe (brows up, round 'o' mouth), joy (brows up, wide grin).
  awe: 0,
  joy: 0,
  lookX: 0,
  lookY: 0,
};

function arcPoint(theta: number, radius: number, y: number, out = new Vector3()): Vector3 {
  return out.set(Math.sin(theta) * radius, y, CENTER_Z + Math.cos(theta) * radius);
}

// Two-tone shading driven by a per-instance colour attribute.
function tintedToon(tint: Node): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial();
  const n = normalize(normalWorld);
  const lit = smoothstep(0.0, 0.03, dot(n, light.keyDir));
  const tone = mix(tint.mul(light.shadowTint), tint, lit);
  const amount = light.fill.add(light.key).add(spotLight()).min(vec3(1.05, 1.05, 1.05));
  material.colorNode = vec4(tone.mul(amount).mul(crowdState.wallLevel.mul(0.5).add(0.5)), 1);
  return material;
}

// Back wall of each tier: dark panelling with one large door per box. The
// door slides open on the wake wave to show a warm room.
function backWallMaterial(tier: number): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ side: BackSide });
  const x = uv().x.mul(BOXES);
  const box = floor(x);
  const fx = fract(x).sub(0.5);
  const fy = uv().y;
  const centre = (BOXES - 1) / 2;
  const wake = crowdState.wakeAt.add(abs(box.sub(centre)).mul(0.35)).add(float(tier).mul(0.6)).add(hash(box.add(tier * 17)).mul(0.3));
  const open = smoothstep(wake, wake.add(0.7), crowdState.now);
  const inDoor = step(abs(fx), 0.22).mul(step(fy, 0.82)).mul(step(0.05, fy));
  const frame = step(abs(fx), 0.25).mul(step(fy, 0.86)).mul(float(1).sub(inDoor));
  const revealed = step(abs(fx), open.mul(0.22)).mul(inDoor);
  const panelLine = step(abs(fx), 0.006).mul(inDoor);
  const wallTone = mix(vec3(0.26, 0.12, 0.12), vec3(0.14, 0.16, 0.24), float(tier % 2));
  const doorTone = mix(vec3(0.32, 0.2, 0.36), vec3(0.18, 0.26, 0.4), float(tier % 2)).mul(float(1).sub(panelLine.mul(0.5)));
  const roomTone = mix(mix(vec3(0.62, 0.42, 0.24), vec3(0.42, 0.36, 0.42), step(0.5, hash(box.mul(3).add(tier * 5)))), vec3(0.36, 0.42, 0.38), step(0.8, hash(box.mul(7).add(tier * 11))));
  const poster = step(abs(fx.add(0.1)), 0.06).mul(step(abs(fy.sub(0.5)), 0.12)).mul(step(0.5, hash(box.add(tier * 31))));
  void poster;
  const stripe = step(0.5, fract(fx.mul(9)));
  const room = mix(roomTone, roomTone.mul(0.82), stripe);
  const lit = light.fill.mul(1.6).add(light.key.mul(0.15)).max(vec3(0.5, 0.5, 0.55));
  let color: Node = wallTone.mul(lit);
  color = mix(color, vec3(0.75, 0.55, 0.22).mul(lit), frame);
  color = mix(color, mix(doorTone.mul(lit), room, revealed), inDoor);
  material.colorNode = vec4(color.mul(crowdState.wallLevel.mul(0.55).add(0.45)), 1);
  return material;
}

export interface Crowd {
  root: Group;
  update(t: number, focusX: number): void;
  dispose(): void;
}

export function buildCrowd(): Crowd {
  const root = new Group();
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => {
    owned.push(x);
    return x;
  };
  const front = toon(0x7a2a2a);
  const gold = toon(0xd2a43c, { shine: 0.5 });
  const column = toon(0x6e3a2e);

  TIERS.forEach((tier, i) => {
    const r = RADIUS - i * 0.15;
    // Back wall with doors.
    const wall = new Mesh(keep(new CylinderGeometry(r + 1.1, r + 1.1, tier.height, 120, 1, true, Math.PI - ARC, ARC * 2)), backWallMaterial(i));
    wall.position.set(0, tier.floor + tier.height / 2, CENTER_Z);
    root.add(wall);
    // Balcony front (parapet) with a gold rail on top and a dark underside.
    const parapetH = 0.62;
    const parapetMat = front.clone();
    parapetMat.side = DoubleSide;
    const parapet = new Mesh(keep(new CylinderGeometry(r, r, parapetH, 120, 1, true, Math.PI - ARC, ARC * 2)), parapetMat);
    parapet.position.set(0, tier.floor + parapetH / 2, CENTER_Z);
    root.add(parapet);
    const rail = new Mesh(keep(new TorusGeometry(r, 0.07, 12, 160, ARC * 2)), gold);
    rail.rotation.set(Math.PI / 2, 0, Math.PI / 2 - ARC + Math.PI);
    rail.position.set(0, tier.floor + parapetH - 0.03, CENTER_Z);
    root.add(rail);
    const under = new Mesh(keep(new CylinderGeometry(r + 0.02, r + 0.02, 0.12, 120, 1, true, Math.PI - ARC, ARC * 2)), toon(0x2a1210, { shadow: 0 }));
    under.material.side = DoubleSide;
    under.position.set(0, tier.floor + 0.06, CENTER_Z);
    root.add(under);
    // Columns between boxes.
    for (let b = 0; b <= BOXES; b += 1) {
      const theta = Math.PI - ARC + (b / BOXES) * ARC * 2;
      const p = arcPoint(theta, r - 0.05, tier.floor + tier.height / 2);
      const col = new Mesh(can(0.09, tier.height, 24), column);
      col.position.copy(p);
      root.add(col);
      const cap = new Mesh(can(0.14, 0.1, 24), gold);
      cap.position.set(p.x, tier.floor + tier.height - 0.05, p.z);
      root.add(cap);
    }
  });

  // Spectators: per-instance placement, tint, head type and wake timing.
  interface Seat { theta: number; r: number; y: number; scale: number; wake: number; side: number }
  const seats: Seat[] = [];
  TIERS.forEach((tier, i) => {
    for (let s = 0; s < tier.seats; s += 1) {
      const jitter = (Math.sin(s * 12.9898 + i * 78.233) * 43758.5453) % 1;
      const theta = Math.PI - ARC + ((s + 0.5 + jitter * 0.25) / tier.seats) * ARC * 2;
      const box = Math.floor(((theta - (Math.PI - ARC)) / (ARC * 2)) * BOXES);
      seats.push({
        theta,
        r: RADIUS - i * 0.15 + 0.45 + Math.abs(jitter) * 0.25,
        y: tier.floor,
        scale: 1.15 + Math.abs(jitter) * 0.3,
        wake: Math.abs(box - (BOXES - 1) / 2) * 0.35 + i * 0.6 + 0.4 + Math.abs(jitter) * 0.4,
        side: s % 2 ? 1 : -1,
      });
    }
  });
  const n = seats.length;
  const palette = [0x5f8fb0, 0xb06a3c, 0x8a9a52, 0x4f9a96, 0xc9a24a, 0x9a6fa8, 0x8c8f99, 0xb84f45, 0x6f8fa0, 0xa8884f];
  const tints = new Float32Array(n * 3);
  const c = new Color();
  for (let i = 0; i < n; i += 1) {
    // Shuffle colours per seat so no balcony bay repeats its neighbour.
    const shuffled = Math.floor(Math.abs(Math.sin(i * 91.7 + 13.1) * 43758.5453)) % palette.length;
    c.setHex(palette[shuffled]);
    tints.set([c.r, c.g, c.b], i * 3);
  }
  const tintAttr = new InstancedBufferAttribute(tints, 3);
  const tint: Node = instancedBufferAttribute(tintAttr);
  const bodyMat = tintedToon(tint);
  const headMat = tintedToon(tint.mul(1.12));

  const bodies = new InstancedMesh(rbox(0.5, 0.42, 0.34), bodyMat, n);
  const heads = [
    new InstancedMesh(rbox(0.38, 0.27, 0.24), headMat, n),
    new InstancedMesh(blob(0.28, 0.36, 0.28, 2.0), headMat, n),
    new InstancedMesh(lathe('crowd-pot', [[0, -0.13], [0.11, -0.13], [0.18, 0.13], [0, 0.13]], 40), headMat, n),
  ];
  const domes = new InstancedMesh(dome(0.15, 0.7, 32), headMat, n);
  const eyes = new InstancedMesh(blob(0.085, 0.1, 0.04, 2.2), toon(0xf4f1e8, { shadow: 0.3 }), n * 2);
  const pupils = new InstancedMesh(ball(0.013, 12), toon(0x101010, { shadow: 0 }), n * 2);
  const mouths = new InstancedMesh(rbox(0.13, 0.035, 0.03), toon(0x1c1216, { shadow: 0 }), n);
  const brows = new InstancedMesh(rbox(0.2, 0.025, 0.03), toon(0x2a2228, { shadow: 0 }), n);
  const antennas = new InstancedMesh(can(0.022, 0.07, 12), toon(0x9a8f7a), n);
  for (const m of [pupils, mouths, brows]) {
    m.userData.line = 'none';
  }
  for (const m of [bodies, ...heads, domes, eyes, pupils, antennas, mouths, brows]) {
    m.frustumCulled = false;
    root.add(m);
  }
  const kindOf = (i: number) => Math.floor(Math.abs(Math.sin(i * 37.3 + 4.7) * 24634.6345)) % 3;

  const o = new Object3D();
  const head = new Object3D();
  const hidden = new Object3D();
  hidden.scale.setScalar(0);
  hidden.updateMatrix();
  const base = new Vector3();

  return {
    root,
    update(t: number, focusX: number) {
      crowdState.now.value = t;
      const wakeAt = crowdState.wakeAt.value as number;
      seats.forEach((seat, i) => {
        const rise = Math.min(1, Math.max(0, (t - (wakeAt + seat.wake)) / 0.6));
        const ease = rise * rise * (3 - 2 * rise);
        arcPoint(seat.theta, seat.r, seat.y, base);
        // Seated torso sinks below the parapet until its door opens.
        const torsoY = seat.y + 0.62 + (ease - 1) * 0.9;
        o.position.set(base.x, torsoY, base.z);
        o.rotation.set(0, Math.atan2(-base.x, CENTER_Z - base.z), 0);
        const build = (i * 13) % 3;
        o.scale.set(seat.scale * (build === 0 ? 1.25 : build === 1 ? 0.85 : 1.0), seat.scale * (build === 1 ? 1.2 : 0.95), seat.scale);
        o.updateMatrix();
        bodies.setMatrixAt(i, o.matrix);
        // Head turns toward the performer (three-quarter views) with a sway.
        // Face the house centre, then turn 60% of the way toward the
        // performer (angle difference wrapped to -PI..PI).
        const baseYaw = Math.atan2(-base.x, CENTER_Z - base.z);
        const towardYaw = Math.atan2(focusX - base.x, -1 - base.z);
        let diff = towardYaw - baseYaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        const yaw = baseYaw + diff * 0.6 + Math.sin(t * 0.7 + i) * 0.08;
        head.position.set(base.x, torsoY + 0.36 * seat.scale, base.z);
        const headScale = seat.scale * 1.1;
        // Positive look.y means looking up, negative looking down (matches the
        // pupils and the cue sheet).
        head.rotation.set(-0.12 - crowdState.lookY * 0.2, yaw, Math.sin(t * 0.9 + i * 1.7) * 0.06);
        head.scale.setScalar(headScale);
        head.updateMatrix();
        const kind = kindOf(i);
        heads.forEach((m, k) => m.setMatrixAt(i, k === kind ? head.matrix : hidden.matrix));
        o.position.set(0, 0.14, 0);
        o.rotation.set(0, 0, 0);
        o.scale.setScalar(1);
        o.updateMatrix();
        o.matrix.premultiply(head.matrix);
        domes.setMatrixAt(i, hidden.matrix);
        o.position.set(0.1, 0.17, 0);
        o.updateMatrix();
        o.matrix.premultiply(head.matrix);
        antennas.setMatrixAt(i, i % 6 === 0 && kind === 0 ? o.matrix : hidden.matrix);
        const faceZ = kind === 1 ? 0.14 : kind === 2 ? 0.15 : 0.125;
        const awe = crowdState.awe * (0.75 + 0.25 * Math.sin(i * 3.1));
        const joy = crowdState.joy * (0.75 + 0.25 * Math.cos(i * 2.3));
        o.position.set(0, -0.08 - awe * 0.02, faceZ);
        o.rotation.set(0, 0, 0);
        o.scale.set(1 - awe * 0.45 + joy * 0.3, 1 + awe * 2.2 + joy * 0.8, 1);
        o.updateMatrix();
        o.matrix.premultiply(head.matrix);
        mouths.setMatrixAt(i, o.matrix);
        // Neutral brows sit level; awe and joy lift them.
        o.position.set(0, 0.09 + (awe + joy) * 0.03, faceZ);
        o.rotation.set(0, 0, (i % 5 - 2) * 0.025 * (1 - Math.min(1, awe + joy)));
        o.updateMatrix();
        o.matrix.premultiply(head.matrix);
        brows.setMatrixAt(i, o.matrix);
        const open = crowdState.eyesOpen * ease;
        for (let e = 0; e < 2; e += 1) {
          const side = e === 0 ? -1 : 1;
          o.position.set(side * 0.07, 0.02, faceZ - 0.01);
          o.rotation.set(0, 0, 0);
          o.scale.set(1, Math.max(0.08, open), 1);
          o.updateMatrix();
          o.matrix.premultiply(head.matrix);
          eyes.setMatrixAt(i * 2 + e, o.matrix);
          o.position.set(side * 0.07 + crowdState.lookX * 0.01, 0.02 + crowdState.lookY * 0.012, faceZ + 0.012);
          o.scale.set(1, Math.max(0.05, open), 1);
          o.updateMatrix();
          o.matrix.premultiply(head.matrix);
          pupils.setMatrixAt(i * 2 + e, o.matrix);
        }
      });
      for (const m of [bodies, ...heads, domes, eyes, pupils, antennas, mouths, brows]) {
        m.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      for (const d of owned) {
        d.dispose();
      }
    },
  };
}

export { max };
