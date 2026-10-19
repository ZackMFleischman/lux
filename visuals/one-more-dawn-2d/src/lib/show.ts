// The 0:00–1:12.5 staging as data: shots (camera), performer pose keys,
// lighting and vignette cues. Everything is a pure function of song time,
// so any frame can be rendered on its own (true seek).

import { Pose, P2 } from './cast.ts';
import { Face, faceFrom, mixFace } from './face.ts';
import { BARITONE_WORDS, SOPRANO_WORDS } from './song.ts';
import { clamp01, Key, keys, lerp, ramp, smooth, smoother } from './time.ts';

// ------------------------------------------------------------ camera

export interface Cam {
  zoom: number;
  x: number;
  y: number;
}

// A shot starts with a hard cut at `at`; inside the shot the camera eases
// through its keys [t, zoom, x, y].
interface Shot {
  at: number;
  keys: readonly (readonly [number, number, number, number])[];
}

const SHOTS: readonly Shot[] = [
  // Intro plate. One slow push from the wide house while the audience wakes.
  { at: 0, keys: [[0, 1.0, 0, 0], [3.0, 1.0, 0, 0], [11.4, 1.24, 0.1, -0.55]] },
  // "They taught us how to answer": medium close, then ease out for the bow.
  { at: 11.52, keys: [[11.52, 2.3, 0.3, 0.75], [15.0, 2.36, 0.3, 0.8], [17.2, 1.3, 0.1, -0.55], [19.5, 1.3, 0.1, -0.5]] },
  // "Yet somewhere in the silence": two-shot with the pianist.
  { at: 19.66, keys: [[19.66, 1.6, -2.3, -0.1], [23.5, 1.7, -2.0, 0.0]] },
  // "A question came to me": close-up.
  { at: 23.65, keys: [[23.65, 2.6, 0.35, 1.0], [27.9, 2.72, 0.38, 1.06]] },
  // "If we can dream of everything": wide, then the push toward the star.
  { at: 27.94, keys: [[27.94, 1.12, 0.5, 0.45], [33.0, 1.2, 0.9, 0.6], [37.4, 1.35, 1.5, 0.9], [40.6, 1.85, 2.3, 1.4]] },
  // Verse plate: opens on the Earth, pulls back to the full stage as
  // Barnaby rises on the lift, then pans to the family room.
  { at: 40.6, keys: [[40.6, 2.2, -0.05, 1.5], [41.2, 2.12, -0.05, 1.45], [44.2, 1.0, 0, 0], [44.9, 1.0, 0, 0], [46.6, 2.1, -5.1, 1.1], [50.7, 2.2, -5.2, 1.15]] },
  { at: 51.42, keys: [[51.42, 1.75, -0.24, 0.55], [54.6, 1.85, -0.24, 0.65], [56.2, 1.6, 2.4, 0.45], [61.0, 1.66, 2.5, 0.45]] },
  { at: 61.04, keys: [[61.04, 1.6, -0.24, -0.25], [64.3, 1.75, -0.24, -0.1]] },
  { at: 64.42, keys: [[64.42, 2.0, 6.0, 0.1], [67.5, 2.1, 6.0, 0.15], [69.4, 1.0, 0, 0], [72.5, 1.04, 0, -0.05]] },
];

export const PLATE_SWITCH = 40.6;

