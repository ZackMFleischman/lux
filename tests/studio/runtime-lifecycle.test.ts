import test from 'node:test';
import assert from 'node:assert/strict';
import { StandaloneClient } from '../../apps/studio/src/standalone-client.ts';
import { createFrameCollector } from '../../packages/performance/live.mjs';

class WorkerFixture {
  static all: WorkerFixture[] = [];
  static failInit = false;
  onmessage: any; onerror: any; init: any; messages: any[] = []; terminated = false; throwOnPost = false;
  constructor() { WorkerFixture.all.push(this); }
  postMessage(message: any) { if (this.throwOnPost || (message.type === 'init' && WorkerFixture.failInit)) throw Error('post failed'); this.messages.push(message); if (message.type === 'init') this.init = message; }
  reply(extra: any) { this.onmessage?.({ data: { ...this.init, type: 'status', frameId: '1', timeSeconds: 0, clockEpoch: 0, controlSequence: 0, intensity: this.init.controls.intensity, playback: 'paused', ...extra } }); }
  terminate() { this.terminated = true; }
}
const source = { sdkVersion: '0.1.0' as const, entry: 'visual.ts', files: { 'visual.ts': '' } };
function telemetry(){const c=createFrameCollector({startMs:0});c.record(20,1,2,3,4,false);return c.summary(500);}
function onlyQueuedRetry(scheduled:Map<number,{interval:number;at:number}>){assert.equal(scheduled.size,1);assert.equal([...scheduled.values()][0]!.interval,0,'only one-shot retry remains; no worker watchdog/command timers');}
function fixture(t: any, linked: any = {code:'accepted'}) {
  let now = 0, next = 0, compiles = 0;
  const scheduled = new Map<number, { at: number; callback: () => void; interval: number }>();
  const originals = new Map<string, PropertyDescriptor | undefined>();
  function replace(name: string, value: any) { originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { value, configurable: true, writable: true }); }
  replace('Worker', WorkerFixture); WorkerFixture.all = []; WorkerFixture.failInit = false;
  replace('document', { createElement: () => ({ style: {}, transferControlToOffscreen: () => ({}), remove() {} }) });
  replace('performance', { now: () => now });
  const schedule = (callback: () => void, ms: number, interval: number) => { const id = ++next; scheduled.set(id, { callback, at: now + ms, interval }); return id; };
  replace('setTimeout', (callback: () => void, ms: number) => schedule(callback, ms, 0));
  replace('setInterval', (callback: () => void, ms: number) => schedule(callback, ms, ms));
  replace('clearTimeout', (id: number) => scheduled.delete(id)); replace('clearInterval', (id: number) => scheduled.delete(id));
  const api={compile:async()=>{compiles++;return {ok:true,linked,sourceHash:'revision'};}};
  const client = new StandaloneClient(api as any);
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  const advance = async (ms: number) => { const end = now + ms; while (true) { const due = [...scheduled].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!due) break; const [id, timer] = due; now = timer.at; if (timer.interval) timer.at += timer.interval; else scheduled.delete(id); timer.callback(); await flush(); } now = end; await flush(); };
  const start = async (input: any = source) => { const pending = client.submit(input); await flush(); const worker = WorkerFixture.all.at(-1)!; worker.reply({ type: 'ready' }); await pending; return worker; };
  t.after(() => { for (const [name, descriptor] of originals) if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); });
  const operation = (requestId: string) => { const state = client.getSnapshot().authoring!; return { name: 'lux.playback' as const, input: { requestId, instanceId: state.instanceId, expectedGeneration: state.generation, action: 'play' as const } }; };
  return { client, api,start, flush, advance, scheduled, operation, compiles: () => compiles };
}
test('silent candidate is terminated at 1250 ms while previous preview survives', async t => {
  const f = fixture(t), old = await f.start(), previous = f.client.getSnapshot().authoring;
  const rejected = assert.rejects(f.client.submit(source), /initialization stopped making progress/); await f.flush();
  const candidate = WorkerFixture.all.at(-1)!;
  await f.advance(1000); old.reply({ type: 'heartbeat' }); assert.equal(candidate.terminated, false);
  await f.advance(250); assert.equal(candidate.terminated, true); await rejected;
  assert.equal(old.terminated, false); assert.equal(f.client.getSnapshot().authoring, previous);
});
test('healthy candidate heartbeats permit slow initialization until the independent five-second cap', async t => {
  const f = fixture(t); const pending = f.client.submit(source); await f.flush(); const worker = WorkerFixture.all.at(-1)!;
  for (let i = 0; i < 18; i++) { await f.advance(250); worker.reply({ type: 'heartbeat' }); }
  assert.equal(worker.terminated, false); worker.reply({ type: 'ready' }); await pending;
  const reject = assert.rejects(f.client.submit(source), /five seconds/); await f.flush(); const slow = WorkerFixture.all.at(-1)!;
  for (let i = 0; i < 19; i++) { await f.advance(250); worker.reply({ type: 'heartbeat' }); slow.reply({ type: 'heartbeat' }); }
  await f.advance(250); await reject; assert.equal(slow.terminated, true);
});
test('paused stalled commands fault the runtime and settle all pending waiters', async t => {
  const f = fixture(t), worker = await f.start();
  const command = assert.rejects(f.client.invoke(f.operation('play')), /timed out/);
  const capture = assert.rejects(f.client.capture(), /timed out/);
  for (let i = 0; i < 19; i++) { await f.advance(250); worker.reply({ type: 'heartbeat' }); }
  await f.advance(250); await Promise.all([command, capture]);
  assert.equal(worker.terminated, true); assert.equal(f.client.getSnapshot().authoring!.playback, 'failed');
  assert.equal((f.client as any).pending.size, 0); onlyQueuedRetry(f.scheduled);
});
test('capture admission allows one active and one queued; replacement rejects both', async t => {
  const f = fixture(t), worker = await f.start();
  const one = assert.rejects(f.client.capture(), /Runtime changed/), two = assert.rejects(f.client.capture(), /Runtime changed/);
  await assert.rejects(f.client.capture(), /Capture queue is full/);
  assert.equal(worker.messages.filter(message => message.type === 'capture').length, 2);
  await f.start(); await Promise.all([one, two]); assert.equal(worker.terminated, true);
});
test('restart uses cached accepted linked bytes without compiling and retains controls', async t => {
  const f = fixture(t), worker = await f.start(); worker.reply({ intensity: 0.8, frameId: '2' });
  const state = f.client.getSnapshot().authoring!;
  const pending = f.client.invoke({ name: 'lux.runtime.restart', input: { requestId: 'restart', instanceId: state.instanceId, expectedGeneration: state.generation } });
  await f.flush(); const restarted = WorkerFixture.all.at(-1)!;
  assert.equal(f.compiles(), 1); assert.equal(restarted.init.linked.code, 'accepted'); assert.equal(restarted.init.controls.intensity, 0.8);
  restarted.reply({ type: 'ready' }); await pending; assert.equal(worker.terminated, true);
});

