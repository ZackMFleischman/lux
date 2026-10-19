// The theatre: a retro-future proscenium with neon trims and marquee bulbs,
// red velvet curtains, a plank stage with footlights, a robot audience in
// silhouette, and the "billion doors" set: tiers of pod doors that open
// to reveal glowing robot eyes, with a far city and starry sky beyond.

import {
  AdditiveBlending,
  BackSide,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicNodeMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three/webgpu';
import {
  abs,
  atan,
  clamp,
  cos,
  dot,
  float,
  floor,
  fract,
  fwidth,
  hash,
  instanceIndex,
  length,
  max,
  min,
  mix,
  normalize,
  normalView,
  positionLocal,
  positionView,
  positionWorld,
  pow,
  sin,
  smoothstep,
  step,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { ball, blob, lathe, ring, rod } from './shapes.ts';
import { glow, inked, light, place, spotLight, spotPool, toon, u } from './toon.ts';

// Shader graph values are composed freely; TSL node typings are too narrow here.
type Node = any;

export const set = {
  now: u(0),
  houseLevel: u(1),
  footLevel: u(0),
  marqueeLevel: u(0),
  marqueeChase: u(0),
  neonLevel: u(0),
  curtainOpen: 0,
  curtainPin: u(0),
  pedestalDrop: 0,
  wallWakeAt: u(1000),
  wallLevel: u(1),
  wallInterior: u(new Color(0.55, 0.85, 1.0)),
  wallEyes: u(new Color(0.75, 1.0, 1.0)),
  wallBlinkSync: u(0),
  wallLook: u(new Vector2(0, 0)),
  wallEyeLevel: u(1),
  starLevel: u(0.3),
  dreamStar: u(0),
  skyTop: u(new Color(0.01, 0.01, 0.04)),
  skyHorizon: u(new Color(0.08, 0.04, 0.16)),
  hazeLevel: u(0.6),
};

function band3(x: Node): Node {
  return smoothstep(-0.05, 0.05, x).mul(0.55).add(smoothstep(0.55, 0.62, x).mul(0.45));
}

// Rounded-box signed distance in 2D.
function roundBox(p: Node, b: Node, r: number): Node {
  const q: Node = abs(p).sub(b).add(r);
  return length(max(q, 0)).add(min(max(q.x, q.y), 0)).sub(r);
}

function floorMaterial(): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial();
  // Painted stage: warm boards that darken toward the back wall, plank
  // strokes, a darker band at the lip and hard-edged spot pools.
  const px = positionWorld.x.div(1.4);
  const along = fract(px);
  const width = fwidth(px).mul(1.2);
  const plankLine = smoothstep(width, float(0), along.min(float(1).sub(along)));
  // Two painted bands instead of a gradient: shadowed upstage, lit downstage.
  const depth = step(-2.6, positionWorld.z);
  const board = mix(vec3(0.3, 0.18, 0.11), vec3(0.5, 0.31, 0.19), depth);
  const lip = step(2.9, positionWorld.z);
  const plankTone = step(0.6, hash(floor(px).add(31))).mul(0.12).add(0.94);
  const scuffCell = floor(positionWorld.xz.mul(vec2(1.1, 0.8)));
  const scuffP = fract(positionWorld.xz.mul(vec2(1.1, 0.8))).sub(0.5);
  const scuff = smoothstep(0.1, 0.08, length(scuffP.mul(vec2(1, 3)))).mul(step(0.86, hash(scuffCell.x.add(scuffCell.y.mul(97)))));
  const backBand = step(positionWorld.z, -5.6);
  const painted = mix(board.mul(plankTone), board.mul(0.8), scuff);
  const wood = mix(mix(mix(painted, board.mul(0.62), plankLine), board.mul(0.55), backBand), vec3(0.24, 0.13, 0.08), lip);
  let pools: Node = vec3(0, 0, 0);
  for (const spot of light.spots) {
    pools = pools.add(spot.color.mul(spotPool(spot)));
  }
  const lit = light.fill.mul(1.5).add(light.key.mul(0.32)).add(pools).min(vec3(1.25, 1.25, 1.25)).add(vec3(1.0, 0.7, 0.45).mul(lip).mul(set.footLevel).mul(0.4));
  material.colorNode = vec4(wood.mul(lit), 1);
  return material;
}

function curtainMaterial(folds: number, fringe: boolean): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ side: DoubleSide });
  const phase = positionLocal.x.mul(folds);
  material.positionNode = positionLocal.add(vec3(0, 0, sin(phase).mul(0.09)));
  const shade = cos(phase).mul(0.5).add(0.5);
  const tone = band3(shade.sub(0.35));
  const velvet = mix(vec3(0.2, 0.012, 0.03), vec3(0.62, 0.05, 0.1), tone);
  const sheen = smoothstep(0.93, 0.97, shade).mul(vec3(0.5, 0.1, 0.14));
  const v = uv().y;
  const vertical = smoothstep(0.0, 0.25, v).mul(0.35).add(0.65);
  let color: Node = velvet.add(sheen).mul(vertical).mul(light.fill.mul(2.2).add(light.key.mul(0.55)).add(set.footLevel.mul(vec3(0.5, 0.3, 0.2))));
  if (fringe) {
    const gold = smoothstep(0.035, 0.03, v).mul(step(0.5, fract(positionLocal.x.mul(14))).mul(0.4).add(0.6));
    color = mix(color, vec3(0.75, 0.52, 0.18).mul(light.fill.mul(2).add(light.key.mul(0.6)).add(set.footLevel.mul(0.5))), gold);
  }
  // Pre-show pin spot on the closed curtain.
  const pin = smoothstep(1.55, 0.95, length(positionWorld.xy.sub(vec2(0, 2.3)))).mul(set.curtainPin);
  color = color.add(velvet.mul(1.1).add(sheen).add(vec3(0.16, 0.11, 0.08)).mul(pin));
  material.colorNode = vec4(color, 1);
  return material;
}

