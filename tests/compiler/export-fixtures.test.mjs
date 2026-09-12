import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compileVisual } from '../../apps/build-worker/src/compile.mjs';
import { linkRuntime } from '../../apps/build-worker/src/link-runtime.mjs';
import { SceneFileStore } from '../../packages/core/src/scene-file.ts';

test('two installed QA fixtures compile distinct self-contained visuals; missing helper fails', { timeout: 120000 }, async () => {
  const dependencyRoot = await realpath(fileURLToPath(new URL('../../node_modules', import.meta.url)));
  const hashes = new Set();
  for (const name of ['triangle', 'ring']) {
    const directory = new URL(`../fixtures/installed-sources/${name}/`, import.meta.url);
    const document = JSON.parse(await readFile(new URL('scene.lux-scene', directory), 'utf8'));
    const opened = await new SceneFileStore().open(fileURLToPath(new URL('scene.lux-scene', directory)));
    assert.deepEqual(opened.document, document);
    const compiled = await compileVisual({ source: document.source }, { dependencyRoot });
    assert.equal(compiled.ok, true, JSON.stringify(compiled));
    const linked = await linkRuntime(compiled.artifact, { dependencyRoot });
    assert.ok(linked.code.length > 0);
    hashes.add(compiled.artifact.sourceHash);
    const broken = structuredClone(document.source);
    delete broken.files['palette.ts'];
    const rejected = await compileVisual({ source: broken }, { dependencyRoot });
    assert.equal(rejected.ok, false, 'a required source dependency must not silently disappear');
    assert.ok(rejected.diagnostics.some(d => /palette|resolve|module/i.test(d.message)), JSON.stringify(rejected));
  }
  assert.equal(hashes.size, 2, 'the pair must represent different source implementations');
});
