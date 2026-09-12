import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

test('producer refuses an unsupervised launch before importing Electron or native addon', () => {
  const env = { ...process.env };
  delete env.LUX_EXPERIMENT_RUN_ID;
  delete env.LUX_EXPERIMENT_MODE;
  const source = stripTypeScriptTypes(readFileSync('apps/render-host/src/main.ts', 'utf8'));
  const child = spawnSync(process.execPath, ['--input-type=commonjs', '-e', source], { env, encoding: 'utf8', timeout: 3000 });
  assert.equal(child.status, 1, child.stderr);
  assert.match(child.stderr, /Reviewed experiment supervisor required/);
  assert.doesNotMatch(child.stderr, /Cannot find module|ERR_DLOPEN_FAILED/);
});
