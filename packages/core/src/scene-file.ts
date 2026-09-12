import { open, rename, unlink, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sourceBundleSchema, outputSettingsSchema, controlValuesSchema } from '../../runtime-contracts/src/index.ts';
import { validateSource } from '../../../apps/build-worker/src/source-policy.mjs';
const schema = z.object({ format: z.literal('lux-scene'), version: z.literal(1), source: sourceBundleSchema, settings: outputSettingsSchema, controls: controlValuesSchema }).strict();
export type SceneDocument = z.infer<typeof schema>;
const cap = 8388608, hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function document(value: unknown): SceneDocument { const result = schema.parse(value); validateSource(result.source); return result; }
async function boundedRead(path: string): Promise<Buffer> {
  const file = await open(path, 'r');
  try {
    if ((await file.stat()).size > cap) throw Error('Scene file exceeds 8 MiB');
    const buffer = Buffer.alloc(cap + 1); let offset = 0;
    while (offset < buffer.length) { const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, null); if (!bytesRead) break; offset += bytesRead; }
    if (offset > cap) throw Error('Scene file exceeds 8 MiB'); return buffer.subarray(0, offset);
  } finally { await file.close(); }
}
type Binding = { path: string; hash: string | null };
export class SceneFileStore {
  private bindings = new Map<string, Binding>();
  private queue: Promise<unknown> = Promise.resolve();
  private replace: typeof rename;
  constructor(options: { replace?: typeof rename } = {}) { this.replace = options.replace ?? rename; }
  async open(path: string) {
    const bytes = await boundedRead(resolve(path));
    const snapshot = document(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    const token = randomUUID(), fileHash = hash(bytes); this.bindings.set(token, { path: resolve(path), hash: fileHash });
    return { token, document: snapshot, fileHash, name: path.split(/[\\/]/).pop()! };
  }
  async saveAs(path: string, value: unknown) {
    const snapshot = document(value), target = resolve(path), token = randomUUID();
    let initial: string | null = null;
    try { initial = hash(await boundedRead(target)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    this.bindings.set(token, { path: target, hash: initial });
    try { return await this.save(token, snapshot); } catch (error) { this.bindings.delete(token); throw error; }
  }
  save(token: string, value: unknown) {
    const snapshot = document(value);
    const execute = async () => {
      const binding = this.bindings.get(token); if (!binding) throw Error('Unknown scene document');
      const bytes = Buffer.from(JSON.stringify(snapshot, null, 2) + '\n'); if (bytes.length > cap) throw Error('Scene file exceeds 8 MiB');
      let current: string | null = null;
      try { current = hash(await boundedRead(binding.path)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (current !== binding.hash) throw Error('Scene changed outside Lux; use Save as to preserve both versions');
      const temporary = join(dirname(binding.path), `.lux-save-${randomUUID()}.tmp`);
      let committed = false;
      try {
        const file = await open(temporary, 'wx');
        try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
        await this.replace(temporary, binding.path); committed = true;
        binding.hash = hash(bytes);
        return { token, document: snapshot, fileHash: binding.hash, name: binding.path.split(/[\\/]/).pop()!, committed: true as const };
      } finally { if (!committed) await unlink(temporary).catch(() => {}); }
    };
    const task = this.queue.then(execute, execute); this.queue = task.catch(() => {}); return task;
  }
}
