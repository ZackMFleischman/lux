import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyLibraryComponent,
  checkLibraryLinks,
  forkLibraryComponent,
} from '../../packages/core/src/component-library.ts';
import { ComponentLibraryStore } from '../../packages/core/src/component-library-store.ts';
import type { SourceBundle } from '../../packages/runtime-contracts/src/index.ts';

const component = (body = 'export const color = "violet";') => ({
  sdkVersion: '0.4.0' as const,
  entry: 'component.ts',
  files: { 'component.ts': body, 'helper.ts': 'export const helper = 1;' },
});
const scene = () => ({
  sdkVersion: '0.4.0' as const,
  entry: 'composition.ts',
  files: { 'composition.ts': 'import shared from "./library/shared/component.ts"; export default shared;' },
});
const record = (id: string, body = 'export const color = "violet";', revision = 1) => ({
  id, revision, name: `Shared ${revision}`, description: 'A reusable component.',
  updatedAt: '2026-09-13T20:00:00.000Z', source: component(body),
});
async function filesBelow(root: string, prefix = ''): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) found.push(...await filesBelow(root, path));
    else found.push(path.replaceAll('\\', '/'));
  }
  return found;
}

test('library writes are atomic, revision guarded, validated before activation, and persist across store restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-library-'));
  const root = join(directory, 'library');
  const validations: string[] = [];
  const options = {
    id: () => '11111111-1111-4111-8111-111111111111',
    now: () => '2026-09-13T20:00:00.000Z',
    validateCandidate: async (source: SourceBundle) => {
      const candidate = source.files['component.ts'];
      assert.ok(candidate);
      validations.push(candidate);
      if (candidate.includes('invalid')) throw Error('candidate build failed');
    },
  };
  const store = new ComponentLibraryStore(root, options);
  const created = await store.create({ name: 'Shared Violet', description: 'A reusable violet image.', source: component() });
  assert.equal(created.id, '11111111-1111-4111-8111-111111111111');
  assert.equal(created.revision, 1);
  assert.deepEqual((await store.list()).map(({ id, revision, name }) => ({ id, revision, name })), [
    { id: created.id, revision: 1, name: 'Shared Violet' },
  ]);

  await assert.rejects(store.update({ id: created.id, expectedRevision: 0, source: component('export const color = "blue";') }), /revision conflict/i);
  assert.equal((await store.read(created.id)).revision, 1);
  await assert.rejects(store.update({ id: created.id, expectedRevision: 1, source: component('invalid source') }), /candidate build failed/);
  assert.equal((await store.read(created.id)).revision, 1);

  const updated = await store.update({ id: created.id, expectedRevision: 1, source: component('export const color = "blue";') });
  assert.equal(updated.revision, 2);
  assert.deepEqual(validations, [component().files['component.ts'], 'invalid source', 'export const color = "blue";']);
  const reopened = new ComponentLibraryStore(root, options);
  assert.equal((await reopened.read(created.id)).source.files['component.ts'], 'export const color = "blue";');
  assert.equal(await readFile(join(root, 'components', created.id, 'revisions', '1', 'source', 'component.ts'), 'utf8'), 'export const color = "violet";');
  assert.equal(JSON.parse(await readFile(join(root, 'catalog.json'), 'utf8')).format, 'lux-component-library-catalog');
});

test('linked source applies a newer revision while a fork keeps the mounted source and removes its link', async () => {
  const first = { id: '11111111-1111-4111-8111-111111111111', revision: 1, name: 'Shared', description: 'Shared source', updatedAt: '2026-09-13T20:00:00.000Z', source: component() };
  const linked = applyLibraryComponent(scene(), [], first, 'library/shared');
  assert.equal(linked.source.files['library/shared/component.ts'], component().files['component.ts']);
  assert.equal(linked.links[0]?.resolvedRevision, 1);

  const second = { ...first, revision: 2, source: component('export const color = "blue";') };
  const notice = await checkLibraryLinks(linked.source, linked.links, async () => second);
  assert.deepEqual(notice.updates, [{ componentId: first.id, name: 'Shared', resolvedRevision: 1, availableRevision: 2 }]);
  const applied = applyLibraryComponent(linked.source, linked.links, second, 'library/shared');
  assert.equal(applied.source.files['library/shared/component.ts'], 'export const color = "blue";');
  assert.equal(applied.links[0]?.resolvedRevision, 2);

  const forked = forkLibraryComponent(applied.source, applied.links, first.id);
  assert.deepEqual(forked.links, []);
  assert.equal(forked.source.files['library/shared/component.ts'], 'export const color = "blue";');
});

