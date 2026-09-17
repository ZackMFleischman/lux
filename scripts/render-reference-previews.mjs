import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright';
import { installedElectron } from './studio-electron.mjs';
import { studioTestEnvironment, resolveStudioSession, createStudioConnection } from './studio-session.mjs';

const root = resolve(import.meta.dirname, '..');
const [input, label = 'preview'] = process.argv.slice(2);
if (!input) throw Error('Supply a prepared source JSON path and output label');
const output = join(root, 'artifacts/background', `${label}-${Date.now()}`);
await mkdir(output, { recursive: true });
const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath, LUX_WORKSPACE: root };
const session = resolveStudioSession({ workspace: root, env });
const call = createStudioConnection(session, { timeoutMs: 75000 });
const wrapper = join(output, 'hidden-main.cjs');
// Test-only presentation wrapper. It keeps the actual Studio renderer, source
// admission and GPU worker intact, but never shows or focuses a desktop window.
await writeFile(wrapper, `const {app,BrowserWindow}=require('electron');
BrowserWindow.prototype.show=function(){};
BrowserWindow.prototype.focus=function(){};
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.on('browser-window-created',(_event,window)=>window.webContents.setBackgroundThrottling(false));
require(${JSON.stringify(join(root, 'apps/studio/dist/main.cjs'))});
`);
let app;
const report = { label, profile: session.profile, checks: [], errors: [] };
try {
  app = await _electron.launch({ executablePath: installedElectron(root), args: [wrapper], cwd: root, env, timeout: 30000, chromiumSandbox: true });
  app.process().stderr.on('data', data => void appendFile(join(output, 'stderr.log'), data));
  const page = await app.firstWindow();
  page.on('console', event => void appendFile(join(output, 'console.log'), event.type() + ': ' + event.text() + '\n'));
  let current;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { current = await call('read'); if (current?.source) break; } catch {}
    await new Promise(done => setTimeout(done, 200));
  }
  assert.ok(current?.source, 'isolated Studio is ready');
  for (let attempt = 0; attempt < 100; attempt++) {
    const status = await call('status');
    if (status.authoring?.revisionId && status.authoring?.frameId) break;
    await new Promise(done => setTimeout(done, 150));
  }
  current = await call('read');
  const source = JSON.parse(await readFile(resolve(input), 'utf8'));
  console.log(`Building ${label} in ${session.profile}`);
  const build = await call('build', { source, expectedDraftVersion: current.draftVersion });
  await writeFile(join(output, 'build.json'), JSON.stringify(build, null, 2));
  assert.ok(build.status?.authoring?.revisionId && !build.status?.authoring?.fault, JSON.stringify(build));
  await new Promise(done => setTimeout(done, 1500));
  let status = await call('status');
  assert.ok(status.authoring?.revisionId && !status.authoring?.fault, JSON.stringify(status));
  report.checks.push('source admitted and GPU runtime started');
  for (let index = 0; index < 2; index++) {
    const captured = await call('capture');
    assert.ok(captured.base64, 'actual GPU frame returned');
    await writeFile(join(output, `frame-${index}.png`), Buffer.from(captured.base64, 'base64'));
    await writeFile(join(output, `frame-${index}.json`), JSON.stringify(captured.metadata, null, 2));
    console.log(`Capture: ${join(output, `frame-${index}.png`)}`);
    if (!index) await new Promise(done => setTimeout(done, 1200));
  }
  current = await call('read');
  const scenePath = join(output, `${label}.lux-scene`);
  await call('scene.save', { path: scenePath, expectedDraftVersion: current.draftVersion, overwrite: false });
  status = await call('status');
  assert.ok(!status.authoring?.fault, 'captured preview has no runtime fault');
  report.checks.push('scene saved in isolated test folder; reopen is a separate check');
  await writeFile(join(output, 'status.json'), JSON.stringify(status, null, 2));
  console.log(`Report: ${output}`);
} catch (error) {
  report.errors.push(error.stack ?? String(error));
  console.error(error.stack ?? error);
  process.exitCode = 1;
} finally {
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  if (app) {
    try { await call('status', { shutdown: true }); } catch {}
    try { await app.close(); } catch {}
  }
}
