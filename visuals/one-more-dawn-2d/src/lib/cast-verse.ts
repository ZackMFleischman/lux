// Verse cast: Barnaby (original bronze baritone) and the small vignette
// figures for the alcove scenes. Same pose/face contracts as cast.ts.

import { ariaFaceStyle, GOLD, hand, P2, Pose } from './cast.ts';
export type { P2 };
import { drawFace, Face, FaceStyle } from './face.ts';
import { Ctx, ellipse, lin, paint, rad, rrect, smooth, tube, within } from './ink.ts';

const BRONZE = { base: '#d08a3c', light: '#ffd98a', shade: '#8a4f1c', deep: '#5c3210' };

export const barnabyFaceStyle: FaceStyle = {
  skin: BRONZE.base, skinShade: BRONZE.shade, skinLight: BRONZE.light,
  visor: '#11161c', eye: '#a6ffb8', brow: '#c9ccd6', lips: '#5a2a1a', mouth: '#2a0c0c', moustache: '#d8dbe4',
};

const COAT = { base: '#9a2436', light: '#d0566a', shade: '#5a1220', deep: '#3a0a14' };

function sleeve(ctx: Ctx, shoulder: P2, handAt: P2, elbow: number, side: number, spread: number): void {
  const mid: P2 = [(shoulder[0] + handAt[0]) / 2 + side * elbow, (shoulder[1] + handAt[1]) / 2 + Math.abs(elbow) * 0.35];
  const wrist: P2 = [mid[0] + (handAt[0] - mid[0]) * 0.8, mid[1] + (handAt[1] - mid[1]) * 0.8];
  tube(ctx, shoulder, mid, wrist, 17, COAT.base, COAT.light, COAT.shade, 2.4);
  const ang = Math.atan2(wrist[1] - mid[1], wrist[0] - mid[0]);
  paint(ctx, ellipse(wrist[0], wrist[1], 5, 9, ang), '#f6f1e6', 1.8);
  hand(ctx, handAt, wrist, BRONZE, spread, 1.15);
}

