import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import packageIO from '../packages/export/src/package.cjs';

// CPU-only: uses packaged Electron in Node mode, no source activation or GPU.
const root = resolve(import.meta.dirname, '..');
const uiResult = process.argv[2] ? null : JSON.parse(await readFile(join(root, 'artifacts/studio-ui/result.json')));
const packagePath = resolve(process.argv[2] || uiResult.export.path);
const verified = packageIO.validatePackage(packagePath);
const artifacts = join(root, 'artifacts/installed-package'); await mkdir(artifacts, { recursive: true });
const profile = await mkdtemp(join(artifacts, 'profile-'));
const localAppData = join(profile, 'local'), installRoot = join(localAppData, 'Lux/Installed');
await mkdir(localAppData, { recursive: true });
const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', LOCALAPPDATA: localAppData,
  APPDATA: join(profile, 'roaming'), PATH: join(process.env.SystemRoot || 'C:/Windows', 'System32') };
for (const key of Object.keys(env)) if (key.startsWith('LUX_') || key === 'NODE_OPTIONS' || key === 'NODE_PATH') delete env[key];
function launch(executable, args) {
  const child = spawn(executable, args, { cwd: profile, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => { if (stdout.length < 65536) stdout += bytes; });
  child.stderr.on('data', bytes => { if (stderr.length < 65536) stderr += bytes; });
  const exited = new Promise((done, reject) => { child.once('error', reject); child.once('exit', code => done(code)); });
  return { child, exited, logs: () => ({ stdout, stderr }) };
}
const report = { ok: false, gpuTested: false, hostTested: false, cacheState: 'OS file cache not cleared; package installed and validated immediately before supervisor launch', releaseId: verified.release.releaseId, runtimeId: verified.runtime.runtimeId };
let processUnderTest;
try {
  const started = performance.now();
  processUnderTest = launch(join(packagePath, 'runtime/electron/electron.exe'), [join(packagePath, 'runtime/install.cjs'), packagePath, installRoot]);
  const installTimer = setTimeout(() => processUnderTest.child.kill(), 60000);
  const installExit = await processUnderTest.exited; clearTimeout(installTimer);
  assert.equal(installExit, 0, JSON.stringify(processUnderTest.logs()));
  report.installMs = performance.now() - started;
  const runtime = join(installRoot, 'runtimes', report.runtimeId);
  assert.equal(packageIO.validateRuntime(runtime).runtimeId, report.runtimeId);
  const coldStarted = performance.now();
  processUnderTest = launch(join(runtime, 'electron/electron.exe'), [join(runtime, 'apps/installed-runtime/src/supervisor.cjs'), '--lux-runtime-id', report.runtimeId]);
  const deadline = setTimeout(() => processUnderTest.child.kill(), 45000);
  try {
    const ready = join(installRoot, 'instances', report.runtimeId, 'supervisor.ready');
    let observed = false;
    for (let attempt = 0; attempt < 160 && processUnderTest.child.exitCode === null; attempt++) {
      try { assert.equal(Number(await readFile(ready, 'utf8')), processUnderTest.child.pid); observed = true; break; } catch {}
      await new Promise(done => setTimeout(done, 50));
    }
    assert.equal(observed, true, 'Packaged supervisor must become ready: ' + JSON.stringify(processUnderTest.logs()));
    report.coldSupervisorReadyMs = performance.now() - coldStarted;
    const duplicate = launch(join(runtime, 'electron/electron.exe'), [join(runtime, 'apps/installed-runtime/src/supervisor.cjs'), '--lux-runtime-id', report.runtimeId]);
    const duplicateTimer = setTimeout(() => duplicate.child.kill(), 5000);
    try { assert.equal(await duplicate.exited, 0, JSON.stringify(duplicate.logs())); }
    finally { clearTimeout(duplicateTimer); if (duplicate.child.exitCode === null) duplicate.child.kill(); }
    assert.equal(processUnderTest.child.exitCode, null, 'The original shared supervisor must remain alive');
    assert.equal(Number(await readFile(ready, 'utf8')), processUnderTest.child.pid);
    report.sharedSupervisorSingleton = true;
    assert.equal(await processUnderTest.exited, 0, JSON.stringify(processUnderTest.logs()));
    report.idleExitMs = performance.now() - coldStarted;
    assert.ok(report.idleExitMs >= 29000 && report.idleExitMs < 45000);
    report.ok = true;
  } finally { clearTimeout(deadline); }
  console.log('Packaged Electron installation, supervisor startup and idle exit passed:', JSON.stringify(report));
} catch (error) {
  report.error = String(error.stack || error); console.error(report.error); process.exitCode = 1;
} finally {
  if (processUnderTest && processUnderTest.child.exitCode === null) processUnderTest.child.kill();
  await writeFile(join(artifacts, 'result.json'), JSON.stringify(report, null, 2));
}
