import { defineComponent } from '@lux/visual-sdk';
import {
  Scene, Color, Group, Mesh, CylinderGeometry, SphereGeometry,
  MeshStandardNodeMaterial, MeshBasicNodeMaterial, OrthographicCamera,
  AmbientLight, DirectionalLight, Vector3,
} from 'three/webgpu';

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'dance/space-needles',
    label: 'Dancing Space Needle Dabbers',
    description: 'Fifty neon Space Needle characters performing a staggered dab.',
    tags: ['dance', 'architecture'],
    inputs: {},
    outputs: {
      image: {
        type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' },
        label: 'Image',
        description: 'The dancing formation.',
      },
    },
    controls: {
      palette: {
        type: 'number', label: 'Palette: 0 Fire / 1 Sunset / 2 Acid / 3 Rainbow', default: 0,
        min: 0, max: 3, step: 1,
      },
      hueShift: {
        type: 'number', label: 'Palette hue shift', default: 0,
        min: 0, max: 1, step: 0.01,
      },
      paletteSpread: {
        type: 'number', label: 'Palette spread', default: 1,
        min: 0, max: 2, step: 0.01,
      },
      saturation: {
        type: 'number', label: 'Color saturation', default: 1,
        min: 0, max: 1, step: 0.01,
      },
      colorBrightness: {
        type: 'number', label: 'Tower brightness', default: 0.85,
        min: 0.1, max: 1, step: 0.01,
      },
      bodyHueOffset: {
        type: 'number', label: 'Tower body hue offset', default: 0,
        min: -0.5, max: 0.5, step: 0.01,
      },
      colorCycleSpeed: {
        type: 'number', label: 'Palette cycle speed', default: 0,
        min: 0, max: 0.5, step: 0.005,
      },
      backgroundBrightness: {
        type: 'number', label: 'Background brightness', default: 0.15,
        min: 0, max: 1, step: 0.01,
      },
      danceSpeed: { type: 'number', label: 'Dance speed', default: 1.2, min: 0, max: 3, step: 0.01 },
      dabDepth: { type: 'number', label: 'Dab depth', default: 1, min: 0, max: 1.4, step: 0.01 },
    },
    controlDescriptions: {
      palette: 'Select Fire, Sunset, Acid neon, or full Rainbow.',
      hueShift: 'Rotate all tower hues.',
      paletteSpread: 'Palette width. Zero gives one hue.',
      saturation: 'One is vivid; zero is grayscale.',
      colorBrightness: 'Brightness without adding pastel white.',
      bodyHueOffset: 'Shift supports and deck relative to arms and roof.',
      colorCycleSpeed: 'Hue cycles per second. Zero keeps colors fixed.',
      backgroundBrightness: 'Warm background level. Zero is black.',
      danceSpeed: 'Speed of the repeating dance.',
      dabDepth: 'Strength of the head dip and arm pose.',
    },
    lifecycle: { state: 'stateless', reset: 'seed' },
  },
  async create(context) {
    const scene = new Scene();
    scene.background = new Color(0x080b22);
    const aspect = context.settings.width / context.settings.height;
    const camera = new OrthographicCamera(-9 * aspect, 9 * aspect, 9, -9, 0.1, 100);
    camera.position.set(0, 0, 30);
    const rod = new CylinderGeometry(1, 1, 1, 8);
    const saucer = new CylinderGeometry(0.39, 0.66, 0.17, 24);
    const roof = new CylinderGeometry(0.08, 0.66, 0.19, 24);
    const glass = new CylinderGeometry(0.43, 0.48, 0.18, 24);
    const ball = new SphereGeometry(1, 8, 6);
    const steel = new MeshBasicNodeMaterial({ color: 0xff6500 });
    const windows = new MeshBasicNodeMaterial({ color: 0x641209 });
    const accents = [0xffdd00, 0xff7900, 0xff3045, 0xffb000, 0xff4930].map(
      color => new MeshBasicNodeMaterial({ color }),
    );
    scene.add(new AmbientLight(0xffe0b0, 2));
    const light = new DirectionalLight(0xffffff, 4);
    light.position.set(-4, 8, 12);
    scene.add(light);
    const up = new Vector3(0, 1, 0);
    const delta = new Vector3();
    function segment(parent: Group, material: MeshStandardNodeMaterial | MeshBasicNodeMaterial) {
      const mesh = new Mesh(rod, material);
      parent.add(mesh);
      return mesh;
    }
    function link(mesh: Mesh, ax: number, ay: number, az: number, bx: number, by: number, bz: number, radius: number) {
      delta.set(bx - ax, by - ay, bz - az);
      mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
      mesh.scale.set(radius, delta.length(), radius);
      mesh.quaternion.setFromUnitVectors(up, delta.normalize());
    }
    const dancers: { root: Group; head: Group; arms: Mesh[] }[] = [];
    for (let i = 0; i < 50; i++) {
      const root = new Group();
      root.position.set((i % 10 - 4.5) * 3.05, (2 - Math.floor(i / 10)) * 3.35 - 1.05, 0);
      scene.add(root);
      const accent = accents[Math.floor(i / 10)];
      // Three splayed supports converge below the observation deck.
      for (let leg = 0; leg < 3; leg++) {
        const angle = leg * Math.PI * 2 / 3 + Math.PI / 6;
        const x = Math.cos(angle) * 0.48;
        const z = Math.sin(angle) * 0.3;
        link(segment(root, steel), x, 0, z, x * 0.24, 1.05, z * 0.24, 0.047);
        link(segment(root, steel), x * 0.24, 1.05, z * 0.24, x * 0.4, 1.92, z * 0.4, 0.047);
      }
      const head = new Group();
      head.position.y = 1.88;
      root.add(head);
      const lower = new Mesh(saucer, steel);
      head.add(lower);
      const deck = new Mesh(glass, windows);
      deck.position.y = 0.15;
      head.add(deck);
      const top = new Mesh(roof, accent);
      top.position.y = 0.32;
      head.add(top);
      link(segment(head, steel), 0, 0.4, 0, 0, 0.9, 0, 0.023);
      const beacon = new Mesh(ball, accent);
      beacon.scale.setScalar(0.045);
      beacon.position.y = 0.91;
      head.add(beacon);
      const arms = [segment(root, accent), segment(root, accent), segment(root, accent), segment(root, accent)];
      dancers.push({ root, head, arms });
    }
    return {
      update(frame) {
        const time = frame.timeSeconds * frame.controls.danceSpeed * 3;
        const c = frame.controls;
        const preset = Math.round(c.palette);
        const startHue = [0.005, 0.92, 0.18, 0][preset];
        const hueWidth = [0.12, 0.22, 0.65, 0.85][preset] * c.paletteSpread;
        const cycle = frame.timeSeconds * c.colorCycleSpeed;
        const wrapHue = (hue: number) => ((hue % 1) + 1) % 1;
        // Keep lightness below 0.5 to avoid whitening saturated colors.
        const level = c.colorBrightness * 0.5;
        const baseHue = startHue + c.hueShift + cycle;
        steel.color.setHSL(wrapHue(baseHue + hueWidth * 0.4 + c.bodyHueOffset), c.saturation, level);
        windows.color.setHSL(wrapHue(baseHue), c.saturation, 0.025);
        for (let row = 0; row < accents.length; row++) {
          accents[row].color.setHSL(wrapHue(baseHue + row / 4 * hueWidth), c.saturation, level);
        }
        scene.background = new Color().setRGB(
          c.backgroundBrightness * 0.02,
          c.backgroundBrightness * 0.001,
          c.backgroundBrightness * 0.003,
        );
        for (let i = 0; i < dancers.length; i++) {
          const dancer = dancers[i];
          const pulse = (0.5 + 0.5 * Math.sin(time - (i % 10) * 0.28 - Math.floor(i / 10) * 0.4));
          const dab = (0.35 + 0.65 * pulse) * frame.controls.dabDepth;
          dancer.root.rotation.z = 0.08 * Math.sin(time - i * 0.15) - dab * 0.1;
          dancer.head.rotation.z = dab * 0.38;
          dancer.head.rotation.x = dab * 0.18;
          // Right arm extends high; left forearm folds across the saucer face.
          link(dancer.arms[0], 0.13, 1.6, 0.12, 0.69, 1.65 + dab * 0.25, 0.14, 0.065);
          link(dancer.arms[1], 0.69, 1.65 + dab * 0.25, 0.14, 1.19, 1.68 + dab * 0.65, 0.16, 0.059);
          link(dancer.arms[2], -0.13, 1.6, 0.12, -0.7, 1.52 + dab * 0.05, 0.22, 0.065);
          link(dancer.arms[3], -0.7, 1.52 + dab * 0.05, 0.22, -0.16 + dab * 0.2, 1.72 + dab * 0.39, 0.59, 0.059);
        }
      },
      async evaluate(_inputs, evaluation) {
        return { image: await evaluation.render(scene, camera) };
      },
      reset(_seed) {},
      dispose() {
        rod.dispose();
        saucer.dispose();
        roof.dispose();
        glass.dispose();
        ball.dispose();
        steel.dispose();
        windows.dispose();
        for (const material of accents) material.dispose();
      },
    };
  },
});