test('v2 restart retains the whole accepted envelope after compile-result mutation and failed replacement',async t=>{
  const data='Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA==';
  const linked={linkedVersion:2,code:'accepted',sourceMap:'{}',bundleHash:'bundle',linkedHash:'linked',assetSetHash:'assets',linker:{version:'0.28.2'},assets:{'assets/red.bmp':{data,mediaType:'image/bmp',encoding:'base64',byteLength:58,width:1,height:1,sha256:'image'}}};
  const expected=structuredClone(linked), input={...source,sourceVersion:2,assets:{'assets/red.bmp':{data,mediaType:'image/bmp',encoding:'base64'}}};
  const f=fixture(t,linked), old=await f.start(input);old.reply({intensity:0.7});
  assert.deepEqual(old.init.linked,expected);assert.equal(old.init.moduleSource,undefined);
  linked.assets['assets/red.bmp'].data='changed result';
  const failed=assert.rejects(f.client.submit(input),/Missing required asset/);await f.flush();
  WorkerFixture.all.at(-1)!.reply({type:'failure',message:'Missing required asset: assets/red.bmp'});await failed;
  assert.equal(old.terminated,false);
  const state=f.client.getSnapshot().authoring!;
  const restart=f.client.invoke({name:'lux.runtime.restart',input:{requestId:'restart',instanceId:state.instanceId,expectedGeneration:state.generation}});
  await f.flush();const replacement=WorkerFixture.all.at(-1)!;
  assert.deepEqual(replacement.init.linked,expected);assert.equal(replacement.init.controls.intensity,0.7);assert.equal(f.compiles(),2);
  replacement.reply({type:'ready'});await restart;assert.equal(old.terminated,true);
});
test('postMessage failure faults and clears every pending operation', async t => {
  const f = fixture(t), worker = await f.start(); const capture = assert.rejects(f.client.capture(), /post failed/);
  worker.throwOnPost = true; await assert.rejects(f.client.invoke(f.operation('play')), /post failed/); await capture;
  assert.equal((f.client as any).pending.size, 0); onlyQueuedRetry(f.scheduled); assert.equal(worker.terminated, true);
});
test('late terminal callbacks cannot revive a faulted runtime', async t => {
  const f = fixture(t), worker = await f.start(), callback = worker.onmessage;
  worker.reply({ type: 'failure', message: 'failed' });
  callback({ data: { ...worker.init, type: 'status', frameId: '2', timeSeconds: 1, clockEpoch: 0, controlSequence: 0, intensity: 0.5, playback: 'playing' } });
  assert.equal(f.client.getSnapshot().authoring!.playback, 'failed'); onlyQueuedRetry(f.scheduled);
});
test('initialization post failure clears activation and watchdog timers', async t => {
  const f = fixture(t); WorkerFixture.failInit = true;
  await assert.rejects(f.client.submit(source), /post failed/);
  assert.equal(WorkerFixture.all.at(-1)!.terminated, true); assert.equal(f.scheduled.size, 0);
});
test('paused live worker CPU silence and malformed heartbeats do not escape the liveness deadline', async t => {
  const f = fixture(t), worker = await f.start();
  await f.advance(1000); worker.reply({ type: 'heartbeat', frameId: 'invalid' });
  await f.advance(250); assert.equal(worker.terminated, true); assert.equal(f.client.getSnapshot().authoring!.playback, 'failed');
});
test('repeated frame IDs cannot conceal a playing worker without completed frame progress', async t => {
  const f = fixture(t), worker = await f.start(); worker.reply({ playback: 'playing' });
  for (let i = 0; i < 4; i++) { await f.advance(250); worker.reply({ type: 'frame', playback: 'playing' }); }
  await f.advance(250); assert.equal(worker.terminated, true); assert.match(f.client.getSnapshot().authoring!.fault!.message, /completing frames/);
});
test('completed captures release admission while capture deadline tears down an abandoned queue', async t => {
  const f = fixture(t), worker = await f.start();
  const first = f.client.capture(); const requestId = worker.messages.at(-1).requestId;
  worker.reply({ type: 'capture', requestId, bytes: new ArrayBuffer(4), metadata: {} }); await first;
  const second = assert.rejects(f.client.capture(), /Capture timed out/), third = assert.rejects(f.client.capture(), /Capture timed out/);
  for (let i = 0; i < 19; i++) { await f.advance(250); worker.reply({ type: 'heartbeat' }); }
  await f.advance(250); await Promise.all([second, third]);
  assert.equal(worker.terminated, true); onlyQueuedRetry(f.scheduled); assert.equal((f.client as any).pending.size, 0);
});

