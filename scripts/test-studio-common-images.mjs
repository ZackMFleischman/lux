import { studioTestEnvironment, resolveStudioSession } from './studio-session.mjs';
// Scheduled GPU integration test. Build Studio first; this script owns its app.
import assert from 'node:assert/strict';
import { _electron } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { installedElectron } from './studio-electron.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { decode, encode } from 'fast-png';
import { fixture as jpegFixture, insert, exif } from '../tests/assets/jpeg-fixtures.mjs';

const root = resolve(import.meta.dirname, '..'), output = join(root, 'artifacts/studio-common-images');
const fixture = JSON.parse(await readFile(join(root, 'tests/fixtures/installed-sources/common-images/scene.lux-scene'), 'utf8'));
const png = Buffer.from(fixture.source.assets['assets/alpha.png'].data, 'base64');
// Independent, checked-in progressive color JPEG, rotated clockwise by EXIF.
const jpeg = insert(jpegFixture('progressive'), exif(6));
const changedPng = Buffer.from(encode({ width: 2, height: 2, channels: 4,
  data: Uint8Array.from([0,0,255,128, 0,255,0,255, 0,0,255,0, 255,255,255,64]) }));
const originalPixels = [[255,0,0,128], [0,255,0,255], [0,0,255,0], [255,255,255,64]];
const revisedPixels = [[0,0,255,128], ...originalPixels.slice(1)];
const report = { ok: false, checks: [], captures: [], errors: [] };
const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath };
const testSession = resolveStudioSession({ workspace: root, env });
delete env.ELECTRON_RUN_AS_NODE; delete env.LUX_STUDIO_SMOKE;
await mkdir(output, { recursive: true });
let app, client, page;
const delay = () => new Promise(resolve => setTimeout(resolve, 100));
const parse = result => JSON.parse(result.content.find(part => part.type === 'text').text);
const srgbToLinear = value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const linearToSrgb = value => 255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);
function over(pixels, background) {
  return pixels.map(pixel => [...pixel.slice(0, 3).map(channel => Math.round(linearToSrgb(
    srgbToLinear(channel / 255) * pixel[3] / 255 + background * (1 - pixel[3] / 255)))), 255]);
}
function scene(assets, imagePath = 'assets/alpha.png') {
  let text = fixture.source.files[fixture.source.entry];
  assert.ok(text.includes('update(_frame) {}') && text.includes('async create(context) {'));
  text = text.replace('Scene, Mesh,', 'Color, Scene, Mesh,')
    .replace('async create(context) {', "controls: { backdrop: { type: 'number', label: 'Backdrop', min: -1, max: 1, default: -1, step: 1 } },\n  async create(context) {")
    .replaceAll('assets/alpha.png', imagePath)
    .replace('update(_frame) {}', 'update(frame) { const value = frame.controls.backdrop; scene.background = value < 0 ? null : new Color(value, value, value); }');
  return { ...fixture.source, sdkVersion: '0.2.0', files: { [fixture.source.entry]: text }, assets };
}
try {
  app = await _electron.launch({ executablePath: installedElectron(root),
    args: [join(root, 'apps/studio/dist/main.cjs')], cwd: root, env, timeout: 30000, chromiumSandbox: true });
  page = await app.firstWindow(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('dialog', dialog => { report.errors.push(`Unexpected native JavaScript dialog: ${dialog.type()}`); void dialog.dismiss(); });
  const pid = await app.evaluate(() => process.pid);
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { endpoint = JSON.parse(await readFile(testSession.endpointPath, 'utf8')); } catch {}
    if (endpoint?.pid === pid) break; await delay();
  }
  assert.equal(endpoint?.pid, pid, 'Connect only to the Studio process owned by this test');
  client = new Client({ name: 'lux-common-images-qa', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(root, 'scripts/studio-mcp.mjs')], cwd: root, env }));
  const raw = (name, args = {}) => client.callTool({ name: `lux.studio.${name}`, arguments: args }, undefined, { timeout: 75000 });
  const call = async (name, args) => { const result = await raw(name, args); assert.equal(result.isError, undefined, JSON.stringify(result)); return parse(result); };
  async function until(predicate, label) {
    for (let attempt = 0; attempt < 150; attempt++) { const state = await call('read'); if (predicate(state)) return state; await delay(); }
    throw Error(`Timed out: ${label}`);
  }
  const input = () => page.getByLabel('Choose image files', { exact: true });
  async function importImage(name, mimeType, buffer) {
    const previous = await call('read');
    await input().setInputFiles({ name, mimeType, buffer });
    const next = await until(state => state.draftVersion > previous.draftVersion && state.source.assets?.[`assets/${name}`]?.data === buffer.toString('base64'), `import ${name}`);
    assert.equal(next.status.authoring?.revisionId, previous.status.authoring?.revisionId, 'Import edits a draft without applying it');
    return next;
  }
  async function build(source) {
    const before = await call('read');
    return call('build', { expectedDraftVersion: before.draftVersion, source });
  }
  async function parameters(values) {
    const runtime = (await call('status')).authoring;
    return call('parameters', { instanceId: runtime.instanceId, expectedGeneration: runtime.generation,
      expectedRevisionId: runtime.revisionId, expectedControlSchemaHash: runtime.controlSchemaHash, values });
  }
  async function capture(name, expected, { tolerance = 5 } = {}) {
    const response = await raw('capture'); assert.equal(response.isError, undefined, JSON.stringify(response));
    const bytes = Buffer.from(response.content.find(part => part.type === 'image').data, 'base64');
    await writeFile(join(output, `${name}.png`), bytes);
    // Decode encoded capture directly: nativeImage bitmap access can premultiply.
    const image = decode(bytes);
    assert.equal(image.width, 1920); assert.equal(image.height, 1080); assert.equal(image.depth, 8);
    assert.ok(image.channels === 3 || image.channels === 4);
    const samples = [0.25, 0.75].flatMap(y => [0.25, 0.75].map(x => {
      const at = (Math.floor(y * image.height) * image.width + Math.floor(x * image.width)) * image.channels;
      return [...image.data.slice(at, at + 3), image.channels === 4 ? image.data[at + 3] : 255];
    }));
    for (let region = 0; region < 4; region++) for (const channel of [0,1,2,3]) {
      assert.ok(Math.abs(samples[region][channel] - expected[region][channel]) <= tolerance,
        `${name} region ${region} channel ${channel}: expected ${expected[region]}, got ${samples[region]}`);
    }
    const record = { name, samples, metadata: parse(response) }; report.captures.push(record); return record;
  }
  async function previewOver(background) {
    // Browser compositing consumes premultiplied *encoded* sRGB, unlike the
    // scene's linear-light accumulation tested below. This catches double
    // premultiplication and halo errors that a correct capture alone misses.
    const canvas = page.locator('.preview-surface canvas');
    await canvas.evaluate((element, value) => { element.style.backgroundColor = value ? '#fff' : '#000'; }, background);
    const bytes = await canvas.screenshot();
    await writeFile(join(output, `preview-over-${background ? 'white' : 'black'}.png`), bytes);
    const image = decode(bytes), samples = [];
    let region = 0;
    for (const y of [0.25, 0.75]) for (const x of [0.25, 0.75]) {
      const at = (Math.floor(y * image.height) * image.width + Math.floor(x * image.width)) * image.channels;
      const source = originalPixels[region++], alpha = source[3] / 255;
      const expected = source.slice(0, 3).map(value => Math.round(value * alpha + 255 * background * (1 - alpha)));
      const actual = Array.from(image.data.slice(at, at + 3)); samples.push(actual);
      expected.forEach((value, channel) => assert.ok(Math.abs(actual[channel] - value) <= 5,
        `Browser alpha composition on ${background}: expected ${expected}, got ${actual}`));
    }
    report.captures.push({ name: `preview-over-${background ? 'white' : 'black'}`, samples });
    await canvas.evaluate(element => element.style.removeProperty('background-color'));
  }
  await until(state => state.source.files[state.source.entry]?.length, 'initial example');
  await page.locator('.layout-tools summary').click();
  await page.getByRole('button', { name: 'Reset desktop layout', exact: true }).click();
  if (await page.locator('.layout-tools').evaluate(element => element.open)) await page.locator('.layout-tools summary').click();
  const imported = await importImage('alpha.png', 'image/png', png);
  await build(scene(imported.source.assets));
  // Transparent output must be straight RGB, not merely preserve alpha. Hidden
  // input blue at alpha zero is canonical transparent black after composition.
  await capture('png-alpha', [originalPixels[0], originalPixels[1], [0,0,0,0], originalPixels[3]], { tolerance: 3 });
  await previewOver(0); await previewOver(1);
  await parameters({ backdrop: 0 }); await capture('png-over-black', over(originalPixels, 0));
  await parameters({ backdrop: 1 }); await capture('png-over-white', over(originalPixels, 1));
  report.checks.push('PNG straight RGBA capture, browser alpha composition, and linear scene composition over black and white');

  const beforeReplace = await call('read');
  await page.getByRole('button', { name: 'View assets/alpha.png', exact: true }).click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Replace assets/alpha.png', exact: true }).click();
  await (await chooserPromise).setFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: changedPng });
  const replaced = await until(state => state.draftVersion > beforeReplace.draftVersion && state.source.assets['assets/alpha.png'].data === changedPng.toString('base64'), 'replace PNG');
  assert.equal(replaced.status.authoring.revisionId, beforeReplace.status.authoring.revisionId);
  await capture('unapplied-replacement', over(originalPixels, 1));
  await build(replaced.source); await parameters({ backdrop: 0 }); await capture('replaced-png', over(revisedPixels, 0));
  report.checks.push('Replace preserves the asset path and last applied pixels until explicit Build');

  const withJpeg = await importImage('oriented.jpg', 'image/jpeg', jpeg);
  await build(scene(withJpeg.source.assets, 'assets/oriented.jpg'));
  const jpegExpected = [[230,20,40,255], [230,20,40,255], [20,200,70,255], [20,200,70,255]];
  await capture('jpeg-exif-clockwise', jpegExpected, { tolerance: 8 });
  report.checks.push('Progressive JPEG import renders opaque colors with EXIF clockwise orientation and bounded color tolerance');

  const good = await call('read');
  await page.getByRole('button', { name: 'View assets/oriented.jpg', exact: true }).click();
  await page.getByRole('button', { name: 'Remove assets/oriented.jpg', exact: true }).click();
  const removed = await until(state => state.draftVersion > good.draftVersion && !state.source.assets['assets/oriented.jpg'], 'remove JPEG');
  const failed = await raw('build', { expectedDraftVersion: removed.draftVersion, source: removed.source });
  assert.equal(failed.isError, true); assert.match(JSON.stringify(failed.content), /Missing required decoded image/);
  const retained = await call('read');
  assert.deepEqual(retained.source, removed.source); assert.equal(retained.draftVersion, removed.draftVersion);
  assert.equal(retained.status.authoring.revisionId, good.status.authoring.revisionId);
  assert.equal(retained.status.authoring.generation, good.status.authoring.generation);
  await capture('last-good-after-remove', jpegExpected, { tolerance: 8 });
  const restored = await importImage('oriented.jpg', 'image/jpeg', jpeg);
  await build(scene(restored.source.assets)); await parameters({ backdrop: 1 });
  report.checks.push('Removing a required image leaves an honest draft; failed candidate retains the exact last-good runtime');

  const savedPath = join(output, 'common-images.lux-scene');
  const saving = await call('read');
  await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, savedPath);
  await page.locator('.file-tools summary').click(); await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.document-title')?.textContent === 'common-images.lux-scene' && !document.querySelector('[aria-label="Unsaved changes"]'));
  const saved = JSON.parse(await readFile(savedPath, 'utf8'));
  assert.equal(saved.version, 3); assert.deepEqual(saved.source, saving.source);
  assert.deepEqual(saved.controls.values, { backdrop: 1 });
  assert.equal(saved.controls.sourceHash, saving.status.authoring.revisionId);
  await parameters({ backdrop: 0 });
  await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, savedPath);
  await page.locator('.file-tools summary').click(); await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByRole('button', { name: 'Discard and open', exact: true }).click();
  const reopened = await until(state => state.status.authoring?.generation > saving.status.authoring.generation && state.status.authoring.controls?.backdrop === 1, 'open saved image scene');
  assert.deepEqual(reopened.source, saved.source);
  await capture('reopened', over(revisedPixels, 1));
  const runtime = reopened.status.authoring;
  const restarted = await call('restart', { instanceId: runtime.instanceId, expectedGeneration: runtime.generation });
  assert.ok(restarted.status.authoring.generation > runtime.generation);
  assert.equal(restarted.status.authoring.revisionId, runtime.revisionId);
  assert.deepEqual(restarted.status.authoring.controls, saved.controls.values);
  await capture('restarted', over(revisedPixels, 1));
  report.checks.push('Real Save/Open and cached restart retain both original image byte streams, accepted provenance, controls, and actual pixels');
  await page.screenshot({ path: join(output, 'workspace.png') });
  assert.deepEqual(report.errors, []); report.ok = true;
} catch (error) {
  report.failure = String(error?.stack ?? error); process.exitCode = 1;
  if (page && !page.isClosed()) await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {});
} finally {
  await client?.close();
  if (app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
  await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
