import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { preflightSchema } from '../../packages/runtime-contracts/src/telemetry.ts';

test('missing Electron emits schema-valid temporary evidence without polluting real evidence', { timeout: 90000 }, () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'lux-preflight-test-'));
  const realEvidenceRoot = resolve('evidence/tracer-0.1');
  const realEvidenceBefore = readdirSync(realEvidenceRoot).sort();
  try {
  const execution = spawnSync(process.execPath, ['--import', './tests/unit/fixtures/missing-electron.mjs', 'scripts/preflight.mjs', '--output-root', temporaryRoot], { encoding: 'utf8', timeout: 80000 });
  assert.equal(execution.status, 2, execution.stderr);
  const directory = execution.stdout.match(/TR-01 evidence: (.+)/)?.[1]?.trim();
  assert.ok(directory, execution.stdout);
  assert.equal(dirname(directory), temporaryRoot);
  const result = preflightSchema.parse(JSON.parse(readFileSync(resolve(directory, 'environment.json'), 'utf8')));
  assert.equal(result.checks.find(check => check.name === 'dependency electron')?.outcome, 'fail');
  const tuple = result.checks.find(check => check.name === 'Electron executable version tuple');
  assert.equal(tuple?.outcome, 'unavailable');
  assert.match(tuple?.evidence ?? '', /pnpm install --frozen-lockfile/);
  assert.equal(result.electronRuntime, null);
  assert.deepEqual(readdirSync(realEvidenceRoot).sort(), realEvidenceBefore);
  } finally {
    // Only remove the uniquely created test directory directly beneath OS temp.
    assert.equal(dirname(resolve(temporaryRoot)), resolve(tmpdir()));
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
