// Cue sheet for the opening of "One More Dawn" (intro + first half of
// verse 1). Everything is a pure function of song time, so the preview can
// start anywhere and stays in sync with the track.
//
//   Intro  – Aria, the soprano, wakes on her pedestal; a billion pod doors
//            open; she steps forward and reaches for a dream star.
//   Verse  – Barnaby, the old baritone, teaches two little robots to walk,
//            dance and sing; the king rises; the future is placed in his
//            hands; a chain binds him; toy soldiers face off; he bows.

import { Color, Group, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { applyPose, blankPose, copyPose, type Pose, type Rig, type V3 } from './rig.ts';
import { BARITONE_WORDS, CLIP_END, INTRO_LINES, SOPRANO_WORDS, VERSE1_LINES, levelAt } from './song.ts';
import { set } from './stage.ts';
import { backOut, clamp01, easeOut, keys, lerp, noise1, ramp, smooth, span, type Key } from './time.ts';
import { light } from './toon.ts';
import type { Chain, Globe } from './props.ts';

const I = INTRO_LINES;
const V = VERSE1_LINES;
const W = BARITONE_WORDS;

// Named word times used as cues.
export const cue = {
  awaken: SOPRANO_WORDS[3][0],
  doors: SOPRANO_WORDS[4][0],
  question: I[5][0],
  dream: I[6][0],
  why: I[7][0],
  dreamHeld: SOPRANO_WORDS[SOPRANO_WORDS.length - 1][0],
  introEnd: I[7][1],
  bandIn: 40.3,
  helped: W[0][0],
  children: W[5][0],
  walk: W[7][0],
  dance: W[9][0],
  sing: W[11][0],
  trusted: V[2][0],
  kingdoms: W[18][0],
  kings: W[21][0],
  placed: V[4][0],
  hands: W[28][0],
  chainLine: V[5][0],
  chain: W[34][0],
  begged: V[6][0],
  wars: W[41][0],
  never: V[7][0],
  reign: W[46][0],
};

export interface Cast {
  aria: Rig;
  barnaby: Rig;
  pip: Rig;
  dot: Rig;
  king: Rig;
  guards: [Rig, Rig];
  throne: Group;
  globe: Globe;
  chain: Chain;
  lift: Group;
  pedestal: Group;
}

// Mouth opening from word timings: syllable-like pulses, held notes stay open.
export function sing(t: number, words: readonly (readonly [number, number])[], power = 1): number {
  let open = 0;
  for (const [a, b] of words) {
    if (t < a - 0.08 || t > b + 0.12) {
      continue;
    }
    const dur = b - a;
    const u = clamp01((t - a) / Math.max(0.05, dur));
    const attack = clamp01((t - a + 0.08) / 0.1);
    const release = clamp01((b + 0.12 - t) / 0.16);
    const syllables = Math.max(1, Math.round(dur / 0.32));
    const pulse = dur > 0.9 ? 0.82 + Math.sin(t * 31) * 0.05 : 0.45 + 0.55 * Math.abs(Math.sin(Math.PI * u * syllables));
    open = Math.max(open, pulse * attack * release);
  }
  return open * (0.7 + 0.3 * levelAt(t)) * power;
}

export function blinkAt(t: number, seed: number): number {
  const period = 3.1 + seed * 0.7;
  const phase = (t + seed * 1.37) % period;
  return phase < 0.14 ? Math.sin((phase / 0.14) * Math.PI) : 0;
}

export function v3(x: number, y: number, z: number): V3 {
  return [x, y, z];
}

export function mixV(a: V3, b: V3, u: number): V3 {
  return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
}

// Stateless walk: phase from distance travelled along keyed straight paths.
export function travelled(t: number, xs: readonly Key[], zs: readonly Key[]): number {
  return Math.abs(keys(t, xs, smooth) - xs[0][1]) + Math.abs(keys(t, zs, smooth) - zs[0][1]);
}

export function speedOf(t: number, xs: readonly Key[], zs: readonly Key[]): number {
  const dt = 0.06;
  const dx = keys(t + dt, xs, smooth) - keys(t - dt, xs, smooth);
  const dz = keys(t + dt, zs, smooth) - keys(t - dt, zs, smooth);
  return Math.hypot(dx, dz) / (2 * dt);
}

export function walk(pose: Pose, rig: Rig, phase: number, amount: number, stride: number, step: number): void {
  if (!rig.feet || amount <= 0.001) {
    return;
  }
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  pose.footL = mixV(pose.footL, [rig.rest.footL[0], Math.max(0, c) * step, s * stride], amount);
  pose.footR = mixV(pose.footR, [rig.rest.footR[0], Math.max(0, -c) * step, -s * stride], amount);
  pose.lift += (Math.abs(Math.sin(phase)) * 0.05 - 0.03) * amount;
  pose.tilt += Math.sin(phase) * 0.06 * amount;
  pose.handL = mixV(pose.handL, [pose.handL[0], pose.handL[1], pose.handL[2] - s * 0.22], amount);
  pose.handR = mixV(pose.handR, [pose.handR[0], pose.handR[1], pose.handR[2] + s * 0.22], amount);
}

// ---------------------------------------------------------------- lighting

export const cool = new Color(0.55, 0.65, 1.0);
export const moon = new Color(0.35, 0.42, 0.8);
export const warm = new Color(1.0, 0.78, 0.5);
export const gold = new Color(1.0, 0.86, 0.55);
export const dawn = new Color(1.0, 0.62, 0.62);
export const red = new Color(1.0, 0.18, 0.15);
export const steel = new Color(0.55, 0.62, 0.85);
const tmpA = new Color();
const tmpB = new Color();

export function setColor(target: Color, a: Color, b: Color, u: number, scale: number): void {
  target.copy(a).lerp(b, clamp01(u)).multiplyScalar(scale);
}

export function setSpot(i: number, x: number, z: number, r: number, level: number, color: Color, height = 9.5): void {
  const s = light.spots[i];
  s.shape.value.set(x, z, r, level);
  s.color.value.copy(color);
  s.height.value = height;
}

export function lighting(t: number, stagePos: { aria: Vector3; barnaby: Vector3; king: Vector3 }): void {
  const lvl = levelAt(t);
  // Overall key light by section.
  const keyLevel = keys(t, [
    [0, 0.0],
    [3.2, 0.0],
    [6.5, 0.45],
    [10, 0.6],
    [19.3, 0.6],
    [21.5, 0.22],
    [27.5, 0.25],
    [31, 0.45],
    [38.5, 0.5],
    [cue.bandIn - 0.2, 0.3],
    [cue.bandIn + 0.8, 0.95],
    [cue.chainLine, 0.95],
    [cue.chain + 0.3, 0.55],
    [cue.begged, 0.6],
    [cue.never + 0.5, 0.7],
    [cue.reign + 0.3, 0.45],
    [CLIP_END, 0.35],
  ]);
  const toWarm = ramp(t, cue.bandIn - 0.5, cue.bandIn + 1.5);
  const toDawn = ramp(t, cue.dream, cue.dreamHeld);
  const toSteel = span(t, cue.chain - 0.6, cue.never + 0.4, 0.6, 1.2);
  setColor(tmpA, cool, dawn, toDawn * 0.6, 1);
  tmpB.copy(tmpA).lerp(warm, toWarm).lerp(steel, toSteel * 0.6);
  const warsFlash = span(t, cue.wars - 0.05, cue.wars + 0.6, 0.05, 0.5) * 0.9;
  tmpB.lerp(red, warsFlash * 0.7);
  // Keep character colours steady between cues: the key is mostly neutral.
  tmpB.lerp(new Color(1, 0.97, 0.92), 0.65);
  light.key.value.copy(tmpB).multiplyScalar(keyLevel * (0.92 + lvl * 0.15));
  setColor(light.fill.value, new Color(0.05, 0.05, 0.12), new Color(0.12, 0.08, 0.08), toWarm, 1);
  light.fill.value.multiplyScalar(0.6 + 0.6 * ramp(t, 2.5, 6) + toWarm * 0.3);

  // Spot 0: Aria's follow spot.
  const ariaSpot = keys(t, [
    [0, 0],
    [cue.awaken - 0.3, 0],
    [cue.awaken + 0.4, 1.1],
    [19.3, 1.0],
    [21.5, 1.45],
    [cue.introEnd - 0.4, 1.45],
    [cue.bandIn + 1.5, 0.45],
    [CLIP_END, 0.35],
  ]);
  setColor(tmpA, new Color(0.85, 0.9, 1.0), dawn, toDawn, 1);
  setSpot(0, stagePos.aria.x, stagePos.aria.z, keys(t, [[0, 1.0], [21, 1.0], [24, 0.85], [cue.introEnd, 0.95], [cue.bandIn + 2, 1.1]]), ariaSpot, tmpA);

  // Spot 1: Barnaby's follow spot.
  const barnSpot = keys(t, [
    [0, 0],
    [cue.bandIn, 0],
    [cue.bandIn + 1.2, 1.15],
    [cue.chainLine, 1.15],
    [cue.chain + 0.2, 1.35],
    [cue.never, 1.2],
    [cue.reign + 0.4, 0.75],
  ]);
  setColor(tmpA, gold, steel, toSteel, 1);
  setSpot(1, stagePos.barnaby.x, stagePos.barnaby.z + 0.15, keys(t, [[0, 1.3], [cue.chain, 1.3], [cue.chain + 0.4, 1.05], [cue.begged, 1.3]]), barnSpot, tmpA);

  // Spot 2: the children's pool, later the soldiers' red wash.
  const kidSpot = span(t, cue.children - 0.4, cue.begged + 0.4, 0.6, 0.8) * 1.0;
  const kidX = keys(t, [[0, -2.05], [cue.begged, -2.05], [cue.begged + 1.0, 1.4]]);
  setSpot(2, kidX, 0.7, 1.6, kidSpot, new Color(1.0, 0.82, 0.6));

  // Spot 3: the throne.
  const kingSpot = keys(t, [
    [0, 0],
    [cue.kingdoms - 0.2, 0],
    [cue.kingdoms + 0.4, 1.5],
    [cue.kings + 0.6, 1.0],
    [cue.never, 1.0],
    [cue.reign, 1.6],
    [CLIP_END, 1.4],
  ]);
  setSpot(3, stagePos.king.x, stagePos.king.z + 0.2, 1.55, kingSpot, gold);

  // Spot 4: opening pin spot on the curtain, then a soft centre wash and
  // red side washes for the soldiers.
  const pin = keys(t, [[0, 0], [0.6, 0], [1.6, 1.1], [3.0, 1.1], [4.8, 0]]);
  const wars = span(t, cue.begged - 0.2, cue.never + 0.6, 0.6, 0.8);
  set.curtainPin.value = pin * (1 - set.curtainOpen);
  setSpot(4, 0, 1.0, 4.2, wars * (0.45 + warsFlash), red);

  set.footLevel.value = keys(t, [[0, 0], [2.5, 0], [6, 0.25], [19.3, 0.25], [21.5, 0.08], [cue.bandIn - 0.3, 0.1], [cue.bandIn + 0.6, 0.85], [cue.chain, 0.85], [cue.chain + 0.5, 0.45], [cue.reign, 0.4]]) * (0.85 + lvl * 0.3);
  set.marqueeLevel.value = keys(t, [[0, 0.15], [cue.bandIn - 0.2, 0.15], [cue.bandIn + 0.4, 1.0], [cue.chain, 1.0], [cue.chain + 0.5, 0.45], [cue.kingdoms, 0.45]]) + span(t, cue.kingdoms - 0.1, cue.kings + 1.5, 0.2, 1.2) * 0.6;
  set.marqueeChase.value = t * (t > cue.bandIn ? 2.6 : 0.6);
  set.neonLevel.value = keys(t, [[0, 0.0], [2.5, 0.0], [6.0, 0.6], [19.3, 0.6], [21.5, 0.25], [cue.bandIn, 0.3], [cue.bandIn + 0.5, 1.2]]) * (0.85 + lvl * 0.3);
  set.hazeLevel.value = 0.75;

  // Door wall: wakes on "behind a billion doors", obeys in unison on
  // "taught us how to answer", dims for the soprano's question, then glows
  // warm amber behind the verse.
  set.wallWakeAt.value = cue.doors;
  set.wallLevel.value = keys(t, [[0, 1], [19.3, 1], [22, 0.16], [cue.bandIn - 0.5, 0.16], [cue.bandIn + 1, 0.6], [cue.chain, 0.6], [cue.chain + 0.5, 0.4], [cue.reign, 0.4]]);
  set.wallEyeLevel.value = keys(t, [[0, 1], [19.3, 1], [22, 0.12], [cue.bandIn, 0.12], [cue.bandIn + 1, 0.42], [cue.begged, 0.42], [cue.wars, 0.75]]);
  set.wallInterior.value.setRGB(0.94, 0.87, 0.68);
  set.wallEyes.value.setRGB(1.0, 0.98, 0.92);
  set.wallBlinkSync.value = span(t, I[2][0] - 0.3, I[3][1] + 0.5, 0.5, 1.0);
  const look = set.wallLook.value;
  look.set(
    keys(t, [[0, 0], [I[3][0], 0], [I[3][0] + 1, 0], [cue.bandIn, 0], [cue.bandIn + 2, 0.5], [cue.kingdoms, 0.5], [cue.kingdoms + 1, 0], [cue.chain, 0.6]]),
    keys(t, [[0, 0], [I[3][0], 0], [I[3][0] + 0.8, -0.9], [I[3][1], -0.9], [19.6, 0], [cue.dream, 0.9], [cue.bandIn, 0.9], [cue.bandIn + 1.5, 0], [cue.placed, 0], [cue.placed + 1, 0.8], [cue.hands, 0]]),
  );

  set.starLevel.value = keys(t, [[0, 0.25], [cue.dream - 1, 0.25], [cue.dream + 2, 1.3], [cue.introEnd, 1.3], [cue.bandIn + 2, 0.5]]);
  set.dreamStar.value = keys(t, [[0, 0], [cue.why, 0], [cue.dreamHeld - 1, 0.7], [cue.dreamHeld + 0.8, 1.5], [cue.introEnd + 0.8, 0.9], [cue.bandIn + 2, 0.2]]);
  setColor(set.skyHorizon.value, new Color(0.06, 0.03, 0.14), new Color(0.35, 0.12, 0.2), toDawn * (1 - toWarm * 0.5), 1);
}

// ---------------------------------------------------------------- camera

const camPos = new Vector3();
const camLook = new Vector3();

export function camera(t: number, cam: PerspectiveCamera): void {
  const shots: [number, [number, number, number], [number, number, number]][] = [
    [0, [0, 2.9, 19.0], [0, 3.4, 2.0]],
    [3.0, [0, 2.85, 18.6], [0, 3.2, 1.0]],
    [18.5, [0, 2.2, 12.5], [0, 2.1, -1.0]],
    [22.0, [0.2, 1.9, 8.6], [0, 1.75, 0.2]],
    [31.0, [0.1, 1.8, 8.2], [-0.1, 2.1, -0.5]],
    [cue.introEnd - 1, [0.1, 1.9, 9.0], [0.2, 3.3, -2.5]],
    [cue.bandIn + 0.4, [0, 2.3, 15.5], [0, 2.2, -1.0]],
    [cue.helped - 0.4, [0.2, 2.0, 13.0], [0.2, 1.75, -0.6]],
    [cue.walk, [-1.4, 1.7, 9.0], [-1.6, 1.1, 0.0]],
    [cue.trusted + 1.0, [-0.2, 2.0, 12.4], [0, 1.7, -0.8]],
    [cue.kingdoms + 0.2, [0, 2.3, 13.6], [0, 2.1, -1.8]],
    [cue.placed + 1.4, [1.5, 2.0, 9.0], [1.6, 1.85, -0.8]],
    [cue.chain, [0.9, 2.1, 10.6], [0.8, 1.9, -1.6]],
    [cue.begged + 0.6, [0, 2.2, 13.6], [0, 1.95, -1.2]],
    [cue.reign, [0.2, 2.2, 13.0], [0, 2.0, -1.8]],
    [CLIP_END, [0.1, 2.25, 13.4], [0, 2.05, -1.8]],
  ];
  let i = 1;
  while (i < shots.length - 1 && t > shots[i][0]) {
    i += 1;
  }
  const [t0, p0, l0] = shots[i - 1];
  const [t1, p1, l1] = shots[i];
  const u = t <= t0 ? 0 : t >= t1 ? 1 : smooth((t - t0) / (t1 - t0));
  camPos.set(lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u), lerp(p0[2], p1[2], u));
  camLook.set(lerp(l0[0], l1[0], u), lerp(l0[1], l1[1], u), lerp(l0[2], l1[2], u));
  // Gentle hand-held drift.
  camPos.x += noise1(t * 0.25, 1) * 0.06;
  camPos.y += noise1(t * 0.21, 2) * 0.04;
  camLook.x += noise1(t * 0.2, 3) * 0.03;
  cam.position.copy(camPos);
  cam.lookAt(camLook);
}

