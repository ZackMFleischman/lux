// Clip "chain" (57.4 s – 72.5 s): The future in his hands, the chain, the soldiers, the bow (verse lines 5–8).
// This file owns everything on screen in its window: camera, lighting cues
// and every performer's pose. Start from defaultFrame and replace parts of
// it here; do not edit shared engine, cast or set files from a clip lane.
//
// Shot list (song seconds; words from BARITONE_WORDS):
//   A 57.40  Medium two-shot. The globe floats down; Barnaby reaches up on
//            "future" and catches it on "hands". The children toddle in.
//   B 60.65  Low wide on the throne. The king winds up and raises the
//            sceptre on "Yet"; the chain whips out toward Barnaby.
//   C 62.45  Insert on Barnaby's wrist. The chain snaps tight on "chain";
//            the shot eases out to a medium as he looks down, then up at
//            the king.
//   E 64.42  Dramatic wide. Soldiers march in from both wings; Barnaby
//            steps between them; they aim on "wars" (red flash). The
//            children shelter at his side.
//   F 67.20  Low hero medium: the globe held high. The soldiers lower their
//            rifles on "never".
//   G 68.46  Final tableau: soldiers snap to attention, Barnaby turns and
//            bows to the king in profile on "reign", offering the globe.

import { Color, Vector3, type PerspectiveCamera } from 'three/webgpu';
import { applyPose, blankPose, copyPose, type Pose, type Rig, type V3 } from '../rig.ts';
import { BARITONE_WORDS as W } from '../song.ts';
import { backOut, clamp01, easeOut, keys, lerp, noise1, ramp, smooth, span, type Ease, type Key } from '../time.ts';
import {
  ariaPose,
  barnabyPose,
  blinkAt,
  defaultFrame,
  guardPose,
  kidPose,
  kingPose,
  lighting,
  mixV,
  red,
  setSpot,
  sing,
  speedOf,
  travelled,
  walk,
  type Cast,
} from '../show.ts';
import { set } from '../stage.ts';

const START = 57.4;
const END = 72.5;

// Word cues inside the window.
const T = {
  placed: W[23][0], // 57.76
  future: W[25][0], // 58.32
  hands: W[28][0], // 59.54
  yet: W[29][0], // 61.04
  us: W[31][0], // 61.72
  chain: W[34][0], // 62.88
  begged: W[35][0], // 64.42
  prevent: W[39][0], // 65.90
  wars: W[41][0], // 66.78
  but: W[42][0], // 67.66
  never: W[43][0], // 67.98
  brk: W[44][0], // 68.46
  reign: W[46][0], // 69.50
};

// Blend weight from the default staging into this clip's staging. The
// first 0.25 s matches defaultFrame exactly.
function handoff(t: number): number {
  return ramp(t, START + 0.24, START + 0.6);
}

type VKey = readonly [number, V3, Ease?];

// Keyed V3 track; each key may carry the ease used to arrive at it.
function track(t: number, list: readonly VKey[]): V3 {
  if (t <= list[0][0]) {
    return list[0][1];
  }
  for (let i = 1; i < list.length; i += 1) {
    const [t1, v1, ease] = list[i];
    if (t <= t1) {
      const [t0, v0] = list[i - 1];
      const u = (ease ?? smooth)(clamp01((t - t0) / Math.max(1e-6, t1 - t0)));
      return [lerp(v0[0], v1[0], u), lerp(v0[1], v1[1], u), lerp(v0[2], v1[2], u)];
    }
  }
  return list[list.length - 1][1];
}

// Scalar keys with a per-key ease (for snaps with overshoot).
function ekeys(t: number, list: readonly (readonly [number, number, Ease?])[]): number {
  if (t <= list[0][0]) {
    return list[0][1];
  }
  for (let i = 1; i < list.length; i += 1) {
    const [t1, v1, ease] = list[i];
    if (t <= t1) {
      const [t0, v0] = list[i - 1];
      return lerp(v0, v1, (ease ?? smooth)(clamp01((t - t0) / Math.max(1e-6, t1 - t0))));
    }
  }
  return list[list.length - 1][1];
}

const mirror = (v: V3): V3 => [-v[0], v[1], v[2]];

const NUM: (keyof Pose)[] = ['x', 'z', 'yaw', 'lift', 'lean', 'tilt', 'twist', 'squash', 'headYaw', 'headPitch', 'headRoll', 'mouth', 'lid', 'lookX', 'lookY', 'eyeGlow', 'bendL', 'bendR'];

