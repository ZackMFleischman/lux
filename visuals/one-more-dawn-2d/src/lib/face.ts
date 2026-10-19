// Parametric visor face. Emotion lives in a handful of numbers so a director
// note ("more longing on the held note") is a cheap edit, not a redraw.
//
// Drawn in head space: origin at the head centre, +y down, about 100 units
// wide. The caller positions, rotates and scales the head.

import { Ctx, INK, clamp01, ellipse, glowFill, lin, mixN, paint, rrect, within } from './ink.ts';

export interface Face {
  eyeOpen: number;   // 0 closed .. 1 open
  happy: number;     // 0 neutral .. 1 smiling eyes (lower lid rises)
  sad: number;       // 0 .. 1 outer corners droop, brows knit up
  browUp: number;    // -1 frown .. 1 raised
  lookX: number;     // -1 .. 1
  lookY: number;     // -1 .. 1
  mouthOpen: number; // 0 .. 1
  mouthWide: number; // 0.6 .. 1.4
  smile: number;     // -1 frown .. 1 smile
  glow: number;      // eye light 0 .. 1.5
}

export const neutralFace = (): Face => ({
  eyeOpen: 1, happy: 0, sad: 0, browUp: 0, lookX: 0, lookY: 0, mouthOpen: 0, mouthWide: 1, smile: 0.15, glow: 1,
});

export function mixFace(a: Face, b: Face, t: number): Face {
  const out = { ...a };
  for (const k of Object.keys(a) as (keyof Face)[]) out[k] = mixN(a[k], b[k], t);
  return out;
}

export interface FaceStyle {
  skin: string;
  skinShade: string;
  skinLight: string;
  visor: string;
  eye: string;
  brow: string;
  lips: string;
  mouth: string;
  moustache?: string;
}

// Eyes inside the visor band. Each eye is a rounded lozenge whose top edge is
// cut by the lid (eyeOpen, sad tilt) and whose bottom rises when happy.
function eyeShape(cx: number, side: number, f: Face): Path2D {
  const w = 17, h = 13;
  const open = clamp01(f.eyeOpen);
  const droop = f.sad * 6 * side;        // outer corner lower when sad
  const lidTop = -h + (1 - open) * h * 1.8;
  const bottom = h - f.happy * h * 1.15;
  const p = new Path2D();
  const x0 = cx - w, x1 = cx + w;
  const yOuterTop = lidTop + Math.max(0, droop * side) * 0.8;
  const yInnerTop = lidTop - f.sad * 3;
  const leftTop = side < 0 ? yOuterTop : yInnerTop;
  const rightTop = side < 0 ? yInnerTop : yOuterTop;
  p.moveTo(x0, (leftTop + bottom) / 2);
  p.bezierCurveTo(x0, leftTop, cx - w * 0.4, Math.min(leftTop, rightTop) - 3, cx, Math.min(leftTop, rightTop) - 2);
  p.bezierCurveTo(cx + w * 0.4, Math.min(leftTop, rightTop) - 3, x1, rightTop, x1, (rightTop + bottom) / 2);
  const happyArc = f.happy * 7;
  p.bezierCurveTo(x1, bottom + 2, cx + w * 0.5, bottom + 5 - happyArc, cx, bottom + 5 - happyArc * 1.6);
  p.bezierCurveTo(cx - w * 0.5, bottom + 5 - happyArc, x0, bottom + 2, x0, (leftTop + bottom) / 2);
  p.closePath();
  return p;
}

