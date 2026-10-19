// Drawn cast. Each draw function paints one character in its design space
// (origin between the feet, +y down, roughly 1 unit = 1 canvas px at the
// reference scale) from a plain pose object, so animation is just data.

import { drawFace, Face, FaceStyle } from './face.ts';
import { Ctx, INK, ellipse, lin, paint, rad, smooth, tube, within } from './ink.ts';

export type P2 = [number, number];

export interface Pose {
  x: number;          // horizontal offset in design units
  bob: number;        // vertical body offset
  lean: number;       // body lean, radians
  headTilt: number;   // radians
  headTurn: number;   // -1..1 (cheats the face toward a side)
  handL: P2;          // hand targets, design space
  handR: P2;
  elbowL: number;     // elbow bend outward, design units
  elbowR: number;
  fingersL: number;   // 0 relaxed .. 1 spread
  fingersR: number;
  face: Face;
}

const GOLD = { base: '#e7b43e', light: '#fff0a6', shade: '#a86d1d', deep: '#7a4b12' };

export function hand(ctx: Ctx, at: P2, from: P2, colors: { base: string; light: string; shade: string }, spread: number, size = 1): void {
  const ang = Math.atan2(at[1] - from[1], at[0] - from[0]);
  ctx.save();
  ctx.translate(at[0], at[1]);
  ctx.rotate(ang - Math.PI / 2);
  ctx.scale(size, size);
  for (let i = -1; i <= 1; i += 1) {
    ctx.save();
    ctx.rotate(i * (0.18 + spread * 0.25));
    paint(ctx, ellipse(0, 13, 3.6, 8), lin(ctx, -4, 0, 4, 0, [[0, colors.shade], [0.5, colors.base], [1, colors.light]]), 1.8);
    ctx.restore();
  }
  paint(ctx, ellipse(-7 - spread * 3, 4, 3.4, 6.5, 0.9), colors.base, 1.8);
  paint(ctx, ellipse(0, 2, 7.5, 7), lin(ctx, -7, 0, 7, 0, [[0, colors.shade], [0.55, colors.base], [1, colors.light]]), 2);
  ctx.restore();
}

export function arm(ctx: Ctx, shoulder: P2, handAt: P2, elbow: number, side: number, colors: typeof GOLD, width: number, spread: number): void {
  const mid: P2 = [(shoulder[0] + handAt[0]) / 2 + side * elbow, (shoulder[1] + handAt[1]) / 2 + Math.abs(elbow) * 0.35];
  tube(ctx, shoulder, mid, handAt, width, colors.base, colors.light, colors.shade, 2.4);
  hand(ctx, handAt, mid, colors, spread);
}

// ---------------------------------------------------------------- Aria

export const ariaFaceStyle: FaceStyle = {
  skin: GOLD.base, skinShade: GOLD.shade, skinLight: GOLD.light,
  visor: '#151a21', eye: '#9dffd9', brow: '#8a5a17', lips: '#c4505e', mouth: '#3a0c16',
};

