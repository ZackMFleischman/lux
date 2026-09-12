import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { preflightSchema, integrationReady } from '../../packages/runtime-contracts/src/telemetry.ts';

const result = { schemaVersion: 1, sourceCommit: 'a'.repeat(40), host: { executable: null, version: null, refreshHz: null, pluginDirectory: null }, adapters: { rendererLuid: null, bridgeLuid: null, hostLuid: null }, versions: {}, mcp: { profile: '2025-11-25', client: null, imageObserved: false }, checks: [{ name: 'actual host', outcome: 'unavailable', evidence: 'Not observed' }] };
test('unobserved measurements remain nullable and block readiness', () => {
  assert.equal(preflightSchema.safeParse(result).success, true);
  assert.equal(integrationReady(result), false);
});
test('invalid schema and inventory-only empty checks cannot pass', () => {
  assert.equal(preflightSchema.safeParse({ ...result, host: { ...result.host, refreshHz: 0 } }).success, false);
  assert.equal(integrationReady({ ...result, checks: [] }), false);
  assert.equal(preflightSchema.safeParse({ ...result, checks: [{ name: 'GPU', outcome: 'unknown', evidence: '' }] }).success, false);
});
test('later suites fail with the task and prerequisites', () => {
  const execution = spawnSync(process.execPath, ['scripts/unavailable.mjs', 'TR-02', 'actual-GPU-and-FFGL-transfer'], { encoding: 'utf8' });
  assert.equal(execution.status, 2);
  assert.match(execution.stderr, /TR-02.*actual-GPU-and-FFGL-transfer/);
});
