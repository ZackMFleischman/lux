import { studioTestEnvironment, resolveStudioSession } from '../scripts/studio-session.mjs';
import { installedElectron } from '../scripts/studio-electron.mjs';
import { _electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'artifacts/preview-actions-native', `run-${Date.now()}`);
await mkdir(output, { recursive: true });
const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath };
resolveStudioSession({ workspace: root, env });
delete env.ELECTRON_RUN_AS_NODE;
const report = { ok: false, output, checks: [], errors: [] };
let app;
try {
  app = await _electron.launch({ executablePath: installedElectron(root), args: [join(root, 'apps/studio/dist/main.cjs')], cwd: root, env, timeout: 30000, chromiumSandbox: true });
  const page = await app.firstWindow();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Layouts…', exact: true }).click();
  await page.getByRole('button', { name: 'Reset desktop layout', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await page.locator('.preview-surface canvas').waitFor();
  await page.waitForFunction(() => !document.querySelector('.preview-empty'));
  await page.getByRole('combobox', { name: 'Preview resolution preset' }).selectOption('1920x1080');
  await page.waitForFunction(() => document.querySelector('.preview-resolution-value')?.textContent?.includes('1920 × 1080'));
  await page.waitForFunction(() => { const canvas = document.querySelector('.preview-surface canvas'); return canvas?.width === 1920 && canvas?.height === 1080; });
  report.resolution = await page.locator('.preview-resolution-value').innerText();
  assert.equal(report.resolution, '1920 × 1080');
  report.checks.push('Selected output resolution is 1920 × 1080');

  const menuNames = await page.locator('header [data-studio-menu]').allTextContents();
  assert.deepEqual(menuNames, ['File', 'View', 'Preview']);
  await page.getByRole('button', { name: 'File', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('menu', { name: 'View', exact: true }).waitFor();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('menu', { name: 'Preview', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  report.checks.push('File, View, Preview order and keyboard traversal');

  await page.setViewportSize({ width: 1280, height: 820 });
  await page.screenshot({ path: join(output, 'desktop-header.png') });
  const framePath = join(output, 'header-frame.png');
  await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, framePath);
  await page.getByRole('button', { name: 'Save frame PNG', exact: true }).click();
  let png;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { png = await readFile(framePath); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  if (!png) {
    report.captureAlert = await page.getByRole('alert').allTextContents();
    await page.screenshot({ path: join(output, 'frame-failure.png') });
  }
  assert.ok(png, 'frame save completes');
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 1920); assert.equal(png.readUInt32BE(20), 1080);
  report.png = { path: framePath, bytes: png.byteLength, width: 1920, height: 1080 };
  report.checks.push('Header camera saves a 1920 × 1080 PNG through native capture IPC');

  const videoPath = join(output, 'header-recording.webm');
  await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, videoPath);
  await page.getByRole('button', { name: 'Record video', exact: true }).click();
  const recordingStates = page.locator('.preview-recording-status[role="status"]');
  await recordingStates.first().waitFor();
  assert.equal(await recordingStates.count(), 1);
  assert.ok((await recordingStates.first().innerText()).includes('Recording 1920 × 1080'));
  assert.equal(await page.getByRole('button', { name: 'Preview · REC', exact: true }).count(), 1);
  await page.waitForTimeout(1300);
  await page.getByRole('button', { name: 'Preview · REC', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Stop recording', exact: true }).click();
  await page.getByRole('button', { name: 'Record video', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Preview · REC', exact: true }).count(), 0);
  let video;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { video = await readFile(videoPath); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  if (!video) {
    report.videoAlert = await page.getByRole('alert').allTextContents();
    await page.screenshot({ path: join(output, 'video-failure.png') });
  }
  assert.ok(video, 'video save completes');
  assert.ok(video.byteLength > 0); assert.deepEqual([...video.subarray(0, 4)], [26, 69, 223, 163]);
  const studioDecode = await page.evaluate(async base64 => {
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
    const element = document.createElement('video');
    const url = URL.createObjectURL(new Blob([bytes], { type: 'video/webm' }));
    try {
      return await new Promise(resolve => {
        const timeout = setTimeout(() => resolve({ loaded: false, error: { code: element.error?.code ?? null, message: 'Timed out loading recorded WebM metadata' } }), 10000);
        element.onloadedmetadata = () => { clearTimeout(timeout); resolve({ loaded: true, width: element.videoWidth, height: element.videoHeight, duration: element.duration }); };
        element.onerror = () => { clearTimeout(timeout); resolve({ loaded: false, error: { code: element.error?.code ?? null, message: element.error?.message ?? 'Recorded WebM metadata failed to load' } }); };
        element.src = url;
      });
    } finally { URL.revokeObjectURL(url); }
  }, video.toString('base64'));
  report.studioDecode = studioDecode;
  const decoderOpened = app.waitForEvent('window');
  await app.evaluate(async ({ BrowserWindow }) => {
    const decoder = new BrowserWindow({ show: false, webPreferences: { webSecurity: false } });
    globalThis.__luxPreviewActionsDecoder = decoder;
    await decoder.loadURL('data:text/html,<video id="video" muted></video>');
  });
  const decoder = await decoderOpened;
  const videoMetadata = await decoder.evaluate(async source => {
    const video = document.querySelector('video'); video.src = source;
    await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = () => reject(Error('WebM metadata decode failed')); });
    await video.play();
    await new Promise((resolve, reject) => { const timer = setTimeout(resolve, 1000); video.ontimeupdate = () => { clearTimeout(timer); resolve(); }; video.onerror = () => reject(Error('WebM playback failed')); });
    const playedAt = video.currentTime;
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw Error(`WebM duration is invalid: ${video.duration}`);
    return { width: video.videoWidth, height: video.videoHeight, duration: video.duration, playedAt };
  }, pathToFileURL(videoPath).href);
  await decoder.close();
  assert.deepEqual({ width: videoMetadata.width, height: videoMetadata.height }, { width: 1920, height: 1080 });
  assert.ok(Number.isFinite(videoMetadata.duration) && videoMetadata.duration > 0);
  assert.ok(videoMetadata.playedAt > 0);
  report.webm = { path: videoPath, bytes: video.byteLength, ...videoMetadata };
  report.checks.push('Header recording and Preview-menu stop share one recorder and commit a WebM');

  await page.setViewportSize({ width: 700, height: 820 });
  await page.screenshot({ path: join(output, 'narrow-header.png') });
  const headerBox = await page.locator('.panel-toolbar').boundingBox();
  const actionsBox = await page.locator('.preview-capture-actions').boundingBox();
  assert.ok(headerBox && actionsBox && actionsBox.y >= headerBox.y && actionsBox.y + actionsBox.height <= headerBox.y + headerBox.height);
  report.narrow = { headerBox, actionsBox };
  report.checks.push('Capture actions remain inside the compact Preview header');
  const leftovers = (await readdir(output)).filter(name => name.startsWith('.lux-'));
  assert.deepEqual(leftovers, []);
  assert.equal(await page.locator('.MuiAlert-standardError').count(), 0);
  report.checks.push('Successful capture leaves no temporary capture files');
  assert.deepEqual(report.errors, []);
  report.ok = true;
} catch (error) { report.failure = error.stack || String(error); process.exitCode = 1; }
finally {
  if (app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
  await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
