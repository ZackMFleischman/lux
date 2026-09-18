import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compileVisual } from '../../apps/build-worker/src/compile.mjs';
import { linkRuntime } from '../../apps/build-worker/src/link-runtime.mjs';
import { validateLibraryCandidate } from '../../packages/core/src/component-library-validation.ts';
import { discoverVisualSdk } from '../../packages/visual-sdk/src/discovery.mjs';
import {
  CAMERA_CONTROLLER_ABI,
  readCameraController,
  resolveCameraPose,
} from '../../creative/camera-controller/camera-pose.ts';
import {
  attachPreviewCameraController,
  cameraControllerBinding,
} from '../../apps/studio/src/preview-camera-controller.ts';
import type { RuntimeView } from '../../apps/studio/src/service-client.ts';

const cameraNode = '11111111-1111-4111-8111-111111111111';
const consumerNode = '22222222-2222-4222-8222-222222222222';
const edgeId = '33333333-3333-4333-8333-333333333333';
const rootHash = 'a'.repeat(64);
const cameraHash = 'b'.repeat(64);
const consumerHash = 'c'.repeat(64);
const ids = ['yaw', 'pitch', 'panX', 'panY', 'dolly', 'roll'] as const;
const aliases = Object.fromEntries(ids.map(id => [id, `view-${id}`])) as Record<typeof ids[number], string>;

test('SDK discovery advertises the Studio camera controller convention', async () => {
  const discovery = await discoverVisualSdk();
  assert.deepEqual(discovery.composition.cameraController, {
    abi: CAMERA_CONTROLLER_ABI,
    controlIds: ids,
    studioPreviewGestures: true,
  });
});

function runtime(overrides: Record<string, unknown> = {}): RuntimeView {
  const cameraControls = ids.map(id => ({ id, type: 'number', label: id, default: 0, min: -10, max: 10, step: 0.01, changeCost: 'live' }));
  const publicControls = ids.map(id => ({ ...cameraControls.find(row => row.id === id)!, id: aliases[id] }));
  return {
    instanceId: 'camera-instance', generation: 3, revisionId: 'camera-r1', sceneName: 'Camera fixture', authority: 'studio',
    playback: 'paused', clockEpoch: 0, frameId: '1', output: { width: 1280, height: 720 }, fault: null,
    sdkVersion: '0.4.0', controlSchema: publicControls, controlSchemaHash: 'd'.repeat(64),
    controls: Object.fromEntries(ids.map(id => [aliases[id], 0])), controlSequence: 0,
    controlAnimations: [], controlAnimationIssues: [], animationSequence: 0,
    composition: {
      version: 2,
      declaration: { definitions: {}, nodes: [], edges: [], output: { nodeId: consumerNode, portId: 'image' }, expose: [] },
      definitionNames: {}, graph: { version: 2, rootDefinitionHash: rootHash, outputPort: 'image' },
      definitions: {
        [rootHash]: { kind: 'graph', metadata: { inputs: {}, outputs: {}, controls: publicControls }, body: {
          nodes: [
            { id: cameraNode, definitionHash: cameraHash, controlDefaults: {} },
            { id: consumerNode, definitionHash: consumerHash, controlDefaults: {} },
          ],
          edges: [{ id: edgeId, from: { nodeId: cameraNode, portId: 'camera' }, to: { nodeId: consumerNode, portId: 'camera' }, delay: 'none' }],
          inputBindings: {}, outputBindings: { image: { nodeId: consumerNode, portId: 'image' } }, controlBindings: {},
        } },
        [cameraHash]: { kind: 'code', metadata: { controls: cameraControls, inputs: {}, outputs: {
          camera: { type: { kind: 'shader-field', version: 1, abi: CAMERA_CONTROLLER_ABI }, label: 'Camera', description: 'Camera offsets' },
        } } },
        [consumerHash]: { kind: 'code', metadata: { controls: [], inputs: {
          camera: { type: { kind: 'shader-field', version: 1, abi: CAMERA_CONTROLLER_ABI }, label: 'Camera', description: 'Camera offsets' },
        }, outputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'Image' } } } },
      },
      publicControls,
      publicControlBindings: Object.fromEntries(ids.map(id => [aliases[id], [{ nodePath: [cameraNode], controlId: id, active: true }]])),
      nodes: [
        { nodePath: [cameraNode], definitionHash: cameraHash, schema: cameraControls, schemaHash: 'e'.repeat(64) },
        { nodePath: [consumerNode], definitionHash: consumerHash, schema: [], schemaHash: 'f'.repeat(64) },
      ],
    },
    ...overrides,
  } as unknown as RuntimeView;
}

