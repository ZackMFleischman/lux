import { defineComponent } from '@lux/visual-sdk';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  IcosahedronGeometry,
  Mesh,
  MeshPhysicalNodeMaterial,
  PerspectiveCamera,
  Scene,
} from 'three/webgpu';
import {
  color,
  mix,
  mx_noise_float,
  positionLocal,
  uniform,
  varying,
  vec3,
} from 'three/tsl';

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'demo/prismatic-ball',
    label: 'Prismatic Ball',
    description: 'Animated iridescent spike source',
    tags: ['demo'],
    inputs: {},
    outputs: {
      image: {
        type: {
          kind: 'image',
          colorSpace: 'linear-srgb',
          alphaMode: 'premultiplied',
        },
        label: 'Image',
        description: 'Rendered ball',
      },
    },
    controls: {
      intensity: {
        type: 'number',
        label: 'Spike amount',
        default: 0.67,
        min: 0,
        max: 1,
        step: 0.01,
      },
    },
    controlDescriptions: {
      intensity: 'Controls the height of the animated spikes.',
    },
    lifecycle: {
      state: 'stateful',
      reset: 'seed',
    },
  },
  async create(context) {
    const clock = uniform(0);
    const intensity = uniform(0.67);
    const position = positionLocal.normalize();
    const drift = vec3(clock.mul(0.43), clock.mul(-0.31), clock.mul(0.22));
    const warp = mx_noise_float(position.mul(2).add(drift.mul(0.45))).mul(0.48);
    const field = position.mul(3.6).add(drift).add(warp);
    const noise = mx_noise_float(field).mul(0.8).add(0.44).clamp(0, 1);
    const spikes = noise.pow(3.4).mul(intensity.mul(1.6).add(0.25));
    const height = varying(spikes);
    const material = new MeshPhysicalNodeMaterial({
      metalness: 0.56,
      roughness: 0.29,
      clearcoat: 0.8,
      clearcoatRoughness: 0.22,
      iridescence: 0.85,
      flatShading: true,
    });
    const detail = mx_noise_float(field.mul(3.1).sub(drift)).mul(0.07).mul(intensity);
    material.positionNode = position.mul(spikes.add(detail).add(0.85));
    material.colorNode = mix(
      color('#392565'),
      color('#21e6cb'),
      height.mul(1.8).clamp(0, 1),
    );
    material.emissiveNode = mix(
      color('#120420'),
      color('#16b9b6'),
      height.mul(1.2).clamp(0, 1),
    ).mul(0.13);
    const geometry = new IcosahedronGeometry(1, 24);
    const sphere = new Mesh(geometry, material);
    const scene = new Scene();
    scene.background = new Color('#030510');
    scene.add(sphere, new AmbientLight('#668ab4', 0.8));
    const key = new DirectionalLight('#bfefff', 4.4);
    key.position.set(3, 4, 4);
    scene.add(key);
    const rim = new DirectionalLight('#fc4fa4', 5.5);
    rim.position.set(-3, 1, -1);
    scene.add(rim);
    const camera = new PerspectiveCamera(
      36,
      context.settings.width / context.settings.height,
      0.1,
      30,
    );
    camera.position.set(0, 0, 9);
    return {
      update(frame) {
        intensity.value = frame.controls.intensity;
        clock.value = frame.timeSeconds * 0.3 * (0.5 + frame.controls.intensity);
        sphere.rotation.set(
          Math.sin(frame.timeSeconds * 0.17) * 0.16,
          frame.timeSeconds * 0.13,
          0.13,
        );
      },
      async evaluate(_inputs, evaluation) {
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {
        clock.value = 0;
        sphere.rotation.set(0, 0, 0.13);
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  },
});
