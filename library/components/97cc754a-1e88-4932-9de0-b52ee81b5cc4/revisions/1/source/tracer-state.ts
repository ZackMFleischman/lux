export interface TracerControls {
  readonly count: number;
  readonly speed: number;
  readonly curl: number;
  readonly sway: number;
  readonly seed: number;
  readonly width: number;
  readonly pace: number;
}

export interface TracerPoint {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly distance: number;
  readonly depositionTime: number;
}

export interface TracerPath {
  readonly id: number;
  readonly generation: number;
  readonly styleSeed: number;
  readonly birthTime: number;
  readonly lifetime: number;
  readonly phase: number;
  readonly opacity: number;
  readonly points: readonly TracerPoint[];
}

export interface PathsSnapshot {
  readonly version: 1;
  readonly paths: readonly TracerPath[];
}

interface DepositedPoint {
  distance: number;
  depositionTime: number;
  width: number;
}

interface TracerSlot {
  id: number;
  active: boolean;
  hasSpawned: boolean;
  generation: number;
  styleSeed: number;
  birthTime: number;
  lifetime: number;
  distance: number;
  targetDistance: number;
  fadeAge: number;
  spacing: number;
  nextSampleDistance: number;
  entryX: number;
  entryY: number;
  axisX: number;
  axisY: number;
  normalX: number;
  normalY: number;
  curvePhase: number;
  points: DepositedPoint[];
}

export interface TracerGenerator {
  readonly aspect: number;
  readonly resetSeed: number;
  readonly slots: TracerSlot[];
  controlSeed: number | undefined;
  artisticTime: number;
}

const MAX_TRACERS = 4;
const MAX_POINTS = 64;
const DISTANCE_PER_SECOND = 0.045;
const FADE_ARTISTIC_SECONDS = 10;
// Original painting coordinates; the resource itself stays canvas-height based.
const PAINTING_SCALE = 6.2;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function hash32(value: number): number {
  let integer = Math.trunc(value) | 0;
  integer = Math.imul(integer ^ (integer >>> 16), 0x21f0aaad);
  integer = Math.imul(integer ^ (integer >>> 15), 0x735a2d97);
  return (integer ^ (integer >>> 15)) >>> 0;
}

function random01(seed: number): number {
  return hash32(seed) / 0x1_0000_0000;
}

function seedFor(resetSeed: number, controlSeed: number, index: number, generation: number, salt = 0): number {
  return hash32(
    Math.trunc(resetSeed) + Math.trunc(controlSeed * 1_000) * 0x9e37 +
    index * 0x85eb + generation * 0xc2b2 + salt,
  );
}

function emptySlot(id: number): TracerSlot {
  return {
    id,
    active: false,
    hasSpawned: false,
    generation: -1,
    styleSeed: 0,
    birthTime: 0,
    lifetime: 0,
    distance: 0,
    targetDistance: 1,
    fadeAge: 0,
    spacing: 1 / (MAX_POINTS - 1),
    nextSampleDistance: 0,
    entryX: 0,
    entryY: 0,
    axisX: 1,
    axisY: 0,
    normalX: 0,
    normalY: 1,
    curvePhase: 0,
    points: [],
  };
}

export function createTracerGenerator(aspect: number, resetSeed: number): TracerGenerator {
  return {
    aspect: Number.isFinite(aspect) && aspect > 0 ? aspect : 1,
    resetSeed: Number.isFinite(resetSeed) ? resetSeed : 0,
    slots: Array.from({ length: MAX_TRACERS }, (_value, index) => emptySlot(index)),
    controlSeed: undefined,
    artisticTime: 0,
  };
}

function pointOnPerimeter(aspect: number, unit: number): readonly [number, number] {
  const halfWidth = aspect * 0.5;
  const halfHeight = 0.5;
  const width = halfWidth * 2;
  const height = halfHeight * 2;
  let distance = unit * (2 * width + 2 * height);
  if (distance < width) return [-halfWidth + distance, -halfHeight];
  distance -= width;
  if (distance < height) return [halfWidth, -halfHeight + distance];
  distance -= height;
  if (distance < width) return [halfWidth - distance, halfHeight];
  distance -= width;
  return [-halfWidth, halfHeight - distance];
}

function rayExitDistance(
  x: number,
  y: number,
  dx: number,
  dy: number,
  aspect: number,
): number {
  const halfWidth = aspect * 0.5;
  const candidates = [
    dx > 1e-8 ? (halfWidth - x) / dx : dx < -1e-8 ? (-halfWidth - x) / dx : Infinity,
    dy > 1e-8 ? (0.5 - y) / dy : dy < -1e-8 ? (-0.5 - y) / dy : Infinity,
  ].filter(value => value > 1e-6 && Number.isFinite(value));
  return Math.max(0.1, Math.min(...candidates));
}

