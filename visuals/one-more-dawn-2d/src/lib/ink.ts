// Canvas 2D "ink and paint" helpers shared by every drawn character and
// prop: dark outlines, soft cel gradients, rim light and glow, matching the
// painted plates. All drawing happens in a character's design space.

export type Ctx = OffscreenCanvasRenderingContext2D;
export type Stops = readonly (readonly [number, string])[];

export const INK = '#1b1410';

export function lin(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: Stops): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function rad(ctx: Ctx, x: number, y: number, r0: number, r1: number, stops: Stops): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

// Fill a path, then ink its outline.
export function paint(ctx: Ctx, path: Path2D, fill: string | CanvasGradient, line = 3, ink = INK): void {
  ctx.fillStyle = fill;
  ctx.fill(path);
  if (line > 0) {
    ctx.lineWidth = line * 1.3;
    ctx.strokeStyle = ink;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke(path);
  }
}

// Clip to a path and run extra shading (shadow side, rim light) inside it.
export function within(ctx: Ctx, path: Path2D, draw: () => void): void {
  ctx.save();
  ctx.clip(path);
  draw();
  ctx.restore();
}

// Soft glowing fill (eyes, bulbs).
export function glowFill(ctx: Ctx, path: Path2D, color: string, blur: number, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fill(path);
  ctx.fill(path);
  ctx.restore();
}

export function ellipse(x: number, y: number, rx: number, ry: number, rot = 0): Path2D {
  const p = new Path2D();
  p.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
  return p;
}

export function rrect(x: number, y: number, w: number, h: number, r: number): Path2D {
  const p = new Path2D();
  p.roundRect(x, y, w, h, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  return p;
}

// Path from a list of points through quadratic midpoints (smooth closed blob).
export function smooth(points: readonly (readonly [number, number])[], closed = true): Path2D {
  const p = new Path2D();
  const n = points.length;
  const mid = (a: readonly [number, number], b: readonly [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  if (closed) {
    const start = mid(points[n - 1], points[0]);
    p.moveTo(start[0], start[1]);
    for (let i = 0; i < n; i += 1) {
      const m = mid(points[i], points[(i + 1) % n]);
      p.quadraticCurveTo(points[i][0], points[i][1], m[0], m[1]);
    }
    p.closePath();
  } else {
    p.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < n - 1; i += 1) {
      const m = mid(points[i], points[i + 1]);
      p.quadraticCurveTo(points[i][0], points[i][1], m[0], m[1]);
    }
    p.lineTo(points[n - 1][0], points[n - 1][1]);
  }
  return p;
}

// Rubber-hose limb: an outlined tube along a quadratic curve, with a lit
// stripe for a cylindrical cel look.
export function tube(ctx: Ctx, a: readonly [number, number], c: readonly [number, number], b: readonly [number, number],
  width: number, base: string, light: string, shade: string, line = 3): void {
  const p = new Path2D();
  p.moveTo(a[0], a[1]);
  p.quadraticCurveTo(c[0], c[1], b[0], b[1]);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + line * 2;
  ctx.stroke(p);
  ctx.strokeStyle = shade;
  ctx.lineWidth = width;
  ctx.stroke(p);
  ctx.strokeStyle = base;
  ctx.lineWidth = width * 0.72;
  ctx.stroke(p);
  ctx.save();
  ctx.translate(-width * 0.16, -width * 0.12);
  ctx.strokeStyle = light;
  ctx.lineWidth = width * 0.24;
  ctx.stroke(p);
  ctx.restore();
}

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const mixN = (a: number, b: number, t: number): number => a + (b - a) * t;
