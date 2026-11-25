import { defineComponent } from '@lux/visual-sdk';
import {
  Mesh,
  MeshBasicNodeMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  Texture,
} from 'three/webgpu';
import { texture, uniform, uv, vec2, vec4 } from 'three/tsl';

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'observatory/prism',
    label: 'Prism lens',
    description: 'Reusable image lens. Each instance has independent spectral split and halo controls.',
    tags: ['effect'],
    inputs: {
      image: {
        type: {
          kind: 'image',
          colorSpace: 'linear-srgb',
          alphaMode: 'premultiplied',
        },
        label: 'Image',
        description: 'Linear light image',
      },
    },
    outputs: {
      image: {
        type: {
          kind: 'image',
          colorSpace: 'linear-srgb',
          alphaMode: 'premultiplied',
        },
        label: 'Image',
        description: 'Linear light image',
      },
    },
    controls: {
      split: {
        type: 'number',
        label: 'Spectral split',
        default: 0.002,
        min: 0,
        max: 0.03,
        step: 0.001,
      },
      glow: {
        type: 'number',
        label: 'Halo strength',
        default: 0.45,
        min: 0,
        max: 1.5,
        step: 0.01,
      },
      radius: {
        type: 'number',
        label: 'Halo radius',
        default: 0.004,
        min: 0.001,
        max: 0.025,
        step: 0.001,
      },
    },
    controlDescriptions: {
      split: 'Separates red and blue channels across the image. This instance is independent of the other lens.',
      glow: 'Adds a soft four-direction light halo.',
      radius: 'Distance used to spread the halo around bright lines.',
    },
    lifecycle: {
      state: 'stateful',
      reset: 'seed',
    },
  },
  async create() {
    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new PlaneGeometry(2, 2);
    const material = new MeshBasicNodeMaterial();
    const placeholder = new Texture();
    const map = texture(placeholder);
    const split = uniform(0.002);
    const glow = uniform(0.45);
    const radius = uniform(0.004);
    const p = uv();

    const rgb = vec4(
      map.sample(p.add(vec2(split, 0))).r,
      map.sample(p).g,
      map.sample(p.sub(vec2(split, 0))).b,
      1,
    );
    const halo = map.sample(p.add(vec2(radius, 0))).rgb
      .add(map.sample(p.sub(vec2(radius, 0))).rgb)
      .add(map.sample(p.add(vec2(0, radius))).rgb)
      .add(map.sample(p.sub(vec2(0, radius))).rgb)
      .mul(glow.mul(0.25));
    material.fragmentNode = vec4(rgb.rgb.add(halo), 1);
    scene.add(new Mesh(geometry, material));

    return {
      update(frame) {
        split.value = frame.controls.split;
        glow.value = frame.controls.glow;
        radius.value = frame.controls.radius;
      },
      async evaluate(inputs, evaluation) {
        map.value = inputs.image.texture as Texture;
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {},
      dispose() {
        geometry.dispose();
        material.dispose();
        placeholder.dispose();
      },
    };
  },
});