function blendPose(out: Pose, a: Pose, b: Pose, w: number): void {
  const o = out as unknown as Record<string, number>;
  const ra = a as unknown as Record<string, number>;
  const rb = b as unknown as Record<string, number>;
  for (const k of NUM) {
    o[k] = lerp(ra[k], rb[k], w);
  }
  out.handL = mixV(a.handL, b.handL, w);
  out.handR = mixV(a.handR, b.handR, w);
  out.footL = mixV(a.footL, b.footL, w);
  out.footR = mixV(a.footR, b.footR, w);
  out.visible = w < 0.5 ? a.visible : b.visible;
}

// Travel direction for a keyed path (yaw facing the way the body moves).
function heading(t: number, xs: readonly Key[], zs: readonly Key[], fallback: number): number {
  const dx = keys(t + 0.05, xs, smooth) - keys(t - 0.05, xs, smooth);
  const dz = keys(t + 0.05, zs, smooth) - keys(t - 0.05, zs, smooth);
  return Math.hypot(dx, dz) < 1e-4 ? fallback : Math.atan2(dx, dz);
}

// ---------------------------------------------------------------- Barnaby

const BX: Key[] = [[START, 2.3], [65.1, 2.3], [66.35, 2.15], [T.brk + 0.1, 2.15], [T.reign - 0.1, 2.65]];
const BZ: Key[] = [[START, 0.5], [65.1, 0.5], [66.35, 1.3], [T.brk + 0.1, 1.3], [T.reign - 0.1, 1.05]];

// Left hand, torso space. The right hand mirrors it unless given.
const BL: VKey[] = [
  [START + 0.3, [-0.54, 0.03, 0.1]],
  [T.placed + 0.15, [-0.44, 0.14, 0.3]], // anticipation: gather low
  [T.future + 0.2, [-0.62, 1.3, 0.42], backOut], // reach up and out to the globe
  [T.hands - 0.35, [-0.42, 0.8, 0.62]],
  [T.hands + 0.05, [-0.2, 0.34, 0.62]], // catch
  [T.hands + 0.22, [-0.2, 0.28, 0.62]], // weight settles
  [T.hands + 0.6, [-0.19, 0.4, 0.58]],
  [60.95, [-0.36, 0.3, 0.66]], // show it to the children
  [T.chain - 0.02, [-0.36, 0.3, 0.66]],
  [T.chain + 0.1, [-0.66, 0.55, 0.4], easeOut], // yanked by the chain
  [T.chain + 0.55, [-0.32, 0.38, 0.58]],
  [64.1, [-0.18, 0.42, 0.5]], // protective, at the chest
  [T.wars - 0.2, [-0.18, 0.42, 0.5]],
  [T.wars + 0.05, [-0.22, 0.26, 0.46]], // anticipation
  [T.wars + 0.35, [-0.22, 1.95, 0.12], backOut], // the future held high
  [T.brk, [-0.22, 1.88, 0.12]],
  [T.brk + 0.55, [-0.18, 0.52, 0.52]],
  [T.reign + 0.5, [-0.2, 0.42, 0.74], backOut], // offered to the throne
  [END, [-0.2, 0.42, 0.74]],
];
const BR: VKey[] = BL.map(([t, v, e]) => [t, mirror(v), e] as VKey);
// Right hand differs while showing the globe and on the jolt.
const BR_SHOW: VKey[] = [
  [60.5, [0.19, 0.4, 0.58]],
  [60.95, [0.04, 0.3, 0.7]],
  [T.chain - 0.02, [0.04, 0.3, 0.7]],
  [T.chain + 0.1, [-0.16, 0.44, 0.6], easeOut],
  [T.chain + 0.55, [0.06, 0.38, 0.6]],
  [64.1, [0.18, 0.42, 0.5]],
];

