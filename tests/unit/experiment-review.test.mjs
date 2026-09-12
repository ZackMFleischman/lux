import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { inventoryPaths, prepareGpuReview } from '../../scripts/prepare-gpu-review.mjs';
import { validateReviewedInputs } from '../../scripts/experiment-runner.mjs';

test('missing review entry refuses before launching hardware', () => {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', resolve('scripts/test-gpu.ps1')], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ReviewFile/);
});

test('offline inventory refuses missing build bytes and detects later mutations', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lux-inventory-test-'));
  execFileSync('git', ['init', '--quiet', root]);
  execFileSync('git', ['-C', root, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '--quiet', '-m', 'fixture']);
  for (const path of [...inventoryPaths.sources, ...inventoryPaths.binaries]) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), path.endsWith('package.json') ? '{"version":"test"}' : path);
  }
  for (const path of ['native/ffgl-source/src/a.cpp', 'native/texture-bridge/include/a.h', 'native/texture-bridge/src/a.cc', 'native/vendor/ffgl/source/lib/a.h', 'native/vendor/node/node-v24.20.0/include/node/a.h']) {
    await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), 'fixture');
  }
  const output = join(root, 'request.json');
  const request = await prepareGpuReview({ root, output });
  assert.equal(request.authorized, false);
  assert.equal(request.reviewer, null);
  assert.equal(request.buildAttribution.status, 'unverified');
  assert.ok(request.sourceState.commit);
  assert.equal(request.sourceState.dirty, true);
  assert.ok(request.binaries.some(b => b.path === process.execPath));
  assert.equal(JSON.parse(await readFile(output, 'utf8')).authorized, false);
  const reviewed = { ...request, authorized: true, reviewer: 'CPU test', hostClosedConfirmed: true, expiresUtc: new Date(Date.now() + 60000).toISOString() };
  await validateReviewedInputs(reviewed);
  await writeFile(join(root, inventoryPaths.binaries[0]), 'changed');
  await assert.rejects(validateReviewedInputs(reviewed), /hash mismatch/);
  await unlink(join(root, inventoryPaths.binaries[0]));
  await assert.rejects(prepareGpuReview({ root, output: join(root, 'second.json') }), /Missing required inventory/);
});
