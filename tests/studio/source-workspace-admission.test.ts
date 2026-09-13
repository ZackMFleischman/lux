import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceWorkspace } from '../../apps/studio/src/source/workspace.ts';
import { workerFactory } from './fixtures/admission-worker-factory.mjs';
import { png } from '../assets/png-fixtures.mjs';
const red = 'Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA==';
const source = (data = red) => ({sourceVersion:2 as const,sdkVersion:'0.1.0' as const,entry:'main.ts',files:{'main.ts':'export {}'},assets:{'assets/red.bmp':{mediaType:'image/bmp' as const,encoding:'base64' as const,data}}});

test('workspace typing and new files never decode unchanged assets', () => {
  const workspace = createSourceWorkspace(source()), before = workspace.getSnapshot();
  const OriginalDataView = globalThis.DataView;
  try {
    globalThis.DataView = class { constructor() { throw Error('image decoding disabled'); } } as unknown as DataViewConstructor;
    workspace.edit('main.ts','edited'); workspace.addFile('helper.ts','helper');
    const next = workspace.getSnapshot().source;
    if (!('assets' in next) || !('assets' in before.source)) assert.fail('expected asset source');
    assert.equal(next.sourceVersion,2);
    assert.equal(next.assets,before.source.assets);
    assert.throws(()=>workspace.replaceDocument(source()),/image decoding disabled/);
  } finally { globalThis.DataView = OriginalDataView; }
});

test('asynchronous replacement commits only after full worker admission and preserves last good on failure', async () => {
  const workspace = createSourceWorkspace(source()); workspace.edit('main.ts','unsaved');
  const before = workspace.getSnapshot(), factory = workerFactory();
  assert.equal(typeof workspace.replaceDocumentAsync,'function');
  const rejected = workspace.replaceDocumentAsync(source('AA=='),factory);
  assert.equal(workspace.getSnapshot().busy,true);
  assert.throws(()=>workspace.edit('main.ts','racing edit'),/busy/);
  await assert.rejects(rejected);
  assert.equal(workspace.getSnapshot().source,before.source);
  assert.equal(workspace.getSnapshot().version,before.version);
  assert.equal(workspace.getSnapshot().dirty,true);
  assert.equal(workspace.getSnapshot().busy,false);
  const hung = workerFactory('hang');
  await assert.rejects(workspace.replaceDocumentAsync(source(),hung,100),/timed out/);
  assert.equal(workspace.getSnapshot().source,before.source);
  assert.equal(workspace.getSnapshot().version,before.version);
  await workspace.replaceDocumentAsync(source(),factory);
  assert.equal(workspace.getSnapshot().version,before.version+1);
  assert.equal(workspace.getSnapshot().source.files['main.ts'],'export {}');
  assert.equal(workspace.getSnapshot().dirty,false);
  for (const item of [...factory.created,...hung.created]) { assert.equal(item.terminated,true); await item.exited; }
});

test('asset import is a worker-validated draft edit preserving text, saved state and undo', async () => {
  const workspace = createSourceWorkspace(source()); workspace.edit('main.ts','unsaved text');
  const before=workspace.getSnapshot(), factory=workerFactory();
  const images={'assets/alpha.png':{mediaType:'image/png' as const,encoding:'base64' as const,data:png().toString('base64')}};
  assert.equal(typeof workspace.editAssetsAsync,'function');
  await workspace.editAssetsAsync(images,before.version,factory);
  const next=workspace.getSnapshot();
  assert.equal(next.dirty,true); assert.equal(next.documentKey,before.documentKey);
  assert.equal(next.source.files['main.ts'],'unsaved text');
  assert.deepEqual(next.dirtyAssets,['assets/alpha.png','assets/red.bmp']);
  await assert.rejects(workspace.editAssetsAsync(images,before.version,factory),/changed/);
  await assert.rejects(workspace.editAssetsAsync({'assets/x.png':{...images['assets/alpha.png'],data:'AA=='}},next.version,factory));
  assert.equal(workspace.getSnapshot().source,next.source);
  workspace.undoReplacement();assert.equal(workspace.getSnapshot().source,before.source);
  for(const item of factory.created)await item.exited;
});