function barnaby(t: number, rig: Rig, out: Pose): void {
  const p = copyPose(rig.rest, out);
  p.x = keys(t, BX, smooth);
  p.z = keys(t, BZ, smooth);
  const moving = clamp01(speedOf(t, BX, BZ) / 0.9);
  const phase = travelled(t, BX, BZ) * 4.6;
  p.yaw = ekeys(t, [
    [START, -0.1],
    [60.5, -0.1],
    [60.95, -0.55],
    [T.chain, -0.55],
    [T.chain + 0.12, -0.78, easeOut],
    [T.chain + 0.6, -0.62],
    [64.1, -0.8],
    [T.begged + 0.3, -0.3],
    [66.4, -0.05],
    [T.brk, -0.05],
    [T.reign - 0.15, -1.6],
  ]);
  // Old-timer stoop, breathing.
  p.lean = 0.12 + Math.sin(t * 1.3) * 0.015;
  p.lift = Math.sin(t * 1.6) * 0.008;
  walk(p, rig, phase, moving, 0.2, 0.12);
  p.tilt += Math.sin(phase) * 0.04 * moving;
  // Catch: a little dip under the globe's weight, then a proud rise.
  const catchDip = ekeys(t, [[T.hands - 0.05, 0], [T.hands + 0.15, 1, easeOut], [T.hands + 0.7, 0]]);
  p.squash = 1 - catchDip * 0.05;
  p.lift -= catchDip * 0.035;
  // Reach: rise on the toes for "future".
  p.lift += span(t, T.placed + 0.2, T.hands - 0.1, 0.4, 0.5) * 0.04;
  // Jolt: the chain snaps tight and pulls him toward the throne.
  const jolt = ekeys(t, [[T.chain - 0.02, 0], [T.chain + 0.08, 1, easeOut], [T.chain + 0.3, -0.25], [T.chain + 0.7, 0]]);
  p.tilt += jolt * 0.16;
  p.squash -= Math.max(0, jolt) * 0.07;
  p.lean += jolt * 0.08;
  // Wistful sag after the chain, straightening when the soldiers come.
  const wistful = span(t, T.chain + 0.4, T.begged + 0.1, 0.5, 0.35);
  p.lean += wistful * 0.1;
  p.lift -= wistful * 0.02;
  // Brace: anticipation before lifting the globe overhead, then stretch.
  const brace = ekeys(t, [[T.wars - 0.2, 0], [T.wars + 0.05, 1], [T.wars + 0.35, -0.6, backOut], [T.wars + 0.8, -0.35], [T.brk, -0.35], [T.brk + 0.5, 0]]);
  p.lift -= Math.max(0, brace) * 0.05;
  p.lift += Math.max(0, -brace) * 0.05;
  p.lean -= Math.max(0, -brace) * 0.15;
  // The bow on "reign", held through the fade.
  const bow = ekeys(t, [[T.reign - 0.05, 0], [T.reign + 0.55, 1.08, easeOut], [T.reign + 1.0, 1]]);
  p.lean += bow * 0.6;
  p.lift -= bow * 0.09;
  const handL = track(t, BL);
  const handR = t < 60.5 || t > 64.1 ? track(t, BR) : track(t, BR_SHOW);
  p.handL = handL;
  p.handR = handR;
  p.bendL = 0.5;
  p.bendR = 0.5;
  // Head: up at the globe, down at the hands, to the children, the wrist,
  // up the chain to the king, the soldiers, the globe overhead, the bow.
  p.headPitch = ekeys(t, [
    [START, 0],
    [T.placed + 0.3, -0.45],
    [T.hands - 0.5, -0.28],
    [T.hands + 0.1, 0.18],
    [60.3, 0.08],
    [60.95, 0.24],
    [T.chain, 0.24],
    [T.chain + 0.15, 0.44, easeOut],
    [63.6, 0.38],
    [64.15, -0.16],
    [T.begged + 0.2, -0.05],
    [T.wars, 0],
    [T.wars + 0.4, -0.36],
    [T.never, -0.3],
    [T.never + 0.35, 0.12],
    [T.brk + 0.4, 0.04],
    [T.reign + 0.6, 0.26],
  ]);
  p.headYaw = ekeys(t, [
    [START, 0],
    [60.6, 0],
    [60.95, -0.25],
    [T.chain, -0.25],
    [T.chain + 0.15, -0.2],
    [63.6, -0.15],
    [64.15, -0.45],
    [T.begged + 0.1, -0.55],
    [T.begged + 0.4, 0.55],
    [65.4, 0.5],
    [65.7, -0.5],
    [66.2, -0.4],
    [66.6, 0],
    [T.never, 0],
    [T.never + 0.2, -0.3],
    [T.never + 0.45, 0.3],
    [T.brk + 0.2, 0],
  ]);
  p.headRoll = Math.sin(t * 1.1) * 0.03 + span(t, T.chain + 0.5, T.begged, 0.5, 0.4) * 0.14 - span(t, T.hands, 60.6, 0.3, 0.4) * 0.08;
  p.lookX = p.headYaw * 0.5;
  p.lookY = -p.headPitch * 1.1;
  // Heavier lids when wistful and in the bow; wide on the jolt.
  p.lid = 0.36 + wistful * 0.18 + bow * 0.2 - span(t, T.chain, T.chain + 0.5, 0.05, 0.3) * 0.3 + blinkAt(t, 0.9);
  p.mouth = sing(t, W);
  p.headPitch -= p.mouth * 0.06;
  p.headRoll += p.mouth * Math.sin(t * 3.0) * 0.03;
}

