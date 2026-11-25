import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CircleGeometry, Color,
  DataTexture, DoubleSide, Group, InstancedMesh, LinearFilter, Mesh,
  MeshBasicNodeMaterial, Object3D, PerspectiveCamera, PlaneGeometry,
  Quaternion, Scene, TorusGeometry, Vector3,
} from 'three/webgpu';
import { float, mix, sin, smoothstep, uniform, uv, vec3 } from 'three/tsl';

export interface CometSettings {
  /** Seconds since the opening reveal completed. Use the Lux scene clock. */
  timeSeconds: number;
  reveal: number;
  /** Average opportunity spacing. Default 55; deliberately sparse. */
  interval?: number;
  size?: number;
  brightness?: number;
  /** Set zero to hide. This changes intensity, not the deterministic schedule. */
  activity?: number;
  /** Optional existing Highs control, 0..1. Light response, never spawn rate. */
  highs?: number;
  trailSize?: number;
  trailLength?: number;
  sunRadius?: number;
}

const clamp = (x: number, low = 0, high = 1) => Math.max(low, Math.min(high, x));
const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** Pure timing helper, also useful for selecting an offline preview moment. */
export function cometPassAt(timeSeconds: number, interval = 55) {
  const period = Math.max(40, interval);
  const clock = Math.max(0, timeSeconds);
  const event = Math.floor(clock / period);
  const delay = event === 0 ? 18 : 10 + hash(event + 3) * 10;
  const duration = 9 + hash(event + 9) * 3;
  const age = clock - event * period - delay;
  return { event, age, duration, active: timeSeconds >= 0 && age >= 0 };
}

/**
 * One rare flyby at a time: the supplied hippo vinyl, a cyan ion filament,
 * a curved violet dust fan, and sparse luminous grains. No external assets.
 * Owns its meshes/materials; never disposes the caller's record texture.
 */
