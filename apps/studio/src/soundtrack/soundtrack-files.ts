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
export type SoundtrackLoad = Readonly<({ status: 'loaded' } & SoundtrackFile) | { status: 'missing' | 'mismatch' | 'unreadable'; name: string; message: string }>;
type Linked = { scenePath: string; soundtrack: Pick<SceneSoundtrack, 'path' | 'absolutePath' | 'sha256'> };

async function readBounded(path: string, limit: number): Promise<Buffer> {
  const file = await open(path, 'r');
  try {
    const size = (await file.stat()).size;
    if (size > limit) throw Object.assign(Error(`Soundtrack exceeds ${Math.round(limit / 1048576)} MiB`), { code: 'ETOOBIG' });
    const buffer = Buffer.alloc(size + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, null);
      if (!bytesRead) break; offset += bytesRead;
    }
    if (offset > size || offset > limit) throw Object.assign(Error('Soundtrack changed while it was read'), { code: 'ETOOBIG' });
    return buffer.subarray(0, offset);
  } finally { await file.close(); }
}
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

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
      return Object.freeze({ name: soundtrackFileName({ absolutePath }), absolutePath, sha256: sha256(bytes), bytes: new Uint8Array(bytes) });
    },
    async loadLinked(token: unknown): Promise<SoundtrackLoad> {
      if (typeof token !== 'string') throw Error('Invalid scene token');
      const entry = linked.get(token);
      if (!entry) throw Error('This scene has no linked soundtrack');
      const name = soundtrackFileName(entry.soundtrack);
      let changed = false, unreadable: string | null = null;
      for (const candidate of soundtrackCandidates(entry.soundtrack, entry.scenePath)) {
        if (!soundtrackHasSupportedExtension(candidate)) continue;
        let bytes: Buffer;
        try { bytes = await readBounded(candidate, limit); }
        catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code !== 'ENOENT' && code !== 'ENOTDIR') unreadable = String((error as Error).message ?? error);
          continue;
        }
        if (sha256(bytes) !== entry.soundtrack.sha256) { changed = true; continue; }
        return Object.freeze({ status: 'loaded', name, absolutePath: candidate, sha256: entry.soundtrack.sha256, bytes: new Uint8Array(bytes) });
      }
      if (changed) return Object.freeze({ status: 'mismatch', name, message: `${name} changed since it was linked. Choose it again to relink.` });
      if (unreadable) return Object.freeze({ status: 'unreadable', name, message: `${name} could not be read: ${unreadable}` });
      return Object.freeze({ status: 'missing', name, message: `${name} was not found next to the scene or at ${entry.soundtrack.absolutePath}. Choose it again to relink.` });
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
