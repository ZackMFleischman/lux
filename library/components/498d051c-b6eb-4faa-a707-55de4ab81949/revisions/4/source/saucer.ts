import {
  AdditiveBlending, AmbientLight, Color, CylinderGeometry, DataTexture,
  DirectionalLight, DoubleSide, Group, LinearFilter, Mesh,
  MeshBasicNodeMaterial, MeshStandardNodeMaterial, PlaneGeometry,
  RGBAFormat, SphereGeometry, SRGBColorSpace, TorusGeometry, UnsignedByteType,
} from 'three/webgpu';
import { float, smoothstep, uniform, uv, vec3 } from 'three/tsl';
import { pilotPixels } from './pilot-pixels.ts';

/** Scene-local primitive as well as the Library image component's craft. */
export function createAlienSaucer() {
  const root = new Group();
  const hull = new Group();
  root.add(hull);
  const sphere = new SphereGeometry(1, 48, 24);
  const ring = new TorusGeometry(1.18, 0.045, 10, 80);
  const domeGeometry = new SphereGeometry(0.73, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const arcGeometry = new TorusGeometry(0.73, 0.012, 6, 64, Math.PI);
  const plane = new PlaneGeometry(1, 1);
  const beamGeometry = new CylinderGeometry(0.12, 0.85, 1.65, 40, 1, true);
  const metal = new MeshStandardNodeMaterial({ color: 0xabbccf, metalness: 0.78, roughness: 0.24 });
  const lowerMetal = new MeshStandardNodeMaterial({ color: 0x303749, metalness: 0.7, roughness: 0.3 });
  const glow = new MeshBasicNodeMaterial({ color: 0x88ffe2 });
  glow.toneMapped = false;
  const glass = new MeshBasicNodeMaterial({ color: 0xb0ffe9, transparent: true, opacity: 0.1, depthWrite: false, side: DoubleSide });
  const shine = new MeshBasicNodeMaterial({ color: 0xd8fff5, transparent: true, opacity: 0.55, depthWrite: false });
  const body = new Mesh(sphere, metal);
  body.scale.set(1.25, 0.19, 0.78);
  hull.add(body);
  const bottom = new Mesh(sphere, lowerMetal);
  bottom.scale.set(0.94, 0.24, 0.62);
  bottom.position.y = -0.09;
  hull.add(bottom);
  const rim = new Mesh(ring, glow);
  rim.rotation.x = Math.PI / 2;
  rim.scale.y = 0.66;
  hull.add(rim);
  const dome = new Mesh(domeGeometry, glass);
  dome.position.y = 0.12;
  dome.scale.z = 0.68;
  dome.renderOrder = 4;
  hull.add(dome);
  const arch = new Mesh(arcGeometry, shine);
  arch.position.set(0, 0.12, 0.03);
  hull.add(arch);
  const gleam = new Mesh(arcGeometry, shine);
  gleam.scale.set(0.38, 0.93, 1);
  gleam.position.set(-0.13, 0.12, 0.37);
  hull.add(gleam);

  const texture = new DataTexture(pilotPixels(), 192, 192, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = true;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  const pilotMaterial = new MeshBasicNodeMaterial({ map: texture, transparent: true, alphaTest: 0.02, side: DoubleSide });
  pilotMaterial.toneMapped = false;
  const pilot = new Mesh(plane, pilotMaterial);
  pilot.position.set(0, 0.43, 0.38);
  pilot.scale.setScalar(0.7);
  hull.add(pilot);
  const lamps: Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const angle = Math.PI * 2 * i / 9;
    const lamp = new Mesh(sphere, glow);
    lamp.position.set(Math.cos(angle) * 1.09, -0.025, Math.sin(angle) * 0.67);
    lamp.scale.set(0.065, 0.04, 0.045);
    hull.add(lamp);
    lamps.push(lamp);
  }
  const legGeometry = new CylinderGeometry(0.028, 0.038, 0.5, 12);
  const legs: { pivot: Group; direction: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const direction = i === 0 ? -1 : 1;
    const pivot = new Group();
    pivot.position.set(i === 0 ? -0.65 : i === 1 ? 0.65 : 0, -0.17, i === 2 ? -0.46 : 0.32);
    const strut = new Mesh(legGeometry, metal);
    strut.position.y = -0.25;
    pivot.add(strut);
    const joint = new Mesh(sphere, lowerMetal);
    joint.scale.setScalar(0.065);
    pivot.add(joint);
    const foot = new Mesh(sphere, metal);
    foot.scale.set(0.14, 0.045, 0.11);
    foot.position.y = -0.5;
    pivot.add(foot);
    hull.add(pivot);
    legs.push({ pivot, direction });
  }
  const beamGain = uniform(0);
  const beamMaterial = new MeshBasicNodeMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
  beamMaterial.colorNode = vec3(0.22, 1, 0.77);
  beamMaterial.opacityNode = uv().y.pow(1.8).mul(beamGain).mul(0.16);
  const beam = new Mesh(beamGeometry, beamMaterial);
  beam.position.y = -1;
  root.add(beam);
  const exhaustGain = uniform(0);
  const exhaustMaterial = new MeshBasicNodeMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false });
  exhaustMaterial.colorNode = vec3(0.25, 0.82, 1);
  exhaustMaterial.opacityNode = float(1).sub(smoothstep(0.02, 0.5, uv().sub(0.5).length())).pow(2).mul(exhaustGain);
  const exhaust = new Mesh(plane, exhaustMaterial);
  exhaust.position.set(0, -0.24, 0.2);
  exhaust.scale.set(1.35, 0.55, 1);
  hull.add(exhaust);
  const key = new DirectionalLight(0xd7eaff, 3.5);
  key.position.set(-3, 5, 6);
  const fill = new DirectionalLight(0xc5a3ff, 2);
  fill.position.set(3, 1, 2);
  const lighting = new Group();
  lighting.add(key, fill, new AmbientLight(0xffffff, 1.3));
  const tint = new Color();
  return {
    root,
    lighting,
    update(time: number, banking: number, hover: number, pilotSize: number, engine: number, beamStrength: number, hue: number, landingGear = 0) {
      const gear = Math.max(0, Math.min(1, landingGear));
      for (const leg of legs) {
        leg.pivot.rotation.z = leg.direction * (1.45 * (1 - gear) + 0.25 * gear);
        leg.pivot.visible = gear > 0.005;
      }
      hull.rotation.z = banking;
      hull.rotation.y = Math.sin(time * 0.7) * 0.1 * (1 - gear);
      hull.position.y = Math.sin(time * 2.3) * 0.045 * hover * (1 - gear);
      pilot.scale.setScalar(0.7 * pilotSize);
      glow.color.copy(tint.setHSL(hue, 0.65, 0.72));
      exhaustGain.value = engine * (0.65 + 0.12 * Math.sin(time * 4));
      beamGain.value = hover * beamStrength;
      beam.visible = beamGain.value > 0.001;
      for (let i = 0; i < lamps.length; i++) {
        lamps[i].scale.setScalar(0.046 + 0.013 * (1 + Math.sin(time * 3 - i * 0.7)));
      }
    },
    dispose() {
      root.removeFromParent();
      lighting.removeFromParent();
      for (const geometry of [sphere, ring, domeGeometry, arcGeometry, plane, beamGeometry, legGeometry]) geometry.dispose();
      for (const material of [metal, lowerMetal, glow, glass, shine, pilotMaterial, beamMaterial, exhaustMaterial]) material.dispose();
      texture.dispose();
    },
  };
}
