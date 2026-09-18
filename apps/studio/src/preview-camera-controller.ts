import type { ControlValues } from '../../../packages/runtime-contracts/src/parameters.mjs';
import type { ImageCompositionProfile } from '../../../packages/runtime-contracts/src/composition-profile.mjs';
import type { NodePath } from '../../../packages/runtime-contracts/src/graph.ts';
import type { RuntimeView } from './service-client.ts';

export const CAMERA_CONTROLLER_ABI = 'lux/camera-controller/v1' as const;
export const CAMERA_CONTROLLER_CONTROL_IDS = ['yaw', 'pitch', 'panX', 'panY', 'dolly', 'roll'] as const;
export type CameraControllerControlId = typeof CAMERA_CONTROLLER_CONTROL_IDS[number];
type CameraValues = Record<CameraControllerControlId, number>;

export type CameraControllerBinding = Readonly<{
  nodePath: NodePath;
  aliases: Readonly<Record<CameraControllerControlId, string>>;
  values: Readonly<CameraValues>;
  controlSequence: number;
  key: string;
}>;

const samePath = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((id, index) => id === right[index]);

function cameraPort(port: unknown): boolean {
  if (!port || typeof port !== 'object') return false;
  const type = (port as { type?: unknown }).type;
  return !!type && typeof type === 'object' &&
    (type as { kind?: unknown }).kind === 'shader-field' &&
    (type as { version?: unknown }).version === 1 &&
    (type as { abi?: unknown }).abi === CAMERA_CONTROLLER_ABI;
}

function connectedCameraPaths(profile: ImageCompositionProfile): NodePath[] {
  const candidates: NodePath[] = [];
  const activePaths = profile.nodes.map(node => node.nodePath);
  type LeafPort = Readonly<{ nodePath: NodePath; definitionHash: string; portId: string }>;
  const resolveOutput = (definitionHash: string, nodePath: NodePath, portId: string): LeafPort | null => {
    const definition = profile.definitions[definitionHash];
    if (!definition) return null;
    if (definition.kind === 'code') return { nodePath, definitionHash, portId };
    const target = definition.body.outputBindings[portId];
    if (!target) return null;
    const child = definition.body.nodes.find(node => node.id === target.nodeId);
    return child ? resolveOutput(child.definitionHash, [...nodePath, child.id], target.portId) : null;
  };
  const resolveInputs = (definitionHash: string, nodePath: NodePath, portId: string): LeafPort[] => {
    const definition = profile.definitions[definitionHash];
    if (!definition) return [];
    if (definition.kind === 'code') return [{ nodePath, definitionHash, portId }];
    return (definition.body.inputBindings[portId] ?? []).flatMap(target => {
      const child = definition.body.nodes.find(node => node.id === target.nodeId);
      return child ? resolveInputs(child.definitionHash, [...nodePath, child.id], target.portId) : [];
    });
  };
  const visit = (definitionHash: string, parentPath: readonly string[]) => {
    const definition = profile.definitions[definitionHash];
    if (!definition || definition.kind !== 'graph') return;
    const nodes = new Map(definition.body.nodes.map(node => [node.id, node]));
    for (const edge of definition.body.edges) {
      const fromNode = nodes.get(edge.from.nodeId);
      const toNode = nodes.get(edge.to.nodeId);
      if (!fromNode || !toNode) continue;
      const producerPath = [...parentPath, fromNode.id] as unknown as NodePath;
      const consumerPath = [...parentPath, toNode.id] as unknown as NodePath;
      const producer = resolveOutput(fromNode.definitionHash, producerPath, edge.from.portId);
      if (!producer) continue;
      const producerDefinition = profile.definitions[producer.definitionHash];
      if (producerDefinition?.kind !== 'code' || !cameraPort(producerDefinition.metadata.outputs[producer.portId]) ||
          !activePaths.some(path => samePath(path, producer.nodePath))) continue;
      const controls = producerDefinition.metadata.controls;
      if (controls.length !== CAMERA_CONTROLLER_CONTROL_IDS.length ||
          !CAMERA_CONTROLLER_CONTROL_IDS.every(id => controls.some(control => control.id === id && control.type === 'number'))) continue;
      for (const consumer of resolveInputs(toNode.definitionHash, consumerPath, edge.to.portId)) {
        const consumerDefinition = profile.definitions[consumer.definitionHash];
        if (consumerDefinition?.kind === 'code' && cameraPort(consumerDefinition.metadata.inputs[consumer.portId]) &&
            activePaths.some(path => samePath(path, consumer.nodePath))) candidates.push(producer.nodePath);
      }
    }
    for (const node of definition.body.nodes) {
      if (profile.definitions[node.definitionHash]?.kind === 'graph') visit(node.definitionHash, [...parentPath, node.id]);
    }
  };
  visit(profile.graph.rootDefinitionHash, []);
  return candidates.filter((path, index) => candidates.findIndex(candidate => samePath(candidate, path)) === index);
}

