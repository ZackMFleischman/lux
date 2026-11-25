import { defineComponent } from '@lux/visual-sdk';
import { DataTexture, Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, Scene, Texture } from 'three/webgpu';
import { abs, atan, clamp, cos, float, length, max, mix, mod, sin, texture, uniform, uv, vec2 } from 'three/tsl';

const TAU = Math.PI * 2;

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

// Cycle: hold off, ease in, hold on, ease out. The ramps sit inside the on window.
function cycleMix(time: number, period: number, onFraction: number, transition: number): number {
  const onLength = period * onFraction;
  const offLength = period - onLength;
  const ramp = Math.max(0.0001, Math.min(transition, onLength / 2));
  const t = ((time % period) + period) % period;
  if (t < offLength) return 0;
  const local = t - offLength;
  if (local < ramp) return smooth(local / ramp);
  if (local > onLength - ramp) return smooth((onLength - local) / ramp);
  return 1;
}

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'effects/kaleidoscope-cycle',
    label: 'Kaleidoscope Cycle',
    description: 'Mirrored-wedge kaleidoscope that slowly rotates and fades in and out on a regular cycle.',
    tags: ['kaleidoscope', 'effect', 'mirror'],
    inputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'Image to fold into mirrored wedges.' } },
    outputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'Image with the cycling kaleidoscope applied.' } },
    controls: {
      segments: { type: 'number', label: 'Segments', group: 'Kaleidoscope', default: 6, min: 2, max: 16, step: 1 },
      period: { type: 'number', label: 'Cycle length', group: 'Kaleidoscope', default: 16, min: 4, max: 120, step: 0.5, unit: 's' },
      onFraction: { type: 'number', label: 'On fraction', group: 'Kaleidoscope', default: 0.4, min: 0.05, max: 0.95, step: 0.01 },
      transition: { type: 'number', label: 'Transition', group: 'Kaleidoscope', default: 2.5, min: 0.2, max: 10, step: 0.1, unit: 's' },
      spin: { type: 'number', label: 'Spin', group: 'Kaleidoscope', default: 0.08, min: -1, max: 1, step: 0.01, unit: 'rad/s' },
      amount: { type: 'number', label: 'Amount', group: 'Kaleidoscope', default: 1, min: 0, max: 1, step: 0.01 },
      force: { type: 'number', label: 'Force', group: 'Kaleidoscope', default: 0, min: 0, max: 1, step: 0.01 },
    },
    controlDescriptions: {
      segments: 'Number of mirrored wedges around the centre.',
      period: 'Seconds for one full off-and-on cycle.',
      onFraction: 'Share of each cycle in which the kaleidoscope is on, including its fades.',
      transition: 'Seconds to ease in and again to ease out. Limited to half the on time.',
      spin: 'Rotation speed of the wedge pattern in radians per second.',
      amount: 'Maximum blend toward the kaleidoscope. Zero keeps the original image.',
      force: 'Added to the cycle blend, so an audio or LFO binding can push the effect in at any time.',
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create() {
    const fallback = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    const segmentsUniform = uniform(6);
    const rotationUniform = uniform(0);
    const aspectUniform = uniform(1);
    const mixUniform = uniform(0);
    const zoomUniform = uniform(0);

    const coordinates = uv().flipY();
    const original = texture(fallback, coordinates);

    const centered = coordinates.sub(0.5).mul(vec2(aspectUniform, 1));
    const radius = length(centered).mul(float(1).sub(zoomUniform));
    const angle = atan(centered.y, centered.x).add(rotationUniform);
    const wedge = segmentsUniform.reciprocal().mul(TAU);
    const folded = abs(mod(angle, wedge).sub(wedge.mul(0.5)));
    const mirrored = vec2(cos(folded), sin(folded)).mul(radius);
    const kaleidoUv = clamp(mirrored.div(vec2(max(aspectUniform, 0.0001), 1)).add(0.5), 0, 1);
    const kaleido = texture(fallback, kaleidoUv);

    const geometry = new PlaneGeometry(2, 2);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    material.fragmentNode = mix(original, kaleido, mixUniform);
    material.toneMapped = false;
    const scene = new Scene();
    scene.add(new Mesh(geometry, material));
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

    return {
      update(frame) {
        const controls = frame.controls;
        const cycle = cycleMix(frame.timeSeconds, controls.period, controls.onFraction, controls.transition);
        const blend = Math.min(1, Math.max(0, cycle * controls.amount + controls.force));
        segmentsUniform.value = Math.max(2, Math.round(controls.segments));
        rotationUniform.value = (controls.spin * frame.timeSeconds) % TAU;
        mixUniform.value = blend;
        // Gentle zoom pulse that peaks mid-transition and vanishes at full on or off.
        zoomUniform.value = 0.06 * Math.sin(Math.PI * blend) * Math.sin(Math.PI * blend);
      },
      async evaluate(inputs, evaluation) {
        const image = inputs.image.texture as Texture;
        original.value = image;
        kaleido.value = image;
        aspectUniform.value = inputs.image.width / Math.max(1, inputs.image.height);
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {},
      dispose() { geometry.dispose(); material.dispose(); fallback.dispose(); },
    };
  },
});
