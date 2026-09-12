import assert from 'node:assert/strict';
import { _electron } from 'playwright';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = join(root, 'artifacts/studio-ui/docking');
await mkdir(output, { recursive: true });
const env = { ...process.env, LUX_NODE_EXECUTABLE: process.execPath, LUX_STUDIO_MCP_TEST: '1' };
delete env.ELECTRON_RUN_AS_NODE;
const report = { ok: false, checks: [], errors: [] };
let app, page;
try {
  app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'),
    args: [join(root, 'apps/studio/dist/main.cjs')], cwd: root, env, chromiumSandbox: true });
  page = await app.firstWindow(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /Content Security Policy|Refused to (apply|execute|load)/i.test(message.text())) report.errors.push(message.text()); });
  const tools = page.locator('.layout-tools');
  async function menu() { if (!await tools.evaluate(node => node.open)) await tools.locator('summary').click(); }
  async function done() {
    if (await tools.evaluate(node => node.open)) await tools.locator('summary').click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  async function action(name) { await menu(); await page.getByRole('button', { name, exact: true }).click(); await done(); }
  async function sameOwners() {
    assert.equal(await page.evaluate(() => window.__dockCanvas === document.querySelector('.preview-surface canvas')), true);
    assert.equal(await page.evaluate(() => window.__dockEditor === document.querySelector('.cm-editor')), true);
    assert.equal(await page.locator('.preview-surface canvas').count(), 1);
  }
  await menu(); await page.getByRole('textbox', { name: 'Layout name', exact: true }).fill('Automated Dock QA');
  await page.getByRole('button', { name: 'Reset desktop layout', exact: true }).click(); await done();
  await page.getByRole('button', { name: 'Build & preview', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.playback-state')?.textContent === 'paused');
  await page.locator('.cm-editor').waitFor();
  await page.evaluate(() => { window.__dockCanvas = document.querySelector('.preview-surface canvas'); window.__dockEditor = document.querySelector('.cm-editor'); });
  await page.screenshot({ path: join(output, 'desktop.png') });
  await action('Save layout');
  // Move via the accessible operation, then restore real persisted geometry.
  const sourceBefore = await page.locator('.studio-pane-source').boundingBox();
  await menu(); await page.getByLabel('Move panel', { exact: true }).selectOption('source');
  await page.getByLabel('Relative to', { exact: true }).selectOption('preview');
  await page.getByRole('button', { name: 'Move to tab group', exact: true }).click(); await done();
  await action('Restore layout');
  await sameOwners();
  const sourceRestored = await page.locator('.studio-pane-source').boundingBox();
  report.restoredBounds = { before: sourceBefore, after: sourceRestored };
  assert.ok(sourceBefore && sourceRestored);
  for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(sourceBefore[key] - sourceRestored[key]) < 2, `restored ${key}`);
  report.checks.push('Saved desktop arrangement restores actual pane bounds and original canvas/editor');
  // Exercise Dockview's actual pointer strategy, not only its accessible move action.
  const sourceTab = await page.locator('.dv-tab').filter({ hasText: /^Source$/ }).boundingBox();
  const previewPane = await page.locator('.studio-pane-preview').boundingBox();
  assert.ok(sourceTab && previewPane);
  await page.mouse.move(sourceTab.x + 25, sourceTab.y + sourceTab.height / 2);
  await page.mouse.down();
  await page.mouse.move(previewPane.x + previewPane.width / 2, previewPane.y + previewPane.height / 2, { steps: 25 });
  await page.mouse.up();
  await page.waitForFunction(() => {
    const tabs = [...document.querySelectorAll('.dv-tab')];
    const group = title => tabs.find(tab => tab.textContent.trim() === title)?.closest('.dv-groupview');
    return group('Source') && group('Source') === group('Preview');
  });
  await sameOwners(); await action('Restore layout');
  report.checks.push('Actual pointer drag docks Source as a Preview tab and restores without replacing owners');
  const sourceSize = await page.locator('.studio-pane-source').boundingBox();
  const sash = await page.locator('.dv-sash').evaluateAll((nodes, right) => {
    return nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })
      .find(r => r.height > 100 && r.width > 0 && r.width < 20 && Math.abs(r.x - right) < 12);
  }, sourceSize.x + sourceSize.width);
  assert.ok(sash, 'visible divider next to Source');
  await page.mouse.move(sash.x + sash.width / 2, sash.y + sash.height / 2);
  await page.mouse.down(); await page.mouse.move(sash.x + 65, sash.y + sash.height / 2, { steps: 15 }); await page.mouse.up();
  await page.waitForFunction(width => Math.abs(document.querySelector('.studio-pane-source').getBoundingClientRect().width - width) > 20, sourceSize.width);
  await sameOwners(); await action('Restore layout');
  report.checks.push('Actual pointer split resizing changes pane width and retains output/editor');
  await menu(); await page.getByLabel('Move panel', { exact: true }).selectOption('preview');
  await page.getByRole('button', { name: 'Close selected panel', exact: true }).click(); await done();
  assert.equal(await page.locator('.preview-surface canvas').count(), 0);
  await action('Open Preview'); await sameOwners();
  report.checks.push('Closing and reopening Preview retains the original live canvas');
  await action('Reset laptop layout');
  await action('Open Source');
  await page.getByRole('textbox', { name: 'TypeScript source visual.ts', exact: true }).focus();
  await action('Open Preview');
  await sameOwners();
  await page.screenshot({ path: join(output, 'laptop-tabs.png') });
  report.checks.push('Laptop tabs switch between real Source and Preview with owners intact');
  await action('Reset desktop layout');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.playback-state')?.textContent === 'playing');
  const firstImage = await page.locator('.preview-surface canvas').screenshot();
  await page.waitForTimeout(350);
  const nextImage = await page.locator('.preview-surface canvas').screenshot();
  assert.notDeepEqual(firstImage, nextImage, 'actual rendered animation advances after pane movement');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.playback-state')?.textContent === 'paused');
  await sameOwners();
  report.checks.push('Actual GPU preview keeps animating after close/reopen and layout changes');
  await page.screenshot({ path: join(output, 'final.png') });
  assert.deepEqual(report.errors, []);
  report.ok = true;
} catch (error) {
  report.failure = error.stack || String(error);
  if (page && !page.isClosed()) await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  if (page && !page.isClosed()) await page.evaluate(() => localStorage.removeItem('lux.personal-layout.v1.Automated%20Dock%20QA')).catch(() => {});
  await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2));
  if (app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
}
console.log(JSON.stringify(report, null, 2));
