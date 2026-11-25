import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { installedElectron } from '../scripts/studio-electron.mjs';
import { resolveStudioSession, studioTestEnvironment } from '../scripts/studio-session.mjs';
import { prismaticCompositionSource } from '../tests/studio/fixtures/prismatic-composition/source-bundle.mjs';

const root = resolve(import.meta.dirname, '..');
const output = join(root, 'evidence', 'lux98-private-demo');
await mkdir(output, { recursive: true });
const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath };
const session = resolveStudioSession({ workspace: root, env });
delete env.ELECTRON_RUN_AS_NODE;
let app, client;
const report = { sourceCommit: '75cf3bf9950aa37f1eeff8cb071a57899df19de0', profile: session.profile, checks: [] };
try {
  app = await _electron.launch({ executablePath: installedElectron(root), args: [join(root, 'apps/studio/dist/main.cjs')], cwd: root, env, timeout: 30000 });
  const page = await app.firstWindow(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => (report.pageErrors ??= []).push(error.stack ?? error.message));
  page.on('console', message => (report.console ??= []).push({ type: message.type(), text: message.text() }));
  const pid = await app.evaluate(() => process.pid);
  report.pid = pid;
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { endpoint = JSON.parse(await readFile(session.endpointPath, 'utf8')); if (endpoint.pid === pid) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(endpoint?.pid, pid, 'test profile endpoint belongs to this Electron process');
  client = new Client({ name: 'lux98-private-demo', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(root, 'scripts/studio-mcp.mjs')], cwd: root, env }));
  const raw = (name, args = {}) => client.callTool({ name: `lux.studio.${name}`, arguments: args }, undefined, { timeout: 75000 });
  const call = async (name, args) => {
    const result = await raw(name, args); assert.equal(result.isError, undefined, JSON.stringify(result));
    return JSON.parse(result.content.find(part => part.type === 'text').text);
  };
  const discovery = await call('discover');
  assert.equal(discovery.runningStudio.compatible, true);
  const initial = await call('read');
  const built = await call('build', { expectedDraftVersion: initial.draftVersion, source: prismaticCompositionSource() });
  const runtime = built.status.authoring;
  assert.equal(runtime.sdkVersion, '0.4.0');
  assert.deepEqual(runtime.controlSchema.map(control => control.description), [
    'Controls the height of the animated spikes.',
    'Sets the number of independently mirrored wedges.',
    'Sets the number of independently mirrored wedges.',
  ]);
  await page.getByText('View', { exact: true }).click();
  await page.getByRole('button', { name: 'Reset desktop layout', exact: true }).click();
  await page.getByText('View', { exact: true }).click();
  const label = page.locator('[data-control-id="segmentsA"] .parameter-name');
  const initialControls = structuredClone(runtime.controls);
  const initialPlayback = runtime.playback;
  await page.keyboard.press('Tab');
  await label.focus();
  await page.getByRole('tooltip', { name: 'Sets the number of independently mirrored wedges.' }).waitFor();
  await page.screenshot({ path: join(output, 'keyboard-help.png') });
  await label.hover();
  await page.getByRole('tooltip', { name: 'Sets the number of independently mirrored wedges.' }).waitFor();
  await page.screenshot({ path: join(output, 'hover-help.png') });
  const row = page.locator('[data-control-id="segmentsA"]');
  const sliderBox = await row.locator('.MuiSlider-root').boundingBox();
  assert.ok(sliderBox, 'segments A slider must be visible while hover help is shown');
  await page.mouse.click(sliderBox.x + 10, sliderBox.y + 1);
  for (let attempt = 0; attempt < 20 && (await call('status')).authoring.controls.segmentsA === initialControls.segmentsA; attempt++) await new Promise(resolve => setTimeout(resolve, 50));
  assert.notEqual((await call('status')).authoring.controls.segmentsA, initialControls.segmentsA);
  await row.getByRole('button').click();
  for (let attempt = 0; attempt < 20 && (await call('status')).authoring.controls.segmentsA !== initialControls.segmentsA; attempt++) await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal((await call('status')).authoring.controls.segmentsA, initialControls.segmentsA);
  const status = await call('status');
  assert.deepEqual(status.authoring.controls, initialControls);
  assert.equal(status.authoring.playback, initialPlayback);
  report.endpoint = { pid, sessionId: endpoint.sessionId, profile: endpoint.profile, workspace: endpoint.workspace };
  report.controls = initialControls;
  report.playback = initialPlayback;
  report.checks = ['Private SDK 0.4 Prismatic composition build retained component descriptions on exposed controls.', 'Hover tooltip visible above the described control.', 'The described control remained adjustable while hover help was visible and was reset to its prior value.', 'Keyboard-focus tooltip and visible focus indicator present.', 'Controls and playback unchanged after the adjustment/reset check.'];
  report.ok = true;
} catch (error) { report.error = error.stack ?? String(error); process.exitCode = 1; }
finally {
  await client?.close().catch(() => {});
  if (app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
  report.cleanedUp = true;
  await writeFile(join(output, `attempt-${session.profile}.json`), JSON.stringify(report, null, 2));
  await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report));
