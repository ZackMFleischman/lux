// Alcove vignettes for verse 1. Each draws one alcove's small figures in a
// shared design space (origin on the alcove floor, +y down) from song time.

import { drawChild, drawGeneral, drawGlobe, drawHelper, drawKing, mini } from './cast-verse.ts';
import { faceFrom } from './face.ts';
import type { Ctx } from './ink.ts';
import { kv } from './show.ts';
import { ramp } from './time.ts';

const sing = (t: number, a: number, b: number): number => (t > a && t < b ? 0.5 + 0.5 * Math.abs(Math.sin(t * 9)) : 0);

// Left room: a gold helper teaches three children to walk, dance and sing.
// Each verb gets a held, readable pose: a toddler's steps into the
// helper's arms, a pirouette with a tucked leg, then everyone sings.
export function drawFamily(ctx: Ctx, t: number): void {
  const walk = ramp(t, 44.6, 48.9);
  const dance = ramp(t, 49.0, 49.4) * (1 - ramp(t, 50.4, 50.8));
  const singing = t > 50.1 && t < 51.6 ? 0.6 + 0.4 * Math.abs(Math.sin(t * 7)) : 0;
  const notes = t > 50.1 && t < 52 ? (t - 50.1) * 0.9 : 0;
  const toddler = mini(10 + walk * 60, 0.82);
  toddler.step = t > 44.6 && t < 48.9 ? t * 7 : 0;
  toddler.bob = toddler.step ? -Math.abs(Math.sin(toddler.step)) * 3 : 0;
  toddler.armL = 1.5; toddler.armR = 1.5;
  toddler.mouth = singing; toddler.notes = notes;
  const dancer = mini(-125, 0.95);
  dancer.turn = dance > 0.01 ? (t - 49.0) * 6.3 : 0;
  dancer.tuck = dance;
  dancer.armL = 0.5 + dance * 2.6 + singing * 2;
  dancer.armR = 0.5 + dance * 1.2 + singing * 2;
  dancer.bob = -dance * 6;
  dancer.look = 0.5;
  dancer.mouth = singing; dancer.notes = notes;
  const boy = mini(-45, 1.0);
  const clap = t < 50.1 ? Math.max(0, Math.sin(t * 8)) * 0.35 : 0;
  boy.armL = 1.0 + clap + singing * 1.6;
  boy.armR = 1.0 + clap + singing * 1.6;
  boy.mouth = singing; boy.notes = notes;
  boy.look = 0.4;
  const helper = mini(150, 1.12);
  helper.bob = 25;
  helper.lean = -0.14;
  helper.armL = 1.5 - walk * 0.3;
  helper.armR = 0.6 + singing * 1.6;
  drawChild(ctx, dancer, '#f28cc0', '#8a3a1a');
  drawChild(ctx, boy, '#58b04a', '#2a1a10');
  drawHelper(ctx, helper, { ...faceFrom('warm'), lookX: -0.7, mouthOpen: singing * 0.6 });
  drawChild(ctx, toddler, '#f2d24a', '#4a2a14');
}

// Throne room: the king hands the world to a gold helper.
export function drawThrone(ctx: Ctx, t: number): void {
  const rise = ramp(t, 55.2, 56.0);
  const pass = ramp(t, 58.0, 59.6);
  const king = mini(70, 1.0);
  king.bob = 2 - rise * 6;
  king.armL = 0.6 + rise * 0.6 + pass * 0.5;
  king.armR = 0.6 + rise * 0.3;
  king.look = -1;
  const helper = mini(-34, 1.15);
  helper.bob = 18;
  helper.armL = 0.3 + pass * 1.0;
  helper.armR = 0.3 + pass * 1.6;
  const gx = 48 - pass * 66, gy = -78 + pass * 18 - Math.sin(pass * Math.PI) * 25;
  const globeOn = ramp(t, 54.8, 55.6);
  drawKing(ctx, king);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(helper.x, helper.bob, 24, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  drawHelper(ctx, helper, { ...faceFrom(pass > 0.5 ? 'wonder' : 'dutiful'), lookX: 0.6, lookY: -0.2 });
  if (globeOn > 0) drawGlobe(ctx, gx, gy, 13, t * 1.2, globeOn * (0.4 + pass * 0.6));
}

// War table: a general pleads; the helper studies the hologram.
export function drawWar(ctx: Ctx, t: number): void {
  const plead = ramp(t, 64.6, 65.4) * (1 - ramp(t, 68.6, 69.4));
  const general = mini(30, 1.05);
  general.armL = 0.4 + plead * (0.9 + Math.sin(t * 4) * 0.15);
  general.armR = 0.4 + plead * (1.3 + Math.sin(t * 4 + 1) * 0.15);
  general.mouth = plead * (0.5 + 0.5 * Math.sin(t * 11));
  general.look = 1;
  general.lean = plead * 0.08;
  const helper = mini(-60, 1.15);
  helper.armR = 0.4 + kv(t, [[65.0, 0], [66.0, 1.5], [68.6, 1.5], [69.4, 0.3]]);
  helper.armL = 0.3;
  helper.lean = 0.06 * plead;
  drawGeneral(ctx, general);
  drawHelper(ctx, helper, { ...faceFrom(plead > 0.5 ? 'stern' : 'dutiful'), lookX: 0.8, lookY: 0.4 });
}
