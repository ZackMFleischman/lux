import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PreviewCaptureFileStore } from '../../apps/studio/src/preview-capture-files.ts';
import { assertAgentCaptureSize } from '../../apps/studio/src/preview-capture-client.ts';

const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
const webm = Uint8Array.from('1a45dfa3801853806701ffffffffffffff1549a966872ad7b1830f42401f43b67580'.match(/../g)!.map(value => Number.parseInt(value, 16)));

test('PNG save commits complete bytes and replaces only after the temporary file is ready', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-capture-frame-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const target = join(directory, 'frame.png');
  await writeFile(target, 'previous frame');
  const store = new PreviewCaptureFileStore({ id: () => 'frame' });

  await store.saveFrame(target, png.buffer.slice(0));

  assert.deepEqual(await readFile(target), Buffer.from(png));
  assert.deepEqual(await readdir(directory), ['frame.png']);
});

test('default PNG bound accepts a valid capture larger than the former 8 MiB ceiling', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-capture-frame-4k-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const target = join(directory, 'frame.png');
  const largePng = new Uint8Array(8 * 1024 * 1024 + 1);
  largePng.set(pngSignatureForTest());

  const result = await new PreviewCaptureFileStore({ id: () => 'frame-4k' }).saveFrame(target, largePng.buffer);

  assert.equal(result.bytes, largePng.byteLength);
  assert.equal((await readFile(target)).byteLength, largePng.byteLength);
  assert.throws(() => assertAgentCaptureSize(largePng.buffer), /Preview > Save frame PNG/,
    'The UI transport increase must not change the bounded agent capture contract');
});

test('video chunks stream in order and become visible only after finish', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-capture-video-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const target = join(directory, 'clip.webm');
  const store = new PreviewCaptureFileStore({ id: () => 'clip' });
  const recording = await store.beginVideo(target, { width: 1920, height: 1080, mimeType: 'video/webm;codecs=vp9' });

  await Promise.all([store.appendVideo(recording.id, webm.slice(0, 20).buffer), store.appendVideo(recording.id, webm.slice(20).buffer)]);
  await assert.rejects(readFile(target), { code: 'ENOENT' });
  await store.finishVideo(recording.id, 2500);

  const saved = await readFile(target);
  const duration = saved.indexOf(Buffer.from([0x44, 0x89, 0x88]));
  assert.ok(duration > 0);
  assert.equal(new DataView(saved.buffer, saved.byteOffset + duration + 3, 8).getFloat64(0), 2500);
  assert.deepEqual(saved.subarray(-5), Buffer.from([0x1f, 0x43, 0xb6, 0x75, 0x80]));
  assert.deepEqual(await readdir(directory), ['clip.webm']);
});

test('cancel removes partial video and preserves an existing destination', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-capture-cancel-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const target = join(directory, 'clip.webm');
  await writeFile(target, 'previous clip');
  const store = new PreviewCaptureFileStore({ id: () => 'cancel' });
  const recording = await store.beginVideo(target, { width: 1280, height: 720, mimeType: 'video/webm' });
  await store.appendVideo(recording.id, Uint8Array.from([9, 8, 7]).buffer);

  await store.cancelVideo(recording.id);

  assert.equal(await readFile(target, 'utf8'), 'previous clip');
  assert.deepEqual(await readdir(directory), ['clip.webm']);
});

test('capture store rejects malformed files and bounded recording writes without changing the destination', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-capture-bounds-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const frame = join(directory, 'frame.png'), video = join(directory, 'clip.webm');
  await writeFile(frame, 'previous frame');
  const store = new PreviewCaptureFileStore({ id: () => 'bounded', maxFrameBytes: png.byteLength - 1, maxChunkBytes: 3, maxVideoBytes: 5 });

  await assert.rejects(store.saveFrame(frame, Uint8Array.from([1, 2, 3]).buffer), /PNG signature/);
  await assert.rejects(store.saveFrame(frame, png.buffer.slice(0)), /PNG capture exceeds/);
  assert.equal(await readFile(frame, 'utf8'), 'previous frame');
  const recording = await store.beginVideo(video, { width: 1280, height: 720, mimeType: 'video/webm' });
  await assert.rejects(store.appendVideo(recording.id, Uint8Array.from([1, 2, 3, 4]).buffer), /chunk exceeds/);
  await store.appendVideo(recording.id, Uint8Array.from([1, 2, 3]).buffer);
  await assert.rejects(store.appendVideo(recording.id, Uint8Array.from([4, 5, 6]).buffer), /recording exceeds/);
  await store.cancelAll();
  await assert.rejects(readFile(video), { code: 'ENOENT' });
  assert.deepEqual(await readdir(directory), ['frame.png']);
});

function pngSignatureForTest(): Uint8Array { return png.subarray(0, 8); }

test('shutdown drain waits for queued chunks and removes the temporary recording', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-capture-shutdown-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const target = join(directory, 'clip.webm');
  const store = new PreviewCaptureFileStore({ id: () => 'shutdown' });
  const recording = await store.beginVideo(target, { width: 1920, height: 1080, mimeType: 'video/webm' });
  const writes = Array.from({ length: 24 }, (_value, index) => store.appendVideo(recording.id, new Uint8Array(64 * 1024).fill(index).buffer));

  await store.cancelAll();
  await Promise.all(writes);

  await assert.rejects(readFile(target), { code: 'ENOENT' });
  assert.deepEqual(await readdir(directory), []);
});

test('shutdown waits for an in-progress finalizer and prevents its commit', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-capture-finalize-cancel-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const target = join(directory, 'clip.webm');
  const store = new PreviewCaptureFileStore({ id: () => 'finalize-cancel' });
  const recording = await store.beginVideo(target, { width: 1920, height: 1080, mimeType: 'video/webm' });
  await store.appendVideo(recording.id, webm.buffer.slice(0));

  const finishing = store.finishVideo(recording.id, 1200);
  await store.cancelAll();

  await assert.rejects(finishing, /canceled/);
  await assert.rejects(readFile(target), { code: 'ENOENT' });
  assert.deepEqual(await readdir(directory), []);
});
