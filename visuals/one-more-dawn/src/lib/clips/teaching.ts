// Clip "teaching" (40.3 s – 57.4 s): Band enters; Barnaby walks on; children walk, dance, sing; the king rises (verse lines 1–4).
// This file owns everything on screen in its window: camera, lighting cues
// and every performer's pose. Start from defaultFrame and replace parts of
// it here; do not edit shared engine, cast or set files from a clip lane.
//
// Shot list (song seconds):
//   A  40.30 – 44.15  High wide from house left (a clear cut away from the
//                     close hero shot before it): the band kicks in, the
//                     whole stage, the dream star still in the sky; Aria
//                     retires upstage, Barnaby strolls on from stage right.
//   B  44.15 – 47.95  Medium on Barnaby: "I helped them teach their
//                     children"; the two kids race in and skid to his side.
//   C  47.95 – 51.25  Low medium two-shot: "To walk, to dance, to sing";
//                     toddle, spin, arms up and sing; Barnaby conducts.
//   D  51.25 – 54.15  Low hero medium on Barnaby: "They trusted us with
//                     everything"; arms burst wide, kids look up at him.
//   E  54.15 – 57.40  Reveal: the throne rises through the trap on
//                     "kingdoms", the kids scurry clear; all three bow
//                     from the waist on "kings"; Barnaby rises and opens a
//                     hand to the throne for the hand-off.

import { Color, Vector3, type PerspectiveCamera } from 'three/webgpu';
import { applyPose, blankPose, copyPose, type Pose, type Rig, type V3 } from '../rig.ts';
import { BARITONE_WORDS as W } from '../song.ts';
import {
  barnabyPose,
  cue,
  defaultFrame,
  kidPose,
  kingPose,
  lighting,
  mixV,
  setSpot,
  v3,
  walk,
  type Cast,
} from '../show.ts';
import { set } from '../stage.ts';
import { backOut, clamp01, easeOut, keys, lerp, noise1, ramp, smooth, span, type Key } from '../time.ts';

const START = 40.3;
const END = 57.4;

// Word times used by this clip (baritone verse).
const T = {
  i: W[0][0], // "I" 44.48 (held)
  helped: W[1][0], // 45.22
  teach: W[3][0], // 45.84
  children: W[5][0], // 46.62
  to: W[6][0], // 48.23
  walk: W[7][0], // 48.48
  dance: W[9][0], // 49.36
  sing: W[11][0], // 50.2
  singEnd: W[11][1], // 50.7
  they: W[12][0], // 51.42
  trusted: W[13][0], // 51.68
  every: W[16][0], // 53.32
  everyEnd: W[16][1], // 54.1
  their: W[17][0], // 54.76
  kingdoms: W[18][0], // 55.2
  kings: W[21][0], // 56.52
};

// Hand-off envelope: 0 in the first 0.25 s (pure defaultFrame), 1 inside,
// and a blend back to defaultFrame over the last 0.25 s that holds the
// clip's pose for most of that time (exactly defaultFrame at END).
function inside(t: number): number {
  const out = ramp(t, END - 0.25, END, (u: number) => u * u);
  return ramp(t, START + 0.25, START + 0.5) * (1 - out);
}

// Snap into a pose with a little overshoot, then release.
function pop(t: number, a: number, b: number, inT = 0.25, outT = 0.4): number {
  return ramp(t, a, a + inT, backOut) * (1 - ramp(t, b - outT, b));
}

const TAU = Math.PI * 2;
function unwrapTo(angle: number, ref: number): number {
  return angle + TAU * Math.round((ref - angle) / TAU);
}

function blendPose(out: Pose, def: Pose, mine: Pose, w: number): void {
  const k = clamp01(w);
  const num = ['x', 'z', 'lift', 'lean', 'tilt', 'twist', 'squash', 'headYaw', 'headPitch', 'headRoll', 'mouth', 'lid', 'lookX', 'lookY', 'eyeGlow', 'brow', 'browTilt', 'bendL', 'bendR'] as const;
  for (const n of num) {
    out[n] = lerp(def[n], mine[n], k);
  }
  out.yaw = lerp(def.yaw, unwrapTo(mine.yaw, def.yaw), k);
  out.handL = mixV(def.handL, mine.handL, k);
  out.handR = mixV(def.handR, mine.handR, k);
  out.footL = mixV(def.footL, mine.footL, k);
  out.footR = mixV(def.footR, mine.footR, k);
  out.visible = k > 0.5 ? mine.visible : def.visible;
}

