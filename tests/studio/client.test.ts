import test from 'node:test';
import assert from 'node:assert/strict';
import { createDisconnectedClient, StudioController } from '../../apps/studio/src/service-client.ts';
import type { StudioClient, StudioSnapshot, StudioOperation } from '../../apps/studio/src/service-client.ts';
import { normalizeControlDeclarations } from '../../packages/runtime-contracts/src/parameters.mjs';

const connected = (): StudioSnapshot => ({
  connection: 'connected', message: null, receivedAtMs: 1000,
  authoring: { instanceId: 'authoring-1', generation: 3, revisionId: 'revision-2', sceneName: 'Test scene',
    authority: 'studio', playback: 'paused', clockEpoch: 7, frameId: '91', intensity: 0.5,
    output: { width: 1920, height: 1080 }, fault: null },
  host: null, jobs: [], visualFps: null, uiFps: null,
});

test('disconnected Studio never admits a runtime command or invents status', async () => {
  const client = createDisconnectedClient();
  const controller = new StudioController(client, () => 'request-1');
  assert.equal(client.getSnapshot().connection, 'disconnected');
  assert.equal(client.getSnapshot().authoring, null);
  assert.equal(client.getSnapshot().visualFps, null);
  await assert.rejects(controller.playback('play'), /unavailable/i);
  await assert.rejects(controller.setIntensity(0.5), /unavailable/i);
});

test('commands use current canonical operation payloads without optimistic application', async () => {
  let snapshot = connected();
  const operations: StudioOperation[] = [];
  const client: StudioClient = { getSnapshot: () => snapshot, subscribe: () => () => {},
    invoke: async operation => { operations.push(operation); return { accepted: true }; } };
  const controller = new StudioController(client, () => 'request-1');
  await controller.setIntensity(0.8);
  assert.deepEqual(operations[0], { name: 'lux.parameters.set', input: {
    requestId: 'request-1', instanceId: 'authoring-1', expectedGeneration: 3,
    expectedRevisionId: 'revision-2', values: { intensity: 0.8 }, mode: 'live',
  } });
  assert.equal(snapshot.authoring?.intensity, 0.5);
  snapshot = { ...snapshot, authoring: { ...snapshot.authoring!, generation: 4 } };
  await controller.playback('reset');
  assert.deepEqual(operations[1], { name: 'lux.playback', input: {
    requestId: 'request-1', instanceId: 'authoring-1', expectedGeneration: 4, action: 'reset',
  } });
  await controller.restart();
  assert.deepEqual(operations[2], { name: 'lux.runtime.restart', input: {
    requestId: 'request-1', instanceId: 'authoring-1', expectedGeneration: 4,
  } });
});

test('host authority and nonfinite or out-of-range values never reach core', async () => {
  let calls = 0;
  let snapshot = connected();
  const client: StudioClient = { getSnapshot: () => snapshot, subscribe: () => () => {}, invoke: async () => { calls++; return {}; } };
  const controller = new StudioController(client, () => 'request-1');
  for (const value of [NaN, Infinity, -0.1, 1.1]) await assert.rejects(controller.setIntensity(value), /intensity/i);
  snapshot = { ...snapshot, authoring: { ...snapshot.authoring!, authority: 'host' } };
  await assert.rejects(controller.playback('play'), /authority/i);
  await assert.rejects(controller.restart(), /authority/i);
  assert.equal(calls, 0);
});

test('continuous intensity holds one in-flight write and coalesces to the latest guarded value', async () => {
  const operations: StudioOperation[] = [];
  const complete: Array<() => void> = [];
  const client: StudioClient = { getSnapshot: connected, subscribe: () => () => {}, invoke: operation => {
    operations.push(operation); return new Promise(resolve => complete.push(() => resolve({})));
  } };
  const controller = new StudioController(client, () => 'request-1');
  const writes = [controller.setIntensity(0.1), controller.setIntensity(0.4), controller.setIntensity(0.9)];
  assert.equal(operations.length, 1);
  complete.shift()!();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(operations.length, 2);
  assert.equal(operations[1]?.name, 'lux.parameters.set');
  if (operations[1]?.name === 'lux.parameters.set') assert.equal(operations[1].input.values.intensity, 0.9);
  complete.shift()!();
  await Promise.all(writes);
});

test('a value queued at acknowledgement is not erased by drain cleanup', async () => {
  let finish!: () => void;
  const operations: StudioOperation[] = [];
  const client: StudioClient = { getSnapshot: connected, subscribe: () => () => {}, invoke: async operation => {
    operations.push(operation);
    if (operations.length === 1) await new Promise<void>(resolve => { finish = resolve; });
    return {};
  } };
  const controller = new StudioController(client, () => 'request-1');
  const first = controller.setIntensity(0.1);
  finish();
  const last = new Promise<void>(resolve => queueMicrotask(() => queueMicrotask(() => { void controller.setIntensity(0.9).then(() => resolve()); })));
  await Promise.all([first, last]);
  assert.equal(operations.length, 2);
});

test('generic parameter coalescing preserves different keys and original schema guards', async()=>{
  const controlSchema=normalizeControlDeclarations({height:{type:'number',label:'Height',default:1,min:0,max:4},speed:{type:'number',label:'Speed',default:0.5,min:0,max:2}});
  const snapshot:StudioSnapshot={...connected(),authoring:{...connected().authoring!,sdkVersion:'0.2.0',controlSchema,controlSchemaHash:'a'.repeat(64),controls:{height:1,speed:0.5},controlSequence:0,intensity:undefined}};
  const operations:StudioOperation[]=[], complete:Array<()=>void>=[];
  const client:StudioClient={getSnapshot:()=>snapshot,subscribe:()=>()=>{},invoke:operation=>{operations.push(operation);return new Promise(resolve=>complete.push(()=>resolve({})));}};
  const controller=new StudioController(client);
  const writes=[controller.setParameters({height:2}),controller.setParameters({height:3}),controller.setParameters({speed:1.5})];
  assert.equal(operations.length,1); complete.shift()!(); await new Promise(resolve=>setImmediate(resolve));
  const last=operations[1]!; assert.equal(last.name,'lux.parameters.set');
  if(last.name==='lux.parameters.set') {assert.deepEqual(last.input.values,{height:3,speed:1.5});assert.equal(last.input.expectedControlSchemaHash,'a'.repeat(64));}
  complete.shift()!(); await Promise.all(writes);
  await assert.rejects(controller.setParameters({intensity:0.5}),/unknown/i);
  assert.deepEqual(snapshot.authoring!.controls,{height:1,speed:0.5});
});