// ---------------------------------------------------------------- performers

const scratch = blankPose();

export function ariaPose(t: number, rig: Rig, out: Pose): Vector3 {
  const p = copyPose(rig.rest, out);
  const r = rig.rest;
  const onPedestal = 1 - ramp(t, I[4][0] - 0.2, I[4][0] + 1.2);
  const zKeys: Key[] = [[0, -1.0], [I[4][0] - 0.2, -1.0], [I[4][0] + 2.4, 0.9], [cue.introEnd + 0.6, 0.9], [cue.bandIn + 3.0, -3.3]];
  const xKeys: Key[] = [[0, 0], [cue.introEnd + 0.6, 0], [cue.bandIn + 3.0, -5.2]];
  p.x = keys(t, xKeys);
  p.z = keys(t, zKeys);
  p.lift = 0.32 * onPedestal + 0.04 * Math.sin(t * 1.4) + 0.02;
  // Hop down from the pedestal: a little arc.
  p.lift += Math.sin(Math.PI * ramp(t, I[4][0] - 0.2, I[4][0] + 1.2, (u: number) => u)) * 0.18;
  p.yaw = keys(t, [[0, 0], [cue.introEnd + 0.6, 0], [cue.introEnd + 1.4, -0.9], [cue.bandIn + 2.6, -0.9], [cue.bandIn + 3.6, 0.55], [CLIP_END, 0.55]]);
  // Powered down until "awaken".
  const awake = ramp(t, cue.awaken - 0.2, cue.awaken + 0.9, backOut);
  p.eyeGlow = awake * 1.1;
  p.lean = lerp(0.42, 0.0, awake);
  p.headPitch = lerp(0.55, 0, awake);
  p.lid = lerp(1, 0.12, ramp(t, cue.awaken - 0.1, cue.awaken + 0.35)) + blinkAt(t, 0.3) * awake;
  // Wonder: looks around at the doors opening.
  p.headYaw = keys(t, [[0, 0], [cue.doors, 0], [cue.doors + 1.2, 0.5], [cue.doors + 2.6, -0.5], [I[2][0], 0]]);
  p.headPitch -= span(t, cue.doors, I[2][0], 0.8, 0.8) * 0.12;
  p.lookX = p.headYaw * 0.6;
  // Hands: rest -> clasped at chest (dutiful) -> chin (question) -> arms
  // open (dream) -> hand to heart, reach to the star.
  const rest = { L: r.handL, R: r.handR };
  const chestL = v3(-0.06, 0.32, 0.26);
  const chestR = v3(0.06, 0.3, 0.27);
  const chinR = v3(0.05, 0.66, 0.3);
  const wideL = v3(-0.82, 0.62, 0.15);
  const wideR = v3(0.82, 0.62, 0.15);
  const reachR = v3(0.32, 1.18, 0.3);
  const heartL = v3(-0.03, 0.36, 0.27);
  const clasp = span(t, cue.doors + 0.5, I[3][0] + 0.6, 0.8, 0.8);
  const chin = span(t, cue.question - 0.2, cue.dream + 0.2, 0.7, 0.6);
  const wide = span(t, cue.dream, cue.why + 0.5, 0.9, 0.7);
  const heart = span(t, cue.why + 0.2, cue.introEnd + 1.2, 0.6, 0.9);
  const reach = span(t, SOPRANO_WORDS[SOPRANO_WORDS.length - 3][0], cue.introEnd + 1.2, 1.2, 0.9);
  let L = rest.L;
  let R = rest.R;
  L = mixV(L, chestL, clasp);
  R = mixV(R, chestR, clasp);
  R = mixV(R, chinR, chin);
  L = mixV(L, v3(-0.32, 0.12, 0.22), chin);
  L = mixV(L, wideL, wide);
  R = mixV(R, wideR, wide);
  L = mixV(L, heartL, heart);
  R = mixV(R, mixV(v3(0.4, 0.3, 0.25), reachR, 0.0), heart * (1 - reach));
  R = mixV(R, reachR, reach);
  p.handL = L;
  p.handR = R;
  p.bendL = 0.6;
  p.bendR = 0.6 - reach * 0.4;
  // Curtsy on "answer", head shake on "never ask for more".
  const curtsy = span(t, I[2][1] - 0.6, I[2][1] + 0.6, 0.4, 0.5);
  p.lift -= curtsy * 0.1;
  p.lean += curtsy * 0.12;
  p.headYaw += Math.sin((t - I[3][0]) * 7) * 0.14 * span(t, I[3][0] + 0.3, I[3][0] + 1.7, 0.2, 0.3);
  p.headRoll = chin * 0.22 + Math.sin(t * 0.9) * 0.03;
  p.headPitch -= (wide * 0.25 + reach * 0.35);
  p.lookY = wide * 0.6 + reach * 0.8 + chin * 0.3;
  p.lookX += reach * -0.25;
  // Singing.
  p.mouth = sing(t, SOPRANO_WORDS);
  p.headPitch -= p.mouth * 0.04;
  // Sway while singing, still while listening during the verse.
  const listening = ramp(t, cue.bandIn + 2, cue.bandIn + 3.5);
  p.tilt = Math.sin(t * 0.8) * 0.03 * (1 - listening);
  p.headYaw = lerp(p.headYaw, 0.35 + span(t, cue.chain - 0.3, cue.chain + 2.5, 0.3, 1) * 0.45, listening);
  p.lid = lerp(p.lid, 0.4 + blinkAt(t, 1.2), listening);
  // Hand to mouth in worry when the soldiers face off.
  const worry = span(t, cue.wars - 0.6, cue.reign + 0.6, 0.4, 0.8) * listening;
  p.handR = mixV(p.handR, v3(0.04, 0.6, 0.32), worry);
  p.handL = mixV(p.handL, v3(-0.05, 0.36, 0.28), listening * 0.8);
  p.eyeGlow *= 1 - listening * 0.25;
  rig.props.antenna.rotation.z = Math.sin(t * 2.1) * 0.06 + (p.headRoll * -0.5);
  const halo = rig.props.haloLight.userData.material;
  halo.userData.level.value = awake * (0.6 + chin * 1.2 + wide * 0.8 + reach * 1.0);
  return new Vector3(p.x, 0, p.z);
}