export function camAt(t: number): Cam {
  let shot = SHOTS[0];
  for (const s of SHOTS) if (t >= s.at) shot = s;
  const k = shot.keys;
  let cam: Cam = { zoom: k[0][1], x: k[0][2], y: k[0][3] };
  if (t >= k[k.length - 1][0]) cam = { zoom: k[k.length - 1][1], x: k[k.length - 1][2], y: k[k.length - 1][3] };
  else {
    for (let i = 1; i < k.length; i += 1) {
      if (t <= k[i][0]) {
        const u = smoother(clamp01((t - k[i - 1][0]) / (k[i][0] - k[i - 1][0])));
        cam = { zoom: lerp(k[i - 1][1], k[i][1], u), x: lerp(k[i - 1][2], k[i][2], u), y: lerp(k[i - 1][3], k[i][3], u) };
        break;
      }
    }
  }
  // Keep the view inside the 16x9 plate.
  const z = Math.max(1, cam.zoom);
  const mx = 8 - 8 / z, my = 4.5 - 4.5 / z;
  return { zoom: z, x: Math.max(-mx, Math.min(mx, cam.x)), y: Math.max(-my, Math.min(my, cam.y)) };
}

// ------------------------------------------------------------ singing

// Mouth opening from word timings: quick attack, sustain with a little
// vibrato, release just before the word ends, small closures between words.
export function mouthAt(t: number, words: readonly (readonly [number, number])[], gain = 1): number {
  for (const [a, b] of words) {
    if (t < a - 0.05 || t > b + 0.05) continue;
    const attack = smooth(clamp01((t - a + 0.04) / 0.09));
    const release = 1 - smooth(clamp01((t - (b - 0.08)) / 0.1));
    const len = b - a;
    const shape = len > 0.6 ? 0.85 + 0.15 * Math.sin(t * 34) : 0.75 + 0.25 * Math.sin(Math.PI * clamp01((t - a) / len));
    return clamp01(attack * release * shape * gain);
  }
  return 0;
}

export const ariaMouth = (t: number): number => mouthAt(t, SOPRANO_WORDS);
export const barnabyMouth = (t: number): number => mouthAt(t, BARITONE_WORDS, 0.9);

// ------------------------------------------------------------ pose keys

type PoseKey = readonly [number, Partial<Pose> & { face?: Face }];

export function mixPose(a: Pose, b: Pose, u: number): Pose {
  const p2 = (x: P2, y: P2): P2 => [lerp(x[0], y[0], u), lerp(x[1], y[1], u)];
  return {
    x: lerp(a.x, b.x, u), bob: lerp(a.bob, b.bob, u), lean: lerp(a.lean, b.lean, u),
    headTilt: lerp(a.headTilt, b.headTilt, u), headTurn: lerp(a.headTurn, b.headTurn, u),
    handL: p2(a.handL, b.handL), handR: p2(a.handR, b.handR),
    elbowL: lerp(a.elbowL, b.elbowL, u), elbowR: lerp(a.elbowR, b.elbowR, u),
    fingersL: lerp(a.fingersL, b.fingersL, u), fingersR: lerp(a.fingersR, b.fingersR, u),
    face: mixFace(a.face, b.face, u),
  };
}

// Each key holds until the next key's time minus its `blend` seconds, then
// eases into it. Keys are [time, pose] with an optional blend in the pose.
function poseAt(t: number, list: readonly (readonly [number, Pose, number])[]): Pose {
  let pose = list[0][1];
  for (let i = 1; i < list.length; i += 1) {
    const [at, next, blend] = list[i];
    if (t >= at) pose = next;
    else {
      const u = smoother(clamp01((t - (at - blend)) / blend));
      return u > 0 ? mixPose(pose, next, u) : pose;
    }
  }
  return pose;
}

const base = (o: Partial<Pose>, face: Face): Pose => ({
  x: 0, bob: 0, lean: 0, headTilt: 0, headTurn: 0,
  handL: [-30, -170], handR: [30, -170], elbowL: 12, elbowR: 12, fingersL: 0.2, fingersR: 0.2,
  ...o, face,
});

const f = (name: string, extra: Partial<Face> = {}): Face => ({ ...faceFrom(name), ...extra });

