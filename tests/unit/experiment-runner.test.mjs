import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, open, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runExperiment, lockPath } from '../../scripts/experiment-runner.mjs';

test('CPU runs record provenance, failure, deadline and refuse competing owners', async () => {
  const output = await mkdtemp(join(tmpdir(), 'lux-run-test-'));
  const ok = await runExperiment({ mode: 'cpu', fixture: 'success', output });
  assert.equal(ok.outcome, 'success');
  assert.equal(ok.exitCode, 0);
  assert.ok(ok.pid > 0);
  assert.ok(BigInt(ok.end.monotonicNs) > BigInt(ok.start.monotonicNs));
  assert.equal(ok.binary.sha256.length, 64);
  assert.ok(ok.sources.length > 0);
  assert.match(await readFile(join(ok.directory, 'stdout.log'), 'utf8'), /cpu fixture/);
  const fail = await runExperiment({ mode: 'cpu', fixture: 'failure', output });
  assert.equal(fail.exitCode, 7);
  assert.equal(fail.outcome, 'failure');
  const pending = runExperiment({ mode: 'cpu', fixture: 'timeout', timeoutMs: 1000, output });
  await new Promise(resolve => setTimeout(resolve, 100));
  await assert.rejects(runExperiment({ mode: 'cpu', fixture: 'success', output }), /lock/i);
  const timed = await pending;
  assert.equal(timed.outcome, 'timeout');
  assert.equal(timed.exitCode, 124);
  assert.equal(timed.cleanupComplete, true);
  const grandchild = Number((await readFile(join(timed.directory, 'stdout.log'), 'utf8')).match(/grandchild (\d+)/)[1]);
  assert.throws(() => process.kill(grandchild, 0), { code: 'ESRCH' });
  assert.equal(JSON.parse(await readFile(join(timed.directory, 'manifest.json'), 'utf8')).outcome, 'timeout');
  const stale = await open(lockPath, 'wx');
  try {
    await stale.writeFile('{"pid":99999999,"id":"stale-test"}');
    await assert.rejects(runExperiment({ mode: 'cpu', output }), /lock/i);
    assert.match(await readFile(lockPath, 'utf8'), /stale-test/);
  } finally { await stale.close(); await unlink(lockPath); }
});

test('unreviewed hardware and unbounded deadlines cannot launch', async () => {
  await assert.rejects(runExperiment({ mode: 'hardware' }), /review/i);
  await assert.rejects(runExperiment({ mode: 'cpu', fixture: 'success', timeoutMs: 90000 }), /timeout/i);
});
