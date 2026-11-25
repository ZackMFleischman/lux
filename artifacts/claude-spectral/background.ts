import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
} from 'three/webgpu';
import { color, exp, float, mix, sin, uniform, uv, vec2 } from 'three/tsl';

/**
 * Scene-local backdrop for living-pearl.ts; no lights, textures, noise, or
 * renderer changes. The pearl remains the brightest and most detailed object.
 *
 * Integration:
 *   import { createPearlHabitat } from './background.ts';
 *   const habitat = createPearlHabitat();
 *   scene.add(habitat.group);
 *   // update(frame), after time.value has been updated:
 *   habitat.update(time.value);
 *   // dispose():
 *   habitat.dispose();
 *
 * Include this file in the complete submitted source bundle. This proposal has
 * not been built in Studio. Keep the existing dark scene.background and motes.
 */
export function createPearlHabitat() {
  const group = new Group();
  const clock = uniform(0);
  const planeGeometry = new PlaneGeometry(24, 15);
  const planeMaterial = new MeshBasicNodeMaterial({ depthWrite: false });
  const p = uv().sub(0.5).mul(vec2(1.6, 1));

  // Only trigonometric fields: broad drifting folds, with no recursive noise
  // expansion. Named variables keep generated WGSL compact.
  const warp = sin(p.y.mul(5.2).add(clock.mul(0.055))).mul(0.105).toVar();
  const leftDistance = p.x.add(0.34).add(warp).toVar();
  const rightDistance = p.x.sub(0.38).sub(warp.mul(0.7)).toVar();
  const leftVeil = exp(leftDistance.mul(leftDistance).mul(-38)).toVar();
  const rightVeil = exp(rightDistance.mul(rightDistance).mul(-24)).toVar();
  const leftThreads = sin(leftDistance.mul(93).add(p.y.mul(9)).add(clock.mul(0.09)))
    .mul(0.5).add(0.5).pow(5).mul(0.24).add(0.76);
  const rightThreads = sin(rightDistance.mul(67).sub(p.y.mul(12)).sub(clock.mul(0.07)))
    .mul(0.5).add(0.5).pow(4).mul(0.2).add(0.8);
  const verticalFade = exp(p.y.mul(p.y).mul(-2.7));
  const radius = p.mul(vec2(1.05, 1.4)).length().toVar();
  const centralShelter = float(1).sub(exp(radius.mul(radius).mul(-18)).mul(0.91));
  const lowMist = exp(p.y.add(0.29).pow(2).mul(-24))
    .mul(exp(p.x.mul(p.x).mul(-1.9)));
  const base = mix(color('#010309'), color('#10102b'), radius.mul(1.4).clamp(0, 1));
  planeMaterial.colorNode = base
    .add(color('#0c7f80').mul(leftVeil).mul(leftThreads).mul(0.32))
    .add(color('#69377c').mul(rightVeil).mul(rightThreads).mul(0.38))
    .add(color('#193958').mul(lowMist).mul(0.26))
    .mul(verticalFade.mul(0.6).add(0.4))
    .mul(centralShelter.mul(0.75).add(0.25));
  const plane = new Mesh(planeGeometry, planeMaterial);
  plane.position.set(0, 0, -7);
  plane.renderOrder = -20;
  group.add(plane);

  const membranes = new Group();
  group.add(membranes);
  const membraneGeometries: BufferGeometry[] = [];
  const membraneMaterials: MeshBasicNodeMaterial[] = [];

  // Real tapered ribbons frame the outer edges, like enormous translucent gills.
  // Their depth stays behind the subject. Each has just 84 triangles.
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const layer = i % 3;
    const segments = 42;
    const positions: number[] = [];
    const coordinates: number[] = [];
    const indices: number[] = [];
    for (let j = 0; j <= segments; j++) {
      const t = j / segments;
      const y = (t - 0.5) * 9;
      const arch = Math.sin(t * Math.PI);
      const x = side * (3.0 + layer * 0.61 - arch * 0.52
        + Math.sin(t * 7.4 + layer * 0.9) * 0.17);
      const width = Math.pow(arch, 1.1) * (0.28 + layer * 0.08);
      const z = -3.7 - layer * 0.65 + Math.sin(t * 5 + layer) * 0.27;
      positions.push(x - width, y, z, x + width, y, z);
      coordinates.push(0, t, 1, t);
      if (j < segments) {
        const k = j * 2;
        indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(coordinates), 2));
    geometry.setIndex(indices);
    const material = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
    const edgeFade = sin(uv().x.mul(Math.PI)).clamp(0, 1).pow(1.8);
    const endFade = sin(uv().y.mul(Math.PI)).clamp(0, 1).pow(0.7);
    const ribs = sin(uv().y.mul(112).add(uv().x.mul(5)).add(clock.mul(0.08)))
      .mul(0.5).add(0.5).pow(8);
    material.colorNode = color(side < 0 ? '#28cbb8' : '#9d57d0');
    material.opacityNode = edgeFade.mul(endFade).mul(ribs.mul(0.055).add(0.035));
    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = -10 + layer;
    membranes.add(mesh);
    membraneGeometries.push(geometry);
    membraneMaterials.push(material);
  }

  return {
    group,
    update(timeSeconds: number) {
      clock.value = timeSeconds;
      membranes.rotation.z = Math.sin(timeSeconds * 0.055) * 0.014;
      membranes.position.y = Math.sin(timeSeconds * 0.07) * 0.045;
    },
    dispose() {
      planeGeometry.dispose();
      planeMaterial.dispose();
      for (const geometry of membraneGeometries) geometry.dispose();
      for (const material of membraneMaterials) material.dispose();
    },
  };
}
