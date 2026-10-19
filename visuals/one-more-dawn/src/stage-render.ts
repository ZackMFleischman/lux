// The stage, cast and cue sheet. Renders the flat-shaded colour image and
// a matching line buffer; the ink component turns those into the final
// cartoon frame.

import { defineComponent } from '@lux/visual-sdk';
import { Color, PerspectiveCamera, Scene } from 'three/webgpu';
import { InkBuffer } from './engine/inkbuffer.ts';
import { makeAria, makeBarnaby, makeGuard, makeKid, makeKing } from './lib/cast.ts';
import { Chain, DAIS, buildGlobe, buildThrone } from './lib/props.ts';
import { disposeRig } from './lib/rig.ts';
import { disposeShapes } from './lib/shapes.ts';
import { runShow, type Cast } from './lib/show.ts';
import { CLIP_END } from './lib/song.ts';
import { buildStage, contactShadow, set } from './lib/stage.ts';
import { light } from './lib/toon.ts';


export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'one-more-dawn/stage',
    label: 'One More Dawn stage',
    description: 'Retro-future Broadway stage with an original robot company, driven by song time.',
    tags: ['stage', 'cartoon', 'music-video'],
    inputs: {},
    outputs: {
      color: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Colour', description: 'Flat cel-shaded stage colour.' },
      lines: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Line buffer', description: 'View normal (rg) and line ID (b) for the ink pass.' },
    },
    controls: {
      startAt: { type: 'number', label: 'Start at', default: 0, min: 0, max: 72, step: 0.1, unit: 's', group: 'Timeline' },
      loop: { type: 'boolean', label: 'Loop clip', default: true, group: 'Timeline' },
      haze: { type: 'number', label: 'Stage haze', default: 0.6, min: 0, max: 2, step: 0.01, group: 'Look' },
    },
    controlDescriptions: {
      startAt: 'Song time shown when playback starts. Match the soundtrack offset to stay in sync.',
      loop: 'Restart from the top after the final tableau (1:12.5). Otherwise hold the last pose.',
      haze: 'Visibility of the spotlight beams.',
    },
    lifecycle: { state: 'stateless', reset: 'seed' },
  },
  async create(context) {
    const scene = new Scene();
    scene.background = new Color(0, 0, 0);
    const camera = new PerspectiveCamera(38, context.settings.width / context.settings.height, 0.1, 200);

    const stage = buildStage();
    scene.add(stage.root);
    const aria = makeAria();
    const barnaby = makeBarnaby();
    const pip = makeKid('pip');
    const dot = makeKid('dot');
    const king = makeKing();
    const guards: [ReturnType<typeof makeGuard>, ReturnType<typeof makeGuard>] = [makeGuard(0), makeGuard(1)];
    const throne = buildThrone();
    stage.lift.add(throne);
    king.root.position.set(0, DAIS, 0.1);
    stage.lift.add(king.root);
    const globe = buildGlobe();
    const chain = new Chain(24);
    scene.add(aria.root, barnaby.root, pip.root, dot.root, guards[0].root, guards[1].root, globe.group, chain.group);

    const shadows = [
      { rig: aria, mesh: contactShadow(1.5, 1.2) },
      { rig: barnaby, mesh: contactShadow(1.3, 0.9) },
      { rig: pip, mesh: contactShadow(0.7, 0.5) },
      { rig: dot, mesh: contactShadow(0.7, 0.5) },
      { rig: guards[0], mesh: contactShadow(0.9, 0.7) },
      { rig: guards[1], mesh: contactShadow(0.9, 0.7) },
    ];
    for (const s of shadows) {
      s.mesh.userData.line = 'none';
      scene.add(s.mesh);
    }

    // Line classes: performers and props get full ink, the set thin lines.
    const ink = new InkBuffer();
    for (const b of stage.beams) {
      b.userData.line = 'none';
    }
    for (const figure of [aria.root, barnaby.root, pip.root, dot.root, king.root, guards[0].root, guards[1].root, globe.group, chain.group, throne]) {
      ink.register(figure, 'figure');
    }
    ink.register(scene, 'set');

    const cast: Cast = { aria, barnaby, pip, dot, king, guards, throne, globe, chain, lift: stage.lift, pedestal: stage.pedestal };

    return {
      update(frame) {
        const raw = frame.controls.startAt + frame.timeSeconds;
        const t = frame.controls.loop ? raw % CLIP_END : Math.min(raw, CLIP_END);
        runShow(t, cast, camera);
        for (const s of shadows) {
          s.mesh.visible = s.rig.root.visible;
          s.mesh.position.set(s.rig.root.position.x, 0.012, s.rig.root.position.z);
          const lift = Math.max(0, s.rig.hips.position.y - s.rig.hipHeight);
          s.mesh.scale.setScalar(1 - Math.min(0.4, lift * 0.8));
        }
        set.hazeLevel.value = frame.controls.haze;
        stage.update(t);
        // Fade from black at the top and to black after the final tableau.
        const fade = Math.min(1, t / 0.6) * (frame.controls.loop ? Math.min(1, (CLIP_END - t) / 0.7) : 1);
        light.key.value.multiplyScalar(fade);
        light.fill.value.multiplyScalar(fade);
        set.footLevel.value *= fade;
        set.marqueeLevel.value *= fade;
        set.neonLevel.value *= fade;
        set.wallLevel.value *= fade;
        set.wallEyeLevel.value *= fade;
        set.starLevel.value *= fade;
        for (const spot of light.spots) {
          spot.shape.value.w *= fade;
        }
      },
      async evaluate(_inputs, evaluation) {
        const color = await evaluation.render(scene, camera, 'color');
        ink.toData();
        const lines = await evaluation.render(scene, camera, 'lines');
        ink.toColor();
        return { color, lines };
      },
      reset() {},
      dispose() {
        ink.dispose();
        stage.dispose();
        for (const rig of [aria, barnaby, pip, dot, king, guards[0], guards[1]]) {
          disposeRig(rig);
        }
        disposeShapes();
        scene.traverse(object => {
          const material = (object as { material?: { dispose(): void } }).material;
          material?.dispose();
        });
      },
    };
  },
});