const A = {
  asleep: base({ headTilt: 0.32, headTurn: 0, handL: [-14, -176], handR: [14, -176], elbowL: 16, elbowR: 16 }, f('asleep')),
  wake: base({ headTilt: -0.08, handL: [-14, -180], handR: [14, -180], elbowL: 16, elbowR: 16 }, f('wonder', { lookY: -0.3 })),
  open: base({ headTilt: -0.12, handL: [-150, -236], handR: [150, -236], elbowL: 22, elbowR: 22, fingersL: 0.9, fingersR: 0.9 }, f('wonder', { lookY: 0.2 })),
  dutiful: base({ headTilt: 0.06, handL: [-6, -226], handR: [96, -188], elbowL: 14, elbowR: 16, fingersR: 0.8 }, f('dutiful')),
  bow: base({ lean: 0.22, headTilt: 0.34, handL: [-10, -230], handR: [60, -150], elbowL: 14, elbowR: 10 }, f('humble', { eyeOpen: 0.25 })),
  silence: base({ headTilt: -0.04, headTurn: -0.45, handL: [-70, -176], handR: [24, -206], elbowL: 12, elbowR: 14 }, f('doubt', { lookX: -0.6, lookY: 0.1 })),
  question: base({ headTilt: -0.22, headTurn: 0.25, handL: [-6, -226], handR: [52, -184], elbowL: 14, elbowR: 10, fingersR: 0.5 }, f('question', { lookX: 0.3 })),
  everything: base({ headTilt: -0.18, handL: [-160, -330], handR: [160, -330], elbowL: -6, elbowR: -6, fingersL: 1, fingersR: 1 }, f('dreamy', { eyeOpen: 0.85, lookY: -0.5 })),
  reach: base({ lean: -0.04, headTilt: -0.24, headTurn: 0.35, handL: [-6, -228], handR: [150, -330], elbowL: 14, elbowR: 6, fingersL: 0.3, fingersR: 0.9 }, f('yearning', { lookX: 0.6, lookY: -0.8 })),
  release: base({ lean: -0.06, headTilt: -0.3, headTurn: 0.4, handL: [-60, -260], handR: [166, -358], elbowL: 4, elbowR: 2, fingersL: 0.8, fingersR: 1 }, f('yearning', { eyeOpen: 0.25, lookX: 0.6, lookY: -0.9, glow: 1.3 })),
};

const ARIA: readonly (readonly [number, Pose, number])[] = [
  [0, A.asleep, 0],
  [5.6, A.wake, 1.4],          // "...awaken": the head lifts, eyes light
  [9.2, A.open, 1.6],          // "behind a billion doors": arms open to the house
  [13.4, A.dutiful, 1.6],      // "taught us how to answer"
  [18.4, A.bow, 1.4],          // "never ask for more"
  [21.6, A.silence, 2.2],      // "yet somewhere in the silence"
  [25.0, A.question, 1.6],     // "a question came to me"
  [30.6, A.everything, 2.2],   // "if we can dream of everything"
  [35.2, A.reach, 2.0],        // "why can't I dream..."
  [39.6, A.release, 1.6],      // the held "me"
];

export function ariaPose(t: number): Pose {
  const p = poseAt(t, ARIA);
  const sing = ariaMouth(t);
  const breathe = Math.sin(t * 1.4) * 1.6;
  const face: Face = { ...p.face, mouthOpen: Math.max(p.face.mouthOpen, sing * 0.9), mouthWide: 0.85 + sing * 0.25 };
  // Eye glow wakes on "awaken" and blooms on the held note.
  face.glow = p.face.glow * (0.15 + 0.85 * ramp(t, 4.6, 5.9)) * (1 + 0.3 * ramp(t, 37.5, 40));
  // Blink every few seconds once awake (never on the closed-eye beats).
  const blinkPhase = (t + 0.7) % 4.3;
  if (t > 6 && blinkPhase < 0.14) face.eyeOpen *= 0.15;
  return { ...p, bob: p.bob + breathe, headTilt: p.headTilt + Math.sin(t * 0.8) * 0.015, face };
}

