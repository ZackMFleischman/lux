import assert from 'node:assert/strict';
import { _electron } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { installedElectron } from './studio-electron.mjs';
import { studioTestEnvironment, resolveStudioSession } from './studio-session.mjs';

const root = resolve(import.meta.dirname, '..');
const output = join(root, 'artifacts/studio-ui/diagnostics');
await mkdir(output, { recursive: true });
const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath };
resolveStudioSession({ workspace: root, env });
delete env.ELECTRON_RUN_AS_NODE;
const report = { ok: false, checks: [], errors: [] };
let app, page;
async function openView() { await page.getByRole('button', { name: 'View', exact: true }).click(); }
async function viewItem(name) { await openView(); await page.getByRole('menuitem', { name, exact: true }).click(); }
async function layouts() { await openView(); await page.getByRole('menuitem', { name: 'Layouts…', exact: true }).click(); }
try {
  app = await _electron.launch({ executablePath: installedElectron(root), args: [join(root, 'apps/studio/dist/main.cjs')], cwd: root, env, chromiumSandbox: true });
  page = await app.firstWindow(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  await layouts(); await page.getByRole('button', { name: 'Reset desktop layout', exact: true }).click(); await page.getByRole('button', { name: 'Done', exact: true }).click(); await page.getByRole('dialog', { name: 'Workspace layouts' }).waitFor({ state: 'detached' });
  const inspector = page.locator('.studio-pane-inspector');
  const diagnostics = page.locator('.studio-pane-diagnostics');
  await viewItem('Diagnostics');
  await expectVisible(diagnostics); await expectVisible(inspector);
  for (const heading of ['Performance', 'Runtime', 'Host output']) assert.equal(await diagnostics.getByText(heading, { exact: true }).count(), 1);
  for (const heading of ['Performance', 'Runtime', 'Host output']) assert.equal(await inspector.getByText(heading, { exact: true }).count(), 0);
  await page.screenshot({ path: join(output, 'desktop-diagnostics.png') });
  report.checks.push('Desktop Diagnostics contains Performance, Runtime, and Host output while Inspector contains only controls');
  await layouts(); await page.getByRole('textbox', { name: 'Layout name', exact: true }).fill('Diagnostics QA'); await page.getByRole('button', { name: 'Save layout', exact: true }).click(); await page.getByRole('button', { name: 'Done', exact: true }).click(); await page.getByRole('dialog', { name: 'Workspace layouts' }).waitFor({ state: 'detached' });
  const tab = page.locator('.dv-tab').filter({ hasText: /^Diagnostics$/ });
  await tab.locator('.dv-default-tab-action').click(); await diagnostics.waitFor({ state: 'detached' });
  await viewItem('Diagnostics'); await expectVisible(diagnostics);
  report.checks.push('View closes and reopens Diagnostics');
  await tab.locator('.dv-default-tab-action').click(); await diagnostics.waitFor({ state: 'detached' });
  await layouts(); await page.getByRole('textbox', { name: 'Layout name', exact: true }).fill('Diagnostics QA'); await page.getByRole('button', { name: 'Restore layout', exact: true }).click(); await page.getByRole('button', { name: 'Done', exact: true }).click(); await page.getByRole('dialog', { name: 'Workspace layouts' }).waitFor({ state: 'detached' });
  await expectVisible(diagnostics);
  report.checks.push('Saved layout restores Diagnostics after it was closed');
  await page.setViewportSize({ width: 820, height: 720 }); await page.screenshot({ path: join(output, 'narrow-diagnostics.png') });
  await openView(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape');
  report.checks.push('Narrow layout and keyboard View menu dismissal remain usable');
  assert.deepEqual(report.errors, []); report.ok = true;
} catch (error) {
  report.failure = error.stack ?? String(error); if (page && !page.isClosed()) await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {}); throw error;
} finally {
  if (page && !page.isClosed()) await page.evaluate(() => localStorage.removeItem('lux.personal-layout.v1.Diagnostics%20QA')).catch(() => {});
  if (app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
  await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2));
}
async function expectVisible(locator) { await locator.waitFor(); assert.equal(await locator.isVisible(), true); }
