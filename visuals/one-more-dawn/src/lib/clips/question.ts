// Clip "question" (19.3 s – 40.3 s): Aria steps forward, the question, the dream star (intro lines 5–8).
// This file owns everything on screen in its window: camera, lighting cues
// and every performer's pose. Start from defaultFrame and replace parts of
// it here; do not edit shared engine, cast or set files from a clip lane.
//
// Shot list (song seconds):
//   S1 19.30–23.50  Medium-wide frontal push-in. The house hushes; Aria hops
//                   off her pedestal and glides forward into her spot.
//   S2 23.50–27.94  Three-quarter medium close-up. "A question came to me":
//                   hand to chin, then hand to chest on "me".
//   S3 27.94–32.90  Low-angle wide. "If we can dream of everything": arms
//                   open on "dream" and the camera tilts up into the stars.
//   S4 32.90–34.90  Frontal medium close-up. "Why can't I": hands to heart.
//   S5 34.90–37.45  Close profile from house right. "dream a dream": she turns
//                   upstage and finds the dream star above the sleeping house.
//   S6 37.45–40.30  Low-angle hero shot, push-in on the held "me": she turns
//                   back and reaches for the star. Held tableau at the end.

import { Color, Vector3, type PerspectiveCamera } from 'three/webgpu';
import { applyPose, blankPose, copyPose, type Pose, type V3 } from '../rig.ts';
import { cue, defaultFrame, lighting, mixV, setSpot, sing, blinkAt, v3, ariaPose, dawn, type Cast } from '../show.ts';
import { SOPRANO_WORDS as SW } from '../song.ts';
import { set } from '../stage.ts';
import { backOut, clamp01, easeOut, keys, lerp, noise1, ramp, smooth, span, type Key } from '../time.ts';

const START = 19.3;
const END = 40.3;

// Word starts used as cues (soprano intro words 19..42).
const w = (i: number): number => SW[i][0];
const WORD = {
  yet: w(19),
  silence: w(23),
  a: w(24),
  question: w(25),
  me1: w(28),
  ifWe: w(29),
  dream1: w(32),
  everything: w(34),
  everythingEnd: SW[34][1],
  why: w(35),
  i: w(37),
  dream2: w(38),
  dream3: w(40),
  forW: w(41),
  me2: w(42),
};

// ------------------------------------------------------------------ pose

const base = blankPose();
const mine = blankPose();
const out = blankPose();

