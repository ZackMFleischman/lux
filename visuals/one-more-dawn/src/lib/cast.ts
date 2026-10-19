// The company of original robot performers, built from hard primitives
// (cans, rounded boxes, domes, tube limbs) in a muted broadcast palette.
//   Aria      – soprano: slender pearl robot with a lamp-shade head and gown.
//   Barnaby   – old baritone: copper barrel, box head, vent-grille jaw,
//               spectacles and a burgundy waistcoat panel.
//   Pip, Dot  – two child robots in kid costumes.
//   Rex       – the robot king: crown, cape and ermine collar.
//   Guards    – two toy-soldier robots.

import { DoubleSide, Group, Mesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { eye, skeleton, type Rig } from './rig.ts';
import { ball, bell, blob, can, dome, lathe, rbox, ring, rod } from './shapes.ts';
import { glow, place, toon } from './toon.ts';

const P = {
  ink: 0x15121a,
  pearl: 0xe2dff0,
  lavender: 0x9a82d0,
  gold: 0xd9aa3c,
  copper: 0xc8702f,
  copperDark: 0x8a4722,
  waistcoat: 0x84222f,
  teal: 0x4f8f8c,
  steel: 0x8f98a8,
};

function boot(material: MeshBasicNodeMaterial, size: number): () => Group {
  return () => {
    const g = new Group();
    place(new Mesh(rbox(size * 0.62, size * 0.4, size * 1.05), material), g, 0, size * 0.2, size * 0.16);
    return g;
  };
}

function addEyes(rig: Rig, radius: number, spread: number, y: number, z: number, lid: MeshBasicNodeMaterial): void {
  for (const side of [-1, 1]) {
    const e = eye(radius, lid);
    place(e.group, rig.head, side * spread, y, z);
    rig.eyes.push(e);
  }
}

// Split mouth plate: pale upper and lower plates with slots over a dark
// interior. Plates part when the character sings.
function addPlateMouth(rig: Rig, parent: Group, w: number, h: number, y: number, z: number, plateHex: number, slotHex: number, slots: number, oval = false): void {
  const mouth = place(new Group(), parent, 0, y, z);
  const inner = new Mesh(rbox(w * 0.9, h, 0.03), toon(0x241318, { shadow: 0 }));
  mouth.add(inner);
  const plate = toon(plateHex, { shadow: 0.5 });
  const slot = toon(slotHex, { shadow: 0 });
  const half = (sign: number) => {
    const g = new Group();
    const shape = oval ? blob(w, h * 0.55, 0.05, 2.4) : rbox(w, h * 0.5, 0.05);
    g.add(new Mesh(shape, plate));
    for (let i = 0; i < slots; i += 1) {
      const s = new Mesh(rbox(w * 0.7, h * 0.05, 0.02), slot);
      s.position.set(0, (i - (slots - 1) / 2) * h * 0.14, 0.03);
      g.add(s);
    }
    g.position.y = sign * h * 0.26;
    g.userData.baseY = g.position.y;
    g.position.z = 0.012;
    mouth.add(g);
    return g;
  };
  const upper = half(1);
  const lower = half(-1);
  rig.plates = { upper, lower, inner, gap: h * 0.9 };
  rig.mouthOpen = 0;
}

// Simple open cartoon mouth for the children.
function addMouth(rig: Rig, w: number, h: number, y: number, z: number): void {
  const mouth = new Group();
  place(new Mesh(rbox(w, h, 0.04), toon(0x241318, { shadow: 0 })), mouth, 0, 0, 0);
  place(new Mesh(rbox(w * 0.6, h * 0.35, 0.03), toon(0xb3474f, { shadow: 0 })), mouth, 0, -h * 0.22, 0.01);
  place(mouth, rig.head, 0, y, z);
  rig.mouth = mouth;
  rig.mouthOpen = 0;
}

function antenna(parent: Group, height: number, bulbHex: number, bulbR: number, stalkHex = 0x7d8392): ReturnType<typeof glow> {
  place(new Mesh(rod(0.022, 0.022, height, 12), toon(stalkHex)), parent, 0, height / 2, 0);
  const bulb = glow(bulbHex, 1);
  place(new Mesh(ball(bulbR, 18), bulb), parent, 0, height + bulbR * 0.8, 0);
  return bulb;
}

export function makeAria(): Rig {
  // Tall lantern-headed soprano: pearl shell with teal and gold accents.
  const pearl = toon(P.pearl, { shine: 0.5 });
  const teal = toon(0x2f9c95);
  const gold = toon(P.gold, { shine: 0.6 });
  const rig = skeleton({
    name: 'Aria',
    hipHeight: 1.0,
    torsoY: 0,
    neckY: 0.74,
    shoulder: [0.24, 0.5, 0],
    armRadius: [0.046, 0.032],
    armMaterial: teal,
    handMaterial: pearl,
    handSize: 0.15,
    armHang: 0.72,
  });
  // Hard cone gown with a gold hem band and a teal sash.
  place(new Mesh(lathe('aria-gown2', [[0.0, -0.98], [0.66, -0.98], ...bell(0.62, 0.2, -0.95, 0.04, 0.6, 10).slice(1), [0.0, 0.04]]), toon(0xeeebf3)), rig.hips, 0, 0, 0);
  place(new Mesh(can(0.665, 0.08), gold), rig.hips, 0, -0.93, 0);
  place(new Mesh(can(0.43, 0.05), teal), rig.hips, 0, -0.45, 0);
  // Tapered bodice with a teal belt.
  place(new Mesh(lathe('aria-bodice', [[0, 0], [0.2, 0], [0.24, 0.3], [0.21, 0.56], [0, 0.56]]), pearl), rig.torso, 0, 0.02, 0);
  place(new Mesh(can(0.215, 0.07), teal), rig.torso, 0, 0.04, 0);
  place(new Mesh(can(0.07, 0.2), gold), rig.torso, 0, 0.66, 0);
  // Lantern head: a tall can with gold bands, a pale face window and a
  // cone finial carrying the bulb.
  place(new Mesh(can(0.24, 0.46), pearl), rig.head, 0, 0.24, 0);
  place(new Mesh(can(0.255, 0.05), gold), rig.head, 0, 0.02, 0);
  place(new Mesh(can(0.255, 0.05), gold), rig.head, 0, 0.47, 0);
  place(new Mesh(rod(0.03, 0.2, 0.18, 32), teal), rig.head, 0, 0.58, 0);
  place(new Mesh(rbox(0.36, 0.3, 0.06), toon(0xf3eedf, { shadow: 0.4 })), rig.head, 0, 0.24, 0.22);
  const antennaGroup = place(new Group(), rig.head, 0, 0.66, 0);
  rig.props.antenna = antennaGroup;
  const halo = antenna(antennaGroup, 0.1, 0xbfeaf2, 0.05);
  rig.props.haloLight = new Mesh();
  rig.props.haloLight.userData.material = halo;
  addEyes(rig, 0.065, 0.09, 0.28, 0.26, toon(0xf3eedf));
  addPlateMouth(rig, rig.head, 0.13, 0.08, 0.13, 0.27, 0x8fd0ca, 0x1e5f5a, 1, true);
  rig.head.scale.setScalar(1.3);
  return rig;
}

export function makeBarnaby(): Rig {
  const copper = toon(P.copper, { shine: 0.55 });
  const copperDark = toon(P.copperDark);
  const vest = toon(P.waistcoat);
  const trousers = toon(0x3a3a45);
  const brass = toon(P.gold, { shine: 0.7 });
  const rig = skeleton({
    name: 'Barnaby',
    hipHeight: 0.78,
    torsoY: 0,
    neckY: 1.0,
    shoulder: [0.44, 0.78, 0],
    armRadius: [0.07, 0.052],
    armMaterial: copper,
    handMaterial: copper,
    handSize: 0.21,
    armHang: 0.82,
    legs: {
      hip: [0.18, -0.02, 0],
      radius: [0.085, 0.08],
      material: trousers,
      foot: boot(toon(0x4d3322), 0.36),
      stance: 0.21,
    },
  });
  // Barrel chest with rivet bands and a waistcoat panel.
  place(new Mesh(can(0.42, 0.92, 40), copper), rig.torso, 0, 0.44, 0);
  place(new Mesh(can(0.43, 0.06, 40), copperDark), rig.torso, 0, 0.86, 0);
  place(new Mesh(can(0.43, 0.06, 40), copperDark), rig.torso, 0, 0.02, 0);
  place(new Mesh(lathe('vest-panel', [[0.0, 0.0], [0.435, 0.0], [0.435, 0.62], [0.0, 0.62]], 40, -1.1, 2.2), vest), rig.torso, 0, 0.1, 0);
  for (let i = 0; i < 3; i += 1) {
    place(new Mesh(ball(0.035, 12), brass), rig.torso, 0, 0.6 - i * 0.17, 0.44);
  }
  for (let i = 0; i < 9; i += 1) {
    const a = -1.2 + i * 0.3;
    place(new Mesh(ball(0.02, 8), copperDark), rig.torso, Math.sin(a) * 0.435, 0.78, Math.cos(a) * 0.435);
  }
  // Bow tie and a short neck.
  for (const side of [-1, 1]) {
    place(new Mesh(rbox(0.15, 0.12, 0.05), toon(0x2f6f6c)), rig.torso, side * 0.08, 0.9, 0.36, 0, 0, side * 0.2);
  }
  place(new Mesh(can(0.14, 0.14), copperDark), rig.torso, 0, 0.95, 0);
  // Head: broad box with a dome cap, heavy brow, round eye sockets,
  // spectacles and a hinged vent-grille jaw.
  place(new Mesh(can(0.36, 0.5, 64), copper), rig.head, 0, 0.42, 0);
  place(new Mesh(dome(0.36, 0.6), copper), rig.head, 0, 0.66, 0);
  place(new Mesh(rbox(0.6, 0.09, 0.14), copperDark), rig.head, 0, 0.58, 0.3);
  rig.jaw.position.set(0, 0.2, 0.0);
  place(new Mesh(can(0.33, 0.2, 64), copper), rig.jaw, 0, -0.07, 0.0);
  // Old radio vent plate on the jaw.
  place(new Mesh(rbox(0.36, 0.15, 0.04), toon(0xd9cdb0, { shadow: 0.5 })), rig.jaw, 0, -0.06, 0.32);
  for (let i = 0; i < 3; i += 1) {
    place(new Mesh(rbox(0.3, 0.018, 0.02), toon(0x5a3a26, { shadow: 0 })), rig.jaw, 0, -0.02 - i * 0.04, 0.345);
  }
  place(new Mesh(can(0.31, 0.12, 64), toon(0x241318, { shadow: 0 })), rig.head, 0, 0.18, 0);
  rig.mouthOpen = 1;
  for (const side of [-1, 1]) {
    place(new Mesh(can(0.1, 0.06), copperDark), rig.head, side * 0.15, 0.44, 0.31, Math.PI / 2);
  }
  addEyes(rig, 0.07, 0.15, 0.44, 0.33, copper);
  for (const side of [-1, 1]) {
    place(new Mesh(ring(0.1, 0.016), toon(0x2a1a10, { shadow: 0 })), rig.head, side * 0.15, 0.44, 0.38);
  }
  place(new Mesh(rod(0.012, 0.012, 0.1), toon(0x2a1a10, { shadow: 0 })), rig.head, 0, 0.45, 0.38, 0, 0, Math.PI / 2);
  for (const side of [-1, 1]) {
    place(new Mesh(can(0.11, 0.08), copperDark), rig.head, side * 0.38, 0.42, 0, 0, 0, Math.PI / 2);
  }
  const tip = place(new Group(), rig.head, 0.06, 0.82, 0, 0, 0, -0.25);
  const bulb = antenna(tip, 0.2, 0xffb85a, 0.055, 0x6f4429);
  rig.props.bulb = new Mesh();
  rig.props.bulb.userData.material = bulb;
  rig.head.scale.setScalar(1.2);
  return rig;
}

export function makeKid(kind: 'pip' | 'dot'): Rig {
  const shell = toon(kind === 'pip' ? 0x3fa59c : 0xe58466, { shine: 0.4 });
  const outfit = toon(kind === 'pip' ? 0x3a5fb4 : 0xe8b83a);
  const rig = skeleton({
    name: kind === 'pip' ? 'Pip' : 'Dot',
    hipHeight: 0.4,
    torsoY: 0,
    neckY: 0.46,
    shoulder: [0.2, 0.34, 0],
    armRadius: [0.036, 0.027],
    armMaterial: shell,
    handMaterial: shell,
    handSize: 0.12,
    armHang: 0.46,
    legs: {
      hip: [0.09, 0, 0],
      radius: [0.04, 0.03],
      material: shell,
      foot: boot(toon(kind === 'pip' ? 0xa83f3a : 0xb6465f), 0.2),
      stance: 0.11,
    },
  });
  place(new Mesh(can(0.19, 0.42), shell), rig.torso, 0, 0.2, 0);
  if (kind === 'pip') {
    place(new Mesh(lathe('pip-overalls', [[0, 0], [0.2, 0], [0.2, 0.26], [0, 0.26]], 32, -1.3, 2.6), outfit), rig.torso, 0, 0.0, 0);
    for (const side of [-1, 1]) {
      place(new Mesh(rbox(0.05, 0.2, 0.04), outfit), rig.torso, side * 0.1, 0.33, 0.17);
    }
  } else {
    place(new Mesh(lathe('dot-dress2', [[0, -0.08], [0.31, -0.08], [0.2, 0.32], [0, 0.32]], 32), outfit), rig.torso, 0, 0, 0);
  }
  place(new Mesh(can(0.06, 0.08), shell), rig.torso, 0, 0.44, 0);
  place(new Mesh(can(0.21, 0.32), shell), rig.head, 0, 0.2, 0);
  place(new Mesh(dome(0.21, 0.8), shell), rig.head, 0, 0.36, 0);
  addEyes(rig, 0.06, 0.08, 0.24, 0.2, shell);
  addMouth(rig, 0.09, 0.05, 0.1, 0.205);
  if (kind === 'pip') {
    const cap = toon(0xa83f3a);
    place(new Mesh(dome(0.225, 0.62), cap), rig.head, 0, 0.4, 0);
    place(new Mesh(rbox(0.22, 0.03, 0.16), cap), rig.head, 0, 0.4, 0.22);
    place(new Mesh(rod(0.012, 0.012, 0.1), toon(0xe8b83a)), rig.head, 0, 0.59, 0);
    const prop = place(new Group(), rig.head, 0, 0.64, 0);
    for (const side of [-1, 1]) {
      place(new Mesh(rbox(0.2, 0.02, 0.07), toon(0xe8b83a)), prop, side * 0.1, 0, 0, 0.3 * side);
    }
    rig.props.propeller = prop;
  } else {
    for (const side of [-1, 1]) {
      const tail = place(new Group(), rig.head, side * 0.24, 0.42, -0.04, 0, 0, side * -0.4);
      place(new Mesh(ball(0.085, 16), toon(0x6c4593)), tail, side * 0.06, 0.04, 0);
      place(new Mesh(rbox(0.12, 0.06, 0.05), toon(0xb6465f)), tail, 0, -0.03, 0.02);
      rig.props[side < 0 ? 'tailL' : 'tailR'] = tail;
    }
  }
  return rig;
}

// The clockwork king: a tall, upright walnut case with a clock face for a
// chest, a small brass dome head, a crown and a red cape.
export function makeKing(): Rig {
  const walnut = toon(0x6b4128, { shine: 0.35 });
  const brass = toon(0xd2a43c, { shine: 0.7 });
  const rig = skeleton({
    name: 'Rex',
    hipHeight: 0.72,
    torsoY: 0,
    neckY: 1.12,
    shoulder: [0.36, 0.96, 0],
    armRadius: [0.06, 0.056],
    armMaterial: brass,
    handMaterial: brass,
    handSize: 0.19,
    armHang: 0.6,
    legs: {
      hip: [0.16, 0, 0.1],
      radius: [0.07, 0.066],
      material: toon(0x3d2416),
      foot: boot(toon(0x231510), 0.3),
      stance: 0.22,
    },
  });
  // Tall clock case with brass trims.
  place(new Mesh(rbox(0.66, 1.12, 0.5), walnut), rig.torso, 0, 0.56, 0);
  place(new Mesh(rbox(0.76, 0.1, 0.56), brass), rig.torso, 0, 1.12, 0);
  place(new Mesh(rbox(0.72, 0.08, 0.54), brass), rig.torso, 0, 0.02, 0);
  // Clock face on the chest.
  place(new Mesh(can(0.24, 0.05), brass), rig.torso, 0, 0.7, 0.25, Math.PI / 2);
  place(new Mesh(can(0.205, 0.05), toon(0xf1e9d2, { shadow: 0.4 })), rig.torso, 0, 0.7, 0.27, Math.PI / 2);
  const hands = place(new Group(), rig.torso, 0, 0.7, 0.3);
  place(new Mesh(rbox(0.02, 0.15, 0.015), toon(0x1a1410, { shadow: 0 })), hands, 0, 0.06, 0);
  place(new Mesh(rbox(0.02, 0.11, 0.015), toon(0x1a1410, { shadow: 0 })), hands, 0.04, -0.03, 0.005, 0, 0, 1.0);
  rig.props.clockHands = hands;
  // Pendulum window.
  place(new Mesh(rbox(0.3, 0.3, 0.04), toon(0x2b1a12, { shadow: 0 })), rig.torso, 0, 0.28, 0.25);
  const pendulum = place(new Group(), rig.torso, 0, 0.42, 0.28);
  place(new Mesh(rod(0.008, 0.008, 0.2, 8), brass), pendulum, 0, -0.1, 0);
  place(new Mesh(can(0.05, 0.02), brass), pendulum, 0, -0.2, 0, Math.PI / 2);
  rig.props.pendulum = pendulum;
  // Red cape over the shoulders, open at the front.
  const capeMaterial = toon(0x9b2230);
  capeMaterial.side = DoubleSide;
  place(new Mesh(lathe('king-cape3', [[0.3, 1.12], ...bell(0.42, 0.62, 1.06, -0.7, 1.3, 10)], 72, 1.25, Math.PI * 2 - 2.5), capeMaterial), rig.torso, 0, 0, -0.04);
  // Small brass dome head with wide eyes and a round speaker mouth.
  place(new Mesh(can(0.07, 0.12), brass), rig.torso, 0, 1.18, 0);
  place(new Mesh(can(0.24, 0.22), brass), rig.head, 0, 0.18, 0);
  place(new Mesh(dome(0.24, 0.8), brass), rig.head, 0, 0.29, 0);
  rig.jaw.position.set(0, 0.1, 0.18);
  place(new Mesh(can(0.06, 0.04), toon(0x241318, { shadow: 0 })), rig.jaw, 0, 0, 0.06, Math.PI / 2);
  place(new Mesh(can(0.05, 0.03), toon(0xc9c4b4, { shadow: 0.4 })), rig.jaw, 0, 0, 0.075, Math.PI / 2);
  rig.mouthOpen = 1.2;
  addEyes(rig, 0.065, 0.1, 0.25, 0.2, brass);
  const crown = place(new Group(), rig.head, 0, 0.45, 0);
  const crownGold = toon(0xe8bd45, { shine: 0.8 });
  place(new Mesh(can(0.2, 0.12, 6), crownGold), crown, 0, 0.06, 0);
  for (let i = 0; i < 6; i += 1) {
    const ang = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const spike = place(new Group(), crown, Math.sin(ang) * 0.17, 0.16, Math.cos(ang) * 0.17);
    place(new Mesh(rod(0.0, 0.05, 0.13, 4), crownGold), spike, 0, 0.0, 0);
    place(new Mesh(ball(0.025, 12), glow(i % 2 ? 0xe0405a : 0x58c8e8, 1.0)), spike, 0, 0.08, 0);
  }
  const sceptre = new Group();
  place(new Mesh(rod(0.03, 0.03, 1.0, 12), brass), sceptre, 0, 0.1, 0);
  place(new Mesh(ball(0.08, 24), glow(0xe0506a, 1.0)), sceptre, 0, 0.64, 0);
  rig.hands[1].add(sceptre);
  sceptre.position.set(0, -0.15, 0);
  rig.props.sceptre = sceptre;
  return rig;
}

export function makeGuard(seed: number): Rig {
  const steel = toon(P.steel, { shine: 0.6 });
  const coat = toon(0xc4302a);
  const white = toon(0xe6e2d6);
  const rig = skeleton({
    name: `Guard${seed}`,
    hipHeight: 0.72,
    torsoY: 0,
    neckY: 0.82,
    shoulder: [0.3, 0.66, 0],
    armRadius: [0.052, 0.04],
    armMaterial: coat,
    handMaterial: white,
    handSize: 0.15,
    armHang: 0.68,
    legs: {
      hip: [0.13, 0, 0],
      radius: [0.06, 0.056],
      material: toon(0x2a3460),
      foot: boot(toon(0x15151c, { shine: 0.6 }), 0.28),
      stance: 0.15,
    },
  });
  place(new Mesh(rbox(0.6, 0.8, 0.44), coat), rig.torso, 0, 0.38, 0);
  for (const side of [-1, 1]) {
    place(new Mesh(rbox(0.06, 0.86, 0.03), white), rig.torso, side * 0.08, 0.4, 0.23, 0, 0, side * 0.55);
    place(new Mesh(rbox(0.2, 0.08, 0.22), toon(P.gold)), rig.torso, side * 0.32, 0.74, 0);
  }
  place(new Mesh(rbox(0.64, 0.08, 0.48), toon(0x15151c)), rig.torso, 0, 0.02, 0);
  place(new Mesh(rbox(0.44, 0.4, 0.42), steel), rig.head, 0, 0.2, 0);
  for (const side of [-1, 1]) {
    place(new Mesh(can(0.07, 0.05), toon(P.gold)), rig.head, side * 0.23, 0.22, 0, 0, 0, Math.PI / 2);
    place(new Mesh(rbox(0.025, 0.36, 0.03), toon(0x1c1c28)), rig.head, side * 0.22, 0.2, 0.1, 0, 0, side * 0.08);
  }
  addEyes(rig, 0.07, 0.1, 0.25, 0.22, steel);
  addPlateMouth(rig, rig.head, 0.18, 0.1, 0.07, 0.225, 0xd9d4c2, 0x55606e, 2);
  place(new Mesh(can(0.2, 0.46, 20), toon(0x1c1c28)), rig.head, 0, 0.64, -0.02);
  place(new Mesh(can(0.205, 0.06, 20), toon(P.gold)), rig.head, 0, 0.44, -0.02);
  place(new Mesh(blob(0.12, 0.3, 0.12, 1.8), white), rig.head, 0, 0.98, -0.02);
  const rifle = new Group();
  place(new Mesh(rbox(0.07, 0.9, 0.07), toon(0x6b4428)), rifle, 0, 0.2, 0);
  place(new Mesh(rod(0.016, 0.016, 0.3, 8), steel), rifle, 0, 0.78, 0);
  rig.hands[0].add(rifle);
  rifle.position.set(0, -0.15, 0.02);
  rig.props.rifle = rifle;
  rig.head.scale.setScalar(1.3);
  return rig;
}
