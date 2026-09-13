import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compileVisual } from '../../apps/build-worker/src/compile.mjs';

test('shipped examples retain canonical imports and compile against their declared SDK versions', async () => {
  const dependencyRoot = process.env.LUX_COMPILER_DEPENDENCIES || resolve('node_modules');
  for (const [name, sdkVersion] of [['intensity', '0.1.0'], ['parameters', '0.2.0']]) {
    const code = await readFile(new URL(`../../packages/visual-sdk/examples/${name}.ts`, import.meta.url), 'utf8');
    assert.match(code, /from '@lux\/visual-sdk'/);
    const result = await compileVisual({ source: { sdkVersion, entry: 'visual.ts', files: { 'visual.ts': code } } }, { dependencyRoot });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.artifact.sdkVersion, sdkVersion);
    if (sdkVersion === '0.2.0') {
      assert.deepEqual(result.artifact.controls.map(control => control.id), ['brightness', 'speed']);
      const legacy = await compileVisual({ source: { sdkVersion: '0.1.0', entry: 'visual.ts', files: { 'visual.ts': code } } }, { dependencyRoot });
      assert.equal(legacy.ok, false, 'SDK 0.1 must retain its distinct legacy contract');
    }
  }
});