export function cameraControllerBinding(runtime: RuntimeView | null): CameraControllerBinding | null {
  if (!runtime || runtime.sdkVersion !== '0.4.0' || !runtime.composition || !runtime.controlSchemaHash) return null;
  const paths = connectedCameraPaths(runtime.composition);
  if (paths.length !== 1) return null;
  const nodePath = paths[0]!;
  const aliases = {} as Record<CameraControllerControlId, string>;
  const values = {} as CameraValues;
  for (const controlId of CAMERA_CONTROLLER_CONTROL_IDS) {
    const matchingAliases = Object.entries(runtime.composition.publicControlBindings)
      .filter(([, targets]) => targets.length === 1 && targets[0]!.active &&
        targets[0]!.controlId === controlId && samePath(targets[0]!.nodePath, nodePath))
      .map(([alias]) => alias);
    if (matchingAliases.length !== 1) return null;
    const alias = matchingAliases[0]!;
    const definition = runtime.controlSchema.find(control => control.id === alias);
    const value = runtime.controls[alias];
    if (!definition || definition.type !== 'number' || typeof value !== 'number' || !Number.isFinite(value)) return null;
    aliases[controlId] = alias;
    values[controlId] = value;
  }
  const key = JSON.stringify({
    instanceId: runtime.instanceId,
    generation: runtime.generation,
    revisionId: runtime.revisionId,
    schemaHash: runtime.controlSchemaHash,
    nodePath,
    aliases,
  });
  return Object.freeze({ nodePath, aliases: Object.freeze(aliases), values: Object.freeze(values), controlSequence: runtime.controlSequence, key });
}

type PreviewSurface = Pick<HTMLElement,
  'addEventListener' | 'removeEventListener' | 'getBoundingClientRect' | 'setPointerCapture' | 'releasePointerCapture'>;

export type PreviewCameraControllerOptions = Readonly<{
  getRuntime(): RuntimeView | null;
  write(values: ControlValues): Promise<unknown>;
  onError(error: unknown): void;
  scheduleFrame?(callback: FrameRequestCallback): number;
  cancelFrame?(id: number): void;
}>;

