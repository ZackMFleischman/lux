import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

test('Windows compiler job enforces whole-job memory limit on harmless allocation child', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-memory-test-'));
  const fixture = join(directory, 'allocate.mjs');
  await writeFile(fixture, 'const keep=[]; while(true) keep.push(Buffer.alloc(8*1024*1024,1));');
  const config = join(directory, 'config.json');
  await writeFile(config, JSON.stringify({ executable: process.execPath, commandLine: `"${process.execPath}" "${fixture}"`, cwd: directory, directory, timeoutMs: 5000, memoryLimitBytes: 134217728 }));
  const processResult = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', resolve('scripts/experiment-job.ps1'), '-Config', config], { windowsHide: true, encoding: 'utf8', timeout: 15000 });
  assert.equal(processResult.status, 0, processResult.stderr);
  const result = JSON.parse(await readFile(join(directory, 'result.json'), 'utf8'));
  assert.equal(result.cleanupComplete, true);
  assert.equal(result.timeout, false);
  assert.notEqual(result.exitCode, 0);
  await writeFile(config, JSON.stringify({ memoryLimitBytes: 1 }));
  const invalid = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', resolve('scripts/experiment-job.ps1'), '-Config', config], { windowsHide: true, encoding: 'utf8', timeout: 15000 });
  assert.notEqual(invalid.status, 0);
});

test('an infinite harmless CPU child is terminated and confirmed stopped within two seconds of launch', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-loop-test-'));
  const fixture = join(directory, 'loop.mjs');
  await writeFile(fixture, 'while(true) {}');
  const config = join(directory, 'config.json');
  await writeFile(config, JSON.stringify({ executable: process.execPath, commandLine: `"${process.execPath}" "${fixture}"`, cwd: directory, directory, timeoutMs: 200, memoryLimitBytes: 134217728 }));
  const supervisor = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', resolve('scripts/experiment-job.ps1'), '-Config', config], { windowsHide: true, encoding: 'utf8', timeout: 15000 });
  assert.equal(supervisor.status, 0, supervisor.stderr);
  const start = JSON.parse(await readFile(join(directory, 'child.json'), 'utf8'));
  const end = JSON.parse(await readFile(join(directory, 'result.json'), 'utf8'));
  assert.equal(end.timeout, true);
  assert.equal(end.cleanupComplete, true);
  assert.ok(Number(BigInt(end.endTicks) - BigInt(start.startTicks)) / start.frequency < 2);
  assert.throws(() => process.kill(start.pid, 0), { code: 'ESRCH' });
});