test('camera field validation and pose math preserve the authored zero pose', () => {
  const values = readCameraController({ version: 1, abi: CAMERA_CONTROLLER_ABI, fragments: {}, values: {
    yaw: 0, pitch: 0, panX: 0, panY: 0, dolly: 0, roll: 0,
  } });
  const pose = resolveCameraPose({ position: [0, 0, 18], target: [0, 0, 0], up: [0, 1, 0] }, values, { focusDistance: 18, minDistance: 3 });
  assert.deepEqual(pose, {
    position: [0, 0, 18], target: [0, 0, 0], up: [0, 1, 0],
    forward: [0, 0, -1], right: [1, 0, 0],
  });
  assert.throws(() => readCameraController({ version: 1, abi: CAMERA_CONTROLLER_ABI, fragments: {}, values: { ...values, dolly: Number.NaN } }), /finite/);
  assert.throws(() => readCameraController({ version: 1, abi: 'lux/other/v1', fragments: {}, values }), /lux\/camera-controller\/v1/);
});

test('the reusable Camera Controller source passes the real Library compile harness', async () => {
  const source = {
    sdkVersion: '0.4.0' as const,
    entry: 'camera-controller.ts',
    files: {
      'camera-controller.ts': await readFile(resolve('creative/camera-controller/camera-controller.ts'), 'utf8'),
      'camera-pose.ts': await readFile(resolve('creative/camera-controller/camera-pose.ts'), 'utf8'),
    },
  };
  const dependencyRoot = process.env.LUX_COMPILER_DEPENDENCIES || resolve('node_modules');
  await validateLibraryCandidate(source, async candidate => {
    const compiled = await compileVisual({ source: candidate }, { dependencyRoot });
    if (!compiled.ok) return { ok: false, diagnostics: compiled.diagnostics };
    return { ok: true, linked: await linkRuntime(compiled.artifact, { dependencyRoot }) };
  });
});

test('pose offsets orbit, pan, dolly and roll without mutating authored inputs', () => {
  const base = { position: [0, 0, 10] as const, target: [0, 0, 0] as const, up: [0, 1, 0] as const };
  const pose = resolveCameraPose(base, { yaw: Math.PI / 2, pitch: 0, panX: 0.5, panY: 0, dolly: -1, roll: Math.PI / 2 }, { focusDistance: 5, minDistance: 3 });
  assert.deepEqual(base, { position: [0, 0, 10], target: [0, 0, 0], up: [0, 1, 0] });
  assert.deepEqual(pose.position.map(value => Math.round(value * 1e9) / 1e9), [-5, -2.5, 0]);
  assert.deepEqual(pose.target.map(value => Math.round(value * 1e9) / 1e9), [0, -2.5, 0]);
  assert.deepEqual(pose.forward.map(value => Math.round(value * 1e9) / 1e9), [1, 0, 0]);
  assert.deepEqual(pose.up.map(value => Math.round(value * 1e9) / 1e9), [0, 0, 1]);
});