export function createRecordComets(scene: Scene, camera: PerspectiveCamera, texture: DataTexture) {
  const root = new Group();
  root.visible = false;
  scene.add(root);
  const record = new Group();
  root.add(record);
  const geometry = new CircleGeometry(1, 96);
  const face = new MeshBasicNodeMaterial({ map: texture, side: DoubleSide });
  face.toneMapped = false;
  const disc = new Mesh(geometry, face);
  record.add(disc);
  const rimGeometry = new TorusGeometry(0.997, 0.013, 6, 96);
  const rimMaterial = new MeshBasicNodeMaterial({ color: 0xaeeaff });
  rimMaterial.toneMapped = false;
  record.add(new Mesh(rimGeometry, rimMaterial));

  const gain = uniform(0);
  const clock = uniform(0);
  const headGain = uniform(0);
  const headGeometry = new PlaneGeometry(5, 5);
  const headMaterial = new MeshBasicNodeMaterial();
  const headRadius = uv().sub(0.5).length().mul(5);
  headMaterial.colorNode = mix(vec3(0.28, 0.05, 1), vec3(0.12, 0.88, 1), uv().x);
  headMaterial.opacityNode = float(1).sub(smoothstep(0.72, 2.4, headRadius)).pow(3).mul(headGain);
  headMaterial.transparent = true;
  headMaterial.blending = AdditiveBlending;
  headMaterial.depthWrite = false;
  headMaterial.toneMapped = false;
  const headGlow = new Mesh(headGeometry, headMaterial);
  headGlow.position.z = -0.025;
  record.add(headGlow);

  const samples = 96;
  function makeRibbon(kind: number) {
    const vertices = new Float32Array((samples + 1) * 6);
    const texcoords = new Float32Array((samples + 1) * 4);
    const indices: number[] = [];
    for (let i = 0; i <= samples; i++) {
      const along = i / samples;
      texcoords.set([along, 0, along, 1], i * 4);
      if (i < samples) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const ribbonGeometry = new BufferGeometry();
    const position = new BufferAttribute(vertices, 3);
    ribbonGeometry.setAttribute('position', position);
    ribbonGeometry.setAttribute('uv', new BufferAttribute(texcoords, 2));
    ribbonGeometry.setIndex(indices);
    const material = new MeshBasicNodeMaterial();
    const cross = uv().y.sub(0.5).abs().mul(2);
    const crossFade = float(1).sub(smoothstep(0, 1, cross)).pow(kind === 1 ? 3 : 1.7);
    const endFade = float(1).sub(smoothstep(0.38, 1, uv().x));
    const filament = sin(uv().x.mul(38).sub(clock.mul(3.2)).add(uv().y.mul(8))).mul(0.07).add(0.93);
    material.colorNode = kind === 0
      ? mix(vec3(0.22, 0.85, 1), vec3(0.48, 0.045, 0.85), uv().x)
      : kind === 1
        ? mix(vec3(0.85, 0.97, 1), vec3(0.1, 0.6, 1), uv().x)
        : mix(vec3(0.85, 0.25, 0.7), vec3(0.2, 0.05, 0.7), uv().x);
    material.opacityNode = crossFade.mul(endFade).mul(filament).mul(gain).mul(kind === 1 ? 0.8 : kind === 0 ? 0.34 : 0.16);
    material.transparent = true;
    material.blending = AdditiveBlending;
    material.depthWrite = false;
    material.side = DoubleSide;
    material.toneMapped = false;
    const mesh = new Mesh(ribbonGeometry, material);
    mesh.frustumCulled = false;
    root.add(mesh);
    return { mesh, geometry: ribbonGeometry, material, vertices, position, kind };
  }
  const ribbons = [makeRibbon(0), makeRibbon(1), makeRibbon(2)];
  const grainGeometry = new PlaneGeometry(1, 1);
  const grainMaterial = new MeshBasicNodeMaterial();
  grainMaterial.opacityNode = float(1).sub(smoothstep(0, 0.5, uv().sub(0.5).length())).pow(3).mul(gain);
  grainMaterial.transparent = true;
  grainMaterial.blending = AdditiveBlending;
  grainMaterial.depthWrite = false;
  grainMaterial.toneMapped = false;
  const grains = new InstancedMesh(grainGeometry, grainMaterial, 84);
  grains.frustumCulled = false;
  root.add(grains);

  const origin = new Vector3();
  const right = new Vector3();
  const up = new Vector3();
  const forward = new Vector3();
  const birthRotation = new Quaternion();
  const p = new Vector3();
  const next = new Vector3();
  const tangent = new Vector3();
  const sight = new Vector3();
  const side = new Vector3();
  const grainDummy = new Object3D();
  const grainColor = new Color();
  let eventId = -1;
  let passStart = 0;
  let passDuration = 10;
  let exitAge = -1;
  let retired = false;
  const projectedHead = new Vector3();
  const viewHead = new Vector3();
  let viewHeight = 6;
  let direction = 1;
  let slope = 0.3;
  let bend = 0.4;
  let impact = 0;
  let depth = 0;
  let clearance = 2.5;

  function path(t: number, target: Vector3) {
    // Fast near periapsis, slower on either side; monotonic and continuous.
    const x = t * 2 - 1;
    const stretch = x + 0.13 * Math.sin(Math.PI * x);
    const px = stretch * viewHeight * camera.aspect * 1.38 * direction;
    const py = viewHeight * (impact + slope * stretch + bend * stretch * stretch);
    const pz = viewHeight * (depth * 0.25 + Math.sin(t * Math.PI) * 0.13);
    return target.copy(origin).addScaledVector(right, px).addScaledVector(up, py).addScaledVector(forward, pz);
  }

  return {
    update(settings: CometSettings) {
      let pass = cometPassAt(settings.timeSeconds, settings.interval);
      // Finish this flyby even if another scheduled opportunity arrives during its fade.
      if (eventId >= 0 && !retired) pass = { event: eventId, age: settings.timeSeconds - passStart, duration: passDuration, active: true };
      const visible = clamp(settings.reveal) * clamp(settings.activity ?? 1);
      root.visible = pass.active && visible > 0.001;
      if (!root.visible) return;
      if (eventId !== pass.event) {
        eventId = pass.event;
        passStart = settings.timeSeconds - pass.age;
        passDuration = pass.duration;
        exitAge = -1;
        retired = false;
        // Fix the flyby's frame at entry: the comet does not stick to a moving camera.
        camera.getWorldQuaternion(birthRotation);
        right.set(1, 0, 0).applyQuaternion(birthRotation);
        up.set(0, 1, 0).applyQuaternion(birthRotation);
        forward.set(0, 0, -1).applyQuaternion(birthRotation);
        const distance = clamp(camera.position.length(), 5, 20);
        origin.copy(camera.position).addScaledVector(forward, distance);
        viewHeight = Math.tan(camera.fov * Math.PI / 360) * distance;
        direction = hash(eventId + 19) > 0.5 ? 1 : -1;
        slope = (hash(eventId + 21) - 0.5) * 0.7;
        bend = (hash(eventId + 27) - 0.5) * 0.7;
        impact = (hash(eventId + 39) - 0.5) * 0.7;
        depth = hash(eventId + 44) - 0.5;
        // Choose one smooth birth-frame curve; never push individual samples around the sun.
        const safeRadius = (settings.sunRadius ?? 1.5) + viewHeight * 0.064 * clamp(settings.size ?? 1, 0.2, 3) + 0.7;
        const crossing = -origin.dot(right) / (viewHeight * camera.aspect * 1.38 * direction);
        const sideOfSun = hash(eventId + 39) > 0.5 ? 1 : -1;
        impact = -origin.dot(up) / viewHeight + sideOfSun * safeRadius * 1.35 / viewHeight - slope * crossing - bend * crossing * crossing;
      }
      if (retired) { root.visible = false; return; }
      clearance = (settings.sunRadius ?? 1.5) + viewHeight * 0.064 * clamp(settings.size ?? 1, 0.2, 3) + 0.55;
      const age = pass.age;
      const phase = age / pass.duration;
      const tailSeconds = 3.6 * clamp(settings.trailLength ?? 1.25, 0.3, 3);
      const headSize = viewHeight * 0.064 * clamp(settings.size ?? 1, 0.2, 3);
      path(phase, record.position);
      projectedHead.copy(record.position).project(camera);
      viewHead.copy(record.position).applyMatrix4(camera.matrixWorldInverse);
      const screenRadius = headSize / (Math.max(0.01, -viewHead.z) * Math.tan(camera.fov * Math.PI / 360));
      const headOnScreen = viewHead.z < -camera.near && viewHead.z > -camera.far
        && Math.abs(projectedHead.x) <= 1 + screenRadius / camera.aspect + 0.04
        && Math.abs(projectedHead.y) <= 1 + screenRadius + 0.04;
      if (headOnScreen) exitAge = -1;
      else if (phase >= 1 && exitAge < 0) exitAge = age;
      const tailFade = exitAge < 0 ? 1 : 1 - smooth((age - exitAge) / Math.max(4, tailSeconds));
      if (tailFade <= 0) { retired = true; root.visible = false; return; }
      const envelope = smooth(age / 1.2) * tailFade;
      const brightness = clamp(settings.brightness ?? 1, 0, 3);
      const intensity = envelope * visible * visible * brightness;
      gain.value = intensity;
      clock.value = settings.timeSeconds;
      headGain.value = intensity * 0.7;
      // Keep the vinyl attached for the entire flyby; only retire after it clears the live camera.
      record.visible = true;
      record.quaternion.copy(birthRotation);
      record.rotateX(0.12 * Math.sin(age * 0.8));
      record.rotateZ(-age * 2.6 + eventId * 1.2);
      record.scale.setScalar(headSize);

      const trailSize = clamp(settings.trailSize ?? 1.45, 0.3, 4);
      for (const ribbon of ribbons) {
        for (let i = 0; i <= samples; i++) {
          const tail = i / samples;
          const samplePhase = (age - tail * tailSeconds) / pass.duration;
          path(samplePhase, p);
          path(samplePhase + 0.002, next);
          tangent.subVectors(next, p).normalize();
          sight.subVectors(camera.position, p).normalize();
          side.crossVectors(tangent, sight).normalize();
          // Broad dust gently separates from the narrow blue ion tail.
          const curl = Math.sin(tail * 7 + eventId) * tail * tail;
          p.addScaledVector(up, viewHeight * tail * tail * (ribbon.kind === 2 ? 0.2 : 0.025));
          p.addScaledVector(side, viewHeight * curl * (ribbon.kind === 2 ? 0.06 : 0.014));
          p.addScaledVector(sight, -headSize * 0.3);
          const width = trailSize * viewHeight * (ribbon.kind === 1 ? 0.004 : ribbon.kind === 0 ? 0.028 + tail * 0.07 : 0.045 + tail * 0.18);
          const grow = smooth((age - tail * tailSeconds) / 0.8);
          const offset = i * 6;
          ribbon.vertices[offset] = p.x - side.x * width * grow;
          ribbon.vertices[offset + 1] = p.y - side.y * width * grow;
          ribbon.vertices[offset + 2] = p.z - side.z * width * grow;
          ribbon.vertices[offset + 3] = p.x + side.x * width * grow;
          ribbon.vertices[offset + 4] = p.y + side.y * width * grow;
          ribbon.vertices[offset + 5] = p.z + side.z * width * grow;
        }
        ribbon.position.needsUpdate = true;
      }
      for (let i = 0; i < 84; i++) {
        const tail = (i + hash(i + 8)) / 84;
        path((age - tail * tailSeconds) / pass.duration, p);
        const scatter = viewHeight * tail * 0.17 * trailSize;
        p.addScaledVector(up, (hash(i + 31) - 0.5) * scatter + tail * tail * viewHeight * 0.1);
        p.addScaledVector(right, (hash(i + 93) - 0.5) * scatter);
        grainDummy.position.copy(p);
        grainDummy.quaternion.copy(camera.quaternion);
        const fade = Math.pow(1 - tail, 1.8) * smooth((age - tail * tailSeconds) / 0.8);
        grainDummy.scale.setScalar(viewHeight * (0.004 + hash(i + 4) * 0.009) * fade);
        grainDummy.updateMatrix();
        grains.setMatrixAt(i, grainDummy.matrix);
        grainColor.setRGB((0.35 + tail * 0.3) * fade, (0.9 - tail * 0.5) * fade, fade);
        grains.setColorAt(i, grainColor);
      }
      grains.instanceMatrix.needsUpdate = true;
      if (grains.instanceColor) grains.instanceColor.needsUpdate = true;
    },
    reset() {
      eventId = -1;
      exitAge = -1;
      retired = false;
      root.visible = false;
    },
    dispose() {
      root.removeFromParent();
      for (const ribbon of ribbons) { ribbon.geometry.dispose(); ribbon.material.dispose(); }
      geometry.dispose(); face.dispose(); rimGeometry.dispose(); rimMaterial.dispose();
      headGeometry.dispose(); headMaterial.dispose();
      grains.dispose(); grainGeometry.dispose(); grainMaterial.dispose();
    },
  };
}

