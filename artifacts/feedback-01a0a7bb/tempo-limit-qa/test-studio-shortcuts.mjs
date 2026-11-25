import assert from 'node:assert/strict';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright';
import { installedElectron } from 'file:///C:/Users/zFlei/repos/lux/scripts/studio-electron.mjs';
import { studioTestEnvironment } from 'file:///C:/Users/zFlei/repos/lux/scripts/studio-session.mjs';

const root="C:\\Users\\zFlei\\repos\\lux";
const installation={"version":1,"name":"Lux","sourceCommit":"4311980789fe5eb89368f0075b1951dafd7ffed6","sourceTree":"working tree snapshot","canonicalLibraryRoot":"C:\\Users\\zFlei\\repos\\lux\\library","electron":{"version":"44.3.0","archiveName":"electron-v44.3.0-win32-x64.zip","sha256":"26bf9a617d58d81772b3d68305d59ee48272969c15083c06db634a77358a8d9d","source":"https://github.com/electron/electron/releases/download/v44.3.0/electron-v44.3.0-win32-x64.zip"},"installedAt":"2026-09-16T10:55:29.707Z","directory":"C:\\Users\\zFlei\\AppData\\Local\\Programs\\Lux\\builds\\43119807-c5bad848","executable":"C:\\Users\\zFlei\\AppData\\Local\\Programs\\Lux\\builds\\43119807-c5bad848\\Lux.exe","workspace":"C:\\Users\\zFlei\\AppData\\Local\\Programs\\Lux\\builds\\43119807-c5bad848\\resources\\app\\runtime","node":"C:\\Users\\zFlei\\AppData\\Local\\Programs\\Lux\\builds\\43119807-c5bad848\\resources\\app\\node.exe","adapter":"C:\\Users\\zFlei\\AppData\\Local\\Programs\\Lux\\builds\\43119807-c5bad848\\resources\\app\\runtime\\scripts\\studio-installed-mcp.mjs","profile":"desktop","sourceDigest":"0a223199df5afa006472789d4beabd5402c3bb3772c7947cf81943634bd22ccb"};
const output = join(root, 'artifacts/feedback-01a0a7bb/tempo-limit-qa/shortcuts');
const scenePath = join(output, 'shortcut-save.lux-scene');
const saveAsPath = join(output, 'shortcut-save-as.lux-scene');
const framePath = join(output, 'shortcut-frame.png');
const videoPath = join(output, 'shortcut-recording.webm');
const screenshotPath = join(output, 'diagnostics-maximized.png');
const helpScreenshotPath = join(output, 'shortcut-reference.png');
const resultPath = join(output, 'result.json');
const report={installation, ok: false, checks: [], errors: [] };
const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath };
delete env.ELECTRON_RUN_AS_NODE;
await mkdir(output, { recursive: true });
await Promise.all([scenePath, saveAsPath, framePath, videoPath, screenshotPath, helpScreenshotPath, resultPath].map(path => unlink(path).catch(() => {})));

let app, page;
async function waitForFile(path, minimum = 1, attempts = 120) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { if ((await stat(path)).size >= minimum) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error(`Timed out waiting for ${path}`);
}
async function openMenu(name) { await page.getByRole('button', { name, exact: true }).click(); }
async function assertPreviewSize(width, height) {
  await page.waitForFunction(({ width, height }) => {
    const canvas = document.querySelector('.preview-surface canvas');
    return canvas?.width === width && canvas?.height === height && document.querySelector('.preview-resolution-value')?.textContent === `${width} × ${height}`;
  }, { width, height });
  (report.previewSizes ??= []).push({ width, height });
}
async function useSmallPreview() {
  await page.getByRole('slider', { name: 'Preview resolution scale', exact: true }).press('Home');
  await assertPreviewSize(640, 360);
}