// Stateless path helpers (positions from keyed straight runs).
function path(t: number, xs: readonly Key[], zs: readonly Key[]): { x: number; z: number; speed: number; dist: number } {
  const x = keys(t, xs, smooth);
  const z = keys(t, zs, smooth);
  const dt = 0.05;
  const dx = keys(t + dt, xs, smooth) - keys(t - dt, xs, smooth);
  const dz = keys(t + dt, zs, smooth) - keys(t - dt, zs, smooth);
  const dist = Math.abs(x - xs[0][1]) + Math.abs(z - zs[0][1]);
  return { x, z, speed: Math.hypot(dx, dz) / (2 * dt), dist };
}

// ---------------------------------------------------------------- Barnaby

const BARN_X: Key[] = [[0, 9.5], [START + 0.3, 9.5], [43.75, 2.3], [END, 2.3]];
const BARN_Z: Key[] = [[0, 0.3], [START + 0.3, 0.3], [43.75, 0.5], [END, 0.5]];

function barnaby(t: number, rig: Rig, def: Pose, p: Pose): void {
  copyPose(def, p);
  const r = rig.rest;
  const m = path(t, BARN_X, BARN_Z);
  p.x = m.x;
  p.z = m.z;
  const moving = clamp01(m.speed / 1.1);
  const phase = m.dist * 4.4;
  // Reset the legs, then a jaunty old-timer stroll: short strides, a rock
  // and a bounce in time with the band.
  p.footL = [...r.footL] as V3;
  p.footR = [...r.footR] as V3;
  p.handL = [...r.handL] as V3;
  p.handR = [...r.handR] as V3;
  p.lift = Math.sin(t * 1.6) * 0.008;
  p.tilt = 0;
  p.lean = 0.1 + Math.sin(t * 1.3) * 0.015;
  walk(p, rig, phase, moving, 0.22, 0.13);
  p.tilt += Math.sin(phase) * 0.05 * moving;
  // Arrival settle: rock back on the heels, then forward.
  const settle = span(t, 43.55, 44.15, 0.15, 0.45);
  p.lean -= settle * 0.1;
  p.lift -= settle * 0.025;

  // Facing: walk on facing left, turn out front as he lands his mark,
  // favour the kids while conducting, square up for "trusted", then turn
  // toward the throne for "kingdoms".
  p.yaw = keys(t, [
    [0, -1.35],
    [43.0, -1.35],
    [43.85, -0.1],
    [46.2, -0.1],
    [46.6, -0.42],
    [48.15, -0.42],
    [48.35, -0.55],
    [50.9, -0.55],
    [51.35, -0.06],
    [54.6, -0.06],
    [55.15, -0.55],
    [END, -0.55],
  ]);

  // Breath in before the first note.
  const inhale = span(t, 44.0, T.i + 0.35, 0.35, 0.3);
  p.lean -= inhale * 0.06;
  p.lift += inhale * 0.02;

  let L: V3 = p.handL;
  let R: V3 = p.handR;
  // "I": hand to heart, eyes soften.
  const heart = pop(t, T.i - 0.22, T.helped + 0.2, 0.3, 0.35);
  R = mixV(R, v3(0.1, 0.52, 0.44), heart);
  // "helped them teach": the hand opens out, palm up, offering.
  const offer = pop(t, T.helped - 0.05, T.children + 0.15, 0.3, 0.4);
  R = mixV(R, v3(0.78, 0.72, 0.42), offer);
  // "their children": present the kids with an open sweep of the left hand.
  const present = pop(t, T.children - 0.25, T.to - 0.05, 0.3, 0.45);
  L = mixV(L, v3(-0.95, 0.72, 0.38), present);
  // Conductor's ready: right hand up before "To walk".
  const ready = span(t, T.to - 0.45, T.singEnd + 0.4, 0.3, 0.5);
  R = mixV(R, v3(0.55, 1.2, 0.36), ready);
  // "walk": a crisp downbeat.
  const down = pop(t, T.walk - 0.06, T.walk + 0.55, 0.14, 0.35);
  const upPrep = span(t, T.walk - 0.22, T.walk - 0.02, 0.12, 0.08);
  R = mixV(R, v3(0.62, 0.78, 0.46), down);
  R = mixV(R, v3(0.5, 1.38, 0.3), upPrep);
  // "dance": a loop of the wrist, circling with the kids' spin.
  const loop = span(t, T.dance - 0.15, T.dance + 0.6, 0.12, 0.2);
  const ang = ramp(t, T.dance - 0.15, T.dance + 0.55, smooth) * TAU;
  R = mixV(R, v3(0.55 + Math.sin(ang) * 0.24, 1.0 + Math.cos(ang) * 0.24, 0.42), loop);
  p.tilt += loop * Math.sin(ang) * 0.06;
  // "sing": both hands lift the kids up into the note.
  const lift = pop(t, T.sing - 0.12, T.singEnd + 0.55, 0.22, 0.45);
  L = mixV(L, v3(-0.75, 1.2, 0.35), lift);
  R = mixV(R, v3(0.75, 1.25, 0.35), lift);
  p.lean -= lift * 0.05;
  // Gather in to the chest before the big gesture.
  const gather = span(t, T.they - 0.15, T.trusted + 0.05, 0.2, 0.1);
  L = mixV(L, v3(-0.16, 0.48, 0.42), gather);
  R = mixV(R, v3(0.16, 0.48, 0.42), gather);
  p.lean += gather * 0.05;
  // "trusted us with everything": arms burst wide and rise on "every-".
  const wide = pop(t, T.trusted - 0.04, T.everyEnd + 0.55, 0.3, 0.6);
  const rise = span(t, T.every - 0.1, T.everyEnd + 0.4, 0.4, 0.5);
  L = mixV(L, v3(-1.05, 0.95 + rise * 0.22, 0.2), wide);
  R = mixV(R, v3(1.05, 0.95 + rise * 0.22, 0.2), wide);
  p.lean -= wide * 0.08;
  p.lift += rise * 0.04;
  // "kingdoms": a slow, grand sweep up toward the rising throne.
  const behold = span(t, T.kingdoms - 0.3, END - 0.3, 0.45, 0.5);
  L = mixV(L, v3(-0.92, 1.05, 0.42), behold);
  // "kings": a courtly bow from the waist – right hand to the heart, left
  // arm swept out low, a knee dip and a nod – then he rises and opens the
  // left hand toward the throne, ready for the globe.
  const bowDown = ramp(t, T.kings - 0.08, T.kings + 0.3, easeOut);
  const bowUp = ramp(t, END - 0.5, END - 0.12, smooth);
  const bow = bowDown * (1 - bowUp);
  R = mixV(R, v3(0.14, 0.5, 0.46), bow);
  L = mixV(L, v3(-0.95, 0.42, 0.2), bow);
  L = mixV(L, v3(-0.85, 0.8, 0.45), bowDown * bowUp);
  p.lean += bow * 0.42;
  p.lift -= bow * 0.05;
  p.handL = L;
  p.handR = R;
  p.bendL = 0.5 + wide * 0.3;
  p.bendR = 0.5 + wide * 0.3;

  // Head: warm and wistful; look at the kids, up into the light, then
  // warily up at the throne.
  const toKids = span(t, T.children - 0.3, T.singEnd + 0.35, 0.4, 0.5);
  const toKing = span(t, T.kingdoms - 0.4, END + 1, 0.5, 0.5);
  // Delight while the kids walk, dance and sing: a head bob on the beat.
  const delight = span(t, T.children - 0.2, T.they - 0.1, 0.35, 0.4);
  const bob = Math.sin((t - T.walk) * 7.5);
  // Pride on "helped them teach": chin up, chest out.
  const proud = span(t, T.helped - 0.1, T.children - 0.1, 0.3, 0.4);
  p.lean -= proud * 0.04;
  p.headYaw = toKids * -0.35 + toKing * -0.5;
  p.headPitch = heart * -0.04 - proud * 0.1 - wide * 0.24 - toKing * 0.2 + toKids * 0.08 + bow * 0.4;
  p.headPitch += delight * bob * 0.06;
  // The speaker mouth is small: let the head ride each sung syllable.
  p.headPitch -= p.mouth * 0.12;
  p.headRoll = Math.sin(t * 1.1) * 0.04 + heart * 0.16 + gather * 0.12 + p.mouth * Math.sin(t * 3.0) * 0.05;
  p.headRoll += delight * Math.sin((t - T.walk) * 3.75) * 0.1;
  p.lookX = toKids * -0.4 + toKing * -0.35;
  p.lookY = wide * 0.45 + toKing * 0.55 - toKids * 0.3 - bow * 0.7;

  // Brows (raise -1..1, tilt + worried / - stern). Cheerful stroll,
  // tender on "I", proud on "helped", delighted with the kids, an
  // open-hearted lift on "trusted us with everything", then a deferential,
  // wary look up at the king.
  const stroll = 1 - ramp(t, 43.6, 44.2);
  const wary = span(t, T.their - 0.1, END + 1, 0.4, 0.5);
  const kingsBeat = span(t, T.kings - 0.1, END + 1, 0.25, 0.5);
  let brow = 0.25 * stroll + inhale * 0.35;
  let tiltB = 0;
  brow = lerp(brow, 0.25, heart);
  tiltB = lerp(tiltB, 0.45, heart);
  brow = lerp(brow, 0.5, proud);
  tiltB = lerp(tiltB, -0.15, proud);
  brow = lerp(brow, 0.75 + Math.abs(bob) * 0.15, delight);
  tiltB = lerp(tiltB, 0.1, delight);
  brow = lerp(brow, 0.3, gather);
  tiltB = lerp(tiltB, 0.6, gather);
  brow = lerp(brow, 0.95, wide);
  tiltB = lerp(tiltB, 0.3, wide);
  brow = lerp(brow, 0.15, wary);
  tiltB = lerp(tiltB, 0.7, wary);
  brow = lerp(brow, -0.25, kingsBeat);
  tiltB = lerp(tiltB, 0.55, kingsBeat);
  p.brow = brow;
  p.browTilt = tiltB;
  // Eyes: soft and smiling on "I", wide on "everything", hooded with the bow.
  p.lid = 0.24 + heart * 0.05 + gather * 0.04 - wide * 0.12 - proud * 0.06 - delight * 0.06 - toKing * 0.06 + kingsBeat * 0.14 + blinkAt(t);
  p.visible = t > START - 0.5;
}