test('restart retains admitted controls across failure and failed recovery; rejected commands cannot replace intent', async t => {
  const f = fixture(t), worker = await f.start();
  const state = f.client.getSnapshot().authoring!;
  const controls = (requestId: string, intensity: number) => ({ name: 'lux.parameters.set' as const,
    input: { requestId, instanceId: state.instanceId, expectedGeneration: state.generation, expectedRevisionId: state.revisionId, mode: 'live' as const, values: { intensity } } });
  const pending = assert.rejects(f.client.invoke(controls('pending', 0.8)), /failed/);
  await assert.rejects(f.client.invoke(controls('pending', 0.1)), /already pending/);
  await assert.rejects(f.client.invoke({ ...controls('stale', 0.2), input: { ...controls('stale', 0.2).input, expectedGeneration: state.generation + 1 } }), /Runtime changed/);
  await assert.rejects(f.client.invoke({ ...controls('revision', 0.3), input: { ...controls('revision', 0.3).input, expectedRevisionId: 'other' } }), /Revision changed/);
  worker.reply({ type: 'failure', message: 'failed' }); await pending;
  const restart = () => f.client.invoke({ name: 'lux.runtime.restart', input: { requestId: 'restart', instanceId: state.instanceId, expectedGeneration: state.generation } });
  const failed = assert.rejects(restart(), /candidate failed/); await f.flush();
  WorkerFixture.all.at(-1)!.reply({ type: 'failure', message: 'candidate failed' }); await failed;
  const recovered = restart(); await f.flush(); const replacement = WorkerFixture.all.at(-1)!;
  replacement.reply({ type: 'ready' }); await recovered;
  assert.equal(f.client.getSnapshot().authoring!.intensity, 0.8);
  assert.equal(f.compiles(), 1);
  assert.equal(f.client.getSnapshot().authoring!.revisionId, state.revisionId);
  assert.ok(f.client.getSnapshot().authoring!.generation > state.generation);
});

