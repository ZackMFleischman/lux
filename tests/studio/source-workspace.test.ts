import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceWorkspace } from '../../apps/studio/src/source/workspace.ts';
const source = () => ({ sdkVersion: '0.1.0' as const, entry: 'main.ts', files: { 'main.ts': 'export {}', 'lib/color.ts': 'export const red = 1' } });
test('helper drafts survive navigation and dirty compares complete saved content', () => {
  const w = createSourceWorkspace(source());
  w.openFile('lib/color.ts'); w.edit('lib/color.ts', 'changed'); w.closeFile('lib/color.ts');
  assert.equal(w.getSnapshot().source.files['lib/color.ts'], 'changed');
  assert.equal(w.getSnapshot().dirty, true);
  const version = w.getSnapshot().version;
  w.openFile('main.ts'); assert.equal(w.getSnapshot().version, version);
  w.markSaved(version - 1); assert.equal(w.getSnapshot().dirty, true);
  w.edit('lib/color.ts', source().files['lib/color.ts']); assert.equal(w.getSnapshot().dirty, false);
  w.addFile('lib/new.ts', ''); assert.equal(w.getSnapshot().dirty, true);
  w.markSaved(w.getSnapshot().version); assert.equal(w.getSnapshot().dirty, false);
});
test('submit takes a synchronous exclusive lock and failure preserves all drafts', async () => {
  const w = createSourceWorkspace(source()); w.edit('main.ts', 'draft');
  const before = w.getSnapshot(); let release!: () => void;
  const pending = w.submit(source(), before.version, () => new Promise<void>(resolve => { release = resolve; }));
  assert.equal(w.getSnapshot().busy, true);
  assert.throws(() => w.edit('main.ts', 'lost'), /busy/);
  assert.throws(() => w.addFile('new.ts', ''), /busy/);
  assert.throws(() => w.replaceDocument(source()), /busy/);
  await assert.rejects(w.submit(source(), before.version, async () => {}), /busy/);
  release(); await pending;
  assert.equal(w.getSnapshot().version, before.version + 1);
  assert.equal(w.getSnapshot().runningMatchesDraft, true);
  w.undoReplacement(); assert.equal(w.getSnapshot().source.files['main.ts'], 'draft');
  assert.equal(w.getSnapshot().runningMatchesDraft, false);
  const version = w.getSnapshot().version;
  await assert.rejects(w.submit(source(), version, async () => { throw Error('bad'); }), /bad/);
  assert.equal(w.getSnapshot().version, version);
  assert.equal(w.getSnapshot().source.files['main.ts'], 'draft');
  assert.equal(w.getSnapshot().busy, false);
});
test('submitted inputs and published snapshots cannot mutate store; stale versions never activate', async () => {
  const input = source(), w = createSourceWorkspace(input);
  input.files['main.ts'] = 'caller mutation';
  assert.equal(w.getSnapshot().source.files['main.ts'], 'export {}');
  assert.throws(() => { w.getSnapshot().source.files['main.ts'] = 'snapshot mutation'; });
  for (const version of [-1, NaN, Infinity, 0.5]) {
    await assert.rejects(w.submit(source(), version, async () => assert.fail('must not activate')));
  }
  let release!: () => void;
  const candidate = source(); candidate.files['main.ts'] = 'accepted';
  const pending = w.submit(candidate, 0, admitted => new Promise<void>(resolve => {
    assert.throws(() => { admitted.files['main.ts'] = 'port mutation'; }); release = resolve;
  }));
  candidate.files['main.ts'] = 'late mutation'; release(); await pending;
  assert.equal(w.getSnapshot().source.files['main.ts'], 'accepted');
  w.replaceDocument(source()); assert.equal(w.getSnapshot().dirty, false);
  assert.equal(w.getSnapshot().canUndoReplacement, false);
  assert.equal(w.getSnapshot().runningMatchesDraft, false);
});
test('new files share compiler path and complete UTF-8 budget admission', () => {
  const w = createSourceWorkspace(source());
  for (const path of ['../bad.ts', '/bad.ts', 'Main.ts', 'con.ts', '__lux.ts', 'bad.js', 'a\\b.ts']) {
    assert.throws(() => w.addFile(path, '')); }
  assert.throws(() => w.addFile('main.ts', 'overwrite'));
  assert.throws(() => w.addFile('big.ts', 'é'.repeat(524288)));
  assert.throws(() => w.edit('main.ts', '\ud800'));
  assert.throws(() => createSourceWorkspace({ ...source(), entry: 'missing.ts' }));
  const boundary = createSourceWorkspace({ sdkVersion: '0.1.0', entry: 'a.ts', files: { 'a.ts': 'é'.repeat(524288) } });
  assert.equal(boundary.getSnapshot().source.files['a.ts']!.length, 524288);
  assert.throws(() => boundary.edit('a.ts', boundary.getSnapshot().source.files['a.ts'] + 'a'));
});
