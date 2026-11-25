import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { installedElectron } from '../scripts/studio-electron.mjs';
import { resolveStudioSession, studioTestEnvironment } from '../scripts/studio-session.mjs';

const root = resolve(import.meta.dirname, '..');
const output = join(root, 'artifacts', 'inspector-group-style', `run-${Date.now()}`);
await mkdir(output, { recursive: true });
const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath };
const session = resolveStudioSession({ workspace: root, env });
const report = { ok: false, root, profile: session.profile, checks: [], errors: [] };
let app, client;
try {
  app = await _electron.launch({ executablePath: installedElectron(root), args: [join(root, 'apps/studio/dist/main.cjs')], cwd: root, env, timeout: 30000 });
  const page = await app.firstWindow();
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.getByRole('button', { name: 'Build', exact: true }).waitFor();
  const ownedPid = await app.evaluate(() => process.pid);
  let endpoint;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { endpoint = JSON.parse(await readFile(session.endpointPath, 'utf8')); if (endpoint.pid === ownedPid) break; } catch {}
    await page.waitForTimeout(100);
  }
  assert.equal(endpoint?.pid, ownedPid, 'The adapter only connects to this owned test Studio');
  client = new Client({ name: 'inspector-group-style-qa', version: '1' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(root, 'scripts/studio-mcp.mjs')], cwd: root, env }));
  const raw = (name, args = {}) => client.callTool({ name: `lux.studio.${name}`, arguments: args }, undefined, { timeout: 75000 });
  const call = async (name, args = {}) => {
    const response = await raw(name, args);
    assert.equal(response.isError, undefined, JSON.stringify(response));
    return JSON.parse(response.content.find(part => part.type === 'text').text);
  };
  let draft = await call('read');
  let visual = await readFile(join(root, 'skills/lux-visual-creation/assets/noise-sphere.ts'), 'utf8');
  visual = visual.replace("group: 'Shape', default: 0.85", "group: 'Bird Personality', default: 0.85")
    .replace("group: 'Shape', default: 3.4", "group: 'Bird Appearance', default: 3.4")
    .replace("group: 'Shape', default: 3.2", "group: 'Bird Flight', default: 3.2")
    .replace("label: 'Motion speed', default: 0.28", "label: 'Flight motion', group: 'Bird Flight', default: 0.28")
    .replace("label: 'Roughness', default: 0.38", "label: 'Feather softness', group: 'Bird Appearance', default: 0.38");
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Build"]:disabled'), undefined, { timeout: 60000 });
  let built;
  for (let attempt = 0; attempt < 80; attempt++) {
    const buildInput = { expectedDraftVersion: draft.draftVersion, source: { sdkVersion: '0.2.0', entry: 'visual.ts', files: { 'visual.ts': visual } } };
    const response = await raw('build', buildInput);
    if (!response.isError) { built = JSON.parse(response.content.find(part => part.type === 'text').text); break; }
    const message = response.content.find(part => part.type === 'text')?.text ?? '';
    if (message === 'Editor changed; read its source again before building') { draft = await call('read'); continue; }
    if (message !== 'Studio is busy or command is unsupported') throw Error(message);
    await page.waitForTimeout(250);
  }
  assert.ok(built, 'Studio leaves its initial composition phase before the build retry limit');
  await page.setViewportSize({ width: 1200, height: 780 });
  const groups = page.locator('details.parameter-group');
  assert.equal(await groups.count(), 3);
  const birdGroups = groups;
  report.groups = await birdGroups.evaluateAll(nodes => nodes.map(group => {
    const summary = group.querySelector('summary');
    const controls = group.querySelector('.parameter-group-controls');
    return {
      label: summary?.textContent?.trim(),
      fontSize: summary && getComputedStyle(summary).fontSize,
      border: getComputedStyle(group).border,
      groupBackground: getComputedStyle(group).backgroundColor,
      controlsBackground: controls && getComputedStyle(controls).backgroundColor,
      divider: summary && getComputedStyle(summary).borderBottomWidth,
    };
  }));
  assert.ok(report.groups.every(group => group.fontSize === '13px'));
  assert.ok(report.groups.every(group => group.border.includes('1px')));
  assert.ok(report.groups.every(group => group.divider === '1px'));
  assert.ok(report.groups.every(group => group.controlsBackground === group.groupBackground));
  const firstSummary = birdGroups.first().locator('summary');
  await firstSummary.focus();
  await firstSummary.click();
  assert.equal(await birdGroups.first().evaluate(node => node.open), false);
  await firstSummary.click();
  assert.equal(await birdGroups.first().evaluate(node => node.open), true);
  const runtime = (await call('status')).authoring;
  assert.equal(runtime.fault, null);
  report.normalPreview = await page.locator('.preview-surface').evaluate(node => ({ width: Math.round(node.getBoundingClientRect().width), height: Math.round(node.getBoundingClientRect().height) }));
  assert.ok(report.normalPreview.width >= 640 && report.normalPreview.height >= 360, 'Normal capture includes a 640x360-or-larger Preview area');
  await page.screenshot({ path: join(output, 'normal-inspector-groups.png') });
  await page.setViewportSize({ width: 820, height: 650 });
  await page.screenshot({ path: join(output, 'narrow-inspector-groups.png') });
  report.inspector = await page.locator('.inspector').evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth }));
  assert.ok(report.inspector.scrollWidth <= report.inspector.width + 1);
  report.checks = ['Three populated Bird groups use 13px headings and continuous one-pixel outlines', 'Open group header has a divider and controls have a lighter grouped surface', 'Collapse and re-expand preserve native details interaction without a runtime fault', 'Normal and narrow actual Studio screenshots fit the Inspector without horizontal overflow'];
  assert.deepEqual(report.errors, []);
  report.ok = true;
} catch (error) {
  report.error = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  await client?.close();
  if (app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
  await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, ...report }, null, 2));
}