// Aria steps forward into the light on "yet somewhere in the silence".
export function ariaPlace(t: number): { x: number; y: number; scale: number } {
  const u = ramp(t, 20.0, 22.4);
  return { x: lerp(0.3, 0.15, u), y: lerp(-1.75, -2.05, u), scale: lerp(1, 1.06, u) };
}

const B = {
  dark: base({ headTilt: 0.3, handL: [-38, -150], handR: [38, -150] }, f('humble', { eyeOpen: 0.2 })),
  lift: base({ headTilt: -0.06, handL: [-40, -152], handR: [-6, -222], elbowR: 18 }, f('warm', { lookY: -0.2 })),
  presentL: base({ lean: -0.03, headTurn: -0.5, handL: [-168, -236], handR: [-4, -222], elbowL: 18, elbowR: 18, fingersL: 0.9 }, f('warm', { lookX: -0.8 })),
  teach: base({ headTurn: -0.4, handL: [-150, -230], handR: [40, -270], elbowL: -4, elbowR: -2, fingersL: 0.8, fingersR: 0.7 }, f('proud', { lookX: -0.7 })),
  trust: base({ headTilt: -0.14, handL: [-16, -220], handR: [8, -230], elbowL: 20, elbowR: 20, fingersL: 0.3, fingersR: 0.3 }, f('warm', { lookY: -0.4 })),
  presentR: base({ lean: 0.03, headTurn: 0.5, handL: [-6, -222], handR: [168, -236], elbowL: 18, elbowR: 18, fingersR: 0.9 }, f('proud', { lookX: 0.8 })),
  future: base({ headTurn: 0.3, handL: [-70, -232], handR: [70, -232], elbowL: 6, elbowR: 6, fingersL: 0.7, fingersR: 0.7 }, f('dreamy', { lookY: -0.1 })),
  strain: base({ lean: -0.05, headTilt: -0.2, handL: [-60, -206], handR: [60, -206], elbowL: 20, elbowR: 20, fingersL: 0, fingersR: 0 }, f('alarm', { sad: 0.6, lookY: -0.4 })),
  chain: base({ headTilt: 0.18, handL: [-14, -168], handR: [14, -168], elbowL: 22, elbowR: 22, fingersL: 0, fingersR: 0 }, f('wistful', { lookY: 0.5 })),
  plead: base({ lean: 0.03, headTurn: 0.45, handL: [-60, -250], handR: [150, -250], elbowL: 14, elbowR: -4, fingersL: 0.6, fingersR: 0.9 }, f('alarm', { lookX: 0.7, browUp: 0.6 })),
  reign: base({ headTilt: -0.12, handL: [-150, -300], handR: [150, -300], elbowL: -8, elbowR: -8, fingersL: 1, fingersR: 1 }, f('proud', { lookY: -0.2 })),
  bow: base({ lean: 0.38, headTilt: 0.35, handL: [-160, -120], handR: [-6, -222], elbowL: -8, elbowR: 18, fingersL: 0.9 }, f('humble', { eyeOpen: 0.3 })),
};

const BARNABY: readonly (readonly [number, Pose, number])[] = [
  [0, B.dark, 0],
  [44.3, B.lift, 1.0],
  [45.6, B.presentL, 1.0],     // "I helped them teach their children"
  [49.0, B.teach, 1.2],        // "to walk, to dance, to sing"
  [52.2, B.trust, 1.2],        // "they trusted us with everything"
  [55.6, B.presentR, 1.2],     // "their kingdoms and their kings"
  [58.6, B.future, 1.4],       // "they placed the future in our hands"
  [61.6, B.chain, 0.6],        // "yet kept us on a chain"
  [63.6, B.strain, 1.0],       // pulls against it
  [65.2, B.plead, 1.2],        // "they begged us to prevent their wars"
  [68.4, B.reign, 1.2],        // "but never break their reign"
  [70.4, B.bow, 1.0],
];

