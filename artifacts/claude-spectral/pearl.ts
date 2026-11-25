import { createPearlHabitat } from './background.ts';
import { createSpectralHalo } from './spectrum.ts';
import { createCompanions } from './companions.ts';
import { defineComponent } from '@lux/visual-sdk';
import {
  Scene, Color, Mesh, SphereGeometry, MeshStandardNodeMaterial, DataTexture, RGBAFormat,
  UnsignedByteType, SRGBColorSpace, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, ClampToEdgeWrapping, NormalBlending,
  MeshBasicNodeMaterial, PerspectiveCamera, AmbientLight, DirectionalLight,
  Group, AdditiveBlending, BufferAttribute, DynamicDrawUsage,
} from 'three/webgpu';
import {
  uniform, attribute, sin, mix, color, normalWorld, positionWorld,
  cameraPosition, abs, pow, cos, vec3, vec2, float, texture, atan, asin, screenUV,
} from 'three/tsl';

export default defineComponent({
  metadata: {
  declarationVersion: 1,
  key: 'living-pearl/scene',
  label: 'Living Pearl',
  description: 'Audio-reactive nacre pearl with spectral halo, companions and echoes.',
  tags: ['pearl', 'audio'],
  inputs: {},
  outputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'Rendered pearl scene.' } },
  controlDescriptions: {
    ringBloom: 'How far the occasional ring bloom spreads (0 off, 1 fills the screen).',
    ringBloomPeriod: 'Seconds per bloom cycle.',
    ringEchoes: 'Out-of-phase echo copies per spectrum ring (0-2).',
    spikeHeight: 'Fold depth.',
    noiseScale: 'Fold scale.',
    sharpness: 'Fold definition.',
    motionSpeed: 'Life speed.',
    breath: 'Breathing.',
    roughness: 'Skin roughness.',
    glow: 'Inner glow.',
    nacre: 'Nacre shimmer.',
    bass: 'Bass.',
    mids: 'Mids.',
    highs: 'Highs.',
    kick: 'Kick.',
    sensitivity: 'Audio sensitivity.',
    audioDrive: 'Body response.',
    spectrumGain: 'Spectrum.',
    colorShift: 'Colour shift.',
    colorSpeed: 'Colour speed.',
    screenTint: 'Screen tint.',
    echoes: 'Echo trail.',
    companions: 'Companions.',
    companionSize: 'Companion size.',
    companionReach: 'Streamer reach.',
    echoInterval: 'Echo spacing (s).',
  },
  lifecycle: { state: 'stateful', reset: 'seed' },
  controls: {
    spikeHeight: { type: 'number', label: 'Fold depth', group: 'Body', default: 0.85, min: 0, max: 1.4, step: 0.01 },
    noiseScale: { type: 'number', label: 'Fold scale', group: 'Body', default: 3.4, min: 1, max: 7, step: 0.1 },
    sharpness: { type: 'number', label: 'Fold definition', group: 'Body', default: 3.2, min: 0.5, max: 5, step: 0.05 },
    motionSpeed: { type: 'number', label: 'Life speed', group: 'Life', default: 0.28, min: 0, max: 1.5, step: 0.01 },
    breath: { type: 'number', label: 'Breathing', group: 'Life', default: 0.65, min: 0, max: 1, step: 0.01 },
    roughness: { type: 'number', label: 'Skin roughness', group: 'Skin', default: 0.38, min: 0.12, max: 0.8, step: 0.01 },
    glow: { type: 'number', label: 'Inner glow', group: 'Skin', default: 0.65, min: 0, max: 2, step: 0.01 },
    nacre: { type: 'number', label: 'Nacre shimmer', group: 'Skin', default: 0.8, min: 0, max: 1.5, step: 0.01 },
    // Bind these to Studio audio (Animate > Add Audio). Base 0 means silent.
    bass: { type: 'number', label: 'Bass', group: 'Audio', default: 0, min: 0, max: 1, step: 0.01 },
    mids: { type: 'number', label: 'Mids', group: 'Audio', default: 0, min: 0, max: 1, step: 0.01 },
    highs: { type: 'number', label: 'Highs', group: 'Audio', default: 0, min: 0, max: 1, step: 0.01 },
    kick: { type: 'number', label: 'Kick', group: 'Audio', default: 0, min: 0, max: 1, step: 0.01 },
    sensitivity: { type: 'number', label: 'Audio sensitivity', group: 'Audio', default: 2.2, min: 0.5, max: 6, step: 0.05 },
    audioDrive: { type: 'number', label: 'Body response', group: 'Audio', default: 1.6, min: 0, max: 2, step: 0.01 },
    spectrumGain: { type: 'number', label: 'Spectrum', group: 'Audio', default: 1, min: 0, max: 2, step: 0.01 },
    colorShift: { type: 'number', label: 'Colour shift', group: 'Skin', default: 0.65, min: 0, max: 1, step: 0.01 },
    colorSpeed: { type: 'number', label: 'Colour speed', group: 'Skin', default: 0.035, min: 0, max: 0.3, step: 0.001 },
    screenTint: { type: 'number', label: 'Screen tint', group: 'Skin', default: 0.7, min: 0, max: 2, step: 0.01 },
    ringBloom: { type: 'number', label: 'Ring bloom', group: 'Audio', default: 1, min: 0, max: 1, step: 0.01 },
    ringBloomPeriod: { type: 'number', label: 'Ring bloom period (s)', group: 'Audio', default: 24, min: 6, max: 120, step: 0.5 },
    ringEchoes: { type: 'number', label: 'Ring echoes', group: 'Audio', default: 2, min: 0, max: 2, step: 1 },
    echoes: { type: 'number', label: 'Echo trail', group: 'Echo', default: 1, min: 0, max: 2, step: 0.01 },
    companions: { type: 'number', label: 'Companions', group: 'Companions', default: 42, min: 0, max: 96, step: 1 },
    companionSize: { type: 'number', label: 'Companion size', group: 'Companions', default: 1, min: 0.2, max: 3, step: 0.01 },
    companionReach: { type: 'number', label: 'Streamer reach', group: 'Companions', default: 1, min: 0.3, max: 2, step: 0.01 },
    echoInterval: { type: 'number', label: 'Echo spacing (s)', group: 'Echo', default: 0.6, min: 0.15, max: 3, step: 0.01 },
  },
  },
  async create(context) {
    // Seed once; reset samples the same field at Lux time zero.
    const permutation = new Uint16Array(512);
    for (let i = 0; i < 256; i++) permutation[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(context.random() * (i + 1));
      const swap = permutation[i];
      permutation[i] = permutation[j];
      permutation[j] = swap;
    }
    for (let i = 0; i < 256; i++) permutation[i + 256] = permutation[i];
    const sample = new Float64Array(4);

    // Improved gradient noise and its exact spatial derivative. This bounded
    // CPU pass avoids tripling a large GPU noise graph for finite differences.
    function noiseWithGradient(x: number, y: number, z: number) {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const iz = Math.floor(z);
      const fx = x - ix;
      const fy = y - iy;
      const fz = z - iz;
      const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
      const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
      const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
      const dx = 30 * fx * fx * (fx - 1) * (fx - 1);
      const dy = 30 * fy * fy * (fy - 1) * (fy - 1);
      const dz = 30 * fz * fz * (fz - 1) * (fz - 1);
      let value = 0;
      let gradientX = 0;
      let gradientY = 0;
      let gradientZ = 0;
      for (let a = 0; a < 2; a++) {
        const wx = a ? ux : 1 - ux;
        const dwx = a ? dx : -dx;
        const hashX = permutation[(ix & 255) + a];
        for (let b = 0; b < 2; b++) {
          const wy = b ? uy : 1 - uy;
          const dwy = b ? dy : -dy;
          const hashY = permutation[hashX + (iy & 255) + b];
          for (let c = 0; c < 2; c++) {
            const wz = c ? uz : 1 - uz;
            const dwz = c ? dz : -dz;
            const h = permutation[hashY + (iz & 255) + c] & 15;
            const signU = (h & 1) ? -1 : 1;
            const signV = (h & 2) ? -1 : 1;
            let gx = h < 8 ? signU : 0;
            let gy = h < 8 ? 0 : signU;
            let gz = 0;
            if (h < 4) gy += signV;
            else if (h === 12 || h === 14) gx += signV;
            else gz += signV;
            const dot = gx * (fx - a) + gy * (fy - b) + gz * (fz - c);
            const weight = wx * wy * wz;
            value += dot * weight;
            gradientX += gx * weight + dot * dwx * wy * wz;
            gradientY += gy * weight + dot * wx * dwy * wz;
            gradientZ += gz * weight + dot * wx * wy * dwz;
          }
        }
      }
      sample[0] = value;
      sample[1] = gradientX;
      sample[2] = gradientY;
      sample[3] = gradientZ;
    }

    const time = uniform(0);
    const glow = uniform(0.65);
    const roughness = uniform(0.38);
    const geometry = new SphereGeometry(1, 128, 88);
    const position = geometry.getAttribute('position') as BufferAttribute;
    const normal = geometry.getAttribute('normal') as BufferAttribute;
    position.setUsage(DynamicDrawUsage);
    normal.setUsage(DynamicDrawUsage);
    const rest = new Float32Array(position.array);
    // Canonical rest directions make duplicate seam and pole vertices agree.
    for (let i = 0; i < rest.length; i += 3) {
      let x = Math.abs(rest[i]) < 0.000001 ? 0 : rest[i];
      let y = Math.abs(rest[i + 1]) < 0.000001 ? 0 : rest[i + 1];
      let z = Math.abs(rest[i + 2]) < 0.000001 ? 0 : rest[i + 2];
      const length = Math.hypot(x, y, z);
      rest[i] = x / length;
      rest[i + 1] = y / length;
      rest[i + 2] = z / length;
    }
    const fields = new Float32Array(position.count);
    const fieldAttribute = new BufferAttribute(fields, 1).setUsage(DynamicDrawUsage);
    geometry.setAttribute('livingField', fieldAttribute);
    geometry.setAttribute('restPosition', new BufferAttribute(rest, 3));
    geometry.computeBoundingSphere();
    geometry.boundingSphere!.radius = 2.2;

    let previousTime = Number.NaN;
    let previousDepth = Number.NaN;
    let previousScale = Number.NaN;
    let previousSharpness = Number.NaN;
    let previousBreath = Number.NaN;
    let previousAudio = Number.NaN;
    function deform(t: number, depth: number, scale: number, sharpness: number, breath: number,
      flow = 0, punch = 0, shimmer = 0) {
      const audioKey = flow * 7.13 + punch * 3.7 + shimmer;
      if (t === previousTime && depth === previousDepth && scale === previousScale &&
          sharpness === previousSharpness && breath === previousBreath && audioKey === previousAudio) return;
      previousAudio = audioKey;
      previousTime = t;
      previousDepth = depth;
      previousScale = scale;
      previousSharpness = sharpness;
      previousBreath = breath;
      const exponent = sharpness * 0.55;
      const breathing = Math.sin(t * 1.9) * breath * 0.055;
      for (let i = 0; i < position.count; i++) {
        const index = i * 3;
        const x = rest[index];
        const y = rest[index + 1];
        const z = rest[index + 2];
        noiseWithGradient(x * scale + t * 0.24 + flow, y * scale - t * 0.19 - flow * 0.6, z * scale + t * 0.13);
        const field = sample[0];
        const remapped = Math.max(0.001, Math.min(0.999, field * 0.5 + 0.5));
        const folds = Math.pow(remapped, exponent);
        const foldSlope = depth * 0.65 * exponent * Math.pow(remapped, exponent - 1) * 0.5;
        const ripplePhase = y * 23 + field * 8 - t * 2;
        const rippleAmount = 0.012 + shimmer * 0.018;
        const ripple = Math.sin(ripplePhase) * rippleAmount;
        const rippleSlope = Math.cos(ripplePhase) * rippleAmount;
        const radius = 1 + depth * 0.65 * folds + ripple + breathing + punch * 0.07;
        const slope = foldSlope + rippleSlope * 8;
        const gx = sample[1] * scale * slope;
        const gy = sample[2] * scale * slope + rippleSlope * 23;
        const gz = sample[3] * scale * slope;
        // Exact normal of p(n) = radius(n) * n: remove the radial part of
        // the height gradient, then subtract its tangent component / radius.
        const radialGradient = gx * x + gy * y + gz * z;
        const nx = x - (gx - radialGradient * x) / radius;
        const ny = y - (gy - radialGradient * y) / radius;
        const nz = z - (gz - radialGradient * z) / radius;
        const inverseLength = 1 / Math.hypot(nx, ny, nz);
        position.setXYZ(i, x * radius, y * radius, z * radius);
        normal.setXYZ(i, nx * inverseLength, ny * inverseLength, nz * inverseLength);
        fields[i] = field;
      }
      position.needsUpdate = true;
      normal.needsUpdate = true;
      fieldAttribute.needsUpdate = true;
    }
    deform(0, 0.85, 3.4, 3.2, 0.65);

    const field = attribute('livingField', 'float');
    const restPosition = attribute('restPosition', 'vec3');
    const nacre = uniform(0.8);
    const audioGlow = uniform(0);
    // Painted nacre plate (equirectangular RGB + height in alpha), mapped by
    // rest direction so the pattern rides the folds instead of swimming.
    const pixels = context.images.get('assets/nacre.png');
    let nacreTexture: DataTexture | undefined;
    if (pixels) {
      nacreTexture = new DataTexture(pixels.data, pixels.width, pixels.height, RGBAFormat, UnsignedByteType);
      nacreTexture.colorSpace = SRGBColorSpace;
      nacreTexture.flipY = true;
      nacreTexture.wrapS = RepeatWrapping;
      nacreTexture.wrapT = ClampToEdgeWrapping;
      nacreTexture.magFilter = LinearFilter;
      nacreTexture.minFilter = LinearMipmapLinearFilter;
      nacreTexture.generateMipmaps = true;
      nacreTexture.needsUpdate = true;
    }
    const material = new MeshStandardNodeMaterial({ metalness: 0.1, roughness: 0.38, flatShading: false });
    const view = cameraPosition.sub(positionWorld).normalize();
    const facing = abs(normalWorld.dot(view));
    const rim = pow(facing.oneMinus(), 2.6);
    const r = restPosition;
    const sphereUv = vec2(atan(r.z, r.x).div(Math.PI * 2).add(0.5), asin(r.y.clamp(-1, 1)).div(Math.PI).add(0.5));
    // Slow drift of the plate with the music's flow keeps it alive.
    const plateSample = nacreTexture ? texture(nacreTexture, sphereUv.add(vec2(time.mul(0.004), 0))) : undefined;
    const plateRgb = plateSample ? plateSample.rgb : vec3(0.86, 0.8, 0.86);
    const plateHeight = plateSample ? plateSample.a : float(0.5);
    const film = facing.mul(2.4).add(field.mul(2.6)).add(plateHeight.mul(1.7)).add(time.mul(0.05));
    const thinFilm = vec3(
      cos(film.mul(6.2832)).mul(0.5).add(0.5),
      cos(film.mul(6.2832).add(2.1)).mul(0.5).add(0.5),
      cos(film.mul(6.2832).add(4.2)).mul(0.5).add(0.5),
    );
    const valley = field.mul(0.5).add(0.62).clamp(0.25, 1);
    // Living colour: a cosine palette drifting over time and across the folds,
    // so hues travel over the body instead of the whole blob changing at once.
    const huePhase = uniform(0);
    const colorShift = uniform(0.65);
    const screenTint = uniform(0.7);
    const paletteT = huePhase.add(screenUV.x.mul(screenTint.mul(0.6))).add(screenUV.y.mul(screenTint.mul(0.35))).add(field.mul(0.55)).add(plateHeight.mul(0.35)).add(facing.mul(0.25));
    const palette = vec3(
      cos(paletteT.add(0.0).mul(6.2832)).mul(0.5).add(0.5),
      cos(paletteT.add(0.33).mul(6.2832)).mul(0.5).add(0.5),
      cos(paletteT.add(0.67).mul(6.2832)).mul(0.5).add(0.5),
    ).mul(vec3(0.95, 0.75, 1.0)).add(vec3(0.25, 0.3, 0.3));
    const pearl = mix(plateRgb, plateRgb.mul(palette).mul(1.5), colorShift).mul(valley);
    material.colorNode = mix(
      mix(pearl, pearl.mul(thinFilm.mul(0.75).add(0.5)), nacre.mul(0.5).mul(rim.mul(0.7).add(0.3))),
      color('#7bc6bc'),
      rim.mul(0.22),
    );
    const seams = abs(sin(field.mul(19).add(time.mul(0.45)))).pow(24);
    material.emissiveNode = color('#36c9b1').mul(seams.mul(glow).mul(float(0.1).add(audioGlow.mul(0.2))))
      .add(color('#8276bd').mul(rim).mul(glow).mul(float(0.12).add(audioGlow.mul(0.25))))
      .add(thinFilm.mul(plateHeight).mul(audioGlow).mul(0.07));
    material.roughnessNode = plateHeight.oneMinus().mul(0.18).add(roughness).sub(0.06).clamp(0.06, 0.85);
    const body = new Mesh(geometry, material);
    const organism = new Group();
    organism.add(body);
    // Feedback echoes: snapshots of the living surface drift backward,
    // swell and fade. One shared cheap shader, per-echo opacity uniform.
    const echoCount = 9;
    const echoRoot = new Group();
    const echoFade = uniform(1);
    const echoFresnel = pow(abs(normalWorld.dot(cameraPosition.sub(positionWorld).normalize())).oneMinus(), 1.8);
    const echoes = Array.from({ length: echoCount }, (_, k) => {
      const g = geometry.clone();
      g.deleteAttribute('livingField');
      g.boundingSphere!.radius = 2.4;
      const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: 0 });
      const fade = uniform(0);
      m.colorNode = mix(color('#2fd6c4'), color('#a874f0'), float(k / echoCount)).mul(echoFresnel.mul(0.9).add(0.12));
      m.opacityNode = fade.mul(echoFade);
      const mesh = new Mesh(g, m);
      mesh.visible = false;
      mesh.renderOrder = -2 - k;
      echoRoot.add(mesh);
      return { mesh, geometry: g, material: m, fade, born: Number.NEGATIVE_INFINITY, rotY: 0, rotZ: 0, y: 0, scale: 1 };
    });
    let nextEcho = 0;
    let lastEchoAt = Number.NEGATIVE_INFINITY;
    const scene = new Scene();
    const habitat = createPearlHabitat();
    scene.add(habitat.group);
    scene.background = new Color('#03050c');
    scene.add(echoRoot, organism, new AmbientLight('#a0aac8', 0.7));
    // Three broad, restrained studio directions: warm key, cool rim, low fill.
    const key = new DirectionalLight('#ffeadb', 3.0);
    key.position.set(-3, 4, 5);
    const edge = new DirectionalLight('#66cdbc', 2.7);
    edge.position.set(3, 1, -2);
    const fill = new DirectionalLight('#9089d4', 0.9);
    fill.position.set(3, -2, 3);
    scene.add(key, edge, fill);
    const moteGeometry = new SphereGeometry(0.009, 6, 4);
    const moteMaterial = new MeshBasicNodeMaterial({ color: '#67b5c2', transparent: true, opacity: 0.28, blending: AdditiveBlending, depthWrite: false });
    const motes = new Group();
    for (let i = 0; i < 24; i++) {
      const mote = new Mesh(moteGeometry, moteMaterial);
      const angle = context.random() * Math.PI * 2;
      const radius = 1.7 + context.random() * 1.5;
      const height = (context.random() - 0.5) * 4.6;
      mote.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
      mote.scale.setScalar(0.3 + context.random() * 1.1);
      motes.add(mote);
    }
    scene.add(motes);
    const companions = createCompanions(context.random, geometry, material);
    scene.add(...companions.meshes);
    const halo = createSpectralHalo(context.random);
    scene.add(halo.group);
    let flow = 0;
    let lastT = Number.NaN;
    let spin = 0;
    let agcLast = Number.NaN;
    const agcPeak = [0.004, 0.004, 0.004];
    let hue = 0;
    let lastKickHue = 0;
    const camera = new PerspectiveCamera(38, context.settings.width / context.settings.height, 0.1, 30);
    camera.position.set(0, 0.15, 5.7);
    camera.lookAt(0, 0, 0);
    return {
      update(frame) {
        const raw = frame.controls;
        // Soft-knee boost: quiet music still moves things, loud saturates at 1.
        // Auto gain: each band is normalised by its own slowly decaying recent peak,
        // so quiet inputs still drive the full range. Sensitivity shapes the curve.
        const agcDt = Number.isFinite(agcLast) ? Math.min(0.1, Math.max(0, frame.timeSeconds - agcLast)) : 0;
        agcLast = frame.timeSeconds;
        const decay = Math.exp(-agcDt / 6);
        const norm = (x: number, k: number) => {
          agcPeak[k] = Math.max(Math.max(0, x), agcPeak[k] * decay, 0.004);
          return Math.min(1, Math.pow(Math.max(0, x) / agcPeak[k], 1.6 / Math.max(0.5, raw.sensitivity * 0.6)));
        };
        const c = { ...raw, bass: norm(raw.bass, 0), mids: norm(raw.mids, 1), highs: norm(raw.highs, 2), kick: Math.min(1, raw.kick * 1.4) };
        const drive = c.audioDrive;
        time.value = frame.timeSeconds * c.motionSpeed;
        const t = time.value;
        const dt = Number.isFinite(lastT) ? Math.min(0.1, Math.max(0, frame.timeSeconds - lastT)) : 0;
        lastT = frame.timeSeconds;
        // Mids push the fold field along; highs spin the halo.
        flow += dt * c.mids * drive * 1.6;
        spin += dt * (0.02 + c.highs * 0.35);
        hue += dt * c.colorSpeed * (1 + c.mids * 3) + (c.kick > 0.5 && lastKickHue <= 0.5 ? 0.12 : 0);
        lastKickHue = c.kick;
        huePhase.value = hue % 1;
        colorShift.value = c.colorShift;
        screenTint.value = c.screenTint;
        habitat.update(t);
        glow.value = c.glow;
        roughness.value = c.roughness;
        nacre.value = c.nacre + c.highs * 0.4 * drive;
        audioGlow.value = (c.kick * 0.9 + c.bass * 0.35) * drive;
        deform(t, c.spikeHeight + c.bass * 0.6 * drive, c.noiseScale, c.sharpness, c.breath,
          flow, c.kick * drive, c.highs * drive);
        body.scale.setScalar(1 + c.kick * 0.09 * drive + c.bass * 0.04 * drive);
        body.rotation.y = t * 0.28 + flow * 0.4;
        body.rotation.z = Math.sin(t * 0.35) * 0.12;
        organism.position.y = Math.sin(t * 0.7) * 0.07;
        companions.update(frame.timeSeconds, c.companions, c.companionSize, c.companionReach, c.bass, c.mids, c.highs, c.kick);
        // Ring bloom cycle: rest, swell outward to fill the frame, hold, recede.
        const ph = ((frame.timeSeconds / c.ringBloomPeriod) % 1 + 1) % 1;
        const smoothstep = (a: number, b: number, x: number) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
        const bloom = c.ringBloom * (smoothstep(0.5, 0.78, ph) - smoothstep(0.88, 1, ph));
        halo.update(frame.timeSeconds, c.bass, c.mids, c.highs, c.kick, c.spectrumGain, spin, Math.round(c.ringEchoes), bloom);
        moteMaterial.opacity = 0.28 + c.highs * 0.5 * drive;
        // Spawn a new echo on a slow clock, sooner on a kick.
        const now = frame.timeSeconds;
        const interval = c.echoInterval * (1 - c.kick * 0.6);
        if (c.echoes > 0 && (now - lastEchoAt >= interval || now < lastEchoAt)) {
          lastEchoAt = now;
          const e = echoes[nextEcho];
          nextEcho = (nextEcho + 1) % echoCount;
          (e.geometry.getAttribute('position') as BufferAttribute).copy(position).needsUpdate = true;
          (e.geometry.getAttribute('normal') as BufferAttribute).copy(normal).needsUpdate = true;
          e.born = now;
          e.rotY = body.rotation.y;
          e.rotZ = body.rotation.z;
          e.y = organism.position.y;
          e.scale = body.scale.x;
        }
        echoFade.value = c.echoes;
        const life = interval * echoCount;
        for (const e of echoes) {
          const age = now - e.born;
          const u = age / life;
          if (!(u >= 0 && u < 1)) { e.mesh.visible = false; continue; }
          e.mesh.visible = true;
          e.fade.value = Math.pow(1 - u, 1.6) * 0.32 * Math.min(1, age * 4);
          e.mesh.position.set(0, e.y, -u * 2.6);
          e.mesh.scale.setScalar(e.scale * (1 + u * 0.55));
          e.mesh.rotation.set(0, e.rotY - u * 0.25, e.rotZ);
        }
        motes.rotation.y = t * -0.06 - spin * 0.5;
        motes.rotation.z = Math.sin(t * 0.2) * 0.05;
      },
      async evaluate(_inputs, evaluation) {
        return { image: await evaluation.render(scene, camera) };
      },
      reset() {
        time.value = 0;
        previousTime = Number.NaN;
        flow = 0;
        spin = 0;
        agcLast = Number.NaN;
        agcPeak.fill(0.004);
        hue = 0;
        lastKickHue = 0;
        lastT = Number.NaN;
        halo.reset();
        companions.reset();
        lastEchoAt = Number.NEGATIVE_INFINITY;
        nextEcho = 0;
        for (const e of echoes) { e.born = Number.NEGATIVE_INFINITY; e.mesh.visible = false; }
      },
      dispose() {
        habitat.dispose();
        halo.dispose();
        companions.dispose();
        nacreTexture?.dispose();
        for (const e of echoes) { e.geometry.dispose(); e.material.dispose(); }
        geometry.dispose();
        material.dispose();
        moteGeometry.dispose();
        moteMaterial.dispose();
      },
    };
  },
});



