import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolveLibraryComponent,
  type LibraryComponent,
  type LibraryDependency,
} from '../../packages/core/src/component-library.ts';
import { ComponentLibraryStore } from '../../packages/core/src/component-library-store.ts';
import type { SourceBundle } from '../../packages/runtime-contracts/src/index.ts';

const ids = Array.from({ length: 12 }, (_, index) =>
  `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`);

function source(body: string, extra: Record<string, string> = {}): SourceBundle {
  return { sdkVersion: '0.4.0', entry: 'component.ts', files: { 'component.ts': body, ...extra } };
}

function component(index: number, body: string, dependencies?: readonly LibraryDependency[]): LibraryComponent {
  return {
    id: ids[index]!, revision: 1, name: `Component ${index}`, description: 'Dependency test.',
    updatedAt: '2026-09-16T12:00:00.000Z', source: source(body), ...(dependencies?.length ? { dependencies } : {}),
  };
}

test('the store keeps authored source separate while exact reads and resolution use pinned immutable revisions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lux-library-dependencies-'));
  const issued = [ids[0]!, ids[1]!];
  const validations: SourceBundle[] = [];
  const store = new ComponentLibraryStore(root, {
    id: () => issued.shift()!,
    now: () => '2026-09-16T12:00:00.000Z',
    validateCandidate: async candidate => { validations.push(candidate); },
  });
  const generatorV1 = await store.create({
    name: 'Generator', description: 'Independent generator.', source: source('export const generator = 1;'),
  });
  await store.update({
    id: generatorV1.id, expectedRevision: 1, source: source('export const generator = 2;'),
  });
  const dependency = { componentId: generatorV1.id, revision: 1, mountPath: 'dependencies/generator' } as const;
  const wrapper = await store.create({
    name: 'Renderer', description: 'Independent renderer.',
    source: source('import { generator } from "./dependencies/generator/component.ts"; export default generator;'),
    dependencies: [dependency],
  });

  assert.equal((await store.read(generatorV1.id)).revision, 2);
  assert.equal((await store.read(generatorV1.id, 1)).source.files['component.ts'], 'export const generator = 1;');
  assert.deepEqual(wrapper.dependencies, [dependency]);
  assert.deepEqual(Object.keys(wrapper.source.files), ['component.ts']);
  assert.equal(validations.at(-1)?.files['dependencies/generator/component.ts'], 'export const generator = 1;');

  const raw = await store.read(wrapper.id);
  assert.deepEqual(Object.keys(raw.source.files), ['component.ts']);
  const manifest = JSON.parse(await readFile(join(root, 'components', wrapper.id, 'revisions', '1', 'component.json'), 'utf8'));
  assert.deepEqual(manifest.dependencies, [dependency]);
  const resolved = await resolveLibraryComponent(raw, (id, revision) => store.read(id, revision));
  assert.equal(resolved.source.files['dependencies/generator/component.ts'], 'export const generator = 1;');
  assert.equal(Object.hasOwn(resolved, 'dependencies'), false);
});

test('a wrapper adopts a newer dependency only through an explicit wrapper revision', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lux-library-pins-'));
  const issued = [ids[0]!, ids[1]!];
  const store = new ComponentLibraryStore(root, { id: () => issued.shift()! });
  const dependency = await store.create({ name: 'Generator', description: 'Independent generator.', source: source('export const value = 1;') });
  const wrapper = await store.create({ name: 'Renderer', description: 'Independent renderer.', source: source('export default 1;'),
    dependencies: [{ componentId: dependency.id, revision: 1, mountPath: 'generator' }] });
  await store.update({ id: dependency.id, expectedRevision: 1, source: source('export const value = 2;') });

  const editedWrapper = await store.update({ id: wrapper.id, expectedRevision: 1, source: source('export default 2;') });
  const stillPinned = await resolveLibraryComponent(editedWrapper, (id, revision) => store.read(id, revision));
  assert.equal(stillPinned.source.files['generator/component.ts'], 'export const value = 1;');
  const updatedWrapper = await store.update({ id: wrapper.id, expectedRevision: 2,
    dependencies: [{ componentId: dependency.id, revision: 2, mountPath: 'generator' }] });
  const advanced = await resolveLibraryComponent(updatedWrapper, (id, revision) => store.read(id, revision));
  assert.equal(advanced.source.files['generator/component.ts'], 'export const value = 2;');
});

