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

test('renderer samples Story schedule telemetry while publishing source ownership, preparation, failure and controls immediately', context => {
  context.mock.timers.enable({apis:['setTimeout']});
  const source=fixture(),initial=source.client.getSnapshot(),frame=(visualId:string,activationId:number)=>({state:'active',storyEpoch:1,beatId:'orbit',activationId,occurrenceId:'orbit-a',elapsedSeconds:0,localTimeSeconds:0,progress:0});
  const activation=(slotId:string,visualId:string,activationId:number)=>({slotId,visualId,beatId:'orbit',occurrenceId:'orbit-a',activationId,storyEpoch:1,frame:frame(visualId,activationId)});
  const state=(visualId:string,value:number,sequence=0)=>({visualId,sdkVersion:'0.2.0',controlSchema:[{id:'amount',type:'number',label:'Amount',default:0,min:0,max:1,changeCost:'live'}],controlSchemaHash:visualId.repeat(64).slice(0,64),controls:{amount:value},effectiveControls:{amount:value},controlSequence:sequence,controlAnimations:[],controlAnimationIssues:[],animationSequence:0});
  const schedule:any={instanceId:'owner',generation:1,scheduleHash:'s'.repeat(64),capsuleHash:'c'.repeat(64),definition:{version:2,normalVisualId:'lead',crossfadeSeconds:.5,beats:[{id:'orbit',label:'Orbit',timing:{kind:'timed',durationSeconds:4},visualId:'ambient'}],sequence:[{id:'orbit-a',beatId:'orbit',follow:{kind:'after',seconds:4},visualId:'ambient'}]},storyHash:'h'.repeat(64),storyRevision:1,visualCapabilities:[],phase:'running',autoAdvance:true,loop:false,effectiveAdvancing:true,
    committed:activation('incoming','ambient',2),outgoing:activation('outgoing','lead',1),incoming:activation('incoming','ambient',2),crossfadeProgress:0,pendingPreparation:null,dueNext:null,preparationFailure:null,
    sequence:{state:'attached',occurrenceId:'orbit-a',index:0,nextOccurrenceId:null,dwellElapsedSeconds:0,dwellRemainingSeconds:4,awaitingCue:false},disabledReasons:{},resources:{slots:2,slotStates:{preparing:0,ready:0,active:2,retiring:0,unsettled:0}}};
  const visualStates:any[]=[state('lead',.2),state('ambient',.4)];
  source.publish({authoring:{...initial.authoring!,sdkVersion:'0.2.0',selectedVisualId:'ambient',storySchedule:schedule,visualStates,...visualStates[1]} as any});
  const view=createRendererSnapshot(source.client);let notifications=0;const off=view.subscribe(()=>{notifications++;});const baseline=view.getSnapshot();
  for(let sample=1;sample<=60;sample++){
    const updateActivation=(row:any)=>({...row,frame:{...row.frame,elapsedSeconds:sample/60,localTimeSeconds:sample/60,progress:sample/240}});
    source.publish({receivedAtMs:sample,authoring:{...baseline.authoring!,frameId:String(sample),timeSeconds:sample/60,storySchedule:{...schedule,committed:updateActivation(schedule.committed),outgoing:updateActivation(schedule.outgoing),incoming:updateActivation(schedule.incoming),crossfadeProgress:sample/60,effectiveAdvancing:sample%2===0,sequence:{...schedule.sequence,dwellElapsedSeconds:sample/60,dwellRemainingSeconds:4-sample/60}},visualStates:visualStates.map(row=>({...row,effectiveControls:{amount:sample/60}})),effectiveControls:{amount:sample/60}} as any});
  }
  assert.equal(notifications,0,'blend, activation clocks, dwell and per-source effective controls use the bounded UI cadence');
  context.mock.timers.tick(100);assert.equal(notifications,1);assert.equal(view.getSnapshot(),source.client.getSnapshot());

  const urgent=(patch:Record<string,unknown>)=>source.publish({authoring:{...source.client.getSnapshot().authoring!,...patch} as any});
  urgent({selectedVisualId:'lead'});assert.equal(notifications,2,'selected source ownership remains immediate');
  urgent({storySchedule:{...source.client.getSnapshot().authoring!.storySchedule,pendingPreparation:{token:'next',phase:'preparing',visualId:'lead',beatId:'orbit',occurrenceId:null,commandId:null,cancelled:false}}});assert.equal(notifications,3,'preparation state remains immediate');
  urgent({storySchedule:{...source.client.getSnapshot().authoring!.storySchedule,preparationFailure:{visualId:'lead',beatId:'orbit',occurrenceId:null,code:'FAILED',message:'Could not prepare'}}});assert.equal(notifications,4,'preparation failure remains immediate');
  urgent({storySchedule:{...source.client.getSnapshot().authoring!.storySchedule,committed:activation('lead-next','lead',3)}});assert.equal(notifications,5,'activation identity remains immediate');
  const latest=source.client.getSnapshot().authoring!.visualStates!;urgent({visualStates:latest.map((row:any)=>row.visualId==='lead'?{...row,controls:{amount:.8},controlSequence:1}:row)});assert.equal(notifications,6,'applied per-source controls remain immediate');
  off();
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