// Aria's own performance for this window. Hand targets are torso-local.
function ariaActing(t: number, p: Pose): void {
  // --- Travel: anticipation dip, hop off the pedestal, glide to the spot.
  const dip = span(t, 19.35, 19.75, 0.18, 0.2);
  const hopU = ramp(t, 19.62, 20.42, (u: number) => u);
  const land = span(t, 20.36, 20.9, 0.06, 0.4);
  const zKeys: Key[] = [[START, -1.0], [19.62, -1.0], [20.42, -0.35], [22.4, 0.9]];
  p.x = 0;
  p.z = keys(t, zKeys);
  const onPed = 1 - ramp(t, 19.62, 20.42);
  p.lift = 0.32 * onPed + Math.sin(Math.PI * hopU) * 0.2 - dip * 0.07 - land * 0.08 + 0.02;
  p.squash = 1 - dip * 0.1 - land * 0.12 + Math.sin(Math.PI * hopU) * 0.05;
  p.lean = dip * 0.1 + land * 0.12 + span(t, 20.5, 22.6, 0.6, 0.8) * 0.06;
  // Gentle float once she settles.
  p.lift += 0.03 * Math.sin(t * 1.4) * ramp(t, 22.2, 23.2);

  // --- Facing: front, a turn upstage to find the star, back to the house.
  const turnAway = ramp(t, WORD.dream2 - 0.05, WORD.dream2 + 0.8, backOut);
  const turnBack = ramp(t, 36.85, 37.75, smooth);
  p.yaw = 1.1 * turnAway * (1 - turnBack) + Math.sin(t * 0.7) * 0.03 * ramp(t, 22.4, 23.0);
  p.yaw += span(t, WORD.dream1, WORD.everythingEnd + 0.6, 0.8, 1.0) * 0.12 * Math.sin((t - WORD.dream1) * 1.3);

  // --- Hands.
  const restL = v3(-0.34, -0.22, 0.1);
  const restR = v3(0.34, -0.22, 0.1);
  const claspL = v3(-0.07, 0.12, 0.27);
  const claspR = v3(0.07, 0.1, 0.28);
  const chinR = v3(0.07, 0.8, 0.36);
  const elbowL = v3(-0.04, 0.33, 0.3);
  const chestR = v3(0.03, 0.42, 0.3);
  const gatherL = v3(-0.14, 0.26, 0.3);
  const gatherR = v3(0.14, 0.24, 0.3);
  const wideL = v3(-0.86, 0.72, 0.18);
  const wideR = v3(0.86, 0.72, 0.18);
  const highL = v3(-0.78, 1.0, 0.08);
  const highR = v3(0.78, 1.0, 0.08);
  const settleL = v3(-0.58, 0.32, 0.22);
  const settleR = v3(0.58, 0.32, 0.22);
  const heartL = v3(-0.04, 0.38, 0.28);
  const heartR = v3(0.05, 0.43, 0.32);
  const openR = v3(0.48, 0.16, 0.32);
  const reachR = v3(0.68, 1.22, 0.22);

  const clasp = span(t, 20.6, WORD.a + 0.1, 0.9, 0.5);
  const think = span(t, WORD.a - 0.1, WORD.me1 + 0.15, 0.55, 0.45);
  const toChest = span(t, WORD.me1 - 0.05, WORD.ifWe + 0.2, 0.4, 0.4);
  const gather = span(t, WORD.ifWe - 0.1, WORD.dream1 + 0.05, 0.5, 0.18);
  const wide = span(t, WORD.dream1 - 0.12, WORD.everythingEnd + 0.9, 0.5, 1.2);
  const wideSnap = ramp(t, WORD.dream1 - 0.12, WORD.dream1 + 0.45, backOut);
  const high = span(t, WORD.everything - 0.1, WORD.everythingEnd + 0.9, 0.6, 1.2);
  const settle = span(t, WORD.everythingEnd + 0.4, WORD.why + 0.2, 1.0, 0.5);
  const heartLw = span(t, WORD.why - 0.2, END + 2, 0.55, 0.5);
  const openRw = span(t, WORD.why - 0.1, WORD.i + 0.1, 0.5, 0.45);
  const heartRw = span(t, WORD.i - 0.1, WORD.dream3 + 0.2, 0.4, 0.5);
  const dipR = span(t, WORD.dream3 - 0.1, WORD.forW + 0.1, 0.3, 0.3);
  const reach = ramp(t, WORD.forW - 0.2, WORD.me2 + 0.5, easeOut);

  let L = restL;
  let R = restR;
  L = mixV(L, claspL, clasp);
  R = mixV(R, claspR, clasp);
  // Thinking: right hand to the chin, left hand cups the right elbow;
  // a little finger tap on "came".
  const tap = span(t, w(26) - 0.05, w(26) + 0.4, 0.1, 0.25) * 0.04;
  R = mixV(R, [chinR[0], chinR[1] - tap, chinR[2]], think * ramp(t, WORD.a - 0.1, WORD.question + 0.25, backOut));
  L = mixV(L, elbowL, think);
  R = mixV(R, chestR, toChest);
  L = mixV(L, v3(-0.3, 0.05, 0.22), toChest);
  L = mixV(L, gatherL, gather);
  R = mixV(R, gatherR, gather);
  const wideK = wide * Math.min(1.15, wideSnap);
  L = mixV(L, wideL, wideK);
  R = mixV(R, wideR, wideK);
  L = mixV(L, highL, high);
  R = mixV(R, highR, high);
  L = mixV(L, settleL, settle);
  R = mixV(R, settleR, settle);
  L = mixV(L, heartL, heartLw);
  R = mixV(R, openR, openRw);
  R = mixV(R, heartR, heartRw);
  R = mixV(R, v3(0.3, 0.2, 0.34), dipR);
  R = mixV(R, reachR, reach);
  // Follow-through: the reaching hand drifts a touch as the note is held.
  R = [R[0] + Math.sin(t * 1.6) * 0.02 * reach, R[1] + Math.sin(t * 1.1) * 0.015 * reach, R[2]];
  p.handL = L;
  p.handR = R;
  p.bendL = 0.6 - wide * 0.25;
  p.bendR = 0.6 - wide * 0.25 - reach * 0.4;

  // --- Body.
  p.lift += -gather * 0.05 + wide * 0.06 + high * 0.03 + reach * 0.06 - span(t, WORD.why, WORD.dream2, 0.5, 0.4) * 0.03;
  p.lean += gather * 0.07 - wide * 0.08 - reach * 0.06 + span(t, WORD.why, WORD.dream2, 0.5, 0.4) * 0.05;
  p.squash *= 1 - gather * 0.05 + (wideSnap > 1 ? (wideSnap - 1) * 0.3 : 0) * wide;
  p.twist = high * Math.sin((t - WORD.everything) * 2.4) * 0.1;
  p.tilt = Math.sin(t * 0.8) * 0.03 + think * 0.04;

  // --- Head and eyes.
  // Silence: she looks out over the hushed house, left then right.
  const scan = span(t, 20.8, WORD.a, 0.6, 0.6);
  p.headYaw = scan * Math.sin((t - 20.8) * 1.5) * 0.35;
  p.headPitch = scan * 0.04;
  // Question: tilt, eyes up and to the side.
  p.headRoll = think * 0.22 - toChest * 0.12 + Math.sin(t * 0.9) * 0.03;
  p.headYaw += think * 0.18 - toChest * 0.1;
  p.headPitch -= think * 0.08;
  // Dream: chin up to the stars.
  p.headPitch -= wide * 0.32 + settle * 0.25 + high * 0.06;
  // Why: head lowered, wistful; then lifts to find the star.
  const wistful = span(t, WORD.why - 0.1, WORD.dream2 + 0.1, 0.5, 0.5);
  p.headPitch += wistful * 0.14;
  p.headRoll += wistful * -0.1;
  const findStar = span(t, WORD.dream2, WORD.forW, 0.5, 0.6);
  p.headPitch -= findStar * 0.28 + reach * 0.22;
  p.headYaw += findStar * 0.5 * (1 - turnBack) + reach * 0.15;

  p.lookX = p.headYaw * 0.5 + think * 0.5;
  p.lookY = think * 0.7 + wide * 0.5 + settle * 0.6 + findStar * 0.6 + reach * 0.8 - wistful * 0.4;
  // Eyes: soft and heavy in the silence, half-closed on "why", wide at the star.
  const surprise = span(t, WORD.dream2 + 0.3, WORD.dream2 + 1.4, 0.15, 0.6);
  p.lid = 0.14 + scan * 0.1 + wistful * 0.28 - surprise * 0.12 + blinkAt(t, 0.3) * (1 - reach);
  p.eyeGlow = 1.1 + surprise * 0.3 + reach * 0.3;

  // --- Singing (soprano word timings).
  p.mouth = sing(t, SW);
  p.headPitch -= p.mouth * 0.04;
}

