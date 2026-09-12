import assert from 'node:assert/strict';
import { _electron } from 'playwright';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'artifacts/studio-ui');
await mkdir(output, { recursive: true });
const env = { ...process.env, LUX_NODE_EXECUTABLE: process.execPath, LUX_STUDIO_MCP_TEST: '1' };
delete env.ELECTRON_RUN_AS_NODE;
let app, page;
const report = { ok: false, checks: [], errors: [] };
try {
  app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'),
    args: [join(root, 'apps/studio/dist/main.cjs')], cwd: root, env, timeout: 30000,
    chromiumSandbox: true });
  page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.getByRole('button', { name: 'Build & preview', exact: true }).click();
  await page.locator('.preview-surface canvas').waitFor();
  await page.waitForFunction(() => !document.querySelector('.preview-empty') && document.querySelector('.playback-state')?.textContent === 'paused');
  report.checks.push('Real example builds and starts paused');
  await page.evaluate(() => {
    window.__qaCanvas = document.querySelector('.preview-surface canvas');
    window.__qaDisabled = [];
    window.__qaObserver = new MutationObserver(records => {
      for (const record of records) {
        const name = record.target.textContent;
        if (['Reset', 'Restart runtime'].includes(name) && record.attributeName === 'disabled') window.__qaDisabled.push(name);
      }
    });
    window.__qaObserver.observe(document.querySelector('.transport'), { subtree: true, attributes: true, attributeFilter: ['disabled'] });
  });
  const before = await page.locator('.preview-surface').boundingBox();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.playback-state')?.textContent === 'playing');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.playback-state')?.textContent === 'paused');
  }
  assert.deepEqual(await page.evaluate(() => window.__qaDisabled), []);
  assert.deepEqual(await page.locator('.preview-surface').boundingBox(), before);
  assert.equal(await page.getByText('Sending request…', { exact: true }).count(), 0);
  report.checks.push('Three real play/pause cycles: no reset/restart disabled transitions or preview relayout');
  const slider = page.getByRole('slider');
  await slider.focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
  await page.getByText('Applied value: 0.08', { exact: true }).waitFor();
  assert.deepEqual(await page.locator('.preview-surface').boundingBox(), before);
  assert.deepEqual(await page.evaluate(() => window.__qaDisabled), []);
  report.checks.push('Paused intensity changes preserve layout and transport state');
  await page.screenshot({ path: join(output, 'workspace.png') });
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
    await page.locator('.studio-preview-fullscreen').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Build & preview', exact: true }).isVisible(), false);
    assert.equal(await page.getByRole('button', { name: 'Play', exact: true }).isVisible(), false);
    const bounds = await page.locator('.studio-preview-fullscreen').boundingBox();
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    assert.deepEqual(bounds, { x: 0, y: 0, ...viewport });
    if (i === 0) {
      await page.getByText('Press Escape to exit fullscreen', { exact: true }).waitFor();
      await page.getByText('Press Escape to exit fullscreen', { exact: true }).waitFor({ state: 'detached', timeout: 6000 });
      await page.screenshot({ path: join(output, 'fullscreen.png') });
    }
    await page.keyboard.press('Escape');
    await page.locator('.studio-preview-fullscreen').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => window.__qaCanvas === document.querySelector('.preview-surface canvas')), true);
  }
  report.checks.push('Preview-only fullscreen, fading notice, first Escape exit and original canvas retention');
  assert.deepEqual(report.errors, []);
  report.ok = true;
  console.log('Studio native Electron UI checks passed:', report.checks.join('; '));
} catch (error) {
  report.failure = error.stack || String(error);
  if (page && !page.isClosed()) await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {});
  console.error(report.failure); process.exitCode = 1;
} finally {
  // Only this Playwright-launched application is closed; no user's session is attached.
  if (app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
  await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2));
}
