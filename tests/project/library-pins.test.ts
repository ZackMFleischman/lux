import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPackageBytes } from '../../packages/core/src/project/library.ts';
import { packageFixture, hash, pinFor } from './resolver-fixtures.ts';
import { projectLimits, metadataLimits } from '../../packages/core/src/project/contracts.ts';

test('verifies exact original bytes and returns detached hashes', async () => {
  const p = packageFixture();
  assert.deepEqual(p.pin, { version: '1.2.3', manifestHash: '6249a3334986aac809139e5d584b6169211fc33ed28b3579207e41eaeb082950', contentHash: '823529bfa4dcec07ddd5ae7e369d87a28631813d6aa6f5ff47ecd115c36999aa' });
  const result = await verifyPackageBytes(p.manifest, p.pin, p.files);
  assert.equal(result.packageId, 'demo/pattern');
  assert.deepEqual(result.pin, p.pin);
  assert.equal(result.fileHashes['LICENSE.txt'], hash(p.files['LICENSE.txt']!));
  assert.equal(result.byteLength, Object.values(p.files).reduce((n, b) => n + b.length, 0));
  assert.ok(Object.isFrozen(result.fileHashes));
});
test('rejects changed, missing and extra originals and wrong exact pins', async () => {
  for (const kind of ['changed', 'missing', 'extra', 'version', 'hash']) {
    const p = packageFixture();
    if (kind === 'changed') p.files['LICENSE.txt']![0] = p.files['LICENSE.txt']![0]! ^ 1;
    if (kind === 'missing') delete p.files['LICENSE.txt'];
    if (kind === 'extra') p.files['extra.txt'] = new Uint8Array();
    if (kind === 'version') p.pin.version = '1.2.4';
    if (kind === 'hash') p.pin.contentHash = '0'.repeat(64);
    await assert.rejects(verifyPackageBytes(p.manifest, p.pin, p.files), { code: kind === 'missing' ? 'DEPENDENCY_UNAVAILABLE' : 'PACKAGE_MODIFIED' });
  }
});
test('captures originals and metadata before the first digest', async () => {
  const p = packageFixture(), expected = pinFor(p.manifest);
  const pending = verifyPackageBytes(p.manifest, p.pin, p.files);
  p.files['LICENSE.txt']!.fill(0); p.manifest.version = '9.9.9'; p.pin.version = '9.9.9';
  assert.deepEqual((await pending).pin, expected);
});
test('preflights exact 32 MiB original ceiling, independent of project factory', async () => {
  const p = packageFixture(); p.files['src/main.ts'] = new Uint8Array(); p.files['src/helper.ts'] = new Uint8Array();
  p.files['LICENSE.txt'] = new Uint8Array(projectLimits.packageBytes);
  p.manifest.files = Object.fromEntries(Object.entries(p.files).map(([k, b]) => [k, hash(b)])); p.pin = pinFor(p.manifest);
  assert.equal((await verifyPackageBytes(p.manifest, p.pin, p.files)).byteLength, projectLimits.packageBytes);
  p.files['LICENSE.txt'] = new Uint8Array(projectLimits.packageBytes + 1);
  await assert.rejects(verifyPackageBytes(p.manifest, p.pin, p.files), { code: 'QUOTA_EXCEEDED' });
});
test('rejects oversized zero-length inventory and accessors without invoking them', async () => {
  const p = packageFixture(); let getters = 0;
  const extra = Object.fromEntries(Array.from({ length: metadataLimits.nodes + 1 }, (_, i) => [`f${i}`, new Uint8Array()]));
  await assert.rejects(verifyPackageBytes(p.manifest, p.pin, extra), { code: 'QUOTA_EXCEEDED' });
  const files = { ...p.files }; Object.defineProperty(files, 'LICENSE.txt', { enumerable: true, get() { getters++; return p.files['LICENSE.txt']; } });
  await assert.rejects(verifyPackageBytes(p.manifest, p.pin, files));
  const pin = { ...p.pin }; Object.defineProperty(pin, 'version', { enumerable: true, get() { getters++; return '1.2.3'; } });
  await assert.rejects(verifyPackageBytes(p.manifest, pin, p.files));
  assert.equal(getters, 0);
});
test('uses intrinsic lengths and refuses shared storage before any digest', async () => {
  const p = packageFixture(); let calls = 0;
  Object.defineProperty(p.files['LICENSE.txt'], 'byteLength', { get() { calls++; return 0; } });
  Object.defineProperty(p.files['LICENSE.txt'], 'buffer', { get() { calls++; throw Error('do not call'); } });
  assert.equal((await verifyPackageBytes(p.manifest, p.pin, p.files)).pin.contentHash, p.pin.contentHash);
  assert.equal(calls, 0);
  p.files['LICENSE.txt'] = new Uint8Array(new SharedArrayBuffer(8));
  await assert.rejects(verifyPackageBytes(p.manifest, p.pin, p.files));
});
test('literal original hash golden and newline identity are independent of helper', async () => {
  assert.equal(hash('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const p = packageFixture(); p.files['LICENSE.txt'] = new TextEncoder().encode('abc');
  p.manifest.files['LICENSE.txt'] = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'; p.pin = pinFor(p.manifest);
  assert.equal((await verifyPackageBytes(p.manifest, p.pin, p.files)).fileHashes['LICENSE.txt'], p.manifest.files['LICENSE.txt']);
  p.files['LICENSE.txt'] = new TextEncoder().encode('abc\r\n');
  await assert.rejects(verifyPackageBytes(p.manifest, p.pin, p.files), { code: 'PACKAGE_MODIFIED' });
});
test('rejected direct preflights perform no payload copy or digest', async (t) => {
  const p = packageFixture(), originalSet = Uint8Array.prototype.set, originalDigest = crypto.subtle.digest;
  let copies = 0, digests = 0;
  const payloads = new Set<unknown>(Object.values(p.files));
  t.mock.method(Uint8Array.prototype, 'set', function(this: Uint8Array, source: ArrayLike<number>, offset?: number) { if (payloads.has(source)) copies++; return originalSet.call(this, source, offset); });
  t.mock.method(crypto.subtle, 'digest', function(this: SubtleCrypto, algorithm: AlgorithmIdentifier, source: BufferSource) { digests++; return originalDigest.call(this, algorithm, source); });
  const oversized = { ...p.files, 'LICENSE.txt': new Uint8Array(33554433) };
  payloads.add(oversized['LICENSE.txt']);
  await assert.rejects(verifyPackageBytes(p.manifest, p.pin, oversized), { code: 'QUOTA_EXCEEDED' });
  const missing = { ...p.files }; delete missing['LICENSE.txt']; await assert.rejects(verifyPackageBytes(p.manifest, p.pin, missing));
  const shared = new Uint8Array(new SharedArrayBuffer(10)); payloads.add(shared);
  await assert.rejects(verifyPackageBytes(p.manifest, p.pin, { ...p.files, 'LICENSE.txt': shared }));
  assert.equal(copies, 0); assert.equal(digests, 0);
});
test('detached content and malformed version types return structured rejection', async () => {
  const p = packageFixture(), view = new Uint8Array(8); structuredClone(view.buffer, { transfer: [view.buffer] });
  await assert.rejects(verifyPackageBytes(p.manifest, p.pin, { ...p.files, 'LICENSE.txt': view }), { code: 'PROJECT_INVALID' });
  await assert.rejects(verifyPackageBytes(p.manifest, { ...p.pin, version: null } as unknown as typeof p.pin, p.files), { code: 'PROJECT_INVALID' });
});
