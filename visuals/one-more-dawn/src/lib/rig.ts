// Shared robot skeleton: root -> hips -> torso -> head, rubber-hose arms and
// legs, expressive eyes and a singing mouth. Characters in cast.ts dress it.

import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three/webgpu';
import { Hose } from './hose.ts';
import { ball, blob, ring } from './shapes.ts';
import { glow, inked, place, toon } from './toon.ts';

export type V3 = [number, number, number];

export interface Pose {
  x: number;
  z: number;
  yaw: number;
  lift: number;
  lean: number;
  tilt: number;
  twist: number;
  squash: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  mouth: number;
  lid: number;
  lookX: number;
  lookY: number;
  eyeGlow: number;
  handL: V3;
  handR: V3;
  bendL: number;
  bendR: number;
  footL: V3;
  footR: V3;
  visible: boolean;
}

export interface Eye {
  group: Group;
  pupil: Group;
  lid: Group;
}

type GlowMaterial = ReturnType<typeof glow>;

export interface Rig {
  name: string;
  root: Group;
  hips: Group;
  torso: Group;
  head: Group;
  jaw: Group;
  mouth: Object3D | null;
  mouthOpen: number;
  eyes: Eye[];
  shoulders: [Vector3, Vector3];
  hipAnchors: [Vector3, Vector3] | null;
  arms: [Hose, Hose];
  legs: [Hose, Hose] | null;
  hands: [Group, Group];
  feet: [Group, Group] | null;
  hipHeight: number;
  rest: Pose;
  props: Record<string, Object3D>;
  glows: GlowMaterial[];
}

export interface SkeletonSpec {
  name: string;
  hipHeight: number;
  torsoY: number;
  neckY: number;
  shoulder: V3;
  armRadius: [number, number];
  armMaterial: MeshBasicNodeMaterial;
  handMaterial: MeshBasicNodeMaterial;
  handSize: number;
  armHang?: number;
  legs?: {
    hip: V3;
    radius: [number, number];
    material: MeshBasicNodeMaterial;
    foot: () => Group;
    stance: number;
  };
}

export function blankPose(): Pose {
  return {
    x: 0,
    z: 0,
    yaw: 0,
    lift: 0,
    lean: 0,
    tilt: 0,
    twist: 0,
    squash: 1,
    headYaw: 0,
    headPitch: 0,
    headRoll: 0,
    mouth: 0,
    lid: 0.15,
    lookX: 0,
    lookY: 0,
    eyeGlow: 1,
    handL: [0, 0, 0],
    handR: [0, 0, 0],
    bendL: 0.5,
    bendR: 0.5,
    footL: [0, 0, 0],
    footR: [0, 0, 0],
    visible: true,
  };
}

export function copyPose(from: Pose, to: Pose): Pose {
  Object.assign(to, from);
  to.handL = [from.handL[0], from.handL[1], from.handL[2]];
  to.handR = [from.handR[0], from.handR[1], from.handR[2]];
  to.footL = [from.footL[0], from.footL[1], from.footL[2]];
  to.footR = [from.footR[0], from.footR[1], from.footR[2]];
  return to;
}

// Three-fingered cartoon mitt. The group's local -Y points along the arm.
export function hand(material: MeshBasicNodeMaterial, size: number): Group {
  const group = new Group();
  place(inked(blob(size, size * 0.95, size * 0.62, 2.2), material), group, 0, -size * 0.35, 0);
  for (let i = 0; i < 3; i += 1) {
    const finger = inked(blob(size * 0.28, size * 0.62, size * 0.28, 2), material);
    place(finger, group, (i - 1) * size * 0.3, -size * 0.85, 0, 0, 0, (i - 1) * 0.18);
  }
  const thumb = inked(blob(size * 0.3, size * 0.5, size * 0.3, 2), material);
  place(thumb, group, size * 0.5, -size * 0.45, size * 0.1, 0, 0, 0.9);
  return group;
}

