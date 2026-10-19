// The company of original robot performers, each dressed for the show.
//   Aria      – soprano: pearl-white robot in a simple flowing gown.
//   Barnaby   – old baritone: stooped copper robot, waistcoat and spectacles.
//   Pip, Dot  – two small "children" in kid costumes.
//   Rex       – the robot king: crown, cape and ermine, seated on a throne.
//   Guards    – two toy-soldier robots.

import { DoubleSide, Group, Mesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { eye, skeleton, type Rig } from './rig.ts';
import { ball, bell, blob, lathe, ring, rod } from './shapes.ts';
import { glow, inked, place, toon } from './toon.ts';

function boot(material: MeshBasicNodeMaterial, size: number): () => Group {
  return () => {
    const g = new Group();
    place(inked(blob(size * 0.75, size * 0.42, size * 1.2, 2.6), material), g, 0, size * 0.2, size * 0.18);
    return g;
  };
}

function addEyes(rig: Rig, radius: number, spread: number, y: number, z: number, lid: MeshBasicNodeMaterial, pupil?: number): void {
  for (const side of [-1, 1]) {
    const e = eye(radius, lid, pupil);
    place(e.group, rig.head, side * spread, y, z);
    rig.eyes.push(e);
  }
}

function addMouth(rig: Rig, w: number, h: number, y: number, z: number, hex = 0x2a0f22): void {
  const mouth = new Group();
  const shape = new Mesh(blob(w, h, 0.03, 2.4), toon(hex, { shadow: 0 }));
  mouth.add(shape);
  const lip = new Mesh(blob(w * 1.12, h * 1.18, 0.02, 2.4), toon(0x120a14));
  lip.position.z = -0.006;
  mouth.add(lip);
  place(mouth, rig.head, 0, y, z);
  rig.mouth = mouth;
  rig.mouthOpen = 0;
}

function antenna(parent: Group, height: number, bulbHex: number, bulbR: number, stalkHex = 0x9aa0b4): ReturnType<typeof glow> {
  place(inked(rod(0.018, 0.026, height), toon(stalkHex)), parent, 0, height / 2, 0);
  const bulb = glow(bulbHex, 1);
  place(inked(ball(bulbR, 16), bulb), parent, 0, height + bulbR * 0.7, 0);
  return bulb;
}

export function makeAria(): Rig {
  const pearl = toon(0xeef0fa);
  const lilac = toon(0xb6a3ea);
  const silver = toon(0xc9c6dc);
  const rig = skeleton({
    name: 'Aria',
    hipHeight: 1.0,
    torsoY: 0,
    neckY: 0.68,
    shoulder: [0.22, 0.4, 0],
    armRadius: [0.042, 0.035],
    armMaterial: silver,
    handMaterial: pearl,
    handSize: 0.11,
    armHang: 0.68,
  });
  // Gown: a long bell skirt with a gold hem and a soft lilac sash.
  const gown = inked(lathe('aria-gown', [[0.0, 0.02], ...bell(0.2, 0.62, 0.05, -0.98, 1.7, 14), [0.0, -0.98]]), toon(0xf7f4ff));
  place(gown, rig.hips, 0, 0, 0);
  place(inked(ring(0.6, 0.035), toon(0xe0b65a)), rig.hips, 0, -0.94, 0, Math.PI / 2);
  place(inked(ring(0.215, 0.04), lilac), rig.hips, 0, 0.02, 0, Math.PI / 2);
  // Bodice and collar.
  place(inked(blob(0.44, 0.56, 0.32, 2.4), pearl), rig.torso, 0, 0.26, 0);
  place(inked(ring(0.11, 0.03), lilac), rig.torso, 0, 0.54, 0, Math.PI / 2);
  place(inked(rod(0.07, 0.08, 0.14), silver), rig.torso, 0, 0.6, 0);
  // Head: a soft squircle with ear discs and a halo antenna.
  const headShape = inked(blob(0.62, 0.52, 0.5, 2.6), pearl);
  place(headShape, rig.head, 0, 0.24, 0);
  for (const side of [-1, 1]) {
    place(inked(rod(0.09, 0.09, 0.07), lilac), rig.head, side * 0.32, 0.22, 0, 0, 0, Math.PI / 2);
  }
  const antennaGroup = place(new Group(), rig.head, 0, 0.47, 0);
  rig.props.antenna = antennaGroup;
  const halo = antenna(antennaGroup, 0.16, 0xbff4ff, 0.05);
  rig.props.haloLight = new Mesh();
  rig.props.haloLight.userData.material = halo;
  addEyes(rig, 0.105, 0.13, 0.28, 0.2, pearl, 0x2b2a6a);
  addMouth(rig, 0.13, 0.08, 0.08, 0.245);
  // Rosy cheek lights.
  for (const side of [-1, 1]) {
    place(new Mesh(blob(0.08, 0.04, 0.02, 2), glow(0xff9fc0, 0.55)), rig.head, side * 0.2, 0.13, 0.235);
  }
  return rig;
}

export function makeBarnaby(): Rig {
  const copper = toon(0xc27a45);
  const copperDark = toon(0x8c5232);
  const vest = toon(0x7d2a3a);
  const trousers = toon(0x3a3948);
  const brass = toon(0xe3b54c);
  const rig = skeleton({
    name: 'Barnaby',
    hipHeight: 0.72,
    torsoY: 0,
    neckY: 0.98,
    shoulder: [0.4, 0.74, 0],
    armRadius: [0.06, 0.048],
    armMaterial: copper,
    handMaterial: copper,
    handSize: 0.15,
    armHang: 0.78,
    legs: {
      hip: [0.17, -0.02, 0],
      radius: [0.075, 0.06],
      material: trousers,
      foot: boot(toon(0x5a3622), 0.3),
      stance: 0.2,
    },
  });
  // Barrel chest wearing a burgundy waistcoat with brass buttons.
  place(inked(blob(0.9, 0.98, 0.7, 3.0), copper), rig.torso, 0, 0.44, 0);
  place(inked(blob(0.94, 0.66, 0.74, 3.0), vest), rig.torso, 0, 0.32, 0.005);
  for (let i = 0; i < 3; i += 1) {
    place(inked(ball(0.035, 10), brass), rig.torso, 0, 0.5 - i * 0.16, 0.37);
  }
  // Watch chain.
  place(new Mesh(ring(0.16, 0.012, Math.PI), brass), rig.torso, 0.14, 0.2, 0.37, 0, 0, Math.PI);
  // Bow tie.
  for (const side of [-1, 1]) {
    place(inked(blob(0.16, 0.12, 0.06, 2.2), toon(0x2e8c8a)), rig.torso, side * 0.08, 0.8, 0.3, 0, 0, side * 0.25);
  }
  place(inked(ball(0.04, 10), toon(0x2e8c8a)), rig.torso, 0, 0.8, 0.33);
  // Rivets around the collar.
  for (let i = 0; i < 7; i += 1) {
    const a = -0.9 + i * 0.3;
    place(new Mesh(ball(0.022, 8), copperDark), rig.torso, Math.sin(a) * 0.38, 0.86, Math.cos(a) * 0.28);
  }
  place(inked(rod(0.13, 0.15, 0.16), copperDark), rig.torso, 0, 0.92, 0);
  // Head: broad dome, heavy brow, bulb nose, walrus moustache grille and
  // a hinged jaw that drops when he sings.
  place(inked(blob(0.78, 0.6, 0.62, 2.7), copper), rig.head, 0, 0.36, 0);
  place(inked(blob(0.66, 0.1, 0.18, 3), copperDark), rig.head, 0, 0.5, 0.25, 0.15);
  place(inked(blob(0.17, 0.15, 0.16, 2), toon(0xd98a55)), rig.head, 0, 0.3, 0.33);
  const stache = toon(0xc9cdd6);
  for (const side of [-1, 1]) {
    place(inked(blob(0.26, 0.11, 0.12, 2.2), stache), rig.head, side * 0.12, 0.2, 0.3, 0, side * -0.3, side * -0.25);
  }
  rig.jaw.position.set(0, 0.16, -0.05);
  place(inked(blob(0.6, 0.18, 0.56, 2.6), copper), rig.jaw, 0, -0.06, 0.06);
  place(new Mesh(blob(0.42, 0.14, 0.4, 2.4), toon(0x2a0f18)), rig.head, 0, 0.12, 0.08);
  rig.mouthOpen = 1;
  addEyes(rig, 0.085, 0.15, 0.4, 0.27, copper, 0x1a1210);
  for (const side of [-1, 1]) {
    place(inked(ring(0.11, 0.014), brass), rig.head, side * 0.15, 0.4, 0.33);
  }
  place(new Mesh(rod(0.008, 0.008, 0.1), brass), rig.head, 0, 0.42, 0.34, 0, 0, Math.PI / 2);
  for (const side of [-1, 1]) {
    place(inked(blob(0.08, 0.2, 0.2, 2.6), copperDark), rig.head, side * 0.4, 0.34, 0);
  }
  // A bent old antenna with a warm amber bulb.
  const tip = place(new Group(), rig.head, 0.05, 0.64, 0, 0, 0, -0.25);
  const bulb = antenna(tip, 0.18, 0xffb24a, 0.055, 0x8c5232);
  rig.props.bulb = new Mesh();
  rig.props.bulb.userData.material = bulb;
  return rig;
}

export function makeKid(kind: 'pip' | 'dot'): Rig {
  const shell = toon(kind === 'pip' ? 0x47c4bf : 0xf2907b);
  const outfit = toon(kind === 'pip' ? 0x3f63c8 : 0xf6cf45);
  const rig = skeleton({
    name: kind === 'pip' ? 'Pip' : 'Dot',
    hipHeight: 0.3,
    torsoY: 0,
    neckY: 0.42,
    shoulder: [0.17, 0.27, 0],
    armRadius: [0.032, 0.028],
    armMaterial: shell,
    handMaterial: shell,
    handSize: 0.075,
    armHang: 0.3,
    legs: {
      hip: [0.08, 0, 0],
      radius: [0.035, 0.03],
      material: shell,
      foot: boot(toon(kind === 'pip' ? 0xd23b3b : 0xe2457a), 0.17),
      stance: 0.1,
    },
  });
  if (kind === 'pip') {
    // Overalls with shoulder straps.
    place(inked(blob(0.38, 0.4, 0.32, 2.8), outfit), rig.torso, 0, 0.16, 0);
    for (const side of [-1, 1]) {
      place(new Mesh(blob(0.05, 0.2, 0.05, 2), outfit), rig.torso, side * 0.1, 0.33, 0.13);
    }
  } else {
    // A little sundress.
    place(inked(blob(0.34, 0.26, 0.28, 2.6), shell), rig.torso, 0, 0.26, 0);
    place(inked(lathe('dot-dress', [[0, 0.3], ...bell(0.13, 0.3, 0.3, -0.06, 1.4, 8), [0, -0.06]]), outfit), rig.torso, 0, 0, 0);
  }
  place(inked(blob(0.56, 0.48, 0.48, 2.3), shell), rig.head, 0, 0.22, 0);
  addEyes(rig, 0.1, 0.12, 0.26, 0.18, shell);
  addMouth(rig, 0.1, 0.07, 0.1, 0.225);
  if (kind === 'pip') {
    // Propeller beanie.
    const cap = toon(0xd23b3b);
    place(inked(lathe('pip-cap', [[0, 0.17], [0.12, 0.15], [0.22, 0.08], [0.26, 0.0], [0, 0.0]]), cap), rig.head, 0, 0.36, 0);
    place(inked(rod(0.012, 0.012, 0.1), toon(0xf6cf45)), rig.head, 0, 0.58, 0);
    const prop = place(new Group(), rig.head, 0, 0.63, 0);
    for (const side of [-1, 1]) {
      place(inked(blob(0.2, 0.025, 0.07, 2), toon(0xf6cf45)), prop, side * 0.1, 0, 0, 0.3 * side);
    }
    rig.props.propeller = prop;
  } else {
    // Pigtail puffs with ribbons.
    for (const side of [-1, 1]) {
      const tail = place(new Group(), rig.head, side * 0.3, 0.36, -0.05, 0, 0, side * -0.4);
      place(inked(ball(0.09, 14), toon(0x7b3fb0)), tail, side * 0.06, 0.04, 0);
      place(inked(blob(0.12, 0.07, 0.05, 2), toon(0xe2457a)), tail, 0, -0.03, 0.02);
      rig.props[side < 0 ? 'tailL' : 'tailR'] = tail;
    }
  }
  return rig;
}

export function makeKing(): Rig {
  const gold = toon(0xe0b03c);
  const velvet = toon(0x5d2a8a);
  const ermine = toon(0xf6f2ea);
  const rig = skeleton({
    name: 'Rex',
    hipHeight: 0.72,
    torsoY: 0,
    neckY: 0.92,
    shoulder: [0.42, 0.72, 0],
    armRadius: [0.058, 0.05],
    armMaterial: gold,
    handMaterial: gold,
    handSize: 0.14,
    armHang: 0.55,
    legs: {
      hip: [0.18, 0, 0.1],
      radius: [0.07, 0.06],
      material: velvet,
      foot: boot(toon(0x2a1a3a), 0.28),
      stance: 0.24,
    },
  });
  // Round royal belly under a velvet cape with ermine trim.
  place(inked(blob(0.92, 0.95, 0.8, 2.4), gold), rig.torso, 0, 0.42, 0.02);
  // Cape: open at the front so the belly and robes show.
  const capeMaterial = toon(0x5d2a8a);
  capeMaterial.side = DoubleSide;
  place(inked(lathe('king-cape', [[0.3, 0.9], ...bell(0.44, 0.78, 0.86, -0.7, 1.3, 10)], 40, 1.15, Math.PI * 2 - 2.3), capeMaterial), rig.torso, 0, 0, -0.08);
  place(inked(ring(0.4, 0.09), ermine), rig.torso, 0, 0.85, -0.04, Math.PI / 2);
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    place(new Mesh(blob(0.03, 0.07, 0.03, 2), toon(0x111111)), rig.torso, Math.cos(a) * 0.4, 0.86, Math.sin(a) * 0.4 - 0.04);
  }
  place(inked(blob(0.08, 0.16, 0.06, 2.2), toon(0xd8283c)), rig.torso, 0, 0.5, 0.42);
  // Head with a proud jaw and a crown.
  place(inked(blob(0.66, 0.56, 0.56, 2.8), gold), rig.head, 0, 0.3, 0);
  rig.jaw.position.set(0, 0.12, -0.04);
  place(inked(blob(0.54, 0.16, 0.5, 2.6), toon(0xc4962c)), rig.jaw, 0, -0.05, 0.05);
  rig.mouthOpen = 0.9;
  addEyes(rig, 0.08, 0.14, 0.36, 0.25, gold, 0x2a0f16);
  place(inked(blob(0.5, 0.07, 0.12, 3), toon(0x8a6420)), rig.head, 0, 0.47, 0.25, 0.25);
  const crown = place(new Group(), rig.head, 0, 0.56, 0);
  const crownGold = toon(0xf4cb4c);
  place(inked(rod(0.27, 0.25, 0.14, 24), crownGold), crown, 0, 0.07, 0);
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2;
    const spike = place(new Group(), crown, Math.sin(a) * 0.25, 0.16, Math.cos(a) * 0.25);
    place(inked(blob(0.07, 0.16, 0.07, 1.4), crownGold), spike, 0, 0.05, 0);
    place(new Mesh(ball(0.035, 10), glow(i % 2 ? 0xff3a5a : 0x5ad8ff, 1.0)), spike, 0, 0.15, 0);
  }
  place(inked(rod(0.27, 0.27, 0.05, 24), velvet), crown, 0, 0.02, 0);
  // Sceptre held in the right hand.
  const sceptre = new Group();
  place(inked(rod(0.025, 0.025, 1.0), gold), sceptre, 0, 0.1, 0);
  place(inked(ball(0.08, 14), glow(0xff5a7a, 1.0)), sceptre, 0, 0.64, 0);
  rig.hands[1].add(sceptre);
  sceptre.position.set(0, -0.1, 0);
  rig.props.sceptre = sceptre;
  return rig;
}