// ---------------------------------------------------------------- children

interface KidPlan {
  xs: Key[];
  zs: Key[];
  delay: number;
}

const KIDS: [KidPlan, KidPlan] = [
  // Pip: in from the left to Barnaby's side, then shelters downstage right.
  { xs: [[START, -2.7], [58.15, -2.7], [60.15, 0.75], [64.55, 0.75], [65.4, 2.85], [T.brk + 0.2, 2.85], [T.reign, 3.6]], zs: [[START, 0.55], [58.15, 0.55], [60.15, 0.95], [64.55, 0.95], [65.4, 1.95], [T.brk + 0.2, 1.95], [T.reign, 1.2]], delay: 0.12 },
  // Dot: the smaller one, closer to Barnaby.
  { xs: [[START, -1.45], [58.3, -1.45], [60.0, 1.35], [64.5, 1.35], [65.3, 3.45], [T.brk + 0.3, 3.45], [T.reign + 0.1, 4.15]], zs: [[START, 0.95], [58.3, 0.95], [60.0, 1.15], [64.5, 1.15], [65.3, 1.75], [T.brk + 0.3, 1.75], [T.reign + 0.1, 1.15]], delay: 0 },
];

function kid(t: number, rig: Rig, out: Pose, which: 0 | 1): void {
  const plan = KIDS[which];
  const d = plan.delay; // follow-through: Pip reacts a beat after Dot
  const p = copyPose(rig.rest, out);
  p.x = keys(t, plan.xs, smooth);
  p.z = keys(t, plan.zs, smooth);
  const moving = clamp01(speedOf(t, plan.xs, plan.zs) / 1.0);
  const phase = travelled(t, plan.xs, plan.zs) * 9;
  const stand = ekeys(t, [
    [START, which === 0 ? 0.35 : -0.2],
    [60.2, which === 0 ? 0.95 : 0.75],
    [64.5, which === 0 ? 0.95 : 0.75],
    [65.5, -0.35],
    [T.brk + 0.2 + d, -0.35],
    [T.reign - 0.1 + d, -1.75],
  ]);
  p.yaw = lerp(stand, heading(t, plan.xs, plan.zs, stand), moving);
  walk(p, rig, phase, moving, 0.12, 0.09);
  // Wonder: hands clasped under the chin while the globe comes down.
  const wonder = span(t, 60.0, T.chain + 0.05, 0.5, 0.1);
  const clasp: V3 = [0.07, 0.46, 0.22];
  p.handL = mixV(p.handL, mirror(clasp), wonder);
  p.handR = mixV(p.handR, clasp, wonder);
  p.lean += wonder * 0.12;
  // Startle on the chain snap: a hop, hands to cheeks.
  const startle = span(t, T.chain + d, T.begged, 0.08, 0.5);
  const cheek: V3 = [0.17, 0.62, 0.18];
  p.handL = mixV(p.handL, mirror(cheek), startle);
  p.handR = mixV(p.handR, cheek, startle);
  p.lift += Math.sin(Math.PI * ramp(t, T.chain + d, T.chain + d + 0.3, easeOut)) * 0.09;
  p.squash = 1 - ekeys(t, [[T.chain + d - 0.01, 0], [T.chain + d + 0.05, 1], [T.chain + d + 0.25, 0]]) * 0.1;
  // Scared once the drums start: hands to mouth, trembling.
  const scared = span(t, T.begged + d, T.never + d, 0.2, 0.3);
  const mouthHand: V3 = [0.06, 0.52, 0.24];
  p.handL = mixV(p.handL, mirror(mouthHand), scared);
  p.handR = mixV(p.handR, mouthHand, scared);
  p.squash += Math.sin(t * 23 + which) * 0.014 * scared;
  // Flinch on "wars": cover the eyes.
  const flinch = span(t, T.wars + d, T.never + d, 0.08, 0.3);
  const eyes: V3 = [0.07, 0.72, 0.24];
  p.handL = mixV(p.handL, mirror(eyes), flinch);
  p.handR = mixV(p.handR, eyes, flinch);
  p.squash -= flinch * 0.1;
  p.lean -= flinch * 0.12;
  // Peek on "never": hands down, look up at the globe.
  const peek = span(t, T.never + d, T.reign + d, 0.3, 0.4);
  p.handL = mixV(p.handL, [-0.2, 0.4, 0.2], peek);
  p.handR = mixV(p.handR, [0.2, 0.4, 0.2], peek);
  // Bow with Barnaby on "reign".
  const bow = ekeys(t, [[T.reign + d, 0], [T.reign + 0.5 + d, 1.1, easeOut], [T.reign + 1.0 + d, 1]]);
  p.lean += bow * 0.36;
  p.handL = mixV(p.handL, [-0.18, 0.12, 0.12], bow);
  p.handR = mixV(p.handR, [0.18, 0.12, 0.12], bow);
  // Head: up at the globe in his hands, toward the wrist, the soldiers.
  const lookUp = span(t, 58.6, T.chain, 0.6, 0.2) * (1 - wonder * 0.4) + peek;
  p.headPitch = -lookUp * 0.4 + flinch * 0.15 + bow * 0.15;
  p.headYaw = -scared * 0.3 * (1 - flinch) + startle * -0.25;
  p.lookY = lookUp * 0.7;
  p.lookX = p.headYaw * 0.6;
  p.lid = 0.05 + blinkAt(t, 2 + which) - startle * 0.05;
  p.mouth = startle * 0.45 + flinch * 0.35;
  p.visible = true;
  if (rig.props.propeller) {
    rig.props.propeller.rotation.y = t * (6 + moving * 20) + startle * 4;
  }
  if (rig.props.tailL && rig.props.tailR) {
    const bounce = Math.sin(t * 8) * 0.12 * moving + startle * 0.2;
    rig.props.tailL.rotation.z = 0.4 + bounce;
    rig.props.tailR.rotation.z = -0.4 - bounce;
  }
}

