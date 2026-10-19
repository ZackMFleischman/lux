import { open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { soundtrackCandidates } from '../../../../packages/core/src/scene-file.ts';
import { soundtrackByteLimit, soundtrackHasSupportedExtension, soundtrackFileName } from '../../../../packages/core/src/scene-soundtrack.ts';
import type { SceneSoundtrack } from '../../../../packages/core/src/scene-soundtrack.ts';

/** Main-process soundtrack file access. The renderer never names a path: it
 * either chooses through a native dialog or loads the soundtrack recorded in a
 * scene this process opened, identified by that scene's file token. */
export type SoundtrackFile = Readonly<{ name: string; absolutePath: string; sha256: string; bytes: Uint8Array }>;
/** Missing, changed and unreadable files share one status so a scene cannot probe which paths exist. */
export type SoundtrackLoad = Readonly<({ status: 'loaded' } & SoundtrackFile) | { status: 'unavailable'; name: string; message: string }>;
type Linked = { scenePath: string; soundtrack: Pick<SceneSoundtrack, 'path' | 'absolutePath' | 'sha256'> };

async function readBounded(path: string, limit: number): Promise<Buffer> {
  const file = await open(path, 'r');
  try {
    const size = (await file.stat()).size;
    if (size > limit) throw Object.assign(Error(`Soundtrack exceeds ${Math.round(limit / 1048576)} MiB`), { code: 'ETOOBIG' });
    // One unpooled file-sized allocation, so the IPC result carries no slack or neighbouring bytes.
    const buffer = Buffer.allocUnsafeSlow(size);
    let offset = 0;
    while (offset < size) {
      const { bytesRead } = await file.read(buffer, offset, size - offset, null);
      if (!bytesRead) break; offset += bytesRead;
    }
    if (offset !== size || (await file.read(Buffer.alloc(1), 0, 1, null)).bytesRead) throw Object.assign(Error('Soundtrack changed while it was read'), { code: 'ECHANGED' });
    return buffer;
  } finally { await file.close(); }
}
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
/** A view over the same memory; IPC serialization makes the only copy. */
const view = (bytes: Buffer) => new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);

export function createSoundtrackFiles(options: { choosePath(): Promise<string | null>; limit?: number }) {
  const limit = options.limit ?? soundtrackByteLimit;
  const linked = new Map<string, Linked>();
  return {
    /** Records the soundtrack of a scene opened from scenePath under its file token. */
    remember(token: string, scenePath: string, document: { soundtrack?: SceneSoundtrack }): void {
      if (document.soundtrack) linked.set(token, { scenePath: resolve(scenePath), soundtrack: document.soundtrack });
      else linked.delete(token);
    },
    async choose(): Promise<SoundtrackFile | null> {
      const path = await options.choosePath();
      if (!path) return null;
      if (!soundtrackHasSupportedExtension(path)) throw Error('Choose an MP3, WAV, OGG, M4A, AAC or FLAC file');
      const absolutePath = resolve(path), bytes = await readBounded(absolutePath, limit);
      return Object.freeze({ name: soundtrackFileName({ absolutePath }), absolutePath, sha256: sha256(bytes), bytes: view(bytes) });
    },
    async loadLinked(token: unknown): Promise<SoundtrackLoad> {
      if (typeof token !== 'string') throw Error('Invalid scene token');
      const entry = linked.get(token);
      if (!entry) throw Error('This scene has no linked soundtrack');
      const name = soundtrackFileName(entry.soundtrack);
      for (const candidate of soundtrackCandidates(entry.soundtrack, entry.scenePath)) {
        if (!soundtrackHasSupportedExtension(candidate)) continue;
        let bytes: Buffer;
        try { bytes = await readBounded(candidate, limit); } catch { continue; }
        if (sha256(bytes) !== entry.soundtrack.sha256) continue;
        return Object.freeze({ status: 'loaded', name, absolutePath: candidate, sha256: entry.soundtrack.sha256, bytes: view(bytes) });
      }
      return Object.freeze({ status: 'unavailable', name,
        message: `${name} is missing, unreadable or changed since it was linked. Choose it again to relink.` });
    },
  };
}
export type SoundtrackFiles = ReturnType<typeof createSoundtrackFiles>;

/** IPC entry point. Only the trusted main Studio window may read audio files. */
export function createSoundtrackIpcHandler<Event>(files: SoundtrackFiles, trustedMain: (event: Event) => boolean) {
  return async (event: Event, action: unknown, value?: unknown): Promise<SoundtrackFile | SoundtrackLoad | null> => {
    if (!trustedMain(event)) throw Error('Untrusted soundtrack sender');
    if (action === 'choose') return files.choose();
    if (action === 'load-linked') return files.loadLinked(value);
    throw Error('Unsupported soundtrack operation');
  };
}