export function makeGuard(seed: number): Rig {
  const steel = toon(0xa9b3c6);
  const coat = toon(0xc8322f);
  const white = toon(0xf2efe6);
  const rig = skeleton({
    name: `Guard${seed}`,
    hipHeight: 0.66,
    torsoY: 0,
    neckY: 0.78,
    shoulder: [0.27, 0.64, 0],
    armRadius: [0.045, 0.04],
    armMaterial: coat,
    handMaterial: white,
    handSize: 0.11,
    armHang: 0.66,
    legs: {
      hip: [0.12, 0, 0],
      radius: [0.05, 0.045],
      material: toon(0x26315f),
      foot: boot(toon(0x15151c), 0.24),
      stance: 0.14,
    },
  });
  place(inked(blob(0.56, 0.82, 0.42, 3.2), coat), rig.torso, 0, 0.36, 0);
  for (const side of [-1, 1]) {
    place(new Mesh(blob(0.06, 0.86, 0.03, 2), white), rig.torso, side * 0.08, 0.38, 0.21, 0, 0, side * 0.55);
    place(inked(blob(0.2, 0.08, 0.2, 2.4), toon(0xe3b54c)), rig.torso, side * 0.3, 0.7, 0);
  }
  place(inked(blob(0.6, 0.08, 0.46, 3), toon(0x15151c)), rig.torso, 0, 0.0, 0);
  place(inked(blob(0.44, 0.42, 0.42, 3.2), steel), rig.head, 0, 0.2, 0);
  addEyes(rig, 0.07, 0.1, 0.22, 0.2, steel, 0x101018);
  addMouth(rig, 0.12, 0.05, 0.08, 0.21);
  // Tall shako with a plume.
  place(inked(rod(0.2, 0.18, 0.46, 20), toon(0x1c1c28)), rig.head, 0, 0.62, -0.02);
  place(inked(rod(0.205, 0.205, 0.05, 20), toon(0xe3b54c)), rig.head, 0, 0.42, -0.02);
  place(inked(blob(0.12, 0.3, 0.12, 1.8), white), rig.head, 0, 0.98, -0.02);
  // Wooden toy rifle.
  const rifle = new Group();
  place(inked(blob(0.06, 0.9, 0.06, 4), toon(0x7a4a2a)), rifle, 0, 0.2, 0);
  place(inked(rod(0.015, 0.015, 0.3), steel), rifle, 0, 0.78, 0);
  rig.hands[0].add(rifle);
  rifle.position.set(0, -0.1, 0.02);
  rig.props.rifle = rifle;
  return rig;
}