export function barnabyPose(t: number, rig: Rig, out: Pose): Vector3 {
  const p = copyPose(rig.rest, out);
  const r = rig.rest;
  // Enters from stage right; steps forward between the soldiers; bows.
  const xKeys: Key[] = [[0, 9.5], [cue.bandIn + 0.4, 9.5], [cue.helped - 0.6, 2.3], [cue.begged + 0.6, 2.3], [cue.wars - 0.3, 1.1]];
  const zKeys: Key[] = [[0, 0.3], [cue.bandIn + 0.4, 0.3], [cue.helped - 0.6, 0.5], [cue.begged + 0.6, 0.5], [cue.wars - 0.3, 1.3]];
  p.x = keys(t, xKeys, smooth);
  p.z = keys(t, zKeys, smooth);
  const speed = speedOf(t, xKeys, zKeys);
  const moving = clamp01(speed / 1.2);
  const phase = travelled(t, xKeys, zKeys) * 4.2;
  p.yaw = keys(t, [[0, -1.3], [cue.helped - 1.6, -1.3], [cue.helped - 0.4, -0.12], [cue.kingdoms + 0.4, -0.12], [cue.kings, -0.55], [cue.placed, -0.1], [cue.never + 0.2, -0.1], [cue.never + 1.0, -1.25], [CLIP_END, -1.25]]);
  p.lean = 0.12 + Math.sin(t * 1.3) * 0.015;
  p.lid = 0.38 + blinkAt(t, 0.9);
  p.lift = Math.sin(t * 1.6) * 0.008;
  // Old-timer gait: short strides, a little rock.
  walk(p, rig, phase, moving, 0.2, 0.12);
  p.tilt += Math.sin(phase) * 0.04 * moving;
  // Hand on chest for "I", open palm toward the children.
  const chest = span(t, cue.helped - 0.3, cue.helped + 1.4, 0.3, 0.6);
  const present = span(t, cue.children - 0.4, cue.walk + 0.2, 0.5, 0.6);
  const conduct = span(t, cue.walk - 0.2, cue.sing + 0.9, 0.3, 0.6);
  const embrace = span(t, cue.trusted - 0.2, cue.kingdoms + 0.4, 0.6, 0.6);
  const receive = span(t, cue.placed + 0.5, cue.begged + 0.8, 0.8, 0.8);
  const overhead = span(t, cue.begged + 0.4, cue.never + 0.4, 0.9, 0.9);
  const offer = span(t, cue.never + 0.4, CLIP_END + 5, 0.9, 0.5);
  let L = r.handL;
  let R = r.handR;
  R = mixV(R, v3(0.08, 0.5, 0.42), chest);
  L = mixV(L, v3(-0.9, 0.62, 0.3), present);
  const beat = Math.sin((t - cue.walk) * 7.5);
  R = mixV(R, v3(0.62 + beat * 0.08, 1.05 + Math.abs(beat) * 0.18, 0.3), conduct);
  L = mixV(L, v3(-1.0, 0.95, 0.2), embrace);
  R = mixV(R, v3(1.0, 0.95, 0.2), embrace);
  L = mixV(L, v3(-0.2, 0.38, 0.62), receive);
  R = mixV(R, v3(0.2, 0.38, 0.62), receive);
  L = mixV(L, v3(-0.24, 1.45, 0.25), overhead);
  R = mixV(R, v3(0.24, 1.45, 0.25), overhead);
  L = mixV(L, v3(-0.2, 0.4, 0.7), offer);
  R = mixV(R, v3(0.2, 0.4, 0.7), offer);
  p.handL = L;
  p.handR = R;
  p.bendL = 0.5 + embrace * 0.3;
  p.bendR = 0.5;
  // Look at the children, up at the globe, down at the chain.
  p.headYaw = present * -0.45 + conduct * -0.35 + span(t, cue.kingdoms, cue.kings + 1, 0.3, 0.6) * -0.3;
  p.headPitch = -embrace * 0.18 - span(t, cue.placed, cue.hands, 0.5, 0.5) * 0.35 + receive * 0.12;
  const chainLook = span(t, cue.chain - 0.1, cue.begged + 0.2, 0.3, 0.8);
  p.headPitch += chainLook * 0.4;
  p.headYaw += chainLook * -0.35;
  p.lookY = -chainLook * 0.6 + embrace * 0.4;
  // Jolt when the chain snaps tight.
  const jolt = span(t, cue.chain, cue.chain + 0.45, 0.04, 0.4);
  p.squash = 1 - jolt * 0.08;
  p.lean += jolt * 0.12 + chainLook * 0.1;
  // The bow at "never break their reign".
  const bow = span(t, cue.never + 0.8, CLIP_END + 5, 1.2, 0.5);
  p.lean += bow * 0.38;
  p.lift -= bow * 0.06;
  p.headPitch += bow * 0.2;
  // Singing.
  p.mouth = sing(t, W);
  p.headPitch -= p.mouth * 0.06;
  p.headRoll = Math.sin(t * 1.1) * 0.04 + p.mouth * Math.sin(t * 3.0) * 0.03;
  const bulb = rig.props.bulb.userData.material;
  bulb.userData.level.value = 0.7 + p.mouth * 0.6;
  p.visible = t > cue.bandIn - 0.5;
  return new Vector3(p.x, 0, p.z);
}

