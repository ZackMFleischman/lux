// Clip "awakening" (0 s – 19.3 s): Aria wakes on her pedestal; the doors open; obedient blinks (intro lines 1–4).
// This file owns everything on screen in its window: camera, lighting cues
// and every performer's pose. Start from defaultFrame and replace parts of
// it here; do not edit shared engine, cast or set files from a clip lane.
//
// Shot list (song seconds; cuts land on sung words or just before them):
//   S1  0.00 – 3.57  Establishing: closed curtain, pin spot, curtain parts.
//   S2  3.57 – 7.20  "A billion minds awaken": Aria full figure, push in to
//                     a medium close-up as she powers on.
//   S3  7.20 – 10.40 "Behind a billion doors": low angle past Aria's face to
//                     the balconies; tilt up with the door wave.
//   S4 10.40 – 11.40 Reaction insert: one balcony bay turns to look at her.
//   S5 11.40 – 15.20 "They taught us how to answer": three-quarter medium,
//                     crowd behind blinks and nods in unison; she curtsies.
//   S6 15.20 – 17.00 "And never ask": close-up, a small head shake.
//   S7 17.00 – 19.30 "for more": slow crane back to a tableau wide, the
//                     whole house looking down, Aria alone in her spot.

import type { PerspectiveCamera } from 'three/webgpu';
import { Vector3 } from 'three/webgpu';
import { applyPose, blankPose, type Pose, type V3 } from '../rig.ts';
import { INTRO_LINES, SOPRANO_WORDS } from '../song.ts';
import { ariaPose, defaultFrame, mixV, setSpot, type Cast } from '../show.ts';
import { set } from '../stage.ts';
import { backOut, easeOut, keys, lerp, ramp, smooth, smoother, span } from '../time.ts';
import { light } from '../toon.ts';

const I = INTRO_LINES;
const SW = SOPRANO_WORDS;
const END = 19.3;
// Word cues used in this clip.
const w = {
  a: SW[0][0], // "A" 3.57
  minds: SW[2][0], // 4.24
  awaken: SW[3][0], // 4.90
  behind: SW[4][0], // 7.34
  doors: SW[7][0], // 8.94
  they: SW[8][0], // 11.52
  taught: SW[9][0], // 11.78
  how: SW[11][0], // 12.32
  answer: SW[13][0], // 13.00
  answerEnd: SW[13][1], // 14.08
  and: SW[14][0], // 15.36
  never: SW[15][0], // 15.72
  ask: SW[16][0], // 16.04
  forW: SW[17][0], // 16.78
  more: SW[18][0], // 17.32
  moreEnd: SW[18][1], // 18.80
};

// ---------------------------------------------------------------- camera

// Each shot is a list of [time, camera position, look-at] keys; moves are
// eased between keys and every shot change is a straight cut.
type CamKey = readonly [number, V3, V3];
type Shot = { end: number; keys: readonly CamKey[] };

const SHOTS: Shot[] = [
  // S1 establishing: slow push toward the pin spot; the curtain parts.
  { end: w.a, keys: [[0, [0, 2.45, 14.8], [0, 3.1, 2.0]], [w.a, [0, 2.35, 12.6], [0, 3.0, 1.0]]] },
  // S2 full figure on the pedestal, then push in to a medium close-up on
  // "awaken" (the move is motivated by her waking).
  { end: 7.2, keys: [[w.a, [0, 1.5, 5.7], [0, 1.4, -1.0]], [w.awaken - 0.15, [0, 1.55, 5.3], [0, 1.45, -1.0]], [w.awaken + 0.9, [0, 2.1, 2.45], [0, 2.15, -1.0]], [7.2, [0, 2.12, 2.3], [0, 2.15, -1.0]]] },
  // S3 low angle past Aria to the balconies; tilt up with the door wave.
  { end: 10.4, keys: [[7.2, [1.95, 1.4, 2.3], [-0.9, 2.7, -6.6]], [10.4, [1.85, 1.35, 2.15], [-0.6, 3.6, -6.6]]] },
  // S4 reaction insert: two tiers of faces turn toward her.
  { end: 11.4, keys: [[10.4, [0.3, 3.35, -2.4], [3.4, 4.05, -6.6]], [11.4, [0.4, 3.35, -2.6], [3.4, 4.05, -6.6]]] },
  // S5 three-quarter medium, Aria on the left third, crowd behind.
  { end: 15.2, keys: [[11.4, [-2.4, 1.75, 3.2], [0.8, 2.1, -0.65]], [15.2, [-1.9, 1.8, 2.85], [0.8, 2.1, -0.65]]] },
  // S6 close-up for the head shake.
  { end: 17.0, keys: [[15.2, [0.35, 2.35, 1.3], [0, 2.45, -1.0]], [17.0, [0.3, 2.35, 1.1], [0, 2.45, -1.0]]] },
  // S7 pull back: Aria alone in her spot, the whole house looking down.
  { end: END, keys: [[17.0, [0, 2.3, 5.2], [0, 2.2, -1.5]], [END, [0, 2.55, 7.0], [0, 2.35, -2.0]]] },
];

