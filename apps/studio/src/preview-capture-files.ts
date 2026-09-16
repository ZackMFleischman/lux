import { appendFile, open, rename, unlink } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { patchWebmDurationHeader } from './webm-duration.ts';

export type VideoCaptureSettings = Readonly<{ width: number; height: number; mimeType: string }>;
type Recording = {
  id: string; target: string; temporary: string; total: number; closing: boolean;
  queue: Promise<void>; failure: Error | null; canceled: boolean; commitStarted: boolean;
  finalizing: Promise<{ path: string; bytes: number }> | null;
};

const pngSignature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const videoTypes = new Set(['video/webm', 'video/webm;codecs=vp8', 'video/webm;codecs=vp9']);
const webmHeaderLimit = 1024 * 1024, copyBufferBytes = 64 * 1024;
const defaultFrameBytes = 40 * 1024 * 1024;

function bytes(value: ArrayBuffer): Buffer {
  if (!(value instanceof ArrayBuffer)) throw Error('Capture bytes must be an ArrayBuffer');
  return Buffer.from(new Uint8Array(value));
}
function targetPath(path: string, extension: '.png' | '.webm'): string {
  if (typeof path !== 'string' || !isAbsolute(path) || extname(path).toLowerCase() !== extension) {
    throw Error(`Capture destination must be an absolute ${extension} path`);
  }
  return resolve(path);
}
async function writeAt(file: Awaited<ReturnType<typeof open>>, data: Uint8Array, position: number): Promise<number> {
  let offset = 0;
  while (offset < data.byteLength) {
    const result = await file.write(data, offset, data.byteLength - offset, position + offset);
    if (!result.bytesWritten) throw Error('Video finalization stopped writing'); offset += result.bytesWritten;
  }
  return position + offset;
}
async function finalizeWebm(sourcePath: string, finalPath: string, durationMs: number): Promise<number> {
  const source = await open(sourcePath, 'r'); let destination: Awaited<ReturnType<typeof open>> | null = null;
  try {
    const size = (await source.stat()).size;
    const prefix = Buffer.alloc(Math.min(size, webmHeaderLimit));
    const { bytesRead } = await source.read(prefix, 0, prefix.byteLength, 0);
    if (bytesRead !== prefix.byteLength) throw Error('Could not read the bounded WebM header');
    const patched = patchWebmDurationHeader(prefix, durationMs);
    destination = await open(finalPath, 'wx');
    let outputAt = await writeAt(destination, patched.bytes, 0), sourceAt = prefix.byteLength;
    const buffer = Buffer.alloc(copyBufferBytes);
    while (sourceAt < size) {
      const length = Math.min(buffer.byteLength, size - sourceAt);
      const read = await source.read(buffer, 0, length, sourceAt);
      if (!read.bytesRead) throw Error('Video finalization stopped reading');
      outputAt = await writeAt(destination, buffer.subarray(0, read.bytesRead), outputAt); sourceAt += read.bytesRead;
    }
    await destination.sync(); return outputAt;
  } finally { await destination?.close().catch(() => {}); await source.close(); }
}

/** Main-process capture writer. Final targets change only after complete data has
 * been synced to a sibling temporary file. Video appends are serialized. */
