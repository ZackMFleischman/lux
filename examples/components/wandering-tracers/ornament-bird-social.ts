/**
 * CPU schedule for the five ornamental birds.  All values are deliberately
 * numeric so a renderer can pack them directly into uniforms or instances.
 * Emotion: 0 none, 1 lonely, 2 greeting, 3 happy, 4 sad, 5 excited,
 * 6 dislike, 7 calm, 8 curious. Idle: 0 fly, 1 preen, 2 head tilt,
 * 3 wing stretch, 4 sleep, 5 hop.
 */
export type BirdSocialState = {
  excursion: number;
  rest: number;
  owner: 5 | 6;
  slot: number;
  facing: -1 | 0 | 1;
  idle: number;
  emotion: number;
  bubble: number;
};

export type BirdSocialControls = {
  frequency: number;
  speed: number | readonly number[];
  perchDuration: number;
  sociability: number;
  seed: number;
  sizes?: readonly number[];
  thoughtDuration?: number;
};

type Phase = 'orbit' | 'depart' | 'perch' | 'return';
type Bird = BirdSocialState & {
  phase: Phase;
  elapsed: number;
  duration: number;
  partner: number;
  interactionUntil: number;
  idleAt: number;
  bubbleAt: number;
  bubbleStart: number;
  bubbleDuration: number;
  random: number;
  events: number;
  bonded: boolean;
};

const BIRD_COUNT = 5;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const smooth = (value: number) => {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
};

// A small integer PRNG keeps schedules repeatable without coupling to render FPS.
const mixSeed = (value: number) => {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 0x100000000;
};

