import { defineComponent } from '@lux/visual-sdk';
import {
  Scene,
  PerspectiveCamera,
  InstancedMesh,
  PlaneGeometry,
  MeshBasicNodeMaterial,
  Object3D,
  Color,
  AdditiveBlending,
  DynamicDrawUsage,
} from 'three/webgpu';
import { uv, float, uniform } from 'three/tsl';

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'particles/tornado',
    label: 'Particle Tornado',
    description: 'A luminous blue particle funnel with warm sparks and a swirling ground skirt.',
    tags: ['particles', 'tornado', 'generative'],
    inputs: {},
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'The rendered particle tornado.',
      },
    },
    controls: {
      particleCount: { type: 'number', label: 'Particle count', default: 11000, min: 0, max: 50000, step: 100 },
      height: { type: 'number', label: 'Height', default: 7, min: 1, max: 18, step: 0.1 },
    spin: { type: 'number', label: 'Spin', default: -0.04, min: -0.25, max: 0.25, step: 0.001 },
    width: { type: 'number', label: 'Funnel width', default: 1.17, min: 0.1, max: 4, step: 0.01 },
    turbulence: { type: 'number', label: 'Turbulence', default: 1.25, min: 0, max: 5, step: 0.01 },
    particleSize: { type: 'number', label: 'Particle size', default: 1.35, min: 0.1, max: 8, step: 0.01 },
    glow: { type: 'number', label: 'Glow', default: 0.82, min: 0, max: 8, step: 0.01 },
  },
    controlDescriptions: {
      particleCount: 'Total visible particles, including the ground skirt. Higher counts use more GPU and CPU time.',
      height: 'Funnel height with a fixed camera. Large values extend past the screen edges.',
      spin: 'Rotation speed. Negative values reverse the vortex.',
      width: 'Radius multiplier for the funnel and ground skirt.',
      turbulence: 'Strength of the waves and disturbances in the funnel.',
      particleSize: 'Particle diameter multiplier.',
      glow: 'Particle light strength. Zero turns off the particles; higher values add brighter halos.',
    },
    lifecycle: { state: 'stateless', reset: 'seed' },
  },
  async create(context) {
    const scene = new Scene();
    scene.background = new Color('#030711');
    const camera = new PerspectiveCamera(43, context.settings.width / context.settings.height, 0.1, 100);
    camera.position.set(0, 3.0, 16.8);
    camera.lookAt(0, 0.25, 0);

    const capacity = 50000;
    const geometry = new PlaneGeometry(1, 1);
    const material = new MeshBasicNodeMaterial();
    material.transparent = true;
    material.depthWrite = false;
    material.blending = AdditiveBlending;
    const glow = uniform(1);
    const radius = uv().sub(0.5).length().mul(2);
    material.opacityNode = float(1).sub(radius).max(0).pow(2).mul(glow);
    const particles = new InstancedMesh(geometry, material, capacity);
    particles.instanceMatrix.setUsage(DynamicDrawUsage);
    particles.frustumCulled = false;
    scene.add(particles);

    const seeds = new Float32Array(capacity * 4);
    const transform = new Object3D();
    transform.quaternion.copy(camera.quaternion);
    const color = new Color();
    for (let i = 0; i < capacity; i++) {
      seeds[i * 4] = context.random();
      seeds[i * 4 + 1] = context.random();
      seeds[i * 4 + 2] = context.random();
      seeds[i * 4 + 3] = context.random();
      const warm = seeds[i * 4 + 3] > 0.92;
      color.set(warm ? '#ffad54' : '#75cfff');
      color.multiplyScalar(0.5 + context.random() * 0.9);
      particles.setColorAt(i, color);
    }

    return {
      update(frame) {
        const time = frame.timeSeconds;
        const controls = frame.controls;
        glow.value = controls.glow;
        const count = Math.round(controls.particleCount);
        particles.count = count;
        // Keep the camera fixed so dimensions can fill or overflow the frame.
        camera.position.set(0, 3, 16.8);
        camera.lookAt(0, 0.25, 0);
        transform.quaternion.copy(camera.quaternion);
        for (let i = 0; i < count; i++) {
          const a = seeds[i * 4];
          const b = seeds[i * 4 + 1];
          const c = seeds[i * 4 + 2];
          const d = seeds[i * 4 + 3];
          const ground = i % 8 === 0;
          const height = (a + time * 0.055) % 1;
          const angle = b * Math.PI * 2 + time * controls.spin * (2.2 - height * 0.9) - height * 15;
          const shell = 0.7 + c * 0.3;
          const funnel = (0.14 + 2.75 * Math.pow(height, 1.8)) * controls.width;
          const ripple = Math.sin(angle * 3 + height * 21 - time * 1.4) * 0.12 * controls.turbulence;
          let radius = funnel * shell + ripple;
          let y = height * controls.height - controls.height / 2 + 0.05;
          if (ground) {
            radius = (0.35 + a * 3.6) * controls.width;
            y = -controls.height / 2 + Math.sin(b * 16 + time) * 0.06 + c * 0.18;
          }
          const bend = Math.sin(height * 3.8 + time * 0.35) * height * 0.38;
          const x = Math.cos(angle) * radius + (ground ? 0 : bend);
          const z = Math.sin(angle) * radius;
          y += Math.sin(angle * 2 + time + c * 8) * 0.10 * controls.turbulence;
          transform.position.set(x, y, z);
          const fade = ground ? 0.65 : Math.min(1, height * 18, (1 - height) * 18);
          const size = (0.025 + d * d * 0.060) * controls.particleSize * Math.max(0.1, fade);
          transform.scale.set(size, size, size);
          transform.updateMatrix();
          particles.setMatrixAt(i, transform.matrix);
        }
        particles.instanceMatrix.needsUpdate = true;
      },
      async evaluate(_inputs, evaluation) {
        return { image: await evaluation.render(scene, camera) };
      },
      reset(_seed) {},
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  },
});
