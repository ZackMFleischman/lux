import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceWorkspace } from '../../apps/studio/src/source/workspace.ts';
import { createAuthoringSession } from '../../apps/studio/src/source/authoring-session.ts';
import { createSceneDocument } from '../../packages/core/src/scene-document.ts';

const source = () => ({ sdkVersion: '0.1.0' as const, entry: 'main.ts', files: { 'main.ts': 'export {}' } });
const output = { width: 640, height: 360, fps: 60, seed: 0 };
const song = { path: 'C:\\music\\dawn.mp3', absolutePath: 'C:\\music\\dawn.mp3', sha256: 'c'.repeat(64), offsetSeconds: 0, volume: 1 };

test('soundtrack edits mark the scene dirty and are saved with it; removal saves no key', async () => {
  const saved: any[] = [];
  const session = createAuthoringSession(createSourceWorkspace(source()), { submit: async () => {},
    save: async request => { saved.push(request.document); return { token: `saved-${saved.length}`, name: 'show.lux-scene' }; },
    getControls: () => ({ intensity: .5 }), getOutput: () => output });
  await session.save(false);
  assert.equal(Object.hasOwn(saved[0], 'soundtrack'), false, 'scenes without a soundtrack save no soundtrack key');
  session.setSoundtrack(song);
  assert.equal(session.getSnapshot().controlsDirty, true);
  assert.equal(session.getSnapshot().soundtrackOrigin, null);
  await session.save(false);
  assert.deepEqual(saved[1].soundtrack, song);
  assert.equal(session.getSnapshot().controlsDirty, false);
  session.setSoundtrack({ ...song, offsetSeconds: 2.5, volume: .6 });
  assert.equal(session.getSnapshot().controlsDirty, true);
  await session.save(false);
  assert.deepEqual(saved[2].soundtrack, { ...song, offsetSeconds: 2.5, volume: .6 });
  session.setSoundtrack(null);
  await session.save(false);
  assert.equal(Object.hasOwn(saved[3], 'soundtrack'), false);
  assert.throws(() => session.setSoundtrack({ ...song, volume: 3 }), /volume/);
});

test('opening a scene adopts its soundtrack with the file token; resolution updates the fallback path silently', async () => {
  const withSong = { ...createSceneDocument(source(), output, { intensity: .5 }), soundtrack: { ...song, path: 'audio/dawn.mp3' } };
  const plain = createSceneDocument(source(), output, { intensity: .5 });
  let next: unknown = withSong;
  const session = createAuthoringSession(createSourceWorkspace(source()), { submit: async () => {}, save: async () => null,
    getControls: () => ({ intensity: .5 }), open: async () => ({ token: 'opened-1', name: 'show.lux-scene', document: next }) });
  await session.open();
  assert.deepEqual(session.getSnapshot().soundtrack, withSong.soundtrack);
  assert.equal(session.getSnapshot().soundtrackOrigin, 'opened-1');
  assert.equal(session.getSnapshot().controlsDirty, false);
  session.soundtrackResolved('D:\\show\\audio\\dawn.mp3');
  assert.equal(session.getSnapshot().soundtrack?.absolutePath, 'D:\\show\\audio\\dawn.mp3');
  assert.equal(session.getSnapshot().controlsDirty, false, 'finding the file is not an edit');
  session.setSoundtrack({ ...session.getSnapshot().soundtrack!, offsetSeconds: 1 });
  assert.equal(session.getSnapshot().soundtrackOrigin, 'opened-1', 'editing offset keeps the same file load');
  next = plain;
  await session.open();
  assert.equal(session.getSnapshot().soundtrack, null);
  assert.equal(session.getSnapshot().soundtrackOrigin, null);
});