export function drawFace(ctx: Ctx, f: Face, s: FaceStyle, opts: { mouthY?: number; visorY?: number } = {}): void {
  const visorY = opts.visorY ?? -6;
  const mouthY = opts.mouthY ?? 30;
  // Visor band.
  const band = rrect(-46, visorY - 18, 92, 34, 15);
  paint(ctx, band, lin(ctx, 0, visorY - 18, 0, visorY + 16, [[0, '#2a3038'], [0.55, s.visor], [1, '#05070a']]), 3);
  within(ctx, band, () => {
    // Glossy streak across the visor.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.ellipse(-10, visorY - 12, 34, 4, -0.08, 0, Math.PI * 2);
    ctx.fill();
    // Eyes.
    const lx = f.lookX * 6, ly = f.lookY * 3;
    ctx.save();
    ctx.translate(lx, visorY + ly);
    for (const side of [-1, 1]) {
      const shape = eyeShape(side * 20, side, f);
      glowFill(ctx, shape, s.eye, 10 * f.glow, clamp01(f.glow));
      ctx.save();
      ctx.globalAlpha = 0.55 * clamp01(f.glow);
      ctx.fillStyle = '#ffffff';
      ctx.fill(ellipse(side * 20 - 4, -4 + (1 - f.eyeOpen) * 6, 5, 3));
      ctx.restore();
    }
    ctx.restore();
  });
  // Brows: metal ridges above the visor that carry most of the emotion.
  for (const side of [-1, 1]) {
    const up = f.browUp * 7;
    const knit = f.sad * 9;            // inner end rises when sad
    const angry = Math.max(0, -f.browUp) * 6;
    const yIn = visorY - 24 - up - knit + angry;
    const yOut = visorY - 24 - up + f.sad * 2 - angry * 0.4;
    const p = new Path2D();
    const xIn = side * 6, xOut = side * 40;
    p.moveTo(xIn, yIn);
    p.quadraticCurveTo(side * 22, Math.min(yIn, yOut) - 5, xOut, yOut);
    p.lineTo(xOut, yOut + 5);
    p.quadraticCurveTo(side * 22, Math.min(yIn, yOut), xIn, yIn + 5);
    p.closePath();
    paint(ctx, p, s.brow, 2);
  }
  // Mouth.
  const w = 15 * f.mouthWide;
  const open = clamp01(f.mouthOpen) * 17;
  const corner = mouthY - f.smile * 6;
  const upper = new Path2D();
  upper.moveTo(-w, corner);
  upper.bezierCurveTo(-w * 0.5, mouthY - 4 - open * 0.15, w * 0.5, mouthY - 4 - open * 0.15, w, corner);
  if (open > 0.6) {
    const mouth = new Path2D();
    mouth.moveTo(-w, corner);
    mouth.bezierCurveTo(-w * 0.5, mouthY - 4 - open * 0.15, w * 0.5, mouthY - 4 - open * 0.15, w, corner);
    mouth.bezierCurveTo(w * 0.7, corner + open * 0.9, -w * 0.7, corner + open * 0.9, -w, corner);
    mouth.closePath();
    paint(ctx, mouth, s.mouth, 2.2);
    within(ctx, mouth, () => {
      ctx.fillStyle = '#f2ece2';
      ctx.fillRect(-w, mouthY - 8, w * 2, 5 + open * 0.08);
      ctx.fillStyle = 'rgba(214,92,104,0.85)';
      ctx.beginPath();
      ctx.ellipse(0, corner + open * 0.85, w * 0.55, open * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    // Lips.
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = s.lips;
    ctx.stroke(upper);
  } else {
    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke(upper);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = s.lips;
    ctx.stroke(upper);
  }
  if (s.moustache) {
    const m = new Path2D();
    const my = mouthY - 9;
    m.moveTo(0, my - 4);
    m.bezierCurveTo(-10, my - 9, -24, my - 6, -30, my + 3);
    m.bezierCurveTo(-22, my + 1, -12, my + 2, 0, my + 1);
    m.bezierCurveTo(12, my + 2, 22, my + 1, 30, my + 3);
    m.bezierCurveTo(24, my - 6, 10, my - 9, 0, my - 4);
    m.closePath();
    paint(ctx, m, s.moustache, 2);
  }
}

// Expression presets (blend between them with mixFace).
export const expressions: Record<string, Partial<Face>> = {
  asleep: { eyeOpen: 0, glow: 0, browUp: -0.2, smile: 0 },
  wonder: { eyeOpen: 1, browUp: 0.9, happy: 0.1, smile: 0.25 },
  dutiful: { eyeOpen: 0.8, browUp: 0.1, happy: 0.35, smile: 0.35 },
  doubt: { eyeOpen: 0.7, browUp: -0.1, sad: 0.35, smile: -0.2 },
  question: { eyeOpen: 0.85, browUp: 0.4, sad: 0.2, lookY: -0.6, smile: 0 },
  dreamy: { eyeOpen: 0.75, browUp: 0.6, happy: 0.45, smile: 0.4, lookY: -0.8 },
  yearning: { eyeOpen: 0.6, browUp: 0.5, sad: 0.75, lookY: -0.7, smile: -0.1 },
  warm: { eyeOpen: 0.8, browUp: 0.25, happy: 0.55, smile: 0.55 },
  proud: { eyeOpen: 0.9, browUp: 0.4, happy: 0.3, smile: 0.45 },
  wistful: { eyeOpen: 0.6, browUp: 0.2, sad: 0.6, smile: 0.05 },
  stern: { eyeOpen: 0.8, browUp: -0.7, smile: -0.35 },
  alarm: { eyeOpen: 1, browUp: 1, sad: 0.4, smile: -0.4 },
  humble: { eyeOpen: 0.45, browUp: 0.1, sad: 0.5, lookY: 0.6, smile: 0.05 },
};

export function faceFrom(name: string, base = neutralFace()): Face {
  return { ...base, ...(expressions[name] ?? {}) } as Face;
}