function ariaHead(ctx: Ctx, p: Pose): void {
  ctx.save();
  ctx.translate(0, -300);
  ctx.rotate(p.headTilt);
  // Sculpted golden updo: a big swirl bun, side curls and a crown band.
  const bun = smooth([[-36, -28], [-46, -62], [-24, -92], [8, -98], [36, -84], [46, -54], [34, -26], [0, -34]]);
  paint(ctx, bun, lin(ctx, -40, -95, 40, -30, [[0, GOLD.light], [0.45, '#f0c457'], [1, GOLD.deep]]), 2.6);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(122,75,18,0.85)';
  for (const [a, b, r] of [[-12, -64, 18], [14, -70, 14], [0, -52, 26]] as const) {
    ctx.beginPath();
    ctx.arc(a, b, r, 0.6, 3.8);
    ctx.stroke();
  }
  for (const side of [-1, 1]) paint(ctx, ellipse(side * 42, -8, 9, 20, side * 0.25), lin(ctx, 0, -28, 0, 12, [[0, GOLD.light], [1, GOLD.shade]]), 2.2);
  // Head.
  const head = ellipse(0, 0, 40, 44);
  paint(ctx, head, rad(ctx, -12, -16, 4, 58, [[0, GOLD.light], [0.45, GOLD.base], [1, GOLD.shade]]), 2.8);
  within(ctx, head, () => {
    ctx.fillStyle = 'rgba(122,75,18,0.35)';
    ctx.beginPath();
    ctx.ellipse(26, 10, 26, 44, 0.2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.save();
  ctx.translate(p.headTurn * 8, 2);
  ctx.scale(0.8 - Math.abs(p.headTurn) * 0.08, 0.8);
  drawFace(ctx, p.face, ariaFaceStyle, { visorY: -8, mouthY: 30 });
  ctx.restore();
  ctx.restore();
}

export function drawAria(ctx: Ctx, p: Pose, t: number): void {
  ctx.save();
  ctx.translate(p.x, p.bob);
  // Gown with a long train sweeping to stage right.
  const sway = Math.sin(t * 0.9) * 4;
  const gown = new Path2D();
  gown.moveTo(-22, -190);
  gown.bezierCurveTo(-40, -120, -95 - sway, -40, -118 - sway, 0);
  gown.bezierCurveTo(-60, 10, 40, 10, 120, 4);
  gown.bezierCurveTo(165 + sway, 2, 205 + sway, -6, 215 + sway, -2);
  gown.bezierCurveTo(150, -40, 70, -90, 30, -190);
  gown.closePath();
  paint(ctx, gown, lin(ctx, -110, 0, 200, 0, [[0, '#fbf8ee'], [0.45, '#f1ead8'], [0.75, '#cfe0ea'], [1, '#9fbfd6']]), 2.8);
  within(ctx, gown, () => {
    ctx.strokeStyle = 'rgba(120,150,180,0.55)';
    ctx.lineWidth = 2.2;
    for (const [x0, x1, x2] of [[-10, -55, -70], [6, 10, 20], [18, 70, 110], [24, 110, 170]] as const) {
      ctx.beginPath();
      ctx.moveTo(x0, -180);
      ctx.quadraticCurveTo(x1, -90, x2 + sway, 0);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-40, -80, 18, 70, 0.25, 0, Math.PI * 2);
    ctx.fill();
    // Shadow side of the skirt and warm stage bounce at the hem.
    ctx.fillStyle = 'rgba(96,128,170,0.28)';
    ctx.beginPath();
    ctx.ellipse(70, -60, 70, 110, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = lin(ctx, 0, -30, 0, 8, [[0, 'rgba(255,200,120,0)'], [1, 'rgba(255,196,110,0.55)']]);
    ctx.fillRect(-130, -30, 360, 40);
    // Deep folds.
    ctx.strokeStyle = 'rgba(70,96,130,0.5)';
    ctx.lineWidth = 3;
    for (const [x0, cx, x1] of [[-16, -40, -95], [-4, -10, -35], [12, 30, 50], [20, 80, 140]] as const) {
      ctx.beginPath();
      ctx.moveTo(x0, -150);
      ctx.quadraticCurveTo(cx, -80, x1 + sway, -2);
      ctx.stroke();
    }
  });
  // Gold sash at the waist.
  paint(ctx, smooth([[-26, -198], [0, -192], [26, -198], [24, -186], [0, -180], [-24, -186]]), lin(ctx, 0, -198, 0, -180, [[0, GOLD.light], [1, GOLD.shade]]), 2);
  // Translucent pale-blue overskirt drape.
  ctx.save();
  ctx.globalAlpha = 0.55;
  const drape = new Path2D();
  drape.moveTo(26, -200);
  drape.bezierCurveTo(70, -140, 110, -60, 170 + sway, -4);
  drape.lineTo(120, -2);
  drape.bezierCurveTo(90, -60, 50, -130, 18, -195);
  drape.closePath();
  paint(ctx, drape, lin(ctx, 20, -200, 160, 0, [[0, '#e8f3fa'], [1, '#a9cbe0']]), 1.6);
  ctx.restore();
  ctx.save();
  ctx.translate(0, -190);
  ctx.rotate(p.lean);
  ctx.translate(0, 190);
  // Bodice with gold trim.
  const bodice = smooth([[-24, -190], [-30, -228], [-26, -252], [0, -258], [26, -252], [30, -228], [24, -190], [0, -186]]);
  paint(ctx, bodice, lin(ctx, -30, -250, 30, -190, [[0, '#ffffff'], [0.6, '#f0e9d6'], [1, '#c9d6de']]), 2.6);
  ctx.strokeStyle = GOLD.base;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-25, -197);
  ctx.quadraticCurveTo(0, -188, 25, -197);
  ctx.stroke();
  // Neck.
  paint(ctx, ellipse(0, -266, 9, 14), lin(ctx, -9, 0, 9, 0, [[0, GOLD.shade], [0.5, GOLD.base], [1, GOLD.light]]), 2.2);
  // Arms (behind/in front ordering: far arm first).
  const shoulderL: P2 = [-30, -240], shoulderR: P2 = [30, -240];
  arm(ctx, shoulderL, p.handL, p.elbowL, -1, GOLD, 11, p.fingersL);
  // Puff sleeves.
  for (const s of [-1, 1]) paint(ctx, ellipse(s * 32, -246, 19, 15, s * 0.4), rad(ctx, s * 26, -250, 2, 18, [[0, '#ffffff'], [1, '#d6e2ea']]), 2.4);
  ariaHead(ctx, p);
  arm(ctx, shoulderR, p.handR, p.elbowR, 1, GOLD, 11, p.fingersR);
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- Pianist
// An original slate-blue robot: domed head, one wide oval visor, small
// bowler hat, tuxedo. Seated at a black grand piano facing stage left.

export const pianistFaceStyle: FaceStyle = {
  skin: '#8d9bb0', skinShade: '#56627a', skinLight: '#d5deea',
  visor: '#0e1218', eye: '#9dffd9', brow: '#3a4252', lips: '#2a2f38', mouth: '#120d10',
};

export interface PianistPose {
  headBob: number;
  headTilt: number;
  handPhase: number;  // drives the playing hands
  lookUp: number;
  face: Face;
}

export function drawPianoAndPianist(ctx: Ctx, p: PianistPose): void {
  // Grand piano (body, lid propped open, legs), facing stage left.
  const legs = [[-150, 0], [-10, 0], [150, -6]] as const;
  for (const [x, y] of legs) paint(ctx, smooth([[x - 8, y - 110], [x + 8, y - 110], [x + 6, y], [x - 6, y]]), '#121218', 2.4);
  const body = new Path2D();
  body.moveTo(-190, -150);
  body.lineTo(140, -150);
  body.bezierCurveTo(230, -150, 240, -100, 190, -96);
  body.lineTo(-190, -96);
  body.closePath();
  paint(ctx, body, lin(ctx, 0, -150, 0, -96, [[0, '#2a2c36'], [0.4, '#0f1016'], [1, '#050507']]), 2.6);
  const lid = new Path2D();
  lid.moveTo(-170, -152);
  lid.lineTo(150, -152);
  lid.bezierCurveTo(200, -230, 120, -270, 40, -262);
  lid.closePath();
  paint(ctx, lid, lin(ctx, -170, -150, 120, -260, [[0, '#0b0b10'], [0.6, '#24262f'], [1, '#3b3e4a']]), 2.6);
  ctx.strokeStyle = 'rgba(255,214,140,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-160, -153);
  ctx.lineTo(130, -153);
  ctx.stroke();
  // Keyboard.
  paint(ctx, rrectPath(-232, -122, 70, 12), '#f3eee4', 1.6);
  ctx.fillStyle = '#16161c';
  for (let i = 0; i < 9; i += 1) ctx.fillRect(-228 + i * 7.5, -122, 3, 6);
  // Bench.
  paint(ctx, rrectPath(-318, -76, 74, 14), '#15151b', 2.2);
  for (const x of [-312, -254]) paint(ctx, rrectPath(x, -64, 6, 64), '#15151b', 1.8);
  // Pianist (seated, facing stage left toward the keys).
  ctx.save();
  ctx.translate(-282, -76);
  // Legs.
  tube(ctx, [6, 0], [-20, 4], [-38, 36], 16, '#1d1f27', '#3a3e4c', '#0b0c10', 2.2);
  tube(ctx, [-38, 36], [-40, 60], [-40, 74], 14, '#1d1f27', '#3a3e4c', '#0b0c10', 2.2);
  paint(ctx, ellipse(-48, 76, 14, 6), '#0b0b0e', 2);
  // Torso in a tailcoat.
  const torso = smooth([[-18, 0], [-24, -46], [-16, -88], [6, -96], [24, -82], [26, -40], [22, 2], [0, 6]]);
  paint(ctx, torso, lin(ctx, -24, -90, 26, 0, [[0, '#2b2e3a'], [1, '#0c0d12']]), 2.6);
  paint(ctx, smooth([[-14, -84], [-4, -92], [6, -84], [2, -40], [-8, -40]]), '#f2efe8', 1.8);
  paint(ctx, smooth([[-10, -86], [-2, -82], [-10, -78], [-2, -90]]), '#101014', 1.4);
  // Head.
  ctx.save();
  ctx.translate(-2, -122 + p.headBob);
  ctx.rotate(p.headTilt - 0.15);
  const head = new Path2D();
  head.moveTo(-30, 20);
  head.bezierCurveTo(-34, -18, -24, -40, 0, -42);
  head.bezierCurveTo(24, -40, 34, -18, 30, 20);
  head.bezierCurveTo(16, 30, -16, 30, -30, 20);
  head.closePath();
  paint(ctx, head, rad(ctx, -10, -18, 4, 50, [[0, pianistFaceStyle.skinLight], [0.5, pianistFaceStyle.skin], [1, pianistFaceStyle.skinShade]]), 2.6);
  // Bowler hat.
  paint(ctx, ellipse(0, -40, 34, 6), '#15151b', 2.2);
  paint(ctx, smooth([[-22, -40], [-20, -62], [0, -70], [20, -62], [22, -40]]), lin(ctx, 0, -70, 0, -40, [[0, '#2c2c36'], [1, '#0d0d12']]), 2.2);
  ctx.save();
  ctx.translate(-6, -2);
  ctx.scale(0.62, 0.62);
  drawFace(ctx, p.face, pianistFaceStyle, { visorY: -6, mouthY: 28 });
  ctx.restore();
  ctx.restore();
  // Arms reaching to the keys, hands alternating.
  const a = Math.sin(p.handPhase), b = Math.sin(p.handPhase + 2.1);
  const pc = { base: '#8d9bb0', light: '#d5deea', shade: '#56627a', deep: '#3a4252' };
  tube(ctx, [-6, -80], [-30, -60], [-52 + a * 4, -48 - Math.max(0, a) * 6], 12, '#262935', '#454a5a', '#0e0f14', 2.2);
  hand(ctx, [-52 + a * 4, -48 - Math.max(0, a) * 6], [-30, -60], pc, 0.2, 0.9);
  tube(ctx, [10, -80], [-18, -56], [-44 + b * 4, -42 - Math.max(0, b) * 6], 12, '#262935', '#454a5a', '#0e0f14', 2.2);
  hand(ctx, [-44 + b * 4, -42 - Math.max(0, b) * 6], [-18, -56], pc, 0.2, 0.9);
  ctx.restore();
}

function rrectPath(x: number, y: number, w: number, h: number): Path2D {
  const p = new Path2D();
  p.roundRect(x, y, w, h, 3);
  return p;
}

export { INK, GOLD };