function shotCamera(t: number, cam: PerspectiveCamera): void {
  const shot = SHOTS.find(s => t < s.end) ?? SHOTS[SHOTS.length - 1];
  const k = shot.keys;
  let i = 1;
  while (i < k.length - 1 && t > k[i][0]) {
    i += 1;
  }
  const u = ramp(t, k[i - 1][0], k[i][0], smooth);
  const p = mixV(k[i - 1][1], k[i][1], u);
  const l = mixV(k[i - 1][2], k[i][2], u);
  cam.position.set(p[0], p[1], p[2]);
  cam.lookAt(l[0], l[1], l[2]);
}

// ---------------------------------------------------------------- Aria

const aria = blankPose();
const ariaPos = new Vector3();

function ariaFrame(t: number, cast: Cast): void {
  const rig = cast.aria;
  const p: Pose = aria;
  ariaPose(t, rig, p);
  const r = rig.rest;
  // Everything below fades out before the hand-off so the next clip starts
  // exactly from the default pose.
  const own = 1 - ramp(t, END - 0.5, END - 0.1);

  // Powered down: slumped, arms limp. A flicker on "minds", then she boots
  // on "awaken" with a dip (anticipation), a stretch past upright
  // (overshoot) and a settle. Hands trail the body (follow-through).
  const flicker = span(t, w.minds + 0.08, w.minds + 0.28, 0.04, 0.1) * 0.55;
  const dip = span(t, w.awaken - 0.25, w.awaken + 0.05, 0.2, 0.1);
  const boot = ramp(t, w.awaken, w.awaken + 0.75, backOut);
  const settle = ramp(t, w.awaken + 0.2, w.awaken + 1.2, smooth);
  const handsUp = ramp(t, w.awaken + 0.2, w.awaken + 1.3, backOut);
  p.lean = lerp(0.48 + dip * 0.08, p.lean, boot);
  p.headPitch = lerp(0.62 + dip * 0.1, p.headPitch, boot);
  p.lift += -dip * 0.03 + span(t, w.awaken + 0.1, w.awaken + 0.9, 0.2, 0.5) * 0.03;
  p.squash = 1 - dip * 0.04 + span(t, w.awaken + 0.05, w.awaken + 0.8, 0.15, 0.55) * 0.05;
  p.eyeGlow = Math.max(p.eyeGlow, flicker);
  p.lid = lerp(1, p.lid, ramp(t, w.awaken + 0.05, w.awaken + 0.3, easeOut));
  // Limp hands before waking, then they float up to rest.
  const limpL: V3 = [r.handL[0] + 0.06, r.handL[1] - 0.08, r.handL[2] + 0.1];
  const limpR: V3 = [r.handR[0] - 0.06, r.handR[1] - 0.08, r.handR[2] + 0.1];
  p.handL = mixV(limpL, p.handL, handsUp);
  p.handR = mixV(limpR, p.handR, handsUp);
  p.headRoll += (1 - settle) * 0.08 * (1 - boot) + span(t, w.awaken + 0.5, w.awaken + 1.6, 0.3, 0.6) * 0.06;

  // Wonder at the doors: look up at the centre, then follow the wave out
  // to camera right and back across to camera left.
  const wonder = span(t, w.behind - 0.2, w.they - 0.3, 0.6, 0.8);
  const lookYaw = keys(t, [[w.behind - 0.2, 0], [w.behind + 0.4, 0.05], [w.doors - 0.4, 0.45], [w.doors + 0.9, -0.2], [w.they - 0.6, -0.05], [w.they, 0]]);
  p.headYaw = lerp(p.headYaw, lookYaw, wonder);
  p.twist = lookYaw * 0.25 * wonder;
  p.headPitch -= wonder * 0.08;
  p.lookY += wonder * 0.75;
  p.lookX = p.headYaw * 0.7;
  // Hands lift a little and open in quiet awe as the house fills.
  const awe = span(t, w.behind + 0.5, w.they - 0.1, 0.7, 0.7);
  p.handL = mixV(p.handL, [-0.36, 0.2, 0.22], awe);
  p.handR = mixV(p.handR, [0.36, 0.2, 0.22], awe);

  // Dutiful: hands clasped low in front, small nods on the stressed words.
  const dutiful = span(t, w.they - 0.3, w.answer + 0.2, 0.4, 0.5);
  p.handL = mixV(p.handL, [-0.05, 0.08, 0.3], dutiful);
  p.handR = mixV(p.handR, [0.05, 0.08, 0.3], dutiful);
  const nod = span(t, w.taught, w.taught + 0.35, 0.1, 0.25) + span(t, w.how, w.how + 0.35, 0.1, 0.25);
  p.headPitch += nod * 0.08;

  // Curtsy on "answer": rise (anticipation), hold the gown out, dip low,
  // and come back up with a little overshoot.
  const skirt = span(t, w.answer + 0.1, w.answerEnd + 1.15, 0.35, 0.5);
  const down = ramp(t, w.answer + 0.45, w.answerEnd + 0.1, smoother) * (1 - ramp(t, w.answerEnd + 0.45, w.answerEnd + 1.1, backOut));
  const rise = span(t, w.answer, w.answer + 0.45, 0.2, 0.2);
  p.handL = mixV(p.handL, [-0.46, -0.08, 0.2], skirt);
  p.handR = mixV(p.handR, [0.46, -0.08, 0.2], skirt);
  p.bendL = lerp(p.bendL, 0.3, skirt);
  p.bendR = lerp(p.bendR, 0.3, skirt);
  // Undo the default curtsy so ours is the only one.
  const oldCurtsy = span(t, I[2][1] - 0.6, I[2][1] + 0.6, 0.4, 0.5);
  p.lift += oldCurtsy * 0.1 - down * 0.22 + rise * 0.03;
  p.lean += -oldCurtsy * 0.12 + down * 0.28;
  p.headPitch += down * 0.22;
  p.lid = Math.max(p.lid, down * 0.45);

  // "And never ask for more": hands fold at the waist, a small sad shake
  // on "never", then the eyes drop on "more"; she lifts them again on the
  // last beat so the next line can start from a neutral head.
  const resign = span(t, w.and - 0.2, END - 0.25, 0.5, 0.4);
  p.handL = mixV(p.handL, [-0.06, 0.12, 0.3], resign);
  p.handR = mixV(p.handR, [0.06, 0.14, 0.31], resign);
  // Replace the default shake with one timed on "never".
  const oldShake = Math.sin((t - I[3][0]) * 7) * 0.14 * span(t, I[3][0] + 0.3, I[3][0] + 1.7, 0.2, 0.3);
  const shake = Math.sin((t - w.never) * 9) * 0.16 * span(t, w.never - 0.05, w.ask + 0.45, 0.15, 0.35);
  p.headYaw += shake - oldShake;
  const lower = span(t, w.forW, END - 0.2, 0.6, 0.7);
  p.headPitch += lower * 0.22;
  p.lid = Math.max(p.lid, lower * 0.5);
  p.lookY -= lower * 0.5;
  p.headRoll += lower * 0.07;

  // Blend all of it back to the default pose for the hand-off.
  if (own < 1) {
    const def = blankPose();
    ariaPose(t, rig, def);
    blendPose(p, def, 1 - own);
  }
  applyPose(rig, p);
  ariaPos.set(p.x, 0, p.z);
}