export function kidPose(t: number, rig: Rig, out: Pose, which: 0 | 1): void {
  const p = copyPose(rig.rest, out);
  const r = rig.rest;
  const home = which === 0 ? -2.7 : -1.45;
  const homeZ = which === 0 ? 0.55 : 0.95;
  const hide = which === 0 ? 1.75 : 2.25;
  const enter = cue.helped + 0.6 + which * 0.35;
  const xKeys: Key[] = [[0, -9.5], [enter, -9.5], [cue.children + 0.4, home - 0.45], [cue.walk, home - 0.45], [cue.walk + 0.5, home], [cue.begged, home], [cue.begged + 1.2, hide]];
  const zKeys: Key[] = [[0, homeZ], [cue.walk, homeZ], [cue.begged, homeZ], [cue.begged + 1.2, which === 0 ? 0.3 : 0.0]];
  p.x = keys(t, xKeys, smooth);
  p.z = keys(t, zKeys, smooth);
  const speed = speedOf(t, xKeys, zKeys);
  const moving = clamp01(speed / 1.4);
  const phase = travelled(t, xKeys, zKeys) * 9;
  // Facing: run in facing right, then face front; turn to the throne.
  const toKing = span(t, cue.kingdoms + 0.2, cue.placed, 0.4, 0.6);
  p.yaw = lerp(1.25 * moving, which === 0 ? 0.35 : -0.2, 1 - moving) * 1;
  p.yaw = lerp(p.yaw, which === 0 ? 2.6 : -2.7, toKing * 0.75);
  p.yaw = lerp(p.yaw, 3.0, span(t, cue.begged + 0.6, CLIP_END + 5, 0.4, 0.5) * 0.15);
  walk(p, rig, phase, moving, 0.12, 0.09);
  // Toddle on "walk": stiff wobbly steps.
  const toddle = span(t, cue.walk - 0.05, cue.walk + 0.6, 0.05, 0.15);
  p.tilt += Math.sin((t - cue.walk) * 14) * 0.18 * toddle;
  p.handL = mixV(p.handL, v3(-0.32, 0.36, 0.2), toddle);
  p.handR = mixV(p.handR, v3(0.32, 0.36, 0.2), toddle);
  // Spin on "dance".
  const spin = ramp(t, cue.dance - 0.05, cue.dance + 0.55, easeOut);
  p.yaw += spin * Math.PI * 2 * (which === 0 ? 1 : -1);
  p.lift += Math.sin(Math.PI * spin) * 0.18;
  const danceArms = span(t, cue.dance - 0.05, cue.dance + 0.6, 0.05, 0.2);
  p.handL = mixV(p.handL, v3(-0.32, 0.55, 0.0), danceArms);
  p.handR = mixV(p.handR, v3(0.32, 0.55, 0.0), danceArms);
  // Arms up and sing on "sing".
  const singing = span(t, cue.sing - 0.05, cue.trusted + 0.3, 0.12, 0.5);
  p.handL = mixV(p.handL, v3(-0.36, 0.62, 0.12), singing);
  p.handR = mixV(p.handR, v3(0.36, 0.62, 0.12), singing);
  p.mouth = Math.max(singing * (0.75 + Math.sin(t * 9 + which) * 0.15), 0);
  p.headPitch = -singing * 0.25;
  p.lift += singing * Math.abs(Math.sin((t - cue.sing) * 6)) * 0.05;
  // Look up at the old robot; bow to the king; awe at the globe.
  p.headYaw = span(t, cue.trusted, cue.kingdoms, 0.4, 0.4) * 0.6;
  p.headPitch -= span(t, cue.trusted, cue.kingdoms, 0.4, 0.4) * 0.3;
  const kidBow = span(t, cue.kings, cue.kings + 1.3, 0.3, 0.5);
  p.lean += kidBow * 0.5;
  const awe = span(t, cue.placed, cue.chain, 0.6, 0.6);
  p.headPitch -= awe * 0.35;
  p.lookY = awe * 0.7;
  // Scared: peek out from behind Barnaby.
  const scared = span(t, cue.begged + 0.8, CLIP_END + 5, 0.4, 0.5);
  p.handL = mixV(p.handL, v3(-0.08, 0.5, 0.22), scared);
  p.handR = mixV(p.handR, v3(0.08, 0.52, 0.22), scared);
  p.squash = 1 - scared * 0.06 + Math.sin(t * 22) * 0.012 * scared;
  p.lid = 0.05 + blinkAt(t, 2 + which);
  p.visible = t > enter - 0.2;
  if (rig.props.propeller) {
    rig.props.propeller.rotation.y = t * (6 + moving * 20 + spin * 30);
  }
  if (rig.props.tailL && rig.props.tailR) {
    const bounce = Math.sin(t * 8) * 0.12 * (moving + danceArms + singing * 0.5);
    rig.props.tailL.rotation.z = 0.4 + bounce;
    rig.props.tailR.rotation.z = -0.4 - bounce;
  }
  void r;
}

