// Structural match for SDK 0.4 paths2d. Kept free of GPU imports for later CPU tests.
export interface Point {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly distance: number;
  readonly depositionTime: number;
}

export interface LoopSettings {
  count: number;
  spread: number;
  motion: number;
  width: number;
  seed: number;
}

export const MAX_PATHS = 16;
export const POINTS = 97;
const TAU = Math.PI * 2;

function hash(value: number): number {
  const n = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function makeLoops(time: number, aspect: number, settings: LoopSettings) {
  const paths = [];
  const count = Math.max(0, Math.min(MAX_PATHS, Math.round(settings.count)));
  const clock = time * settings.motion;
  for (let id = 0; id < count; id++) {
    const seed = settings.seed * 37 + id * 13;
    const phase = hash(seed) * TAU;
    const points: Point[] = [];
    let distance = 0;
    for (let index = 0; index < POINTS; index++) {
      // Explicit repeat makes the seam position and strip normal identical.
      const angle = (index === POINTS - 1 ? 0 : index / (POINTS - 1)) * TAU;
      const theta = angle + phase;
      const radius = 0.26 + hash(seed + 1) * 0.15;
      const x = settings.spread * aspect * (
        radius * Math.cos(theta)
        + 0.065 * Math.sin(theta * 3 + clock * 0.19 + phase)
      );
      const y = settings.spread * (
        radius * 0.65 * Math.sin(theta * 2 + phase * 0.35)
        + 0.055 * Math.cos(theta * 3 - clock * 0.15)
      );
      const previous = points[index - 1];
      if (previous) distance += Math.hypot(x - previous.x, y - previous.y);
      points.push({ x, y, width: settings.width, distance, depositionTime: 0 });
    }
    paths.push({
      id, generation: 0, styleSeed: Math.floor(hash(seed + 2) * 65535),
      birthTime: 0, lifetime: 3600, phase: 0, opacity: 1, points,
    });
  }
  return { version: 1 as const, paths };
}

export function writeStrip(
  points: readonly Point[], positions: Float32Array, uvs: Float32Array, widthScale: number,
): void {
  if (points.length * 6 > positions.length || points.length * 4 > uvs.length) {
    throw Error('Path exceeds strip capacity');
  }
  const last = points.length - 1;
  const closed = last > 1 && Math.hypot(points[0]!.x - points[last]!.x, points[0]!.y - points[last]!.y) < 1e-6;
  for (let i = 0; i <= last; i++) {
    const a = points[i === 0 ? (closed ? last - 1 : 0) : i - 1]!;
    const b = points[i === last ? (closed ? 1 : last) : i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    const nx = length > 1e-8 ? -dy / length : 0;
    const ny = length > 1e-8 ? dx / length : 1;
    const point = points[i]!;
    const half = point.width * widthScale * 0.5;
    for (let side = 0; side < 2; side++) {
      const sign = side * 2 - 1;
      positions.set([point.x + nx * half * sign, point.y + ny * half * sign, 0], i * 6 + side * 3);
      uvs.set([point.distance, side], i * 4 + side * 2);
    }
  }
}

export function samplePath(points: readonly Point[], fraction: number) {
  if (points.length < 2) throw Error('A collar requires at least two path points');
  const distance = ((fraction % 1) + 1) % 1 * points[points.length - 1]!.distance;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (b.distance >= distance || i === points.length - 1) {
      const t = Math.max(0, Math.min(1, (distance - a.distance) / Math.max(b.distance - a.distance, 1e-8)));
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }
  }
  throw Error('No path segment');
}