test('source replacement does not inherit unacknowledged control intent from the previous runtime', async t => {
  const f = fixture(t); await f.start(); const state = f.client.getSnapshot().authoring!;
  const pending = assert.rejects(f.client.invoke({ name: 'lux.parameters.set', input: { requestId: 'pending',
    instanceId: state.instanceId, expectedGeneration: state.generation, expectedRevisionId: state.revisionId, mode: 'live', values: { intensity: 0.8 } } }), /Runtime changed/);
  await f.start(); await pending;
  assert.equal(f.client.getSnapshot().authoring!.intensity, 0.5);
});

test('performance belongs to promoted runtime and failed candidates or late old workers cannot replace it',async t=>{
 const f=fixture(t),old=await f.start(),callback=old.onmessage;
 old.reply({type:'performance',summary:telemetry()});const previous=f.client.getSnapshot().performance;
 assert.equal(previous?.worker?.cpuCall.p95,5);
 const rejected=assert.rejects(f.client.submit(source),/candidate failed/);await f.flush();const candidate=WorkerFixture.all.at(-1)!;
 candidate.reply({type:'performance',summary:telemetry()});candidate.reply({type:'failure',message:'candidate failed'});await rejected;
 assert.equal(f.client.getSnapshot().performance,previous);
 await f.start();assert.equal(f.client.getSnapshot().performance?.status,'pending');
 callback({data:{...old.init,type:'performance',summary:{...telemetry(),sequence:99}}});
 assert.equal(f.client.getSnapshot().performance?.status,'pending');
});
test('telemetry silence becomes stale despite healthy heartbeats, and faults preserve labeled last measurements',async t=>{
 const f=fixture(t),worker=await f.start();worker.reply({type:'performance',summary:telemetry()});
 for(let i=0;i<6;i++){await f.advance(250);worker.reply({type:'heartbeat'});}
 assert.equal(f.client.getSnapshot().performance?.status,'stale');assert.equal(worker.terminated,false);
 worker.reply({type:'failure',message:'failed'});assert.equal(f.client.getSnapshot().performance?.status,'failed');
 assert.equal(f.client.getSnapshot().performance?.worker?.cpuCall.p95,5);
});

