import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright';
import { installedElectron } from '../../scripts/studio-electron.mjs';
import { createStudioConnection, resolveStudioSession, studioTestEnvironment } from '../../scripts/studio-session.mjs';

const root = resolve(import.meta.dirname, '../..');
const output = join(import.meta.dirname, 'native');
await mkdir(output, { recursive: true });
const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath };
const session = resolveStudioSession({ workspace: root, env });
const report = {
  ok: false,
  root,
  sourceCommit: execFileSync('git', ['-c', `safe.directory=${root}`, 'rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  profile: session.profile,
  errors: [],
};
let app;
try {
  app = await _electron.launch({ executablePath: installedElectron(root), args: [join(root, 'apps/studio/dist/main.cjs')], cwd: root, env, timeout: 30000 });
  const page = await app.firstWindow();
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.errors.push(error.message));
  const pid = await app.evaluate(() => process.pid);
  report.pid = pid;
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { endpoint = JSON.parse(await readFile(session.endpointPath, 'utf8')); if (endpoint.pid === pid) break; } catch {}
    await page.waitForTimeout(100);
  }
  assert.equal(endpoint?.pid, pid, 'Only control the isolated typography Studio');
  const call = createStudioConnection(session, { timeoutMs: 90000 });
  await page.waitForFunction(() => !document.querySelector('[aria-label="Build"]')?.disabled, undefined, { timeout: 90000 });
  const draft = await call('read');
  const source = { sdkVersion: '0.2.0', entry: 'visual.ts', files: {
    'visual.ts': await readFile(join(root, 'skills/lux-visual-creation/assets/noise-sphere.ts'), 'utf8'),
  } };
  await call('build', { expectedDraftVersion: draft.draftVersion, source });
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor({ timeout: 90000 });
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.locator('.parameter-row').first().waitFor();
  await page.evaluate(async () => { await document.fonts.load('400 13px Inter', 'Lux 0123456789'); await document.fonts.ready; });
  report.font = await page.evaluate(() => ({
    check400: document.fonts.check('400 13px Inter', 'Lux 0123456789'),
    check500: document.fonts.check('500 13px Inter', 'Controls'),
    faces: [...document.fonts].filter(face => face.family === 'Inter').map(face => ({ family: face.family, weight: face.weight, style: face.style, status: face.status })),
  }));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.enable');
  const resourceTree = await cdp.send('Page.getResourceTree');
  report.font.resources = resourceTree.frameTree.resources.filter(resource => resource.type === 'Font' || /InterVariable.*\.woff2/.test(resource.url));
  assert.equal(report.font.check400, true);
  assert.equal(report.font.check500, true);
  assert.ok(report.font.faces.some(face => face.status === 'loaded'));
  assert.ok(report.font.resources.some(entry => entry.url.startsWith('file:') && entry.url.includes('/assets/')));
  const style = locator => locator.evaluate(element => { const css = getComputedStyle(element); return { fontFamily: css.fontFamily, fontWeight: css.fontWeight, fontVariantNumeric: css.fontVariantNumeric }; });
  report.styles = {
    body: await style(page.locator('body')),
    sectionHeading: await style(page.locator('.studio-disclosure>summary').first()),
    label: await style(page.locator('.parameter-name').first()),
    numericControl: await style(page.locator('.parameter-number input').first()),
    fps: await style(page.locator('.preview-fps')),
    code: await style(page.locator('.cm-scroller')),
  };
  await page.screenshot({ path: join(output, 'dense-inspector.png') });
  await page.getByRole('button', { name: 'File', exact: true }).click();
  const menuItem = page.getByRole('menuitem', { name: 'Open', exact: true });
  await menuItem.waitFor();
  report.styles.menuItem = await style(menuItem);
  await page.screenshot({ path: join(output, 'file-menu.png') });
  assert.match(report.styles.body.fontFamily, /^Inter/);
  assert.equal(report.styles.body.fontWeight, '400');
  assert.equal(report.styles.sectionHeading.fontWeight, '500');
  assert.equal(report.styles.label.fontWeight, '400');
  assert.match(report.styles.numericControl.fontVariantNumeric, /tabular-nums/);
  assert.match(report.styles.fps.fontVariantNumeric, /tabular-nums/);
  assert.match(report.styles.code.fontFamily, /Consolas/);
  assert.match(report.styles.menuItem.fontFamily, /^Inter/);
  assert.equal(report.styles.menuItem.fontWeight, '400');
  assert.deepEqual(report.errors, []);
  report.ok = true;
} catch (error) {
  report.error = error.stack ?? String(error);
  process.exitCode = 1;
} finally {
  if (app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
  if (report.pid) { try { process.kill(report.pid, 0); report.processExited = false; } catch { report.processExited = true; } }
  await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
