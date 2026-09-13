import { defineVisual } from '@lux/visual-sdk';
import {
  Scene, Color, Mesh, SphereGeometry, MeshStandardNodeMaterial,
  PerspectiveCamera, AmbientLight, DirectionalLight,
} from 'three/webgpu';
import { uniform, positionLocal, normalLocal, vec3, mx_noise_float } from 'three/tsl';

// SDK 0.2: numeric controls are declared below; color remains a source setting.
export default defineVisual({
  controls: {
    spikeHeight: { type: 'number', label: 'Spike height', default: 0.85, min: 0, max: 2, step: 0.01 },
    noiseScale: { type: 'number', label: 'Noise scale', default: 3.4, min: 0.5, max: 12, step: 0.1 },
    sharpness: { type: 'number', label: 'Sharpness', default: 3.2, min: 0.25, max: 8, step: 0.05 },
    motionSpeed: { type: 'number', label: 'Motion speed', default: 0.28, min: 0, max: 2, step: 0.01 },
    roughness: { type: 'number', label: 'Roughness', default: 0.38, min: 0, max: 1, step: 0.01 },
  },
  async create(context) {
    const time = uniform(0);
    const spikeHeight = uniform(0.85), noiseScale = uniform(3.4), sharpness = uniform(3.2);
    const drift = vec3(time.mul(0.31), time.mul(0.17), time.mul(0.23));
    const noise = mx_noise_float(positionLocal.mul(noiseScale).add(drift));
    const peaks = noise.mul(0.5).add(0.5).clamp(0, 1).pow(sharpness);
    const material = new MeshStandardNodeMaterial({
      color: '#8b5cff', roughness: 0.38, metalness: 0.15,
      flatShading: true,
    });
    material.positionNode = positionLocal.add(
      normalLocal.mul(peaks.mul(spikeHeight)),
    );
    const geometry = new SphereGeometry(1, 128, 64);
    const sphere = new Mesh(geometry, material);
    // Bound includes maximum GPU displacement, which CPU culling cannot see.
    geometry.computeBoundingSphere();
    geometry.boundingSphere!.radius = 3;
    const scene = new Scene();
    scene.background = new Color('#070b16');
    scene.add(sphere, new AmbientLight('#b7c6ff', 1.4));
    const key = new DirectionalLight('#e4d4ff', 4);
    key.position.set(3, 4, 5);
    const rim = new DirectionalLight('#35e6cf', 2.5);
    rim.position.set(-3, 1, -2);
    scene.add(key, rim);
    const camera = new PerspectiveCamera(42, context.settings.width / context.settings.height, 0.1, 30);
    camera.position.z = 5.6;
    return {
      update(frame) {
        time.value += frame.deltaSeconds * frame.controls.motionSpeed;
        spikeHeight.value = frame.controls.spikeHeight;
        noiseScale.value = frame.controls.noiseScale;
        sharpness.value = frame.controls.sharpness;
        material.roughness = frame.controls.roughness;
        sphere.rotation.y = frame.timeSeconds * 0.12;
        sphere.rotation.x = Math.sin(frame.timeSeconds * 0.17) * 0.18;
      },
      render(target) { return context.renderer.render(scene, camera, target); },
      reset(_seed) { time.value = 0; },
      dispose() { geometry.dispose(); material.dispose(); },
    };
  },
});