test('binding derives arbitrary public aliases only for one connected opted-in camera field', () => {
  const binding = cameraControllerBinding(runtime());
  assert.deepEqual(binding?.aliases, aliases);
  assert.deepEqual(binding?.nodePath, [cameraNode]);
  assert.equal(cameraControllerBinding(runtime({ composition: undefined })), null);
  const disconnected = structuredClone(runtime()) as any;
  disconnected.composition.definitions[rootHash].body.edges = [];
  assert.equal(cameraControllerBinding(disconnected), null);
  const missingAlias = structuredClone(runtime()) as any;
  delete missingAlias.composition.publicControlBindings[aliases.roll];
  assert.equal(cameraControllerBinding(missingAlias), null);

  const nested = structuredClone(runtime()) as any;
  const wrapperNode = '44444444-4444-4444-8444-444444444444';
  const nestedHash = '1'.repeat(64);
  nested.composition.definitions[nestedHash] = nested.composition.definitions[rootHash];
  nested.composition.definitions[rootHash] = { kind: 'graph', metadata: nested.composition.definitions[rootHash].metadata, body: {
    nodes: [{ id: wrapperNode, definitionHash: nestedHash, controlDefaults: {} }], edges: [], inputBindings: {},
    outputBindings: { image: { nodeId: wrapperNode, portId: 'image' } }, controlBindings: {},
  } };
  nested.composition.nodes = nested.composition.nodes.map((node: any) => ({ ...node, nodePath: [wrapperNode, ...node.nodePath] }));
  for (const targets of Object.values(nested.composition.publicControlBindings) as any[]) {
    targets[0].nodePath = [wrapperNode, ...targets[0].nodePath];
  }
  assert.deepEqual(cameraControllerBinding(nested)?.nodePath, [wrapperNode, cameraNode], 'nested controller exposure resolves to its flattened leaf path');

  const nestedConsumer = structuredClone(runtime()) as any;
  nestedConsumer.composition.definitions[nestedHash] = {
    kind: 'graph',
    metadata: {
      controls: [],
      inputs: nestedConsumer.composition.definitions[consumerHash].metadata.inputs,
      outputs: nestedConsumer.composition.definitions[consumerHash].metadata.outputs,
    },
    body: {
      nodes: [{ id: consumerNode, definitionHash: consumerHash, controlDefaults: {} }],
      edges: [],
      inputBindings: { camera: [{ nodeId: consumerNode, portId: 'camera' }] },
      outputBindings: { image: { nodeId: consumerNode, portId: 'image' } },
      controlBindings: {},
    },
  };
  nestedConsumer.composition.definitions[rootHash].body.nodes[1] = {
    id: wrapperNode, definitionHash: nestedHash, controlDefaults: {},
  };
  nestedConsumer.composition.definitions[rootHash].body.edges[0].to = { nodeId: wrapperNode, portId: 'camera' };
  nestedConsumer.composition.definitions[rootHash].body.outputBindings.image = { nodeId: wrapperNode, portId: 'image' };
  nestedConsumer.composition.nodes[1] = {
    ...nestedConsumer.composition.nodes[1], nodePath: [wrapperNode, consumerNode],
  };
  assert.deepEqual(
    cameraControllerBinding(nestedConsumer)?.nodePath,
    [cameraNode],
    'graph input bindings resolve a root camera edge to the nested leaf consumer',
  );
});

class FakeSurface {
  listeners = new Map<string, Set<(event: any) => void>>();
  captured: number[] = [];
  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: (event: any) => void) { this.listeners.get(type)?.delete(listener); }
  emit(type: string, event: Record<string, unknown>) {
    const enriched = { preventDefault() {}, stopPropagation() {}, ...event };
    for (const listener of this.listeners.get(type) ?? []) listener(enriched);
  }
  getBoundingClientRect() { return { width: 1000, height: 500 }; }
  setPointerCapture(id: number) { this.captured.push(id); }
  releasePointerCapture() {}
}

