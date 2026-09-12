import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceWorkspace } from '../../apps/studio/src/source/workspace.ts';
import { createAuthoringSession } from '../../apps/studio/src/source/authoring-session.ts';
import { diagnosticsForSource, diagnosticTarget } from '../../apps/studio/src/source/diagnostics.ts';
import type { AssetSourceBundle } from '../../packages/runtime-contracts/src/index.ts';

function source(value = 255): AssetSourceBundle {
  const bytes = Buffer.from('Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA==', 'base64');
  bytes[56] = value;
  return { sourceVersion: 2, sdkVersion: '0.1.0', entry: 'main.ts', files: { 'main.ts': 'export {}' },
    assets: { 'assets/red.bmp': { mediaType: 'image/bmp', encoding: 'base64', data: bytes.toString('base64') } } };
}
test('byte-only changes dirty the document, preserve failed candidates and undo complete assets', async () => {
  const w = createSourceWorkspace(source());
  await w.submit(source(), 0, async () => {});
  const before = w.getSnapshot();
  await assert.rejects(w.submit(source(64), before.version, async () => { throw Error('candidate failed'); }), /candidate failed/);
  assert.equal(w.getSnapshot().source, before.source);
  await w.submit(source(64), before.version, async () => {});
  assert.equal(w.getSnapshot().dirty, true);
  assert.deepEqual(w.getSnapshot().dirtyFiles, []);
  assert.deepEqual(w.getSnapshot().dirtyAssets, ['assets/red.bmp']);
  assert.equal(w.getSnapshot().runningMatchesDraft, true);
  w.undoReplacement();
  assert.equal(w.getSnapshot().dirty, false);
  assert.equal(w.getSnapshot().runningMatchesDraft, false);
  assert.deepEqual(w.getSnapshot().source, source());
  w.edit('main.ts', 'export const edited = true');
  assert.deepEqual((w.getSnapshot().source as AssetSourceBundle).assets, source().assets);
});
test('removal and source version changes are document changes, including empty v2 assets', async () => {
  const w = createSourceWorkspace(source());
  await w.submit({ ...source(), assets: {} }, 0, async () => {});
  assert.deepEqual(w.getSnapshot().dirtyAssets, ['assets/red.bmp']);
  w.markSaved(w.getSnapshot().version);
  const legacy = { sdkVersion: '0.1.0' as const, entry: 'main.ts', files: { 'main.ts': 'export {}' } };
  await w.submit(legacy, w.getSnapshot().version, async () => {});
  assert.equal(w.getSnapshot().dirty, true);
  assert.equal(w.getSnapshot().canUndoReplacement, true);
  w.undoReplacement(); assert.equal(w.getSnapshot().dirty, false);
});
test('session read, save, reopen and export retain v2 bytes and source changes cannot mutate snapshots', async () => {
  const w = createSourceWorkspace(source());
  const saved: any[] = [], exported: any[] = [];
  const session = createAuthoringSession(w, { submit: async () => {},
    save: async request => { saved.push(request); return { token: 'saved', name: 'asset.lux-scene' }; },
    getControls: () => ({ intensity: 0.42 }),
    open: async () => ({ token: 'opened', name: 'asset.lux-scene', document: saved[0].document }),
    export: async request => { exported.push(request); return null; } });
  const read = session.read(); (read.source as AssetSourceBundle).assets['assets/red.bmp']!.data = source(32).assets['assets/red.bmp']!.data;
  assert.deepEqual(w.getSnapshot().source, source());
  assert.ok(Object.isFrozen((w.getSnapshot().source as AssetSourceBundle).assets['assets/red.bmp']));
  await session.save(); assert.equal(saved[0].document.version, 2);
  assert.deepEqual(saved[0].document.source, source());
  await session.build(source(64), w.getSnapshot().version); await session.open();
  assert.deepEqual(w.getSnapshot().source, source());
  await session.exportSource('Image'); assert.equal(exported[0].document.version, 2);
  assert.deepEqual(exported[0].document.source, source());
  assert.equal(exported[0].document.controls.intensity, 0.42);
});
test('an asset-only failed candidate is labeled separately and asset diagnostics never open a code tab', () => {
  const w = createSourceWorkspace(source());
  const diagnostics = diagnosticsForSource([{ file: 'main.ts', line: 1, message: 'candidate failure' },
    { file: 'assets/red.bmp', message: 'invalid image' }], source(64), w.getSnapshot().version, w.getSnapshot());
  assert.equal(diagnostics[0]!.candidateOnly, true);
  assert.equal(diagnosticTarget(diagnostics[0]!, w.getSnapshot()), null);
  assert.equal(diagnosticTarget(diagnostics[1]!, w.getSnapshot()), null);
});