export class PreviewCaptureFileStore {
  private readonly recordings = new Map<string, Recording>();
  private readonly id: () => string;
  private readonly maxFrameBytes: number;
  private readonly maxChunkBytes: number;
  private readonly maxVideoBytes: number;
  constructor(options: { id?: () => string; maxFrameBytes?: number; maxChunkBytes?: number; maxVideoBytes?: number } = {}) {
    this.id = options.id ?? randomUUID;
    // 3840×2160 RGBA is 31.7 MiB before PNG framing. A 40 MiB bound permits
    // incompressible supported output while still bounding renderer IPC memory.
    this.maxFrameBytes = options.maxFrameBytes ?? defaultFrameBytes;
    this.maxChunkBytes = options.maxChunkBytes ?? 16 * 1024 * 1024;
    this.maxVideoBytes = options.maxVideoBytes ?? 16 * 1024 * 1024 * 1024;
  }
  async saveFrame(path: string, value: ArrayBuffer): Promise<{ path: string; bytes: number }> {
    const target = targetPath(path, '.png'), data = bytes(value);
    if (data.byteLength < pngSignature.length || !pngSignature.every((byte, index) => data[index] === byte)) throw Error('Capture does not have a PNG signature');
    if (data.byteLength > this.maxFrameBytes) throw Error(`PNG capture exceeds ${Math.ceil(this.maxFrameBytes / (1024 * 1024))} MiB`);
    const temporary = join(dirname(target), `.lux-frame-${this.id()}.tmp`);
    let committed = false;
    try {
      const file = await open(temporary, 'wx');
      try { await file.writeFile(data); await file.sync(); } finally { await file.close(); }
      await rename(temporary, target); committed = true;
      return { path: target, bytes: data.byteLength };
    } finally { if (!committed) await unlink(temporary).catch(() => {}); }
  }
  async beginVideo(path: string, settings: VideoCaptureSettings): Promise<{ id: string; path: string }> {
    const target = targetPath(path, '.webm');
    if (!Number.isInteger(settings?.width) || !Number.isInteger(settings?.height) || settings.width < 1 || settings.height < 1 || settings.width > 3840 || settings.height > 2160) throw Error('Invalid recording dimensions');
    if (!videoTypes.has(settings.mimeType)) throw Error('Unsupported recording format');
    if ([...this.recordings.values()].some(item => item.target.toLowerCase() === target.toLowerCase())) throw Error('That recording destination is already in use');
    const id = this.id(), temporary = join(dirname(target), `.lux-video-${id}.tmp`);
    const file = await open(temporary, 'wx');
    await file.close();
    this.recordings.set(id, { id, target, temporary, total: 0, closing: false, queue: Promise.resolve(), failure: null,
      canceled: false, commitStarted: false, finalizing: null });
    return { id, path: target };
  }
  appendVideo(id: string, value: ArrayBuffer): Promise<void> {
    const recording = this.recordings.get(id); if (!recording) return Promise.reject(Error('Unknown recording'));
    if (recording.closing) return Promise.reject(Error('Recording is stopping'));
    if (recording.failure) return Promise.reject(recording.failure);
    const data = bytes(value);
    if (!data.byteLength) return Promise.resolve();
    if (data.byteLength > this.maxChunkBytes) return Promise.reject(Error('Video chunk exceeds its limit'));
    if (recording.total + data.byteLength > this.maxVideoBytes) return Promise.reject(Error('Video recording exceeds its limit'));
    recording.total += data.byteLength;
    const write = recording.queue.then(() => appendFile(recording.temporary, data)).catch(reason => {
      const error = reason instanceof Error ? reason : Error(String(reason)); recording.failure = error; throw error;
    });
    recording.queue = write.catch(() => {});
    return write;
  }
  async finishVideo(id: string, durationMs: number): Promise<{ path: string; bytes: number }> {
    const recording = this.recordings.get(id); if (!recording) throw Error('Unknown recording');
    if (recording.closing) throw Error('Recording is already stopping');
    recording.closing = true;
    const finalized = join(dirname(recording.target), `.lux-video-final-${id}.tmp`);
    let committed = false;
    const finalizing = (async () => {
      try {
        await recording.queue;
        if (recording.failure) throw recording.failure;
        if (recording.canceled) throw Error('Recording was canceled');
        if (!recording.total) throw Error('Recording contains no video data');
        const file = await open(recording.temporary, 'r+');
        try { await file.sync(); } finally { await file.close(); }
        const savedBytes = await finalizeWebm(recording.temporary, finalized, durationMs);
        if (recording.canceled) throw Error('Recording was canceled');
        // Rename is the commit point. A close after this synchronous state change
        // waits for the atomic rename rather than deleting a completed target.
        recording.commitStarted = true;
        await rename(finalized, recording.target); committed = true;
        return { path: recording.target, bytes: savedBytes };
      } finally {
        this.recordings.delete(id);
        await unlink(recording.temporary).catch(() => {});
        if (!committed) await unlink(finalized).catch(() => {});
      }
    })();
    recording.finalizing = finalizing;
    try { return await finalizing; }
    finally {
      this.recordings.delete(id);
      recording.finalizing = null;
    }
  }
  async cancelVideo(id: string): Promise<void> {
    const recording = this.recordings.get(id); if (!recording) return;
    recording.closing = true;
    if (recording.finalizing) {
      if (!recording.commitStarted) recording.canceled = true;
      await recording.finalizing.catch(() => {});
      return;
    }
    recording.canceled = true; this.recordings.delete(id);
    await recording.queue.catch(() => {});
    await unlink(recording.temporary).catch(() => {});
  }
  async cancelAll(): Promise<void> { await Promise.all([...this.recordings].map(([id]) => this.cancelVideo(id))); }
}
