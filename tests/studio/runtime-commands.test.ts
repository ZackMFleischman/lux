import test from 'node:test';
import assert from 'node:assert/strict';
import { StandaloneClient } from '../../apps/studio/src/standalone-client.ts';
import { dispatchRuntimeCommand } from '../../apps/studio/src/runtime-operations.ts';

class FakeWorker {
  static all: FakeWorker[] = [];
  onmessage: any; onerror: any; messages: any[] = []; init: any; terminated = false;
  constructor() { FakeWorker.all.push(this); }
  postMessage(message: any) {
    this.messages.push(message);
    if (message.type === 'init') { this.init = message; queueMicrotask(() => this.reply({ type: 'ready' })); }
  }
  reply(extra: any) { this.onmessage({ data: { ...this.init, type: 'status', frameId: '1', timeSeconds: 0, clockEpoch: 0, controlSequence: 0, intensity: this.init.controls.intensity, playback: this.init.playing ? 'playing' : 'paused', ...extra } }); }
  terminate() { this.terminated = true; }
}
const source = { sdkVersion: '0.1.0' as const, entry: 'visual.ts', files: { 'visual.ts': '' } };
test('standalone guarded MCP commands wait for applied state and reject invalid/stale writes', async () => {
  const oldWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker'), oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'Worker', { value: FakeWorker, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: { createElement: () => ({ style: {}, transferControlToOffscreen: () => ({}), remove() {} }) }, configurable: true });
  const client = new StandaloneClient({ compile: async () => ({ ok: true, linked: { code: '' }, sourceHash: 'revision' }) } as any);
  try {
    await client.submit(source);
    const initial = client.getSnapshot().authoring!;
    assert.equal(initial.playback, 'paused');
    const worker = FakeWorker.all.at(-1)!;
    const target = { instanceId: initial.instanceId, expectedGeneration: initial.generation };
    const parameters = { ...target, expectedRevisionId: initial.revisionId, values: { intensity: 0.8 } };
    for (const values of [{}, { intensity: NaN }, { intensity: Infinity }, { intensity: -0.1 }, { intensity: 1.1 }, { intensity: '0.8' }, { intensity: 0.8, unknown: 1 }]) {
      await assert.rejects(dispatchRuntimeCommand(client, 'parameters', { ...parameters, values }));
    }
    await assert.rejects(dispatchRuntimeCommand(client, 'parameters', { ...parameters, expectedRevisionId: 'stale' }), /Revision changed/);
    await assert.rejects(dispatchRuntimeCommand(client, 'playback', { ...target, expectedGeneration: 0, action: 'play' }), /Runtime changed/);
    await assert.rejects(dispatchRuntimeCommand(client, 'playback', { ...target, action: 'step' }));
    assert.equal(worker.messages.length, 1);
    let settled = false;
    const write = dispatchRuntimeCommand(client, 'parameters', parameters).then(result => { settled = true; return result; });
    await Promise.resolve();
    assert.equal(settled, false); assert.equal(client.getSnapshot().authoring!.intensity, 0.5);
    const message = worker.messages.at(-1);
    worker.reply({ requestId: message.requestId, intensity: 0.8, controlSequence: 1, generation: 999 });
    await Promise.resolve(); assert.equal(settled, false);
    worker.reply({ requestId: message.requestId, intensity: 0.8, controlSequence: 1 });
    assert.equal((await write).status.authoring!.intensity, 0.8);
    assert.equal(client.getSnapshot().authoring!.controlSequence, 1);
    for (const action of ['play', 'pause', 'reset']) {
      const pending = dispatchRuntimeCommand(client, 'playback', { ...target, action });
      worker.reply({ requestId: worker.messages.at(-1).requestId, intensity: 0.8, controlSequence: 1, playback: action === 'play' ? 'playing' : 'paused', clockEpoch: action === 'reset' ? 1 : 0 });
      const result = await pending;
      assert.equal(result.status.authoring!.playback, action === 'play' ? 'playing' : 'paused');
    }
    const priorSnapshot = client.getSnapshot();
    (client as any).snapshot = { ...priorSnapshot, authoring: { ...priorSnapshot.authoring, authority: 'host' } };
    await assert.rejects(dispatchRuntimeCommand(client, 'parameters', parameters), /Authority conflict/);
    (client as any).snapshot = priorSnapshot;
    const restarted = await dispatchRuntimeCommand(client, 'restart', target);
    assert.equal(restarted.status.authoring!.generation, initial.generation + 1);
    assert.equal(restarted.status.authoring!.intensity, 0.8);
    assert.equal(restarted.status.authoring!.playback, 'paused');
    assert.equal(worker.terminated, true);
    await assert.rejects(dispatchRuntimeCommand(client, 'restart', target), /Runtime changed/);
    const current = FakeWorker.all.at(-1)!;
    const pending = dispatchRuntimeCommand(client, 'playback', { ...target, expectedGeneration: initial.generation + 1, action: 'play' });
    current.reply({ type: 'failure', message: 'render failed' });
    await assert.rejects(pending, /render failed/);
    assert.equal(client.getSnapshot().authoring!.playback, 'failed');
  } finally {
    const internal = client as any;
    if (internal.running) clearInterval(internal.running.watchdog);
    if (oldWorker) Object.defineProperty(globalThis, 'Worker', oldWorker); else Reflect.deleteProperty(globalThis, 'Worker');
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else Reflect.deleteProperty(globalThis, 'document');
  }
});