function blendPose(p: Pose, d: Pose, u: number): void {
  const n = ['lift', 'lean', 'tilt', 'twist', 'squash', 'headYaw', 'headPitch', 'headRoll', 'mouth', 'lid', 'lookX', 'lookY', 'eyeGlow', 'bendL', 'bendR'] as const;
  for (const k of n) {
    p[k] = lerp(p[k], d[k], u);
  }
  p.handL = mixV(p.handL, d.handL, u);
  p.handR = mixV(p.handR, d.handR, u);
}

// ---------------------------------------------------------------- lighting

function lightFrame(t: number): void {
  // Pre-show: the pin spot on the closed curtain fades up on the opening
  // piano note, then dies as the curtain parts.
  const pin = keys(t, [[0, 0], [0.15, 0], [0.8, 1.15]]);
  set.curtainPin.value = pin * (1 - set.curtainOpen);
  // Aria's follow spot: a dim cold glow on "A", full on "awaken".
  const spot = keys(t, [[0, 0], [w.a - 0.05, 0], [w.a + 0.35, 0.4], [w.awaken - 0.05, 0.4], [w.awaken + 0.35, 1.15], [END - 0.8, 1.05], [END, 1.0]], smooth);
  const s = light.spots[0];
  setSpot(0, ariaPos.x, ariaPos.z, 1.0, spot, s.color.value);

  // Crowd: unison blinks on "taught" and "answer", a unison nod on
  // "answer", and heads bow on "never ask for more" (kept from default).
  const blink = (at: number) => span(t, at, at + 0.16, 0.06, 0.08);
  const closed = Math.max(blink(w.taught), blink(w.answer), blink(w.answer + 0.3));
  // Negative look.y bows the heads and drops the pupils.
  const own = 1 - ramp(t, w.moreEnd, END - 0.15);
  const look = set.wallLook.value;
  const nod = span(t, w.answer, w.answer + 0.6, 0.1, 0.35);
  const bow = span(t, w.and + 0.1, END + 1, 0.9, 0.1);
  look.y = lerp(look.y, -(nod * 1.6 + bow * 2.4), own);
  set.wallEyeLevel.value = lerp(set.wallEyeLevel.value, lerp(lerp(set.wallEyeLevel.value, 0.08, closed), 0.32, bow), own);
}

// ---------------------------------------------------------------- frame

export const clip = {
  id: 'awakening',
  start: 0,
  end: END,
  frame(t: number, cast: Cast, cam: PerspectiveCamera): void {
    // Curtain parts during the piano intro so the stage is open by the
    // first sung word.
    defaultFrame(t, cast, cam);
    set.curtainOpen = ramp(t, 1.3, 3.45, smooth);
    ariaFrame(t, cast);
    lightFrame(t);
    shotCamera(t, cam);
  },
};
