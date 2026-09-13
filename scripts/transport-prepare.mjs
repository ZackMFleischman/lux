import { mkdir, writeFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { SceneFileStore } from '../packages/core/src/scene-file.ts';
import { compileVisual } from '../apps/build-worker/src/compile.mjs';
import { linkRuntime } from '../apps/build-worker/src/link-runtime.mjs';
import releaseIO from '../tools/gpu-spike/transport-release.cjs';
import { reconcileControlValues } from '../packages/runtime-contracts/src/parameters.mjs';

export async function prepareTransportScene(filename, directory = 'artifacts/transport') {
  const { document } = await new SceneFileStore().open(filename);
  const { settings } = document;
  if (settings.width !== 1920 || settings.height !== 1080 || settings.fps !== 60) throw Error('Transport currently requires 1920×1080 at 60 fps');
  const dependencyRoot = await realpath(fileURLToPath(new URL('../node_modules', import.meta.url)));
  const result = await compileVisual({ source: document.source }, { dependencyRoot });
  if (!result.ok) throw Error(result.diagnostics.map(d => d.message).join('\n'));
  const linked = await linkRuntime(result.artifact, { dependencyRoot });
  const release = { format: 'lux-transport', version: 1, sourceHash: result.artifact.sourceHash, settings, linked };
  const bytes = JSON.stringify(release);
  await mkdir(directory, { recursive: true });
  const output = resolve(directory, releaseIO.hash(bytes) + '.json');
  try { await writeFile(output, bytes, { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  releaseIO.readTransportRelease(output);
  const savedControls=linked.linkedVersion===3?reconcileControlValues(document.controls.schema,document.controls.values,linked.controls).values:document.controls;
  return { path: output, sourceHash: release.sourceHash, linkedHash: linked.linkedHash, settings,savedControls };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) { console.error('Usage: pnpm transport:prepare <saved.lux-scene> [output-directory]'); process.exitCode = 2; }
  else prepareTransportScene(process.argv[2], process.argv[3]).then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
