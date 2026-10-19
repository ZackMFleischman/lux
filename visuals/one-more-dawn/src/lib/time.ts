// Small animation helpers shared by the stage, cast and camera.

export type Ease = (u: number) => number;

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

export const smooth: Ease = u => u * u * (3 - 2 * u);

export const smoother: Ease = u => u * u * u * (u * (u * 6 - 15) + 10);

export const easeOut: Ease = u => 1 - (1 - u) * (1 - u) * (1 - u);

export const easeIn: Ease = u => u * u * u;

// Overshoots slightly and settles, for cartoon "snap" into a pose.
export const backOut: Ease = u => {
  const c = 1.70158;
  const v = u - 1;
  return 1 + (c + 1) * v * v * v + c * v * v;
};

// Normalised progress of t through [a, b], eased.
export function ramp(t: number, a: number, b: number, ease: Ease = smooth): number {
  if (b <= a) {
    return t >= b ? 1 : 0;
  }
  return ease(clamp01((t - a) / (b - a)));
}

// Fades up over [a, a + inT] and down over [b - outT, b].
export function span(t: number, a: number, b: number, inT = 0.5, outT = 0.5): number {
  return ramp(t, a, a + inT) * (1 - ramp(t, b - outT, b));
}

export type Key = readonly [number, number];

// Piecewise eased interpolation through [time, value] keys.
export function keys(t: number, list: readonly Key[], ease: Ease = smoother): number {
  if (t <= list[0][0]) {
    return list[0][1];
  }
  for (let i = 1; i < list.length; i += 1) {
    const [t1, v1] = list[i];
    if (t <= t1) {
      const [t0, v0] = list[i - 1];
      return lerp(v0, v1, ease(clamp01((t - t0) / Math.max(1e-6, t1 - t0))));
    }
  }
  return list[list.length - 1][1];
}

// Deterministic pseudo-random value in [0, 1) for an integer seed.
export function hash1(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Smooth 1D value noise in [-1, 1].
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash1(i + seed * 57.0);
  const b = hash1(i + 1 + seed * 57.0);
  return (lerp(a, b, smooth(f)) - 0.5) * 2;
}