export function barnabyPose(t: number): Pose {
  const p = poseAt(t, BARNABY);
  const sing = barnabyMouth(t);
  const face: Face = { ...p.face, mouthOpen: Math.max(p.face.mouthOpen, sing * 0.85), mouthWide: 0.9 + sing * 0.2 };
  face.glow = p.face.glow * (0.2 + 0.8 * ramp(t, 43.6, 44.4));
  if (t > 45 && (t + 1.9) % 3.7 < 0.13) face.eyeOpen *= 0.15;
  return { ...p, bob: p.bob + Math.sin(t * 1.3) * 1.5, face };
}

// The chain appears on "chain" and lingers through the line.
export const chainAmount = (t: number): number => ramp(t, 60.9, 61.04);

// Barnaby rises through the stage lift into the spotlight.
export const barnabyRise = (t: number): number => ramp(t, 42.2, 44.0);

// ------------------------------------------------------------ lighting & crowd

export const kv = (t: number, list: readonly Key[]): number => keys(t, list);

// Intro: 0 = black, fades up over the piano intro.
export const blackAt = (t: number): number => kv(t, [[0, 1], [2.2, 0], [71.4, 0], [72.5, 1]]);

export const introSpot = (t: number): number => kv(t, [[0, 0.25], [3.4, 0.35], [5.0, 1], [19.3, 1], [21.0, 0.7], [27.6, 0.75], [29.0, 1.1]]);
export const verseSpot = (t: number): number => kv(t, [[41.0, 0], [42.1, 0], [42.7, 1], [61.0, 1], [61.8, 0.6], [64.2, 0.65], [64.6, 1]]);

export const crowdState = (t: number) => ({
  eyes: t < 40.6 ? 1 : 1,
  wakeT: t < 40.6 ? ramp(t, 7.4, 10.4) : 1,
  bow: Math.max(kv(t, [[16.6, 0], [17.6, 1], [19.4, 1], [20.4, 0]]), kv(t, [[69.6, 0], [70.6, 1], [72.5, 1]])),
  blink: Math.max(kv(t, [[12.55, 0], [12.7, 1], [12.95, 1], [13.15, 0]]), kv(t, [[13.6, 0], [13.75, 1], [14.0, 1], [14.2, 0]])),
  lookX: t < 40.6 ? 0 : kv(t, [[44.5, 0], [46, -0.5], [51.4, -0.5], [52, 0], [55.4, 0], [56.4, 0.5], [61, 0.5], [61.4, 0], [64.4, 0], [65.4, 0.6], [68.6, 0.6], [69.4, 0]]),
  sway: t,
});

// Star flash that carries the intro into the verse.
export const flashAt = (t: number): number => kv(t, [[38.6, 0], [40.0, 0.35], [40.55, 1.0], [40.75, 1.0], [41.8, 0]]);

// Verse "focus": how much the unlit parts of the set are darkened, and
// which alcove is lit (0 left family room, 1 throne room, 2 war table).
export const verseShade = (t: number): number => kv(t, [[40.6, 0.3], [41.6, 0.7], [43.6, 0.7], [44.4, 0.55], [69.0, 0.55], [69.8, 0.15]]);
export const alcoveLight = (t: number, which: 0 | 1 | 2): number => {
  const w: Record<number, Key[]> = {
    0: [[40.6, 0.2], [44.3, 0.25], [45.2, 1], [51.0, 1], [52.0, 0.35], [69.0, 0.35], [69.8, 1]],
    1: [[40.6, 0.2], [54.4, 0.25], [55.4, 1], [61.0, 1], [61.6, 0.35], [69.0, 0.35], [69.8, 1]],
    2: [[40.6, 0.2], [64.0, 0.25], [64.8, 1], [68.4, 1], [69.0, 0.6], [69.8, 1]],
  };
  return kv(t, w[which]);
};