test('missing library data retains the saved mounted fallback and reports it explicitly', async () => {
  const first = { id: '11111111-1111-4111-8111-111111111111', revision: 1, name: 'Shared', description: 'Shared source', updatedAt: '2026-09-13T20:00:00.000Z', source: component() };
  const linked = applyLibraryComponent(scene(), [], first, 'library/shared');
  const checked = await checkLibraryLinks(linked.source, linked.links, async () => { throw Error('Library component is missing'); });
  assert.deepEqual(checked.source, linked.source);
  assert.deepEqual(checked.fallbacks, [{ componentId: first.id, resolvedRevision: 1, message: 'Library component is missing' }]);
});

test('checking an empty library link set does not require an SDK 0.4 scene', async () => {
  const legacy = { sdkVersion: '0.1.0' as const, entry: 'visual.ts', files: { 'visual.ts': 'export default 1;' } };
  const checked = await checkLibraryLinks(legacy, [], async () => { throw Error('must not read'); });
  assert.deepEqual(checked.source, legacy);
  assert.deepEqual(checked.updates, []);
  assert.deepEqual(checked.fallbacks, []);
});

test('library reads reject an oversized profile file through the bounded file path', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-library-large-')), path = join(directory, 'component-library.json');
  await writeFile(path, Buffer.alloc(8 * 1024 * 1024 + 1, 32));
  await assert.rejects(new ComponentLibraryStore(join(directory, 'library'), { legacyPath: path }).list(), /exceeds 8 MiB/);
});

test('two profile stores share explicit additions as real source files without losing concurrent creates', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lux-standard-library-'));
  const first = new ComponentLibraryStore(root, { id: () => '11111111-1111-4111-8111-111111111111' });
  const second = new ComponentLibraryStore(root, { id: () => '22222222-2222-4222-8222-222222222222' });

  await Promise.all([
    first.create({ name: 'Violet', description: 'First reusable component.', source: component('export const color = "violet";') }),
    second.create({ name: 'Blue', description: 'Second reusable component.', source: component('export const color = "blue";') }),
  ]);

  assert.deepEqual((await first.list()).map(item => item.id).sort(), [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
  ]);
  assert.equal((await second.read('11111111-1111-4111-8111-111111111111')).source.files['component.ts'], 'export const color = "violet";');
  const paths = await filesBelow(root);
  const sources = paths.filter(path => path.endsWith('/source/component.ts'));
  assert.equal(sources.length, 2);
  assert.deepEqual((await Promise.all(sources.map(path => readFile(join(root, path), 'utf8')))).sort(), [
    'export const color = "blue";', 'export const color = "violet";',
  ]);
});

test('separate stores serialize updates so a stale revision cannot overwrite the winner', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lux-standard-library-update-'));
  const first = new ComponentLibraryStore(root, { id: () => '11111111-1111-4111-8111-111111111111' });
  const second = new ComponentLibraryStore(root);
  const created = await first.create({ name: 'Shared', description: 'Reusable.', source: component() });

  const outcomes = await Promise.allSettled([
    first.update({ id: created.id, expectedRevision: 1, source: component('export const color = "blue";') }),
    second.update({ id: created.id, expectedRevision: 1, source: component('export const color = "green";') }),
  ]);

  assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(item => item.status === 'rejected').length, 1);
  assert.match(String((outcomes.find(item => item.status === 'rejected') as PromiseRejectedResult).reason), /revision conflict/i);
  assert.equal((await first.read(created.id)).revision, 2);
});

test('legacy profile entries migrate once into the shared directory without changing IDs or revisions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-library-migration-'));
  const root = join(directory, 'library'), legacyPath = join(directory, 'profile', 'component-library.json');
  await mkdir(join(directory, 'profile'));
  await writeFile(legacyPath, JSON.stringify({ format: 'lux-component-library', version: 1,
    components: [record('11111111-1111-4111-8111-111111111111', 'export const color = "blue";', 7)] }), { flag: 'wx' });

  const store = new ComponentLibraryStore(root, { legacyPath });
  const migrated = await store.read('11111111-1111-4111-8111-111111111111');

  assert.equal(migrated.revision, 7);
  assert.equal(migrated.source.files['component.ts'], 'export const color = "blue";');
  await assert.rejects(readFile(legacyPath), /ENOENT/);
  assert.equal(JSON.parse(await readFile(`${legacyPath}.migrated`, 'utf8')).components[0].revision, 7);
});

