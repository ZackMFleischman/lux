import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { preflightSchema, integrationReady } from '../packages/runtime-contracts/src/telemetry.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const require = createRequire(import.meta.url);
const checks = [];
const check = (name, outcome, evidence) => checks.push({ name, outcome, evidence });
const run = (command, args, extra = {}) => {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 30000, windowsHide: true, ...extra });
  return { command: [command, ...args], status: result.status, stdout: result.stdout?.trim() ?? '', stderr: result.error?.message ?? result.stderr?.trim() ?? '' };
};
const discovery = [];
const git = run('git', ['-c', `safe.directory=${root.replaceAll('\\', '/').replace(/\/$/, '')}`, 'rev-parse', 'HEAD']);
discovery.push(git);
if (git.status !== 0) throw new Error(`TR-01 cannot establish source commit: ${git.stderr}`);
const gitStatus = run('git', ['-c', `safe.directory=${root.replaceAll('\\', '/').replace(/\/$/, '')}`, 'status', '--porcelain']);
discovery.push(gitStatus);
const inventory = run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve(root, 'scripts/collect-windows.ps1')]);
discovery.push(inventory);
let observed = {};
try { if (inventory.status === 0) observed = JSON.parse(inventory.stdout); } catch { /* failure explicitly represented below */ }
check('Windows inventory', observed.os ? 'pass' : 'unavailable', observed.os ? JSON.stringify(observed.os) : inventory.stderr || 'Windows CIM inventory failed');
check('native x64 process', process.platform === 'win32' && process.arch === 'x64' ? 'pass' : 'fail', `${process.platform}/${process.arch}`);
const versions = { node: process.versions.node, pnpm: '10.33.0' };
for (const name of ['electron', 'three', '@modelcontextprotocol/sdk', 'typescript', 'zod']) {
  try {
    // Resolve package entry and walk to its own package.json (exports may hide package.json).
    let directory = dirname(require.resolve(name === '@modelcontextprotocol/sdk' ? `${name}/client/index.js` : name));
    while (true) {
      const path = resolve(directory, 'package.json');
      if (existsSync(path)) { const metadata = JSON.parse(readFileSync(path, 'utf8')); if (metadata.name === name) { versions[name] = metadata.version; break; } }
      const parent = dirname(directory); if (parent === directory) throw new Error('package metadata not found'); directory = parent;
    }
    check(`dependency ${name}`, 'pass', versions[name]);
  } catch (error) { check(`dependency ${name}`, 'fail', `TR-01 prerequisite: pnpm install --frozen-lockfile; ${error.message}`); }
}
const manager = run('powershell', ['-NoProfile', '-Command', 'pnpm --version']); discovery.push(manager);
check('pinned development tools', process.versions.node === '24.12.0' && manager.stdout === '10.33.0' ? 'pass' : 'fail', `Node ${process.versions.node}; pnpm ${manager.stdout || manager.stderr}`);
versions.pnpm = manager.stdout || 'unavailable';
const toolchain = observed.toolchain ?? {};
for (const [name, value] of Object.entries({ visualStudio: toolchain.visualStudio, compiler: toolchain.compiler?.version, cmake: toolchain.cmake, windowsSdk: toolchain.windowsSdk })) {
  if (value) versions[name] = value;
  check(name, value ? 'pass' : 'unavailable', value || 'TR-01 prerequisite missing: Visual Studio C++ workload/CMake and SDK 10.0.26100.0');
}
// Never require('electron') during inventory: newer packages download implicitly.
let electron = { command: [], status: null, stdout: '', stderr: 'Run node node_modules/electron/install.js to install the exact pinned binary explicitly' };
try {
  const electronDirectory = dirname(require.resolve('electron'));
  const electronPathFile = resolve(electronDirectory, 'path.txt');
  const electronPath = existsSync(electronPathFile) ? resolve(electronDirectory, 'dist', readFileSync(electronPathFile, 'utf8').trim()) : null;
  if (electronPath && existsSync(electronPath)) {
    electron = run(electronPath, ['-p', 'JSON.stringify(process.versions)'], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
  }
} catch (error) {
  electron.stderr = `TR-01 prerequisite: pnpm install --frozen-lockfile, then install the pinned Electron binary; ${error.message}`;
}
discovery.push(electron);
let electronRuntime = null;
try { if (electron.status === 0) electronRuntime = JSON.parse(electron.stdout); } catch { /* explicit check below */ }
check('Electron executable version tuple', electronRuntime ? 'pass' : 'unavailable', electronRuntime ? JSON.stringify(electronRuntime) : electron.stderr || 'Electron executable not available; install pinned Electron binary');
const smokePath = resolve(root, 'native/build/Release/lux_native_smoke.exe');
let smoke = null;
if (existsSync(smokePath)) { const execution = run(smokePath, []); discovery.push(execution); try { if (execution.status === 0) smoke = JSON.parse(execution.stdout); } catch {} }
check('native QPC smoke', smoke ? 'pass' : 'unavailable', smoke ? JSON.stringify(smoke) : 'Run pnpm native:build; inventory does not establish a successful native build');
check('host executable inventory', observed.host?.version ? 'pass' : 'unavailable', observed.host?.version ? `${observed.host.executable}: ${observed.host.version}` : 'TR-01 prerequisite: installed Resolume Avenue executable; LUX_PREFLIGHT_HOST can select its path');
for (const [name, reason] of [
  ['host plugin directory', 'Requires actual host preference observation; no host settings changed'],
  ['host refresh', 'Requires actual host/display measurement; inventory cannot prove 60 Hz'],
  ['adapter selection', 'TR-02 must record renderer/bridge/host DXGI LUIDs and reject mismatch'],
  ['GPU timestamp queries', 'TR-02 must probe selected device feature, enable it, and establish full timing coverage'],
  ['trace capability', 'TR-02 must discover runtime trace categories and record selected process coverage'],
  ['external client image observation', 'Run pnpm test:mcp -- --profile-fixture, then record separate actual client image observation; automated image decoding is insufficient'],
]) check(name, 'unavailable', reason);
const pins = JSON.parse(readFileSync(resolve(root, 'config/dependency-pins.json'), 'utf8'));
const result = preflightSchema.parse({ schemaVersion: 1, sourceCommit: git.stdout,
  host: { executable: observed.host?.version ? observed.host.executable : null, version: observed.host?.version ?? null, refreshHz: null, pluginDirectory: null },
  adapters: { rendererLuid: null, bridgeLuid: null, hostLuid: null }, versions,
  mcp: { profile: '2025-11-25', client: null, imageObserved: false }, checks,
  capturedAt: new Date().toISOString(), sourceTreeDirty: gitStatus.stdout.length > 0,
  sourceFileHashes: Object.fromEntries(['package.json', 'pnpm-lock.yaml', 'scripts/preflight.mjs', 'scripts/collect-windows.ps1', 'scripts/native-build.ps1', 'native/CMakeLists.txt', 'native/smoke.cc', 'packages/runtime-contracts/src/telemetry.ts'].map(path => [path, createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex')])),
  inventory: observed, electronRuntime, nativeSmoke: smoke, dependencyPins: pins,
  build: { configuration: 'Release', architecture: 'x64', generator: 'Visual Studio 18 2026', toolset: 'v145,version=14.50.35717', windowsSdk: '10.0.26100.0' }, discovery,
});
const runId = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const output = resolve(root, 'evidence/tracer-0.1', runId); mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'environment.json'), JSON.stringify(result, null, 2) + '\n');
writeFileSync(resolve(output, 'preflight.md'), `# TR-01 preflight ${runId}\n\nSource: ${result.sourceCommit}\n\nDecision: ${integrationReady(result) ? 'PASS' : 'UNAVAILABLE — dependent integration gate remains blocked'}. Inventory and fixture success are not GPU/host acceptance.\n\n${checks.map(c => `- **${c.outcome}** ${c.name}: ${c.evidence}`).join('\n')}\n\nFull commands, outputs, source pins and version tuples are retained in environment.json.\n`);
console.log(`TR-01 evidence: ${output}`);
for (const c of checks) console.log(`${c.outcome.toUpperCase()}: ${c.name}: ${c.evidence}`);
process.exitCode = integrationReady(result) ? 0 : 2;
