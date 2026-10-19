// "One More Dawn" – 2.5D painted-stage version (0:00–1:12.5).
// Painted set plates + Canvas-2D drawn characters with parametric faces +
// light/crowd layers, composed in an orthographic 16x9 world. The staging
// lives in lib/show.ts as pure functions of song time.

import { defineVisual } from '@lux/visual-sdk';
import { OrthographicCamera, Scene } from 'three/webgpu';
import { actor } from './lib/actor.ts';
import { drawAria, drawPianoAndPianist } from './lib/cast.ts';
import { drawBarnaby, drawChain } from './lib/cast-verse.ts';
import { faceFrom } from './lib/face.ts';
import { drawCrowd, drawFlash, drawGlint, drawShade, drawSpot, drawTableGlow, Hole } from './lib/fx.ts';
import { drawnLayer, matte, plate } from './lib/layers.ts';
import {
  alcoveLight, ariaPlace, ariaPose, barnabyPose, barnabyRise, blackAt, camAt, chainAmount, crowdState, flashAt, introSpot, kv, PLATE_SWITCH, verseShade, verseSpot,
} from './lib/show.ts';
import { ramp } from './lib/time.ts';
import { drawFamily, drawThrone, drawWar } from './lib/vignettes.ts';

const STAR: readonly [number, number] = [3.88, 2.98];