test('a conflicting legacy migration keeps both complete sources and reports the collision', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-library-conflict-'));
  const root = join(directory, 'library'), legacyPath = join(directory, 'profile', 'component-library.json');
  await mkdir(join(directory, 'profile'));
  const store = new ComponentLibraryStore(root, { id: () => '11111111-1111-4111-8111-111111111111' });
  const created = await store.create({ name: 'Shared', description: 'Reusable.', source: component('export const color = "violet";') });
  await store.update({ id: created.id, expectedRevision: 1, source: component('export const color = "blue";') });
  await writeFile(legacyPath, JSON.stringify({ format: 'lux-component-library', version: 1,
    components: [record('11111111-1111-4111-8111-111111111111', 'export const color = "orange";')] }), { flag: 'wx' });

  await assert.rejects(new ComponentLibraryStore(root, { legacyPath }).list(), /migration conflict/i);
  assert.equal(JSON.parse(await readFile(legacyPath, 'utf8')).components[0].source.files['component.ts'], 'export const color = "orange";');
  const conflictSource = (await filesBelow(join(root, 'conflicts'))).find(path => path.endsWith('/source/component.ts'));
  assert.ok(conflictSource);
  assert.equal(await readFile(join(root, 'conflicts', conflictSource), 'utf8'), 'export const color = "orange";');
  assert.equal((await store.read('11111111-1111-4111-8111-111111111111')).source.files['component.ts'], 'export const color = "blue";');
});

test('an installed writable library imports packaged seed components without writing back to the seed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-library-seed-'));
  const seedRoot = join(directory, 'packaged-library'), fallbackRoot = join(directory, 'fallback-library'), root = join(directory, 'writable-library');
  const seeded = new ComponentLibraryStore(seedRoot, { id: () => '11111111-1111-4111-8111-111111111111' });
  await seeded.create({ name: 'Packaged', description: 'Ships with Lux.', source: component() });
  const fallback = new ComponentLibraryStore(fallbackRoot, { id: () => '22222222-2222-4222-8222-222222222222' });
  await fallback.create({ name: 'Fallback addition', description: 'Saved while the repository was unavailable.', source: component('export const color = "green";') });

  const installed = new ComponentLibraryStore(root, { seedRoots: [seedRoot, fallbackRoot] });
  assert.deepEqual((await installed.list()).map(item => item.name), ['Packaged', 'Fallback addition']);
  await installed.update({ id: '11111111-1111-4111-8111-111111111111', expectedRevision: 1, source: component('export const color = "blue";') });

  assert.equal((await seeded.read('11111111-1111-4111-8111-111111111111')).revision, 1);
  assert.equal((await fallback.read('22222222-2222-4222-8222-222222222222')).revision, 1);
  assert.equal((await installed.read('11111111-1111-4111-8111-111111111111')).revision, 2);
});

test('a fallback update fast-forwards the canonical library only through matching immutable history', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-library-fast-forward-'));
  const seedRoot = join(directory, 'packaged'), fallbackRoot = join(directory, 'fallback'), canonicalRoot = join(directory, 'canonical');
  const id = '11111111-1111-4111-8111-111111111111';
  const packaged = new ComponentLibraryStore(seedRoot, { id: () => id });
  await packaged.create({ name: 'Packaged', description: 'Ships with Lux.', source: component() });
  const fallback = new ComponentLibraryStore(fallbackRoot, { seedRoots: [seedRoot] });
  await fallback.list();
  await fallback.update({ id, expectedRevision: 1, source: component('export const color = "green";') });
  const canonical = new ComponentLibraryStore(canonicalRoot, { seedRoots: [seedRoot] });
  await canonical.list();

  const reunited = new ComponentLibraryStore(canonicalRoot, { seedRoots: [seedRoot, fallbackRoot] });
  assert.equal((await reunited.read(id)).revision, 2);
  assert.equal((await reunited.read(id)).source.files['component.ts'], 'export const color = "green";');
  assert.equal(await readFile(join(canonicalRoot, 'components', id, 'revisions', '1', 'source', 'component.ts'), 'utf8'),
    'export const color = "violet";');
});