// ------------------------------------------------------------------ camera

type Shot = { a: number; b: number; p0: V3; l0: V3; p1: V3; l1: V3; ease?: (u: number) => number; hold?: number };

// Look point from a camera position and a heading (degrees; az > 0 is
// screen right, el > 0 is up).
function aim(c: V3, az: number, el: number): V3 {
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  return [c[0] + Math.sin(a) * Math.cos(e) * 10, c[1] + Math.sin(e) * 10, c[2] - Math.cos(a) * Math.cos(e) * 10];
}

const S3A: V3 = [0.6, 1.7, 4.9];
const S3B: V3 = [0.9, 0.65, 5.6];
const S5A: V3 = [1.15, 2.2, 3.9];
const S5B: V3 = [1.05, 2.18, 3.55];
const S6A: V3 = [1.2, 1.0, 8.0];
const S6B: V3 = [0.95, 1.05, 6.4];

const SHOTS: Shot[] = [
  // S1: the hush; push in as she comes forward.
  { a: START, b: 23.5, p0: [0, 1.85, 6.9], l0: [0, 1.5, -0.8], p1: [0.1, 1.85, 5.9], l1: [0, 1.55, 0.6] },
  // S2: the question, three-quarter medium close-up from house right.
  { a: 23.5, b: WORD.ifWe, p0: [1.15, 2.1, 4.3], l0: [0.35, 2.0, 0.9], p1: [0.9, 2.08, 3.75], l1: [0.3, 2.05, 0.9] },
  // S3: boom down from eye level to a low angle as her arms open; the
  // stars fill the top of frame.
  { a: WORD.ifWe, b: 32.9, p0: S3A, l0: [0.2, 1.9, 0], p1: S3B, l1: aim(S3B, -2, 14), ease: (u: number) => ramp(u, 0.12, 0.62) },
  // S4: frontal medium close-up, hands to heart.
  { a: 32.9, b: 34.9, p0: [0.15, 1.85, 3.7], l0: [0.0, 1.95, 0.9], p1: [0.12, 1.88, 3.3], l1: [0.0, 2.0, 0.9] },
  // S5: close from house right; in profile she finds the star over the
  // sleeping house.
  { a: 34.9, b: 37.45, p0: S5A, l0: aim(S5A, -8, 7), p1: S5B, l1: aim(S5B, -8, 8.5) },
  // S6: hero low angle, Aria left third, star right third; push in on the
  // held note.
  { a: 37.45, b: END, p0: S6A, l0: aim(S6A, -2.5, 10.5), p1: S6B, l1: aim(S6B, -2.5, 11.5) },
];