test('preview gestures coalesce writes, stop at stale runtime, and Reset cancels queued motion', async () => {
  let current = runtime();
  const surface = new FakeSurface();
  const writes: Record<string, number>[] = [];
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  const control = attachPreviewCameraController(surface as unknown as HTMLElement, {
    getRuntime: () => current,
    write: async values => {
      writes.push({ ...values } as Record<string, number>);
      return runtime({ controls: { ...runtime().controls, ...values }, controlSequence: writes.length });
    },
    scheduleFrame: callback => { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelFrame: id => { frames.delete(id); },
    onError: error => { throw error; },
  });
  assert.ok(control);

  surface.emit('pointerdown', { pointerId: 3, button: 0, clientX: 0, clientY: 0, shiftKey: false, altKey: false,
    target: { closest: (selector: string) => selector === '[data-camera-controller-ignore]' ? {} : null } });
  surface.emit('pointermove', { pointerId: 3, clientX: 100, clientY: 100 });
  assert.equal(frames.size, 0, 'preview controls do not begin a camera gesture');

  surface.emit('pointerdown', { pointerId: 4, button: 0, clientX: 100, clientY: 100, shiftKey: false, altKey: false });
  surface.emit('pointermove', { pointerId: 4, clientX: 200, clientY: 150 });
  surface.emit('pointermove', { pointerId: 4, clientX: 250, clientY: 175 });
  assert.equal(frames.size, 1, 'pointer bursts share one scheduled write');
  const firstFrame = [...frames.values()][0]!; frames.clear(); firstFrame(1);
  await Promise.resolve();
  assert.equal(writes.length, 1);
  assert.equal(writes[0]![aliases.yaw], -0.3 * Math.PI);
  assert.equal(writes[0]![aliases.pitch], -0.15 * Math.PI);

  surface.emit('pointerup', { pointerId: 4 });
  surface.emit('pointerdown', { pointerId: 5, button: 0, clientX: 100, clientY: 100, shiftKey: true, altKey: false });
  surface.emit('pointermove', { pointerId: 5, clientX: 200, clientY: 150 });
  assert.equal(frames.size, 1);
  const panFrame = [...frames.values()][0]!; frames.clear(); panFrame(1.5);
  await Promise.resolve();
  assert.equal(writes.at(-1)![aliases.yaw], -0.3 * Math.PI, 'a rapid next gesture retains values until the runtime acknowledges them');
  assert.equal(writes.at(-1)![aliases.panX], -0.2);
  surface.emit('pointermove', { pointerId: 5, clientX: 250, clientY: 175 });
  assert.equal(frames.size, 1);
  await control!.reset();
  assert.equal(frames.size, 0, 'reset cancels the queued gesture frame');
  assert.deepEqual(writes.at(-1), Object.fromEntries(ids.map(id => [aliases[id], 0])));

  surface.emit('wheel', { deltaY: 100 });
  const staleFrame = [...frames.values()][0]!; frames.clear();
  current = runtime({ generation: 4 });
  staleFrame(2); await Promise.resolve();
  assert.equal(writes.length, 3, 'a stale scheduled write is discarded');

  control!.dispose();
  assert.ok([...surface.listeners.values()].every(listeners => listeners.size === 0), 'dispose removes every preview listener');
});

test('an older runtime acknowledgement cannot roll back newer optimistic camera motion', async () => {
  let current = runtime();
  const surface = new FakeSurface();
  const writes: Record<string, number>[] = [];
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  const control = attachPreviewCameraController(surface as unknown as HTMLElement, {
    getRuntime: () => current,
    write: async values => { writes.push({ ...values } as Record<string, number>); },
    scheduleFrame: callback => { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelFrame: id => { frames.delete(id); },
    onError: error => { throw error; },
  });
  assert.ok(control);

  const flush = async () => {
    const frame = [...frames.values()][0]!;
    frames.clear();
    frame(1);
    await Promise.resolve();
  };
  surface.emit('pointerdown', { pointerId: 1, button: 0, clientX: 0, clientY: 0, shiftKey: false, altKey: false });
  surface.emit('pointermove', { pointerId: 1, clientX: 100, clientY: 0 });
  await flush();
  surface.emit('pointermove', { pointerId: 1, clientX: 200, clientY: 0 });
  await flush();
  assert.equal(writes[0]![aliases.yaw], -0.2 * Math.PI);
  assert.equal(writes[1]![aliases.yaw], -0.4 * Math.PI);

  current = runtime({
    controls: { ...runtime().controls, [aliases.yaw]: -0.2 * Math.PI },
    controlSequence: 1,
  });
  surface.emit('pointerup', { pointerId: 1 });
  surface.emit('pointerdown', { pointerId: 2, button: 0, clientX: 200, clientY: 0, shiftKey: false, altKey: false });
  surface.emit('pointermove', { pointerId: 2, clientX: 250, clientY: 0 });
  await flush();
  assert.equal(writes[2]![aliases.yaw], -0.5 * Math.PI);

  control!.dispose();
});

test('a newer Inspector edit supersedes the latest acknowledged camera gesture', async () => {
  let current = runtime();
  const surface = new FakeSurface();
  const writes: Record<string, number>[] = [];
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  const control = attachPreviewCameraController(surface as unknown as HTMLElement, {
    getRuntime: () => current,
    write: async values => {
      writes.push({ ...values } as Record<string, number>);
      return runtime({ controls: { ...runtime().controls, ...values }, controlSequence: writes.length });
    },
    scheduleFrame: callback => { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelFrame: id => { frames.delete(id); },
    onError: error => { throw error; },
  });
  assert.ok(control);

  const flush = async () => {
    const frame = [...frames.values()][0]!;
    frames.clear();
    frame(1);
    await Promise.resolve();
    await Promise.resolve();
  };
  surface.emit('pointerdown', { pointerId: 1, button: 0, clientX: 0, clientY: 0, shiftKey: false, altKey: false });
  surface.emit('pointermove', { pointerId: 1, clientX: 100, clientY: 0 });
  await flush();
  assert.equal(writes[0]![aliases.yaw], -0.2 * Math.PI);

  current = runtime({
    controls: { ...runtime().controls, [aliases.yaw]: 0.4 * Math.PI },
    controlSequence: 2,
  });
  surface.emit('pointerup', { pointerId: 1 });
  surface.emit('pointerdown', { pointerId: 2, button: 0, clientX: 100, clientY: 0, shiftKey: false, altKey: false });
  surface.emit('pointermove', { pointerId: 2, clientX: 150, clientY: 0 });
  await flush();
  assert.equal(writes[1]![aliases.yaw], 0.3 * Math.PI);

  control!.dispose();
});
