import { open, rename, unlink, readFile, link } from 'node:fs/promises';
import { dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { validateSceneDocument as document, verifySceneDocument, withSceneSoundtrack } from './scene-document.ts';
import type { SceneSoundtrack } from './scene-soundtrack.ts';
import { limits as sourceLimits } from '../../../apps/build-worker/src/source-policy.mjs';
import { storyLifecycleLimits } from '../../runtime-contracts/src/story.mjs';
import { formatBytes } from '../../assets/src/index.mjs';
export { createSceneDocument } from './scene-document.ts';
export type { SceneDocument } from './scene-document.ts';
// Read cap covers every version; per-version caps are applied after parsing.
const legacyCap = sourceLimits.sceneFileBytes, storyCap = Math.max(storyLifecycleLimits.sceneBytes, legacyCap), hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function boundedRead(path: string): Promise<Buffer> {
  const file = await open(path, 'r');
  try {
    const size = (await file.stat()).size;
    if (size > storyCap) throw Error(`Scene file exceeds ${formatBytes(storyCap)}`);
    let buffer = Buffer.alloc(Math.min(storyCap + 1, Math.max(65536, size + 1))), offset = 0;
    while (true) {
      if (offset > storyCap) throw Error(`Scene file exceeds ${formatBytes(storyCap)}`);
      if (offset === buffer.length) {
        const next = Buffer.alloc(Math.min(storyCap + 1, buffer.length * 2));
        buffer.copy(next); buffer = next;
      }
      const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, null);
      if (!bytesRead) break; offset += bytesRead;
    }
    if (offset > storyCap) throw Error(`Scene file exceeds ${formatBytes(storyCap)}`); return buffer.subarray(0, offset);
  } finally { await file.close(); }
}
/** Stores the soundtrack path relative to the scene file when both share a root. */
export function soundtrackForScene(soundtrack: SceneSoundtrack, scenePath: string): SceneSoundtrack {
  if (!isAbsolute(soundtrack.absolutePath)) return soundtrack;
  const fromScene = relative(dirname(resolve(scenePath)), soundtrack.absolutePath);
  const path = fromScene && !isAbsolute(fromScene) ? fromScene.split(sep).join('/') : soundtrack.absolutePath;
  return path === soundtrack.path ? soundtrack : Object.freeze({ ...soundtrack, path });
}
/** Candidate files for a saved soundtrack: the scene-relative path first, then the absolute fallback. */
export function soundtrackCandidates(soundtrack: Pick<SceneSoundtrack, 'path' | 'absolutePath'>, scenePath: string): string[] {
  const candidates = [isAbsolute(soundtrack.path) ? soundtrack.path : resolve(dirname(resolve(scenePath)), soundtrack.path)];
  if (isAbsolute(soundtrack.absolutePath)) candidates.push(resolve(soundtrack.absolutePath));
  return [...new Set(candidates)];
}
type Binding = { path: string; hash: string | null; noOverwrite?: boolean };
export class SceneFileStore {
  private bindings = new Map<string, Binding>();
  private queue: Promise<unknown> = Promise.resolve();
  private replace: typeof rename;
  constructor(options: { replace?: typeof rename } = {}) { this.replace = options.replace ?? rename; }
  async open(path: string) {
    const bytes = await boundedRead(resolve(path));
    const snapshot = await verifySceneDocument(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    if (snapshot.version !== 7 && bytes.length > legacyCap) throw Error(`Scene file exceeds ${formatBytes(legacyCap)}`);
    if (snapshot.version >= 2 && snapshot.version !== 7 && bytes.length > sourceLimits.sceneJsonBytes) throw Error(`Scene v${snapshot.version} JSON exceeds ${formatBytes(sourceLimits.sceneJsonBytes)}`);
    const token = randomUUID(), fileHash = hash(bytes); this.bindings.set(token, { path: resolve(path), hash: fileHash });
    return { token, document: snapshot, fileHash, name: path.split(/[\\/]/).pop()! };
  }
  async saveAs(path: string, value: unknown, options: {overwrite?: boolean} = {overwrite:true}) {
    const snapshot = await verifySceneDocument(value), target = resolve(path), token = randomUUID();
    let initial: string | null = null;
    try {
      const existing = await boundedRead(target);
      // Only a verified v7 document may use the wider preimage allowance.
      // Legacy/unknown files above the old limit must never become overwrite
      // targets merely because the replacement uses the new scene format.
      if (existing.length > legacyCap) {
        const previous = await verifySceneDocument(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(existing)));
        if (previous.version !== 7) throw Error(`Scene file exceeds ${formatBytes(legacyCap)}`);
      }
      initial = hash(existing);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (!options.overwrite && initial !== null) throw Error('Scene file already exists; pass overwrite:true to replace it');
    this.bindings.set(token, { path: target, hash: initial, noOverwrite: !options.overwrite });
    try { return await this.save(token, snapshot); } catch (error) { this.bindings.delete(token); throw error; }
  }
  save(token: string, value: unknown) {
    const snapshot = document(value);
    const execute = async () => {
      await verifySceneDocument(snapshot);
      const binding = this.bindings.get(token); if (!binding) throw Error('Unknown scene document');
      const located = snapshot.soundtrack ? withSceneSoundtrack(snapshot, soundtrackForScene(snapshot.soundtrack, binding.path)) : snapshot;
      const bytes = Buffer.from(JSON.stringify(located, null, 2) + '\n');
      const cap = snapshot.version === 7 ? storyLifecycleLimits.sceneBytes : legacyCap;
      if (bytes.length > cap) throw Error(`Scene file exceeds ${formatBytes(cap)}`);
      let current: string | null = null;
      try { current = hash(await boundedRead(binding.path)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (current !== binding.hash) throw Error('Scene changed outside Lux; use Save as to preserve both versions');
      const temporary = join(dirname(binding.path), `.lux-save-${randomUUID()}.tmp`);
      let committed = false;
      try {
        const file = await open(temporary, 'wx');
        try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
        if(binding.noOverwrite){await link(temporary,binding.path);binding.noOverwrite=false;committed=true;await unlink(temporary).catch(()=>{});}else {await this.replace(temporary,binding.path);committed = true;}
        binding.hash = hash(bytes);
        return { token, document: located, fileHash: binding.hash, name: binding.path.split(/[\\/]/).pop()!, committed: true as const };
      } finally { if (!committed) await unlink(temporary).catch(() => {}); }
    };
    const task = this.queue.then(execute, execute); this.queue = task.catch(() => {}); return task;
  }
}
