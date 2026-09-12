import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SceneFileStore, createSceneDocument } from '../../packages/core/src/scene-file.ts';
import {validateSceneDocument} from '../../packages/core/src/scene-document.ts';
import { sourceBundleSchema } from '../../packages/runtime-contracts/src/index.ts';
import { createHash } from 'node:crypto';
import { canonicalControlSchemaJson, normalizeControlDeclarations } from '../../packages/runtime-contracts/src/parameters.mjs';
const document = { format: 'lux-scene', version: 1, source: { sdkVersion: '0.1.0', entry: 'visual.ts', files: { 'visual.ts': '// 🌈 unfinished draft' } }, settings: { width: 1920, height: 1080, fps: 60, seed: 0 }, controls: { intensity: 0.8 } };

test('scene v3 preserves empty and named caches with accepted-source provenance and assets', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lux-parameters-scene-'));
  try {
    for (const schema of [[], normalizeControlDeclarations({ height: { type:'number', label:'Height', min:0, max:2, default:1 } })]) {
      const values:Record<string,number>=schema.length ? {height:1.7} : {};
      const controls = { sourceHash:'a'.repeat(64), schema, schemaHash:createHash('sha256').update(canonicalControlSchemaJson(schema)).digest('hex'), values };
      for (const source of [{...document.source,sdkVersion:'0.2.0' as const}, {...document.source,sdkVersion:'0.2.0' as const,sourceVersion:2 as const,assets:{}}]) {
        const next = {...document,version:3,source,controls}, path = join(folder,'parameters.lux-scene');
        assert.deepEqual(createSceneDocument(source,document.settings,controls),next);
        await new SceneFileStore().saveAs(path,next);
        assert.deepEqual((await new SceneFileStore().open(path)).document,next);
      }
    }
  } finally { await rm(folder,{recursive:true,force:true}); }
});

test('scene v3 rejects malformed caches and schema hashes before replacing files', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lux-parameters-invalid-'));
  try {
    const schema=normalizeControlDeclarations({height:{type:'number',label:'Height',min:0,max:2,default:1}});
    const controls={sourceHash:'a'.repeat(64),schema,schemaHash:createHash('sha256').update(canonicalControlSchemaJson(schema)).digest('hex'),values:{height:1.5}};
    const next={...document,version:3,source:{...document.source,sdkVersion:'0.2.0'},controls};
    const path=join(folder,'parameters.lux-scene'),store=new SceneFileStore();
    await store.saveAs(path,next); const before=await readFile(path);
    for(const bad of [
      {...next,version:1}, {...next,source:document.source},
      ...[{...controls,schemaHash:'b'.repeat(64)},{...controls,sourceHash:'no'}, {...controls,values:{}},
        {...controls,values:{height:3}},{...controls,values:{height:1,other:0}}, {...controls,values:Object.create({height:1})},
        {...controls,schema:[Object.create(schema[0]!)]}, Object.defineProperty({...controls},'values',{get(){throw Error('getter invoked');}})
      ].map(controls=>({...next,controls})),
    ]) {
      await assert.rejects(store.saveAs(path,bad)); assert.deepEqual(await readFile(path),before);
    }
    await writeFile(path,JSON.stringify({...next,controls:{...controls,schemaHash:'b'.repeat(64)}}));
    await assert.rejects(store.open(path),/schema hash/i);
    await writeFile(path,' '.repeat(7340032)+JSON.stringify(next));
    await assert.rejects(store.open(path),/7 MiB/);
  } finally { await rm(folder,{recursive:true,force:true}); }
});

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
    const inherited = {...next,source:{...source,assets:{'assets/red.bmp':Object.create(source.assets['assets/red.bmp'])}}};
    assert.throws(()=>validateSceneDocument(inherited));
    await writeFile(path,' '.repeat(7340032)+JSON.stringify(next));
    await assert.rejects(store.open(path),/7 MiB/);
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
    assert.equal(final.document.version,1);
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