function blinkAt(t: number): number {
  const period = 3.4;
  const phase = (t + 0.7) % period;
  return phase < 0.14 ? Math.sin((phase / 0.14) * Math.PI) * 0.6 : 0;
}

// ---------------------------------------------------------------- kids

interface KidPlan {
  enter: number;
  arrive: number;
  spot: [number, number];
  home: [number, number];
  scurry: [number, number];
  face: number;
  sign: 1 | -1;
}

const KIDS: [KidPlan, KidPlan] = [
  // Pip (propeller) – stands left, closer to centre.
  { enter: 45.0, arrive: 46.72, spot: [-0.6, 1.05], home: [-2.7, 0.55], scurry: [54.25, 55.1], face: 0.45, sign: 1 },
  // Dot (pigtails) – stands next to Barnaby.
  { enter: 45.3, arrive: 46.98, spot: [0.5, 1.3], home: [-1.45, 0.95], scurry: [54.35, 55.2], face: 0.62, sign: -1 },
];

function kid(t: number, rig: Rig, def: Pose, p: Pose, which: 0 | 1): { x: number; z: number } {
  copyPose(def, p);
  const r = rig.rest;
  const k = KIDS[which];
  const xs: Key[] = [[0, -6.8], [k.enter, -6.8], [k.arrive, k.spot[0]], [k.scurry[0], k.spot[0]], [k.scurry[1], k.home[0]], [END, k.home[0]]];
  const zs: Key[] = [[0, k.spot[1] - 0.2], [k.enter, k.spot[1] - 0.2], [k.arrive, k.spot[1]], [k.scurry[0], k.spot[1]], [k.scurry[1], k.home[1]], [END, k.home[1]]];
  const m = path(t, xs, zs);
  p.x = m.x;
  p.z = m.z;
  const moving = clamp01(m.speed / 1.4);
  const phase = m.dist * 8.5;
  p.footL = [...r.footL] as V3;
  p.footR = [...r.footR] as V3;
  p.handL = [...r.handL] as V3;
  p.handR = [...r.handR] as V3;
  p.lift = 0;
  p.tilt = 0;
  p.lean = 0;
  p.squash = 1;
  p.headYaw = 0;
  p.headPitch = 0;
  p.lookX = 0;
  p.lookY = 0;
  p.mouth = 0;
  walk(p, rig, phase, moving, 0.13, 0.1);
  // Running: lean into it, elbows pumping.
  p.lean += moving * 0.22;
  p.lift += Math.abs(Math.sin(phase)) * 0.05 * moving;

  // Skid stop on arrival: lean back, squash, then a happy bounce.
  const skid = span(t, k.arrive - 0.12, k.arrive + 0.45, 0.1, 0.3);
  p.lean -= skid * 0.32;
  p.squash -= skid * 0.08;
  p.x += Math.sin(clamp01((t - k.arrive + 0.12) / 0.5) * Math.PI) * 0.12 * (t > k.arrive - 0.12 ? 1 : 0) * (t < k.arrive + 0.4 ? 1 : 0);

  // Facing.
  const runRight = 1.5;
  const runLeft = -1.5;
  let yaw = keys(t, [
    [0, runRight],
    [k.arrive - 0.1, runRight],
    [k.arrive + 0.25, k.face],
    [T.to - 0.15, k.face],
    [T.walk - 0.1, 0.12 * k.sign],
    [T.trusted - 0.3, 0.12 * k.sign],
    [T.trusted + 0.2, k.face + 0.25],
    [k.scurry[0], k.face + 0.25],
    [k.scurry[0] + 0.2, runLeft],
    [END, runLeft],
  ]);
  // Arrive on the mark already turned to the default (hand-off) facing.
  yaw = lerp(yaw, unwrapTo(def.yaw, runLeft), ramp(t, k.scurry[1] - 0.2, k.scurry[1] + 0.35));

  // Eager bounce while waiting.
  const wait = span(t, k.arrive + 0.4, T.to - 0.1, 0.3, 0.2);
  p.lift += wait * Math.abs(Math.sin((t - k.arrive) * 7.5)) * 0.04;
  p.headPitch -= wait * 0.25;
  p.lookY += wait * 0.5;
  p.headYaw += wait * 0.15;

  // "walk": crouch, then three stiff toddling steps toward us, arms out.
  const crouch = span(t, T.walk - 0.25, T.walk + 0.02, 0.12, 0.08);
  p.lift -= crouch * 0.05;
  p.squash -= crouch * 0.07;
  const toddle = span(t, T.walk - 0.02, T.dance - 0.2, 0.08, 0.15);
  const tp = (t - T.walk) * 12;
  p.tilt += Math.sin(tp) * 0.2 * toddle;
  p.footL = mixV(p.footL, [r.footL[0], Math.max(0, Math.cos(tp)) * 0.1, r.footL[2]], toddle);
  p.footR = mixV(p.footR, [r.footR[0], Math.max(0, -Math.cos(tp)) * 0.1, r.footR[2]], toddle);
  p.handL = mixV(p.handL, v3(-0.4, 0.4, 0.18), toddle);
  p.handR = mixV(p.handR, v3(0.4, 0.4, 0.18), toddle);
  p.z += ramp(t, T.walk, T.dance - 0.25, (u: number) => u) * 0.32;

  // "dance": anticipation squat, a full spin with a hop, land "ta-da".
  const squat = span(t, T.dance - 0.24, T.dance - 0.02, 0.1, 0.06);
  p.lift -= squat * 0.07;
  p.squash -= squat * 0.1;
  const spin = ramp(t, T.dance - 0.04, T.dance + 0.5, easeOut);
  yaw += spin * TAU * k.sign;
  const hop = Math.sin(Math.PI * ramp(t, T.dance - 0.04, T.dance + 0.46, (u: number) => u));
  p.lift += hop * 0.24;
  p.squash += hop * 0.06;
  const land = span(t, T.dance + 0.46, T.dance + 0.75, 0.04, 0.25);
  p.squash -= land * 0.1;
  const tada = pop(t, T.dance + 0.05, T.sing - 0.12, 0.18, 0.15);
  p.handL = mixV(p.handL, v3(-0.42, 0.5, 0.12), tada);
  p.handR = mixV(p.handR, v3(0.42, 0.5, 0.12), tada);
  p.headRoll = tada * 0.18 * k.sign;

  // "sing": arms up in a V, chin up, mouths wide on the note.
  const singing = pop(t, T.sing - 0.1, T.trusted - 0.1, 0.18, 0.45);
  p.handL = mixV(p.handL, v3(-0.42, 0.66, 0.12), singing);
  p.handR = mixV(p.handR, v3(0.42, 0.66, 0.12), singing);
  p.headPitch -= singing * 0.3;
  p.lift += singing * Math.abs(Math.sin((t - T.sing) * 6.5)) * 0.04;
  p.mouth = Math.max(p.mouth, span(t, T.sing - 0.06, T.they, 0.08, 0.35) * (0.78 + Math.sin(t * 9 + which) * 0.12));

  // "trusted us…": turn to look up at Barnaby, hands clasped; a little
  // hop with arms up on "every-".
  const adore = span(t, T.trusted - 0.2, k.scurry[0] + 0.05, 0.4, 0.2);
  p.headPitch -= adore * 0.35;
  p.lookY += adore * 0.7;
  p.headYaw += adore * 0.2;
  p.handL = mixV(p.handL, v3(-0.08, 0.4, 0.24), adore);
  p.handR = mixV(p.handR, v3(0.08, 0.42, 0.24), adore);
  const cheer = pop(t, T.every + 0.04 + which * 0.08, T.everyEnd + 0.3, 0.16, 0.35);
  p.handL = mixV(p.handL, v3(-0.4, 0.66, 0.1), cheer);
  p.handR = mixV(p.handR, v3(0.4, 0.66, 0.1), cheer);
  p.lift += Math.sin(Math.PI * ramp(t, T.every + which * 0.08, T.every + 0.4 + which * 0.08, (u: number) => u)) * 0.12;

  // The trap rumbles: a startled jump, then scurry clear looking back.
  const startle = span(t, k.scurry[0] - 0.12, k.scurry[0] + 0.2, 0.06, 0.15);
  p.lift += startle * 0.12;
  p.squash += startle * 0.08;
  p.handL = mixV(p.handL, v3(-0.32, 0.62, 0.2), startle);
  p.handR = mixV(p.handR, v3(0.32, 0.62, 0.2), startle);
  const lookBack = span(t, k.scurry[0] + 0.25, k.scurry[1] + 0.2, 0.2, 0.3);
  p.headYaw += lookBack * 1.0;

  // Facing the throne in awe, then the bow on "kings".
  const awe = span(t, k.scurry[1] - 0.1, T.kings + 0.1, 0.3, 0.3);
  p.headPitch -= awe * 0.3;
  p.lookY += awe * 0.6;
  p.handL = mixV(p.handL, v3(-0.1, 0.5, 0.24), awe);
  p.handR = mixV(p.handR, v3(0.1, 0.5, 0.24), awe);
  const rise = span(t, T.kings - 0.25, T.kings, 0.15, 0.05);
  p.lift += rise * 0.03;
  // The bow on "kings": a bend at the waist (the rig pushes the hips
  // back), a knee dip and a tucked head. Pip folds one arm across his
  // tummy and sweeps the other back; Dot curtseys, hands out at her skirt.
  const bow = ramp(t, T.kings + which * 0.1, T.kings + 0.3 + which * 0.1, backOut);
  p.lean += bow * 0.5;
  p.lift -= bow * (which === 0 ? 0.03 : 0.05);
  p.headPitch += bow * 0.4;
  p.lookY -= bow * 0.5;
  if (which === 0) {
    p.handR = mixV(p.handR, v3(0.06, 0.2, 0.24), bow);
    p.handL = mixV(p.handL, v3(-0.42, 0.24, -0.2), bow);
  } else {
    p.handL = mixV(p.handL, v3(-0.38, 0.12, 0.1), bow);
    p.handR = mixV(p.handR, v3(0.38, 0.12, 0.1), bow);
  }

  // Faces (the kids have eyes and lids, no brows): a curious head cock
  // while waiting, eyes down to their feet on "walk", bright eyes on the
  // "ta-da" and the sung note, wide eyes for Barnaby, the rumble and the king.
  p.headRoll += wait * Math.sin((t - k.arrive) * 2.2 + which) * 0.16 * k.sign;
  p.headPitch += toddle * 0.16;
  p.lookY -= toddle * 0.45;
  // Lowered lids read as bored on these faces, so joy stays wide-eyed and
  // Pip beams up into the held "sing".
  p.lid = clamp01(def.lid * (1 - Math.max(tada, adore, startle, awe) * 0.8) + bow * 0.3);
  p.lookY += (which === 0 ? singing * 0.5 : 0) + tada * 0.1;
  p.headRoll += singing * Math.sin((t - T.sing) * 3.2 + which * 1.5) * 0.12;
  p.headPitch -= startle * 0.15;

  p.yaw = yaw;
  p.visible = t > k.enter;
  if (rig.props.propeller) {
    rig.props.propeller.rotation.y = t * (6 + moving * 24) + spin * 20;
  }
  if (rig.props.tailL && rig.props.tailR) {
    const bounce = Math.sin(t * 9) * 0.14 * (moving + toddle + tada + singing * 0.5 + startle);
    rig.props.tailL.rotation.z = 0.4 + bounce;
    rig.props.tailR.rotation.z = -0.4 - bounce;
  }
  return { x: p.x, z: p.z };
}

