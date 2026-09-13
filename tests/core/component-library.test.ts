import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('library writes are atomic, revision guarded, validated before activation, and persist across store restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-library-'));
  const path = join(directory, 'component-library.json');
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
  const store = new ComponentLibraryStore(path, options);
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
  const reopened = new ComponentLibraryStore(path, options);
  assert.equal((await reopened.read(created.id)).source.files['component.ts'], 'export const color = "blue";');
  assert.equal(JSON.parse(await readFile(path, 'utf8')).format, 'lux-component-library');
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
