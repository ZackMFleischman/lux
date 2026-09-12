import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { preflightSchema } from '../../packages/runtime-contracts/src/telemetry.ts';

test('missing Electron still emits schema-valid preflight evidence and exit 2', { timeout: 90000 }, () => {
  const execution = spawnSync(process.execPath, ['--import', './tests/unit/fixtures/missing-electron.mjs', 'scripts/preflight.mjs'], { encoding: 'utf8', timeout: 80000 });
  assert.equal(execution.status, 2, execution.stderr);
  const directory = execution.stdout.match(/TR-01 evidence: (.+)/)?.[1]?.trim();
  assert.ok(directory, execution.stdout);
  const result = preflightSchema.parse(JSON.parse(readFileSync(resolve(directory, 'environment.json'), 'utf8')));
  assert.equal(result.checks.find(check => check.name === 'dependency electron')?.outcome, 'fail');
  const tuple = result.checks.find(check => check.name === 'Electron executable version tuple');
  assert.equal(tuple?.outcome, 'unavailable');
  assert.match(tuple?.evidence ?? '', /pnpm install --frozen-lockfile/);
  assert.equal(result.electronRuntime, null);
});
