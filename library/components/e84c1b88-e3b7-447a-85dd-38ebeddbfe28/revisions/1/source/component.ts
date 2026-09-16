import { defineComponent } from '@lux/visual-sdk';
import {
  Scene, Color, Group, Mesh, MeshBasicNodeMaterial,
  OrthographicCamera, PlaneGeometry, AdditiveBlending,
} from 'three/webgpu';

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'lights/sweeping-beams',
    label: 'Colorful Sweeping Beams',
    description: 'Fifty layered colorful beams with sweeping, pulsing motion.',
    tags: ['beams', 'lights'],
    inputs: {},
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'The sweeping beam formation.',
      },
    },
    controls: {
      palette: {
        type: 'number', label: 'Palette: 0 Fire / 1 Sunset / 2 Acid / 3 Rainbow', default: 0,
        min: 0, max: 3, step: 1,
      },
      hueShift: {
        type: 'number', label: 'Palette hue shift', default: 0,
        min: 0, max: 1, step: 0.01,
      },
      paletteSpread: {
        type: 'number', label: 'Palette spread', default: 1,
        min: 0, max: 2, step: 0.01,
      },
      colorCycleSpeed: {
        type: 'number', label: 'Palette cycle speed', default: 0,
        min: 0, max: 0.5, step: 0.005,
      },
      beamHueOffset: {
        type: 'number', label: 'Beam hue offset', default: 0,
        min: -0.5, max: 0.5, step: 0.01,
      },
      beamSaturation: {
        type: 'number', label: 'Beam saturation', default: 1,
        min: 0, max: 1, step: 0.01,
      },
      backgroundBrightness: {
        type: 'number', label: 'Background brightness', default: 0.15,
        min: 0, max: 1, step: 0.01,
      },
      beamWidth: {
        type: 'number', label: 'Beam width', default: 1,
        min: 0.1, max: 5, step: 0.01,
      },
      beamLength: {
        type: 'number', label: 'Beam length', default: 5.5,
        min: 0.5, max: 12, step: 0.1,
      },
      beamSweepSpeed: {
        type: 'number', label: 'Beam sweep speed', default: 0.65,
        min: 0, max: 4, step: 0.01,
      },
      beamSweepAngle: {
        type: 'number', label: 'Beam sweep angle', default: 0.65,
        min: 0, max: 1.5, step: 0.01,
      },
      beamPulseDepth: {
        type: 'number', label: 'Beam pulse strength', default: 0.6,
        min: 0, max: 1, step: 0.01,
      },
      beamBrightness: { type: 'number', label: 'Beam brightness', default: 0.7, min: 0, max: 1, step: 0.01 },
      danceSpeed: { type: 'number', label: 'Pulse / sway speed', default: 1.2, min: 0, max: 3, step: 0.01 },
      dabDepth: { type: 'number', label: 'Emitter sway depth', default: 1, min: 0, max: 1.4, step: 0.01 },
    },
    controlDescriptions: {
      palette: 'Select Fire, Sunset, Acid neon, or full Rainbow.',
      hueShift: 'Rotate all beam hues.',
      paletteSpread: 'Palette width. Zero gives one hue.',
      colorCycleSpeed: 'Hue cycles per second. Zero keeps colors fixed.',
      beamHueOffset: 'Shift beams relative to the palette.',
      beamSaturation: 'Separate beam saturation.',
      backgroundBrightness: 'Warm background level. Zero is black.',
      beamWidth: 'Width multiplier for the beam core and glow.',
      beamLength: 'Length of each beam from its beacon.',
      beamSweepSpeed: 'Sweep speed. Zero holds the sweep still.',
      beamSweepAngle: 'Maximum side-to-side sweep in radians.',
      beamPulseDepth: 'Zero gives steady brightness; one pulses down to black.',
      beamBrightness: 'Brightness of the sweeping rainbow beams.',
      danceSpeed: 'Speed of the repeating dance.',
      dabDepth: 'Strength of the emitter tilt.',
    },
    lifecycle: { state: 'stateless', reset: 'seed' },
  },
  async create(context) {
    const scene = new Scene();
    scene.background = new Color(0x080b22);
    const aspect = context.settings.width / context.settings.height;
    const camera = new OrthographicCamera(-9 * aspect, 9 * aspect, 9, -9, 0.1, 100);
    camera.position.set(0, 0, 30);
    // Each beacon emits a layered colorful beam that follows its head.
    const beamGeometry = new PlaneGeometry(1, 1);
    beamGeometry.translate(0, 0.5, 0);
    const beams: { root: Group; materials: MeshBasicNodeMaterial[] }[] = [];
    for (let i = 0; i < 50; i++) {
      const root = new Group();
      root.position.set(0, 0.91, -0.08);
      const materials: MeshBasicNodeMaterial[] = [];
      for (let layer = 0; layer < 3; layer++) {
        const material = new MeshBasicNodeMaterial({
          color: new Color().setHSL((i % 10) / 10, 1, 0.55),
          transparent: true,
          opacity: 0.2,
          blending: AdditiveBlending,
          depthWrite: false,
        });
        const beam = new Mesh(beamGeometry, material);
        beam.scale.set([0.055, 0.18, 0.42][layer], 5.5, 1);
        root.add(beam);
        materials.push(material);
      }
      beams.push({ root, materials });
    }
    const dancers: { root: Group; head: Group }[] = [];
    for (let i = 0; i < 50; i++) {
      const root = new Group();
      root.position.set((i % 10 - 4.5) * 3.05, (2 - Math.floor(i / 10)) * 3.35 - 1.05, 0);
      scene.add(root);
      const head = new Group();
      head.position.y = 1.88;
      root.add(head);
      head.add(beams[i].root);
      dancers.push({ root, head });
    }
    return {
      update(frame) {
        const time = frame.timeSeconds * frame.controls.danceSpeed * 3;
        const c = frame.controls;
        const preset = Math.round(c.palette);
        const startHue = [0.005, 0.92, 0.18, 0][preset];
        const hueWidth = [0.12, 0.22, 0.65, 0.85][preset] * c.paletteSpread;
        const cycle = frame.timeSeconds * c.colorCycleSpeed;
        const wrapHue = (hue: number) => ((hue % 1) + 1) % 1;
        const baseHue = startHue + c.hueShift + cycle;
        scene.background = new Color().setRGB(
          c.backgroundBrightness * 0.02,
          c.backgroundBrightness * 0.001,
          c.backgroundBrightness * 0.003,
        );
        for (let i = 0; i < beams.length; i++) {
          const beam = beams[i];
          beam.root.rotation.z = Math.sin(frame.timeSeconds * c.beamSweepSpeed + i * 0.3) * c.beamSweepAngle;
          beam.root.scale.set(c.beamWidth, c.beamLength / 5.5, 1);
          const pulse = 1 - c.beamPulseDepth * 0.5 + c.beamPulseDepth * 0.5 * Math.sin(time + i * 0.5);
          for (let layer = 0; layer < beam.materials.length; layer++) {
            beam.materials[layer].color.setHSL(
              wrapHue(baseHue + (i % 10) / 9 * hueWidth + c.beamHueOffset),
              c.beamSaturation,
              0.5,
            );
            beam.materials[layer].opacity = frame.controls.beamBrightness
              * pulse * [0.8, 0.16, 0.045][layer];
          }
        }
        for (let i = 0; i < dancers.length; i++) {
          const dancer = dancers[i];
          const pulse = (0.5 + 0.5 * Math.sin(time - (i % 10) * 0.28 - Math.floor(i / 10) * 0.4));
          const dab = (0.35 + 0.65 * pulse) * frame.controls.dabDepth;
          dancer.root.rotation.z = 0.08 * Math.sin(time - i * 0.15) - dab * 0.1;
          dancer.head.rotation.z = dab * 0.38;
          dancer.head.rotation.x = dab * 0.18;
        }
      },
      async evaluate(_inputs, evaluation) {
        return { image: await evaluation.render(scene, camera) };
      },
      reset(_seed) {},
      dispose() {
        beamGeometry.dispose();
        for (const beam of beams) {
          for (const material of beam.materials) material.dispose();
        }
      },
    };
  },
});
