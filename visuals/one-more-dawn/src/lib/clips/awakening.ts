// Clip "awakening" (0 s – 19.3 s): Aria wakes on her pedestal; the doors open; obedient blinks (intro lines 1–4).
// This file owns everything on screen in its window: camera, lighting cues
// and every performer's pose. Start from defaultFrame and replace parts of
// it here; do not edit shared engine, cast or set files from a clip lane.
//
// Shot list (song seconds; cuts land on sung words or just before them):
//   S1  0.00 –  3.57  Pre-show: closed curtain, pin spot, curtain parts.
//   S2  3.57 –  4.80  "A billion minds": the theatre WIDE from the back of
//                      the stalls. Arch, marquee, footlights (they come up on
//                      "A"), stalls silhouettes; Aria small on her pedestal
//                      under the balconies. Her eyes flicker on "minds".
//   S3  4.80 –  7.20  "awaken": full figure, push in to a medium close-up
//                      as she powers on; brows pop up.
//   S4  7.20 –  8.75  "Behind a billion": low angle past her face to the
//                      balconies; she hears them and starts to turn.
//   S5  8.75 – 10.45  "doors": INSERT on the house-right boxes of the lower
//                      tier. The doors slide apart and the occupants rise,
//                      faces in awe.
//   S6 10.45 – 11.30  Crowd reaction: house-left tier faces in awe, heads
//                      turned to her.
//   S7 11.30 – 13.00  "They taught us how to": over the shoulder of a
//                      middle-tier spectator down to Aria, who faces the
//                      house; prim lesson hand on "taught"; she turns back
//                      to the front before "answer".
//   S8 13.00 – 15.25  "answer": from the stalls over the audience heads:
//                      the dutiful curtsy and the crowd's unison nod.
//   S9 15.25 – 17.00  "And never ask": three-quarter close-up from house
//                      left; worried brows, a doubtful head shake.
//   S10 17.00 – 19.30 "for more": raised wide from a house-left box, the
//                      house bowed. Same side of the line as question's
//                      opening shot (house left), but wider and higher.

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
// The rig's browTilt renders + as stern (inner ends down) and - as
// worried, opposite to the Pose comment; every tilt below is written as
// "+ worried" and multiplied by SAD so a later rig fix is a one-line change.
const SAD = 1;
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

// Over-the-shoulder from the middle tier: just behind and to the right of
// the house-left spectator whose head is at about [-6.61, 2.96, -5.35].
// The back wall is only ~0.6 m behind the seats, so the camera sits
// between the head and the wall (radius < 14.87 from the house centre).
const OTS_CAM: V3 = [-7.25, 3.12, -5.27];
const OTS_CAM2: V3 = [-7.2, 3.11, -5.22];