interface DoorWallSpec {
  cols: number;
  rows: number;
  delay: number;
  spread: number;
  dim: number;
  center: [number, number];
}

function doorWallMaterial(spec: DoorWallSpec, side: typeof DoubleSide | typeof BackSide = DoubleSide): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ side });
  // Rows have their own door count, so the wall reads as a painted tier of
  // varied apartments rather than one repeated cell.
  const rowF = uv().y.mul(spec.rows);
  const row = floor(rowF);
  const rowHash = hash(row.add(spec.cols * 3 + 11));
  const colsRow = float(spec.cols).mul(rowHash.mul(0.55).add(0.72));
  const st = vec2(uv().x.mul(colsRow), rowF);
  const cell = floor(st);
  const f = fract(st);
  const h = hash(cell.x.add(cell.y.mul(1013)).add(spec.cols * 7));
  const h2 = hash(cell.x.mul(3).add(cell.y.mul(577)).add(spec.cols * 13));
  const centerCol = colsRow.mul(spec.center[0] / spec.cols);
  const dist = length(vec2(cell.x.sub(centerCol), cell.y.sub(spec.center[1]).mul(1.7)));
  const wake = set.wallWakeAt.add(spec.delay).add(dist.mul(spec.spread)).add(h.mul(0.6));
  const open = smoothstep(wake, wake.add(0.55), set.now);
  const p = f.sub(vec2(0.5, 0.44));
  const halfW = h2.mul(0.1).add(0.2);
  const halfH = h.mul(0.06).add(0.3);
  const box = roundBox(p, vec2(halfW, halfH), 0.1);
  const arch = max(roundBox(p.sub(vec2(0, -0.08)), vec2(halfW, halfH.sub(0.08)), 0.02), length(p.sub(vec2(0, 0.1)).mul(vec2(1, 1.3))).sub(halfW).mul(step(0.1, p.y)));
  const port = length(p.sub(vec2(0, 0.02))).sub(halfW.mul(1.15));
  const shapePick = hash(cell.x.mul(11).add(cell.y.mul(37)));
  const d = mix(mix(box, arch, step(0.55, shapePick)), port, step(0.85, shapePick));
  const aa = fwidth(d).mul(0.6);
  const inside = smoothstep(aa, aa.negate(), d);
  const frame = smoothstep(aa, aa.negate(), d.sub(0.02)).sub(inside);
  // Split doors slide apart to reveal the interior.
  const revealed = smoothstep(open.mul(halfW).add(0.004), open.mul(halfW).sub(0.004), abs(p.x)).mul(inside);
  const blinkPhase = mix(h, float(0), set.wallBlinkSync);
  const blink = smoothstep(0.0, 0.03, abs(fract(set.now.mul(0.23).add(blinkPhase)).sub(0.5)));
  const eyeP = vec2(abs(p.x).sub(0.095), p.y.sub(0.04).div(blink.mul(0.85).add(0.15)));
  const eyes = smoothstep(0.088, 0.078, length(eyeP.mul(vec2(1.2, 1)))).mul(revealed);
  const lookJitter = vec2(h2.sub(0.5).mul(0.03), h.sub(0.5).mul(0.02));
  const pupilP = vec2(abs(p.x.sub(set.wallLook.x.mul(0.03)).sub(lookJitter.x)).sub(0.095), p.y.sub(0.04).sub(set.wallLook.y.mul(0.03)).sub(lookJitter.y));
  const pupil = smoothstep(0.03, 0.022, length(pupilP)).mul(eyes);
  // Muted painted palette per cell and per row.
  const plum = vec3(0.13, 0.11, 0.18);
  const slate = vec3(0.09, 0.12, 0.16);
  const umber = vec3(0.14, 0.11, 0.11);
  const wallTone = mix(mix(plum, slate, step(0.4, rowHash)), umber, step(0.8, rowHash));
  // Hard painted shadow under each ledge and a thin ledge strip.
  const ledge = step(f.y, 0.035);
  const ledgeShadow = step(0.83, f.y);
  const rivet = smoothstep(0.022, 0.014, length(vec2(abs(f.x.sub(0.5)).sub(0.46), f.y.sub(0.08))));
  const baseBand = smoothstep(0.22, 0.0, uv().y).mul(0.6);
  const wall = mix(wallTone, wallTone.mul(0.55), max(ledgeShadow, rivet)).mul(float(1).sub(ledge)).add(vec3(0.07, 0.06, 0.08).mul(ledge)).mul(float(1).sub(baseBand));
  const doorA = vec3(0.24, 0.31, 0.42);
  const doorB = vec3(0.42, 0.25, 0.18);
  const doorC = vec3(0.32, 0.33, 0.35);
  const doorD = vec3(0.34, 0.3, 0.42);
  const panelBase = mix(mix(mix(doorA, doorB, step(0.3, h2)), doorC, step(0.6, h2)), doorD, step(0.85, h2));
  const panelLine = smoothstep(0.012, 0.0, abs(p.x)).mul(inside).mul(float(1).sub(revealed));
  const panel = panelBase.mul(float(1).sub(panelLine.mul(0.5)));
  const frameColor = wallTone.mul(0.4);
  const interiorGrad = step(0.0, p.y).mul(0.25).add(0.75);
  // A little robot occupant in each pod: head, shoulders and an antenna,
  // in one of a few painted colours, lit from behind by the pod light.
  const occupantTone = mix(mix(vec3(0.27, 0.36, 0.44), vec3(0.42, 0.3, 0.25), step(0.4, h)), vec3(0.38, 0.38, 0.42), step(0.75, h));
  // Five head types: round, tall capsule, wide box, square, dome.
  const kind = hash(cell.x.mul(19).add(cell.y.mul(53)).add(7));
  const dRound = length(p.sub(vec2(0, 0.02))).sub(0.15);
  const dTall = roundBox(p.sub(vec2(0, 0.04)), vec2(0.12, 0.16), 0.11);
  const dWide = roundBox(p.sub(vec2(0, 0.02)), vec2(0.18, 0.11), 0.03);
  const dSquare = roundBox(p.sub(vec2(0, 0.02)), vec2(0.13, 0.13), 0.02);
  const dDome = max(length(p.sub(vec2(0, -0.05))).sub(0.18), float(-0.07).sub(p.y));
  const headD = mix(mix(mix(mix(dRound, dTall, step(0.2, kind)), dWide, step(0.4, kind)), dSquare, step(0.6, kind)), dDome, step(0.8, kind));
  const shoulderD = roundBox(p.sub(vec2(0, -0.29)), vec2(0.24, 0.12), 0.08);
  const antennaD = max(abs(p.x).sub(0.008), abs(p.y.sub(0.22)).sub(0.05)).add(step(0.5, hash(cell.x.add(cell.y.mul(9)))).mul(10));
  const bulbD = length(p.sub(vec2(0, 0.28))).sub(0.025).add(step(0.5, hash(cell.x.add(cell.y.mul(9)))).mul(10));
  const occD = min(min(headD, shoulderD), min(antennaD, bulbD));
  const occupant = smoothstep(0.006, -0.006, occD);
  const occLine = smoothstep(0.016, 0.008, abs(occD));
  const glowBack = set.wallInterior.mul(interiorGrad).mul(set.wallLevel);
  const painted = mix(occupantTone, occupantTone.mul(0.25), occLine);
  const interior = mix(glowBack, painted, max(occupant, occLine));
  const lightAmt = light.fill.mul(1.6).add(light.key.mul(0.12));
  let color: Node = wall.mul(lightAmt).mul(float(1).sub(inside).sub(frame));
  color = color.add(frameColor.mul(frame));
  color = color.add(mix(panel.mul(lightAmt), interior, revealed).mul(inside));
  color = mix(color, set.wallEyes.mul(set.wallEyeLevel).mul(1.2), eyes.mul(set.wallEyeLevel.min(1)));
  color = mix(color, vec3(0.02, 0.02, 0.05), pupil.mul(set.wallEyeLevel.min(1)));
  material.colorNode = vec4(color.mul(spec.dim), 1);
  return material;
}

