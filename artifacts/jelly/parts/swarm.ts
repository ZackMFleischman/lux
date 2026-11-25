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

// Adds faint distant jellyfish that drift upward. Mids make them glow a little brighter.
const swarmPass = `
fn jellySwarm(st: vec2f, base: vec4f, view: vec4f, shape: vec4f) -> vec4f {
  let t = view.x;
  let aspect = view.y;
  let mids = view.z;
  let n = i32(shape.x);
  var glow = vec3f(0.0);
  for (var i = 0; i < 12; i++) {
    if (i >= n) {
      break;
    }
    let fi = f32(i);
    let hx = hash11(fi * 1.13 + 1.0);
    let hp = hash11(fi * 2.71 + 5.0);
    let hs = hash11(fi * 3.37 + 9.0);
    let hh = hash11(fi * 4.91 + 13.0);
    let hv = hash11(fi * 5.53 + 17.0);

    // Drift upward and wrap vertically. Each jelly has its own speed.
    let rise = 0.02 + 0.03 * hv;
    let y = fract(hp + t * rise * shape.z);
    let sway = sin(t * 0.3 + hp * 6.283) * 0.02;
    let x = 0.06 + 0.88 * hx + sway;
    let pos = vec2f(x, y);

    // Own swim cycle: the dome squeezes and relaxes.
    let cycle = sin(t * (0.9 + 0.8 * hs) + hp * 6.283);
    let pulse = 1.0 + 0.18 * cycle;
    let r = shape.y * (0.012 + 0.014 * hs) * pulse;

    let d = (st - pos) * vec2f(aspect, 1.0);

    // Stay away from the main subject and fade at the wrap edges.
    let away = (pos - vec2f(0.5, 0.42)) * vec2f(aspect, 1.0);
    let keep = smoothstep(0.2, 0.38, length(away));
    let edge = sin(y * 3.14159265);

    // Dome above the origin.
    let up = max(d.y, 0.0);
    let e = length(vec2f(d.x / r, up / (r * 0.8)));
    let dome = (1.0 - smoothstep(0.6, 1.0, e)) * step(0.0, d.y);
    let halo = exp(-length(vec2f(d.x, d.y * 0.7)) / (r * 2.5)) * 0.25;

    // Three short wiggling tentacles under the dome.
    let along = clamp(-d.y / (r * 3.5), 0.0, 1.0);
    var lines = 0.0;
    for (var k = 0; k < 3; k++) {
      let fk = f32(k);
      let tx = (fk - 1.0) * r * 0.55;
      let wig = sin(along * 8.0 - t * 2.5 * (0.7 + hs) + hp * 6.283 + fk * 1.9) * r * 0.3 * along;
      let lw = r * 0.09;
      lines += exp(-abs(d.x - tx - wig) / lw) * (1.0 - along) * step(d.y, 0.0) * step(along, 0.999);
    }

    // Per-jelly color from the hue control.
    let h = (view.w + hh * 0.18) * 6.283;
    let col = vec3f(
      0.55 + 0.45 * cos(h),
      0.55 + 0.45 * cos(h - 2.1),
      0.55 + 0.45 * cos(h + 2.1),
    );
    let strength = (0.22 + 0.18 * hv) * shape.w * (1.0 + mids * 1.5) * keep * edge;
    glow += col * (dome * 0.9 + halo + lines * 0.45) * strength;
  }
  return vec4f(base.rgb + glow, 1.0);
}

fn hash11(n: f32) -> f32 {
  return fract(sin(n * 127.1 + 311.7) * 43758.5453);
}
`;

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'jellyfish/swarm',
    label: 'Distant Jellies',
    description: 'Adds faint tiny jellyfish drifting upward in the background; mids brighten them.',
    tags: ['jellyfish', 'cosmic'],
    inputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Scene image to add distant jellyfish to.',
      },
    },
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'Scene with distant jellyfish.',
      },
    },
    controls: {
      count: { type: 'number', group: 'Swarm', label: 'Count', default: 8, min: 4, max: 12, step: 1 },
      size: { type: 'number', group: 'Swarm', label: 'Size', default: 1, min: 0.4, max: 2.5, step: 0.01 },
      speed: { type: 'number', group: 'Swarm', label: 'Drift speed', default: 1, min: 0, max: 4, step: 0.01 },
      brightness: { type: 'number', group: 'Swarm', label: 'Brightness', default: 1, min: 0, max: 3, step: 0.01 },
      hue: { type: 'number', group: 'Color', label: 'Hue', default: 0.6, min: 0, max: 1, step: 0.01 },
    },
    controlDescriptions: {
      count: 'Number of distant jellyfish.',
      size: 'Size of the distant jellyfish.',
      speed: 'How fast they drift upward.',
      brightness: 'Glow strength of the distant jellyfish.',
      hue: 'Base color of the distant jellyfish.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    const view = uniform(new Vector4(0, aspect, 0, 0.6));
    const shape = uniform(new Vector4(8, 1, 1, 1));
    const baseTex = texture(new Texture(), vec2(uv().x, uv().y.oneMinus()));
    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    material.fragmentNode = wgslFn(swarmPass)(uv(), baseTex, view, shape);
    const scene = new Scene();
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    let mids = 0;

    return {
      update(frame) {
        const spectrum = frame.audioSpectrum;
        let target = 0;
        if (spectrum?.available) {
          for (let i = 40; i < 80; i++) {
            target += spectrum.magnitudes[i] ?? 0;
          }
          target /= 40;
        }
        mids += (target - mids) * 0.15;

        view.value.set(frame.timeSeconds, aspect, Math.min(mids * 4, 1), frame.controls.hue);
        shape.value.set(frame.controls.count, frame.controls.size, frame.controls.speed, frame.controls.brightness);
      },
      async evaluate(inputs, evaluation) {
        baseTex.value = inputs.image.texture as Texture;
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {
        mids = 0;
      },
      dispose() {
        geometry.dispose();
        material.dispose();
      },
    };
  },
});
