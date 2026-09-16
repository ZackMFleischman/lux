import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { resolveStandardLibrary } from '../../apps/studio/src/standard-library.ts';

test('checkout profiles resolve one library from the Git common directory', () => {
  const common = resolve('C:/repo/lux/.git');
  const first = resolveStandardLibrary({ workspace: 'C:/repo/lux/.worktrees/one', appData: 'C:/profiles', desktop: false,
    gitCommonDirectory: () => common });
  const second = resolveStandardLibrary({ workspace: 'C:/repo/lux/.worktrees/two', appData: 'C:/profiles', desktop: false,
    gitCommonDirectory: () => common });

  assert.deepEqual(first, { root: join(resolve('C:/repo/lux'), 'library'), kind: 'repository', seedRoots: [] });
  assert.deepEqual(second, first);
});

test('independent installed Studio uses one writable fallback and the immutable package library as its seed', () => {
  const result = resolveStandardLibrary({ workspace: 'C:/Programs/Lux/resources/app/runtime', appData: 'C:/Users/test/AppData/Roaming', desktop: true });

  assert.deepEqual(result, {
    root: join(resolve('C:/Users/test/AppData/Roaming'), 'Lux', 'Studio', 'library'),
    kind: 'fallback',
    seedRoots: [join(resolve('C:/Programs/Lux/resources/app/runtime'), 'library')],
  });
});

test('an explicit test root isolates writes while retaining the checkout seed', () => {
  const result = resolveStandardLibrary({ workspace: 'C:/repo/lux', appData: 'C:/profiles', desktop: true,
    overrideRoot: 'C:/scratch/isolated-library', gitCommonDirectory: () => { throw Error('must not inspect Git'); } });

  assert.deepEqual(result, {
    root: resolve('C:/scratch/isolated-library'),
    kind: 'test',
    seedRoots: [join(resolve('C:/repo/lux'), 'library')],
  });
});

test('installed Studio uses the marked canonical repository and merges its fallback when available', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-standard-location-'));
  const canonical = join(directory, 'repo', 'library'), workspace = join(directory, 'installed', 'runtime'), appData = join(directory, 'appdata');
  await mkdir(canonical, { recursive: true });
  await writeFile(join(canonical, 'repository.json'), JSON.stringify({ format: 'lux-standard-library', version: 1,
    projectId: '34723eb7-f57d-45c3-8831-adcb2bbfe485' }));

  assert.deepEqual(resolveStandardLibrary({ workspace, appData, desktop: true, canonicalRoot: canonical }), {
    root: resolve(canonical),
    kind: 'repository',
    seedRoots: [join(resolve(workspace), 'library'), join(resolve(appData), 'Lux', 'Studio', 'library')],
  });
});

test('installed Studio falls back only when the marked canonical repository is unavailable', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-standard-fallback-'));
  const missing = join(directory, 'missing', 'library'), workspace = join(directory, 'installed', 'runtime'), appData = join(directory, 'appdata');
  const fallback = resolveStandardLibrary({ workspace, appData, desktop: true, canonicalRoot: missing });
  assert.equal(fallback.kind, 'fallback');
  assert.equal(fallback.root, join(resolve(appData), 'Lux', 'Studio', 'library'));

  await mkdir(missing, { recursive: true });
  await writeFile(join(missing, 'repository.json'), '{broken');
  assert.throws(() => resolveStandardLibrary({ workspace, appData, desktop: true, canonicalRoot: missing }), /marker|JSON|corrupt/i);

  await writeFile(join(missing, 'repository.json'), ' '.repeat(4097));
  assert.throws(() => resolveStandardLibrary({ workspace, appData, desktop: true, canonicalRoot: missing }), /too large|corrupt/i);
});