export default defineVisual({
  controls: {
    startAt: { type: 'number', label: 'Start at', default: 0, min: 0, max: 75, step: 0.1, unit: 's' },
  },
  async create(context) {
    const scene = new Scene();
    const aspect = context.settings.width / context.settings.height;
    const camera = new OrthographicCamera(-4.5 * aspect, 4.5 * aspect, 4.5, -4.5, -10, 10);
    const ppu = context.settings.height / 9;

    const plateOf = (path: string, order: number) => {
      const img = context.images.get(path);
      if (!img) throw new Error(`missing plate ${path}`);
      const p = plate(img, 16, 9);
      p.mesh.renderOrder = order;
      scene.add(p.mesh);
      return p;
    };
    const introBg = plateOf('assets/intro.jpg', 0);
    const verseBg = plateOf('assets/verse.jpg', 1);

    const layer = (w: number, h: number, scale: number, order: number, additive = false, y = 0) => {
      const l = drawnLayer(w, h, ppu * scale, additive);
      l.mesh.renderOrder = order;
      l.mesh.position.y = y;
      scene.add(l.mesh);
      return l;
    };

    // Verse alcove vignettes (behind the leads).
    const family = actor(scene, ppu * 1.8, { width: 4.6, height: 2.2, footX: 2.3, footY: 0.1, designPerUnit: 100, z: 8, light: true });
    family.place(-5.95, 0.45);
    const throne = actor(scene, ppu * 1.8, { width: 2.8, height: 2.2, footX: 1.3, footY: 0.1, designPerUnit: 86, z: 8, light: true });
    throne.place(3.3, 0.12);
    const war = actor(scene, ppu * 1.8, { width: 2.8, height: 2.2, footX: 1.0, footY: 0.1, designPerUnit: 86, z: 8, light: true });
    war.place(6.53, -0.77);
    // The war table and right pillar are redrawn above the war vignette.
    const verseImg = context.images.get('assets/verse.jpg')!;
    const table = matte(verseImg, 16, 9, [[2220, 828], [2485, 722], [2720, 745], [2752, 745], [2752, 1000], [2220, 1000]]);
    table.mesh.renderOrder = 9;
    scene.add(table.mesh);

    const pianistIntro = actor(scene, ppu * 1.4, { width: 5.6, height: 4.0, footX: 3.9, footY: 0.3, designPerUnit: 102, z: 10, reflection: 0.25, shadow: 190, light: true });
    pianistIntro.place(-3.3, -1.7);
    const pianistVerse = actor(scene, ppu * 1.4, { width: 5.6, height: 4.0, footX: 3.9, footY: 0.3, designPerUnit: 102, z: 10, reflection: 0.2, shadow: 190, light: true });
    pianistVerse.place(-3.9, -2.1, 0.95);
    const aria = actor(scene, ppu * 2.6, { width: 6.0, height: 5.2, footX: 2.0, footY: 0.3, designPerUnit: 92, z: 20, reflection: 0.3, shadow: 130, light: true });
    const barnaby = actor(scene, ppu * 2.3, { width: 4.2, height: 4.8, footX: 2.1, footY: 0.3, designPerUnit: 92, z: 20, reflection: 0.3, shadow: 70, light: true });
    barnaby.place(-0.24, -2.0);

    const shade = layer(16, 9, 0.5, 30);
    const spot = layer(16, 9, 0.5, 35, true);
    const crowd = layer(17, 2.6, 1.3, 40, false, -4.5 + 1.3);
    const glow = layer(16, 9, 0.6, 45, true);
    const black = drawnLayer(16, 9, 1);
    black.ctx.fillStyle = '#000';
    black.ctx.fillRect(0, 0, black.canvas.width, black.canvas.height);
    black.update();
    black.mesh.renderOrder = 60;
    scene.add(black.mesh);

    return {
      update(frame) {
        const t = frame.controls.startAt + frame.timeSeconds;
        const verse = t >= PLATE_SWITCH;

        const cam = camAt(t);
        camera.zoom = cam.zoom;
        camera.position.set(cam.x, cam.y, 5);
        camera.updateProjectionMatrix();

        // Plates: the verse set is hidden under the star flash.
        introBg.mesh.visible = !verse;
        verseBg.mesh.visible = verse;

        // ---- intro cast
        pianistIntro.fade(verse ? 0 : 1);
        aria.fade(verse ? 0 : 1);
        if (!verse) {
          const place = ariaPlace(t);
          aria.place(place.x, place.y, place.scale);
          aria.draw(ctx => drawAria(ctx, ariaPose(t), t));
          const playing = t < 3.4 || (t > 31.1 && t < 33) || t > 40 ? 1 : 0.6;
          pianistIntro.draw(ctx => drawPianoAndPianist(ctx, {
            headBob: Math.sin(t * 4) * 2 * playing, headTilt: 0.05, handPhase: t * 9 * playing, lookUp: 0,
            face: { ...faceFrom('warm'), eyeOpen: 0.55, lookX: kv(t, [[0, -0.4], [5, -0.4], [6, 0.6], [9, 0.6], [10, -0.4], [27.5, -0.4], [28.5, 0.7], [40, 0.7]]) },
          }));
        }

        // ---- verse cast
        for (const a of [pianistVerse, barnaby, family, throne, war]) a.fade(verse ? 1 : 0);
        table.mesh.visible = verse;
        if (verse) {
          const bp = barnabyPose(t);
          const chain = chainAmount(t);
          const rise = barnabyRise(t);
          barnaby.draw(ctx => {
            ctx.save();
            if (rise < 1) {
              // Below the stage floor until the lift brings him up.
              ctx.beginPath();
              ctx.rect(-400, -700, 800, 700);
              ctx.clip();
              ctx.translate(0, (1 - rise) * 470);
            }
            if (chain > 0) {
              for (const side of [-1, 1]) {
                ctx.fillStyle = '#5c6474';
                ctx.strokeStyle = '#1b1410';
                ctx.lineWidth = 2.4;
                ctx.beginPath();
                ctx.ellipse(side * 78, -3, 13, 5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
              }
            }
            drawBarnaby(ctx, bp);
            if (chain > 0) {
              const pull = (hx: number, hy: number) => Math.max(4, 30 - Math.hypot(hx, hy + 3) * 0.08);
              drawChain(ctx, [bp.handL[0], bp.handL[1] + 6], [-78, -4], pull(bp.handL[0] + 78, bp.handL[1]), chain);
              drawChain(ctx, [bp.handR[0], bp.handR[1] + 6], [78, -4], pull(bp.handR[0] - 78, bp.handR[1]), chain);
            }
            ctx.restore();
          });
          pianistVerse.draw(ctx => drawPianoAndPianist(ctx, {
            headBob: Math.sin(t * 4) * 2, headTilt: 0.05, handPhase: t * 9, lookUp: 0,
            face: { ...faceFrom('warm'), eyeOpen: 0.55, lookX: 0.5 },
          }));
          family.draw(ctx => drawFamily(ctx, t));
          throne.draw(ctx => drawThrone(ctx, t));
          war.draw(ctx => drawWar(ctx, t));
        }

        // ---- light
        if (!verse) {
          const hush = kv(t, [[19.4, 0], [21.0, 0.4], [27.6, 0.4], [28.6, 0]]) + (1 - ramp(t, 1.0, 4.5)) * 0.3;
          const ap = ariaPlace(t);
          drawShade(shade, hush, [{ x: ap.x, y: ap.y + 1.6, rx: 2.0, ry: 3.0 }], 0);
          drawSpot(spot, -1.2, ap.x, ap.y, 3.0, introSpot(t));
          drawSpot(spot, -5.4, -5.7, -1.75, 2.6, 0.45 * ramp(t, 0.5, 2.5), '170,200,255', false);
        } else {
          const holes: Hole[] = [
            { x: -0.24, y: -0.1, rx: 1.7, ry: 2.6, a: ramp(t, 42.1, 42.7) },
            { x: -5.7, y: 1.25, rx: 2.6, ry: 1.9, a: alcoveLight(t, 0) },
            { x: 3.7, y: 0.95, rx: 1.9, ry: 1.7, a: alcoveLight(t, 1) },
            { x: 6.3, y: -0.05, rx: 2.0, ry: 1.4, a: alcoveLight(t, 2) },
            { x: -5.0, y: -1.0, rx: 1.8, ry: 1.2, a: 0.85 },
          ];
          drawShade(shade, verseShade(t), holes, 0);
          drawSpot(spot, -0.24, -0.24, -2.0, 2.8, verseSpot(t));
          drawSpot(spot, -6.0, -6.4, -2.1, 2.4, 0.4, '170,200,255', false);
        }
        spot.update();
        drawCrowd(crowd, crowdState(t));

        glow.ctx.clearRect(0, 0, glow.canvas.width, glow.canvas.height);
        if (!verse) {
          const star = 0.55 + 0.45 * ramp(t, 28.0, 30.0) + 0.5 * ramp(t, 33.0, 39.0);
          drawGlint(glow, STAR[0], STAR[1], 0.32 + 0.35 * ramp(t, 33, 40.3), star * (0.9 + Math.sin(t * 3) * 0.1));
        } else {
          drawTableGlow(glow, t, alcoveLight(t, 2) * 0.9);
        }
        const fl = flashAt(t);
        if (fl > 0) {
          const at = verse ? [cam.x, cam.y] : STAR;
          drawFlash(glow, at[0], at[1], 2.2 + 6 * fl, fl * 1.1);
          // Brief white-out at the peak hides the set change.
          const white = Math.pow(fl, 3) * 0.95;
          glow.ctx.fillStyle = `rgba(255,246,226,${white})`;
          glow.ctx.fillRect(0, 0, glow.canvas.width, glow.canvas.height);
        }
        glow.update();

        black.opacity.value = blackAt(t);
        black.mesh.visible = black.opacity.value > 0.002;
      },
      render(target) {
        return context.renderer.render(scene, camera, target);
      },
      reset() {},
      dispose() {
        for (const d of [introBg, verseBg, table, shade, spot, crowd, glow, black, pianistIntro, pianistVerse, aria, barnaby, family, throne, war]) d.dispose();
      },
    };
  },
});