// Cartoon eye: white, pupil with catchlight, and an upper lid that closes.
export function eye(radius: number, lidMaterial: MeshBasicNodeMaterial, pupilHex = 0x141020): Eye {
  const group = new Group();
  group.add(inked(ball(radius, 24), toon(0xfbfbff)));
  const pupil = new Group();
  const iris = new Mesh(blob(radius * 0.95, radius * 0.95, radius * 0.4, 2), toon(pupilHex, { shadow: 0 }));
  iris.position.z = radius * 0.8;
  pupil.add(iris);
  const shine = new Mesh(ball(radius * 0.17, 10), glow(0xffffff, 1.1));
  shine.position.set(radius * 0.24, radius * 0.27, radius * 0.99);
  pupil.add(shine);
  group.add(pupil);
  const lid = new Group();
  const lidGeometry = new SphereGeometry(radius * 1.08, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const lidMat = lidMaterial.clone();
  lidMat.side = DoubleSide;
  lid.add(new Mesh(lidGeometry, lidMat));
  const edge = new Mesh(ring(radius * 1.08, radius * 0.075), toon(0x151018));
  edge.rotation.x = Math.PI / 2;
  lid.add(edge);
  group.add(lid);
  return { group, pupil, lid };
}

export function skeleton(spec: SkeletonSpec): Rig {
  const root = new Group();
  root.name = spec.name;
  const hips = place(new Group(), root, 0, spec.hipHeight, 0);
  const torso = place(new Group(), hips, 0, spec.torsoY, 0);
  const head = place(new Group(), torso, 0, spec.neckY, 0);
  const jaw = place(new Group(), head, 0, 0, 0);
  const shoulders: [Vector3, Vector3] = [
    new Vector3(-spec.shoulder[0], spec.shoulder[1], spec.shoulder[2]),
    new Vector3(spec.shoulder[0], spec.shoulder[1], spec.shoulder[2]),
  ];
  const arms: [Hose, Hose] = [
    new Hose(spec.armMaterial, torso, spec.armRadius[0], spec.armRadius[1]),
    new Hose(spec.armMaterial, torso, spec.armRadius[0], spec.armRadius[1]),
  ];
  const hands: [Group, Group] = [hand(spec.handMaterial, spec.handSize), hand(spec.handMaterial, spec.handSize)];
  hands[1].scale.x = -1;
  torso.add(hands[0], hands[1]);
  for (const s of shoulders) {
    place(inked(ball(spec.armRadius[0] * 1.7), spec.armMaterial), torso, s.x, s.y, s.z);
  }
  let legs: [Hose, Hose] | null = null;
  let feet: [Group, Group] | null = null;
  let hipAnchors: [Vector3, Vector3] | null = null;
  const rest = blankPose();
  const hang = spec.armHang ?? 0.75;
  rest.handL = [-spec.shoulder[0] - 0.1, spec.shoulder[1] - hang, 0.1];
  rest.handR = [spec.shoulder[0] + 0.1, spec.shoulder[1] - hang, 0.1];
  if (spec.legs) {
    const l = spec.legs;
    legs = [new Hose(l.material, root, l.radius[0], l.radius[1]), new Hose(l.material, root, l.radius[0], l.radius[1])];
    feet = [l.foot(), l.foot()];
    root.add(feet[0], feet[1]);
    hipAnchors = [new Vector3(-l.hip[0], l.hip[1], l.hip[2]), new Vector3(l.hip[0], l.hip[1], l.hip[2])];
    rest.footL = [-l.stance, 0, 0.02];
    rest.footR = [l.stance, 0, 0.02];
  }
  return {
    name: spec.name,
    root,
    hips,
    torso,
    head,
    jaw,
    mouth: null,
    mouthOpen: 1,
    eyes: [],
    shoulders,
    hipAnchors,
    arms,
    legs,
    hands,
    feet,
    hipHeight: spec.hipHeight,
    rest,
    props: {},
    glows: [],
  };
}

const sA = new Vector3();
const sB = new Vector3();
const sC = new Vector3();
const sT = new Vector3();
const DOWN = new Vector3(0, -1, 0);
const q = new Quaternion();

function bendPoint(out: Vector3, a: Vector3, c: Vector3, amount: number, side: number): Vector3 {
  // Elbow: midpoint pushed down and outward so hoses arc naturally.
  out.copy(a).add(c).multiplyScalar(0.5);
  const span = a.distanceTo(c);
  out.y -= span * 0.3 * amount;
  out.x += side * span * 0.28 * amount;
  out.z -= span * 0.05 * amount;
  return out;
}

export function applyPose(rig: Rig, pose: Pose): void {
  rig.root.visible = pose.visible;
  if (!pose.visible) {
    return;
  }
  rig.root.position.x = pose.x;
  rig.root.position.z = pose.z;
  rig.root.rotation.y = pose.yaw;
  rig.hips.position.y = rig.hipHeight + pose.lift;
  const sq = Math.max(0.6, pose.squash);
  rig.hips.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  rig.torso.rotation.set(pose.lean, pose.twist, pose.tilt, 'YXZ');
  rig.head.rotation.set(pose.headPitch, pose.headYaw, pose.headRoll, 'YXZ');
  const open = Math.max(0, Math.min(1, pose.mouth));
  rig.jaw.rotation.x = open * 0.38 * rig.mouthOpen;
  if (rig.mouth) {
    rig.mouth.scale.set(1 - open * 0.2, 0.15 + open * 0.85, 1);
  }
  const closed = Math.max(0, Math.min(1, pose.lid));
  for (const e of rig.eyes) {
    e.pupil.rotation.set(-pose.lookY * 0.45, pose.lookX * 0.5, 0);
    e.lid.rotation.x = -1.4 + closed * 2.95;
  }
  for (const g of rig.glows) {
    g.userData.level.value = pose.eyeGlow;
  }
  for (let i = 0; i < 2; i += 1) {
    const target = i === 0 ? pose.handL : pose.handR;
    const side = i === 0 ? -1 : 1;
    sA.copy(rig.shoulders[i]);
    sC.set(target[0], target[1], target[2]);
    bendPoint(sB, sA, sC, i === 0 ? pose.bendL : pose.bendR, side);
    rig.arms[i].update(sA, sB, sC);
    const h = rig.hands[i];
    h.position.copy(sC);
    rig.arms[i].endTangent(sT);
    q.setFromUnitVectors(DOWN, sT);
    h.quaternion.copy(q);
  }
  if (rig.legs && rig.feet && rig.hipAnchors) {
    for (let i = 0; i < 2; i += 1) {
      const target = i === 0 ? pose.footL : pose.footR;
      const side = i === 0 ? -1 : 1;
      sA.copy(rig.hipAnchors[i]);
      sA.y += rig.hipHeight + pose.lift;
      sC.set(target[0], target[1] + 0.1, target[2]);
      sB.copy(sA).add(sC).multiplyScalar(0.5);
      // Knees bow forward more when the body sinks.
      const drop = Math.max(0, -pose.lift);
      sB.z += 0.06 + drop * 1.6;
      sB.x += side * (0.03 + drop * 0.5);
      rig.legs[i].update(sA, sB, sC);
      rig.feet[i].position.set(target[0], target[1], target[2]);
    }
  }
}

export function disposeRig(rig: Rig): void {
  for (const hose of rig.arms) {
    hose.dispose();
  }
  if (rig.legs) {
    for (const hose of rig.legs) {
      hose.dispose();
    }
  }
}
