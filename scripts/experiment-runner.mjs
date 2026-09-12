import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, unlink, open } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
// Same user/session across all checkouts, with no configurable lock bypass.
export const lockPath = join(homedir(), 'AppData', 'Local', 'Lux', 'experiment.lock');
const stamp = () => ({ utc: new Date().toISOString(), monotonicNs: process.hrtime.bigint().toString() });
const hash = async path => ({ path: resolve(path), sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
const conflictingActivity = processes => processes.filter(p => /^(Avenue|Arena|Resolume.*|electron|standalone_host|lux[-_].*)\.exe$/i.test(p.Name));
export function assertNoConflictingActivity(processes) {
  const activity = conflictingActivity(processes);
  if (activity.length) throw new Error(`Conflicting host/standalone activity: ${activity.map(p => `${p.Name} PID ${p.ProcessId}`).join(', ')}`);
}
export function experimentSummary(manifest) {
  return { id: manifest.id, directory: manifest.directory, manifest: join(manifest.directory, 'manifest.json'),
    outcome: manifest.outcome, exitCode: manifest.exitCode, cleanupComplete: manifest.cleanupComplete,
    timeoutMs: manifest.timeoutMs, startUtc: manifest.start.utc, endUtc: manifest.end.utc,
    elapsedMs: Number(BigInt(manifest.end.monotonicNs) - BigInt(manifest.start.monotonicNs)) / 1e6 };
}
export async function validateReviewedInputs(review) {
  if (review.authorized !== true || !review.reviewer || !review.hypothesis || review.hostClosedConfirmed !== true || !Array.isArray(review.sources) || !review.sources.length || !Array.isArray(review.binaries) || !review.binaries.length || !Array.isArray(review.args)) throw new Error('Incomplete hardware review');
  const checkExpiry = () => { if (!Number.isFinite(Date.parse(review.expiresUtc)) || Date.parse(review.expiresUtc) <= Date.now()) throw new Error('Hardware review expired'); };
  checkExpiry();
  const executable = resolve(review.executable);
  if (!review.args.every(a => typeof a === 'string')) throw new Error('Review arguments must be strings');
  for (const entry of [...review.sources, ...review.binaries]) if ((await hash(entry.path)).sha256 !== entry.sha256) throw new Error(`Reviewed hash mismatch: ${entry.path}`);
  const reviewedExecutable = review.binaries.find(b => resolve(b.path) === executable);
  if (!reviewedExecutable) throw new Error('Executable missing from reviewed binaries');
  const binary = await hash(executable);
  if (binary.sha256 !== reviewedExecutable.sha256) throw new Error('Executable hash mismatch');
  checkExpiry();
  return binary;
}
function quote(value) { return '"' + value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1') + '"'; }
function powershell(args, { timeout = 15000, env = process.env } = {}) {
  return new Promise((res, rej) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', ...args], { windowsHide: true, env });
    const timer = setTimeout(() => { child.kill(); rej(new Error('Supervisor deadline exceeded; cleanup unconfirmed, retain lock')); }, timeout);
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { err += d; });
    child.on('error', error => { clearTimeout(timer); rej(error); }); child.on('close', code => { clearTimeout(timer); code === 0 ? res(out) : rej(new Error(`Supervisor failed (${code}): ${err}`)); });
  });
}
export async function runExperiment(options = {}) {
  const { mode = 'cpu', fixture = 'success', timeoutMs = 8000, output = join(root, 'artifacts', 'experiments') } = options;
  if (mode !== 'cpu' && mode !== 'hardware') throw new Error('Unknown mode');
  if (mode === 'hardware' && !options.reviewFile) throw new Error('Hardware requires an explicit review file and authorization');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) throw new Error('timeoutMs must be bounded between 100 and 30000');
  if (process.platform !== 'win32') throw new Error('Windows Job Object supervisor required');
  let executable = process.execPath, args = [join(here, 'experiment-cpu-fixture.mjs'), fixture];
  let review;
  if (mode === 'cpu') {
    if (!['success', 'failure', 'timeout'].includes(fixture)) throw new Error('Unknown CPU fixture');
  } else {
    review = JSON.parse(await readFile(options.reviewFile, 'utf8'));
    await validateReviewedInputs(review);
    executable = resolve(review.executable); args = review.args;
  }
  await mkdir(dirname(lockPath), { recursive: true });
  let lock;
  try { lock = await open(lockPath, 'wx'); } catch (error) { throw new Error(`Experiment lock unavailable: ${lockPath}. Never automatically steal a stale lock. ${error.message}`); }
  const id = randomUUID(), directory = resolve(output, id);
  const manifest = { schema: 1, id, directory, mode, supervisorPid: process.pid, start: stamp(), timeoutMs, executable, args, outcome: 'preparing', cleanupComplete: false };
  let started = false;
  try {
    await lock.writeFile(JSON.stringify({ id, pid: process.pid, start: manifest.start, directory }));
    await mkdir(directory, { recursive: true });
    // Read-only inspection, including outside this runner. Failure to inspect refuses execution.
    const activityRaw = await powershell(['-Command', "@(Get-CimInstance Win32_Process -ErrorAction Stop | Select-Object ProcessId,Name,ExecutablePath) | ConvertTo-Json -Compress"]);
    const parsedActivity = activityRaw.trim() ? JSON.parse(activityRaw) : [];
    const activity = Array.isArray(parsedActivity) ? parsedActivity : [parsedActivity];
    manifest.activity = conflictingActivity(activity);
    assertNoConflictingActivity(activity);
    manifest.binary = await hash(executable);
    const sourcePaths = [fileURLToPath(import.meta.url), join(here, 'experiment-job.cs'), join(here, 'experiment-job.ps1'), join(here, 'experiment-cpu-fixture.mjs')];
    manifest.sources = await Promise.all(sourcePaths.map(hash));
    if (review) { manifest.review = await hash(options.reviewFile); manifest.reviewedSources = review.sources; manifest.binaries = review.binaries; }
    try { manifest.commit = execFileSync('git', ['-c', `safe.directory=${root}`, 'rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(); } catch { manifest.commit = null; }
    const config = { executable, commandLine: [executable, ...args].map(quote).join(' '), cwd: root, directory, timeoutMs };
    await writeFile(join(directory, 'config.json'), JSON.stringify(config, null, 2));
    manifest.outcome = 'running';
    await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2));
    // Inspection and metadata I/O can take seconds. Check the same review again
    // at dispatch, including expiry after all file reads and executable bytes.
    if (review) manifest.binary = await validateReviewedInputs(review);
    started = true;
    await powershell(['-ExecutionPolicy', 'Bypass', '-File', join(here, 'experiment-job.ps1'), '-Config', join(directory, 'config.json')], {
      timeout: timeoutMs + 15000,
      env: { ...process.env, LUX_EXPERIMENT_RUN_ID: id, LUX_EXPERIMENT_MODE: mode, LUX_EXPERIMENT_DIRECTORY: directory, LUX_EXPERIMENT_TIMEOUT_MS: String(timeoutMs) },
    });
    const child = JSON.parse(await readFile(join(directory, 'child.json'), 'utf8'));
    const result = JSON.parse(await readFile(join(directory, 'result.json'), 'utf8'));
    Object.assign(manifest, { pid: child.pid, child, result, exitCode: result.exitCode, cleanupComplete: result.cleanupComplete, outcome: result.timeout ? 'timeout' : result.exitCode === 0 ? 'success' : 'failure' });
    return manifest;
  } catch (error) { manifest.error = error.message; manifest.outcome = started ? 'cleanup-unconfirmed' : 'refused'; throw error; }
  finally {
    manifest.end = stamp();
    try {
      await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2));
      if (!started || manifest.cleanupComplete === true) await unlink(lockPath);
    } finally { await lock.close(); }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode = 'cpu', input = 'success', timeout] = process.argv.slice(2);
  runExperiment({ mode, ...(mode === 'hardware' ? { reviewFile: resolve(input) } : { fixture: input }), ...(timeout ? { timeoutMs: Number(timeout) } : {}) })
    .then(result => { console.log(JSON.stringify(experimentSummary(result), null, 2)); process.exitCode = result.outcome === 'success' ? 0 : 1; })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
