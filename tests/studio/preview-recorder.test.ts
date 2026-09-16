import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PreviewCaptureFileStore } from '../../apps/studio/src/preview-capture-files.ts';
import { PreviewRecorder, selectWebmMimeType } from '../../apps/studio/src/preview-recorder.ts';
import type { PreviewCaptureClient } from '../../apps/studio/src/preview-capture-client.ts';

type Listener = (event: any) => void;
const webm = Uint8Array.from('1a45dfa3801853806701ffffffffffffff1549a966872ad7b1830f42401f43b67580'.match(/../g)!.map(value => Number.parseInt(value, 16)));
class FakeMediaRecorder {
  static supported = new Set<string>();
  static instances: FakeMediaRecorder[] = [];
  static isTypeSupported(value: string) { return this.supported.has(value); }
  readonly mimeType: string;
  readonly stream: MediaStream;
  state: RecordingState = 'inactive';
  timeslice = 0;
  private listeners = new Map<string, Listener[]>();
  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.stream = stream; this.mimeType = options?.mimeType ?? ''; FakeMediaRecorder.instances.push(this);
  }
  addEventListener(type: string, listener: Listener) { const rows = this.listeners.get(type) ?? []; rows.push(listener); this.listeners.set(type, rows); }
  start(timeslice?: number) { this.timeslice = timeslice ?? 0; this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.emit('stop', {}); }
  emitData(value: number[]) { this.emit('dataavailable', { data: new Blob([Uint8Array.from(value)], { type: this.mimeType }) }); }
  private emit(type: string, event: unknown) { for (const listener of this.listeners.get(type) ?? []) listener(event); }
}

function fixture(path: string, options: { maxPendingBytes?: number; now?: () => number } = {}) {
  const store = new PreviewCaptureFileStore({ id: () => 'recording' });
  const client: PreviewCaptureClient = {
    saveFrame: async () => null,
    beginVideo: settings => store.beginVideo(path, settings),
    appendVideo: (id, bytes) => store.appendVideo(id, bytes),
    finishVideo: (id, durationMs) => store.finishVideo(id, durationMs),
    cancelVideo: id => store.cancelVideo(id),
  };
  let stopped = 0, requestedFps = 0;
  const stream = { getTracks: () => [{ stop: () => { stopped++; } }] } as unknown as MediaStream;
  const canvas = { width: 1920, height: 1080, captureStream: (fps: number) => { requestedFps = fps; return stream; } } as HTMLCanvasElement;
  const errors: string[] = [];
  const recorder = new PreviewRecorder(client, { MediaRecorder: FakeMediaRecorder as unknown as typeof MediaRecorder,
    onError: error => errors.push(error.message), ...options });
  return { recorder, canvas, errors, stopped: () => stopped, requestedFps: () => requestedFps };
}

test('WebM selection prefers VP9 then VP8 and reports unsupported runtimes', () => {
  FakeMediaRecorder.supported = new Set(['video/webm;codecs=vp8', 'video/webm']);
  assert.equal(selectWebmMimeType(FakeMediaRecorder as unknown as typeof MediaRecorder), 'video/webm;codecs=vp8');
  FakeMediaRecorder.supported = new Set(['video/webm;codecs=vp9', 'video/webm;codecs=vp8']);
  assert.equal(selectWebmMimeType(FakeMediaRecorder as unknown as typeof MediaRecorder), 'video/webm;codecs=vp9');
  FakeMediaRecorder.supported.clear();
  assert.throws(() => selectWebmMimeType(FakeMediaRecorder as unknown as typeof MediaRecorder), /WebM recording/);
});

test('recorder streams ordered chunks from the fixed output canvas and commits on stop', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-recorder-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'clip.webm');
  FakeMediaRecorder.instances = []; FakeMediaRecorder.supported = new Set(['video/webm;codecs=vp9']);
  let now = 100;
  const f = fixture(path, { now: () => now });

  const started = await f.recorder.start(f.canvas, { width: 1920, height: 1080 });
  assert.equal(started, true);
  const media = FakeMediaRecorder.instances[0]!;
  media.emitData([...webm.slice(0, 20)]); media.emitData([...webm.slice(20)]);
  now = 2600;
  const result = await f.recorder.stop();

  const saved = await readFile(path);
  assert.deepEqual(saved.subarray(-5), Buffer.from([0x1f, 0x43, 0xb6, 0x75, 0x80]));
  const duration = saved.indexOf(Buffer.from([0x44, 0x89, 0x88]));
  assert.equal(new DataView(saved.buffer, saved.byteOffset + duration + 3, 8).getFloat64(0), 2500);
  assert.equal(result?.path, path);
  assert.equal(media.mimeType, 'video/webm;codecs=vp9');
  assert.equal(media.timeslice, 1000);
  assert.equal(f.requestedFps(), 30);
  assert.equal(f.stopped(), 1);
  assert.deepEqual(f.recorder.getSnapshot(), { phase: 'idle' });
});