export function kingPose(t: number, rig: Rig, out: Pose, liftY: number): void {
  const p = copyPose(rig.rest, out);
  p.x = 0;
  p.z = 0.1;
  p.lift = -0.0;
  // Seated: feet forward, legs bent.
  p.footL = [-0.26, 0, 0.62];
  p.footR = [0.26, 0, 0.62];
  p.lean = -0.05;
  const raise = span(t, cue.chainLine - 0.3, cue.chain + 0.6, 0.5, 0.8);
  const nod = span(t, cue.reign - 0.2, cue.reign + 1.0, 0.3, 0.5);
  p.handL = [-0.62, 0.15, 0.4];
  p.handR = mixV([0.62, 0.15, 0.38], [0.7, 1.0, 0.5], raise);
  p.bendL = 0.3;
  p.bendR = 0.4;
  p.headPitch = -0.12 + nod * 0.22 + Math.sin(t * 0.7) * 0.02;
  p.headYaw = keys(t, [[0, 0], [cue.helped, 0], [cue.placed, 0.3], [CLIP_END, 0.3]]);
  p.lid = 0.45 + blinkAt(t, 3.3);
  p.lookX = 0.3;
  // Haughty chin-up on arrival.
  p.headPitch -= span(t, cue.kings - 0.2, cue.kings + 1.0, 0.2, 0.6) * 0.2;
  p.visible = liftY > -3.8;
}