test('resolution rejects dependency cycles and mismatched pinned identities', async () => {
  const a = component(0, 'export default 1;', [{ componentId: ids[1]!, revision: 1, mountPath: 'b' }]);
  const b = component(1, 'export default 2;', [{ componentId: ids[0]!, revision: 1, mountPath: 'a' }]);
  const byId = new Map([[a.id, a], [b.id, b]]);
  await assert.rejects(resolveLibraryComponent(a, async id => byId.get(id)!), /cycle/i);
  await assert.rejects(resolveLibraryComponent(a, async () => { throw Error('Library component is missing'); }), /missing/i);
  await assert.rejects(resolveLibraryComponent(a, async () => component(2, 'export default 3;')), /identity|match/i);
  await assert.rejects(resolveLibraryComponent(a, async () => ({ ...b, revision: 2 })), /revision|match/i);
});

test('resolution recursively mounts each dependency beneath its requested relative path', async () => {
  const leaf = component(2, 'export const generated = 3;');
  const middle = component(1, 'export { generated } from "./generator/component.ts";', [
    { componentId: leaf.id, revision: 1, mountPath: 'generator' },
  ]);
  const wrapper = component(0, 'export { generated } from "./renderer/generator/component.ts";', [
    { componentId: middle.id, revision: 1, mountPath: 'renderer' },
  ]);
  const byId = new Map([[leaf.id, leaf], [middle.id, middle]]);

  const resolved = await resolveLibraryComponent(wrapper, async id => byId.get(id)!);

  assert.equal(resolved.source.files['renderer/component.ts'], middle.source.files['component.ts']);
  assert.equal(resolved.source.files['renderer/generator/component.ts'], leaf.source.files['component.ts']);
  assert.equal(Object.hasOwn(resolved, 'dependencies'), false);
});

test('resolution rejects overlapping mounts, authored-file collisions, and expanded source quota violations', async () => {
  const leaf = component(2, 'export default 3;');
  const overlapping = component(0, 'export default 1;', [
    { componentId: ids[1]!, revision: 1, mountPath: 'shared' },
    { componentId: ids[2]!, revision: 1, mountPath: 'shared/nested' },
  ]);
  await assert.rejects(resolveLibraryComponent(overlapping, async id => id === ids[1] ? component(1, 'export default 2;') : leaf), /overlap|conflict/i);

  const localCollision = { ...component(0, 'export default 1;', [{ componentId: leaf.id, revision: 1, mountPath: 'shared' }]),
    source: source('export default 1;', { 'shared/owned.ts': 'export const owned = true;' }) };
  await assert.rejects(resolveLibraryComponent(localCollision, async () => leaf), /conflict/i);

  const extraFiles = Object.fromEntries(Array.from({ length: 31 }, (_, index) => [`part-${index}.ts`, 'export {};']));
  const largeLeaf = { ...leaf, source: source('export default 3;', extraFiles) };
  const overFiles = component(0, 'export default 1;', [{ componentId: leaf.id, revision: 1, mountPath: 'shared' }]);
  await assert.rejects(resolveLibraryComponent(overFiles, async () => largeLeaf), /32 source files|quota/i);
});

test('resolution accepts more than eight sibling dependencies within source quotas', async () => {
  const leaves = Array.from({ length: 11 }, (_, index) => component(index + 1, `export default ${index + 1};`));
  const root = component(0, 'export default 0;', leaves.map((leaf, index) => ({ componentId: leaf.id, revision: 1, mountPath: `child-${index}` })));
  const resolved = await resolveLibraryComponent(root, async id => leaves.find(item => item.id === id)!);
  assert.equal(Object.keys(resolved.source.files).length, 12);
});

test('resolution retains the eight-level dependency nesting limit', async () => {
  const chain = Array.from({ length: 9 }, (_, index) => component(index, `export default ${index};`, index < 8
    ? [{ componentId: ids[index + 1]!, revision: 1, mountPath: `child-${index}` }]
    : undefined));
  await assert.rejects(resolveLibraryComponent(chain[0]!, async id => chain.find(item => item.id === id)!), /depth limit/i);
});

