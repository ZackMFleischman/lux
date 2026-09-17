import { defineComponent } from '@lux/visual-sdk';
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, DataTexture, DoubleSide,
  Mesh, MeshBasicNodeMaterial, NormalBlending, OrthographicCamera, PlaneGeometry,
  Scene, type Texture,
} from 'three/webgpu';
import { texture, uniform, uv, vec4 } from 'three/tsl';
import { MAX_PATHS, POINTS, samplePath, writeStrip } from './geometry.ts';
import { collarShader, strandShader } from './strand-shader.ts';

export default defineComponent({
  metadata: {
    declarationVersion: 1,
    key: 'fiber-heart/neon-path-renderer',
    label: 'Neon Cables & Ribbons',
    description: 'Mesh-strip path renderer with luminous filaments, traveling pulses, glossy ribbons, glass-style cables and attached metallic collars.',
    tags: ['renderer', 'neon', 'ribbons', 'cables'],
    inputs: {
      image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Background', description: 'Image behind the strands.' },
      paths: { type: { kind: 'paths2d', version: 1, coordinateSpace: 'canvas-height' }, label: 'Paths', description: 'Up to 16 paths with at most 97 points per path.' },
    },
    outputs: {
      image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'Strands composited over the background.' },
    },
    controls: {
      brightness: { type: 'number', group: 'Light', label: 'Strand brightness', default: 1.3, min: 0, max: 4, step: 0.01 },
      palette: { type: 'number', group: 'Light', label: 'Cyan to magenta', default: 0.5, min: 0, max: 1, step: 0.01 },
      pulseSpeed: { type: 'number', group: 'Energy', label: 'Pulse speed', default: 0.12, min: -1, max: 1, step: 0.01 },
      pulseWidth: { type: 'number', group: 'Energy', label: 'Pulse length', default: 0.07, min: 0.01, max: 0.3, step: 0.005 },
      pulseStrength: { type: 'number', group: 'Energy', label: 'Pulse strength', default: 2, min: 0, max: 6, step: 0.01 },
      ribbons: { type: 'number', group: 'Structure', label: 'Broad ribbons', default: 3, min: 0, max: 6, step: 1 },
      ribbonWidth: { type: 'number', group: 'Structure', label: 'Ribbon width', default: 4, min: 1, max: 8, step: 0.05 },
      cables: { type: 'number', group: 'Structure', label: 'Glass-style cables', default: 4, min: 0, max: 8, step: 1 },
      collars: { type: 'number', group: 'Structure', label: 'Cable collars', default: 0.7, min: 0, max: 1, step: 0.01 },
    },
    controlDescriptions: {
      brightness: 'Strength of strand color and highlights; zero leaves the background untouched.',
      palette: 'Shifts alternating strands toward cyan or magenta.',
      pulseSpeed: 'Signed circuits per second. Zero freezes each pulse at its phase.',
      pulseWidth: 'Fraction of the route illuminated by each traveling packet.',
      pulseStrength: 'Extra energy in traveling packets; zero gives steady strands.',
      ribbons: 'First paths rendered as broad dark glossy ribbons. Remaining paths become cables or neon.',
      ribbonWidth: 'Ribbon width as a multiple of the incoming path width.',
      cables: 'Paths after the ribbons rendered as glass-style strips, without physical refraction.',
      collars: 'Visibility of two metallic collars on each glass-style cable.',
    },
    lifecycle: { state: 'stateless', reset: 'seed' },
  },
  async create(context) {
    const aspect = context.settings.width / context.settings.height;
    const camera = new OrthographicCamera(-aspect / 2, aspect / 2, 0.5, -0.5, 0.1, 10);
    camera.position.z = 2;
    const scene = new Scene();
    const fallback = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    fallback.needsUpdate = true;
    const backgroundNode = texture(fallback, uv().flipY());
    const backgroundMaterial = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
    backgroundMaterial.fragmentNode = backgroundNode;
    const backgroundGeometry = new PlaneGeometry(aspect, 1);
    const background = new Mesh(backgroundGeometry, backgroundMaterial);
    background.renderOrder = -100;
    scene.add(background);

    const time = uniform(0);
    const brightness = uniform(1.3);
    const speed = uniform(0.12);
    const pulseWidth = uniform(0.07);
    const strength = uniform(2);
    const collarGeometry = new PlaneGeometry(1, 1);
    const collarMaterial = new MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false });
    const collarOpacity = uniform(0.7);
    const collarColor = collarShader(uv());
    collarMaterial.colorNode = collarColor.rgb;
    collarMaterial.opacityNode = collarColor.a.mul(collarOpacity);
    const strands = Array.from({ length: MAX_PATHS }, (_, index) => {
      const positions = new Float32Array(POINTS * 6);
      const uvs = new Float32Array(POINTS * 4);
      const indices = new Uint16Array((POINTS - 1) * 6);
      for (let i = 0; i < POINTS - 1; i++) {
        const a = i * 2;
        indices.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6);
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
      geometry.setIndex(new BufferAttribute(indices, 1));
      const tint = uniform(0.5);
      const phase = uniform(index * 0.137);
      const style = uniform(0);
      const opacity = uniform(1);
      const length = uniform(1);
      const material = new MeshBasicNodeMaterial({
        transparent: true, depthTest: false, depthWrite: false, side: DoubleSide,
      });
      const color = strandShader(uv(), vec4(tint, brightness, phase, 0), vec4(time, speed, pulseWidth, strength), vec4(style, opacity, length, 0));
      material.colorNode = color.rgb;
      material.opacityNode = color.a;
      const mesh = new Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = index * 3;
      scene.add(mesh);
      const collars = [0, 1].map(() => {
        const collar = new Mesh(collarGeometry, collarMaterial);
        collar.frustumCulled = false;
        collar.renderOrder = index * 3 + 1;
        scene.add(collar);
        return collar;
      });
      return { mesh, geometry, material, positions, uvs, tint, phase, style, opacity, length, collars };
    });
    let appearance = { palette: 0.5, ribbons: 3, ribbonWidth: 4, cables: 4, collars: 0.7 };

    return {
      update(frame) {
        time.value = frame.timeSeconds;
        brightness.value = frame.controls.brightness;
        speed.value = frame.controls.pulseSpeed;
        pulseWidth.value = frame.controls.pulseWidth;
        strength.value = frame.controls.pulseStrength;
        appearance = frame.controls;
      },
      async evaluate(inputs, evaluation) {
        const paths = inputs.paths.data.paths;
        if (paths.length > MAX_PATHS || paths.some(path => path.points.length > POINTS)) {
          throw Error('Neon renderer supports at most 16 paths of 97 points; no paths were truncated');
        }
        backgroundNode.value = inputs.image.texture as Texture;
        collarOpacity.value = appearance.collars;
        const ribbonCount = Math.round(appearance.ribbons);
        const cableCount = Math.round(appearance.cables);
        for (let index = 0; index < strands.length; index++) {
          const strand = strands[index]!;
          const path = paths[index];
          strand.mesh.visible = Boolean(path && path.points.length >= 2 && brightness.value > 0);
          for (const collar of strand.collars) collar.visible = false;
          if (!path || !strand.mesh.visible) continue;
          const style = index < ribbonCount ? 1 : index < ribbonCount + cableCount ? 2 : 0;
          const widthScale = style === 1 ? appearance.ribbonWidth : style === 2 ? 1.7 : 2.8;
          writeStrip(path.points, strand.positions, strand.uvs, widthScale);
          strand.geometry.getAttribute('position').needsUpdate = true;
          strand.geometry.getAttribute('uv').needsUpdate = true;
          strand.geometry.setDrawRange(0, (path.points.length - 1) * 6);
          strand.style.value = style;
          strand.length.value = path.points[path.points.length - 1]!.distance;
          strand.phase.value = (path.styleSeed % 997) / 997;
          strand.tint.value = Math.min(1, Math.max(0, appearance.palette + (index % 2 ? 0.35 : -0.35)));
          strand.opacity.value = path.opacity;
          const blending = style === 0 ? AdditiveBlending : NormalBlending;
          if (strand.material.blending !== blending) {
            strand.material.blending = blending;
            strand.material.needsUpdate = true;
          }
          strand.collars.forEach((collar, collarIndex) => {
            collar.visible = style === 2 && appearance.collars > 0 && path.opacity > 0.99;
            if (!collar.visible) return;
            const point = samplePath(path.points, 0.17 + collarIndex * 0.5 + index * 0.037);
            collar.position.set(point.x, point.y, 0);
            collar.rotation.z = point.angle;
            collar.scale.set(0.025, path.points[0]!.width * widthScale * 1.4, 1);
          });
        }
        return { image: await evaluation.render(scene, camera) };
      },
      reset() { time.value = 0; },
      dispose() {
        for (const strand of strands) {
          strand.geometry.dispose();
          strand.material.dispose();
        }
        collarGeometry.dispose();
        collarMaterial.dispose();
        backgroundGeometry.dispose();
        backgroundMaterial.dispose();
        fallback.dispose();
      },
    };
  },
});