test('first accepted-runtime fault retries cached source once with admitted values; a second fault suppresses automatic restart',async t=>{
 const f=fixture(t),worker=await f.start(),state=f.client.getSnapshot().authoring!;
 const rejected=assert.rejects(f.client.invoke({name:'lux.parameters.set',input:{requestId:'control',instanceId:state.instanceId,expectedGeneration:state.generation,expectedRevisionId:state.revisionId,values:{intensity:.8},mode:'live'}}),/failed/);
 worker.reply({type:'failure',message:'failed'});await rejected;await f.advance(250);
 const retry=WorkerFixture.all.at(-1)!;assert.notEqual(retry,worker);assert.equal(retry.init.controls.intensity,.8);assert.equal(f.compiles(),1);assert.equal(worker.terminated,true);
 retry.reply({type:'ready'});await f.flush();assert.equal(f.client.getSnapshot().authoring!.intensity,.8);
 retry.reply({type:'failure',message:'failed again'});await f.advance(1000);assert.equal(WorkerFixture.all.length,2);assert.equal(f.client.getSnapshot().authoring!.playback,'failed');assert.match(f.client.getSnapshot().message!,/30 seconds/);
 const current=f.client.getSnapshot().authoring!;const explicit=f.client.invoke({name:'lux.runtime.restart',input:{requestId:'explicit',instanceId:current.instanceId,expectedGeneration:current.generation}});await f.flush();
 WorkerFixture.all.at(-1)!.reply({type:'ready'});await explicit;assert.equal(WorkerFixture.all.length,3);
});
test('failed automatic startup is terminal without a retry storm and explicit restart can still recover',async t=>{
 const f=fixture(t),worker=await f.start();worker.reply({type:'failure',message:'failed'});await f.advance(250);
 const retry=WorkerFixture.all.at(-1)!;retry.reply({type:'failure',message:'retry init failed'});await f.flush();await f.advance(30000);
 assert.equal(WorkerFixture.all.length,2);assert.equal(retry.terminated,true);assert.match(f.client.getSnapshot().message!,/Automatic restart failed/);assert.equal(f.scheduled.size,0);
 const state=f.client.getSnapshot().authoring!,explicit=f.client.invoke({name:'lux.runtime.restart',input:{requestId:'explicit',instanceId:state.instanceId,expectedGeneration:state.generation}});await f.flush();WorkerFixture.all.at(-1)!.reply({type:'ready'});await explicit;
});
test('a healthy 30-second interval permits one new retry and source replacement cancels a queued old retry',async t=>{
 const f=fixture(t),worker=await f.start();worker.reply({type:'failure',message:'first'});await f.advance(250);let current=WorkerFixture.all.at(-1)!;current.reply({type:'ready'});await f.flush();
 for(let i=0;i<120;i++){await f.advance(250);current.reply({type:'heartbeat'});}
 current.reply({type:'failure',message:'after healthy interval'});await f.advance(250);assert.equal(WorkerFixture.all.length,3);current=WorkerFixture.all.at(-1)!;current.reply({type:'ready'});await f.flush();
 await f.start();const replacement=WorkerFixture.all.at(-1)!;replacement.reply({type:'failure',message:'new source fault'});
 const before=WorkerFixture.all.length;await f.start();await f.advance(250);assert.equal(WorkerFixture.all.length,before+1);assert.equal(f.client.getSnapshot().authoring!.playback,'paused');
});
test('a fault during source compilation defers recovery; rejected replacement retries only the accepted artifact',async t=>{
 const f=fixture(t),old=await f.start(),compile=f.api.compile;let release!:()=>void;
 f.api.compile=async()=>{await new Promise<void>(resolve=>{release=resolve;});return compile();};
 const replacement=assert.rejects(f.client.submit(source),/candidate rejected/);await f.flush();old.reply({type:'failure',message:'old failed'});await f.advance(500);
 assert.equal(WorkerFixture.all.length,1);release();await f.flush();WorkerFixture.all.at(-1)!.reply({type:'failure',message:'candidate rejected'});await replacement;
 await f.advance(250);assert.equal(WorkerFixture.all.length,3);const retry=WorkerFixture.all.at(-1)!;assert.equal(retry.init.linked.code,'accepted');retry.reply({type:'ready'});await f.flush();assert.equal(f.client.getSnapshot().authoring!.playback,'paused');
});
test('retiring an already faulted owner cancels its queued automatic retry',async t=>{
 const f=fixture(t),worker=await f.start();worker.reply({type:'failure',message:'failed'});onlyQueuedRetry(f.scheduled);
 (f.client as any).stop((f.client as any).running,'owner retired');await f.advance(1000);assert.equal(WorkerFixture.all.length,1);assert.equal(f.scheduled.size,0);
});
for(const playback of ['playing','paused'] as const)test(`automatic recovery preserves acknowledged ${playback} state without replaying pending transport`,async t=>{
 const f=fixture(t),worker=await f.start();worker.reply({playback});
 const state=f.client.getSnapshot().authoring!;
 const pending=assert.rejects(f.client.invoke({name:'lux.playback',input:{requestId:'pending-transport',instanceId:state.instanceId,expectedGeneration:state.generation,action:playback==='playing'?'pause':'play'}}),/failed/);
 worker.reply({type:'failure',message:'failed'});await pending;await f.advance(250);
 const retry=WorkerFixture.all.at(-1)!;assert.equal(retry.init.playing,playback==='playing');
 retry.reply({type:'ready',playback});await f.flush();assert.equal(f.client.getSnapshot().authoring!.playback,playback);
});