const SHOTS: Shot[] = [
  // S1 pre-show: slow push toward the pin spot; the curtain parts.
  { end: w.a, keys: [[0, [0, 2.45, 14.8], [0, 3.1, 2.0]], [w.a, [0, 2.35, 12.6], [0, 3.0, 1.0]]] },
  // S2 the theatre wide from the back of the stalls; a slow creep in.
  { end: 4.8, keys: [[w.a, [0, 2.85, 19.4], [0, 3.0, 0.0]], [4.8, [0, 2.8, 18.6], [0, 2.95, 0.0]]] },
  // S3 full figure on the pedestal, then push in to a medium close-up on
  // "awaken" (the move is motivated by her waking).
  { end: 7.2, keys: [[4.8, [0, 1.5, 5.7], [0, 1.4, -1.0]], [w.awaken - 0.15, [0, 1.55, 5.4], [0, 1.45, -1.0]], [w.awaken + 0.9, [0, 2.1, 2.45], [0, 2.15, -1.0]], [7.2, [0, 2.12, 2.3], [0, 2.15, -1.0]]] },
  // S4 low angle past Aria to the balconies; she starts to turn.
  { end: 8.75, keys: [[7.2, [1.95, 1.4, 2.3], [-0.9, 2.7, -6.6]], [8.75, [1.9, 1.38, 2.2], [-0.75, 3.1, -6.6]]] },
  // S5 door insert: lower tier, house right (boxes 0-1), doors slide and
  // the occupants rise. The lower tier keeps the frame clear of the tier
  // above.
  { end: 10.45, keys: [[8.75, [6.15, 1.2, -1.0], [8.75, 0.95, -4.55]], [10.45, [6.5, 1.18, -1.5], [8.8, 0.98, -4.55]]] },
  // S6 crowd reaction: house-left lower tier, faces turned to her.
  { end: 11.3, keys: [[10.45, [-2.0, 1.55, -2.3], [-5.0, 1.55, -6.2]], [11.3, [-2.3, 1.55, -2.6], [-5.0, 1.6, -6.2]]] },
  // S7 over a middle-tier spectator's shoulder, down to Aria.
  { end: 13.0, keys: [[11.3, OTS_CAM, [0.0, 1.85, -1.0]], [13.0, OTS_CAM2, [0.0, 1.8, -1.0]]] },
  // S8 from the stalls, over the audience heads: curtsy and crowd nod.
  { end: 15.25, keys: [[13.0, [-0.9, 1.25, 8.4], [0, 1.85, -1.2]], [15.25, [-0.7, 1.3, 7.8], [0, 1.9, -1.2]]] },
  // S9 three-quarter close-up from house left for the head shake.
  { end: 17.0, keys: [[15.25, [-1.25, 2.4, 1.05], [0.05, 2.42, -1.0]], [17.0, [-1.1, 2.4, 0.9], [0.05, 2.42, -1.0]]] },
  // S10 raised wide from a house-left box; a slow pull back.
  { end: END, keys: [[17.0, [-3.8, 3.3, 5.0], [0.0, 1.6, -1.2]], [END, [-4.8, 3.7, 6.6], [0.0, 1.55, -1.2]]] },
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

  // Waking face: brows knit while powered down, then pop up in surprise
  // as the eyes come on, and settle to a soft, curious raise.
  const surprise = span(t, w.awaken + 0.05, w.awaken + 1.6, 0.25, 0.9);
  p.brow = lerp(-0.35, 0.15, boot) + surprise * 0.85;
  p.browTilt = SAD * (1 - boot) * -0.3;
  p.lid = Math.max(0, p.lid - surprise * 0.12);

  // Wonder at the doors. She hears the house wake and turns upstage to
  // face the house-left boxes (S4 catches the start of the turn), follows
  // the door wave, sings "They taught us how to" to the house (S7), then
  // turns back to the front just before "answer".
  const wonder = span(t, w.behind - 0.2, w.they - 0.3, 0.6, 0.8);
  const turn = ramp(t, w.behind + 0.85, w.doors + 0.1, smooth) * (1 - ramp(t, 12.35, 12.95, smooth));
  p.yaw = lerp(p.yaw, -2.15, turn);
  const lookYaw = keys(t, [[w.behind - 0.2, 0], [w.behind + 0.4, 0.05], [w.doors - 0.2, 0.35], [w.doors + 0.9, -0.3], [10.4, -0.1], [w.they, 0]]);
  p.headYaw = lerp(p.headYaw, lookYaw, wonder);
  p.twist = lookYaw * 0.25 * wonder;
  p.headPitch -= wonder * 0.14;
  p.lookY += wonder * 0.75;
  p.lookX = p.headYaw * 0.7;
  p.brow = lerp(p.brow, 1.0, wonder);
  p.browTilt = lerp(p.browTilt, SAD * 0.2, wonder);
  p.lid = lerp(p.lid, 0.0, wonder);
  p.mouth = Math.max(p.mouth, wonder * 0.25);
  // Arms float up and open in awe as the house fills (read from behind
  // as a silhouette in S4), and drop as she turns back.
  const awe = span(t, w.behind + 0.6, 10.7, 0.8, 0.6);
  p.handL = mixV(p.handL, [-0.62, 0.42, 0.12], awe);
  p.handR = mixV(p.handR, [0.62, 0.48, 0.12], awe);
  p.bendL = lerp(p.bendL, 0.35, awe);
  p.bendR = lerp(p.bendR, 0.35, awe);

  // "They taught us how to": dutiful, but with a prim lesson hand. The
  // right hand lifts like a teacher's on "taught" and taps down on "how";
  // the left rests at the waist. Small nods on the stressed words.
  const dutiful = span(t, w.they - 0.3, w.answer + 0.2, 0.4, 0.5);
  p.handL = mixV(p.handL, [-0.12, 0.1, 0.3], dutiful);
  p.handR = mixV(p.handR, [0.1, 0.12, 0.3], dutiful);
  const lesson = span(t, w.taught - 0.15, w.how + 0.45, 0.25, 0.35);
  const tap = span(t, w.how - 0.05, w.how + 0.3, 0.08, 0.2);
  p.handR = mixV(p.handR, [0.32, 0.66 - tap * 0.16, 0.32], lesson);
  p.bendR = lerp(p.bendR, 0.95, lesson);
  const nod = span(t, w.taught, w.taught + 0.35, 0.1, 0.25) + span(t, w.how, w.how + 0.35, 0.1, 0.25);
  p.headPitch += nod * 0.1;
  p.headRoll += lesson * 0.1;
  p.brow = lerp(p.brow, 0.45, dutiful);
  p.browTilt = lerp(p.browTilt, SAD * -0.15, dutiful);
  p.lid = lerp(p.lid, 0.25, dutiful);

  // Curtsy on "answer": rise (anticipation), hold the gown out, dip low
  // with the eyes closed, and come back up with a little overshoot.
  const skirt = span(t, w.answer + 0.1, w.answerEnd + 1.15, 0.35, 0.5);
  const down = ramp(t, w.answer + 0.45, w.answerEnd + 0.1, smoother) * (1 - ramp(t, w.answerEnd + 0.45, w.answerEnd + 1.1, backOut));
  const rise = span(t, w.answer, w.answer + 0.45, 0.2, 0.2);
  p.handL = mixV(p.handL, [-0.5, -0.08, 0.2], skirt);
  p.handR = mixV(p.handR, [0.5, -0.08, 0.2], skirt);
  p.bendL = lerp(p.bendL, 0.3, skirt);
  p.bendR = lerp(p.bendR, 0.3, skirt);
  // Undo the default curtsy so ours is the only one.
  const oldCurtsy = span(t, I[2][1] - 0.6, I[2][1] + 0.6, 0.4, 0.5);
  p.lift += oldCurtsy * 0.1 - down * 0.22 + rise * 0.03;
  p.lean += -oldCurtsy * 0.12 + down * 0.28;
  p.headPitch += down * 0.22;
  p.headRoll -= down * 0.12;
  p.lid = Math.max(p.lid, down * 0.85);
  p.brow = lerp(p.brow, 0.7, down);

  // "And never ask for more": doubt. The left hand goes to her chest, the
  // brows tilt up in worry, a slow doubtful shake on "never", then the eyes
  // drop on "more" and the hands fall open at her sides. Everything below
  // blends to the default pose for the hand-off.
  const resign = span(t, w.and - 0.2, END - 0.25, 0.5, 0.4);
  p.handL = mixV(p.handL, [-0.04, 0.34, 0.27], resign);
  p.handR = mixV(p.handR, [0.14, 0.1, 0.3], resign);
  // Replace the default shake with one timed on "never".
  const oldShake = Math.sin((t - I[3][0]) * 7) * 0.14 * span(t, I[3][0] + 0.3, I[3][0] + 1.7, 0.2, 0.3);
  const shake = Math.sin((t - w.never) * 7.5) * 0.24 * span(t, w.never - 0.05, w.ask + 0.5, 0.15, 0.35);
  p.headYaw += shake - oldShake;
  const doubt = span(t, w.and - 0.1, END - 0.2, 0.35, 0.6);
  p.brow = lerp(p.brow, 0.2, doubt);
  p.browTilt = lerp(p.browTilt, SAD * 0.9, doubt);
  p.lid = lerp(p.lid, 0.3, doubt);
  p.headRoll += doubt * 0.12;
  const lower = span(t, w.forW, END - 0.2, 0.6, 0.7);
  p.headPitch += lower * 0.24;
  p.lid = Math.max(p.lid, lower * 0.55);
  p.lookY -= lower * 0.5;
  // Hands fall open at her sides on "more".
  const fall = span(t, w.more + 0.1, END - 0.2, 0.6, 0.5);
  p.handL = mixV(p.handL, [-0.42, -0.02, 0.18], fall);
  p.handR = mixV(p.handR, [0.42, -0.02, 0.18], fall);

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
  const n = ['lift', 'lean', 'tilt', 'twist', 'squash', 'headYaw', 'headPitch', 'headRoll', 'mouth', 'lid', 'lookX', 'lookY', 'eyeGlow', 'brow', 'browTilt', 'yaw', 'bendL', 'bendR'] as const;
  for (const k of n) {
    p[k] = lerp(p[k], d[k], u);
  }
  p.handL = mixV(p.handL, d.handL, u);
  p.handR = mixV(p.handR, d.handR, u);
}