function spawn(
  generator: TracerGenerator,
  slot: TracerSlot,
  index: number,
  sceneTime: number,
  controls: TracerControls,
): void {
  slot.generation = slot.hasSpawned ? slot.generation + 1 : 0;
  slot.hasSpawned = true;
  slot.active = true;
  const frameSeed = seedFor(generator.resetSeed, controls.seed, index, slot.generation);
  const [entryX, entryY] = pointOnPerimeter(generator.aspect, random01(frameSeed));
  const halfWidth = generator.aspect * 0.5;
  const aimX = (random01(frameSeed + 1) - 0.5) * halfWidth * 0.9;
  const aimY = (random01(frameSeed + 2) - 0.5) * 0.45;
  const length = Math.hypot(aimX - entryX, aimY - entryY);
  const axisX = (aimX - entryX) / Math.max(length, 1e-6);
  const axisY = (aimY - entryY) / Math.max(length, 1e-6);
  const targetDistance = rayExitDistance(entryX, entryY, axisX, axisY, generator.aspect);
  const pace = Math.max(controls.pace, 0.01);
  const speed = Math.max(controls.speed, 0.01);

  slot.styleSeed = seedFor(generator.resetSeed, controls.seed, index, slot.generation, 0x27d4);
  slot.birthTime = sceneTime;
  slot.lifetime = targetDistance / (DISTANCE_PER_SECOND * speed * pace) + FADE_ARTISTIC_SECONDS / pace;
  slot.distance = 0;
  slot.targetDistance = targetDistance;
  slot.fadeAge = 0;
  slot.spacing = Math.max(targetDistance / (MAX_POINTS - 1), 0.018);
  slot.nextSampleDistance = slot.spacing;
  slot.entryX = entryX;
  slot.entryY = entryY;
  slot.axisX = axisX;
  slot.axisY = axisY;
  slot.normalX = -axisY;
  slot.normalY = axisX;
  slot.curvePhase = random01(frameSeed + 3) * Math.PI * 2;
  slot.points = [{
    distance: 0,
    depositionTime: sceneTime,
    width: Math.max(0.002, controls.width),
  }];
}

function advance(
  slot: TracerSlot,
  frame: Readonly<{ timeSeconds: number; deltaSeconds: number }>,
  controls: TracerControls,
): void {
  const deltaSeconds = Math.max(0, frame.deltaSeconds);
  const artisticDelta = deltaSeconds * Math.max(0, controls.pace);
  const oldDistance = slot.distance;
  const proposedDistance = oldDistance + artisticDelta * Math.max(0, controls.speed) * DISTANCE_PER_SECOND;
  const nextDistance = Math.min(slot.targetDistance, proposedDistance);
  const proposedDelta = proposedDistance - oldDistance;
  const frameStart = frame.timeSeconds - deltaSeconds;

  while (slot.nextSampleDistance <= nextDistance + 1e-10 && slot.points.length < MAX_POINTS - 1) {
    const fraction = proposedDelta > 1e-10
      ? clamp((slot.nextSampleDistance - oldDistance) / proposedDelta, 0, 1)
      : 1;
    slot.points.push({
      distance: slot.nextSampleDistance,
      depositionTime: frameStart + deltaSeconds * fraction,
      width: Math.max(0.002, controls.width),
    });
    slot.nextSampleDistance += slot.spacing;
  }

  const lastPoint = slot.points.at(-1)!;
  if (
    nextDistance >= slot.targetDistance - 1e-10 &&
    lastPoint.distance < slot.targetDistance - 1e-10 &&
    slot.points.length < MAX_POINTS
  ) {
    const fraction = proposedDelta > 1e-10
      ? clamp((slot.targetDistance - oldDistance) / proposedDelta, 0, 1)
      : 1;
    slot.points.push({
      distance: slot.targetDistance,
      depositionTime: frameStart + deltaSeconds * fraction,
      width: Math.max(0.002, controls.width),
    });
  }

  slot.distance = nextDistance;
  if (proposedDistance > slot.targetDistance) {
    const unusedDistance = proposedDistance - slot.targetDistance;
    const rate = Math.max(controls.speed, 1e-6) * DISTANCE_PER_SECOND;
    slot.fadeAge += unusedDistance / rate;
  } else if (slot.distance >= slot.targetDistance - 1e-10) {
    slot.fadeAge += artisticDelta;
  }
}

