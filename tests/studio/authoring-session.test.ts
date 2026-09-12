import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceWorkspace } from '../../apps/studio/src/source/workspace.ts';
import { createAuthoringSession } from '../../apps/studio/src/source/authoring-session.ts';
const source = () => ({ sdkVersion: '0.1.0' as const, entry: 'main.ts', files: { 'main.ts': 'export {}', 'lib/color.ts': 'export const red = 1' } });
test('session reads, builds and saves a complete isolated draft', async () => {
  const w = createSourceWorkspace(source()), submitted: unknown[] = [], saved: any[] = [];
  const session = createAuthoringSession(w, { submit: async s => { submitted.push(s); },
    save: async request => { saved.push(request); return { token: 'saved', name: 'test.lux-scene' }; }, getControls: () => ({ intensity: 0.4 }) });
  w.edit('lib/color.ts', 'helper edit');
  const read = session.read(); read.source.files['main.ts'] = 'caller edit';
  assert.equal(w.getSnapshot().source.files['main.ts'], 'export {}');
  await session.build(session.read().source, session.read().draftVersion);
  assert.equal((submitted[0] as any).files['lib/color.ts'], 'helper edit');
  assert.equal(w.getSnapshot().dirty, true);
  await session.save(false);
  assert.equal(saved[0].document.source.files['lib/color.ts'], 'helper edit');
  assert.equal(saved[0].document.controls.intensity, 0.4);
  assert.equal(w.getSnapshot().dirty, false);
  assert.equal(session.getSnapshot().name, 'test.lux-scene');
});
test('cancelled/failed saves preserve dirty and an in-flight save excludes open/build/save', async () => {
  const w = createSourceWorkspace(source()); w.edit('main.ts', 'draft');
  let release!: (result: any) => void, opened = false;
  const session = createAuthoringSession(w, { submit: async () => assert.fail('must not submit'),
    save: () => new Promise(resolve => { release = resolve; }), getControls: () => ({ intensity: 0.5 }),
    open: async () => { opened = true; return null; } });
  const saving = session.save(false);
  await assert.rejects(session.build(source(), w.getSnapshot().version), /busy/);
  await assert.rejects(session.save(true), /busy/);
  await assert.rejects(session.open(), /busy/); assert.equal(opened, false);
  release(null); await saving; assert.equal(w.getSnapshot().dirty, true);
  const newerSave = session.save(false); w.edit('main.ts', 'newer');
  release({ token: 'saved', name: 'test' }); await newerSave; assert.equal(w.getSnapshot().dirty, true);
  const failing = createAuthoringSession(w, { submit: async () => {}, save: async () => { throw Error('disk'); }, getControls: () => ({ intensity: 0.5 }) });
  await assert.rejects(failing.save(false), /disk/); assert.equal(w.getSnapshot().dirty, true);
});
test('stale build cannot submit and opening invalid code preserves the previous running identity', async () => {
  const w = createSourceWorkspace(source()); await w.submit(source(), 0, async () => {});
  let count = 0;
  const incoming = { ...source(), entry: 'other.ts', files: { 'other.ts': 'bad code', 'helper.ts': 'helper' } };
  const session = createAuthoringSession(w, { submit: async () => { count++; throw Error('compiler'); }, save: async () => null,
    getControls: () => ({ intensity: 0.5 }), open: async () => ({ token: 'new', name: 'new', document: {
      format: 'lux-scene', version: 1, source: incoming, settings: { width: 1920, height: 1080, fps: 60, seed: 0 }, controls: { intensity: 0.8 } } }) });
  await assert.rejects(session.build(source(), 0), /Editor changed/); assert.equal(count, 0);
  await assert.rejects(session.open(), /compiler/);
  assert.equal(w.getSnapshot().selectedFile, 'other.ts');
  assert.equal(w.getSnapshot().dirty, false);
  assert.equal(w.getSnapshot().hasRunningSource, true);
  assert.equal(w.getSnapshot().runningMatchesDraft, false);
  assert.equal(session.getSnapshot().name, 'new');
});

test('export validates a complete snapshot, excludes competing operations and preserves dirty state', async () => {
  const w = createSourceWorkspace(source()); w.edit('lib/color.ts', 'export const red = 0.2');
  const events: string[] = []; let captured: any, finish!: (value: any) => void;
  const session = createAuthoringSession(w, { submit: async s => { events.push('validated'); assert.equal(s.files['lib/color.ts'], 'export const red = 0.2'); },
    save: async () => null, getControls: () => ({ intensity: 0.42 }),
    export: async request => { events.push('export'); captured = request; return new Promise(resolve => { finish = resolve; }); } });
  const pending = session.exportSource('Tunnel');
  await assert.rejects(session.save(), /busy/);
  await assert.rejects(session.build(source(), w.getSnapshot().version), /busy/);
  while (!finish) await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(events, ['validated', 'export']);
  assert.equal(captured.name, 'Tunnel'); assert.equal(captured.document.controls.intensity, 0.42);
  assert.equal(captured.document.source.files['lib/color.ts'], 'export const red = 0.2');
  finish(null); assert.equal(await pending, null);
  assert.equal(w.getSnapshot().dirty, true); assert.equal(session.getSnapshot().busy, false);
});

test('failed preview validation prevents export and releases the session lock', async () => {
  const w = createSourceWorkspace(source());
  const session = createAuthoringSession(w, { submit: async () => { throw Error('invalid visual'); },
    save: async () => null, getControls: () => ({ intensity: 0.5 }), export: async () => assert.fail('invalid visual must not export') });
  await assert.rejects(session.exportSource('Broken'), /invalid visual/);
  assert.equal(session.getSnapshot().busy, false);
});

test('failed open preserves document controls through save and applies them when repaired', async () => {
  const w = createSourceWorkspace(source()), saved: any[] = [];
  let invalid = true, intensity = 0.2;
  const session = createAuthoringSession(w, { submit: async () => { if (invalid) throw Error('broken source'); },
    save: async request => { saved.push(request); return { token: 'opened', name: 'broken.lux-scene' }; },
    getControls: () => ({ intensity }), applyControls: async controls => { intensity = controls.intensity; session.controlsChanged(); },
    open: async () => ({ token: 'opened', name: 'broken.lux-scene', document: { format: 'lux-scene', version: 1,
      source: source(), settings: { width: 1920, height: 1080, fps: 60, seed: 0 }, controls: { intensity: 0.8 } } }) });
  await assert.rejects(session.open(), /broken source/);
  intensity = 0.3; session.controlsChanged();
  assert.equal(session.getSnapshot().controlsDirty, false, 'Previous preview controls do not mutate the newly opened document');
  await session.save(); assert.equal(saved[0].document.controls.intensity, 0.8);
  invalid = false; await session.build(session.read().source, session.read().draftVersion);
  assert.equal(intensity, 0.8);
  intensity = 0.9; session.controlsChanged(); await session.save();
  assert.equal(saved[1].document.controls.intensity, 0.9);
});
