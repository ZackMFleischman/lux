// "One More Dawn" – 2.5D painted-stage version.
// Painted set plates + Canvas-2D drawn characters with parametric faces +
// light/crowd layers, composed in an orthographic 16x9 world.

import { defineVisual } from '@lux/visual-sdk';
import { OrthographicCamera, Scene } from 'three/webgpu';
import { actor } from './lib/actor.ts';
import { drawAria, drawPianoAndPianist, Pose } from './lib/cast.ts';
import { faceFrom, mixFace, neutralFace } from './lib/face.ts';
import { drawCrowd, drawGlint, drawSpot } from './lib/fx.ts';
import { drawnLayer, plate } from './lib/layers.ts';

export default defineVisual({
  controls: {
    startAt: { type: 'number', label: 'Start at', default: 0, min: 0, max: 75, step: 0.1, unit: 's' },
  },
  async create(context) {
    const scene = new Scene();
    const aspect = context.settings.width / context.settings.height;
    const camera = new OrthographicCamera(-4.5 * aspect, 4.5 * aspect, 4.5, -4.5, -10, 10);
    const ppu = context.settings.height / 9;
    const img = context.images.get('assets/intro.jpg');
    if (!img) throw new Error('missing intro plate');
    const bg = plate(img, 16, 9);
    bg.mesh.renderOrder = 0;
    scene.add(bg.mesh);

    const spot = drawnLayer(16, 9, ppu, true);
    spot.mesh.renderOrder = 5;
    scene.add(spot.mesh);

    const pianist = actor(scene, ppu, { width: 5.6, height: 4.0, footX: 3.9, footY: 0.3, designPerUnit: 102, z: 10, reflection: 0.25 });
    pianist.place(-3.3, -1.7);
    const aria = actor(scene, ppu, { width: 6.0, height: 5.2, footX: 2.0, footY: 0.3, designPerUnit: 92, z: 20, reflection: 0.3 });
    aria.place(0.3, -1.75);

    const crowd = drawnLayer(17, 2.6, ppu);
    crowd.mesh.renderOrder = 40;
    crowd.mesh.position.set(0, -4.5 + 1.3, 0);
    scene.add(crowd.mesh);

    return {
      update(frame) {
        const t = frame.controls.startAt + frame.timeSeconds;
        const sing = 0.55 + 0.25 * Math.sin(t * 7);
        const pose: Pose = {
          x: 0, bob: Math.sin(t * 1.3) * 1.5, lean: -0.05, headTilt: -0.22, headTurn: 0.25,
          handL: [-6, -228], handR: [118, -350], elbowL: -14, elbowR: 10, fingersL: 0.3, fingersR: 0.8,
          face: { ...mixFace(neutralFace(), faceFrom('dreamy'), 1), eyeOpen: 0.08, mouthOpen: sing, mouthWide: 0.9, glow: 1.1 },
        };
        aria.draw(ctx => drawAria(ctx, pose, t));
        pianist.draw(ctx => drawPianoAndPianist(ctx, {
          headBob: Math.sin(t * 4) * 2, headTilt: 0.05, handPhase: t * 9, lookUp: 0,
          face: { ...faceFrom('warm'), eyeOpen: 0.55, lookX: -0.4 },
        }));
        drawSpot(spot, -1.2, 0.3, -1.75, 3.0, 1);
        drawGlint(spot, 4.18, 3.52, 0.5, 0.9 + Math.sin(t * 3) * 0.1);
        spot.update();
        drawCrowd(crowd, { eyes: 1, wakeT: 1, bow: 0, sway: t, blink: 0, lookX: 0 });
      },
      render(target) {
        return context.renderer.render(scene, camera, target);
      },
      reset() {},
      dispose() {
        bg.dispose();
        spot.dispose();
        pianist.dispose();
        aria.dispose();
        crowd.dispose();
      },
    };
  },
});
