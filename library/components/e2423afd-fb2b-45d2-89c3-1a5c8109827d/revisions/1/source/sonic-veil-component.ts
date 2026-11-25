import { defineComponent } from '@lux/visual-sdk';
import { PerspectiveCamera, Scene } from 'three/webgpu';
import { createSpectralWaves } from './spectral-waves.ts';

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'audio/sonic-veil',
    label: 'Sonic Veil',
    description: 'Three translucent, glowing sine ribbons driven by independent bass, mids and highs controls. Transparent image output for layering behind a subject.',
    tags: ['audio', 'spectrum', 'ribbons'],
    inputs: {},
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Veil', description: 'Transparent spectral ribbon layer.',
      },
    },
    controls: {
      bassEnergy: { type: 'number', label: 'Bass energy', default: 0, min: 0, max: 1, step: 0.01 },
      midsEnergy: { type: 'number', label: 'Mids energy', default: 0, min: 0, max: 1, step: 0.01 },
      highsEnergy: { type: 'number', label: 'Highs energy', default: 0, min: 0, max: 1, step: 0.01 },
    },
    controlDescriptions: {
      bassEnergy: 'Bind to the connected primary audio bass band. Controls broad cyan swells.',
      midsEnergy: 'Bind to the connected primary audio mids band. Controls violet ribbon amplitude.',
      highsEnergy: 'Bind to the connected primary audio highs band. Controls fine warm ripples.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const scene = new Scene();
    const veil = createSpectralWaves();
    scene.add(veil.group);
    const camera = new PerspectiveCamera(38, context.settings.width / context.settings.height, 0.1, 30);
    camera.position.set(0, 0.15, 6.15);
    camera.lookAt(0, 0, 0);
    return {
      update(frame) {
        veil.update(frame.timeSeconds, frame.controls.bassEnergy, frame.controls.midsEnergy, frame.controls.highsEnergy);
      },
      async evaluate(_inputs, evaluation) {
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {
        veil.update(0, 0, 0, 0);
      },
      dispose() {
        veil.dispose();
      },
    };
  },
});