// ---------------------------------------------------------------- soldiers

function guard(t: number, rig: Rig, out: Pose, side: -1 | 1): void {
  const p = copyPose(rig.rest, out);
  const enter = side < 0 ? 63.5 : 64.15;
  const xs: Key[] = [[START, side * 8.6], [enter, side < 0 ? -8.6 : 8.2], [66.25, side < 0 ? -2.4 : 5.2]];
  const zs: Key[] = [[START, 1.3], [66.25, 1.3]];
  p.x = keys(t, xs, smooth);
  p.z = keys(t, zs, smooth);
  const moving = clamp01(speedOf(t, xs, zs) / 1.2);
  const phase = travelled(t, xs, zs) * 5.2;
  walk(p, rig, phase, moving, 0.17, 0.24);
  // Halt with a stamp; snap to attention facing front on "break".
  p.lift -= ekeys(t, [[66.2, 0], [66.3, 1], [66.5, 0]]) * 0.04;
  const face = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  const front = ekeys(t, [[T.brk - 0.05, 0], [T.brk + 0.28, 1, backOut]]);
  p.yaw = lerp(face, 0, front);
  // Aim on "wars": a pull back, then a snap with overshoot.
  const aim = ekeys(t, [[T.wars - 0.3, 0], [T.wars - 0.08, -0.12], [T.wars + 0.12, 1, backOut], [T.never - 0.05, 1], [T.never + 0.35, 0]]);
  const a = clamp01(aim);
  const swing = Math.sin(phase) * moving;
  p.handL = mixV([-0.25, 0.32, 0.2], [-0.25, 0.72, 0.42], a);
  p.handR = mixV([0.36, 0.02, swing * 0.2], [-0.1, 0.62, 0.45], a);
  // Salute on "reign".
  const salute = ekeys(t, [[T.reign + 0.05, 0], [T.reign + 0.35, 1, backOut]]);
  p.handR = mixV(p.handR, [0.2, 1.22, 0.22], salute);
  p.bendL = 0.4;
  p.bendR = 0.4 + salute * 0.3;
  rig.props.rifle.rotation.x = lerp(-0.1, Math.PI - 0.12, aim);
  p.lean = aim * 0.08 + moving * 0.03;
  // Waver on "But": look up at the globe, then stand down, sheepish.
  const waver = span(t, T.but, T.never + 0.4, 0.2, 0.3);
  const sheepish = span(t, T.never + 0.1, T.brk, 0.2, 0.15);
  p.headPitch = -0.05 - waver * 0.3 + sheepish * 0.25;
  p.squash = 1 + span(t, T.never - 0.05, T.never + 0.35, 0.05, 0.3) * 0.06 + span(t, T.brk, T.brk + 0.3, 0.05, 0.2) * 0.04;
  p.lid = 0.25 + blinkAt(t, 4 + side) - span(t, T.wars, T.wars + 0.6, 0.05, 0.3) * 0.2;
  p.mouth = span(t, T.wars - 0.05, T.wars + 0.55, 0.05, 0.3) * 0.65;
  p.visible = t > enter - 0.1;
}

