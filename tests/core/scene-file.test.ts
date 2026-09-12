import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SceneFileStore } from '../../packages/core/src/scene-file.ts';
const document = { format: 'lux-scene', version: 1, source: { sdkVersion: '0.1.0', entry: 'visual.ts', files: { 'visual.ts': '// 🌈 unfinished draft' } }, settings: { width: 1920, height: 1080, fps: 60, seed: 0 }, controls: { intensity: 0.8 } };
test('scene files roundtrip Unicode drafts, settings and controls; external edits conflict', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lux-files-'));
  try {
    const path = join(folder, 'scene.lux-scene'), store = new SceneFileStore();
    const saved = await store.saveAs(path, document);
    assert.deepEqual((await store.open(path)).document, document);
    await writeFile(path, 'external edit');
    await assert.rejects(store.save(saved.token, document), /changed outside/i);
    assert.equal(await readFile(path, 'utf8'), 'external edit');
  } finally { await rm(folder, { recursive: true, force: true }); }
});
test('invalid UTF8, version, paths and values cannot replace a document', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lux-files-'));
  try {
    const path = join(folder, 'scene.lux-scene'), store = new SceneFileStore();
    await store.saveAs(path, document);
    const before = await readFile(path);
    for (const bad of [{ ...document, version: 2 }, { ...document, controls: { intensity: NaN } }, { ...document, source: { ...document.source, entry: '../secret.ts' } }]) {
      await assert.rejects(store.saveAs(path, bad)); assert.deepEqual(await readFile(path), before);
    }
    await writeFile(path, Buffer.from([0xff])); await assert.rejects(store.open(path));
  } finally { await rm(folder, { recursive: true, force: true }); }
});
test('failed replacement keeps old file and permits a later successful save', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lux-files-'));
  try {
    const path = join(folder, 'scene.lux-scene'); await new SceneFileStore().saveAs(path, document);
    const store = new SceneFileStore({ replace: async () => { throw Error('injected replacement failure'); } });
    const opened = await store.open(path);
    await assert.rejects(store.save(opened.token, { ...document, controls: { intensity: 0.2 } }), /replacement failure/);
    assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), document);
    const final = await new SceneFileStore().saveAs(path, { ...document, controls: { intensity: 0.2 } });
    assert.equal(final.document.controls.intensity, 0.2);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
