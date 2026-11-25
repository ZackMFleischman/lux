import { defineComponent } from '@lux/visual-sdk';
import {
  Scene,
  Mesh,
  PlaneGeometry,
  MeshBasicNodeMaterial,
  OrthographicCamera,
  Vector4,
  Texture,
} from 'three/webgpu';
import { uniform, uv, wgslFn, texture, vec2 } from 'three/tsl';

// Ring field (center is in uv space: y from the bottom). Returns xy = uv displacement (sampling-space, y already negated), z = ring glow.
const ringField = `
fn jellyRingField(st: vec2f, view: vec4f, rings: vec4f, tint: vec4f, center: vec4f) -> vec4f {
  let t = view.x;
  let p = (st - center.xy) * vec2f(view.y, 1.0) * 2.0;
  let r = length(p);
  let dir = p / max(r, 0.0001);
  var glow = 0.0;
  var push = 0.0;
  for (var i = 0; i < 4; i++) {
    let age = t - rings[i];
    let alive = step(0.0, age) * step(age, 2.4);
    let life = clamp(1.0 - age / 2.4, 0.0, 1.0);
    let fade = life * life * (3.0 - 2.0 * life) * smoothstep(0.0, 0.06, age) * alive;
    let radius = 0.08 + age * tint.w * 1.1;
    let d = r - radius;
    let width = 0.03 + age * 0.02;
    glow += exp(-(d * d) / (width * width)) * fade;
    // Wide derivative-of-gaussian wave packet: push out ahead of the front, pull in behind it.
    let w = 0.14 + age * 0.04;
    let x = d / w;
    push += x * exp(-x * x) * 2.33 * fade;
  }
  let amp = 0.05 * view.z;
  let o = dir * push * amp / vec2f(view.y, 1.0);
  return vec4f(o.x, -o.y, glow, 0.0);
}
`;

// Adds the soft glowing rings on top of the refracted image (R/G/B sampled with split displacement).
const ringComposite = `
fn jellyRingComposite(r: vec4f, g: vec4f, b: vec4f, field: vec4f, view: vec4f, tint: vec4f) -> vec4f {
  let base = vec3f(r.r, g.g, b.b);
  let ring = tint.rgb * field.z * view.w * 0.6;
  let core = vec3f(0.85, 0.95, 1.0) * pow(field.z, 2.0) * 0.2 * view.w;
  return vec4f(base + ring + core, 1.0);
}
`;

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'lux/shockwave-ripples',
    label: 'Shockwave Ripples',
    description: 'Use as a final image effect to make bass hits send whole-screen refracting shockwave rings outward from a chosen point, with a chromatic split and soft glow.',
    tags: ['audio-reactive', 'distortion', 'shockwave'],
    inputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image to overlay ripples on.',
      },
    },
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Image with shockwave ripples.',
      },
    },
    controls: {
      sensitivity: { type: 'number', group: 'Audio', label: 'Bass sensitivity', default: 1, min: 0.2, max: 3, step: 0.01 },
      speed: { type: 'number', group: 'Rings', label: 'Speed', default: 1, min: 0.2, max: 3, step: 0.01 },
      brightness: { type: 'number', group: 'Rings', label: 'Brightness', default: 1, min: 0, max: 3, step: 0.01 },
      distortion: { type: 'number', group: 'Rings', label: 'Distortion', default: 1, min: 0, max: 3, step: 0.01 },
      centerX: { type: 'number', group: 'Rings', label: 'Center X', default: 0.5, min: 0, max: 1, step: 0.01 },
      centerY: { type: 'number', group: 'Rings', label: 'Center Y', default: 0.42, min: 0, max: 1, step: 0.01 },
      hue: { type: 'number', group: 'Color', label: 'Hue', default: 0.55, min: 0, max: 1, step: 0.01 },
    },
    controlDescriptions: {
      sensitivity: 'How easily bass hits spawn a new ring.',
      speed: 'How fast rings expand outward.',
      brightness: 'Ring glow strength.',
      distortion: 'Strength of the whole-screen refraction wave that travels outward with each ring.',
      centerX: 'Horizontal ring origin, 0 = left edge, 1 = right edge of the screen.',
      centerY: 'Vertical ring origin measured from the bottom of the screen: 0 = bottom edge, 1 = top edge.',
      hue: 'Ring base color.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    const view = uniform(new Vector4(0, aspect, 1, 1));
    const rings = uniform(new Vector4(-100, -100, -100, -100));
    const tint = uniform(new Vector4(0.4, 0.8, 1, 1));
    const center = uniform(new Vector4(0.5, 0.42, 0, 0));

    const field = wgslFn(ringField)(uv(), view, rings, tint, center);
    const src = new Texture();
    const baseUv = vec2(uv().x, uv().y.oneMinus());
    const fxy = (field as any).xy;
    const texR = texture(src, baseUv.add(fxy.mul(0.94)));
    const texG = texture(src, baseUv.add(fxy));
    const texB = texture(src, baseUv.add(fxy.mul(1.06)));
    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    material.fragmentNode = wgslFn(ringComposite)(texR, texG, texB, field, view, tint);
    const scene = new Scene();
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    const births = [-100, -100, -100, -100];
    let nextSlot = 0;
    let baseline = 0;
    let lastSpawn = -100;

    return {
      update(frame) {
        const spectrum = frame.audioSpectrum;
        let bass = 0;
        if (spectrum?.available) {
          for (let i = 8; i < 28; i++) {
            bass += spectrum.magnitudes[i] ?? 0;
          }
          bass /= 20;
        }
        const now = frame.timeSeconds;
        // Spawn when bass rises clearly above its slow-moving baseline.
        const threshold = 0.06 / Math.max(frame.controls.sensitivity, 0.01);
        if (bass - baseline > threshold && now - lastSpawn > 0.25) {
          births[nextSlot] = now;
          nextSlot = (nextSlot + 1) % 4;
          lastSpawn = now;
        }
        baseline += (bass - baseline) * 0.08;

        const h = frame.controls.hue * Math.PI * 2;
        tint.value.set(
          0.55 + 0.45 * Math.cos(h),
          0.55 + 0.45 * Math.cos(h - 2.1),
          0.55 + 0.45 * Math.cos(h + 2.1),
          frame.controls.speed,
        );
        center.value.set(frame.controls.centerX, frame.controls.centerY, 0, 0);
        rings.value.set(births[0], births[1], births[2], births[3]);
        view.value.set(now, aspect, frame.controls.distortion, frame.controls.brightness);
      },
      async evaluate(inputs, evaluation) {
        const tex = inputs.image.texture as Texture;
        texR.value = tex;
        texG.value = tex;
        texB.value = tex;
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {
        births.fill(-100);
        nextSlot = 0;
        baseline = 0;
        lastSpawn = -100;
        rings.value.set(-100, -100, -100, -100);
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  },
});