test('failed expanded validation leaves the existing catalog revision active', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lux-library-dependency-validation-'));
  const issued = [ids[0]!, ids[1]!, ids[2]!];
  const store = new ComponentLibraryStore(root, {
    id: () => issued.shift()!,
    validateCandidate: async candidate => {
      if (Object.keys(candidate.files).some(path => path.startsWith('rejected/'))) throw Error('expanded candidate rejected');
    },
  });
  const dependency = await store.create({ name: 'Generator', description: 'Independent generator.', source: source('export default 1;') });
  const wrapper = await store.create({ name: 'Renderer', description: 'Independent renderer.', source: source('export default 2;') });

  await assert.rejects(store.create({ name: 'Rejected', description: 'Must not enter the catalog.', source: source('export default 3;'),
    dependencies: [{ componentId: dependency.id, revision: 1, mountPath: 'rejected/dependency' }] }), /expanded candidate rejected/);
  assert.deepEqual((await store.list()).map(item => item.id), [dependency.id, wrapper.id]);
  await assert.rejects(store.update({ id: wrapper.id, expectedRevision: 1,
    dependencies: [{ componentId: dependency.id, revision: 1, mountPath: 'rejected/dependency' }] }), /expanded candidate rejected/);
  assert.equal((await store.read(wrapper.id)).revision, 1);
  assert.equal(Object.hasOwn(await store.read(wrapper.id), 'dependencies'), false);
  assert.equal(JSON.parse(await readFile(join(root, 'catalog.json'), 'utf8')).components.find((row: { id: string }) => row.id === wrapper.id).revision, 1);
});

test('an equal seed head backfills immutable revisions missing from a migrated target', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-library-history-backfill-'));
  const seedRoot = join(directory, 'seed'), targetRoot = join(directory, 'target'), legacyPath = join(directory, 'legacy.json');
  const seed = new ComponentLibraryStore(seedRoot, { id: () => ids[0]!, now: () => '2026-09-16T12:00:00.000Z' });
  const first = await seed.create({ name: 'Generator', description: 'Independent generator.', source: source('export const value = 1;') });
  const latest = await seed.update({ id: first.id, expectedRevision: 1, source: source('export const value = 2;') });
  await writeFile(legacyPath, JSON.stringify({ format: 'lux-component-library', version: 1, components: [latest] }));
  await new ComponentLibraryStore(targetRoot, { legacyPath }).list();

  const reunited = new ComponentLibraryStore(targetRoot, { seedRoots: [seedRoot] });
  assert.equal((await reunited.read(first.id)).revision, 2);
  assert.equal((await reunited.read(first.id, 1)).source.files['component.ts'], 'export const value = 1;');
});

test('a seed fast-forward backfills history older than the target head', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-library-fast-forward-backfill-'));
  const seedRoot = join(directory, 'seed'), targetRoot = join(directory, 'target'), legacyPath = join(directory, 'legacy.json');
  const seed = new ComponentLibraryStore(seedRoot, { id: () => ids[0]!, now: () => '2026-09-16T12:00:00.000Z' });
  const first = await seed.create({ name: 'Generator', description: 'Independent generator.', source: source('export const value = 1;') });
  const second = await seed.update({ id: first.id, expectedRevision: 1, source: source('export const value = 2;') });
  await seed.update({ id: first.id, expectedRevision: 2, source: source('export const value = 3;') });
  await writeFile(legacyPath, JSON.stringify({ format: 'lux-component-library', version: 1, components: [second] }));
  await new ComponentLibraryStore(targetRoot, { legacyPath }).list();

  const reunited = new ComponentLibraryStore(targetRoot, { seedRoots: [seedRoot] });
  assert.equal((await reunited.read(first.id, 1)).source.files['component.ts'], 'export const value = 1;');
  assert.equal((await reunited.read(first.id)).revision, 3);
});

test('equal seed heads never overwrite conflicting immutable history', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-library-history-conflict-'));
  const seedRoot = join(directory, 'seed'), targetRoot = join(directory, 'target');
  const options = { id: () => ids[0]!, now: () => '2026-09-16T12:00:00.000Z' };
  const seed = new ComponentLibraryStore(seedRoot, options);
  const seedFirst = await seed.create({ name: 'Generator', description: 'Independent generator.', source: source('export const value = 1;') });
  await seed.update({ id: seedFirst.id, expectedRevision: 1, source: source('export const value = 2;') });
  const target = new ComponentLibraryStore(targetRoot, options);
  const targetFirst = await target.create({ name: 'Generator', description: 'Independent generator.', source: source('export const value = 99;') });
  await target.update({ id: targetFirst.id, expectedRevision: 1, source: source('export const value = 2;') });

  await assert.rejects(new ComponentLibraryStore(targetRoot, { seedRoots: [seedRoot] }).list(), /seed history conflict/i);

  assert.equal((await target.read(targetFirst.id, 1)).source.files['component.ts'], 'export const value = 99;');
  const conflicts = await readdir(join(targetRoot, 'conflicts', targetFirst.id));
  assert.equal(await readFile(join(targetRoot, 'conflicts', targetFirst.id, conflicts[0]!, 'source', 'component.ts'), 'utf8'),
    'export const value = 1;');
});
