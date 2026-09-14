import { defineComponent, type ImageResource } from '@lux/visual-sdk';
import { Scene, Mesh, PlaneGeometry, MeshBasicNodeMaterial, OrthographicCamera, type Texture } from 'three/webgpu';
import { texture, uniform, uv, vec2, vec4, float, atan, cos, sin } from 'three/tsl';

export default defineComponent({
  metadata: {
    declarationVersion: 1, key: 'demo/kaleidoscope', label: 'Kaleidoscope', description: 'Mirrored image effect', tags: ['demo'],
    inputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'Source image' } },
    outputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'Mirrored image' } },
    controls: { segments: { type: 'number', label: 'Mirror segments', default: 6, min: 2, max: 16, step: 1 } },
    controlDescriptions: { segments: 'Sets the number of independently mirrored wedges.' }, lifecycle: { state: 'stateful', reset: 'seed' },
  },
  async create(context) {
    const segments = uniform(6), rotation = uniform(0), scene = new Scene(), geometry = new PlaneGeometry(2, 2);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false }), quad = new Mesh(geometry, material);
    quad.frustumCulled = false; scene.add(quad); const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const aspect = context.settings.width / context.settings.height;
    let time = 0, input: ImageResource | undefined;
    function bind(source: ImageResource) {
      const image = texture(source.texture as Texture), screen = uv(), p = screen.sub(0.5).mul(vec2(aspect, 1));
      const radius = p.length().div(1.25), sector = float(Math.PI * 2).div(segments);
      const angle = atan(p.y, p.x).add(rotation).add(radius.mul(0.35));
      const folded = angle.div(sector).fract().sub(0.5).abs().mul(sector).add(time * 0.05);
      const distance = float(1).sub(radius.mul(1.2).fract().mul(2).sub(1).abs()).mul(0.19);
      const direction = vec2(cos(folded).div(aspect), sin(folded)), q = vec2(0.515, 0.515).add(direction.mul(distance));
      const center = image.sample(q), red = image.sample(q.add(direction.mul(0.001))).r, blue = image.sample(q.sub(direction.mul(0.001))).b;
      material.fragmentNode = vec4(red, center.g, blue, center.a); material.needsUpdate = true;
    }
    return { update(frame) { segments.value = Math.round(frame.controls.segments); rotation.value = frame.timeSeconds * 0.08; time = frame.timeSeconds; },
      async evaluate(inputs, evaluation) { input = inputs.image; bind(input); return { image: await evaluation.render(scene, camera) }; },
      reset() { rotation.value = 0; time = 0; }, dispose() { input = undefined; geometry.dispose(); material.dispose(); } };
  },
});
