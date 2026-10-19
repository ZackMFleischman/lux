// Verse cast: Barnaby (original bronze baritone) and the small vignette
// figures for the alcove scenes. Same pose/face contracts as cast.ts.

import { arm, ariaFaceStyle, GOLD, P2, Pose } from './cast.ts';
import { drawFace, Face, FaceStyle } from './face.ts';
import { Ctx, ellipse, lin, paint, rad, smooth, tube, within } from './ink.ts';

const BRONZE = { base: '#d08a3c', light: '#ffd98a', shade: '#8a4f1c', deep: '#5c3210' };

export const barnabyFaceStyle: FaceStyle = {
  skin: BRONZE.base, skinShade: BRONZE.shade, skinLight: BRONZE.light,
  visor: '#11161c', eye: '#a6ffb8', brow: '#c9ccd6', lips: '#5a2a1a', mouth: '#2a0c0c', moustache: '#d8dbe4',
};

export function drawBarnaby(ctx: Ctx, p: Pose): void {
  ctx.save();
  ctx.translate(p.x, p.bob);
  for (const side of [-1, 1]) {
    tube(ctx, [side * 12, -150], [side * 16, -80], [side * 18, -8], 22, '#3a2622', '#5a3c34', '#1e1210', 2.6);
    paint(ctx, ellipse(side * 22, -4, 22, 8), lin(ctx, 0, -12, 0, 4, [[0, '#2a2a30'], [1, '#08080a']]), 2.4);
  }
  ctx.save();
  ctx.translate(0, -150);
  ctx.rotate(p.lean);
  ctx.translate(0, 150);
  // Tailcoat tails.
  paint(ctx, smooth([[-34, -170], [-40, -110], [-30, -70], [-10, -96], [10, -96], [30, -70], [40, -110], [34, -170]]), lin(ctx, 0, -170, 0, -70, [[0, '#8a2232'], [1, '#4a0f18']]), 2.6);
  // Gold waistcoat, shirt front and buttons.
  const torso = smooth([[-30, -150], [-34, -200], [-28, -248], [0, -256], [28, -248], [34, -200], [30, -150], [0, -146]]);
  paint(ctx, torso, lin(ctx, -30, -250, 30, -150, [[0, '#f2c860'], [1, '#a8741c']]), 2.6);
  paint(ctx, smooth([[-8, -250], [8, -250], [6, -200], [0, -190], [-6, -200]]), '#f6f1e6', 1.8);
  for (let i = 0; i < 3; i += 1) paint(ctx, ellipse(0, -186 + i * 12, 2.6, 2.6), '#4a3010', 1);
  // Burgundy coat lapels.
  for (const side of [-1, 1]) {
    paint(ctx, smooth([[side * 8, -252], [side * 34, -246], [side * 36, -170], [side * 26, -150], [side * 16, -200]]), lin(ctx, 0, -250, 0, -150, [[0, '#a82c3e'], [1, '#5c1420']]), 2.4);
  }
  paint(ctx, smooth([[0, -248], [-14, -256], [-14, -240]]), '#1a0c10', 1.8);
  paint(ctx, smooth([[0, -248], [14, -256], [14, -240]]), '#1a0c10', 1.8);
  paint(ctx, ellipse(0, -264, 10, 12), lin(ctx, -10, 0, 10, 0, [[0, BRONZE.shade], [0.5, BRONZE.base], [1, BRONZE.light]]), 2.2);
  const shoulderL: P2 = [-32, -240], shoulderR: P2 = [32, -240];
  arm(ctx, shoulderL, p.handL, p.elbowL, -1, BRONZE, 13, p.fingersL);
  // Head with swept silver hair.
  ctx.save();
  ctx.translate(0, -300);
  ctx.rotate(p.headTilt);
  const head = smooth([[-38, -30], [-40, 10], [-30, 40], [0, 50], [30, 40], [40, 10], [38, -30], [0, -40]]);
  paint(ctx, head, rad(ctx, -12, -14, 4, 60, [[0, BRONZE.light], [0.5, BRONZE.base], [1, BRONZE.shade]]), 2.8);
  within(ctx, head, () => {
    ctx.fillStyle = 'rgba(92,50,16,0.35)';
    ctx.beginPath();
    ctx.ellipse(28, 10, 24, 50, 0.15, 0, Math.PI * 2);
    ctx.fill();
  });
  const hair = smooth([[-42, -16], [-46, -48], [-26, -72], [10, -76], [44, -62], [50, -36], [36, -30], [10, -48], [-20, -40]]);
  paint(ctx, hair, lin(ctx, -40, -76, 40, -20, [[0, '#ffffff'], [0.5, '#c8ccd8'], [1, '#7c8294']]), 2.6);
  ctx.strokeStyle = 'rgba(110,116,134,0.8)';
  ctx.lineWidth = 2;
  for (const [a, b] of [[-28, -54], [-6, -62], [18, -60]] as const) {
    ctx.beginPath();
    ctx.moveTo(a, b + 14);
    ctx.quadraticCurveTo(a + 12, b, a + 30, b + 4);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(p.headTurn * 8, 4);
  ctx.scale(0.8, 0.8);
  drawFace(ctx, p.face, barnabyFaceStyle, { visorY: -8, mouthY: 34 });
  ctx.restore();
  ctx.restore();
  arm(ctx, shoulderR, p.handR, p.elbowR, 1, BRONZE, 13, p.fingersR);
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
