import test from 'node:test';
import assert from 'node:assert/strict';
import { boundDiagnostics, assertResultBudgets } from '../../apps/build-worker/src/result-budget.mjs';
import { limits } from '../../apps/build-worker/src/source-policy.mjs';
import { readCompileResult } from '../../apps/build-worker/src/compile.mjs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('final JSON escaping and multibyte text count toward diagnostic quota', () => {
  const raw = Array.from({ length: 128 }, () => ({ code: 'TS2322', message: '\\"漢'.repeat(200) }));
  assert.ok(Buffer.byteLength(JSON.stringify(raw)) > limits.diagnosticBytes);
  const bounded = boundDiagnostics(raw);
  assert.ok(Buffer.byteLength(JSON.stringify(bounded)) <= limits.diagnosticBytes);
  assert.equal(bounded.at(-1).code, 'DIAGNOSTICS_TRUNCATED');
  assert.deepEqual(boundDiagnostics(raw.slice(0, 1)), raw.slice(0, 1));
  assert.throws(() => assertResultBudgets({ ok: false, code: 'COMPILE_FAILED', diagnostics: raw }), { code: 'QUOTA_EXCEEDED' });
  assert.doesNotThrow(() => assertResultBudgets({ ok: false, code: 'COMPILE_FAILED', diagnostics: bounded }));
});

test('parent artifact quota includes final hash field and all serialized bytes', () => {
  const beforeHash = { modules: { 'main.js': 'a'.repeat(limits.outputBytes - 40) } };
  assert.ok(Buffer.byteLength(JSON.stringify(beforeHash)) <= limits.outputBytes);
  const final = { ...beforeHash, bundleHash: 'a'.repeat(64) };
  assert.throws(() => assertResultBudgets({ ok: true, artifact: final, diagnostics: [] }), { code: 'QUOTA_EXCEEDED' });
});

test('parent reader rejects worker quota regressions below its aggregate file-size cap', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'lux-result-budget-')), 'result.json');
  const diagnostics = Array.from({ length: 128 }, () => ({ code: 'TS2322', message: '\\'.repeat(800) }));
  await writeFile(path, JSON.stringify({ ok: false, code: 'COMPILE_FAILED', diagnostics }));
  assert.equal((await readCompileResult(path)).code, 'QUOTA_EXCEEDED');
  await writeFile(path, JSON.stringify({ ok: true, diagnostics: [], artifact: { modules: { 'main.js': 'x'.repeat(limits.outputBytes) } } }));
  assert.equal((await readCompileResult(path)).code, 'QUOTA_EXCEEDED');
});
