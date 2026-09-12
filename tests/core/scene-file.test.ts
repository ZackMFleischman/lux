import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SceneFileStore, createSceneDocument } from '../../packages/core/src/scene-file.ts';
import { sourceBundleSchema } from '../../packages/runtime-contracts/src/index.ts';
const document = { format: 'lux-scene', version: 1, source: { sdkVersion: '0.1.0', entry: 'visual.ts', files: { 'visual.ts': '// 🌈 unfinished draft' } }, settings: { width: 1920, height: 1080, fps: 60, seed: 0 }, controls: { intensity: 0.8 } };

test('scene v2 preserves image bytes and rejects version pairs before replacing files', async () => {
  const folder = await mkdtemp(join(tmpdir(),'lux-assets-scene-'));
  try {
    const source = {...document.source,sourceVersion:2,assets:{'assets/red.bmp':{mediaType:'image/bmp',encoding:'base64',data:'Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA=='}}};
    const next = {...document,version:2,source}, store = new SceneFileStore(), path = join(folder,'image.lux-scene');
    assert.deepEqual(createSceneDocument(sourceBundleSchema.parse(source),document.settings,document.controls),next);
    assert.equal(createSceneDocument(sourceBundleSchema.parse(document.source),document.settings,document.controls).version,1);
    await store.saveAs(path,next);
    assert.deepEqual((await store.open(path)).document,next);
    const before = await readFile(path);
    for(const bad of [{...next,version:1},{...document,version:2},{...next,source:{...source,assets:{'assets/red.bmp':{...source.assets['assets/red.bmp'],data:''}}}}]) {
      await assert.rejects(store.saveAs(path,bad)); assert.deepEqual(await readFile(path),before);
    }
  } finally { await rm(folder,{recursive:true,force:true}); }
});
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

test('three-file Unicode drafts with a nested alternate entry roundtrip without losing helper bytes on failure', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lux-multifile-'));
  try {
    const path = join(folder, 'multi.lux-scene');
    const multi = { ...document, source: { sdkVersion: '0.1.0', entry: 'scene/start.ts', files: {
      'scene/start.ts': "import { color } from '../lib/color.ts';\r\n// 🌈 unfinished\r\n",
      'lib/color.ts': "export const color = '彩色';\n",
      'lib/noise.ts': '// λ 😀\nexport const noise = 0.125;\n',
    } } };
    await new SceneFileStore().saveAs(path, multi);
    const failing = new SceneFileStore({ replace: async () => { throw Error('injected replacement failure'); } });
    const reopened = await failing.open(path); assert.deepEqual(reopened.document, multi);
    const changed = structuredClone(multi); changed.source.files['lib/noise.ts'] = '// changed helper';
    await assert.rejects(failing.save(reopened.token, changed), /replacement failure/);
    assert.deepEqual((await new SceneFileStore().open(path)).document, multi);
    const successful = await new SceneFileStore().saveAs(path, changed);
    assert.deepEqual(successful.document, changed);
    assert.deepEqual((await new SceneFileStore().open(path)).document, changed);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
