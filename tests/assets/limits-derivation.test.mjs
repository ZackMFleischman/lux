import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import jpeg from 'jpeg-js';
import { encode as encodePng } from 'fast-png';
import { assetLimits, assetJsonBytes } from '../../packages/assets/src/limits.mjs';
import { limits, validateSource } from '../../apps/build-worker/src/source-policy.mjs';
import { storyLifecycleLimits } from '../../packages/runtime-contracts/src/story.mjs';
import { derivedAssetSchema } from '../../packages/runtime-contracts/src/index.ts';
import { agentTransportLimits, studioCompileLimits } from '../../apps/studio/src/source/agent-contract.ts';

const MiB = 1048576, v8MaxStringLength = 2 ** 29 - 24;

test('scene, transport and agent budgets derive from the asset limits', () => {
  assert.deepEqual({ ...assetLimits }, { count: 64, imageBytes: 32 * MiB, totalBytes: 128 * MiB, rgbaBytes: 512 * MiB, dimension: 8192, pathCharacters: 240 });
  assert.equal(assetJsonBytes, Math.ceil(assetLimits.totalBytes / 3) * 4 + assetLimits.count * 1024);
  // story.mjs is embedded in compiled visuals and cannot import these values.
  assert.equal(storyLifecycleLimits.linkedEnvelopeBytes, assetJsonBytes + 16 * MiB);
  assert.equal(limits.linkedBytes, storyLifecycleLimits.linkedEnvelopeBytes);
  assert.equal(limits.outputBytes, limits.linkedBytes);
  assert.equal(storyLifecycleLimits.aggregateLinkedEnvelopeBytes, storyLifecycleLimits.sceneBytes + 32 * MiB);
  assert.equal(storyLifecycleLimits.assetStagingPerClient, assetLimits.totalBytes + assetLimits.rgbaBytes);
  assert.equal(storyLifecycleLimits.assetBackingPerGeneration, storyLifecycleLimits.slotsPerGeneration * storyLifecycleLimits.assetStagingPerClient);
  assert.equal(storyLifecycleLimits.assetBackingPerClient, storyLifecycleLimits.generationsPerClient * storyLifecycleLimits.assetBackingPerGeneration);
  assert.ok(limits.sceneJsonBytes > limits.sourceJsonBytes && limits.sceneFileBytes > limits.sceneJsonBytes);
  // The CommonJS transport reader ships inside exported packages with a literal.
  const { maxReleaseBytes } = createRequire(import.meta.url)('../../tools/gpu-spike/transport-release.cjs');
  assert.equal(maxReleaseBytes, limits.linkedBytes + 4 * MiB);
  // Contract schema (embedded in compiler workspaces) states the dimension literally.
  const row = { mediaType: 'image/png', encoding: 'base64', data: 'AA==', byteLength: 1, sha256: 'a'.repeat(64), height: 1 };
  assert.equal(derivedAssetSchema.safeParse({ ...row, width: assetLimits.dimension }).success, true);
  assert.equal(derivedAssetSchema.safeParse({ ...row, width: assetLimits.dimension + 1 }).success, false);
  // Every document that carries base64 originals must remain one V8 string.
  for (const bytes of [limits.requestBytes, limits.sceneFileBytes, storyLifecycleLimits.sceneBytes, limits.sharedRequestBytes,
    agentTransportLimits.requestBytes, agentTransportLimits.responseBytes, agentTransportLimits.readToolResultBytes,
    studioCompileLimits.storyResultBytes]) assert.ok(bytes < v8MaxStringLength, `${bytes} exceeds a V8 string`);
  assert.ok(agentTransportLimits.operationMs > studioCompileLimits.deadlineMs);
  assert.ok(studioCompileLimits.deadlineMs >= limits.compileMs + limits.linkMs);
});