test('a new fallback component imports its complete immutable revision history', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-library-new-history-'));
  const fallbackRoot = join(directory, 'fallback'), canonicalRoot = join(directory, 'canonical');
  const id = '22222222-2222-4222-8222-222222222222';
  const fallback = new ComponentLibraryStore(fallbackRoot, { id: () => id });
  await fallback.create({ name: 'Fallback addition', description: 'Created while offline.', source: component('export const color = "green";') });
  await fallback.update({ id, expectedRevision: 1, source: component('export const color = "orange";') });

  const canonical = new ComponentLibraryStore(canonicalRoot, { seedRoots: [fallbackRoot] });
  assert.equal((await canonical.read(id)).revision, 2);
  assert.equal(await readFile(join(canonicalRoot, 'components', id, 'revisions', '1', 'source', 'component.ts'), 'utf8'),
    'export const color = "green";');
  assert.equal(await readFile(join(canonicalRoot, 'components', id, 'revisions', '2', 'source', 'component.ts'), 'utf8'),
    'export const color = "orange";');
});

test('a higher fallback revision without matching history is preserved as a conflict', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-library-no-fast-forward-'));
  const canonicalRoot = join(directory, 'canonical'), fallbackRoot = join(directory, 'fallback'), legacyPath = join(directory, 'fallback.json');
  const id = '11111111-1111-4111-8111-111111111111';
  const canonical = new ComponentLibraryStore(canonicalRoot, { id: () => id });
  await canonical.create({ name: 'Canonical', description: 'Canonical history.', source: component() });
  await writeFile(legacyPath, JSON.stringify({ format: 'lux-component-library', version: 1,
    components: [record(id, 'export const color = "green";', 2)] }));
  await new ComponentLibraryStore(fallbackRoot, { legacyPath }).list();

  await assert.rejects(new ComponentLibraryStore(canonicalRoot, { seedRoots: [fallbackRoot] }).list(), /seed conflict/i);
  assert.equal((await canonical.read(id)).revision, 1);
  const conflictSource = (await filesBelow(join(canonicalRoot, 'conflicts'))).find(path => path.endsWith('/source/component.ts'));
  assert.ok(conflictSource);
  assert.equal(await readFile(join(canonicalRoot, 'conflicts', conflictSource), 'utf8'), 'export const color = "green";');
});

test('a persistent lock is never stolen from a live or uncertain owner', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lux-library-live-lock-'));
  const lock = join(root, '.write.lock');
  await writeFile(lock, JSON.stringify({ pid: process.pid, token: 'active-owner', createdAt: '2000-01-01T00:00:00.000Z' }));

  await assert.rejects(new ComponentLibraryStore(root, { lockWaitMs: 30 }).list(), /busy.*remove/i);
  assert.equal(JSON.parse(await readFile(lock, 'utf8')).token, 'active-owner');
  assert.ok((await stat(lock)).isFile());
});

test('parallel contenders never evict a persistent lock or enter the critical section', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lux-library-stale-lock-'));
  const lock = join(root, '.write.lock');
  await writeFile(lock, JSON.stringify({ pid: 2_147_483_647, token: 'dead-owner', createdAt: '2000-01-01T00:00:00.000Z' }));

  const outcomes = await Promise.allSettled(Array.from({ length: 64 }, () => new ComponentLibraryStore(root, { lockWaitMs: 5 }).list()));
  assert.equal(outcomes.every(result => result.status === 'rejected' && /busy.*remove/i.test(String(result.reason))), true);
  assert.equal(JSON.parse(await readFile(lock, 'utf8')).token, 'dead-owner');
  await assert.rejects(readFile(join(root, 'catalog.json')), /ENOENT/);
});

test('the repository seed exposes a useful Prismatic Ball component from an isolated copy', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-library-repository-seed-'));
  const root = join(directory, 'library');
  await cp(fileURLToPath(new URL('../../library/', import.meta.url)), root, { recursive: true });

  const store = new ComponentLibraryStore(root);
  const summaries = await store.list();
  assert.deepEqual(summaries.map(({ name, description, revision }) => ({ name, description, revision })), [{
    name: 'Prismatic Ball', description: 'Animated iridescent spike image source.', revision: 1,
  }]);
  const seeded = await store.read(summaries[0]!.id);
  assert.equal(seeded.source.entry, 'component.ts');
  assert.match(seeded.source.files['component.ts'] ?? '', /export default defineComponent/);
  assert.match(seeded.source.files['component.ts'] ?? '', /label: 'Prismatic Ball'/);
});