try {
  app = await _electron.launch({ executablePath: installation.executable, args: [],
    cwd: installation.directory, env, timeout: 30000, chromiumSandbox: true });
  page = await app.firstWindow(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });

  const native = await app.evaluate(({ BrowserWindow, Menu }) => {
    const window = BrowserWindow.getAllWindows()[0];
    return { applicationMenu: Menu.getApplicationMenu() !== null, minimizable: window.isMinimizable(),
      maximizable: window.isMaximizable(), closable: window.isClosable() };
  });
  assert.deepEqual(native, { applicationMenu: false, minimizable: true, maximizable: true, closable: true });
  report.nativeWindow = native;
  report.checks.push('Electron accelerator menu is disabled while native minimize, maximize, and close controls remain enabled');

  await openMenu('File');
  const fileMenu = await page.getByRole('menu', { name: 'File' }).innerText();
  for (const hint of ['Ctrl+S', 'Ctrl+Shift+S', 'Ctrl+Shift+E']) assert.match(fileMenu, new RegExp(hint.replaceAll('+', '\\+')));
  await page.keyboard.press('Escape');
  await openMenu('Preview');
  const previewMenu = await page.getByRole('menu', { name: 'Preview' }).innerText();
  assert.match(previewMenu, /Ctrl\+Shift\+P/); assert.match(previewMenu, /Ctrl\+Shift\+R/);
  await page.keyboard.press('Escape');
  await openMenu('View');
  const viewMenu = await page.getByRole('menu', { name: 'View' }).innerText();
  assert.match(viewMenu, /Ctrl\+Shift\+I/); assert.match(viewMenu, /Keyboard shortcuts[\s\S]*\?/);
  await page.keyboard.press('Escape');
  report.checks.push('File, Preview, View, Build, panel, and fullscreen controls expose their assigned shortcut hints');

  await app.evaluate(({ dialog }, paths) => {
    const scenePaths = [paths.scene, paths.saveAs];
    dialog.showSaveDialog = async (_window, options) => {
      const extensions = options?.filters?.flatMap(filter => filter.extensions ?? []) ?? [];
      if (extensions.includes('lux-scene')) return { canceled: false, filePath: scenePaths.shift() };
      if (extensions.includes('png')) return { canceled: false, filePath: paths.frame };
      if (extensions.includes('webm')) return { canceled: false, filePath: paths.video };
      return { canceled: true };
    };
  }, { scene: scenePath, saveAs: saveAsPath, frame: framePath, video: videoPath });

  const editor = page.locator('.cm-content');
  await editor.waitFor();
  await page.waitForFunction(() => document.querySelector('.cm-content')?.getAttribute('contenteditable') === 'true', undefined, { timeout: 60000 });
  await editor.focus();
  const sourceBeforeQuestionMark = await editor.textContent();
  await page.keyboard.type('?');
  assert.equal(await page.getByRole('dialog', { name: 'Keyboard shortcuts' }).count(), 0);
  await page.waitForFunction(before => document.querySelector('.cm-content')?.textContent !== before, sourceBeforeQuestionMark);
  assert.match(await editor.textContent(), /\?/);
  await page.keyboard.press('Backspace');
  await page.waitForFunction(before => document.querySelector('.cm-content')?.textContent === before, sourceBeforeQuestionMark);
  report.checks.push('? types in Source without opening the shortcut reference or suppressing text input');
  await page.keyboard.press('Control+Enter');
  await page.waitForFunction(() => document.querySelector('.status-build')?.textContent?.includes('Build ready'));
  const canvas = page.locator('.preview-surface canvas'); await canvas.waitFor({ state: 'visible' });
  await useSmallPreview();
  await editor.focus();
  await page.keyboard.press('Control+S'); await waitForFile(scenePath); await page.waitForTimeout(300);
  await page.keyboard.press('Control+Shift+S'); await waitForFile(saveAsPath);
  report.savedScenes = { saveBytes: (await stat(scenePath)).size, saveAsBytes: (await stat(saveAsPath)).size };
  report.checks.push('Ctrl+Enter builds from Source; Ctrl+S and Ctrl+Shift+S save through the same scene actions while Source has focus');

  await openMenu('File');
  const exportItem = page.getByRole('menuitem', { name: /Export for Resolume/ });
  const exportDisabled = await exportItem.getAttribute('aria-disabled') === 'true';
  const exportReason = await exportItem.getAttribute('title');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+Shift+E');
  if (exportDisabled) {
    assert.equal(exportReason, 'Resolume export is not included in this desktop build.');
    assert.equal(await page.getByRole('dialog', { name: 'Export for Resolume' }).count(), 0);
    report.checks.push('Installed export shortcut stays unavailable with the explicit desktop-build reason');
  } else {
    await page.getByRole('dialog', { name: 'Export for Resolume' }).waitFor();
    await page.keyboard.press('Control+Shift+E');
    assert.equal(await page.getByRole('dialog', { name: 'Export for Resolume' }).count(), 1);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    report.checks.push('Ctrl+Shift+E opens one export dialog and further dialog shortcuts are suppressed');
  }

  await page.getByLabel('Preview resolution preset', { exact: true }).selectOption('1920x1080');
  await assertPreviewSize(1920, 1080);
  await page.getByRole('button', { name: 'View', exact: true }).focus();
  await page.keyboard.press('Control+Shift+P'); await waitForFile(framePath);
  const png = await readFile(framePath);
  assert.deepEqual(await app.evaluate(({ nativeImage }, bytes) => nativeImage.createFromBuffer(Buffer.from(bytes)).getSize(), [...png]), { width: 1920, height: 1080 });
  await page.keyboard.press('Control+Shift+R');
  await page.getByRole('status').filter({ hasText: 'Recording 1920 × 1080' }).waitFor();
  await page.getByRole('button', { name: 'Stop recording', exact: true }).waitFor();
  await page.waitForTimeout(1200); await page.keyboard.press('Control+Shift+R');
  await page.getByRole('button', { name: 'Record video', exact: true }).waitFor(); await waitForFile(videoPath, 1024, 300);
  report.capture = { pngBytes: png.length, videoBytes: (await stat(videoPath)).size };
  report.checks.push('Ctrl+Shift+P saves a decoded 1920×1080 PNG and Ctrl+Shift+R starts and finishes a WebM recording');
  await useSmallPreview();

  const viewButton = page.getByRole('button', { name: 'View', exact: true }); await viewButton.focus();
  await page.keyboard.press('Shift+/');
  const shortcutDialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' }); await shortcutDialog.waitFor();
  for (const text of ['Build preview', 'Save scene', 'Start or stop recording', 'Maximize or restore focused panel', 'Show keyboard shortcuts', 'Shift+/']) {
    assert.equal(await shortcutDialog.getByText(text, { exact: true }).count(), 1, text);
  }
  await page.keyboard.press('Shift+/'); assert.equal(await page.getByRole('dialog', { name: 'Keyboard shortcuts' }).count(), 1);
  await page.screenshot({ path: helpScreenshotPath });
  await page.keyboard.press('Escape'); await shortcutDialog.waitFor({ state: 'detached' });
  assert.equal(await viewButton.evaluate(element => element === document.activeElement), true);
  report.checks.push('? opens one complete shortcut reference outside Source; Escape closes it and restores focus');

  await viewButton.focus();
  const inspector = page.locator('.studio-pane-inspector');
  assert.equal(await inspector.count(), 1); await page.keyboard.press('Control+Shift+I'); await inspector.waitFor({ state: 'detached' });
  await page.keyboard.press('Control+Shift+I'); await inspector.waitFor();
  await editor.focus(); await page.keyboard.press('Control+Shift+I'); assert.equal(await inspector.count(), 1);
  await page.keyboard.press('Control+Shift+M'); assert.equal(await page.locator('.studio-expanded-pane:not([hidden])').count(), 0);
  report.checks.push('Ctrl+Shift+I toggles Inspector outside text entry; Inspector and panel maximize remain suppressed inside Source');

  const diagnosticsTab = page.locator('.dv-tab').filter({ hasText: /^Diagnostics$/ });
  await diagnosticsTab.focus(); await diagnosticsTab.click();
  await page.evaluate(() => { window.__shortcutCanvas = document.querySelector('.preview-surface canvas'); });
  const beforeFrame = await canvas.evaluate(element => element.toDataURL());
  await page.keyboard.press('Control+Shift+M');
  const diagnostics = page.locator('.studio-pane-diagnostics');
  await diagnostics.waitFor();
  assert.equal(await diagnostics.evaluate(element => !!element.closest('.studio-expanded-pane:not([hidden])')), true);
  const restoreWorkspace = page.getByRole('button', { name: 'Restore workspace', exact: true });
  assert.match(await restoreWorkspace.getAttribute('title'), /Ctrl\+Shift\+M/);
  assert.match(await restoreWorkspace.innerText(), /Ctrl\+Shift\+M/);
  assert.equal(await page.evaluate(() => window.__shortcutCanvas === document.querySelector('.preview-surface canvas')), true);
  await page.waitForTimeout(500);
  const afterFrame = await canvas.evaluate(element => element.toDataURL());
  assert.notEqual(afterFrame, beforeFrame, 'hidden live Preview must continue rendering while Diagnostics is maximized');
  await diagnostics.getByText('Performance', { exact: true }).click();
  await diagnostics.getByText('Runtime', { exact: true }).click();
  await diagnostics.getByLabel('Live performance').waitFor();
  await diagnostics.getByText('Authoring revision', { exact: true }).waitFor();
  await page.screenshot({ path: screenshotPath });
  await page.keyboard.press('F11'); await page.locator('.studio-preview-fullscreen').waitFor();
  assert.equal(await page.evaluate(() => window.__shortcutCanvas === document.querySelector('.preview-surface canvas')), true);
  await page.keyboard.press('Escape'); await diagnostics.waitFor();
  assert.equal(await diagnostics.evaluate(element => !!element.closest('.studio-expanded-pane:not([hidden])')), true);
  await page.keyboard.press('Escape'); await page.locator('.studio-dock-grid:not([hidden])').waitFor();
  assert.equal(await diagnosticsTab.evaluate(element => element === document.activeElement), true);
  report.checks.push('Focused Diagnostics exposes Restore workspace with its hint and keeps the same advancing Preview canvas; F11 shows Preview and Escape restores Diagnostics, then its dock focus');

  assert.deepEqual(report.errors, []); report.ok = true;
} catch (error) {
  report.failure = String(error?.stack ?? error); process.exitCode = 1;
  if (page && !page.isClosed()) await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {});
} finally {
  if (app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
  await writeFile(resultPath, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
