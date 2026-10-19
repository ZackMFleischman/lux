// Alcove vignettes for verse 1. Each draws one alcove's small figures in a
// shared design space (origin on the alcove floor, +y down) from song time.

import { drawChild, drawGeneral, drawGlobe, drawHelper, drawKing, mini } from './cast-verse.ts';
import { faceFrom } from './face.ts';
import type { Ctx } from './ink.ts';
import { kv } from './show.ts';
import { ramp } from './time.ts';

const sing = (t: number, a: number, b: number): number => (t > a && t < b ? 0.5 + 0.5 * Math.abs(Math.sin(t * 9)) : 0);

// Left room: a gold helper teaches three children to walk, dance and sing.
export function drawFamily(ctx: Ctx, t: number): void {
  const walk = ramp(t, 44.6, 49.0);
  const dance = ramp(t, 49.2, 49.8);
  const singing = Math.max(sing(t, 50.1, 51.2), sing(t, 44.5, 44.5));
  // Toddler walks toward the helper's open arms.
  const toddler = mini(-20 + walk * 70, 0.82);
  toddler.step = t < 49 && t > 44.6 ? t * 9 : 0;
  toddler.bob = toddler.step ? -Math.abs(Math.sin(toddler.step)) * 3 : 0;
  toddler.armL = 1.2; toddler.armR = 1.2;
  toddler.mouth = singing;
  // Dancer twirls on "dance" and keeps swaying.
  const dancer = mini(-170, 0.95);
  dancer.lean = dance * Math.sin(t * 6) * 0.18;
  dancer.armL = 0.6 + dance * (1.6 + Math.sin(t * 6) * 0.4);
  dancer.armR = 0.6 + dance * (1.6 - Math.sin(t * 6) * 0.4);
  dancer.bob = -dance * Math.abs(Math.sin(t * 6)) * 6;
  dancer.look = 0.5;
  dancer.mouth = singing;
  // Older child claps along, then sings with arms up.
  const boy = mini(-85, 1.0);
  boy.armL = 0.9 + Math.max(0, Math.sin(t * 8)) * 0.4 + singing * 1.2;
  boy.armR = 0.9 + Math.max(0, Math.sin(t * 8)) * 0.4 + singing * 1.2;
  boy.mouth = singing;
  boy.look = 0.4;
  const helper = mini(150, 1.12);
  helper.lean = -0.12;
  helper.armL = 1.3 - walk * 0.2;
  helper.armR = 0.5 + singing * 1.4;
  drawChild(ctx, dancer, '#f28cc0', '#8a3a1a');
  drawChild(ctx, boy, '#58b04a', '#2a1a10');
  drawHelper(ctx, helper, { ...faceFrom('warm'), lookX: -0.7, mouthOpen: singing * 0.6 });
  drawChild(ctx, toddler, '#f2d24a', '#4a2a14');
}

// Throne room: the king hands the world to a gold helper.
export function drawThrone(ctx: Ctx, t: number): void {
  const rise = ramp(t, 55.2, 56.0);
  const pass = ramp(t, 58.0, 59.6);
  const king = mini(-22, 1.0);
  king.bob = -40 - rise * 8;
  king.armL = 0.6 + rise * 0.5 + (1 - pass) * 0.6;
  king.armR = 0.6 + rise * 0.4 + pass * 0.6;
  king.look = 1;
  const helper = mini(70, 1.15);
  helper.armL = 0.3 + pass * 1.0;
  helper.armR = 0.3 + pass * 1.6;
  const gx = -2 + pass * 66, gy = -138 + pass * 38 - Math.sin(pass * Math.PI) * 30;
  const globeOn = ramp(t, 54.8, 55.6);
  drawKing(ctx, king);
  drawHelper(ctx, helper, { ...faceFrom(pass > 0.5 ? 'wonder' : 'dutiful'), lookX: -0.6, lookY: -0.2 });
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
  const helper = mini(-42, 1.15);
  helper.armR = 0.4 + kv(t, [[65.0, 0], [66.0, 1.5], [68.6, 1.5], [69.4, 0.3]]);
  helper.armL = 0.3;
  helper.lean = 0.06 * plead;
  drawGeneral(ctx, general);
  drawHelper(ctx, helper, { ...faceFrom(plead > 0.5 ? 'stern' : 'dutiful'), lookX: 0.8, lookY: 0.4 });
}