export function guardPose(t: number, rig: Rig, out: Pose, side: -1 | 1): void {
  const p = copyPose(rig.rest, out);
  const enter = cue.begged - 0.3 + (side > 0 ? 0.15 : 0);
  const xKeys: Key[] = [[0, side * 9.5], [enter, side * 9.5], [enter + 1.8, side * 2.9]];
  const zKeys: Key[] = [[0, 0.9], [enter + 1.8, 0.9]];
  p.x = keys(t, xKeys, smooth);
  p.z = keys(t, zKeys, smooth);
  const speed = speedOf(t, xKeys, zKeys);
  const moving = clamp01(speed / 1.2);
  // March: high knees, stiff.
  const phase = travelled(t, xKeys, zKeys) * 5.2;
  walk(p, rig, phase, moving, 0.16, 0.22);
  p.yaw = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  p.yaw += side * span(t, cue.never - 0.1, CLIP_END + 5, 0.4, 0.5) * -0.9;
  const aim = span(t, cue.wars - 0.35, cue.never + 0.3, 0.2, 0.4);
  const swing = Math.sin(phase);
  p.handL = mixV([-0.25, 0.32, 0.2], [-0.25, 0.72, 0.42], aim);
  p.handR = mixV([0.34 + swing * 0.0, 0.0, swing * 0.18], [-0.1, 0.62, 0.45], aim);
  p.bendL = 0.4;
  p.bendR = 0.4;
  const rifle = rig.props.rifle;
  rifle.rotation.x = lerp(-0.1, -1.4, aim);
  p.lean = aim * 0.08 - span(t, cue.never, CLIP_END + 5, 0.4, 0.4) * 0.05;
  p.headPitch = -0.05;
  p.lid = 0.25 + blinkAt(t, 4 + side);
  p.mouth = span(t, cue.wars - 0.1, cue.wars + 0.6, 0.05, 0.3) * 0.6;
  // Flinch when the soldiers stand down.
  p.squash = 1 + span(t, cue.never - 0.1, cue.never + 0.4, 0.05, 0.3) * 0.06;
  p.visible = t > enter - 0.1;
}

