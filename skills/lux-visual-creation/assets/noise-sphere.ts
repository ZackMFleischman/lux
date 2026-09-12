import { defineVisual } from '@lux/visual-sdk';
import {
  Scene, Color, Mesh, SphereGeometry, MeshStandardNodeMaterial,
  PerspectiveCamera, AmbientLight, DirectionalLight,
} from 'three/webgpu';
import { uniform, positionLocal, normalLocal, vec3, mx_noise_float } from 'three/tsl';

// Artist settings: source edits require Build in SDK 0.1.0.
// Fixed intensity below is tracer compatibility, not a required visual design.
const settings = {
  spikeHeight: 0.85,
  noiseScale: 3.4,
  sharpness: 3.2,
  motionSpeed: 0.28,
  color: '#8b5cff',
  roughness: 0.38,
};

export default defineVisual({
  async create(context) {
    const time = uniform(0);
    const intensity = uniform(0.5);
    const drift = vec3(time.mul(0.31), time.mul(0.17), time.mul(0.23));
    const noise = mx_noise_float(positionLocal.mul(settings.noiseScale).add(drift));
    const peaks = noise.mul(0.5).add(0.5).clamp(0, 1).pow(settings.sharpness);
    const material = new MeshStandardNodeMaterial({
      color: settings.color, roughness: settings.roughness, metalness: 0.15,
      flatShading: true,
    });
    material.positionNode = positionLocal.add(
      normalLocal.mul(peaks.mul(settings.spikeHeight).mul(intensity)),
    );
    const geometry = new SphereGeometry(1, 128, 64);
    const sphere = new Mesh(geometry, material);
    // Bound includes maximum GPU displacement, which CPU culling cannot see.
    geometry.computeBoundingSphere();
    geometry.boundingSphere!.radius = 1 + settings.spikeHeight;
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
        time.value = frame.timeSeconds * settings.motionSpeed;
        intensity.value = frame.controls.intensity;
        sphere.rotation.y = frame.timeSeconds * 0.12;
        sphere.rotation.x = Math.sin(frame.timeSeconds * 0.17) * 0.18;
      },
      render(target) { return context.renderer.render(scene, camera, target); },
      reset(_seed) {}, // All motion derives from Lux time on the next update.
      dispose() { geometry.dispose(); material.dispose(); },
    };
  },
});
