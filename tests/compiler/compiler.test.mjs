import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compileVisual } from '../../apps/build-worker/src/compile.mjs';
import { validateSource } from '../../apps/build-worker/src/source-policy.mjs';

const dependencyRoot = process.env.LUX_COMPILER_DEPENDENCIES || resolve('node_modules');
const example = () => readFile(new URL('../../packages/visual-sdk/examples/intensity.ts', import.meta.url), 'utf8');
const request = text => ({ source: { sdkVersion: '0.1.0', entry: 'main.ts', files: { 'main.ts': text } } });

test('source admission rejects invalid UTF8, traversal, collision and byte/file budgets', () => {
  for (const files of [{ '../bad.ts': '' }, { 'C:/bad.ts': '' }, { 'MAIN.ts': '', 'main.ts': '' }, { 'main.ts': '\ud800' }, { 'main.ts': 'x'.repeat(1048577) }, Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`f${i}.ts`, '']))]) {
    assert.throws(() => validateSource({ sdkVersion: '0.1.0', entry: Object.keys(files)[0], files }));
  }
  assert.throws(() => validateSource({ sdkVersion: '9', entry: 'main.ts', files: { 'main.ts': '' } }), /SDK/);
  assert.throws(() => validateSource({ ...request('').source, compilerOptions: {} }), /unsupported/);
  assert.throws(() => validateSource({ sdkVersion: '0.1.0', entry: 'main.ts', files: { 'main.ts': '', ['a'.repeat(241) + '.ts']: '' } }), /240/);
});

test('real compiler emits deterministic executable modules and source maps without evaluating visuals', async () => {
  const source = await example();
  const first = await compileVisual(request(source), { dependencyRoot });
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.match(first.artifact.modules['main.js'], /defineVisual/);
  assert.ok(first.artifact.sourceMaps['main.js.map']);
  assert.ok(Object.keys(first.artifact.dependencyHashes).some(key => key.includes('@types/three')));
  assert.equal(first.artifact.dependencyHashes['three/webgpu'].length, 64);
  const second = await compileVisual(request(source), { dependencyRoot });
  assert.equal(second.ok, true, JSON.stringify(second));
  assert.equal(second.artifact.bundleHash, first.artifact.bundleHash);
  assert.equal(second.artifact.sourceHash, first.artifact.sourceHash);
  const changed = await compileVisual(request(source.replace('0.5', '0.4')), { dependencyRoot });
  assert.equal(changed.ok, true, JSON.stringify(changed));
  assert.notEqual(changed.artifact.bundleHash, first.artifact.bundleHash);
});

test('invalid syntax, types, arbitrary imports and schema changes return useful diagnostics', async () => {
  const source = await example();
  for (const [text, code] of [
    ['export default !!!;', 'COMPILE_FAILED'],
    [source.replace('const level = uniform(0.5)', 'const level: number = "wrong"'), 'COMPILE_FAILED'],
    [`import fs from 'node:fs';\n${source}`, 'SOURCE_BOUNDARY_VIOLATION'],
    [`export * from 'https://example.com/mod.js';\n${source}`, 'SOURCE_BOUNDARY_VIOLATION'],
    [`const x = import('three/tsl');\n${source}`, 'SOURCE_BOUNDARY_VIOLATION'],
    [`import secret from 'n\\u006fde:fs';\n${source}`, 'SOURCE_BOUNDARY_VIOLATION'],
    [`/// <reference path="C:/secret.ts" />\n${source}`, 'SOURCE_BOUNDARY_VIOLATION'],
    [source.replace('defineVisual({', 'defineVisual({ controls: [],'), 'COMPILE_FAILED'],
  ]) {
    const result = await compileVisual(request(text), { dependencyRoot });
    assert.equal(result.ok, false, text);
    assert.equal(result.code, code, JSON.stringify(result));
    assert.ok(result.diagnostics[0].message);
    assert.ok(Buffer.byteLength(JSON.stringify(result.diagnostics)) <= 131072);
  }
});