export function drawBarnaby(ctx: Ctx, p: Pose): void {
  ctx.save();
  ctx.translate(p.x, p.bob);
  // Trousers and shoes.
  for (const side of [-1, 1]) {
    tube(ctx, [side * 16, -150], [side * 18, -78], [side * 20, -10], 27, '#40282a', '#6a4640', '#22141a', 2.6);
    paint(ctx, smooth([[side * 20 - 16, -12], [side * 20 + side * 28, -10], [side * 20 + side * 30, 0], [side * 20 - 16, 0]]), lin(ctx, 0, -14, 0, 2, [[0, '#3a3a44'], [1, '#08080a']]), 2.4);
  }
  ctx.save();
  ctx.translate(0, -150);
  ctx.rotate(p.lean);
  ctx.translate(0, 150);
  // Tailcoat tails behind the legs.
  for (const side of [-1, 1]) {
    paint(ctx, smooth([[side * 30, -176], [side * 50, -120], [side * 46, -70], [side * 36, -78], [side * 30, -130], [side * 22, -160]]), lin(ctx, 0, -176, 0, -70, [[0, COAT.shade], [1, COAT.deep]]), 2.4);
  }
  // Jacket body with broad shoulders.
  const jacket = smooth([[-54, -250], [-48, -200], [-40, -156], [-24, -146], [24, -146], [40, -156], [48, -200], [54, -250], [24, -264], [-24, -264]]);
  paint(ctx, jacket, lin(ctx, -50, -260, 50, -150, [[0, COAT.light], [0.35, COAT.base], [1, COAT.shade]]), 2.8);
  // Gold waistcoat in the V, white shirt, buttons.
  paint(ctx, smooth([[-22, -252], [22, -252], [24, -176], [0, -148], [-24, -176]]), lin(ctx, -22, -250, 22, -150, [[0, '#ffe08a'], [0.5, '#e2ae3c'], [1, '#a8741c']]), 2.2);
  paint(ctx, smooth([[-13, -258], [13, -258], [0, -214]]), '#f8f4ec', 1.8);
  for (let i = 0; i < 3; i += 1) paint(ctx, ellipse(0, -202 + i * 15, 3, 3), '#5a3a10', 1);
  // Lapels.
  for (const side of [-1, 1]) {
    paint(ctx, smooth([[side * 13, -260], [side * 30, -254], [side * 34, -226], [side * 24, -170], [side * 18, -214]]), lin(ctx, 0, -260, 0, -170, [[0, '#b83a4e'], [1, COAT.shade]]), 2.2);
  }
  // Bow tie.
  paint(ctx, smooth([[0, -254], [-16, -263], [-16, -244]]), '#16090c', 1.8);
  paint(ctx, smooth([[0, -254], [16, -263], [16, -244]]), '#16090c', 1.8);
  paint(ctx, ellipse(0, -254, 4, 4), '#2a1418', 1.4);
  // Neck.
  paint(ctx, rrect(-11, -282, 22, 22, 4), lin(ctx, -11, 0, 11, 0, [[0, BRONZE.shade], [0.5, BRONZE.base], [1, BRONZE.light]]), 2.2);
  const shoulderL: P2 = [-44, -244], shoulderR: P2 = [44, -244];
  sleeve(ctx, shoulderL, p.handL, p.elbowL, -1, p.fingersL);
  // Head: tall bronze robot head, ear bolts, swept silver pompadour.
  ctx.save();
  ctx.translate(0, -322);
  ctx.rotate(p.headTilt);
  for (const side of [-1, 1]) {
    paint(ctx, ellipse(side * 40, 4, 8, 12), lin(ctx, 0, -10, 0, 14, [[0, BRONZE.light], [1, BRONZE.shade]]), 2.2);
    tube(ctx, [side * 44, -4], [side * 50, -20], [side * 52, -34], 3, '#c9ccd6', '#ffffff', '#7c8294', 1.4);
    paint(ctx, ellipse(side * 52, -36, 4, 4), '#e8eaf0', 1.4);
  }
  const head = smooth([[-36, -30], [-38, 18], [-30, 46], [0, 56], [30, 46], [38, 18], [36, -30], [0, -40]]);
  paint(ctx, head, rad(ctx, -12, -14, 4, 64, [[0, BRONZE.light], [0.5, BRONZE.base], [1, BRONZE.shade]]), 2.8);
  within(ctx, head, () => {
    ctx.fillStyle = 'rgba(92,50,16,0.32)';
    ctx.beginPath();
    ctx.ellipse(30, 14, 22, 56, 0.12, 0, Math.PI * 2);
    ctx.fill();
  });
  const hair = smooth([[-37, -18], [-42, -42], [-30, -62], [-2, -72], [30, -70], [48, -56], [46, -38], [38, -28], [30, -42], [12, -48], [-8, -44], [-26, -34]]);
  paint(ctx, hair, lin(ctx, -40, -84, 40, -20, [[0, '#ffffff'], [0.45, '#d4d8e2'], [1, '#868c9e']]), 2.6);
  ctx.strokeStyle = 'rgba(110,116,134,0.85)';
  ctx.lineWidth = 2;
  for (const [x, y] of [[-30, -44], [-12, -56], [8, -60], [24, -58]] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y + 16);
    ctx.quadraticCurveTo(x + 8, y, x + 26, y + 2);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(p.headTurn * 8, 6);
  ctx.scale(0.76, 0.76);
  drawFace(ctx, p.face, barnabyFaceStyle, { visorY: -10, mouthY: 36 });
  ctx.restore();
  ctx.restore();
  sleeve(ctx, shoulderR, p.handR, p.elbowR, 1, p.fingersR);
  ctx.restore();
  ctx.restore();
}

export interface Mini {
  x: number;
  bob: number;
  lean: number;
  armL: number;   // radians from hanging down; + raises the arm
  armR: number;
  mouth: number;
  look: number;
  scale: number;
  step: number;   // walk cycle phase
}

export const mini = (x: number, scale = 1): Mini => ({ x, bob: 0, lean: 0, armL: 0.2, armR: 0.2, mouth: 0, look: 0, scale, step: 0 });

function miniArm(ctx: Ctx, sx: number, sy: number, angle: number, len: number, color: string, side: number): void {
  const ex = sx + Math.sin(angle) * len * side, ey = sy + Math.cos(angle) * len;
  tube(ctx, [sx, sy], [(sx + ex) / 2 + side * 3, (sy + ey) / 2], [ex, ey], 6, color, 'rgba(255,255,255,0.45)', 'rgba(0,0,0,0.25)', 1.6);
  paint(ctx, ellipse(ex, ey, 4, 4), color, 1.4);
}