const camPos = new Vector3();
const camLook = new Vector3();

function shoot(t: number, cam: PerspectiveCamera): void {
  const s = SHOTS.find(x => t < x.b) ?? SHOTS[SHOTS.length - 1];
  const raw = clamp01((t - s.a) / (s.b - s.a));
  const u = s.ease ? s.ease(raw) : smooth(raw);
  camPos.set(lerp(s.p0[0], s.p1[0], u), lerp(s.p0[1], s.p1[1], u), lerp(s.p0[2], s.p1[2], u));
  camLook.set(lerp(s.l0[0], s.l1[0], u), lerp(s.l0[1], s.l1[1], u), lerp(s.l0[2], s.l1[2], u));
  // Gentle hand-held drift, smaller on the close shots.
  const near = camPos.distanceTo(camLook) < 4.5 ? 0.5 : 1;
  camPos.x += noise1(t * 0.25, 1) * 0.04 * near;
  camPos.y += noise1(t * 0.21, 2) * 0.03 * near;
  camLook.x += noise1(t * 0.2, 3) * 0.02 * near;
  cam.position.copy(camPos);
  cam.lookAt(camLook);
}

// ------------------------------------------------------------------ light

const ariaWorld = new Vector3();
const barnWorld = new Vector3(9.5, 0, 0.3);
const kingWorld = new Vector3(0, 0, -4.4);
const spotColor = new Color();
const cold = new Color(0.82, 0.88, 1.0);

