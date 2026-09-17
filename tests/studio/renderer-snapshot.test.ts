import test from 'node:test';
import assert from 'node:assert/strict';
import { createRendererSnapshot } from '../../apps/studio/src/renderer-snapshot.ts';
import type { StudioSnapshot } from '../../apps/studio/src/service-client.ts';

function fixture() {
  let snapshot: StudioSnapshot = { connection: 'connected', message: null, receivedAtMs: 0,
    authoring: { instanceId: 'owner', generation: 1, revisionId: 'revision', sceneName: 'Fixture', authority: 'studio',
      playback: 'playing', clockEpoch: 0, frameId: '0', intensity: 0.5,tempo:{bpm:120,beatPosition:0,beatPhase:0,tempoSequence:0},tempoSequence:0, output: { width: 1920, height: 1080 }, fault: null },
    host: null, jobs: [], visualFps: null, uiFps: null };
  const listeners = new Set<() => void>();
  const client = { getSnapshot: () => snapshot, subscribe: (listener: () => void) => {
    listeners.add(listener); return () => { listeners.delete(listener); };
  }, invoke: async () => ({}) };
  return { client, listeners, publish(patch: Partial<StudioSnapshot>) {
    snapshot = { ...snapshot, ...patch }; for (const listener of listeners) listener(); return snapshot;
  } };
}

test('renderer coalesces frame observations, caches reads and publishes latest within 100 ms', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const source = fixture(), view = createRendererSnapshot(source.client);
  const initial = view.getSnapshot(); let notifications = 0;
  const off = view.subscribe(() => { notifications++; });
  for (let frame = 1; frame <= 60; frame++) {
    source.publish({ receivedAtMs: frame, authoring: { ...initial.authoring!, frameId: String(frame) },
      visualFps: { value: 60, sampledAtMs: frame, coverage: 1 } });
    assert.equal(view.getSnapshot(), initial, 'React consistency checks must see the cached UI snapshot');
  }
  assert.equal(source.client.getSnapshot().authoring!.frameId, '60', 'raw state remains exact');
  assert.equal(notifications, 0);
  context.mock.timers.tick(99); assert.equal(notifications, 0);
  context.mock.timers.tick(1); assert.equal(notifications, 1);
  assert.equal(view.getSnapshot(), source.client.getSnapshot());
  context.mock.timers.tick(1000); assert.equal(notifications, 1, 'no polling while idle');
  off();
});

test('renderer bounds animation time and effective-value observations to UI cadence', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const source = fixture(), view = createRendererSnapshot(source.client);
  const initial = view.getSnapshot(); let notifications = 0;
  const off = view.subscribe(() => { notifications++; });
  const node = {nodePath:['node'],definitionHash:'d'.repeat(64),schemaHash:'s'.repeat(64),schema:[],values:{amount:0.5}};
  for (let frame = 1; frame <= 60; frame++) source.publish({receivedAtMs:frame,authoring:{...initial.authoring!,frameId:String(frame),timeSeconds:frame/60,tempo:{bpm:120,beatPosition:frame/30,beatPhase:(frame%30)/30,tempoSequence:0},tempoSequence:0,effectiveControls:{intensity:frame/60},effectiveNodeControls:{sourceHash:'revision',nodes:[{...node,values:{amount:frame/60}}]}} as any});
  assert.equal(notifications,0,'render-clock animation and beat-phase observations must not synchronously rerender the dock tree');
  context.mock.timers.tick(100);assert.equal(notifications,1);assert.equal(view.getSnapshot(),source.client.getSnapshot());
  off();
});