function pathPhase(slot: TracerSlot): number {
  if (slot.distance < slot.targetDistance - 1e-10) {
    return 0.72 * clamp(slot.distance / slot.targetDistance, 0, 1);
  }
  return 0.72 + 0.28 * clamp(slot.fadeAge / FADE_ARTISTIC_SECONDS, 0, 1);
}

function curvedPoint(
  slot: TracerSlot,
  deposit: DepositedPoint,
  sceneTime: number,
  controls: TracerControls,
): TracerPoint {
  const a = deposit.distance * PAINTING_SCALE;
  const travel = slot.targetDistance * PAINTING_SCALE;
  const envelope = smoothstep(0, 0.85, a) * (1 - smoothstep(travel - 0.85, travel, a));
  const movement = clamp(controls.sway, 0, 2);
  const phase = slot.curvePhase + movement * 0.025 * Math.sin(sceneTime * 0.065 + slot.curvePhase);
  const curl = controls.curl * (1 + movement * 0.018 * Math.sin(sceneTime * 0.055 + slot.curvePhase));
  const route = curl * (0.60 * Math.sin(a * 1.1 + phase) + 0.13 * Math.sin(a * 2.9 - phase * 0.7));
  const sway = movement * (0.035 * Math.sin(a * 0.73 - sceneTime * 0.075 + slot.curvePhase)
    + 0.014 * Math.sin(a * 2.05 - sceneTime * 0.12 + slot.curvePhase * 1.7));
  const offset = (route + sway * (0.45 + controls.curl * 0.40)) * envelope / PAINTING_SCALE;
  const wake = smoothstep(0, 0.80, (slot.distance - deposit.distance) * PAINTING_SCALE);
  const halfWidth = 0.018 + (0.065 + 0.023 * Math.sin(a * 1.7 + slot.curvePhase) - 0.018) * wake;
  return Object.freeze({
    x: slot.entryX + slot.axisX * deposit.distance + slot.normalX * offset,
    y: slot.entryY + slot.axisY * deposit.distance + slot.normalY * offset,
    width: controls.width * halfWidth / 0.065,
    distance: deposit.distance,
    depositionTime: deposit.depositionTime,
  });
}

function snapshotPath(slot: TracerSlot, sceneTime: number, artisticTime: number, controls: TracerControls): TracerPath {
  const deposits = slot.points.slice();
  const last = deposits.at(-1)!;
  if (slot.distance > last.distance + 1e-10 && deposits.length < MAX_POINTS) {
    deposits.push({
      distance: slot.distance,
      depositionTime: sceneTime,
      width: Math.max(0.002, controls.width),
    });
  }
  const phase = pathPhase(slot);
  const opacity = 1 - smoothstep(0.82, 1, phase);
  const geometry = deposits.map(point => curvedPoint(slot, point, artisticTime, controls));
  let distance = 0;
  const points = geometry.map((point, index) => {
    if (index) distance += Math.hypot(point.x - geometry[index - 1]!.x, point.y - geometry[index - 1]!.y);
    return Object.freeze({ ...point, distance });
  });
  return Object.freeze({
    id: slot.id,
    generation: slot.generation,
    styleSeed: slot.styleSeed,
    birthTime: slot.birthTime,
    lifetime: slot.lifetime,
    phase,
    opacity,
    points: Object.freeze(points),
  });
}

export function stepTracerGenerator(
  generator: TracerGenerator,
  frame: Readonly<{ timeSeconds: number; deltaSeconds: number }>,
  controls: TracerControls,
): PathsSnapshot {
  const sceneTime = Number.isFinite(frame.timeSeconds) ? frame.timeSeconds : 0;
  const count = clamp(Math.round(controls.count), 0, MAX_TRACERS);
  const seedChanged = generator.controlSeed !== undefined && generator.controlSeed !== controls.seed;
  generator.controlSeed = controls.seed;
  generator.artisticTime += Math.max(0, frame.deltaSeconds) * Math.max(0, controls.pace);
  const paths: TracerPath[] = [];

  for (let index = 0; index < generator.slots.length; index += 1) {
    const slot = generator.slots[index]!;
    if (index >= count) {
      slot.active = false;
      continue;
    }
    const needsSpawn = !slot.active || seedChanged;
    if (needsSpawn) spawn(generator, slot, index, sceneTime, controls);
    else advance(slot, frame, controls);
    if (pathPhase(slot) >= 1) spawn(generator, slot, index, sceneTime, controls);
    paths.push(snapshotPath(slot, sceneTime, generator.artisticTime, controls));
  }

  return Object.freeze({ version: 1, paths: Object.freeze(paths) });
}
