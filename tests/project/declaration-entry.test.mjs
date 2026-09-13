import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateMetadata, admitProjectMetadata } from '../../packages/core/src/project/contracts.ts';
import { metadataPath, sourcePath } from '../../packages/core/src/project/metadata-paths.ts';
import { verifyDeclarationPack } from '../../packages/core/src/project/tooling.ts';
import { fixture, documents, toolchain } from './fixtures.ts';

const encode = value => new TextEncoder().encode(value);
const sha = value => createHash('sha256').update(value).digest('hex');
const entries = ['sdk/0.1.0/index.d.ts', 'sdk/0.2.0/index.d.ts'];
function lockWith(first = entries[0], second = entries[1]) {
  const lock = structuredClone(fixture().lock);
  lock.toolchain.sdkVariants['0.1.0'].declarationEntry = first;
  lock.toolchain.sdkVariants['0.2.0'].declarationEntry = second;
  return lock;
}

test('lock admission accepts both exact builder SDK entries together', async () => {
  const lock = lockWith();
  assert.deepEqual(validateMetadata('lock', lock), lock);
  const f = fixture(); f.lock = lock;
  const admitted = await admitProjectMetadata(documents(f), lock.toolchain);
  assert.deepEqual(admitted.lock.toolchain.sdkVariants, lock.toolchain.sdkVariants);
});

test('verified pack identity and exact selection flow unchanged into project admission', async () => {
  const files = Object.fromEntries(entries.map(path => [path, encode('export {};\n')]));
  const manifest = {
    format: 'lux-declaration-pack', version: 1,
    typescriptVersion: '7.0.2', threeVersion: '0.186.0', threeTypesVersion: '0.186.0',
    sdkVariants: {
      '0.1.0': { declarationEntry: entries[0], contractHash: '1'.repeat(64) },
      '0.2.0': { declarationEntry: entries[1], contractHash: '2'.repeat(64) },
    },
    packages: [],
    files: Object.entries(files).map(([path, bytes]) => ({ path, byteLength: bytes.length, sha256: sha(bytes) })),
  };
  const packHash = sha(JSON.stringify(['lux-declaration-pack', 1, manifest]));
  const pack = await verifyDeclarationPack(encode(JSON.stringify(manifest)), files, packHash);
  const selection = {
    sdkVariants: pack.manifest.sdkVariants,
    typescriptVersion: pack.manifest.typescriptVersion,
    threeVersion: pack.manifest.threeVersion,
    threeTypesVersion: pack.manifest.threeTypesVersion,
    declarationPackHash: pack.declarationPackHash,
    runtimeBuildHash: '3'.repeat(64),
  };
  const f = fixture(); f.lock.toolchain = selection;
  const admitted = await admitProjectMetadata(documents(f), selection);
  assert.deepEqual(admitted.lock.toolchain, selection);
  assert.equal(admitted.lock.toolchain.declarationPackHash, packHash);
  assert.deepEqual(Object.values(admitted.lock.toolchain.sdkVariants).map(v => v.declarationEntry), entries);
  await assert.rejects(admitProjectMetadata(documents(f), { ...selection, declarationPackHash: '4'.repeat(64) }), /toolchain/i);
});

test('historical entry grammar, including its exact length ceiling, remains accepted', async () => {
  for (const path of ['sdk/index.d.ts', 'sdk/v2.d.ts', 'INDEX.d.ts', 'some_dir/sub-dir/entry.d.mts', 'legacy', 'sdk/not-a-declaration.json', 'x'.repeat(235) + '.d.ts']) {
    assert.equal(metadataPath(path), path);
    const lock = lockWith(path, 'sdk/other.d.ts');
    assert.equal(validateMetadata('lock', lock).toolchain.sdkVariants['0.1.0'].declarationEntry, path);
  }
  const f = fixture();
  await admitProjectMetadata(documents(f), toolchain);
  // Admission does not introduce a new cross-key restriction for historical locks.
  assert.doesNotThrow(() => validateMetadata('lock', lockWith(entries[1], entries[0])));
});

test('entry exceptions do not admit arbitrary version directories or unsafe spellings', () => {
  for (const path of ['', '../index.d.ts', '/sdk/index.d.ts', 'C:/sdk/index.d.ts', 'sdk\\index.d.ts',
    'sdk/../index.d.ts', 'sdk/./index.d.ts', 'sdk//index.d.ts', 'sdk/con.d.ts', 'sdk/NUL/index.d.ts',
    '__lux.d.ts', 'sdk/a b.d.ts', 'sdk/é.d.ts', 'sdk/other.dir/index.d.ts',
    'sdk/0.3.0/index.d.ts', 'sdk/0.1/index.d.ts', 'sdk/00.1.0/index.d.ts', 'sdk/0.1.00/index.d.ts',
    'sdk/0.1.0-beta/index.d.ts', 'sdk/0.1.0/other.d.ts', 'sdk/0.1.0/index.d.mts',
    'SDK/0.1.0/index.d.ts', 'sdk/0.1.0/INDEX.d.ts', 'sdk/0.2.0/index.d.ts/extra',
    'prefix/sdk/0.1.0/index.d.ts', 'sdk/0.1.0/index.d.ts ', 'x'.repeat(236) + '.d.ts']) {
    assert.throws(() => validateMetadata('lock', lockWith(path, 'sdk/other.d.ts')), undefined, path);
  }
});

test('duplicates and case collisions remain rejected without general path revalidation', () => {
  for (const [first, second] of [[entries[0], entries[0]], [entries[1], entries[1]],
    ['sdk/index.d.ts', 'sdk/index.d.ts'], ['sdk/index.d.ts', 'SDK/INDEX.d.ts']]) {
    assert.throws(() => validateMetadata('lock', lockWith(first, second)), /Duplicate or case-colliding/);
  }
});

test('new declaration entries remain forbidden in generic metadata and source paths', () => {
  for (const entry of entries) {
    assert.throws(() => metadataPath(entry), /Invalid metadata path/);
    assert.throws(() => sourcePath(entry), /Invalid metadata path/);
    const f = fixture();
    f.pkg.files = { [entry]: 'a'.repeat(64) };
    assert.throws(() => validateMetadata('package', f.pkg), /Invalid metadata path/);
    f.components[0].entry = entry; f.components[0].files = [entry];
    assert.throws(() => validateMetadata('component', f.components[0]), /Invalid metadata path/);
  }
});

test('lock field, version, key and hash guards remain intact for exact entries', () => {
  const changes = [
    lock => { lock.schemaVersion = 2; },
    lock => { lock.extra = true; },
    lock => { lock.toolchain.extra = true; },
    lock => { lock.toolchain.sdkVariants['0.3.0'] = lock.toolchain.sdkVariants['0.1.0']; },
    lock => { lock.toolchain.sdkVariants = {}; },
    lock => { lock.toolchain.sdkVariants['0.1.0'].extra = true; },
    lock => { lock.toolchain.sdkVariants['0.1.0'].contractHash = 'x'.repeat(64); },
    lock => { lock.toolchain.declarationPackHash = 'A'.repeat(64); },
    lock => { lock.toolchain.runtimeBuildHash = 'short'; },
    lock => { lock.toolchain.typescriptVersion = 'latest'; },
  ];
  for (const change of changes) { const lock = lockWith(); change(lock); assert.throws(() => validateMetadata('lock', lock)); }
});