function skyMaterial(): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false });
  const dir = normalize(positionLocal);
  const elev = clamp(dir.y, -0.2, 1);
  let color: Node = mix(set.skyHorizon, set.skyTop, smoothstep(0.0, 0.45, elev));
  // Stars in a lat-long grid.
  const st = vec2(atan(dir.z, dir.x).mul(70), dir.y.mul(110));
  const cell = floor(st);
  const h = hash(cell.x.add(cell.y.mul(733)).add(91));
  const sp = fract(st).sub(vec2(hash(cell.x.add(cell.y.mul(733)).add(7)), hash(cell.x.add(cell.y.mul(733)).add(13))).mul(0.6).add(0.2));
  const twinkle = sin(set.now.mul(h.mul(3).add(1)).add(h.mul(40))).mul(0.35).add(0.65);
  const star = smoothstep(0.09, 0.0, length(sp)).mul(step(0.86, h)).mul(twinkle).mul(set.starLevel);
  color = color.add(vec3(0.85, 0.9, 1.0).mul(star).mul(smoothstep(0.02, 0.15, elev)));
  // Ringed planet.
  const planetDir = normalize(vec3(0.42, 0.3, -1));
  const pd = dot(dir, planetDir);
  const planet = smoothstep(0.9965, 0.9969, pd);
  const pshade = dot(dir.sub(planetDir), normalize(vec3(-1, 0.6, 0))).mul(18).add(0.5);
  const planetColor = mix(vec3(0.5, 0.22, 0.42), vec3(1.0, 0.62, 0.55), smoothstep(0.3, 0.45, pshade));
  const rp = dir.sub(planetDir);
  const ringD = abs(length(vec2(rp.x.add(rp.y.mul(0.6)), rp.y.mul(4.2))).sub(0.12));
  const ringMask = smoothstep(0.012, 0.006, ringD).mul(float(1).sub(planet.mul(step(0.0, rp.y))));
  color = mix(color, planetColor, planet);
  color = mix(color, vec3(0.95, 0.78, 0.55), ringMask.mul(0.85));
  // The "dream" star the soprano reaches for.
  const dreamDir = normalize(vec3(0.16, 0.42, -1));
  const dd = float(1).sub(dot(dir, dreamDir)).mul(9000);
  const core = float(1).div(dd.add(1)).mul(set.dreamStar);
  const rays = pow(clamp(float(1).sub(abs(dir.sub(dreamDir).x.mul(dir.sub(dreamDir).y).mul(9000))), 0, 1), 6).mul(smoothstep(0.004, 0.0, length(dir.sub(dreamDir)).mul(0.1))).mul(set.dreamStar);
  color = color.add(vec3(1.0, 0.92, 0.75).mul(core.mul(3).add(rays)));
  material.colorNode = vec4(color, 1);
  return material;
}

