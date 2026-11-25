import type { VisualContext } from '@lux/visual-sdk';
import { Scene, Mesh, IcosahedronGeometry, MeshPhysicalNodeMaterial, PerspectiveCamera, Color, AmbientLight, DirectionalLight } from 'three/webgpu';
import { uniform, vec3, positionLocal, mx_noise_float, mix, color, varying } from 'three/tsl';

// Original Prismatic Spikes geometry, material, lighting and animation.
const settings = {
  spikeHeight: 1.0,    // 0 = round; 2 = long thorns (zoom camera out)
  noiseScale: 3.6,    // Larger values create more, smaller spikes
  sharpness: 3.4,     // Larger values make narrower tips
  evolutionSpeed: 0.3,
  domainWarp: 0.48,   // Twists the noise field into organic shapes
  microDetail: 0.07,
  rotationSpeed: 0.13,
  metallic: 0.56,
  roughness: 0.29,
  iridescence: 0.85,
};

export async function createSpikyBall(context: VisualContext) {
    const clock = uniform(0);
    const intensity = uniform(0.55);
    const p = positionLocal.normalize();
    const drift = vec3(clock.mul(0.43), clock.mul(-0.31), clock.mul(0.22));
    const warp = mx_noise_float(p.mul(2.0).add(drift.mul(0.45))).mul(settings.domainWarp);
    const field = p.mul(settings.noiseScale).add(drift).add(warp);
    const noise = mx_noise_float(field).mul(0.8).add(0.44).clamp(0, 1);
    const spikes = noise.pow(settings.sharpness).mul(settings.spikeHeight).mul(intensity.mul(1.6).add(0.25));
    const pores = mx_noise_float(field.mul(3.1).sub(drift)).mul(settings.microDetail).mul(intensity);
    const radius = spikes.add(pores).add(0.85);
    const height = varying(spikes);

    const material = new MeshPhysicalNodeMaterial({
      metalness: settings.metallic, roughness: settings.roughness,
      clearcoat: 0.8, clearcoatRoughness: 0.22,
      iridescence: settings.iridescence, iridescenceIOR: 1.4,
      iridescenceThicknessRange: [120, 470], flatShading: true,
    });
    material.positionNode = p.mul(radius);
    material.colorNode = mix(color('#392565'), color('#21e6cb'), height.mul(1.8).clamp(0, 1));
    material.emissiveNode = mix(color('#120420'), color('#16b9b6'), height.mul(1.2).clamp(0, 1)).mul(0.13);
    const geometry = new IcosahedronGeometry(1, 32);
    const sphere = new Mesh(geometry, material);
    sphere.frustumCulled = false;
    const scene = new Scene();
    scene.background = new Color('#030510');
    scene.add(sphere);
    scene.add(new AmbientLight('#668ab4', 0.8));
    const key = new DirectionalLight('#bfefff', 4.4);
    key.position.set(3, 4, 4);
    scene.add(key);
    const rim = new DirectionalLight('#fc4fa4', 5.5);
    rim.position.set(-3, 1, -1);
    scene.add(rim);
    const fill = new DirectionalLight('#558bff', 2.0);
    fill.position.set(1, -3, 2);
    scene.add(fill);
    const camera = new PerspectiveCamera(36, context.settings.width / context.settings.height, 0.1, 30);
    camera.position.set(0, 0, 9);
    camera.lookAt(0, 0, 0);
    return {
      scene, camera,
      update(timeSeconds: number, spikeAmount: number) {
        intensity.value = spikeAmount;
        clock.value = timeSeconds * settings.evolutionSpeed * (0.5 + spikeAmount);
        sphere.rotation.y = timeSeconds * settings.rotationSpeed;
        sphere.rotation.x = Math.sin(timeSeconds * 0.17) * 0.16;
        sphere.rotation.z = 0.13;
      },
      reset(_seed: number) { clock.value = 0; sphere.rotation.set(0, 0, 0.13); },
      dispose() { geometry.dispose(); material.dispose(); },
    };
}