// Cartoon child (original).
export function drawChild(ctx: Ctx, m: Mini, shirt: string, hair: string): void {
  ctx.save();
  ctx.translate(m.x, m.bob);
  ctx.scale(m.scale, m.scale);
  ctx.rotate(m.lean);
  const s = Math.sin(m.step);
  for (const side of [-1, 1]) tube(ctx, [side * 6, -40], [side * 7, -22], [side * 8 + s * 6 * side, -2], 7, '#3b4f8a', '#6d82c0', '#22305a', 1.6);
  paint(ctx, smooth([[-14, -40], [-15, -64], [0, -70], [15, -64], [14, -40], [0, -36]]), shirt, 2);
  miniArm(ctx, -13, -62, m.armL, 22, '#f2c39e', -1);
  miniArm(ctx, 13, -62, m.armR, 22, '#f2c39e', 1);
  paint(ctx, ellipse(0, -84, 15, 16), rad(ctx, -4, -90, 2, 20, [[0, '#ffe0c4'], [1, '#e2a47c']]), 2);
  paint(ctx, smooth([[-15, -88], [-14, -102], [0, -106], [14, -102], [15, -88], [6, -96], [-6, -96]]), hair, 1.8);
  for (const side of [-1, 1]) paint(ctx, ellipse(side * 5 + m.look * 2, -86, 2, 2.6), '#1a1210', 0);
  ctx.strokeStyle = '#5a2a20';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (m.mouth > 0.2) ctx.ellipse(m.look * 2, -77, 3.4, 2 + m.mouth * 3, 0, 0, Math.PI * 2);
  else ctx.arc(m.look * 2, -79, 4, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.restore();
}

// Small gold helper robot with a visor (original).
export function drawHelper(ctx: Ctx, m: Mini, face: Face): void {
  ctx.save();
  ctx.translate(m.x, m.bob);
  ctx.scale(m.scale, m.scale);
  ctx.rotate(m.lean);
  for (const side of [-1, 1]) tube(ctx, [side * 8, -50], [side * 9, -26], [side * 10, -2], 9, GOLD.base, GOLD.light, GOLD.shade, 1.8);
  paint(ctx, smooth([[-16, -50], [-18, -84], [0, -90], [18, -84], [16, -50], [0, -46]]), lin(ctx, -16, -90, 16, -46, [[0, GOLD.light], [1, GOLD.shade]]), 2);
  miniArm(ctx, -16, -82, m.armL, 26, GOLD.base, -1);
  miniArm(ctx, 16, -82, m.armR, 26, GOLD.base, 1);
  ctx.save();
  ctx.translate(0, -108);
  paint(ctx, ellipse(0, 0, 18, 19), rad(ctx, -5, -6, 2, 24, [[0, GOLD.light], [0.5, GOLD.base], [1, GOLD.shade]]), 2);
  ctx.scale(0.34, 0.34);
  drawFace(ctx, face, ariaFaceStyle, { visorY: -6, mouthY: 30 });
  ctx.restore();
  ctx.restore();
}

// Cartoon king (original): crown, red robe, white beard, seated.
export function drawKing(ctx: Ctx, m: Mini): void {
  ctx.save();
  ctx.translate(m.x, m.bob);
  ctx.scale(m.scale, m.scale);
  paint(ctx, smooth([[-30, 0], [-34, -60], [-22, -86], [0, -92], [22, -86], [34, -60], [30, 0]]), lin(ctx, -30, -90, 30, 0, [[0, '#d23040'], [1, '#7a1220']]), 2);
  paint(ctx, smooth([[-24, -84], [0, -78], [24, -84], [22, -74], [0, -70], [-22, -74]]), '#f6f2ea', 1.6);
  miniArm(ctx, -22, -76, m.armL, 30, '#f0c09a', -1);
  miniArm(ctx, 22, -76, m.armR, 30, '#f0c09a', 1);
  paint(ctx, ellipse(0, -104, 17, 18), rad(ctx, -4, -110, 2, 22, [[0, '#ffe0c4'], [1, '#d99a72']]), 2);
  paint(ctx, smooth([[-14, -96], [-12, -84], [0, -80], [12, -84], [14, -96], [0, -90]]), '#e8e2d8', 1.6);
  paint(ctx, smooth([[-16, -116], [-16, -132], [-8, -124], [0, -136], [8, -124], [16, -132], [16, -116]]), lin(ctx, 0, -136, 0, -116, [[0, '#ffe68a'], [1, '#c8901c']]), 1.8);
  for (const side of [-1, 1]) paint(ctx, ellipse(side * 5 + m.look * 2, -106, 2, 2.4), '#1a1210', 0);
  ctx.restore();
}

// Cartoon general (original): peaked cap, olive uniform, gold epaulettes.
export function drawGeneral(ctx: Ctx, m: Mini): void {
  ctx.save();
  ctx.translate(m.x, m.bob);
  ctx.scale(m.scale, m.scale);
  ctx.rotate(m.lean);
  for (const side of [-1, 1]) tube(ctx, [side * 9, -56], [side * 10, -30], [side * 11, -3], 11, '#3d4a2e', '#5f7046', '#232b1a', 1.8);
  for (const side of [-1, 1]) paint(ctx, ellipse(side * 12, -2, 10, 4), '#0c0c0e', 1.4);
  paint(ctx, smooth([[-22, -56], [-26, -96], [0, -104], [26, -96], [22, -56], [0, -52]]), lin(ctx, -22, -104, 22, -52, [[0, '#6f8050'], [1, '#2f3a22']]), 2);
  for (let i = 0; i < 3; i += 1) paint(ctx, rrect(-16, -92 + i * 6, 10, 4, 1), ['#d23a3a', '#3a7ad2', '#e8c040'][i], 0.8);
  for (const side of [-1, 1]) paint(ctx, ellipse(side * 22, -100, 8, 4), '#e8c040', 1.4);
  miniArm(ctx, -22, -98, m.armL, 34, '#4b5a36', -1);
  miniArm(ctx, 22, -98, m.armR, 34, '#4b5a36', 1);
  paint(ctx, ellipse(0, -120, 15, 17), rad(ctx, -4, -126, 2, 22, [[0, '#ffd8b8'], [1, '#d0906a']]), 2);
  paint(ctx, smooth([[-10, -112], [0, -116], [10, -112], [6, -108], [-6, -108]]), '#c8c8c8', 1.2);
  for (const side of [-1, 1]) {
    paint(ctx, ellipse(side * 5 + m.look * 2, -123, 1.8, 2.2), '#1a1210', 0);
    ctx.strokeStyle = '#6a6a6a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(side * 2 + m.look * 2, -129 - m.mouth);
    ctx.lineTo(side * 9 + m.look * 2, -127 + m.mouth * 2);
    ctx.stroke();
  }
  paint(ctx, smooth([[-18, -132], [-14, -146], [0, -150], [14, -146], [18, -132], [0, -134]]), '#3d4a2e', 1.8);
  paint(ctx, smooth([[-20, -132], [0, -128], [22, -132], [16, -128], [0, -125], [-16, -128]]), '#141414', 1.4);
  paint(ctx, ellipse(0, -141, 4, 3), '#e8c040', 1);
  ctx.restore();
}

// A small spinning Earth prop.
export function drawGlobe(ctx: Ctx, x: number, y: number, r: number, spin: number, glow: number): void {
  if (glow > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rad(ctx, x, y, r * 0.8, r * 2.6, [[0, `rgba(140,210,255,${0.55 * glow})`], [1, 'rgba(140,210,255,0)']]);
    ctx.beginPath();
    ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const ball = ellipse(x, y, r, r);
  paint(ctx, ball, rad(ctx, x - r * 0.3, y - r * 0.3, r * 0.1, r * 1.1, [[0, '#7fc8ff'], [0.6, '#2a6fd0'], [1, '#143a80']]), 2);
  within(ctx, ball, () => {
    ctx.fillStyle = '#4caa4a';
    for (let i = 0; i < 3; i += 1) {
      const a = spin + i * 2.1;
      const cx = x + Math.sin(a) * r * 0.7;
      if (Math.cos(a) < -0.2) continue;
      ctx.beginPath();
      ctx.ellipse(cx, y + (i - 1) * r * 0.45, r * 0.35 * Math.max(0.2, Math.cos(a)), r * 0.28, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// Glowing chain from a point to a floor anchor (links alternate facing).
export function drawChain(ctx: Ctx, from: P2, to: P2, sag: number, amount: number): void {
  if (amount <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, amount);
  const n = 12;
  for (let i = 0; i < n; i += 1) {
    const u = (i + 0.5) / n;
    const x = from[0] + (to[0] - from[0]) * u;
    const y = from[1] + (to[1] - from[1]) * u + Math.sin(u * Math.PI) * sag;
    const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
    ctx.shadowColor = 'rgba(120,200,255,0.9)';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = i % 2 ? '#cfd8e8' : '#8d98ac';
    ctx.lineWidth = i % 2 ? 2.4 : 3.2;
    ctx.beginPath();
    if (i % 2) ctx.ellipse(x, y, 7, 2.4, ang, 0, Math.PI * 2);
    else ctx.ellipse(x, y, 7, 4.6, ang, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