function cueLights(t: number, edge: number): void {
  lighting(t, { aria: ariaWorld, barnaby: barnWorld, king: kingWorld });
  // Default values (already set by lighting) for the hand-off blend.
  const dStars = set.starLevel.value as number;
  const dStar = set.dreamStar.value as number;
  // Stars bloom on "dream"; the dream star is found on the second "dream"
  // and flares on the held "me".
  const stars = keys(t, [[START, 0.25], [WORD.dream1 - 0.1, 0.3], [WORD.dream1 + 1.4, 1.35], [END, 1.35]]);
  const star = keys(t, [[START, 0], [WORD.dream2, 0], [WORD.dream2 + 0.9, 0.75], [WORD.me2, 0.9], [WORD.me2 + 0.7, 1.55], [END, 1.45]]);
  set.starLevel.value = lerp(dStars, stars, edge);
  set.dreamStar.value = lerp(dStar, star, edge);
  // Aria's follow spot: tightens on "question", opens on "dream", warms
  // toward dawn on "me".
  const r = keys(t, [[START, 1.0], [WORD.a, 1.0], [WORD.question + 0.4, 0.82], [WORD.dream1 - 0.1, 0.82], [WORD.dream1 + 0.6, 1.0], [WORD.why, 1.0], [WORD.why + 0.6, 0.88], [WORD.me2, 0.88], [WORD.me2 + 0.8, 1.0], [END, 0.98]]);
  const level = keys(t, [[START, 1.0], [21.5, 1.15], [WORD.me2, 1.15], [WORD.me2 + 0.8, 1.3], [END, 1.25]]);
  const toDawn = ramp(t, WORD.dream2, WORD.me2 + 0.8);
  spotColor.copy(cold).lerp(dawn, toDawn);
  const dLevel = keys(t, [[START, 1.0], [21.5, 1.15], [END, 1.15]]);
  setSpot(0, ariaWorld.x, ariaWorld.z, lerp(1.0, r, edge), lerp(dLevel, level, edge), spotColor);
}

// ------------------------------------------------------------------ frame

export const clip = {
  id: 'question',
  start: START,
  end: END,
  frame(t: number, cast: Cast, cam: PerspectiveCamera): void {
    defaultFrame(t, cast, cam);
    // Hand-off weight: 0 in the first/last 0.25 s, 1 inside.
    const edge = ramp(t, START + 0.25, START + 0.45) * (1 - ramp(t, END - 0.6, END - 0.25));
    const rig = cast.aria;
    ariaPose(t, rig, base);
    copyPose(base, mine);
    ariaActing(t, mine);
    // Position and facing follow the acting except inside the hand-off edges.
    // Acting stays on; placement (position, facing, height) meets
    // defaultFrame inside the hand-off edges.
    copyPose(mine, out);
    out.x = lerp(base.x, mine.x, edge);
    out.z = lerp(base.z, mine.z, edge);
    out.yaw = lerp(base.yaw, mine.yaw, edge);
    out.lift = lerp(base.lift, mine.lift, edge);
    // At the end of the held note the whole body (arms and head included)
    // settles into the next clip's opening pose so the cut has no jump.
    const settle = 1 - ramp(t, END - 0.6, END - 0.25);
    for (let k = 0; k < 3; k += 1) {
      out.handL[k] = lerp(base.handL[k], out.handL[k], settle);
      out.handR[k] = lerp(base.handR[k], out.handR[k], settle);
    }
    out.bendL = lerp(base.bendL, out.bendL, settle);
    out.bendR = lerp(base.bendR, out.bendR, settle);
    out.headYaw = lerp(base.headYaw, out.headYaw, settle);
    out.headPitch = lerp(base.headPitch, out.headPitch, settle);
    out.headRoll = lerp(base.headRoll, out.headRoll, settle);
    out.lean = lerp(base.lean, out.lean, settle);
    applyPose(rig, out);
    ariaWorld.set(out.x, 0, out.z);
    rig.props.antenna.rotation.z = Math.sin(t * 2.1) * 0.06 - out.headRoll * 0.5;
    const halo = rig.props.haloLight.userData.material;
    const glowUp = span(t, WORD.a, WORD.me1 + 0.5, 0.5, 0.6) * 1.0 + span(t, WORD.dream1, 32.6, 0.5, 1.0) * 0.8 + ramp(t, WORD.forW, WORD.me2 + 0.6) * 1.2;
    halo.userData.level.value = lerp(halo.userData.level.value, 0.6 + glowUp, edge);
    cueLights(t, edge);
    shoot(t, cam);
  },
};
