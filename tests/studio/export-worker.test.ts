import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, mkdtemp, mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { exportSceneDocument } from '../../scripts/studio-export.mjs';
import { exportResolume } from '../../scripts/export-resolume.mjs';
import { SceneFileStore } from '../../packages/core/src/scene-file.ts';
import capability from '../../packages/export/src/runtime-capability.cjs';
const document = { format: 'lux-scene', version: 1, source: { sdkVersion: '0.1.0', entry: 'main.ts', files: { 'main.ts': '', 'lib/color.ts': '// 🌈' } },
  settings: { width: 1920, height: 1080, fps: 60, seed: 0 }, controls: { intensity: 0.75 } };
test('export child validates and prepares the full saved document before packaging, then cleans temporary source', async () => {
  const calls: string[] = []; let temporary = '';
  const result = await exportSceneDocument({ name: 'Test', document, outputDirectory: tmpdir() }, {
    prepare: async (scenePath: string, output?: string) => {
      calls.push('prepare'); temporary = dirname(scenePath);
      assert.deepEqual(JSON.parse(await readFile(scenePath, 'utf8')), document);
      assert.equal(output, join(temporary, 'prepared')); return { path: join(output!, 'prepared.json'), sourceHash: 'source', linkedHash: 'linked', settings: document.settings, savedControls: document.controls };
    },
    exporter: async (request: any) => { calls.push('package'); assert.equal(request.preparedPath, join(temporary, 'prepared/prepared.json'));
      assert.equal(request.intensity, 0.75); return { path: 'package', releaseId: 'release', runtimeId: 'runtime' }; },
  });
  assert.deepEqual(calls, ['prepare', 'package']); assert.equal(result.path, 'package'); await assert.rejects(access(temporary));
});
test('invalid scene never reaches preparation; failed compilation never packages and removes its temporary source', async () => {
  let touched = false, temporary = '';
  await assert.rejects(exportSceneDocument({ name: 'Test', outputDirectory: tmpdir(), document: { ...document, version: 2 } }, {
    prepare: async () => { touched = true; throw Error('unexpected'); }, exporter: async () => { touched = true; throw Error('unexpected'); },
  })); assert.equal(touched, false);
  await assert.rejects(exportSceneDocument({ name: 'Test', outputDirectory: tmpdir(), document }, {
    prepare: async (scenePath: string) => { temporary = dirname(scenePath); throw Error('type error in helper'); },
    exporter: async () => { touched = true; throw Error('unexpected'); },
  }), /type error in helper/);
  assert.equal(touched, false); await assert.rejects(access(temporary));
});
test('invalid code fails before runtime copying, and a copy failure removes the runtime staging directory', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lux-export-order-'));
  try {
    const outputDirectory = join(folder, 'output'), scenePath = join(folder, 'bad.lux-scene');
    await new SceneFileStore().saveAs(scenePath, { ...document, source: { ...document.source, files: { 'main.ts': 'export default !!!' } } });
    await assert.rejects(exportResolume({ scenePath, name: 'Test', outputDirectory, root: folder, preparedPath: undefined }), /expected/i);
    assert.deepEqual(await readdir(outputDirectory), [], 'invalid source must not create a runtime staging tree');
    for (const [relative, marker] of Object.entries(capability.capabilities)) {
      const path = join(folder, relative); await mkdir(dirname(path), { recursive: true }); await writeFile(path, marker);
    }
    for (const name of ['supervisor', 'registry', 'instance']) {
      const path = join(folder, `apps/installed-runtime/src/${name}.cjs`); await mkdir(dirname(path), { recursive: true }); await writeFile(path, '// fixture');
    }
    await assert.rejects(exportResolume({ scenePath, name: 'Test', outputDirectory, root: folder, preparedPath: join(folder, 'prepared.json') }), /ENOENT/);
    assert.deepEqual(await readdir(outputDirectory), [], 'failed runtime copy must remove its staging directory');
  } finally { await rm(folder, { recursive: true, force: true }); }
});