// ---------------------------------------------------------------- king

const LIFT_KEYS: Key[] = [[0, -4.8], [T.their - 0.05, -4.8], [T.kings - 0.05, 0]];

function king(t: number, rig: Rig, def: Pose, p: Pose): void {
  copyPose(def, p);
  // Lands on "kings": a settle squash and a haughty chin-up.
  const landing = span(t, T.kings - 0.05, T.kings + 0.35, 0.05, 0.3);
  p.squash = 1 - landing * 0.07;
  p.lift -= landing * 0.03;
  const chin = span(t, T.kings - 0.1, END + 1, 0.35, 0.5);
  p.headPitch = def.headPitch - chin * 0.08;
}

// ---------------------------------------------------------------- camera

interface Shot {
  at: number;
  from: [V3, V3];
  to: [V3, V3];
}

// Look point from a camera position and a heading (degrees; az > 0 is
// screen right, el > 0 is up).
function aim(c: V3, az: number, el: number): V3 {
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  return [c[0] + Math.sin(a) * Math.cos(e) * 10, c[1] + Math.sin(e) * 10, c[2] - Math.cos(a) * Math.cos(e) * 10];
}

// The dream star sits ~22 deg up, ~9 deg right of straight upstage. The
// previous clip ends on a close, low, frontal hero shot of Aria, so A cuts
// to a high wide from house left (about 30 deg round and far wider); the
// star stays in the sky, upper left of frame.
const AP0: V3 = [-5.8, 2.1, 12.8];
const AP1: V3 = [-5.8, 2.3, 11.4];