export type PreviewCameraController = Readonly<{
  reset(): Promise<void>;
  dispose(): void;
}>;

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const wrapAngle = (value: number) => {
  const wrapped = ((value + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return Object.is(wrapped, -0) ? 0 : wrapped;
};
const zeros = (): CameraValues => ({ yaw: 0, pitch: 0, panX: 0, panY: 0, dolly: 0, roll: 0 });
const sameBinding = (left: CameraControllerBinding | null, right: CameraControllerBinding) => left?.key === right.key;
const sameValues = (left: Readonly<CameraValues>, right: Readonly<CameraValues>) =>
  CAMERA_CONTROLLER_CONTROL_IDS.every(id => left[id] === right[id]);

export function attachPreviewCameraController(
  element: PreviewSurface,
  options: PreviewCameraControllerOptions,
): PreviewCameraController | null {
  const binding = cameraControllerBinding(options.getRuntime());
  if (!binding) return null;
  const schedule = options.scheduleFrame ?? (callback => requestAnimationFrame(callback));
  const cancel = options.cancelFrame ?? (id => cancelAnimationFrame(id));
  let values: CameraValues = { ...binding.values };
  let scheduled: number | null = null;
  let observedControlSequence = binding.controlSequence;
  let issuedSequenceFloor = binding.controlSequence;
  let optimistic = false;
  let writeVersion = 0;
  let completedWriteVersion = 0;
  let unsubmitted = false;
  let needsResync = false;
  let disposed = false;
  let active: null | { pointerId: number; mode: 'orbit' | 'pan' | 'roll'; x: number; y: number } = null;

  const patch = (source: Readonly<CameraValues>): ControlValues => Object.fromEntries(
    CAMERA_CONTROLLER_CONTROL_IDS.map(id => [binding.aliases[id], source[id]]),
  );
  const report = (reason: unknown) => {
    if (!disposed && sameBinding(cameraControllerBinding(options.getRuntime()), binding)) options.onError(reason);
  };
  const acknowledge = (result: unknown, submitted: Readonly<CameraValues>, version: number, expectedSequence: number) => {
    const acknowledged = cameraControllerBinding(result as RuntimeView | null);
    const acknowledgedSequence = sameBinding(acknowledged, binding) ? acknowledged!.controlSequence : expectedSequence;
    observedControlSequence = Math.max(observedControlSequence, acknowledgedSequence);
    issuedSequenceFloor = Math.max(issuedSequenceFloor, acknowledgedSequence);
    completedWriteVersion = Math.max(completedWriteVersion, version);
    if (version === writeVersion && !unsubmitted && sameValues(values, submitted) && sameBinding(acknowledged, binding)) {
      values = { ...acknowledged!.values };
      optimistic = false;
      needsResync = false;
    }
  };
  const flush = () => {
    scheduled = null;
    if (disposed || !sameBinding(cameraControllerBinding(options.getRuntime()), binding)) return;
    const submitted = { ...values };
    const version = ++writeVersion;
    const expectedSequence = ++issuedSequenceFloor;
    optimistic = true;
    unsubmitted = false;
    needsResync = false;
    void options.write(patch(submitted)).then(result => acknowledge(result, submitted, version, expectedSequence)).catch(reason => {
      if (version === writeVersion && sameValues(values, submitted)) {
        optimistic = false;
        issuedSequenceFloor = observedControlSequence;
        needsResync = true;
      }
      report(reason);
    });
  };
  const queue = () => {
    optimistic = true;
    unsubmitted = true;
    if (scheduled === null) scheduled = schedule(flush);
  };
  const sync = () => {
    const live = cameraControllerBinding(options.getRuntime());
    if (!sameBinding(live, binding)) return false;
    if (live!.controlSequence < observedControlSequence) return true;
    if (live!.controlSequence !== observedControlSequence || needsResync) {
      const newerCompletedState = live!.controlSequence > observedControlSequence &&
        completedWriteVersion === writeVersion && !unsubmitted;
      observedControlSequence = live!.controlSequence;
      issuedSequenceFloor = Math.max(issuedSequenceFloor, observedControlSequence);
      needsResync = false;
      if (sameValues(live!.values, values)) optimistic = false;
      else if (!optimistic || newerCompletedState) {
        values = { ...live!.values };
        optimistic = false;
      }
    }
    return true;
  };

  const pointerDown = (event: PointerEvent) => {
    if (disposed || !sync()) return;
    const eventTarget = event.target as { closest?(selector: string): unknown } | null;
    if (eventTarget?.closest?.('[data-camera-controller-ignore]')) return;
    const mode = event.button === 2 || (event.button === 0 && event.shiftKey) ? 'pan'
      : event.button === 0 && event.altKey ? 'roll'
      : event.button === 0 ? 'orbit' : null;
    if (!mode) return;
    event.preventDefault();
    active = { pointerId: event.pointerId, mode, x: event.clientX, y: event.clientY };
    element.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent) => {
    if (!active || active.pointerId !== event.pointerId || disposed) return;
    const bounds = element.getBoundingClientRect();
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    active.x = event.clientX;
    active.y = event.clientY;
    if (active.mode === 'orbit') {
      values.yaw = wrapAngle(values.yaw - dx / width * Math.PI * 2);
      values.pitch = clamp(values.pitch - dy / height * Math.PI, -1.553, 1.553);
    } else if (active.mode === 'pan') {
      values.panX = clamp(values.panX - dx / width * 2, -2, 2);
      values.panY = clamp(values.panY + dy / height * 2, -2, 2);
    } else {
      values.roll = wrapAngle(values.roll + dx / width * Math.PI * 2);
    }
    event.preventDefault();
    queue();
  };
  const endPointer = (event: PointerEvent) => {
    if (!active || active.pointerId !== event.pointerId) return;
    active = null;
    try { element.releasePointerCapture(event.pointerId); } catch { /* Capture may already be released by the host. */ }
  };
  const wheel = (event: WheelEvent) => {
    if (disposed || !sync()) return;
    const eventTarget = event.target as { closest?(selector: string): unknown } | null;
    if (eventTarget?.closest?.('[data-camera-controller-ignore]')) return;
    const height = Math.max(1, element.getBoundingClientRect().height);
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
    values.dolly = clamp(values.dolly + pixels / height, -0.95, 4);
    event.preventDefault();
    queue();
  };
  const contextMenu = (event: Event) => { if (!disposed) event.preventDefault(); };

  element.addEventListener('pointerdown', pointerDown as EventListener);
  element.addEventListener('pointermove', pointerMove as EventListener);
  element.addEventListener('pointerup', endPointer as EventListener);
  element.addEventListener('pointercancel', endPointer as EventListener);
  element.addEventListener('lostpointercapture', endPointer as EventListener);
  element.addEventListener('wheel', wheel as EventListener, { passive: false });
  element.addEventListener('contextmenu', contextMenu);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    active = null;
    if (scheduled !== null) cancel(scheduled);
    scheduled = null;
    element.removeEventListener('pointerdown', pointerDown as EventListener);
    element.removeEventListener('pointermove', pointerMove as EventListener);
    element.removeEventListener('pointerup', endPointer as EventListener);
    element.removeEventListener('pointercancel', endPointer as EventListener);
    element.removeEventListener('lostpointercapture', endPointer as EventListener);
    element.removeEventListener('wheel', wheel as EventListener);
    element.removeEventListener('contextmenu', contextMenu);
  };
  const reset = async () => {
    if (disposed) return;
    active = null;
    if (scheduled !== null) cancel(scheduled);
    scheduled = null;
    unsubmitted = false;
    values = zeros();
    if (!sameBinding(cameraControllerBinding(options.getRuntime()), binding)) return;
    const submitted = { ...values };
    const version = ++writeVersion;
    const expectedSequence = ++issuedSequenceFloor;
    optimistic = true;
    needsResync = false;
    try {
      const result = await options.write(patch(submitted));
      acknowledge(result, submitted, version, expectedSequence);
    } catch (reason) {
      if (version === writeVersion && sameValues(values, submitted)) {
        optimistic = false;
        issuedSequenceFloor = observedControlSequence;
        needsResync = true;
      }
      report(reason);
    }
  };
  return Object.freeze({ reset, dispose });
}