// ---------------------------------------------------------------- frame

const ariaWorld = new Vector3();
const barnWorld = new Vector3();
const kingWorld = new Vector3(0, 0, -4.4);
const tmpV = new Vector3();
const tmpW = new Vector3();
const poses = {
  aria: blankPose(),
  barnaby: blankPose(),
  pip: blankPose(),
  dot: blankPose(),
  king: blankPose(),
  g0: blankPose(),
  g1: blankPose(),
};

// The original full-length staging. Clips start from this and override
// whatever they own (see director.ts and clips/).
export function defaultFrame(t: number, cast: Cast, cam: PerspectiveCamera): void {
  // Curtains part on the first sung line.
  set.curtainOpen = ramp(t, cue.awaken - 2.2, cue.doors + 0.2, smooth);
  set.pedestalDrop = ramp(t, cue.bandIn + 1.0, cue.bandIn + 3.2, smooth);

  ariaWorld.copy(ariaPose(t, cast.aria, poses.aria));
  barnWorld.copy(barnabyPose(t, cast.barnaby, poses.barnaby));
  kidPose(t, cast.pip, poses.pip, 0);
  kidPose(t, cast.dot, poses.dot, 1);

  const liftY = keys(t, [[0, -4.8], [cue.kingdoms - 0.3, -4.8], [cue.kings + 0.3, 0]], easeOut);
  cast.lift.position.y = liftY;
  kingPose(t, cast.king, poses.king, liftY);
  guardPose(t, cast.guards[0], poses.g0, -1);
  guardPose(t, cast.guards[1], poses.g1, 1);

  applyPose(cast.aria, poses.aria);
  applyPose(cast.barnaby, poses.barnaby);
  applyPose(cast.pip, poses.pip);
  applyPose(cast.dot, poses.dot);
  applyPose(cast.king, poses.king);
  applyPose(cast.guards[0], poses.g0);
  applyPose(cast.guards[1], poses.g1);
  cast.pedestal.visible = true;

  // The globe drifts down into Barnaby's hands and stays with him.
  const scene = cast.globe.group;
  const descend = ramp(t, cue.placed, cue.hands + 0.2, smooth);
  scene.visible = t > cue.placed - 0.1;
  cast.barnaby.root.updateMatrixWorld(true);
  const handsMid = tmpV.copy(cast.barnaby.hands[0].position).add(cast.barnaby.hands[1].position).multiplyScalar(0.5);
  cast.barnaby.torso.localToWorld(handsMid);
  handsMid.y += 0.2;
  handsMid.z += 0.06;
  tmpW.set(barnWorld.x + 0.1, 7.5, barnWorld.z + 0.5);
  scene.position.copy(tmpW).lerp(handsMid, descend);
  scene.rotation.y = t * 0.6;
  cast.globe.glowLevel.value = 0.8 + span(t, cue.hands - 0.2, cue.hands + 1.0, 0.1, 0.8) * 0.8;

  // Chain from the sceptre to Barnaby's left wrist.
  cast.king.root.updateMatrixWorld(true);
  const sceptreTip = cast.king.props.sceptre.localToWorld(tmpV.set(0, 0.5, 0));
  const wrist = cast.barnaby.hands[0].localToWorld(tmpW.set(0, -0.02, 0));
  const reveal = ramp(t, cue.chainLine + 0.2, cue.chain + 0.05, smooth);
  const sag = lerp(0.9, 0.35, ramp(t, cue.chain, cue.chain + 0.3, backOut));
  cast.chain.update(sceptreTip, wrist, reveal, sag);

  lighting(t, { aria: ariaWorld, barnaby: barnWorld, king: kingWorld });
  camera(t, cam);
  void scratch;
}
