// Light and crowd layers drawn with Canvas 2D: the spotlight cone, glints,
// and the foreground audience of robot silhouettes whose eyes can wake in a
// wave. Everything takes world-unit inputs and draws into a DrawnLayer.

import { DrawnLayer } from './layers.ts';
import { lin, rad } from './ink.ts';

// Soft spotlight: a cone from the top of the frame to a pool on the floor.
// Layer covers the whole 16x9 frame (centre origin), additive.
export function drawSpot(layer: DrawnLayer, topX: number, poolX: number, poolY: number, poolW: number, level: number, warm = '255,214,140', clear = true): void {
  const { ctx, canvas, ppu } = layer;
  if (clear) ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (level <= 0.001) return;
  const px = (x: number) => (x + 8) * ppu;
  const py = (y: number) => (4.5 - y) * ppu;
  const top = py(4.6), bottom = py(poolY);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const cone = new Path2D();
  cone.moveTo(px(topX - 0.35), top);
  cone.lineTo(px(topX + 0.35), top);
  cone.lineTo(px(poolX + poolW * 0.5), bottom);
  cone.lineTo(px(poolX - poolW * 0.5), bottom);
  cone.closePath();
  ctx.fillStyle = lin(ctx, 0, top, 0, bottom, [[0, `rgba(${warm},${0.75 * level})`], [0.5, `rgba(${warm},${0.42 * level})`], [1, `rgba(${warm},${0.22 * level})`]]);
  ctx.filter = `blur(${Math.max(1, ppu * 0.03)}px)`;
  ctx.fill(cone);
  ctx.filter = 'none';
  // Floor pool.
  ctx.save();
  ctx.translate(px(poolX), bottom);
  ctx.scale(1, 0.22);
  ctx.fillStyle = rad(ctx, 0, 0, 0, poolW * 0.6 * ppu, [[0, `rgba(${warm},${0.55 * level})`], [1, `rgba(${warm},0)`]]);
  ctx.beginPath();
  ctx.arc(0, 0, poolW * 0.6 * ppu, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

// A bright four-point star glint at a world position (e.g. the orbit star).
export function drawGlint(layer: DrawnLayer, x: number, y: number, size: number, level: number): void {
  const { ctx, ppu } = layer;
  if (level <= 0.001) return;
  const cx = (x + 8) * ppu, cy = (4.5 - y) * ppu, r = size * ppu;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rad(ctx, cx, cy, 0, r, [[0, `rgba(255,248,214,${level})`], [0.2, `rgba(255,214,120,${0.6 * level})`], [1, 'rgba(255,200,90,0)']]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,244,200,${0.9 * level})`;
  ctx.lineCap = 'round';
  for (const [dx, dy, len] of [[1, 0, 1.6], [0, 1, 1.6], [0.7, 0.7, 0.7], [0.7, -0.7, 0.7]] as const) {
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(cx - dx * r * len, cy - dy * r * len);
    ctx.lineTo(cx + dx * r * len, cy + dy * r * len);
    ctx.stroke();
  }
  ctx.restore();
}

export interface CrowdState {
  eyes: number;        // 0..1 eyes lit
  wakeT: number;       // 0..1 progress of the wake wave (centre outward)
  bow: number;         // 0..1 heads dip together
  sway: number;        // seconds, for idle bob
  blink: number;       // 0..1 unison blink
  lookX: number;       // -1..1 head turn toward the action
}

// Foreground audience: three rows of robot heads in silhouette with a warm
// rim from the stage and two small glowing eyes each. Layer covers
// width x height world units; row 0 is the back row.
export function drawCrowd(layer: DrawnLayer, s: CrowdState): void {
  const { ctx, canvas, ppu } = layer;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const rows = [
    { y: 0.5, scale: 0.7, count: 22, shade: '#161a22' },
    { y: 0.74, scale: 0.95, count: 16, shade: '#0f1218' },
    { y: 1.02, scale: 1.3, count: 11, shade: '#08090d' },
  ];
  rows.forEach((row, r) => {
    const unit = ppu * row.scale;
    for (let i = 0; i < row.count; i += 1) {
      const seed = Math.sin(i * 12.9898 + r * 78.233) * 43758.5453;
      const rnd = seed - Math.floor(seed);
      const x = ((i + 0.5 + (r % 2) * 0.5) / row.count) * W + (rnd - 0.5) * unit * 0.3;
      const bob = Math.sin(s.sway * 1.3 + i * 1.7 + r) * unit * 0.015;
      const dip = s.bow * unit * 0.12;
      const y = H * row.y + bob + dip;
      const kind = Math.floor(rnd * 3);
      const hw = unit * (0.34 + rnd * 0.08), hh = unit * (0.42 + (kind === 1 ? 0.1 : 0));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s.lookX * 0.12 + (rnd - 0.5) * 0.08);
      // Shoulders.
      ctx.fillStyle = row.shade;
      ctx.beginPath();
      ctx.ellipse(0, hh * 1.25, hw * 1.6, hh * 0.7, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      // Head (dome, can or bulb) with a warm rim on top.
      const head = new Path2D();
      if (kind === 0) head.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
      else if (kind === 1) head.roundRect(-hw, -hh, hw * 2, hh * 2, hw * 0.6);
      else head.ellipse(0, -hh * 0.1, hw * 1.05, hh * 0.9, 0, 0, Math.PI * 2);
      ctx.fillStyle = row.shade;
      ctx.fill(head);
      ctx.save();
      ctx.clip(head);
      ctx.strokeStyle = `rgba(255,190,110,${0.5 - r * 0.1})`;
      ctx.lineWidth = Math.max(1, unit * 0.05);
      ctx.beginPath();
      ctx.ellipse(0, hh * 0.2, hw * 0.98, hh * 1.1, 0, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.restore();
      // Antenna.
      if (rnd > 0.25) {
        ctx.strokeStyle = row.shade;
        ctx.lineWidth = Math.max(1, unit * 0.04);
        ctx.beginPath();
        ctx.moveTo(0, -hh);
        ctx.lineTo(0, -hh - unit * 0.22);
        ctx.stroke();
        ctx.fillStyle = row.shade;
        ctx.beginPath();
        ctx.arc(0, -hh - unit * 0.25, unit * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
      // Eyes wake in a wave from the centre outward.
      const fromCentre = Math.abs(i / row.count - 0.5) * 2;
      const lit = Math.max(0, Math.min(1, (s.wakeT * 1.4 - fromCentre * 0.9 - r * 0.1) * 3)) * s.eyes;
      if (lit > 0.01) {
        const open = Math.max(0.12, 1 - s.blink);
        ctx.save();
        ctx.shadowColor = '#7dffd0';
        ctx.shadowBlur = unit * 0.25 * lit;
        ctx.fillStyle = `rgba(150,255,215,${lit})`;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(side * hw * 0.38, -hh * 0.05, hw * 0.13, hh * 0.1 * open, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.restore();
    }
  });
  layer.update();
}

export interface Hole {
  x: number;
  y: number;
  rx: number;
  ry: number;
  a?: number;
}

// Theatre "focus" shade: darkens the whole set by `amount` except soft
// elliptical holes (lit areas), then lays a black fade on top.
// Layer covers the 16x9 frame (centre origin), normal blending.
export function drawShade(layer: DrawnLayer, amount: number, holes: readonly Hole[], black: number): void {
  const { ctx, canvas, ppu } = layer;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (amount > 0.002) {
    ctx.fillStyle = `rgba(6,4,14,${amount})`;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (const h of holes) {
      ctx.save();
      ctx.translate((h.x + 8) * ppu, (4.5 - h.y) * ppu);
      ctx.scale(1, h.ry / h.rx);
      const r = h.rx * ppu;
      ctx.fillStyle = rad(ctx, 0, 0, 0, r, [[0, `rgba(0,0,0,${h.a ?? 1})`], [0.55, `rgba(0,0,0,${0.9 * (h.a ?? 1)})`], [1, 'rgba(0,0,0,0)']]);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  if (black > 0.002) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, black)})`;
    ctx.fillRect(0, 0, W, H);
  }
  layer.update();
}

// Big warm bloom used for the star-flash transition (additive, world space).
export function drawFlash(layer: DrawnLayer, x: number, y: number, radius: number, level: number): void {
  if (level <= 0.002) return;
  const { ctx, ppu } = layer;
  const cx = (x + 8) * ppu, cy = (4.5 - y) * ppu, r = radius * ppu;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rad(ctx, cx, cy, 0, r, [[0, `rgba(255,250,230,${level})`], [0.35, `rgba(255,220,150,${0.75 * level})`], [1, 'rgba(255,190,90,0)']]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Pulsing red/blue markers on the verse plate's war-table hologram.
export function drawTableGlow(layer: DrawnLayer, t: number, level: number): void {
  if (level <= 0.002) return;
  const { ctx, ppu } = layer;
  const marks: readonly (readonly [number, number, string])[] = [
    [5.86, -0.15, '255,70,70'], [6.48, -0.27, '255,70,70'], [6.98, -0.12, '255,70,70'], [6.4, 0.05, '255,90,90'],
    [5.62, 0.05, '90,170,255'], [6.25, 0.28, '90,170,255'], [7.3, 0.22, '90,170,255'],
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  marks.forEach(([x, y, c], i) => {
    const pulse = 0.55 + 0.45 * Math.sin(t * 5 + i * 1.3);
    const cx = (x + 8) * ppu, cy = (4.5 - y) * ppu, r = 0.22 * ppu;
    ctx.fillStyle = rad(ctx, cx, cy, 0, r, [[0, `rgba(${c},${0.9 * level * pulse})`], [1, `rgba(${c},0)`]]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}
