import { defineComponent } from '@lux/visual-sdk';
import {
  AdditiveBlending,
  Color,
  InstancedMesh,
  MeshBasicNodeMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
} from 'three/webgpu';
import { float, smoothstep, uniform, uv } from 'three/tsl';
import { createFlareRig } from './starfield-flare-rig.ts';

const ease = (value: number) => {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
};

const featureStarData = [
  [-0.23, 0.22, -1, 0.055, 0.62, '#d9eaff'],
  [0.35, 0.12, -1, 0.043, 0.42, '#fff0d7'],
  [-0.42, -0.18, -1, 0.035, 0.34, '#e4edff'],
  [0.08, 0.33, -1, 0.046, 0.48, '#eff5ff'],
  [0.28, -0.27, -1, 0.033, 0.36, '#ffe6ca'],
  [-0.07, -0.36, -1, 0.04, 0.40, '#d4eaff'],
  [0.48, 0.30, -1, 0.05, 0.42, '#e7efff'],
  [-0.55, 0.07, -1, 0.032, 0.38, '#ffedda'],
  [0.51, -0.12, -1, 0.047, 0.40, '#dceaff'],
  [-0.32, -0.30, -1, 0.037, 0.35, '#fff1de'],
  [0.02, 0.12, -1, 0.053, 0.42, '#e9f0ff'],
  [-0.13, 0.46, -1, 0.034, 0.36, '#ffe8d5'],
] as const;

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'lux/cosmos-starfield',
    label: 'Cosmos Starfield',
    description: 'Layered fine stars and fixed six-ray feature stars on deep black.',
    tags: ['space', 'background', 'stars', 'jwst'],
    inputs: {},
    outputs: {
      image: {
        type: {
          kind: 'image',
          colorSpace: 'linear-srgb',
          alphaMode: 'premultiplied',
        },
        label: 'Image',
        description: 'Rendered starfield image.',
      },
    },
    controls: {
      starlight: {
        type: 'number',
        label: 'Fine star brightness',
        default: 0.8,
        min: 0,
        max: 2,
        step: 0.01,
        group: 'Cosmos',
      },
      featureStarDensity: {
        type: 'number',
        label: 'Feature star density',
        default: 12,
        min: 0,
        max: 12,
        step: 0.1,
        group: 'Cosmos',
      },
      featureStarScale: {
        type: 'number',
        label: 'Feature star scale',
        default: 0.85,
        min: 0.1,
        max: 2,
        step: 0.01,
        group: 'Cosmos',
      },
      featureStarVariance: {
        type: 'number',
        label: 'Feature star size variance',
        default: 0.86,
        min: 0,
        max: 2,
        step: 0.01,
        group: 'Cosmos',
      },
      featureStarOpacity: {
        type: 'number',
        label: 'Feature star opacity',
        default: 0.73,
        min: 0,
        max: 1,
        step: 0.01,
        group: 'Cosmos',
      },
      twinkle: {
        type: 'number',
        label: 'Twinkle',
        default: 0.81,
        min: 0,
        max: 1,
        step: 0.01,
        group: 'Cosmos',
      },
    },
    controlDescriptions: {
      starlight: 'Sets the opacity of the three fine-star depth layers.',
      featureStarDensity: 'Reveals the twelve stable feature stars in sequence, including fractional fades.',
      featureStarScale: 'Scales all six-ray feature stars while preserving their size distribution.',
      featureStarVariance: 'Controls how strongly the stable feature-star sizes differ.',
      featureStarOpacity: 'Fades the feature-star layer independently of the fine stars.',
      twinkle: 'Adds a slow, subtle brightness drift without moving the fixed sky.',
    },
    lifecycle: {
      state: 'stateful',
      reset: 'seed',
    },
  },
  async create(context) {
    const scene = new Scene();
    scene.background = new Color('#000006');
    const camera = new PerspectiveCamera(
      42,
      context.settings.width / context.settings.height,
      0.1,
      100,
    );
    camera.position.set(0, 0, 17.12);
    camera.lookAt(0, 0, 0);
    scene.add(camera);

    const fineStarGain = uniform(0.8 * 0.48);
    const fineStarGeometry = new PlaneGeometry(1, 1);
    const fineStarMaterial = new MeshBasicNodeMaterial();
    const fineStarRadius = uv().sub(0.5).length().mul(2);
    fineStarMaterial.opacityNode = float(1)
      .sub(smoothstep(0.05, 1, fineStarRadius))
      .pow(3)
      .mul(fineStarGain);
    fineStarMaterial.transparent = true;
    fineStarMaterial.blending = AdditiveBlending;
    fineStarMaterial.depthWrite = false;
    fineStarMaterial.toneMapped = false;

    const fineStarBatches: InstancedMesh[] = [];
    const dummy = new Object3D();
    const color = new Color();
    for (let layer = 0; layer < 3; layer += 1) {
      const stars = new InstancedMesh(fineStarGeometry, fineStarMaterial, 480);
      for (let index = 0; index < 480; index += 1) {
        dummy.position.set(
          (context.random() - 0.5) * 74,
          (context.random() - 0.5) * 44,
          -9 - layer * 12 - context.random() * 7,
        );
        const size = (0.13 + Math.pow(context.random(), 5) * 0.15) * (1 + layer * 0.4);
        dummy.scale.setScalar(size);
        dummy.updateMatrix();
        stars.setMatrixAt(index, dummy.matrix);
        const tint = context.random();
        stars.setColorAt(
          index,
          color.setRGB(0.55 + tint * 0.45, 0.64 + tint * 0.24, 1),
        );
      }
      stars.instanceMatrix.needsUpdate = true;
      if (stars.instanceColor) stars.instanceColor.needsUpdate = true;
      stars.frustumCulled = false;
      scene.add(stars);
      fineStarBatches.push(stars);
    }

    const featureStars = featureStarData.map(([x, y, z, size, brightness, tint]) => {
      const rig = createFlareRig();
      scene.add(rig.root);
      return {
        rig,
        direction: new Vector3(x, y, z).normalize(),
        size,
        brightness,
        tint: new Color(tint),
        light: new Vector3(),
      };
    });

    return {
      update(frame) {
        const controls = frame.controls;
        const fineTwinkle = 1 + controls.twinkle * (
          Math.sin(frame.timeSeconds * 0.41) * 0.045
          + Math.sin(frame.timeSeconds * 0.79 + 1.7) * 0.025
        );
        fineStarGain.value = controls.starlight * 0.48 * fineTwinkle;

        for (let index = 0; index < featureStars.length; index += 1) {
          const star = featureStars[index];
          const starSize = 0.1032
            * controls.featureStarScale
            * Math.exp(Math.log(star.size / 0.043) * controls.featureStarVariance * 2);
          const densityFade = ease(controls.featureStarDensity - index);
          const twinkle = 1 + controls.twinkle * 0.09
            * Math.sin(frame.timeSeconds * (0.23 + index * 0.017) + index * 1.93);
          star.light.copy(camera.position).addScaledVector(star.direction, 60);
          star.rig.update(camera, star.light, {
            scale: starSize,
            brightness: star.brightness * 1.8 * Math.min(1.4, controls.starlight) * twinkle,
            visibility: controls.featureStarOpacity * densityFade,
            tint: star.tint,
            secondarySpikes: 0.035,
          });
        }
      },
      async evaluate(_inputs, evaluation) {
        return {
          image: await evaluation.render(scene, camera),
        };
      },
      reset() {
        fineStarGain.value = 0.8 * 0.48;
      },
      dispose() {
        for (const star of featureStars) star.rig.dispose();
        for (const stars of fineStarBatches) {
          stars.removeFromParent();
          stars.dispose();
        }
        fineStarGeometry.dispose();
        fineStarMaterial.dispose();
      },
    };
  },
});