const SHOTS: Shot[] = [
  // A: the band hits; the whole stage from house left, then a slow pan
  // right that picks up Barnaby and follows him to his mark.
  { at: START, from: [AP0, aim(AP0, 25, 7)], to: [AP1, aim(AP1, 31, 3)] },
  // B: medium on Barnaby, room on the left for the kids' entrance.
  { at: 44.15, from: [[1.2, 1.6, 6.9], [1.45, 1.45, 0.3]], to: [[1.3, 1.55, 6.3], [1.45, 1.42, 0.4]] },
  // C: low two-shot, kids featured, Barnaby conducting on the right.
  { at: 47.95, from: [[0.85, 1.2, 6.7], [1.0, 1.15, 0.6]], to: [[0.95, 1.15, 6.2], [1.0, 1.15, 0.7]] },
  // D: low hero medium on Barnaby for the big gesture.
  { at: 51.25, from: [[1.2, 1.0, 7.0], [1.35, 1.7, 0.4]], to: [[1.3, 1.15, 6.4], [1.45, 1.8, 0.3]] },
  // E: the reveal – the throne rises centre, Aria far left, kids
  // left of centre (clear of Aria), Barnaby right.
  { at: 54.15, from: [[-1.75, 1.65, 8.7], [0.35, 1.3, -2.5]], to: [[-1.8, 1.8, 8.3], [0.35, 1.5, -2.8]] },
];

