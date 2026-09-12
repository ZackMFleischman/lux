import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { compileVisual } from '../../apps/build-worker/src/compile.mjs';
import { linkRuntime } from '../../apps/build-worker/src/link-runtime.mjs';

const dependencyRoot = process.env.LUX_COMPILER_DEPENDENCIES || resolve('node_modules');
let artifact;
before(async () => {
  const source = await readFile(new URL('../../packages/visual-sdk/examples/intensity.ts', import.meta.url), 'utf8');
  const result = await compileVisual({ source: { sdkVersion: '0.1.0', entry: 'main.ts', files: {
    'main.ts': `import { helperStart } from './lib/color.ts';\n${source.replace('uniform(0.5)', 'uniform(helperStart)')}`,
    'lib/color.ts': 'export const helperStart = 0.375;',
  } } }, { dependencyRoot });
  assert.equal(result.ok, true, JSON.stringify(result)); artifact = result.artifact;
});
function forge(change) {
  const { bundleHash, ...body } = structuredClone(artifact);
  change(body);
  return { ...body, bundleHash: createHash('sha256').update(JSON.stringify(body)).digest('hex') };
}
test('real compiled example links into deterministic worker ESM without mutating original artifact', async () => {
  const before = JSON.stringify(artifact);
  const first = await linkRuntime(artifact, { dependencyRoot });
  assert.equal(first.bundleHash, artifact.bundleHash);
  assert.match(first.code, /WebGPURenderer/);
  assert.match(first.code, /as default/);
  assert.ok(first.sourceMap.length > 0);
  assert.equal(first.linkedHash.length, 64);
  const second = await linkRuntime(artifact, { dependencyRoot });
  assert.equal(second.linkedHash, first.linkedHash);
  assert.equal(JSON.stringify(artifact), before);
  assert.doesNotMatch(first.code, /from ["'](?:three\/|@lux\/)/);
  assert.doesNotMatch(first.code, /from ["']\.\.?\//);
  assert.match(first.code, /helperStart\s*=\s*0\.375/);
  assert.ok(/\buniform\d*\(helperStart\)/.test(first.code), 'linked uniform references the helper constant after symbol renaming');
});
test('module and dependency tampering are refused', async () => {
  const changed = structuredClone(artifact); changed.modules['main.js'] += '\n// changed';
  await assert.rejects(linkRuntime(changed, { dependencyRoot }), /artifact hash/i);
  const changedHelper = structuredClone(artifact); changedHelper.modules['lib/color.js'] += '\n// changed helper';
  await assert.rejects(linkRuntime(changedHelper, { dependencyRoot }), /artifact hash/i);
  const wrongDependency = forge(body => { body.dependencyHashes['three/core'] = '0'.repeat(64); });
  await assert.rejects(linkRuntime(wrongDependency, { dependencyRoot }), /dependency hash/i);
});
test('virtual resolver refuses privileged, filesystem and dynamic import escapes even with consistent hashes', async () => {
  for (const statement of ["import 'node:fs';", "import '@lux/visual-sdk/discovery';", "import './../../../secret.js';", "import('https://example.com/x.js');"]) {
    const changed = forge(body => { body.modules['main.js'] = statement + '\n' + body.modules['main.js']; });
    await assert.rejects(linkRuntime(changed, { dependencyRoot }), /import|resolve/i);
  }
});
test('dependency inventory cannot select files outside pinned roots', async () => {
  const changed = forge(body => { body.dependencyHashes['declarations/../../../secret.txt'] = '0'.repeat(64); });
  await assert.rejects(linkRuntime(changed, { dependencyRoot }), /dependency path/i);
});
