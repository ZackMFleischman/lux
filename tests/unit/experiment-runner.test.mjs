import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, open, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runExperiment, lockPath, assertNoConflictingActivity, validateReviewedInputs, experimentSummary } from '../../scripts/experiment-runner.mjs';

test('CLI summary excludes large inventories while preserving outcome and evidence location', () => {
  const summary = experimentSummary({ id: 'run', directory: 'C:/runs/run', outcome: 'failure', exitCode: 2,
    cleanupComplete: true, timeoutMs: 20000, start: { utc: 'start', monotonicNs: '1000000' },
    end: { utc: 'end', monotonicNs: '6000000' }, sources: Array(3042).fill({ path: 'source' }),
    activity: [{ Name: 'unrelated.exe' }], error: 'failure detail stored on disk' });
  assert.deepEqual(summary, { id: 'run', directory: 'C:/runs/run', manifest: join('C:/runs/run', 'manifest.json'),
    outcome: 'failure', exitCode: 2, cleanupComplete: true, timeoutMs: 20000,
    startUtc: 'start', endUtc: 'end', elapsedMs: 5 });
  assert.ok(JSON.stringify(summary).length < 500);
});

test('actual Resolume Avenue and Arena processes block experiments', () => {
  for (const Name of ['Avenue.exe', 'Arena.exe', 'AVENUE.EXE', 'ResolumeArena.exe', 'electron.exe', 'standalone_host.exe']) {
    assert.throws(() => assertNoConflictingActivity([{ Name, ProcessId: 123 }]), /Conflicting/);
  }
  assert.doesNotThrow(() => assertNoConflictingActivity([{ Name: 'notepad.exe', ProcessId: 12 }]));
});

test('host experiment permits only its exact reviewed Resolume process', () => {
  const host = { pid: 123, executable: 'C:/Resolume/Avenue.exe', creationUtc: '2026-09-12T07:00:00Z' };
  const process = { Name: 'Avenue.exe', ProcessId: 123, ExecutablePath: host.executable, CreationUtc: host.creationUtc };
  assert.doesNotThrow(() => assertNoConflictingActivity([process], host));
  for (const changed of [{ ...process, ProcessId: 124 }, { ...process, CreationUtc: 'later' }, { ...process, ExecutablePath: 'C:/other/Avenue.exe' }]) {
    assert.throws(() => assertNoConflictingActivity([changed], host), /host|Conflicting/i);
  }
  assert.throws(() => assertNoConflictingActivity([], host), /host/i);
  assert.throws(() => assertNoConflictingActivity([process, { Name: 'electron.exe', ProcessId: 456 }], host), /Conflicting/);
  assert.throws(() => assertNoConflictingActivity([{ ...process, Name: 'electron.exe' }], host), /host|Conflicting/i);
});

test('review revalidation detects intervening source/binary mutation and expiry without launching', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lux-review-test-'));
  const source = join(folder, 'source.txt'), binary = join(folder, 'binary.txt');
  await writeFile(source, 'source'); await writeFile(binary, 'binary');
  const digest = text => createHash('sha256').update(text).digest('hex');
  const review = { authorized: true, reviewer: 'test', hypothesis: 'CPU data validation', hostClosedConfirmed: true,
    expiresUtc: new Date(Date.now() + 60000).toISOString(), executable: binary, args: [],
    sources: [{ path: source, sha256: digest('source') }], binaries: [{ path: binary, sha256: digest('binary') }] };
  await validateReviewedInputs(review);
  await writeFile(source, 'modified');
  await assert.rejects(validateReviewedInputs(review), /hash mismatch/);
  await writeFile(source, 'source'); await writeFile(binary, 'modified');
  await assert.rejects(validateReviewedInputs(review), /hash mismatch/);
  await writeFile(binary, 'binary');
  review.expiresUtc = new Date(Date.now() + 100).toISOString();
  await validateReviewedInputs(review);
  await new Promise(resolve => setTimeout(resolve, 120));
  await assert.rejects(validateReviewedInputs(review), /expired/);
});

test('CPU runs record provenance, failure, deadline and refuse competing owners', async () => {
  const output = await mkdtemp(join(tmpdir(), 'lux-run-test-'));
  const ok = await runExperiment({ mode: 'cpu', fixture: 'success', output });
  assert.equal(ok.outcome, 'success');
  assert.equal(ok.exitCode, 0);
  assert.ok(ok.pid > 0);
  assert.ok(BigInt(ok.end.monotonicNs) > BigInt(ok.start.monotonicNs));
  assert.equal(ok.binary.sha256.length, 64);
  assert.ok(ok.sources.length > 0);
  assert.deepEqual(ok.activity, []);
  assert.match(await readFile(join(ok.directory, 'stdout.log'), 'utf8'), /cpu fixture/);
  assert.match(await readFile(join(ok.directory, 'stdout.log'), 'utf8'), new RegExp(ok.id));
  assert.match(await readFile(join(ok.directory, 'stdout.log'), 'utf8'), /experiment timeout 8000/);
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
