import assert from 'node:assert/strict';
import { _electron } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..'), output = join(root, 'artifacts/studio-assets');
const document = JSON.parse(await readFile(join(root, 'tests/fixtures/installed-sources/required-image/scene.lux-scene'), 'utf8'));
const colors = [[255,0,0], [0,255,0], [0,0,255], [0,255,255], [255,0,255], [255,255,0]];
const hash = data => createHash('sha256').update(Buffer.from(data, 'base64')).digest('hex');
const report = { ok: false, checks: [], errors: [], captures: [] };
const env = { ...process.env, LUX_NODE_EXECUTABLE: process.execPath, LUX_STUDIO_MCP_TEST: '1' };
delete env.ELECTRON_RUN_AS_NODE; delete env.LUX_STUDIO_SMOKE;
await mkdir(output, { recursive: true });
let app, client, page;
try {
  app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'),
    args: [join(root, 'apps/studio/dist/main.cjs')], cwd: root, env, timeout: 30000, chromiumSandbox: true });
  page = await app.firstWindow(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /Content Security Policy|Refused to (apply|execute|load)/i.test(message.text())) report.errors.push(message.text()); });
  const pid = await app.evaluate(() => process.pid);
  let owned = false;
  for (let i = 0; i < 80; i++) {
    try { owned = JSON.parse(await readFile(join(process.env.APPDATA, 'Lux/Studio/agent-endpoint.json'), 'utf8')).pid === pid; } catch {}
    if (owned) break; await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(owned, 'Only connect to the Studio process owned by this test');
  client = new Client({ name: 'lux-asset-integration-test', version: '0.1.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(root, 'scripts/studio-mcp.mjs')], cwd: root }));
  const parse = result => JSON.parse(result.content.find(part => part.type === 'text').text);
  const call = async (name, args = {}) => {
    const result = await client.callTool({ name: `lux.studio.${name}`, arguments: args }, undefined, { timeout: 75000 });
    assert.equal(result.isError, undefined, JSON.stringify(result)); return result;
  };
  async function capture(name, expected) {
    const response = await call('capture'), data = response.content.find(part => part.type === 'image').data;
    await writeFile(join(output, `${name}.png`), Buffer.from(data, 'base64'));
    const pixels = await app.evaluate(({ nativeImage }, base64) => {
      const image = nativeImage.createFromBuffer(Buffer.from(base64, 'base64')), size = image.getSize(), bytes = image.toBitmap();
      const samples = [0.25, 0.75].flatMap(y => [0.22, 0.5, 0.78].map(x => {
        const offset = (Math.floor(y * size.height) * size.width + Math.floor(x * size.width)) * 4;
        return [bytes[offset + 2], bytes[offset + 1], bytes[offset], bytes[offset + 3]];
      }));
      return { ...size, samples };
    }, data);
    assert.equal(pixels.width, 1920); assert.equal(pixels.height, 1080);
    for (let index = 0; index < expected.length; index++) {
      for (let channel = 0; channel < 3; channel++) assert.ok(Math.abs(pixels.samples[index][channel] - expected[index][channel]) <= 40,
        `${name} region${index} expected${expected[index]}, got${pixels.samples[index]}`);
      assert.equal(pixels.samples[index][3], 255);
    }
    const record = { name, metadata: parse(response), ...pixels }; report.captures.push(record); return record;
  }
  assert.equal(parse(await call('discover')).sourceDocuments.assetPlayback, true);
  let initial;
  for (let i = 0; i < 40; i++) {
    initial = parse(await call('read'));
    if (initial.source.files[initial.source.entry]?.length) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(initial.source.files[initial.source.entry]?.length, 'Wait for initial example loading before guarded replacement');
  const built = parse(await call('build', { expectedDraftVersion: initial.draftVersion, source: document.source }));
  await capture('original', colors);
  report.checks.push('Six actual GPU image regions match top/bottom orientation and RGB/CMY colors');
  const revised = structuredClone(document.source), bytes = Buffer.from(revised.assets['assets/checker.bmp'].data, 'base64');
  bytes.set([255,255,255], 66); revised.assets['assets/checker.bmp'].data = bytes.toString('base64');
  const changed = parse(await call('build', { expectedDraftVersion: built.draftVersion, source: revised }));
  assert.notEqual(changed.status.authoring.revisionId, built.status.authoring.revisionId);
  assert.deepEqual(revised.files, document.source.files);
  const updatedColors = [[255,255,255], ...colors.slice(1)];
  await capture('pixel-revised', updatedColors);
  report.assetHashes = { original: hash(document.source.assets['assets/checker.bmp'].data), revised: hash(revised.assets['assets/checker.bmp'].data) };
  report.checks.push('Changing only embedded image pixels changes source identity and the actual preview');
  const runtime = changed.status.authoring;
  await call('parameters', { instanceId: runtime.instanceId, expectedGeneration: runtime.generation, expectedRevisionId: runtime.revisionId, values: { intensity: 0.42 } });
  const restarted = parse(await call('restart', { instanceId: runtime.instanceId, expectedGeneration: runtime.generation }));
  assert.ok(restarted.status.authoring.generation > runtime.generation);
  assert.equal(restarted.status.authoring.intensity, 0.42);
  assert.equal(restarted.status.authoring.revisionId, runtime.revisionId);
  await capture('restarted', updatedColors);
  report.checks.push('Runtime restart retains exact asset bytes, revision and applied controls');
  const before = parse(await call('read')), missing = structuredClone(revised); delete missing.assets['assets/checker.bmp'];
  const failed = await client.callTool({ name: 'lux.studio.build', arguments: { expectedDraftVersion: before.draftVersion, source: missing } }, undefined, { timeout: 75000 });
  assert.equal(failed.isError, true); assert.match(JSON.stringify(failed.content), /Missing required asset/);
  const retained = parse(await call('read'));
  assert.deepEqual(retained.source, revised); assert.equal(retained.draftVersion, before.draftVersion);
  assert.equal(retained.status.authoring.generation, restarted.status.authoring.generation);
  await capture('retained-after-failure', updatedColors);
  report.checks.push('Missing required image rejects candidate and retains source, version and working preview');
  const savedPath = join(output, 'image-roundtrip.lux-scene');
  await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, savedPath);
  await page.locator('.file-tools summary').click(); await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.document-name')?.textContent?.includes('image-roundtrip.lux-scene'));
  const saved = JSON.parse(await readFile(savedPath, 'utf8'));
  assert.equal(saved.version, 2); assert.deepEqual(saved.source, revised); assert.equal(saved.controls.intensity, 0.42);
  await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, savedPath);
  await page.locator('.file-tools summary').click(); await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.build-status')?.textContent?.includes('Preview current'));
  await page.getByRole('button', { name: 'Build', exact: true }).waitFor({ state: 'visible' });
  for (let i = 0; i < 40 && !(await page.getByRole('button', { name: 'Build', exact: true }).isEnabled()); i++) await new Promise(resolve => setTimeout(resolve, 250));
  const reopened = parse(await call('read')); assert.deepEqual(reopened.source, revised);
  assert.ok(reopened.status.authoring.generation > restarted.status.authoring.generation, 'Open must finish building a new runtime before capture');
  assert.equal(reopened.status.authoring.intensity, 0.42);
  await capture('reopened', updatedColors);
  report.checks.push('Real File Save/Open preserves v2 bytes and controls and renders the reopened image');
  await page.screenshot({ path: join(output, 'workspace.png') });
  assert.deepEqual(report.errors, []); report.ok = true;
} catch (error) {
  report.failure = String(error?.stack ?? error); process.exitCode = 1;
  if (page && !page.isClosed()) await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {});
} finally {
  await client?.close(); await app?.close();
  await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