const camPos = new Vector3();
const camLook = new Vector3();

function camera(t: number, cam: PerspectiveCamera): void {
  let i = 0;
  while (i < SHOTS.length - 1 && t >= SHOTS[i + 1].at) {
    i += 1;
  }
  const s = SHOTS[i];
  const end = i < SHOTS.length - 1 ? SHOTS[i + 1].at : END;
  const u = smooth(clamp01((t - s.at) / (end - s.at)));
  const [p0, l0] = s.from;
  const [p1, l1] = s.to;
  camPos.set(lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u), lerp(p0[2], p1[2], u));
  camLook.set(lerp(l0[0], l1[0], u), lerp(l0[1], l1[1], u), lerp(l0[2], l1[2], u));
  // Shot E tilts up with the rising throne.
  if (i === SHOTS.length - 1) {
    const up = ramp(t, T.their, T.kings + 0.2, smooth);
    camLook.y += up * 0.25;
  }
  camPos.x += noise1(t * 0.25, 1) * 0.03;
  camPos.y += noise1(t * 0.21, 2) * 0.02;
  camLook.x += noise1(t * 0.2, 3) * 0.015;
  cam.position.copy(camPos);
  cam.lookAt(camLook);
}

// ---------------------------------------------------------------- frame

const def = { barnaby: blankPose(), pip: blankPose(), dot: blankPose(), king: blankPose() };
const mine = { barnaby: blankPose(), pip: blankPose(), dot: blankPose(), king: blankPose() };
const out = blankPose();
const kidWarm = new Color(1.0, 0.82, 0.6);
const kidBright = new Color(1.0, 0.9, 0.7);
const kidMix = new Color();
const kingWorld = new Vector3(0, 0, -4.4);
const barnWorld = new Vector3();

