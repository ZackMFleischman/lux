import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createSoundtrackFiles, createSoundtrackIpcHandler } from '../../apps/studio/src/soundtrack/soundtrack-files.ts';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('only the trusted main window may choose or load a soundtrack', async () => {
  let chosen = 0;
  const files = createSoundtrackFiles({ choosePath: async () => { chosen++; return null; } });
  const handler = createSoundtrackIpcHandler(files, (event: { trusted: boolean }) => event.trusted);
  await assert.rejects(handler({ trusted: false }, 'choose'), /Untrusted soundtrack sender/);
  await assert.rejects(handler({ trusted: false }, 'load-linked', 'token'), /Untrusted soundtrack sender/);
  assert.equal(chosen, 0, 'an untrusted sender never opens a dialog');
  assert.equal(await handler({ trusted: true }, 'choose'), null, 'a cancelled dialog returns null');
  await assert.rejects(handler({ trusted: true }, 'read-path', 'C:\\secret.mp3'), /Unsupported soundtrack operation/);
  await assert.rejects(handler({ trusted: true }, 'load-linked', 42), /Invalid scene token/);
  await assert.rejects(handler({ trusted: true }, 'load-linked', 'unknown'), /no linked soundtrack/);
});

test('choose reads the file, hashes it and enforces type and size limits', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lux-soundtrack-files-'));
  try {
    const song = join(folder, 'song.mp3'), bytes = new Uint8Array([1, 2, 3, 4, 5]);
    await writeFile(song, bytes);
    await writeFile(join(folder, 'notes.txt'), 'x');
    let path: string | null = song;
    const files = createSoundtrackFiles({ choosePath: async () => path, limit: 8 });
    const chosen = await files.choose();
    assert.deepEqual({ ...chosen, bytes: [...chosen!.bytes] }, { name: 'song.mp3', absolutePath: song, sha256: hash(bytes), bytes: [...bytes] });
    path = join(folder, 'notes.txt');
    await assert.rejects(files.choose(), /MP3, WAV, OGG/);
    path = join(folder, 'large.wav'); await writeFile(path, new Uint8Array(9));
    await assert.rejects(files.choose(), /exceeds/);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('linked soundtracks resolve relative first, then absolute, and report missing or changed files', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lux-soundtrack-linked-'));
  try {
    await mkdir(join(folder, 'show', 'audio'), { recursive: true }); await mkdir(join(folder, 'library'));
    const scene = join(folder, 'show', 'scene.lux-scene'), relativeSong = join(folder, 'show', 'audio', 'song.mp3'), absoluteSong = join(folder, 'library', 'song.mp3');
    const bytes = new Uint8Array([9, 8, 7]);
    await writeFile(relativeSong, bytes); await writeFile(absoluteSong, bytes);
    const files = createSoundtrackFiles({ choosePath: async () => null });
    const soundtrack = { path: 'audio/song.mp3', absolutePath: absoluteSong, sha256: hash(bytes), offsetSeconds: 0, volume: 1 };
    files.remember('scene-token', scene, { soundtrack });
    let loaded = await files.loadLinked('scene-token');
    assert.equal(loaded.status, 'loaded');
    assert.equal(loaded.status === 'loaded' && loaded.absolutePath, relativeSong, 'scene-relative path wins');
    await rename(relativeSong, join(folder, 'moved.mp3'));
    loaded = await files.loadLinked('scene-token');
    assert.equal(loaded.status === 'loaded' && loaded.absolutePath, absoluteSong, 'absolute path is the fallback');
    await writeFile(absoluteSong, new Uint8Array([1]));
    loaded = await files.loadLinked('scene-token');
    assert.equal(loaded.status, 'mismatch');
    assert.match('message' in loaded ? loaded.message : '', /changed since it was linked/);
    await rm(absoluteSong);
    loaded = await files.loadLinked('scene-token');
    assert.equal(loaded.status, 'missing');
    assert.match('message' in loaded ? loaded.message : '', /was not found/);
    files.remember('scene-token', scene, {});
    await assert.rejects(files.loadLinked('scene-token'), /no linked soundtrack/);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
