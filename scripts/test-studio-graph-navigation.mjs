import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { nestedPrismaticCompositionSource } from '../tests/studio/fixtures/nested-prismatic-composition/source-bundle.mjs';
import { installedElectron } from './studio-electron.mjs';
import { studioTestEnvironment, resolveStudioSession } from './studio-session.mjs';

const root = resolve(import.meta.dirname, '..');
const output = join(root, 'artifacts', 'graph-navigation', `run-${Date.now()}`);
await mkdir(output, { recursive: true });
const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath };
const session = resolveStudioSession({ workspace: root, env });
const runPlain = !process.argv.includes('--composition'), runComposition = !process.argv.includes('--plain');
const report = { ok: false, root, profile: session.profile, checks: [], errors: [], screenshots: [] };
let app, client, page;
const save = () => writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2));
try {
  report.stage = 'launching isolated Studio'; await save();
  app = await _electron.launch({ executablePath: installedElectron(root), args: [join(process.env.LUX_STUDIO_DIST || join(root, 'apps/studio/dist'), 'main.cjs')], cwd: root, env, timeout: 30000 });
  page = await app.firstWindow(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  const pid = await app.evaluate(() => process.pid);
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { endpoint = JSON.parse(await readFile(session.endpointPath, 'utf8')); if (endpoint.pid === pid) break; } catch {}
    await page.waitForTimeout(100);
  }
  assert.equal(endpoint?.pid, pid, 'the adapter must bind only to this test-owned Studio process');
  client = new Client({ name: 'graph-navigation-qa', version: '1' });
  const adapterEnv = { ...env, LUX_STUDIO_SESSION_ID: endpoint.sessionId };
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(root, 'scripts/studio-mcp.mjs')], cwd: root, env: adapterEnv }));
  const call = async (name, args = {}) => {
    const result = await client.callTool({ name: `lux.studio.${name}`, arguments: args }, undefined, { timeout: 90000 });
    assert.ok(!result.isError, JSON.stringify(result));
    return JSON.parse(result.content.find(item => item.type === 'text').text);
  };
  const graph = async () => { await page.getByRole('button', { name: 'View', exact: true }).click(); await page.getByRole('menuitem', { name: 'Graph', exact: true }).click(); };
  const capture = async name => { const path = join(output, `${name}.png`); await page.screenshot({ path }); report.screenshots.push(path); };
  let draft;
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('slider', { name: 'Preview resolution scale', exact: true }).focus();
  await page.keyboard.press('Home');
  const readyDeadline = Date.now() + 60000;
  let ready = false;
  while (Date.now() < readyDeadline) {
    const state = await call('status');
    if (state.authoring?.output.width === 640 && ['playing', 'paused'].includes(state.authoring?.playback)) { ready = true; break; }
    await page.waitForTimeout(100);
  }
  assert.ok(ready, 'wait for the small preview replacement to finish');
  await page.waitForTimeout(200);

  if (runPlain) {
  await page.setViewportSize({ width: 1360, height: 900 });
  report.stage = 'checking plain Scene root'; await save();
  draft = await call('read');
  assert.equal(draft.status.authoring.composition, undefined, 'fresh profile starts with a plain defineVisual scene');
  await graph();
  const breadcrumb = page.getByRole('navigation', { name: 'Component breadcrumb' });
  await breadcrumb.waitFor(); assert.equal(await page.locator('.graph-node').count(), 1);
  assert.equal(await page.locator('.graph-scene-root').count(), 0);
  assert.equal(await breadcrumb.getByRole('button').count(), 0, 'current location is a label, not a redundant action');
  assert.equal(await page.locator('.graph-toolbar').getByRole('button', { name: 'Scene controls', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'View inside', exact: true }).count(), 0);
  await capture('plain-scene-root');
  await page.setViewportSize({ width: 820, height: 720 });
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  const narrow = await page.getByRole('navigation', { name: 'Component breadcrumb' }).evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth }));
  assert.ok(narrow.scroll <= narrow.width + 1, 'Scene breadcrumb fits the narrow Graph panel');
  await capture('plain-scene-narrow');
  report.checks.push('Plain defineVisual opens inside Scene with one Visual card, a plain location label, no redundant settings buttons, and a breadcrumb fitting an 820px window');
  }

  if (runComposition) {
  await page.setViewportSize({ width: 1360, height: 900 });
  report.stage = 'checking composition navigation'; await save();
  draft = await call('read');
  const compositionBuild = await call('build', { expectedDraftVersion: draft.draftVersion, source: nestedPrismaticCompositionSource() });
  assert.ok(compositionBuild.status.authoring.composition, 'fixture is an accepted nested composition');
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor({ timeout: 60000 });
  if (!runPlain) await graph();
  const component = page.locator('.graph-node').filter({ hasText: 'Double mirror 1' });
  await component.waitFor(); assert.equal(await page.locator('.graph-node').count(), 3);
  assert.equal(await page.getByRole('button', { name: 'View inside', exact: true }).count(), 0);
  await capture('composition-scene-children');
  await component.focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('.graph-node').length === 2);
  await page.keyboard.press('Alt+ArrowUp');
  assert.equal(await page.locator('.graph-node').count(), 3, 'Enter then Alt+Up works without refocusing');
  await component.focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('.graph-node').length === 2);
  assert.ok(await page.getByRole('navigation', { name: 'Component breadcrumb' }).getByRole('button', { name: 'Scene', exact: true }).count());
  report.stage = 'checking nested breadcrumb navigation'; await save();
  const rootCrumb = page.getByRole('navigation', { name: 'Component breadcrumb' }).getByRole('button', { name: 'Scene', exact: true });
  await capture('nested-view');
  await page.locator('.graph-node').filter({ hasText: 'Wrapped mirror' }).dblclick();
  await page.waitForFunction(() => document.querySelectorAll('.graph-node').length === 1);
  await capture('nested-second-level');
  await page.setViewportSize({ width: 540, height: 720 });
  const trail = page.getByRole('navigation', { name: 'Component breadcrumb' });
  const ancestor = trail.getByRole('button', { name: 'Double mirror 1', exact: true });
  await ancestor.focus();
  assert.ok(await ancestor.evaluate(node => {
    const item = node.getBoundingClientRect(), viewport = node.closest('nav').getBoundingClientRect();
    return item.left >= viewport.left - 1 && item.right <= viewport.right + 1;
  }), 'keyboard focus scrolls the ancestor into the narrow trail');
  await capture('nested-narrow');
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.graph-node').count(), 2);
  assert.ok(await page.getByLabel('Graph canvas', { exact: true }).evaluate(node => node === document.activeElement), 'ancestor activation retains focus in Graph');
  await page.keyboard.press('Alt+ArrowUp');
  assert.equal(await page.locator('.graph-node').count(), 3, 'ancestor activation then Alt+Up works without refocusing');
  await component.focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('.graph-node').length === 2);
  await rootCrumb.focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('.graph-node').count(), 3);
  await component.click();
  await page.getByRole('button', { name: 'View inside', exact: true }).click();
  await page.keyboard.press('Alt+ArrowUp');
  assert.equal(await page.locator('.graph-node').count(), 3);
  await page.getByLabel('Graph canvas', { exact: true }).focus();
  await page.keyboard.press('Alt+ArrowUp');
  assert.equal(await page.locator('.graph-node').count(), 3, 'Alt+Up at Scene remains at root');
  report.checks.push('Composition opens with its immediate children; Enter, double-click and View inside navigate down two levels; ancestor breadcrumbs and Alt+Up navigate up without duplicate Scene or Back buttons, including a narrow nested view');
  }
  assert.deepEqual(report.errors, []);
  report.ok = true;
} catch (error) {
  report.error = String(error.stack ?? error);
  if (page && !page.isClosed()) await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {});
  process.exitCode = 1;
} finally {
  await client?.close();
  await save();
  if (app) {
    app.process().kill();
    await Promise.race([app.close(), new Promise(resolve => setTimeout(resolve, 5000))]);
  }
  console.log(JSON.stringify({ output, ...report }, null, 2));
}
