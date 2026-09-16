import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { _electron } from 'playwright';
import { installedElectron } from './studio-electron.mjs';
import { studioTestEnvironment } from './studio-session.mjs';

const root = resolve(import.meta.dirname, '..');
const output = join(root, 'artifacts', 'studio-capture');
const framePath = join(output, 'frame.png'), videoPath = join(output, 'clip.webm'), closePath = join(output, 'close-cancel.webm');
const report = { ok: false, checks: [], errors: [] };
const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath };
delete env.ELECTRON_RUN_AS_NODE; delete env.LUX_STUDIO_SMOKE;
await mkdir(output, { recursive: true });
await Promise.all([framePath, videoPath, closePath, join(output, 'recording.png'), join(output, 'workspace.png'), join(output, 'failure.png'), join(output, 'result.json')]
  .map(path => unlink(path).catch(() => {})));
let app, page, child;
try {
  app = await _electron.launch({ executablePath: installedElectron(root), args: [join(root, 'apps/studio/dist/main.cjs')],
    cwd: root, env, timeout: 30000, chromiumSandbox: true });
  child = app.process();
  page = await app.firstWindow(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /Content Security Policy|Refused to (apply|execute|load)/i.test(message.text())) report.errors.push(message.text()); });
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  const canvas = page.locator('.preview-surface canvas');
  await canvas.waitFor({ state: 'visible' });
  await page.setViewportSize({ width: 820, height: 700 });
  const dimensions = await canvas.evaluate(element => ({ width: element.width, height: element.height,
    displayWidth: element.getBoundingClientRect().width, displayHeight: element.getBoundingClientRect().height }));
  assert.deepEqual({ width: dimensions.width, height: dimensions.height }, { width: 1920, height: 1080 });
  assert.ok(dimensions.displayWidth < dimensions.width && dimensions.displayHeight < dimensions.height,
    `Preview must be smaller than output: ${JSON.stringify(dimensions)}`);

  await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, framePath);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Save frame PNG', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('[role="menu"]'));
  for (let attempt = 0; attempt < 80; attempt++) { try { if ((await stat(framePath)).size > 0) break; } catch {} await new Promise(done => setTimeout(done, 100)); }
  const png = await readFile(framePath);
  const image = await app.evaluate(({ nativeImage }, base64) => {
    const value = nativeImage.createFromBuffer(Buffer.from(base64, 'base64')); return { ...value.getSize(), empty: value.isEmpty() };
  }, png.toString('base64'));
  assert.deepEqual(image, { width: 1920, height: 1080, empty: false });
  report.checks.push('Preview smaller than output saved a decoded 1920×1080 PNG');

  await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, videoPath);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Record video', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Recording 1920 × 1080' }).waitFor();
  await new Promise(done => setTimeout(done, 2500));
  await page.getByRole('button', { name: 'Preview · REC', exact: true }).click();
  await page.screenshot({ path: join(output, 'recording.png') });
  await page.getByRole('menuitem', { name: 'Stop recording', exact: true }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).waitFor();
  const videoBytes = (await stat(videoPath)).size;
  assert.ok(videoBytes > 1024, `Recorded WebM is unexpectedly small: ${videoBytes}`);

  const decoderOpened = app.waitForEvent('window');
  await app.evaluate(async ({ BrowserWindow }) => {
    const decoder = new BrowserWindow({ show: false, webPreferences: { webSecurity: false } });
    globalThis.__luxCaptureDecoder = decoder;
    await decoder.loadURL('data:text/html,<video id="video" muted></video>');
  });
  const decoder = await decoderOpened;
  const decoded = await decoder.evaluate(async source => {
    const video = document.querySelector('video'); video.src = source;
    await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = () => reject(Error('WebM metadata decode failed')); });
    await video.play();
    await new Promise((resolve, reject) => { const timer = setTimeout(resolve, 1000); video.ontimeupdate = () => { clearTimeout(timer); resolve(); }; video.onerror = () => reject(Error('WebM playback failed')); });
    const playedAt = video.currentTime;
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw Error(`WebM duration is invalid: ${video.duration}`);
    const seekTarget = Math.min(video.duration * 0.6, Math.max(0.05, video.duration - 0.1));
    await new Promise((resolve, reject) => {
      video.onseeked = resolve; video.onerror = () => reject(Error('WebM seek failed')); video.currentTime = seekTarget;
    });
    const result = { width: video.videoWidth, height: video.videoHeight, duration: video.duration,
      playedAt, seekTarget, seekedAt: video.currentTime, paused: video.paused };
    video.pause(); return result;
  }, pathToFileURL(videoPath).href);
  assert.equal(decoded.width, 1920); assert.equal(decoded.height, 1080);
  assert.ok(Number.isFinite(decoded.duration) && decoded.duration > 0);
  assert.ok(decoded.playedAt > 0 && !decoded.paused, `WebM did not advance: ${JSON.stringify(decoded)}`);
  assert.ok(Math.abs(decoded.seekedAt - decoded.seekTarget) < 0.15, `WebM did not seek: ${JSON.stringify(decoded)}`);
  await decoder.close();
  report.video = { bytes: videoBytes, ...decoded };
  report.output = dimensions;
  report.checks.push('Electron decoded, played, and sought within the finite-duration fixed 1920×1080 WebM clip');
  await page.screenshot({ path: join(output, 'workspace.png') });

  await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, closePath);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Record video', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Recording 1920 × 1080' }).waitFor();
  await new Promise(done => setTimeout(done, 1200));
  await page.evaluate(() => window.luxAuthoring.dirty(false));
  const appClosed = app.waitForEvent('close');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
  await appClosed;
  await assert.rejects(stat(closePath), { code: 'ENOENT' });
  assert.equal((await readdir(output)).some(name => name.startsWith('.lux-video-') && name.endsWith('.tmp')), false);
  report.checks.push('Closing Studio during recording drained writes and removed the partial clip');
  assert.deepEqual(report.errors, []); report.ok = true;
} catch (error) {
  report.failure = String(error?.stack ?? error); process.exitCode = 1;
  if (page && !page.isClosed()) await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {});
} finally {
  await app?.close().catch(() => {});
  report.exitCode = child?.exitCode ?? null;
  await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
