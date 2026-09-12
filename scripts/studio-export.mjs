import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SceneFileStore } from '../packages/core/src/scene-file.ts';
import { prepareTransportScene } from './transport-prepare.mjs';
import { exportResolume } from './export-resolume.mjs';
import { assertLegacyPlaybackSource } from '../apps/studio/src/source/asset-playback.ts';

/** Child-process entry point. No generated source is evaluated in this process. */
export async function exportSceneDocument(request, { prepare = prepareTransportScene, exporter = exportResolume } = {}) {
  if (!request || typeof request !== 'object' || Array.isArray(request) ||
      Object.keys(request).some(key => !['name', 'document', 'outputDirectory'].includes(key))) throw Error('Invalid export request');
  if (typeof request.name !== 'string' || !request.name.trim() || request.name.length > 80 || /[\x00-\x1f]/.test(request.name)) throw Error('Invalid source name');
  if (typeof request.outputDirectory !== 'string' || !isAbsolute(request.outputDirectory)) throw Error('Export requires an absolute output directory');
  assertLegacyPlaybackSource(request.document?.source);
  const temporaryRoot = resolve(tmpdir()), temporary = await mkdtemp(join(temporaryRoot, 'lux-studio-export-'));
  try {
    const scenePath = join(temporary, 'draft.lux-scene');
    const saved = await new SceneFileStore().saveAs(scenePath, request.document);
    const prepared = await prepare(scenePath, join(temporary, 'prepared'));
    return await exporter({ scenePath, name: request.name.trim(), outputDirectory: request.outputDirectory,
      preparedPath: prepared.path, intensity: saved.document.controls.intensity });
  } finally {
    if (dirname(temporary) !== temporaryRoot) throw Error('Refusing temporary cleanup outside its root');
    await rm(temporary, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const chunks = []; let bytes = 0;
    for await (const chunk of process.stdin) {
      bytes += chunk.length; if (bytes > 8388608) throw Error('Export request exceeds 8 MiB'); chunks.push(chunk);
    }
    const request = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    const result = await exportSceneDocument(request);
    process.stdout.write(JSON.stringify({ ok: true, result }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ ok: false, error: String(error?.message ?? error).slice(0, 4000) })); process.exitCode = 1;
  }
}
