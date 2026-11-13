import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveSceneArgument, openSceneInStudio } from '../../scripts/studio-session.mjs';

async function tempDir(t) {
  const root = await mkdtemp(join(tmpdir(), 'lux-open-scene-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('resolveSceneArgument rejects a wrong extension', async t => {
  const file = join(await tempDir(t), 'scene.json');
  await writeFile(file, '{}');
  await assert.rejects(resolveSceneArgument(file), /Not a \.lux-scene file/);
});

test('resolveSceneArgument rejects a missing file and a directory', async t => {
  const root = await tempDir(t);
  await assert.rejects(resolveSceneArgument(join(root, 'missing.lux-scene')));
  await mkdir(join(root, 'dir.lux-scene'));
  await assert.rejects(resolveSceneArgument(join(root, 'dir.lux-scene')), /not a file/);
});

test('resolveSceneArgument returns the absolute path of an existing scene', async t => {
  const file = join(await tempDir(t), 'ok.lux-scene');
  await writeFile(file, '{}');
  assert.equal(await resolveSceneArgument(file), file);
});

test('openSceneInStudio passes the draft version and never discardDirty', async () => {
  const calls = [];
  const connect = async (method, params) => {
    calls.push([method, params]);
    return method === 'read' ? { draftVersion: 7 } : { opened: true };
  };
  const result = await openSceneInStudio(connect, 'C:/x/a.lux-scene');
  assert.deepEqual(calls, [['read', undefined], ['scene.open', { path: 'C:/x/a.lux-scene', expectedDraftVersion: 7 }]]);
  assert.equal(calls[1][1].discardDirty, undefined);
  assert.equal(result.requested, 'C:/x/a.lux-scene');
  assert.equal(result.opened, true);
});

test('openSceneInStudio wraps open failures and says the draft was kept', async () => {
  const connect = async method => {
    if (method === 'read') return { draftVersion: 1 };
    throw Error('draft has unsaved changes');
  };
  await assert.rejects(openSceneInStudio(connect, 'a.lux-scene'),
    /did not open a\.lux-scene: draft has unsaved changes\. The current draft and preview were kept\./);
});

test('openSceneInStudio waits while a starting Studio is busy, then opens', async () => {
  let opens = 0;
  const connect = async method => {
    if (method === 'read') return { draftVersion: 7 };
    if (++opens === 1) throw Error('Studio is busy');
    if (opens === 2) throw Error('Editor changed; read its source again');
    return { draftVersion: 8 };
  };
  const result = await openSceneInStudio(connect, 'C:/x/a.lux-scene', { sleep: async () => {} });
  assert.equal(opens, 3);
  assert.equal(result.draftVersion, 8);
});

test('openSceneInStudio stops waiting for busy after its deadline', async () => {
  const connect = async method => { if (method === 'read') return { draftVersion: 1 }; throw Error('Studio is busy'); };
  await assert.rejects(openSceneInStudio(connect, 'C:/x/a.lux-scene', { busyTimeoutMs: 0, sleep: async () => {} }), /busy\. The current draft and preview were kept/);
});
