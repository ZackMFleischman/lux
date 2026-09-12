import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compileVisual } from '../../apps/build-worker/src/compile.mjs';
import { linkRuntime } from '../../apps/build-worker/src/link-runtime.mjs';
import { SceneFileStore } from '../../packages/core/src/scene-file.ts';

test('required image fixture compiles real SDK/Three imports and links the exact asset bytes', { timeout: 120000 }, async () => {
  const path = fileURLToPath(new URL('../fixtures/installed-sources/required-image/scene.lux-scene', import.meta.url));
  const original = JSON.parse(await readFile(path, 'utf8'));
  const { document } = await new SceneFileStore().open(path);
  assert.deepEqual(document, original);
  const dependencyRoot = await realpath(fileURLToPath(new URL('../../node_modules', import.meta.url)));
  const result = await compileVisual({ source: document.source }, { dependencyRoot });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.artifact.artifactVersion, 2);
  const linked = await linkRuntime(result.artifact, { dependencyRoot });
  assert.equal(linked.linkedVersion, 2);
  assert.equal(linked.assets['assets/checker.bmp'].data, original.source.assets['assets/checker.bmp'].data);
  assert.equal(linked.assets['assets/checker.bmp'].width, 3);
  assert.equal(linked.assets['assets/checker.bmp'].height, 2);
  assert.equal(linked.assetSetHash, result.artifact.assetSetHash);
  // This proves real source and byte closure; native pixel evidence is separate.
});
