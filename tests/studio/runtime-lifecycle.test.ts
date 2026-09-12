import test from 'node:test';
import assert from 'node:assert/strict';
import { StandaloneClient } from '../../apps/studio/src/standalone-client.ts';

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
function fixture(t: any) {
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
  const client = new StandaloneClient({ compile: async () => { compiles++; return { ok: true, linked: { code: 'accepted' }, sourceHash: 'revision' }; } } as any);
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  const advance = async (ms: number) => { const end = now + ms; while (true) { const due = [...scheduled].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!due) break; const [id, timer] = due; now = timer.at; if (timer.interval) timer.at += timer.interval; else scheduled.delete(id); timer.callback(); await flush(); } now = end; await flush(); };
  const start = async () => { const pending = client.submit(source); await flush(); const worker = WorkerFixture.all.at(-1)!; worker.reply({ type: 'ready' }); await pending; return worker; };
  t.after(() => { for (const [name, descriptor] of originals) if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); });
  const operation = (requestId: string) => { const state = client.getSnapshot().authoring!; return { name: 'lux.playback' as const, input: { requestId, instanceId: state.instanceId, expectedGeneration: state.generation, action: 'play' as const } }; };
  return { client, start, flush, advance, scheduled, operation, compiles: () => compiles };
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
  assert.equal((f.client as any).pending.size, 0); assert.equal(f.scheduled.size, 0);
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
  assert.equal(f.compiles(), 1); assert.equal(restarted.init.moduleSource, 'accepted'); assert.equal(restarted.init.controls.intensity, 0.8);
  restarted.reply({ type: 'ready' }); await pending; assert.equal(worker.terminated, true);
});
test('postMessage failure faults and clears every pending operation', async t => {
  const f = fixture(t), worker = await f.start(); const capture = assert.rejects(f.client.capture(), /post failed/);
  worker.throwOnPost = true; await assert.rejects(f.client.invoke(f.operation('play')), /post failed/); await capture;
  assert.equal((f.client as any).pending.size, 0); assert.equal(f.scheduled.size, 0); assert.equal(worker.terminated, true);
});
test('late terminal callbacks cannot revive a faulted runtime', async t => {
  const f = fixture(t), worker = await f.start(), callback = worker.onmessage;
  worker.reply({ type: 'failure', message: 'failed' });
  callback({ data: { ...worker.init, type: 'status', frameId: '2', timeSeconds: 1, clockEpoch: 0, controlSequence: 0, intensity: 0.5, playback: 'playing' } });
  assert.equal(f.client.getSnapshot().authoring!.playback, 'failed'); assert.equal(f.scheduled.size, 0);
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
  assert.equal(worker.terminated, true); assert.equal(f.scheduled.size, 0); assert.equal((f.client as any).pending.size, 0);
});