test('renderer coalesces advancing Story observations while publishing Story transitions immediately', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const source=fixture(),initial=source.client.getSnapshot(),definition={version:1 as const,beats:[{id:'orbit',label:'Orbit',timing:{kind:'sustained' as const}}],sequence:[{id:'orbit-a',beatId:'orbit',follow:{kind:'after' as const,seconds:4}}]};
  const story:any={definition,capability:{version:1,beats:[{id:'orbit',kind:'sustained',seek:'none'}]},storyHash:'a'.repeat(64),storyRevision:1,
    frame:{state:'active',storyEpoch:1,beatId:'orbit',activationId:1,occurrenceId:'orbit-a',elapsedSeconds:0,localTimeSeconds:null,progress:null},phase:'running',autoAdvance:true,loop:false,effectiveAdvancing:true,
    sequence:{state:'attached',occurrenceId:'orbit-a',index:0,nextOccurrenceId:null,dwellElapsedSeconds:0,dwellRemainingSeconds:4,awaitingCue:false},resumeCandidates:[],disabledReasons:{}};
  source.publish({authoring:{...initial.authoring!,story} as any});
  const view=createRendererSnapshot(source.client);let notifications=0;const off=view.subscribe(()=>{notifications++;});const baseline=view.getSnapshot();
  for(let frame=1;frame<=60;frame++)source.publish({receivedAtMs:frame,authoring:{...baseline.authoring!,frameId:String(frame),story:{...story,
    frame:{...story.frame,elapsedSeconds:frame/60},sequence:{...story.sequence,dwellElapsedSeconds:frame/60,dwellRemainingSeconds:4-frame/60}}} as any});
  assert.equal(notifications,0,'elapsed Story and dwell samples must not synchronously rerender the dock tree');
  context.mock.timers.tick(100);assert.equal(notifications,1);assert.equal(view.getSnapshot(),source.client.getSnapshot());
  source.publish({receivedAtMs:61,authoring:{...source.client.getSnapshot().authoring!,frameId:'61',story:{...story,frame:{...story.frame,elapsedSeconds:1.1},sequence:{...story.sequence,dwellElapsedSeconds:1.1,dwellRemainingSeconds:2.9}}} as any});
  const transitioned=source.publish({authoring:{...source.client.getSnapshot().authoring!,story:{...story,storyRevision:2,frame:{...story.frame,storyEpoch:2,activationId:2,elapsedSeconds:0},phase:'paused'}} as any});
  assert.equal(notifications,2,'revision, activation and phase transitions remain urgent');assert.equal(view.getSnapshot(),transitioned);
  context.mock.timers.tick(100);assert.equal(notifications,2,'the urgent transition cancels its pending telemetry sample');off();
});

test('control, transport, owner, fault and jobs changes bypass pending frame delay', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const source = fixture(), view = createRendererSnapshot(source.client);
  let notifications = 0; const off = view.subscribe(() => { notifications++; });
  const patches: Partial<StudioSnapshot>[] = [
    { authoring: { ...source.client.getSnapshot().authoring!, sdkVersion: '0.1.0', intensity: 0.8 } },
    { authoring: { ...source.client.getSnapshot().authoring!, playback: 'paused' } },
    { authoring: { ...source.client.getSnapshot().authoring!, generation: 2 } },
    { authoring: { ...source.client.getSnapshot().authoring!, tempo:{bpm:128,beatPosition:0,beatPhase:0,tempoSequence:1},tempoSequence:1 } as any },
    { authoring: { ...source.client.getSnapshot().authoring!, playback: 'failed', fault: { code: 'FAULT', message: 'Lost device' } } },
    { jobs: [{ jobId: 'job', state: 'failed', summary: 'Build failed' }] },
    { connection: 'disconnected', authoring: null },
  ];
  for (const patch of patches) {
    source.publish({ receivedAtMs: 10 });
    const next = source.publish(patch);
    assert.equal(view.getSnapshot(), next);
  }
  assert.equal(notifications, patches.length);
  context.mock.timers.tick(100); assert.equal(notifications, patches.length, 'cancelled observations cannot overwrite urgent state');
  off();
});

test('last unsubscribe cancels timer; reattachment catches up without leaking source listeners', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const source = fixture(), view = createRendererSnapshot(source.client);
  let notifications = 0; const off = view.subscribe(() => { notifications++; });
  source.publish({ receivedAtMs: 2 }); off();
  assert.equal(source.listeners.size, 0);
  context.mock.timers.tick(100); assert.equal(notifications, 0);
  source.publish({ authoring: null });
  const detach = view.subscribe(() => { notifications++; });
  assert.equal(source.listeners.size, 1); assert.equal(view.getSnapshot(), source.client.getSnapshot());
  assert.equal(notifications, 1); detach();
});
