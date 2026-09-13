import { studioTestEnvironment, resolveStudioSession } from './studio-session.mjs';
import assert from 'node:assert/strict';
import { _electron } from 'playwright';
import { installedElectron } from './studio-electron.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import packageIO from '../packages/export/src/package.cjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'artifacts/studio-ui');
await mkdir(output, { recursive: true });
const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath };
const testSession = resolveStudioSession({ workspace: root, env });
delete env.ELECTRON_RUN_AS_NODE;
let app, page;
const report = { ok: false, checks: [], errors: [] };
try {
  app = await _electron.launch({ executablePath: installedElectron(root),
    args: [join(root, 'apps/studio/dist/main.cjs')], cwd: root, env, timeout: 30000,
    chromiumSandbox: true });
  page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /Content Security Policy|Refused to (apply|execute|load)/i.test(message.text())) {
      report.errors.push(message.text());
      (report.cspDetails ??= []).push({ after: report.checks.at(-1), location: message.location() });
      console.error(JSON.stringify(report.cspDetails.at(-1)));
    }
  });
  async function layoutAction(name) {
    await page.getByText('View', { exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByText('View', { exact: true }).click();
  }
  await page.getByText('View', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Layout name', exact: true }).fill('Automated UI QA');
  await page.getByRole('button', { name: 'Reset desktop layout', exact: true }).click();
  await page.getByText('View', { exact: true }).click();
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await page.locator('.preview-surface canvas').waitFor();
  await page.waitForFunction(() => !document.querySelector('.preview-empty') && document.querySelector('.playback-state')?.textContent === 'paused');
  report.checks.push('Real example builds and starts paused');
  const appBar = await page.locator('.app-bar').boundingBox(), transport = await page.locator('.transport').boundingBox();
  assert.ok(appBar && appBar.height <= 44, 'compact application bar');
  assert.ok(transport && transport.height <= 40, 'compact transport');
  assert.equal(await page.getByRole('button', { name: 'Pop out', exact: true }).count(), 0, 'unsupported popout is not an actionable control');
  report.compactGeometry = { appBar, transport };
  report.checks.push('Compact application and transport bars; unsupported popout action hidden');
  const previewArea = await page.locator('.preview-area').boundingBox();
  const previewSurface = await page.locator('.preview-surface').boundingBox();
  assert.ok(previewArea && previewSurface);
  assert.ok(Math.abs(previewArea.width - previewSurface.width) < 1 && Math.abs(previewArea.height - previewSurface.height) < 1,
    'Preview uses the full available area without a padded inner box');
  report.previewGeometry = { previewArea, previewSurface };
  report.checks.push('Preview fills the available pane and retains aspect-ratio containment');
  await page.evaluate(() => {
    window.__qaCanvas = document.querySelector('.preview-surface canvas');
    window.__qaDisabled = [];
    window.__qaObserver = new MutationObserver(records => {
      for (const record of records) {
        const name = record.target.getAttribute('aria-label') ?? record.target.textContent;
        if (['Play', 'Pause', 'Reset', 'More playback actions'].includes(name) && record.attributeName === 'disabled') window.__qaDisabled.push(name);
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
  report.checks.push('Three real play/pause cycles: no transport disabled transitions or preview relayout');
  const slider = page.getByRole('slider');
  await slider.focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
  await page.locator('[data-control-id="intensity"][data-applied-value="0.08"]').waitFor();
  assert.deepEqual(await page.locator('.preview-surface').boundingBox(), before);
  assert.deepEqual(await page.evaluate(() => window.__qaDisabled), []);
  report.checks.push('Paused intensity changes preserve layout and transport state');
  await page.evaluate(() => {
    window.__qaSliderValues = [];
    const slider = document.querySelector('input[type="range"]');
    window.__qaSliderObserver = new MutationObserver(() => window.__qaSliderValues.push(Number(slider.getAttribute('aria-valuenow'))));
    window.__qaSliderObserver.observe(slider, { attributes: true, attributeFilter: ['aria-valuenow'] });
  });
  const sliderBounds = await page.locator('.MuiSlider-root').boundingBox();
  assert.ok(sliderBounds);
  await page.mouse.move(sliderBounds.x + sliderBounds.width * 0.1, sliderBounds.y + sliderBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(sliderBounds.x + sliderBounds.width * 0.9, sliderBounds.y + sliderBounds.height / 2, { steps: 40 });
  await page.mouse.up();
  const draggedValue = Number(await slider.inputValue());
  await page.locator(`[data-control-id="intensity"][data-applied-value="${draggedValue}"]`).waitFor();
  const draggedValues = await page.evaluate(() => { window.__qaSliderObserver.disconnect(); return window.__qaSliderValues; });
  assert.ok(draggedValues.length > 10, 'Exercise continuous pointer changes, not one final jump');
  assert.ok(draggedValues.every((value, index) => index === 0 || value >= draggedValues[index - 1]), 'Earlier confirmations must not pull a rightward drag backwards');
  report.sliderDrag = { samples: draggedValues.length, first: draggedValues[0], last: draggedValues.at(-1) };
  report.checks.push('Real continuous slider drag stays monotonic while runtime acknowledgements arrive');
  await slider.focus(); await page.keyboard.press('Home');
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
  await page.locator('[data-control-id="intensity"][data-applied-value="0.08"]').waitFor();
  await page.screenshot({ path: join(output, 'workspace.png') });
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
    await page.locator('.studio-preview-fullscreen').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Build', exact: true }).isVisible(), false);
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
  await page.getByRole('button', { name: 'New file', exact: true }).click();
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
  const files = await page.locator('.source-files').boundingBox(), editing = await page.locator('.source-editing').boundingBox();
  assert.ok(files && editing && files.y + files.height <= editing.y + 1, 'File navigation stays above the editor');
  await helper.press('ControlOrMeta+s');
  await page.getByText('Preview current', { exact: true }).waitFor();
  assert.equal(await helper.innerText(), 'export const amount: number = 0.42;');
  assert.equal(await page.locator('.document-name [role="button"], .document-name button, .document-name summary').count(), 0);
  report.checks.push('Ctrl/Cmd+S builds the full source; file navigation stays compact and scene title is passive');
  await slider.focus(); await page.keyboard.press('Home');
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
  await page.locator('[data-control-id="intensity"][data-applied-value="0.08"]').waitFor();
  // Save and reopen the actual edited scene through the File commands. Only
  // native picker responses are supplied; source/control serialization is real.
  const savedScenePath = join(output, 'creative-workflow.lux-scene');
  await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, savedScenePath);
  await helper.press('ControlOrMeta+Shift+s');
  await page.waitForFunction(() => document.querySelector('.document-title')?.textContent === 'creative-workflow.lux-scene');
  const savedScene = JSON.parse(await readFile(savedScenePath, 'utf8'));
  assert.equal(savedScene.source.files['lib/qa-helper.ts'], 'export const amount: number = 0.42;');
  assert.equal(savedScene.controls.intensity, 0.08);
  await helper.fill('export const amount: number = 0.99;');
  page.on('dialog', () => report.errors.push('Unexpected native JavaScript dialog'));
  await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, savedScenePath);
  await page.locator('.file-tools summary').click();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByRole('button', { name: 'Discard and open', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.build-status')?.textContent === 'Preview current'
    && [...document.querySelectorAll('button')].some(button => button.textContent === 'Build' && !button.disabled));
  await page.getByRole('button', { name: 'Open lib/qa-helper.ts', exact: true }).click();
  assert.equal(await helper.innerText(), 'export const amount: number = 0.42;');
  await page.locator('[data-control-id="intensity"][data-applied-value="0.08"]').waitFor();
  report.checks.push('File Save and Open round trip the actual edited helper and controls after an intervening draft edit');
  // Supply only the native folder-picker response. The renderer, trusted IPC,
  // child compiler and real package writer all run normally.
  const exportDirectory = join(output, 'exports');
  await mkdir(exportDirectory, { recursive: true });
  await app.evaluate(({ dialog }, directory) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] }); }, exportDirectory);
  await page.locator('.file-tools summary').click();
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