// Independent BMP writer: opaque 24-bit, bottom-up.
function bmp(width, height) {
  const stride = Math.ceil(width * 3 / 4) * 4, bytes = Buffer.alloc(54 + stride * height, 90);
  bytes.write('BM'); bytes.writeUInt32LE(bytes.length, 2); bytes.writeUInt32LE(0, 6);
  bytes.writeUInt32LE(54, 10); bytes.writeUInt32LE(40, 14); bytes.writeInt32LE(width, 18); bytes.writeInt32LE(height, 22);
  bytes.writeUInt16LE(1, 26); bytes.writeUInt16LE(24, 28); bytes.fill(0, 30, 54);
  return bytes;
}
const record = (mediaType, bytes) => ({ mediaType, encoding: 'base64', data: Buffer.from(bytes).toString('base64') });

test('a painted-plate bundle near the new limits validates; one more image or byte rejects', () => {
  // Two plate-sized JPEGs (2752x1536, like painted background plates), one maximum-width PNG texture,
  // large BMPs filling the 128 MiB aggregate, and tiny images up to the 64-image count.
  const plate = (seed) => {
    const width = 2752, height = 1536, data = Buffer.alloc(width * height * 4);
    for (let i = 0; i < data.length; i += 4) { const x = (i / 4) % width, y = Math.floor(i / 4 / width); data[i] = (x + seed) & 255; data[i + 1] = (y * 3) & 255; data[i + 2] = (x ^ y) & 255; data[i + 3] = 255; }
    return jpeg.encode({ width, height, data }, 92).data;
  };
  const strip = encodePng({ width: assetLimits.dimension, height: 4, channels: 4, depth: 8, data: new Uint8Array(assetLimits.dimension * 16).fill(200) });
  // jpeg-js may leave nonstandard entropy padding that strict admission rejects; this content encodes cleanly.
  const painted = record('image/jpeg', plate(0));
  const assets = { 'assets/plates/intro.jpg': painted, 'assets/plates/verse.jpg': painted, 'assets/textures/strip.png': record('image/png', strip) };
  const original = path => Buffer.from(assets[path].data, 'base64').length;
  let total = Object.keys(assets).reduce((sum, path) => sum + original(path), 0);
  const tiny = bmp(2, 2), tinyCount = assetLimits.count - Object.keys(assets).length - 4;
  // Four large BMPs fill the remainder, each below the 32 MiB per-image limit.
  const remaining = assetLimits.totalBytes - total - tinyCount * tiny.length - 4096, width = 4096;
  const height = Math.floor((remaining / 4 - 54) / (width * 3));
  for (let i = 0; i < 4; i++) { const image = bmp(width, height); assert.ok(image.length <= assetLimits.imageBytes); assets[`assets/fill/large${i}.bmp`] = record('image/bmp', image); total += image.length; }
  for (let i = 0; i < tinyCount; i++) { assets[`assets/fill/tiny${i}.bmp`] = record('image/bmp', tiny); total += tiny.length; }
  assert.equal(Object.keys(assets).length, assetLimits.count);
  assert.ok(total <= assetLimits.totalBytes && total > assetLimits.totalBytes - 2 * MiB, `${total} originals should sit just below the aggregate`);

  const source = { sourceVersion: 2, sdkVersion: '0.2.0', entry: 'visual.ts', files: { 'visual.ts': 'export {};' }, assets };
  const admitted = validateSource(source);
  assert.equal(Object.keys(admitted.assets).length, assetLimits.count);
  assert.ok(Buffer.byteLength(JSON.stringify(admitted)) <= limits.sourceJsonBytes);

  assert.throws(() => validateSource({ ...source, assets: { ...assets, 'assets/extra.bmp': record('image/bmp', tiny) } }), { code: 'QUOTA_EXCEEDED' });
  // Grow one tiny image just past the aggregate gap; it stays far below the per-image limit.
  const overflow = bmp(1024, Math.ceil((assetLimits.totalBytes - total + tiny.length + 1) / 3072));
  assert.ok(overflow.length < assetLimits.imageBytes);
  assert.throws(() => validateSource({ ...source, assets: { ...assets, 'assets/fill/tiny0.bmp': record('image/bmp', overflow) } }),
    error => error.code === 'QUOTA_EXCEEDED' && /Aggregate asset/.test(error.message));
});
