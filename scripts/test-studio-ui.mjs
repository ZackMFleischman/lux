import assert from 'node:assert/strict';
import { _electron } from 'playwright';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import packageIO from '../packages/export/src/package.cjs';

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
  page.on('console', message => { if (message.type() === 'error' && /Content Security Policy|Refused to (apply|execute|load)/i.test(message.text())) report.errors.push(message.text()); });
  async function layoutAction(name) {
    await page.getByText('View & layouts', { exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByText('View & layouts', { exact: true }).click();
  }
  await page.getByText('View & layouts', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Layout name', exact: true }).fill('Automated UI QA');
  await page.getByRole('button', { name: 'Reset desktop layout', exact: true }).click();
  await page.getByText('View & layouts', { exact: true }).click();
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
  await layoutAction('Open Source');
  await page.locator('.cm-editor').waitFor();
  assert.equal(await page.getByText(/Editor unavailable:/).count(), 0);
  await page.getByRole('textbox', { name: 'New TypeScript file', exact: true }).fill('lib/qa-helper.ts');
  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  const helper = page.getByRole('textbox', { name: 'TypeScript source lib/qa-helper.ts', exact: true });
  await helper.fill('export const amount: number = 0.42;');
  await page.waitForFunction(() => new Set(Array.from(document.querySelectorAll('.cm-content span')).map(element => getComputedStyle(element).color)).size > 1);
  const sourceContrast = await page.evaluate(() => {
    const luminance = rgb => rgb.map(value => { const s = value / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
    const background = luminance([17, 18, 23]);
    return Array.from(document.querySelectorAll('.cm-content span')).map(element => {
      const color = getComputedStyle(element).color.match(/[\d.]+/g).slice(0, 3).map(Number);
      return (luminance(color) + 0.05) / (background + 0.05);
    });
  });
  assert.ok(sourceContrast.every(ratio => ratio >= 4.5), 'Syntax colors must remain readable on the dark editor');
  await page.getByRole('button', { name: 'Close lib/qa-helper.ts', exact: true }).click();
  await page.getByRole('button', { name: 'Open lib/qa-helper.ts', exact: true }).click();
  assert.equal(await helper.innerText(), 'export const amount: number = 0.42;');
  await helper.press('ControlOrMeta+End');
  await page.keyboard.type(' // retained undo');
  await page.getByRole('tab', { name: /^visual.ts/ }).click();
  await page.getByRole('tab', { name: /^lib\/qa-helper.ts/ }).click();
  await helper.press('ControlOrMeta+z');
  assert.equal(await helper.innerText(), 'export const amount: number = 0.42;');
  assert.equal(await page.evaluate(() => window.__qaCanvas === document.querySelector('.preview-surface canvas')), true);
  await page.screenshot({ path: join(output, 'source-editor.png') });
  report.checks.push('Real CodeMirror syntax colors under CSP; helper draft and undo survive tabs and close/reopen without replacing preview');
  // Supply only the native folder-picker response. The renderer, trusted IPC,
  // child compiler and real package writer all run normally.
  const exportDirectory = join(output, 'exports');
  await mkdir(exportDirectory, { recursive: true });
  await app.evaluate(({ dialog }, directory) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] }); }, exportDirectory);
  await page.getByRole('button', { name: 'Export for Resolume', exact: true }).click();
  await page.getByRole('textbox', { name: 'Source name', exact: true }).fill('Lux UI acceptance');
  await page.getByRole('button', { name: 'Choose folder and export', exact: true }).click();
  await page.getByText('Source package created.', { exact: true }).waitFor({ timeout: 90000 });
  const packagePath = await page.getByRole('textbox', { name: 'Package location', exact: true }).inputValue();
  const exported = packageIO.validatePackage(packagePath);
  assert.equal(exported.release.name, 'Lux UI acceptance');
  assert.equal(exported.release.savedControls.intensity, 0.08);
  assert.ok(exported.runtime.files.some(file => file.path === 'install-gui.cjs'));
  assert.ok(exported.runtime.files.some(file => file.path === 'apps/installed-runtime/src/supervisor.cjs'));
  report.export = { path: packagePath, releaseId: exported.release.releaseId, runtimeId: exported.release.runtimeId, files: exported.runtime.files.length };
  await page.screenshot({ path: join(output, 'export.png') });
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  report.checks.push('Studio exports the validated draft and applied intensity through real IPC/compiler/package writer; native folder-picker response supplied by test');
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