function beamMaterial(spot: (typeof light.spots)[number]): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    // Far half only: the beam reads behind the performer, not over faces.
    side: BackSide,
  });
  const v = normalize(positionView.negate());
  const edge = smoothstep(0.08, 0.16, abs(dot(normalize(normalView), v)));
  const along = uv().y;
  // uv.y runs from the floor (0) to the lamp (1): brightest low, fading up.
  const fade = smoothstep(0.0, 0.04, along);
  const amount = edge.mul(fade).mul(spot.shape.w).mul(set.hazeLevel).mul(0.055);
  // Pale, warm beam colour so the haze never greys out the set.
  const tone = mix(spot.color, vec3(1.0, 0.72, 0.4), 0.6);
  material.colorNode = vec4(tone.mul(amount), 1);
  return material;
}

// Flat, hard-edged contact shadow laid on the floor under a performer.
export function contactShadow(width: number, depth: number): Mesh {
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  const d = length(uv().sub(0.5).mul(2));
  const alpha = smoothstep(1.0, 0.96, d).mul(0.38);
  material.colorNode = vec4(0.04, 0.02, 0.03, alpha);
  const mesh = new Mesh(new PlaneGeometry(width, depth), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  return mesh;
}

export interface Stage {
  root: Group;
  curtainL: Mesh;
  curtainR: Mesh;
  pedestal: Group;
  beams: Mesh[];
  cars: Object3D[];
  lift: Group;
  update(t: number): void;
  dispose(): void;
}

export function buildStage(): Stage {
  const root = new Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  // Sky and far city.
  const sky = new Mesh(keep(new SphereGeometry(80, 48, 24)), skyMaterial());
  sky.renderOrder = -10;
  root.add(sky);
  const farGeometry = keep(new CylinderGeometry(30, 30, 10.5, 96, 1, true, Math.PI * 0.62, Math.PI * 0.76));
  const far = new Mesh(farGeometry, doorWallMaterial({ cols: 150, rows: 16, delay: 2.4, spread: 0.035, dim: 0.55, center: [75, 4] }, BackSide));
  far.position.set(0, 2.4, 10);
  root.add(far);

  // Near tier of doors behind the stage.
  // Curved tier of doors wrapping the back of the stage.
  const wallGeometry = keep(new CylinderGeometry(14, 14, 5.6, 96, 1, true, Math.PI - 0.95, 1.9));
  const wall = new Mesh(wallGeometry, doorWallMaterial({ cols: 13, rows: 4, delay: 0, spread: 0.22, dim: 0.95, center: [6.5, 1.0] }, BackSide));
  wall.position.set(0, 2.8, 7.4);
  root.add(wall);
  const wallCap = new Mesh(keep(new CylinderGeometry(14.1, 14.1, 0.22, 96, 1, true, Math.PI - 0.95, 1.9)), toon(0x2a2440));
  wallCap.material.side = BackSide;
  place(wallCap, root, 0, 5.65, 7.4);

  // Stage floor, apron and footlights.
  const floorGeometry = keep(new PlaneGeometry(24, 10.4));
  const floorMesh = new Mesh(floorGeometry, floorMaterial());
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0, 0, -1.6);
  root.add(floorMesh);
  const apron = inked(blob(17, 1.5, 0.5, 6), toon(0x3a0d1a));
  place(apron, root, 0, -0.76, 3.5);
  const trim = inked(blob(17.2, 0.12, 0.62, 6), toon(0xd7a440));
  place(trim, root, 0, -0.02, 3.5);
  const bulbMaterial = glow(0xffd28a, 0);
  for (let i = 0; i < 25; i += 1) {
    const x = -7.2 + i * 0.6;
    place(inked(lathe('foot-hood', [[0, 0.0], [0.13, 0.0], [0.12, 0.08], [0.0, 0.1]]), toon(0x2a2632)), root, x, 0.0, 3.62, -0.4);
    place(new Mesh(ball(0.05, 10), bulbMaterial), root, x, 0.05, 3.66);
  }

  // Robot audience silhouettes in the stalls.
  const headGeometry = blob(0.5, 0.46, 0.42, 2.6);
  const audience = new InstancedMesh(headGeometry, toon(0x0c0a14), 46);
  const shoulderGeometry = blob(0.9, 0.5, 0.5, 2.8);
  const shoulders = new InstancedMesh(shoulderGeometry, toon(0x09070f), 46);
  const holder = new Object3D();
  let n = 0;
  for (let row = 0; row < 2; row += 1) {
    for (let i = 0; i < 23; i += 1) {
      const x = -9.9 + i * 0.9 + (row ? 0.45 : 0) + (Math.sin(i * 12.9 + row * 3) * 0.08);
      const z = 5.4 + row * 1.25;
      const y = -0.95 + row * 0.38 + Math.sin(i * 7.7) * 0.05;
      const s = 0.9 + 0.15 * Math.sin(i * 3.3 + row);
      holder.position.set(x, y + 0.3, z);
      holder.rotation.set(0, Math.sin(i * 1.7) * 0.2, Math.sin(i * 5.1) * 0.08);
      holder.scale.setScalar(s);
      holder.updateMatrix();
      audience.setMatrixAt(n, holder.matrix);
      holder.position.set(x, y - 0.12, z + 0.08);
      holder.rotation.set(0, 0, 0);
      holder.updateMatrix();
      shoulders.setMatrixAt(n, holder.matrix);
      n += 1;
    }
  }
  root.add(audience, shoulders);
  const antennaTips = new InstancedMesh(ball(0.05, 8), glow(0xff5a8a, 0.45), 12);
  for (let i = 0; i < 12; i += 1) {
    const k = (i * 7) % 46;
    const m = new Object3D();
    const row = k >= 23 ? 1 : 0;
    const j = k % 23;
    m.position.set(-9.9 + j * 0.9 + (row ? 0.45 : 0) + Math.sin(j * 12.9 + row * 3) * 0.08, -0.95 + row * 0.38 + Math.sin(j * 7.7) * 0.05 + 0.75, 5.4 + row * 1.25);
    m.updateMatrix();
    antennaTips.setMatrixAt(i, m.matrix);
  }
  void antennaTips;

  // Proscenium: deco pillars, header with a ringed-planet crest.
  const deco = toon(0x173e4c);
  const gold = toon(0xdcaa45);
  const neonCyan = glow(0x5ff2ff, 0);
  const neonPink = glow(0xff5fc8, 0);
  for (const side of [-1, 1]) {
    const pillar = new Group();
    pillar.position.set(side * 7.6, 0, 3.8);
    root.add(pillar);
    place(inked(blob(1.3, 7.6, 1.0, 5), deco), pillar, 0, 3.4, 0);
    for (let i = 0; i < 4; i += 1) {
      place(inked(blob(1.5 - i * 0.04, 0.16, 1.15, 5), gold), pillar, 0, 0.4 + i * 1.75, 0);
    }
    place(inked(blob(1.7, 0.5, 1.3, 5), gold), pillar, 0, 0.0, 0);
    place(new Mesh(rod(0.035, 0.035, 6.4), neonCyan), pillar, -side * 0.3, 3.6, 0.52);
    place(new Mesh(rod(0.025, 0.025, 6.4), neonPink), pillar, -side * 0.12, 3.6, 0.52);
  }
  // Dark house walls either side of the proscenium.
  for (const side of [-1, 1]) {
    place(inked(blob(12, 14, 0.6, 8), toon(0x120c1c)), root, side * 14.2, 4.5, 4.1);
  }
  const header = new Group();
  header.position.set(0, 6.75, 3.8);
  root.add(header);
  place(inked(blob(16.6, 1.5, 1.0, 6), deco), header, 0, 0.1, 0);
  place(inked(blob(16.8, 0.14, 1.12, 6), gold), header, 0, -0.62, 0);
  place(new Mesh(rod(0.03, 0.03, 15.2), neonCyan), header, 0, -0.38, 0.5, 0, 0, Math.PI / 2);
  const crest = place(new Group(), header, 0, 0.15, 0.55);
  place(inked(ball(0.5, 28), gold), crest, 0, 0, 0);
  place(inked(ring(0.85, 0.06), toon(0xf2d27a)), crest, 0, 0, 0, Math.PI / 2 - 0.35, 0, 0.25);
  place(new Mesh(ring(1.15, 0.03), neonPink), crest, 0, 0, -0.05);

  // Marquee bulbs along the header and pillars, with a chase.
  const marqueeMat = new MeshBasicNodeMaterial();
  const idx = instanceIndex.toFloat();
  const chase = step(0.55, fract(idx.div(3).add(set.marqueeChase)));
  marqueeMat.colorNode = vec4(vec3(1.0, 0.8, 0.45).mul(chase.mul(0.75).add(0.25)).mul(set.marqueeLevel).add(vec3(0.08, 0.06, 0.04)), 1);
  const marqueePositions: Vector3[] = [];
  for (let i = 0; i < 31; i += 1) {
    marqueePositions.push(new Vector3(-7.5 + i * 0.5, 6.35, 4.35));
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 12; i += 1) {
      marqueePositions.push(new Vector3(side * 6.85, 0.6 + i * 0.5, 4.35));
    }
  }
  const marquee = new InstancedMesh(ball(0.065, 10), marqueeMat, marqueePositions.length);
  marqueePositions.forEach((p, i) => {
    holder.position.copy(p);
    holder.rotation.set(0, 0, 0);
    holder.scale.setScalar(1);
    holder.updateMatrix();
    marquee.setMatrixAt(i, holder.matrix);
  });
  root.add(marquee);

  // Curtains: tied-back legs, a scalloped valance and the main traveller.
  const legGeometry = keep(new PlaneGeometry(1.6, 6.4, 48, 1));
  for (const side of [-1, 1]) {
    const leg = new Mesh(legGeometry, curtainMaterial(18, true));
    leg.position.set(side * 6.4, 3.2, 3.45);
    root.add(leg);
    const tie = inked(ring(0.32, 0.05), gold);
    place(tie, root, side * 6.35, 2.2, 3.6, Math.PI / 2, 0, 0);
  }
  const valanceGeometry = keep(new PlaneGeometry(13.6, 1.3, 160, 1));
  const valanceMat = curtainMaterial(9, false);
  const scallop = abs(sin(positionLocal.x.mul(1.15)));
  valanceMat.opacityNode = step(float(-0.55).add(scallop.mul(0.38)), positionLocal.y);
  valanceMat.alphaTest = 0.5;
  const valance = new Mesh(valanceGeometry, valanceMat);
  valance.position.set(0, 5.85, 3.55);
  root.add(valance);
  const travellerGeometry = keep(new PlaneGeometry(7.0, 6.3, 120, 1));
  const curtainL = new Mesh(travellerGeometry, curtainMaterial(11, true));
  const curtainR = new Mesh(travellerGeometry, curtainMaterial(11, true));
  curtainL.position.set(-3.5, 3.15, 3.25);
  curtainR.position.set(3.5, 3.15, 3.25);
  root.add(curtainL, curtainR);

  // Soprano's pedestal (centre) and the trap lift for the throne.
  const pedestal = new Group();
  pedestal.position.set(0, 0, -1.0);
  root.add(pedestal);
  place(inked(lathe('pedestal', [[0, 0.32], [0.62, 0.32], [0.7, 0.26], [0.66, 0.06], [0.78, 0.0], [0, 0]], 48), toon(0xe9e4f4)), pedestal, 0, 0, 0);
  place(new Mesh(ring(0.66, 0.025), glow(0x8fe8ff, 0.8)), pedestal, 0, 0.26, 0, Math.PI / 2);
  const lift = new Group();
  lift.position.set(0, 0, -4.4);
  root.add(lift);

  // Light beams.
  const beamGeometry = keep(new ConeGeometry(1, 1, 40, 1, true));
  beamGeometry.translate(0, -0.5, 0);
  const beams = light.spots.map(spot => {
    const beam = new Mesh(beamGeometry, beamMaterial(spot));
    beam.frustumCulled = false;
    beam.renderOrder = 10;
    root.add(beam);
    return beam;
  });

  // Hover-cars drifting across the far city.
  const cars: Object3D[] = [];
  const carColors = [0xff6a9a, 0x6af0ff, 0xffd86a];
  for (let i = 0; i < 3; i += 1) {
    const car = new Group();
    place(inked(blob(0.9, 0.26, 0.4, 2.2), toon(0xd6d9ea)), car, 0, 0, 0);
    place(new Mesh(blob(0.42, 0.18, 0.3, 2), toon(0x8fd8ff)), car, 0.05, 0.14, 0);
    place(new Mesh(ball(0.07, 8), glow(carColors[i], 1.5)), car, -0.48, 0, 0);
    root.add(car);
    cars.push(car);
  }

  const lampUp = new Vector3(0, -1, 0);
  const q = new Quaternion();
  const lamp = new Vector3();
  const pool = new Vector3();
  const dir = new Vector3();
  const neonLevelMaterials = [neonCyan, neonPink];

  return {
    root,
    curtainL,
    curtainR,
    pedestal,
    beams,
    cars,
    lift,
    update(t: number) {
      set.now.value = t;
      pedestal.position.y = -set.pedestalDrop * 0.45;
      pedestal.visible = set.pedestalDrop < 0.999;
      const open = set.curtainOpen;
      const shift = open * 6.0;
      const gather = 1 - open * 0.62;
      curtainL.position.x = -3.5 - shift - (1 - gather) * 0.0;
      curtainR.position.x = 3.5 + shift;
      curtainL.scale.x = gather;
      curtainR.scale.x = gather;
      curtainL.position.x = -(gather * 3.5) - shift * 0.95;
      curtainR.position.x = gather * 3.5 + shift * 0.95;
      bulbMaterial.userData.level.value = set.footLevel.value * 1.6;
      for (const m of neonLevelMaterials) {
        m.userData.level.value = set.neonLevel.value;
      }
      light.spots.forEach((spot, i) => {
        const beam = beams[i];
        const s = spot.shape.value;
        beam.visible = s.w > 0.01 && (i === 0 || i === 1 || i === 3);
        if (!beam.visible) {
          return;
        }
        pool.set(s.x, 0, s.y);
        lamp.set(s.x * 0.75, spot.height.value, s.y + 2.2);
        dir.copy(pool).sub(lamp);
        const len = dir.length();
        dir.normalize();
        q.setFromUnitVectors(lampUp, dir);
        beam.position.copy(lamp);
        beam.quaternion.copy(q);
        beam.scale.set(s.z * 0.92, len, s.z * 0.92);
      });
      cars.forEach((car, i) => {
        const speed = 0.35 + i * 0.12;
        const u = ((t * speed * 0.08 + i * 0.37) % 1) * 2 - 1;
        const dirSign = i % 2 ? -1 : 1;
        car.position.set(u * 26 * dirSign, 6.6 + i * 0.7 + Math.sin(t * 0.8 + i) * 0.08, -15 - i * 1.5);
        car.rotation.y = dirSign > 0 ? Math.PI : 0;
        car.rotation.z = Math.sin(t * 1.3 + i) * 0.05;
      });
    },
    dispose() {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}