test('recorder rejects a panel-sized canvas instead of silently changing output dimensions', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-recorder-size-')); t.after(() => rm(directory, { recursive: true, force: true }));
  FakeMediaRecorder.supported = new Set(['video/webm']);
  const f = fixture(join(directory, 'clip.webm'));
  f.canvas.width = 960; f.canvas.height = 540;
  await assert.rejects(f.recorder.start(f.canvas, { width: 1920, height: 1080 }), /output dimensions changed/);
});

test('recorder allows one destination choice at a time and cancellation leaves it idle', async () => {
  FakeMediaRecorder.supported = new Set(['video/webm']);
  let choose!: (value: null) => void;
  const client: PreviewCaptureClient = {
    saveFrame: async () => null,
    beginVideo: () => new Promise(resolve => { choose = resolve; }),
    appendVideo: async () => {}, finishVideo: async () => ({ path: '', bytes: 0 }), cancelVideo: async () => {},
  };
  const recorder = new PreviewRecorder(client, { MediaRecorder: FakeMediaRecorder as unknown as typeof MediaRecorder });
  const canvas = { width: 1920, height: 1080, captureStream: () => { throw Error('must not capture after cancel'); } } as unknown as HTMLCanvasElement;
  const first = recorder.start(canvas, { width: 1920, height: 1080 });
  await assert.rejects(recorder.start(canvas, { width: 1920, height: 1080 }), /already active/);
  choose(null);
  assert.equal(await first, false);
  assert.deepEqual(recorder.getSnapshot(), { phase: 'idle' });
});

test('recorder cancels the chosen destination when the preview changes during the save dialog', async () => {
  FakeMediaRecorder.supported = new Set(['video/webm']);
  let choose!: (value: { id: string; path: string }) => void;
  const canceled: string[] = [];
  const client: PreviewCaptureClient = {
    saveFrame: async () => null,
    beginVideo: () => new Promise(resolve => { choose = resolve; }),
    appendVideo: async () => {}, finishVideo: async () => ({ path: '', bytes: 0 }),
    cancelVideo: async id => { canceled.push(id); },
  };
  const recorder = new PreviewRecorder(client, { MediaRecorder: FakeMediaRecorder as unknown as typeof MediaRecorder });
  let captured = false, current = true;
  const canvas = { width: 1920, height: 1080, captureStream: () => { captured = true; throw Error('must not capture a replaced preview'); } } as unknown as HTMLCanvasElement;
  const start = recorder.start(canvas, { width: 1920, height: 1080 }, () => current);
  current = false;
  choose({ id: 'changed', path: 'clip.webm' });

  await assert.rejects(start, /changed while choosing/);
  assert.equal(captured, false);
  assert.deepEqual(canceled, ['changed']);
  assert.deepEqual(recorder.getSnapshot(), { phase: 'idle' });
});

test('cancel and backpressure failures remove partial output and stop the canvas track', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-recorder-cancel-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'clip.webm');
  FakeMediaRecorder.instances = []; FakeMediaRecorder.supported = new Set(['video/webm']);
  const f = fixture(path, { maxPendingBytes: 3 });
  await f.recorder.start(f.canvas, { width: 1920, height: 1080 });
  FakeMediaRecorder.instances[0]!.emitData([1, 2, 3, 4]);
  await new Promise(resolve => setTimeout(resolve, 20));

  await assert.rejects(readFile(path), { code: 'ENOENT' });
  assert.match(f.errors[0] ?? '', /fell behind/);
  assert.equal(f.stopped(), 1);
  assert.deepEqual(f.recorder.getSnapshot(), { phase: 'idle' });
});