// ---------------------------------------------------------------- camera

type Shot = { at: number; to: number; p0: V3; l0: V3; p1: V3; l1: V3; ease?: Ease };

const SHOTS: Shot[] = [
  // A: medium two-shot, pushing in as the globe lands.
  { at: START, to: 60.4, p0: [2.6, 1.8, 6.2], l0: [2.5, 2.2, 0.3], p1: [1.85, 1.6, 5.3], l1: [1.75, 1.7, 0.4] },
  // B: low wide on the throne: the sceptre rises, the chain whips out.
  { at: 60.65, to: 62.45, p0: [1.2, 1.75, 0.1], l0: [0.6, 2.05, -4.3], p1: [1.05, 1.7, -0.4], l1: [0.6, 2.05, -4.3] },
  // C: insert on the wrist; eases out to a medium on his face.
  { at: 62.45, to: 64.42, p0: [0.7, 2.25, 3.9], l0: [1.85, 1.5, 0.7], p1: [0.95, 2.1, 4.5], l1: [1.75, 1.65, 0.1] },
  // E: wide stand-off, slow push.
  { at: T.begged, to: 67.2, p0: [1.4, 2.25, 10.0], l0: [1.4, 1.75, -1.0], p1: [1.4, 2.05, 8.4], l1: [1.4, 1.75, -1.0] },
  // F: low hero medium, the globe held high.
  { at: 67.2, to: T.brk, p0: [1.95, 1.2, 5.6], l0: [1.95, 2.15, 0.9], p1: [1.95, 1.2, 5.3], l1: [1.95, 2.2, 0.9] },
  // G: final tableau.
  { at: T.brk, to: END, p0: [0.9, 2.45, 9.6], l0: [0.9, 1.72, -1.6], p1: [0.9, 2.35, 9.0], l1: [0.9, 1.75, -1.6] },
];

const camPos = new Vector3();
const camLook = new Vector3();

function shotCamera(t: number, cam: PerspectiveCamera): void {
  let shot = SHOTS[0];
  for (const s of SHOTS) {
    if (t >= s.at) {
      shot = s;
    }
  }
  let u: number;
  if (shot === SHOTS[2]) {
    // Hold the insert through the snap, then ease out.
    u = ramp(t, 63.3, 64.42, smooth);
  } else {
    u = ramp(t, shot.at, shot.to, shot.ease ?? smooth);
  }
  camPos.set(lerp(shot.p0[0], shot.p1[0], u), lerp(shot.p0[1], shot.p1[1], u), lerp(shot.p0[2], shot.p1[2], u));
  camLook.set(lerp(shot.l0[0], shot.l1[0], u), lerp(shot.l0[1], shot.l1[1], u), lerp(shot.l0[2], shot.l1[2], u));
  // Gentle hand-held drift, as in the rest of the show.
  camPos.x += noise1(t * 0.25, 1) * 0.04;
  camPos.y += noise1(t * 0.21, 2) * 0.03;
  camLook.x += noise1(t * 0.2, 3) * 0.02;
  // Hit on the chain snap and on "wars".
  const hit = Math.exp(-Math.max(0, t - T.chain) * 9) * (t >= T.chain ? 1 : 0) * 0.025 + Math.exp(-Math.max(0, t - T.wars) * 7) * (t >= T.wars ? 1 : 0) * 0.04;
  camLook.x += Math.sin(t * 61) * hit;
  camLook.y += Math.cos(t * 53) * hit;
  cam.position.copy(camPos);
  cam.lookAt(camLook);
}