// ---------------------------------------------------------------- lighting

// Weight for overrides that must have handed back by the end of the clip.
function own0(t: number): number {
  return 1 - ramp(t, END - 0.6, END - 0.25);
}

function lightFrame(t: number): void {
  // Pre-show: the pin spot on the closed curtain fades up on the opening
  // piano note, then dies as the curtain parts.
  const pin = keys(t, [[0, 0], [0.15, 0], [0.8, 1.15]]);
  set.curtainPin.value = pin * (1 - set.curtainOpen);
  // Aria's follow spot: a dim cold glow on "A", full on "awaken".
  const spot = keys(t, [[0, 0], [w.a - 0.05, 0], [w.a + 0.35, 0.4], [w.awaken - 0.05, 0.4], [w.awaken + 0.35, 1.15], [END - 0.8, 1.05], [END, 1.0]], smooth);
  const s = light.spots[0];
  setSpot(0, ariaPos.x, ariaPos.z, 1.0, spot, s.color.value);

  // The theatre comes up on the first sung word ("A"): footlights and the
  // proscenium neon reach their pre-show level so the S2 wide reads.
  const up = ramp(t, w.a - 0.05, w.a + 0.45, smooth) * own0(t);
  set.footLevel.value = Math.max(set.footLevel.value, 0.24 * up);
  set.neonLevel.value = Math.max(set.neonLevel.value, 0.55 * up);
  // Awe as the doors open, held through the reaction shot and the first
  // words to them, then it fades before the dutiful lesson.
  set.crowdAwe = Math.max(set.crowdAwe, span(t, w.behind, w.how + 0.2, 0.6, 0.7));

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
    // The house wakes half a beat later than the default cue so the S5
    // insert sees its doors closed, sliding, then the occupants rising on
    // "doors". Everything is open long before the hand-off.
    set.wallWakeAt.value = (set.wallWakeAt.value as number) + 0.5;
    ariaFrame(t, cast);
    lightFrame(t);
    shotCamera(t, cam);
  },
};
