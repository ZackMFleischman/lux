import { readFileSync, writeFileSync } from 'node:fs';
const dir = import.meta.dirname;
const helper = readFileSync(dir + '/flare-rig.ts', 'utf8');
for (const kind of ['optical', 'diffraction']) {
  const label = kind === 'optical' ? 'Layered Optical Flare' : 'Webb Diffraction Star';
  const component = `import { defineComponent } from '@lux/visual-sdk';
import { Scene, PerspectiveCamera, Vector3, Color } from 'three/webgpu';
import { createFlareRig } from './flare-rig.ts';

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'lux/${kind}-flare',
    label: '${label}',
    description: '${kind === 'optical' ? 'Transparent camera-axis optical ghosts with soft bloom and a restrained optional streak.' : 'Six fine diffraction rays with an independent faint horizontal pair, soft stellar core, and no flashing.'}',
    tags: ['cosmos', 'flare', 'light'],
    inputs: {},
    outputs: {
      image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Flare', description: 'Transparent additive flare layer.' },
    },
    lifecycle: { state: 'stateful', reset: 'seed' },
    controlDescriptions: {
      intensity: 'Light energy; choose a small value for distant stars.',
      size: 'Radius relative to screen half-height, independent of world distance.',
      hue: 'Subtle warm or cool source color.',
      saturation: 'Color strength; lower values preserve a white-hot core.',
      x: 'Normalized screen position; -1 is left and +1 is right.',
      y: 'Normalized screen position; -1 is bottom and +1 is top.',
      ghosts: 'Strength of chromatic aperture ghosts along the optical axis.',
      streak: 'Strength of the thin horizontal streak; low by default.',
      secondary: 'Optional faint horizontal pair in addition to six primary rays.',
      rotation: 'Rotation of the diffraction pattern in radians.',
    },
    controls: {
      intensity: { type: 'number', label: 'Brightness', default: 1, min: 0, max: 5, step: 0.01, group: 'Light' },
      size: { type: 'number', label: 'Angular size', default: 0.42, min: 0.01, max: 1.5, step: 0.01, group: 'Light' },
      hue: { type: 'number', label: 'Tint hue', default: 0.60, min: 0, max: 1, step: 0.01, group: 'Light' },
      saturation: { type: 'number', label: 'Tint saturation', default: 0.30, min: 0, max: 1, step: 0.01, group: 'Light' },
      x: { type: 'number', label: 'Horizontal position', default: -0.42, min: -1.2, max: 1.2, step: 0.01, group: 'Position' },
      y: { type: 'number', label: 'Vertical position', default: 0.22, min: -1.2, max: 1.2, step: 0.01, group: 'Position' },
      ghosts: { type: 'number', label: 'Ghost layers', default: 0.8, min: 0, max: 3, step: 0.01, group: 'Optics' },
      streak: { type: 'number', label: 'Horizontal streak', default: 0.08, min: 0, max: 1, step: 0.01, group: 'Optics' },
      secondary: { type: 'number', label: 'Faint secondary spikes', default: 0.12, min: 0, max: 1, step: 0.01, group: 'Optics' },
      rotation: { type: 'number', label: 'Diffraction rotation', default: 0, min: -3.14159, max: 3.14159, step: 0.01, group: 'Optics' },
    },
  },
  async create(context) {
    const scene = new Scene();
    const camera = new PerspectiveCamera(50, context.settings.width / context.settings.height, 0.1, 100);
    camera.position.z = 5;
    camera.updateMatrixWorld();
    const rig = createFlareRig('${kind}');
    scene.add(rig.root);
    const position = new Vector3();
    const tint = new Color();
    return {
      update(frame) {
        const c = frame.controls;
        position.set(c.x, c.y, 0.5).unproject(camera);
        tint.setHSL(c.hue, c.saturation, 0.78);
        rig.update(camera, position, { brightness: c.intensity, scale: c.size, tint,
          ghosts: c.ghosts, streak: c.streak, secondarySpikes: c.secondary, rotation: c.rotation });
      },
      async evaluate(_inputs, evaluation) { return { image: await evaluation.render(scene, camera) }; },
      reset() {},
      dispose() { rig.dispose(); },
    };
  },
});
`;
  const applicable = kind === 'optical' ? ['ghosts', 'streak'] : ['secondary', 'rotation'];
  const cleaned = component
    .replace('ghosts: c.ghosts, streak: c.streak, secondarySpikes: c.secondary, rotation: c.rotation', kind === 'optical' ? 'ghosts: c.ghosts, streak: c.streak' : 'secondarySpikes: c.secondary, rotation: c.rotation')
    .split('\n').filter(line => !['ghosts','streak','secondary','rotation'].some(id => (line.trim().startsWith(id + ': {') || line.trim().startsWith(id + ": '")) && !applicable.includes(id))).join('\n');
  writeFileSync(dir + '/' + kind + '.ts', cleaned);
  const source = { sdkVersion: '0.4.0', entry: kind + '.ts', files: { [kind + '.ts']: cleaned, 'flare-rig.ts': helper } };
  writeFileSync(dir + '/' + kind + '-component.json', JSON.stringify(source, null, 2));
  const id = '916e8f01-1111-4111-8111-111111111111';
  const controls = ['intensity', 'size', 'hue', 'saturation', 'x', 'y', ...applicable];
  const visual = `import { defineVisual } from '@lux/visual-sdk';
import flare from './${kind}.ts';
export default defineVisual({
  label: '${label} Study',
  definitions: { flare },
  nodes: [{ id: '${id}', definition: 'flare' }],
  edges: [],
  output: { nodeId: '${id}', portId: 'image' },
  expose: ${JSON.stringify(controls.map(controlId => ({ id: controlId, nodeId: id, controlId })))},
});\n`;
  // Study-only opaque backing lets an 8-bit PNG show low-energy gradients faithfully.
  // The published component remains transparent; its shader helper is unchanged.
  const study = cleaned.replace('const scene = new Scene();', "const scene = new Scene();\n    scene.background = new Color('#020309');");
  writeFileSync(dir + '/' + kind + '-visual.json', JSON.stringify({ ...source, entry: 'visual.ts', files: { ...source.files, [kind + '.ts']: study, 'visual.ts': visual } }, null, 2));
  const backdrop = `import { defineComponent } from '@lux/visual-sdk';
import { Scene, Mesh, PlaneGeometry, OrthographicCamera, MeshBasicNodeMaterial, Texture } from 'three/webgpu';
import { texture, uv, vec3, vec4 } from 'three/tsl';
export default defineComponent({
  metadata: { declarationVersion: 1, key: 'test/tinted-backing', label: 'Tinted backing', description: 'Test-only premultiplied compositing over a colored background.', tags: [],
    inputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Flare', description: 'Unmodified transparent component output.' } },
    outputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Composite', description: 'Opaque test composite.' } },
    controls: {}, controlDescriptions: {}, lifecycle: { state: 'stateful', reset: 'seed' } },
  async create() {
    const scene = new Scene();
    const camera = new OrthographicCamera(-1,1,1,-1,0,1);
    const geometry = new PlaneGeometry(2,2);
    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false, toneMapped: false });
    const placeholder = new Texture();
    const sampled = texture(placeholder, uv());
    const backing = vec3(uv().x.mul(0.055).add(0.01), 0.028, uv().y.mul(0.10).add(0.015));
    material.fragmentNode = vec4(sampled.rgb.add(backing.mul(sampled.a.oneMinus())), 1);
    scene.add(new Mesh(geometry, material));
    return { update() {}, async evaluate(inputs, evaluation) { sampled.value = inputs.image.texture as Texture; return { image: await evaluation.render(scene,camera) }; }, reset() {}, dispose() { geometry.dispose(); material.dispose(); placeholder.dispose(); } };
  },
});`;
  const backingId = '916e8f02-2222-4222-8222-222222222222';
  const composite = visual.replace("import flare", "import backing from './backing.ts';\nimport flare")
    .replace('definitions: { flare }', 'definitions: { flare, backing }')
    .replace("definition: 'flare' }]", "definition: 'flare' }, { id: '" + backingId + "', definition: 'backing' }]")
    .replace('edges: []', `edges: [{ id: '916e8f03-3333-4333-8333-333333333333', from: { nodeId: '${id}', portId: 'image' }, to: { nodeId: '${backingId}', portId: 'image' }, delay: 'none' }]`)
    .replace(`output: { nodeId: '${id}'`, `output: { nodeId: '${backingId}'`);
  writeFileSync(dir + '/' + kind + '-composite-visual.json', JSON.stringify({ ...source, entry: 'visual.ts', files: { ...source.files, 'visual.ts': composite, 'backing.ts': backdrop } }, null, 2));
}