// ---------------------------------------------------------------- frame

const base = { aria: blankPose(), barnaby: blankPose(), pip: blankPose(), dot: blankPose(), king: blankPose(), g0: blankPose(), g1: blankPose() };
const mine = { aria: blankPose(), barnaby: blankPose(), pip: blankPose(), dot: blankPose(), king: blankPose(), g0: blankPose(), g1: blankPose() };
const outP = blankPose();
const tmpA = new Vector3();
const tmpB = new Vector3();
const ariaWorld = new Vector3();
const barnWorld = new Vector3();
const kingWorld = new Vector3(0, 0, -4.4);
const light2 = new Color(1.0, 0.82, 0.6);

function put(rig: Rig, a: Pose, b: Pose, w: number): void {
  blendPose(outP, a, b, w);
  applyPose(rig, outP);
}

export const clip = {
  id: 'chain',
  start: START,
  end: END,
  frame(t: number, cast: Cast, cam: PerspectiveCamera): void {
    defaultFrame(t, cast, cam);
    const w = handoff(t);

    // Aria glides to the foot of the throne so the stand-off has room.
    ariaPose(t, cast.aria, base.aria);
    copyPose(base.aria, mine.aria);
    const AX: Key[] = [[START, -5.2], [58.3, -5.2], [60.6, -1.5]];
    const AZ: Key[] = [[START, -3.3], [58.3, -3.3], [60.6, -2.6]];
    mine.aria.x = keys(t, AX, smooth);
    mine.aria.z = keys(t, AZ, smooth);
    const ariaMoving = clamp01(speedOf(t, AX, AZ) / 1.2);
    mine.aria.yaw = lerp(keys(t, [[START, 0.55], [60.4, 0.55], [61.0, 0.8]]), heading(t, AX, AZ, 0.8), ariaMoving);
    mine.aria.lean += ariaMoving * 0.06;
    // Hand to heart for the bow.
    const heart = span(t, T.reign, END + 2, 0.6, 0.5);
    mine.aria.handR = mixV(mine.aria.handR, [0.02, 0.38, 0.28], heart);
    mine.aria.headPitch += heart * 0.12;
    put(cast.aria, base.aria, mine.aria, w);
    ariaWorld.set(outP.x, 0, outP.z);

    barnabyPose(t, cast.barnaby, base.barnaby);
    barnaby(t, cast.barnaby, mine.barnaby);
    put(cast.barnaby, base.barnaby, mine.barnaby, w);
    barnWorld.set(outP.x, 0, outP.z);

    kidPose(t, cast.pip, base.pip, 0);
    kid(t, cast.pip, mine.pip, 0);
    put(cast.pip, base.pip, mine.pip, w);
    kidPose(t, cast.dot, base.dot, 1);
    kid(t, cast.dot, mine.dot, 1);
    put(cast.dot, base.dot, mine.dot, w);

    // The king: a wind-up, the sceptre raised on "Yet", a yank on "chain",
    // lowered; a small acceptance on "reign".
    kingPose(t, cast.king, base.king, cast.lift.position.y);
    copyPose(base.king, mine.king);
    mine.king.handR = track(t, [
      [START, [0.62, 0.15, 0.38]],
      [60.55, [0.62, 0.15, 0.38]],
      [60.9, [0.56, 0.04, 0.28]],
      [T.yet + 0.15, [0.74, 1.08, 0.5], backOut],
      [T.chain - 0.08, [0.72, 1.02, 0.5]],
      [T.chain + 0.1, [0.6, 0.86, 0.12], easeOut],
      [63.8, [0.62, 0.8, 0.2]],
      [64.6, [0.64, 0.38, 0.42]],
      [T.reign, [0.64, 0.38, 0.42]],
      [T.reign + 0.5, [0.7, 0.68, 0.48], backOut],
    ]);
    mine.king.lean += span(t, 60.6, T.chain + 0.6, 0.4, 0.5) * 0.08 - ekeys(t, [[T.chain - 0.05, 0], [T.chain + 0.1, 1], [T.chain + 0.5, 0]]) * 0.06;
    mine.king.headPitch -= span(t, T.yet, T.chain + 0.8, 0.3, 0.5) * 0.12;
    put(cast.king, base.king, mine.king, w);

    guardPose(t, cast.guards[0], base.g0, -1);
    guard(t, cast.guards[0], mine.g0, -1);
    put(cast.guards[0], base.g0, mine.g0, w);
    guardPose(t, cast.guards[1], base.g1, 1);
    guard(t, cast.guards[1], mine.g1, 1);
    put(cast.guards[1], base.g1, mine.g1, w);

    // The globe floats down into his hands and stays with him.
    const globe = cast.globe;
    const descend = ekeys(t, [[W[22][0], 0], [T.hands, 1, (u: number) => 1 - (1 - u) * (1 - u)]]);
    globe.group.visible = t > W[22][0] - 0.1;
    cast.barnaby.root.updateMatrixWorld(true);
    const handsMid = tmpA.copy(cast.barnaby.hands[0].position).add(cast.barnaby.hands[1].position).multiplyScalar(0.5);
    cast.barnaby.torso.localToWorld(handsMid);
    handsMid.y += 0.2;
    handsMid.z += 0.06;
    tmpB.set(barnWorld.x + 0.1 + Math.sin(t * 2.1) * 0.18 * (1 - descend) * ramp(t, 57.7, 58.3), 7.5, barnWorld.z + 0.5);
    globe.group.position.copy(tmpB).lerp(handsMid, descend);
    globe.group.position.y += Math.sin(t * 2.6) * 0.04 * (1 - descend);
    // Float down beside his face (toward his reaching left hand), then glide in.
    globe.group.position.x -= 1.0 * ramp(t, 57.7, 58.4) * (1 - ramp(descend, 0.93, 1));
    globe.group.rotation.y = t * 0.6;
    globe.glowLevel.value = 0.8
      + span(t, T.hands - 0.1, T.hands + 1.2, 0.1, 0.9) * 0.8
      - span(t, T.chain, T.begged, 0.1, 0.6) * 0.3
      + span(t, T.wars + 0.2, T.brk + 0.4, 0.2, 0.5) * 0.7
      + ramp(t, T.reign + 0.2, T.reign + 1.0) * 0.35;

    // The chain whips out from the sceptre and snaps tight on "chain".
    cast.king.root.updateMatrixWorld(true);
    const tip = cast.king.props.sceptre.localToWorld(tmpA.set(0, 0.5, 0));
    const wrist = cast.barnaby.hands[0].localToWorld(tmpB.set(0, -0.02, 0));
    const reveal = ramp(t, T.us, T.chain, (u: number) => u * u);
    const sag = ekeys(t, [[START, 0.9], [T.us, 0.9], [T.chain - 0.05, 0.55], [T.chain + 0.1, 0.1, easeOut], [T.chain + 0.5, 0.22], [64.6, 0.5]]);
    cast.chain.update(tip, wrist, reveal, sag);

    lighting(t, { aria: ariaWorld, barnaby: barnWorld, king: kingWorld });
    // Children's pool follows them; the red stand-off wash centres on the
    // line of fire.
    const kidsX = (cast.pip.root.position.x + cast.dot.root.position.x) / 2;
    const kidsZ = (cast.pip.root.position.z + cast.dot.root.position.z) / 2;
    const kidLevel = keys(t, [[START, 1.0], [T.begged, 1.0], [T.begged + 0.6, 0.75], [T.reign, 0.75], [T.reign + 0.5, 0.9]]);
    setSpot(2, lerp(-2.05, kidsX, w), lerp(0.7, kidsZ, w), lerp(1.6, 1.2, w), kidLevel, light2);
    const warWash = span(t, T.begged - 0.2, T.never + 0.6, 0.6, 0.8);
    const flash = span(t, T.wars - 0.05, T.wars + 0.6, 0.05, 0.5) * 0.9;
    setSpot(4, 1.4, 1.3, 4.2, warWash * (0.45 + flash), red);
    // Footlights dip for the wide stand-off and warm up for the tableau.
    set.footLevel.value *= 1 + span(t, T.reign, END + 2, 0.8, 0.5) * 0.35;

    shotCamera(t, cam);
  },
};