export const clip = {
  id: 'teaching',
  start: START,
  end: END,
  frame(t: number, cast: Cast, cam: PerspectiveCamera): void {
    defaultFrame(t, cast, cam);
    const w = inside(t);

    // Barnaby.
    barnabyPose(t, cast.barnaby, def.barnaby);
    barnaby(t, cast.barnaby, def.barnaby, mine.barnaby);
    blendPose(out, def.barnaby, mine.barnaby, w);
    applyPose(cast.barnaby, out);
    barnWorld.set(out.x, 0, out.z);

    // Kids.
    kidPose(t, cast.pip, def.pip, 0);
    kid(t, cast.pip, def.pip, mine.pip, 0);
    blendPose(out, def.pip, mine.pip, w);
    applyPose(cast.pip, out);
    const pipX = out.x;
    kidPose(t, cast.dot, def.dot, 1);
    kid(t, cast.dot, def.dot, mine.dot, 1);
    blendPose(out, def.dot, mine.dot, w);
    applyPose(cast.dot, out);
    const dotX = out.x;

    // The king and his lift.
    const defLift = cast.lift.position.y;
    const liftY = lerp(defLift, keys(t, LIFT_KEYS, easeOut), w);
    cast.lift.position.y = liftY;
    kingPose(t, cast.king, def.king, liftY);
    king(t, cast.king, def.king, mine.king);
    blendPose(out, def.king, mine.king, w);
    applyPose(cast.king, out);

    // Lighting: the default cues, with the follow spots on the new marks.
    lighting(t, { aria: cast.aria.root.position, barnaby: barnWorld, king: kingWorld });
    // Children's pool follows the kids; it blooms on "sing".
    const pool = span(t, T.children - 0.3, END + 2, 0.6, 0.8);
    const bloom = span(t, T.sing - 0.05, T.they + 0.2, 0.15, 0.6);
    kidMix.copy(kidWarm).lerp(kidBright, bloom);
    const cx = lerp(-2.05, (pipX + dotX) * 0.5, w);
    setSpot(2, cx, lerp(0.7, 1.1, w), lerp(1.6, 1.5, w), pool * (1 + bloom * 0.35), kidMix);

    // The house: delight from the children's entrance through "every-",
    // then awe from the trap's rumble as the king rises.
    const awe = span(t, T.their - 0.1, END + 2, 0.35, 0.5);
    const joy = span(t, T.children - 0.2, T.their + 0.2, 0.5, 0.6) * (1 - awe);
    set.crowdJoy = lerp(set.crowdJoy, joy, w);
    set.crowdAwe = lerp(set.crowdAwe, Math.max(set.crowdAwe, awe), w);

    // Camera: this clip cuts in and out on its boundaries.
    camera(t, cam);
  },
};
