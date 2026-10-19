// Ink pass: reads the colour image and the ID/normal buffer from the stage
// renderer and draws broadcast-cartoon line work at a constant pixel width:
//   - full-weight dark ink around performers and props (silhouettes, part
//     seams, overlaps and sharp creases),
//   - thinner lines in a darkened shade of the local colour on the set,
//     so the background stays quieter than the characters.

import { defineComponent } from '@lux/visual-sdk';
import { DataTexture, Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, Scene, Texture, Vector2 } from 'three/webgpu';
import { abs, clamp, dot, float, floor, max, mix, sqrt, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';

// TSL node typings are too narrow for freely composed shader graphs.
type Node = any;

const DIRECTIONS: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071],
];

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'one-more-dawn/ink',
    label: 'Cartoon Ink',
    description: 'Draws even, screen-space cartoon line work from a colour image and a matching ID/normal buffer.',
    tags: ['ink', 'outline', 'cartoon', 'effect'],
    inputs: {
      color: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Colour', description: 'Flat-shaded scene colour.' },
      lines: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Line buffer', description: 'View normal (rg) and line ID (b) for the same frame.' },
    },
    outputs: {
      image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'Colour with ink lines.' },
    },
    controls: {
      lineWidth: { type: 'number', label: 'Line weight', default: 3.4, min: 0, max: 8, step: 0.1, unit: 'px', group: 'Ink' },
      setLine: { type: 'number', label: 'Set line weight', default: 0.5, min: 0, max: 1, step: 0.01, group: 'Ink' },
      crease: { type: 'number', label: 'Crease lines', default: 0.35, min: 0, max: 1, step: 0.01, group: 'Ink' },
    },
    controlDescriptions: {
      lineWidth: 'Width of performer ink lines at 1080p output, in pixels. Scales with output height.',
      setLine: 'Width of set and background lines relative to performer lines.',
      crease: 'How readily folds within one part get a line (0 = silhouettes and seams only).',
    },
    lifecycle: { state: 'stateless', reset: 'seed' },
  },
  async create(context) {
    const fallback = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    fallback.needsUpdate = true;
    const px = uniform(new Vector2(1 / 1920, 1 / 1080));
    const figureRadius = uniform(1.2);
    const setRadius = uniform(0.7);
    const creaseLimit = uniform(0.45);
    const st: Node = uv().flipY();
    const colorSample: Node = texture(fallback, st);
    const samples: Node[] = [colorSample];
    const read = (offset: Node): Node => {
      const s: Node = texture(fallback, st.add(offset));
      samples.push(s);
      return s;
    };
    const centre: Node = read(vec2(0, 0));
    const normalOf = (s: Node): Node => {
      const xy: Node = s.rg.mul(2).sub(1);
      return vec3(xy, sqrt(max(float(0), float(1).sub(dot(xy, xy)))));
    };
    const idC: Node = centre.b;
    const nC: Node = normalOf(centre);
    const figC: Node = step(0.5, idC);
    // Performer group (0..7) from the ID; -1 for the set.
    const groupOf = (id: Node): Node => mix(float(-1), floor(id.mul(255).sub(129).div(15)), step(0.5, id));
    const gC: Node = groupOf(idC);

    // Silhouettes: group changes, full width. Interior seams and creases
    // inside one performer: inner ring only, so they draw thinner.
    let figureHits: Node = float(0);
    let setHits: Node = float(0);
    for (const [dx, dy] of DIRECTIONS) {
      for (const ring of [1, 0.55]) {
        const k: Node = read(vec2(dx, dy).mul(figureRadius.mul(ring)).mul(px));
        const idEdge: Node = step(0.0025, abs(k.b.sub(idC)));
        const figure: Node = max(figC, step(0.5, k.b));
        const silhouette: Node = step(0.5, abs(groupOf(k.b).sub(gC))).mul(figure);
        const interior: Node = idEdge.mul(float(1).sub(silhouette)).mul(figC).mul(ring < 1 ? 1 : 0);
        const creaseEdge: Node = step(creaseLimit, float(1).sub(dot(nC, normalOf(k)))).mul(float(1).sub(idEdge)).mul(figC).mul(ring < 1 ? 1 : 0);
        figureHits = figureHits.add(max(silhouette, max(interior, creaseEdge)));
      }
      const s: Node = read(vec2(dx, dy).mul(setRadius).mul(px));
      const setEdge: Node = step(0.0025, abs(s.b.sub(idC))).mul(float(1).sub(max(figC, step(0.5, s.b))));
      setHits = setHits.add(setEdge);
    }
    // Coverage-style anti-aliasing from the number of differing samples.
    const figureInk: Node = clamp(figureHits.div(3), 0, 1);
    const setInk: Node = clamp(setHits.div(2.5), 0, 1).mul(0.85);
    const base: Node = colorSample.rgb;
    const setTone: Node = base.mul(vec3(0.32, 0.27, 0.36));
    const ink: Node = vec3(0.05, 0.035, 0.03);
    let color: Node = mix(base, setTone, setInk);
    color = mix(color, ink, figureInk);

    const material = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    material.fragmentNode = vec4(color, 1);
    material.toneMapped = false;
    const geometry = new PlaneGeometry(2, 2);
    const scene = new Scene();
    scene.add(new Mesh(geometry, material));
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    let lineWidth = 3.4;
    let setLine = 0.5;
    let crease = 0.35;
    void context;
    return {
      update(frame) {
        lineWidth = frame.controls.lineWidth;
        setLine = frame.controls.setLine;
        crease = frame.controls.crease;
      },
      async evaluate(inputs, evaluation) {
        const colorTexture = inputs.color.texture as Texture;
        const lineTexture = inputs.lines.texture as Texture;
        colorSample.value = colorTexture;
        for (let i = 1; i < samples.length; i += 1) {
          samples[i].value = lineTexture;
        }
        const scale = inputs.color.height / 1080;
        px.value.set(1 / inputs.color.width, 1 / inputs.color.height);
        figureRadius.value = (lineWidth * scale) / 2;
        setRadius.value = Math.max(0.5, (lineWidth * setLine * scale) / 2);
        creaseLimit.value = 0.05 + (1 - crease) * 0.9;
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {},
      dispose() {
        geometry.dispose();
        material.dispose();
        fallback.dispose();
      },
    };
  },
});
