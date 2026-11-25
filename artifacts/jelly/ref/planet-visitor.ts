import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, InstancedMesh, MeshBasicNodeMaterial, Object3D, PerspectiveCamera, PlaneGeometry, Matrix4, Quaternion, Scene, Vector3 } from 'three/webgpu';
import { float, mix, smoothstep, uniform, uv, vec3 } from 'three/tsl';
import { createAlienSaucer } from './saucer.ts';
import { createAlienFlag } from './flag.ts';

export interface VisitTarget {
  /** Stable target identity; array order may change. */
  id: string;
  /** World-space landing point on the visible record surface. */
  position: Vector3;
  /** World-space surface normal, pointing out of the visible face. */
  normal: Vector3;
  /** World-space tangent chosen to keep the pilot facing the camera. */
  up: Vector3;
  /** World-space record radius. */
  radius: number;
  surfaceUp: Vector3;
  logoTop: number;
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => { const x = clamp(v); return x * x * x * (x * (x * 6 - 15) + 10); };

/**
 * Standalone SDK 0.2/0.4 scene adapter. Call AFTER planet world matrices update.
 * enabled is a 0..1 scene-controlled gate; use 0 during disruptive story beats.
 * Target vectors are read, never mutated. Source library entry stays independent.
 */
export function createPlanetVisitor(scene: Scene, camera: PerspectiveCamera) {
  const craft = createAlienSaucer();
  scene.add(craft.root);
  // Use the scene's existing lighting; do not add a second scene-wide light rig.
  const flags = Array.from({ length: 6 }, () => createAlienFlag());
  const flagIds: string[] = flags.map(() => '');
  const flagTimes: number[] = flags.map(() => -1);
  const flagSides: number[] = flags.map(() => 1);
  for (const flag of flags) { scene.add(flag.root); flag.root.visible = false; }
  const normal = new Vector3();
  const tangent = new Vector3();
  const right = new Vector3();
  const basis = new Matrix4();
  const pose = new Quaternion();
  const desiredPose = new Quaternion();
  const desiredPosition = new Vector3();
  const presentationUp = new Vector3();
  const presentationFront = new Vector3();
  const presentationRight = new Vector3();
  let poseReady = false;
  let flightClock = 0;
  const launchPosition = new Vector3();
  const exitPosition = new Vector3();
  const wanderCenter = new Vector3();
  const flightRight = new Vector3();
  const flightUp = new Vector3();
  const flightPose = new Quaternion();
  const flightNormal = new Vector3();
  const arcStart = new Vector3();
  const arcEnd = new Vector3();
  const arcAxis = new Vector3();
  let launchAngle = 0;
  let launchRadius = 20;
  function safeArc(from: Vector3, to: Vector3, t: number, clearance: number, out: Vector3) {
    arcStart.copy(from).sub(wanderCenter);
    arcEnd.copy(to).sub(wanderCenter);
    const ra = Math.max(clearance, arcStart.length());
    const rb = Math.max(clearance, arcEnd.length());
    arcStart.normalize(); arcEnd.normalize();
    const dot = Math.max(-1, Math.min(1, arcStart.dot(arcEnd)));
    const angle = Math.acos(dot);
    arcAxis.copy(arcEnd).addScaledVector(arcStart, -dot);
    if (arcAxis.lengthSq() < 0.000001) {
      arcAxis.copy(flightNormal).addScaledVector(arcStart, -flightNormal.dot(arcStart));
      if (arcAxis.lengthSq() < 0.000001) arcAxis.set(0, 1, 0).addScaledVector(arcStart, -arcStart.y);
    }
    arcAxis.normalize();
    out.copy(arcStart).multiplyScalar(Math.cos(angle * t)).addScaledVector(arcAxis, Math.sin(angle * t));
    out.normalize().multiplyScalar(ra + (rb - ra) * t).add(wanderCenter);
  }
  const visited = new Set<string>();
  let currentId = '';
  let landingSide = 1;
  const landingView = new Vector3();
  let lastVisit = -1;
  let visibility = 0;
  let flagClock = 0;
  const flightPosition = new Vector3();
  const landingPosition = new Vector3();
  const trailGeometry = new PlaneGeometry(1, 1);
  const trailMaterial = new MeshBasicNodeMaterial({ color: 0xffffff, transparent: true, blending: AdditiveBlending, depthWrite: false });
  trailMaterial.opacityNode = float(1).sub(smoothstep(0.05, 0.5, uv().sub(0.5).length())).pow(2).mul(0.55);
  trailMaterial.toneMapped = false;
  const sparkColor = new Color();
  const sparks = new InstancedMesh(trailGeometry, trailMaterial, 96);
  sparks.frustumCulled = false;
  scene.add(sparks);
  const history = Array.from({ length: 96 }, () => ({ position: new Vector3(), time: -100 }));
  const dummy = new Object3D();
  let nextSpark = 0;
  let lastSparkTime = -1;
  const ribbonGeometry = new BufferGeometry();
  const ribbonPositions = new Float32Array(96 * 6);
  const ribbonUV = new Float32Array(96 * 4);
  const ribbonIndices: number[] = [];
  for (let i = 0; i < 96; i++) {
    ribbonUV.set([i / 95, 0, i / 95, 1], i * 4);
    if (i < 95) { const k = i * 2; ribbonIndices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  ribbonGeometry.setAttribute('position', new BufferAttribute(ribbonPositions, 3));
  ribbonGeometry.setAttribute('uv', new BufferAttribute(ribbonUV, 2));
  ribbonGeometry.setIndex(ribbonIndices);
  const ribbonGain = uniform(0);
  const ribbonMaterial = new MeshBasicNodeMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
  ribbonMaterial.colorNode = mix(mix(vec3(0.45, 1, 0.88), vec3(0.35, 0.22, 1), smoothstep(0, 0.55, uv().x)), vec3(1, 0.25, 0.45), smoothstep(0.4, 1, uv().x));
  ribbonMaterial.opacityNode = float(1).sub(uv().y.sub(0.5).abs().mul(2)).pow(2).mul(float(1).sub(uv().x).pow(1.5)).mul(ribbonGain);
  ribbonMaterial.toneMapped = false;
  const ribbon = new Mesh(ribbonGeometry, ribbonMaterial);
  ribbon.frustumCulled = false;
  scene.add(ribbon);
  const ribbonSide = new Vector3();
  const ribbonTangent = new Vector3();
  const ribbonSight = new Vector3();

  function orient(target: VisitTarget, side = 1) {
    normal.copy(target.normal).normalize().multiplyScalar(side);
    tangent.copy(target.up).addScaledVector(normal, -target.up.dot(normal));
    if (tangent.lengthSq() < 0.0001) {
      tangent.set(Math.abs(normal.y) < 0.9 ? 0 : 1, Math.abs(normal.y) < 0.9 ? 1 : 0, 0);
      tangent.addScaledVector(normal, -tangent.dot(normal));
    }
    tangent.normalize();
    right.crossVectors(normal, tangent).normalize();
    basis.makeBasis(right, normal, tangent);
    pose.setFromRotationMatrix(basis);
  }

  return {
    root: craft.root,
    update(time: number, delta: number, targets: VisitTarget[], enabled = 1, period = 48, size = 0.28, engine = 0.8, sunObstacle?: { position: Vector3; radius: number }) {
      flagClock += Math.max(0, delta);
      const cycle = Math.max(35, Math.min(60, period));
      if (enabled > 0.5) flightClock += Math.max(0, delta);
      const visit = Math.floor(flightClock / cycle);
      const phase = (flightClock % cycle) / cycle;
      if (visit !== lastVisit && enabled > 0.5) {
        lastVisit = visit;
        const available = targets.filter(item => !visited.has(item.id));
        currentId = available.length ? available[visit % available.length].id : '';
        const selected = available.find(item => item.id === currentId);
        landingSide = selected && landingView.subVectors(camera.position, selected.position).dot(selected.normal) < 0 ? -1 : 1;
        wanderCenter.copy(sunObstacle?.position ?? new Vector3());
        const distance = Math.max(12, camera.position.distanceTo(wanderCenter));
        const height = Math.tan(camera.fov * Math.PI / 360) * distance;
        const side = visit % 2 ? -1 : 1;
        flightRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
        flightUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
        flightPose.copy(camera.quaternion);
        flightNormal.crossVectors(flightRight, flightUp).normalize();
        launchPosition.copy(wanderCenter).addScaledVector(flightRight, side * height * camera.aspect * 2.5).addScaledVector(flightUp, height * 0.35);
        exitPosition.copy(wanderCenter).addScaledVector(flightRight, -side * height * camera.aspect * 3).addScaledVector(flightUp, height * 1.5);
        arcStart.copy(launchPosition).sub(wanderCenter);
        launchAngle = Math.atan2(arcStart.dot(flightUp), arcStart.dot(flightRight));
        launchRadius = arcStart.length();
        poseReady = false;
        for (const point of history) point.time = -100;
      }
      const target = targets.find(item => item.id === currentId);
      const flightSeed = visit;
      visibility += (clamp(enabled) - visibility) * (1 - Math.exp(-Math.max(0, delta) * 3));
      const reveal = 1;
      craft.root.visible = !!target && phase < 0.97 && reveal * visibility > 0.001;
      if (target && craft.root.visible) {
        // Choose the visible surface at approach, after any camera tour has settled.
        if (phase < 0.40) landingSide = landingView.subVectors(camera.position, target.position).dot(target.normal) < 0 ? -1 : 1;
        orient(target, landingSide);
        const craftSize = Math.min(size, target.radius * 0.42) * 0.5;
        const approach = ease(phase / 0.15);
        const departure = ease((phase - 0.72) / 0.23);
        const landingWeight = ease((phase - 0.40) / 0.18) * (1 - ease((phase - 0.72) / 0.15));
        const gear = ease((phase - 0.48) / 0.10) * (1 - ease((phase - 0.73) / 0.07));
        landingPosition.copy(target.position).addScaledVector(normal, craftSize * 0.74);
        const squiggle = phase * Math.PI * 2;
        const clearance = Math.max(2.4, (sunObstacle?.radius ?? 1.7) + craftSize * 2 + 0.6);
        const angle = launchAngle + squiggle * 1.6 + Math.sin(squiggle * 4) * 0.22 + Math.sin(squiggle * 9) * 0.07;
        const radius = Math.max(clearance + 0.8, 4.5 + Math.sin(squiggle * 5 + flightSeed) * 0.7);
        const flightRadius = launchRadius * (1 - approach) + radius * approach;
        flightPosition.copy(wanderCenter)
          .addScaledVector(flightRight, Math.cos(angle) * flightRadius)
          .addScaledVector(flightUp, Math.sin(angle) * flightRadius)
          .addScaledVector(flightNormal, Math.sin(squiggle * 3) * 0.8 * approach);
        // Both approach and departure stay on an exterior arc, never a chord through the sun.
        safeArc(flightPosition, landingPosition, landingWeight, clearance, desiredPosition);
        if (phase >= 0.72) safeArc(landingPosition, exitPosition, departure, clearance, desiredPosition);
        desiredPose.copy(flightPose).slerp(pose, landingWeight);
        if (!poseReady) { craft.root.position.copy(desiredPosition); craft.root.quaternion.copy(desiredPose); poseReady = true; }
        craft.root.position.copy(desiredPosition);
        craft.root.quaternion.slerp(desiredPose, 1 - Math.exp(-Math.max(0, delta) * 5));
        craft.root.scale.setScalar(craftSize * visibility);
        craft.update(time, Math.sin(squiggle * 7) * 0.12 * (1 - gear), 1 - departure, 1, engine, 0, 0.43, gear);
        craft.faceCamera(camera);
        if (time - lastSparkTime > 0.012 && landingWeight < 0.95) {
          history[nextSpark].position.copy(craft.root.position);
          history[nextSpark].time = time;
          nextSpark = (nextSpark + 1) % history.length;
          lastSparkTime = time;
        }
        if (phase >= 0.63 && phase < 0.72 && enabled > 0.5 && !visited.has(target.id)) {
          visited.add(target.id);
          const slot = flagIds.indexOf('');
          if (slot >= 0) { flagIds[slot] = target.id; flagTimes[slot] = flagClock; flagSides[slot] = landingSide; }
        }
      }
      sparks.visible = enabled > 0.01;
      for (let i = 0; i < history.length; i++) {
        const age = time - history[i].time;
        const life = age >= 0 && age < 1.8 ? Math.pow(1 - age / 1.8, 1.6) : 0;
        dummy.position.copy(history[i].position);
        dummy.position.x += Math.sin(i * 13.7) * age * 0.04;
        dummy.position.y += Math.cos(i * 7.1) * age * 0.04;
        dummy.quaternion.copy(camera.quaternion);
        dummy.scale.setScalar(life * (0.06 + age * 0.07) * visibility);
        sparkColor.setHSL(0.46 + Math.min(1, Math.max(0, age) / 1.8) * 0.4 + Math.sin(i * 2.4) * 0.035, 0.85, 0.54 * life);
        sparks.setColorAt(i, sparkColor);
        dummy.updateMatrix();
        sparks.setMatrixAt(i, dummy.matrix);
      }
      sparks.instanceMatrix.needsUpdate = true;
      if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true;
      ribbonGain.value = visibility * (0.3 + engine * 0.25);
      ribbon.visible = enabled > 0.01;
      for (let i = 0; i < 96; i++) {
        const point = history[(nextSpark - 1 - i + history.length * 2) % history.length];
        const next = history[(nextSpark - 2 - i + history.length * 2) % history.length];
        const age = time - point.time;
        ribbonTangent.subVectors(point.position, next.position).normalize();
        ribbonSight.subVectors(camera.position, point.position).normalize();
        ribbonSide.crossVectors(ribbonTangent, ribbonSight).normalize();
        const width = age >= 0 && age < 1.8 ? (0.018 + age * 0.055) * Math.pow(1 - age / 1.8, 0.5) : 0;
        const k = i * 6;
        ribbonPositions[k] = point.position.x - ribbonSide.x * width;
        ribbonPositions[k + 1] = point.position.y - ribbonSide.y * width;
        ribbonPositions[k + 2] = point.position.z - ribbonSide.z * width;
        ribbonPositions[k + 3] = point.position.x + ribbonSide.x * width;
        ribbonPositions[k + 4] = point.position.y + ribbonSide.y * width;
        ribbonPositions[k + 5] = point.position.z + ribbonSide.z * width;
      }
      let validPoints = 0;
      for (let i = 0; i < 96; i++) {
        const age = time - history[(nextSpark - 1 - i + history.length * 2) % history.length].time;
        if (age < 0 || age >= 1.8) break;
        validPoints++;
      }
      ribbonGeometry.setDrawRange(0, Math.max(0, validPoints - 1) * 6);
      (ribbonGeometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
      for (let i = 0; i < flags.length; i++) {
        const destination = targets.find(item => item.id === flagIds[i]);
        if (!destination || flagTimes[i] < 0) { flags[i].root.visible = false; continue; }
        orient({ ...destination, up: destination.surfaceUp }, flagSides[i]);
        const flagSize = Math.min(size * 0.65, destination.radius * 0.24);
        flags[i].root.position.copy(destination.position).addScaledVector(destination.surfaceUp, destination.logoTop).addScaledVector(normal, 0.012);
        flags[i].root.quaternion.copy(pose);
        flags[i].update(time, ease((flagClock - flagTimes[i]) / 0.9), flagSize * visibility);
      }
    },
    reset() {
      currentId = '';
      flightClock = 0;
      visited.clear();
      poseReady = false;
      for (const point of history) point.time = -100;
      lastSparkTime = -1;
      lastVisit = -1;
      visibility = 0;
      craft.root.visible = false;
      for (let i = 0; i < flags.length; i++) { flagIds[i] = ''; flagTimes[i] = -1; flags[i].root.visible = false; }
    },
    dispose() { ribbon.removeFromParent(); ribbonGeometry.dispose(); ribbonMaterial.dispose(); sparks.removeFromParent(); trailGeometry.dispose(); trailMaterial.dispose(); craft.dispose(); for (const flag of flags) flag.dispose(); },
  };
}