test('missing pinned dependencies are a bounded service failure with no filesystem-path diagnostic', async () => {
  const result = await compileVisual(request(await example()), { dependencyRoot: resolve('missing-dependencies') });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SERVICE_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(result.diagnostics), /missing-dependencies|C:\\|C:\//);
});

test('escaping-heavy real TypeScript diagnostics stay within final serialized quota', async () => {
  const literal = '\\\\'.repeat(700);
  const failures = Array.from({ length: 128 }, () => `({})["${literal}"];`).join('\n');
  const result = await compileVisual(request(`${failures}\n${await example()}`), { dependencyRoot });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'COMPILE_FAILED', JSON.stringify(result).slice(0, 500));
  assert.ok(Buffer.byteLength(JSON.stringify(result.diagnostics)) <= 131072);
  assert.equal(result.diagnostics.at(-1).code, 'DIAGNOSTICS_TRUNCATED');
});

test('infinite visual initialization is emitted as untrusted data, never run by compiler', async () => {
  const source = (await example()).replace('async create(context) {', 'async create(context) { while (true) {}');
  const result = await compileVisual(request(source), { dependencyRoot });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.match(result.artifact.modules['main.js'], /while \(true\)/);
});

test('compiler process initialization timeout is bounded and followed by a working job', async () => {
  const result = await compileVisual(request(await example()), { dependencyRoot, timeoutMs: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'TIMEOUT');
  const next = await compileVisual(request(await example()), { dependencyRoot });
  assert.equal(next.ok, true, JSON.stringify(next));
});

test('submitted sibling modules resolve while unavailable Three exports fail typechecking', async () => {
  const source = await example();
  const input = request(`import { start } from './settings.ts';\n${source.replace('uniform(0.5)', 'uniform(start)')}`);
  input.source.files['settings.ts'] = 'export const start = 0.5;';
  const good = await compileVisual(input, { dependencyRoot });
  assert.equal(good.ok, true, JSON.stringify(good));
  assert.match(good.artifact.modules['main.js'], /\.\/settings\.js/);
  assert.ok(good.artifact.modules['settings.js']);
  const bad = await compileVisual(request(`import { NotARealThreeExport } from 'three/webgpu';\n${source}`), { dependencyRoot });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, 'COMPILE_FAILED');
  assert.ok(bad.diagnostics.some(d => /no exported member/.test(d.message)), JSON.stringify(bad));
  assert.ok(bad.diagnostics.some(d => d.file === 'main.ts' && d.line === 1 && d.column > 0), JSON.stringify(bad));
});

test('helper-only edits affect both identities and helper errors retain their path and line', async () => {
  const source = await example();
  const input = request(`import { start } from './lib/color.ts';\n${source.replace('uniform(0.5)', 'uniform(start)')}`);
  input.source.files['lib/color.ts'] = '// helper\nexport const start: number = 0.25;';
  const first = await compileVisual(input, { dependencyRoot });
  assert.equal(first.ok, true, JSON.stringify(first));
  input.source.files['lib/color.ts'] = '// helper\nexport const start: number = 0.75;';
  const changed = await compileVisual(input, { dependencyRoot });
  assert.equal(changed.ok, true, JSON.stringify(changed));
  assert.notEqual(changed.artifact.sourceHash, first.artifact.sourceHash);
  assert.notEqual(changed.artifact.bundleHash, first.artifact.bundleHash);
  assert.equal(changed.artifact.modules['main.js'], first.artifact.modules['main.js']);
  assert.notEqual(changed.artifact.modules['lib/color.js'], first.artifact.modules['lib/color.js']);
  input.source.files['lib/color.ts'] = '// helper\nexport const start: number = "wrong";';
  const invalid = await compileVisual(input, { dependencyRoot });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.diagnostics.some(diagnostic => diagnostic.file === 'lib/color.ts' && diagnostic.line === 2 && diagnostic.column > 0), JSON.stringify(invalid));
  delete input.source.files['lib/color.ts'];
  const missing = await compileVisual(input, { dependencyRoot });
  assert.equal(missing.ok, false);
  assert.ok(missing.diagnostics.some(diagnostic => /lib\/color/.test(diagnostic.message)), JSON.stringify(missing));
});