export function createBirdSocial() {
  let clock = 0;
  let activeSeed = Number.NaN;
  const birds: Bird[] = [];
  let thoughtDuration = 6;

  const random = (bird: Bird) => {
    bird.random = (bird.random + 0x9e3779b9) >>> 0;
    return mixSeed(bird.random);
  };

  const speedFor = (controls: BirdSocialControls, index: number) => {
    const value = Array.isArray(controls.speed) ? controls.speed[index] ?? controls.speed[0] : controls.speed;
    return clamp(Number.isFinite(value) ? value : 1, 0, 8);
  };

  const scheduleOrbit = (bird: Bird, controls: BirdSocialControls) => {
    bird.phase = 'orbit';
    bird.elapsed = 0;
    bird.duration = 12 + random(bird) * 18;
    bird.partner = -1;
    bird.idle = 0;
    bird.emotion = 0;
    bird.bubble = 0;
    bird.bonded = false;
    bird.slot = 0;
    bird.facing = 0;
  };

  const startBubble = (bird: Bird, emotion: number) => {
    bird.events++;
    bird.emotion = emotion;
    bird.bubbleStart = clock;
    bird.bubbleDuration = thoughtDuration * (0.85 + random(bird) * 0.30);
    bird.bubbleAt = clock + bird.bubbleDuration + 6 + random(bird) * 10;
  };

  const startDeparture = (bird: Bird, controls: BirdSocialControls, partner = -1) => {
    const index = birds.indexOf(bird);
    const friend = partner >= 0 ? birds[partner] : undefined;
    const owner = friend?.owner ?? (random(bird) < 0.5 ? 5 : 6);
    const radius = (i: number) => Math.max(0.025, (controls.sizes?.[i] ?? 1) * 0.052 + 0.012);
    const occupied = birds.filter(other => other !== bird && other.owner === owner
      && (other.phase === 'depart' || other.phase === 'perch' || other.phase === 'return'));
    const preferred = friend?.slot ?? (random(bird) - 0.5) * 0.30;
    const candidates = Array.from({ length: 81 }, (_, i) => -0.48 + i * 0.012);
    candidates.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));
    const slot = candidates.find(candidate => occupied.every(other =>
      Math.abs(candidate - other.slot) >= radius(index) + radius(birds.indexOf(other))));
    // Keep flying if this contour has no free landing space. Reserve on departure,
    // so a second incoming bird cannot choose the same destination.
    if (slot === undefined) { bird.elapsed = 0; bird.duration = 2; return; }
    bird.phase = 'depart';
    bird.elapsed = 0;
    bird.duration = 3.0 + random(bird) * 1.4;
    bird.owner = owner;
    bird.partner = partner;
    bird.rest = 0;
    bird.idle = 0;
    bird.slot = slot;
    if (friend) {
      friend.partner = index;
      friend.facing = slot > friend.slot ? 1 : -1;
      bird.facing = friend.facing === 1 ? -1 : 1;
    } else {
      bird.facing = random(bird) < 0.5 ? -1 : 1;
    }
  };

  const startPerch = (bird: Bird, controls: BirdSocialControls) => {
    bird.phase = 'perch';
    bird.elapsed = 0;
    const requested = clamp(controls.perchDuration || 8, 1, 90);
    bird.duration = requested * (0.78 + random(bird) * 0.44);
    bird.idleAt = clock + 1.1 + random(bird) * 2.2;
    bird.bubbleAt = clock + 5 + random(bird) * 7;
    bird.idle = 1 + Math.floor(random(bird) * 5);
    if (bird.partner >= 0 && birds[bird.partner]?.phase === 'perch') {
      const friend = birds[bird.partner];
      const outcome = random(bird);
      bird.bonded = outcome < 0.68;
      friend.bonded = bird.bonded;
      if (bird.bonded) {
        const interactionEnd = clock + Math.min(requested * 0.72, 4 + random(bird) * 5);
        const linger = 1.4 + random(bird) * 2.2;
        bird.interactionUntil = interactionEnd + linger;
        friend.interactionUntil = Math.max(friend.interactionUntil, bird.interactionUntil);
        friend.duration = Math.max(friend.duration, friend.elapsed + (bird.interactionUntil - clock));
        bird.idle = outcome < 0.45 ? 2 : 3;
        friend.idle = outcome < 0.45 ? 2 : 5;
        bird.idleAt = interactionEnd;
        friend.idleAt = interactionEnd;
        if (random(bird) < 0.45) startBubble(bird, outcome < 0.45 ? 2 : 5);
        if (random(friend) < 0.4) startBubble(friend, 3);
      } else {
        bird.interactionUntil = 0;
        friend.interactionUntil = 0;
        bird.idleAt = clock + 2.2;
        friend.idleAt = clock + 2.2;
        bird.idle = outcome < 0.86 ? 2 : 3;
        friend.idle = outcome < 0.86 ? 4 : 2;
        if (random(bird) < 0.4) startBubble(bird, outcome < 0.86 ? 8 : 6);
        if (random(friend) < 0.35) startBubble(friend, outcome < 0.86 ? 7 : 6);
      }
    } else {
      bird.interactionUntil = 0;
      if (random(bird) < 0.22) startBubble(bird, random(bird) < 0.5 ? 7 : 8);
    }
  };

  const startReturn = (bird: Bird, controls: BirdSocialControls) => {
    const partner = bird.partner;
    bird.phase = 'return';
    bird.elapsed = 0;
    bird.duration = 3.0 + random(bird) * 1.4;
    bird.partner = -1;
    bird.idle = 0;
    if (partner >= 0 && birds[partner]?.partner === birds.indexOf(bird)) {
      const friend = birds[partner];
      friend.partner = -1;
      if (friend.phase === 'perch' && random(friend) < 0.35) startBubble(friend, 4);
    }
    if (random(bird) < 0.18) startBubble(bird, 1);
  };

  const updateVisibleState = (bird: Bird) => {
    const progress = bird.duration > 0 ? bird.elapsed / bird.duration : 1;
    if (bird.phase === 'orbit') { bird.excursion = 0; bird.rest = 0; }
    if (bird.phase === 'depart') { bird.excursion = smooth(progress); bird.rest = smooth((progress - 0.4) / 0.6); }
    if (bird.phase === 'perch') { bird.excursion = 1; bird.rest = 1; }
    if (bird.phase === 'return') { bird.excursion = 1 - smooth(progress); bird.rest = 1 - smooth(progress / 0.62); }
    const bubbleProgress = (clock - bird.bubbleStart) / Math.max(bird.bubbleDuration, 0.001);
    bird.bubble = bird.emotion === 0 ? 0 : smooth((clock - bird.bubbleStart) / 0.35) * (1 - smooth((clock - bird.bubbleStart - bird.bubbleDuration + 0.65) / 0.65));
    if (bubbleProgress >= 1) { bird.emotion = 0; bird.bubble = 0; }
  };

  const reset = (seed = activeSeed) => {
    activeSeed = seed;
    clock = 0;
    birds.length = 0;
    for (let index = 0; index < BIRD_COUNT; index++) {
      const bird = {
        excursion: 0, rest: 0, owner: (index % 2 ? 6 : 5) as 5 | 6, slot: 0, facing: 0 as -1 | 0 | 1,
        idle: 0, emotion: 0, bubble: 0, phase: 'orbit' as Phase, elapsed: 0, duration: 0,
        partner: -1, interactionUntil: 0, idleAt: 0, bubbleAt: 0, bubbleStart: -100, bubbleDuration: 1,
        random: ((seed * 65537 + index * 977) >>> 0), events: 0, bonded: false,
      };
      birds.push(bird);
      scheduleOrbit(bird, { frequency: 1, speed: 1, perchDuration: 8, sociability: 0.4, seed });
      bird.elapsed = random(bird) * bird.duration;
    }
  };

  const advance = (dt: number, controls: BirdSocialControls) => {
    if (controls.seed !== activeSeed) reset(controls.seed);
    const step = clamp(Number.isFinite(dt) ? dt : 0, 0, 1);
    clock += step;
    thoughtDuration = clamp(controls.thoughtDuration ?? 6, 0.5, 30);
    const sociability = clamp(controls.sociability, 0, 1);
    for (let index = 0; index < birds.length; index++) {
      const bird = birds[index];
      const phaseSpeed = bird.phase === 'orbit'
        ? clamp(controls.frequency, 0, 8)
        : (bird.phase === 'depart' || bird.phase === 'return' ? speedFor(controls, index) : 1);
      bird.elapsed += step * phaseSpeed;
      if (bird.phase === 'orbit' && controls.frequency > 0 && bird.elapsed >= bird.duration) {
        const candidates = birds.filter((friend, friendIndex) => friendIndex !== index && friend.phase === 'perch' && friend.partner < 0);
        const friend = candidates.length && random(bird) < sociability ? candidates[Math.floor(random(bird) * candidates.length)] : undefined;
        startDeparture(bird, controls, friend ? birds.indexOf(friend) : -1);
      } else if (bird.phase === 'depart' && bird.elapsed >= bird.duration) {
        startPerch(bird, controls);
      } else if (bird.phase === 'perch' && bird.elapsed >= bird.duration) {
        if (clock < bird.interactionUntil) bird.duration += bird.interactionUntil - clock;
        else startReturn(bird, controls);
      } else if (bird.phase === 'return' && bird.elapsed >= bird.duration) {
        scheduleOrbit(bird, controls);
      }
      if (bird.phase === 'perch' && clock >= bird.idleAt) {
        bird.idle = 1 + Math.floor(random(bird) * 5);
        bird.idleAt = clock + 2.5 + random(bird) * 2.5;
      }
      if (bird.phase === 'perch' && clock >= bird.bubbleAt && bird.emotion === 0) {
        if (random(bird) < 0.22) startBubble(bird,
          bird.partner >= 0 ? (random(bird) < 0.65 ? 3 : 5) : (random(bird) < 0.5 ? 1 : 7));
        else bird.bubbleAt = clock + bird.bubbleDuration + 6 + random(bird) * 10;
      }
      updateVisibleState(bird);
    }
    // Do not retain a reference to a bird that has already left its perch.
    for (const bird of birds) {
      const friend = bird.partner >= 0 ? birds[bird.partner] : undefined;
      if (bird.phase === 'perch' && friend && friend.phase !== 'perch' && friend.phase !== 'depart') bird.partner = -1;
    }
    return states;
  };

  const states: readonly BirdSocialState[] = birds;
  reset(0);
  return { advance, states, reset };
}
