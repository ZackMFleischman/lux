import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { once } from 'node:events';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const env = { ...process.env, LUX_NODE_EXECUTABLE: process.execPath, LUX_STUDIO_MCP_TEST: '1' };
delete env.ELECTRON_RUN_AS_NODE; delete env.LUX_STUDIO_SMOKE;
const app = spawn(createRequire(import.meta.url)('electron'), [join(root, 'apps/studio/dist/main.cjs')], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = ''; app.stdout.on('data', chunk => { if (logs.length < 16000) logs += chunk; }); app.stderr.on('data', chunk => { if (logs.length < 16000) logs += chunk; });
const exited = once(app, 'exit');
let endpoint, client;
const folder = join(root, 'artifacts/studio-mcp'); await mkdir(folder, { recursive: true });
try {
  for (let i = 0; i < 80; i++) {
    try { const value = JSON.parse(await readFile(join(process.env.APPDATA, 'Lux/Studio/agent-endpoint.json'), 'utf8')); if (value.pid === app.pid) { endpoint = value; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(endpoint, 'This test must connect only to its own Studio process');
  client = new Client({ name: 'lux-standalone-integration-test', version: '0.1.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(root, 'scripts/studio-mcp.mjs')], cwd: root }));
  const call = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 75000 });
    assert.equal(result.isError, undefined, JSON.stringify(result)); return result;
  };
  const parsed = result => JSON.parse(result.content.find(part => part.type === 'text').text);
  const discovery = parsed(await call('lux.studio.discover')); assert.ok(discovery.contractSource.includes('VisualDefinition'));
  let read;
  for (let i = 0; i < 20; i++) { read = parsed(await call('lux.studio.read')); if (read.source) break; await new Promise(resolve => setTimeout(resolve, 250)); }
  assert.ok(read.source);
  read.source.files['lib/color.ts'] = 'export const green = 0.2;';
  read.source.files[read.source.entry] = "import { green } from './lib/color.ts';\n" + read.source.files[read.source.entry].replace('vec4(level, 0.2, 0.4, 1)', 'vec4(level, green, 0.4, 1)');
  const first = parsed(await call('lux.studio.build', { expectedDraftVersion: read.draftVersion, source: read.source }));
  assert.equal(first.status.authoring.playback, 'paused');
  const target = { instanceId: first.status.authoring.instanceId, expectedGeneration: first.status.authoring.generation };
  const controlled = parsed(await call('lux.studio.parameters', { ...target, expectedRevisionId: first.status.authoring.revisionId, values: { intensity: 0.8 } }));
  assert.equal(controlled.status.authoring.intensity, 0.8);
  assert.ok(controlled.status.authoring.controlSequence > 0);
  assert.equal(controlled.applied.controlSequence, controlled.status.authoring.controlSequence);
  for (const action of ['play', 'pause', 'reset']) {
    const result = parsed(await call('lux.studio.playback', { ...target, action }));
    assert.equal(result.status.authoring.playback, action === 'play' ? 'playing' : 'paused');
    if (action === 'reset') assert.equal(result.status.authoring.clockEpoch, 1);
  }
  for (const args of [
    { ...target, expectedRevisionId: first.status.authoring.revisionId, values: { intensity: 2 } },
    { ...target, expectedRevisionId: 'stale', values: { intensity: 0.5 } },
    { ...target, expectedRevisionId: first.status.authoring.revisionId, values: { intensity: 0.5, unknown: 1 } },
  ]) assert.equal((await client.callTool({ name: 'lux.studio.parameters', arguments: args })).isError, true);
  const firstImage = await call('lux.studio.capture');
  const image1 = firstImage.content.find(part => part.type === 'image'); assert.ok(image1?.data);
  assert.equal(parsed(firstImage).intensity, 0.8);
  assert.equal(parsed(firstImage).controlSequence, controlled.applied.controlSequence);
  const restartStarted = performance.now();
  const restarted = parsed(await call('lux.studio.restart', target));
  const restartToReadyMs = performance.now() - restartStarted;
  assert.ok(restartToReadyMs < 5000, `Cached preview restart took ${restartToReadyMs.toFixed(0)} ms`);
  assert.ok(restarted.status.authoring.generation > target.expectedGeneration);
  assert.equal(restarted.status.authoring.revisionId, first.status.authoring.revisionId);
  assert.equal(restarted.status.authoring.intensity, 0.8);
  assert.equal(restarted.status.authoring.playback, 'paused');
  assert.equal((await client.callTool({ name: 'lux.studio.playback', arguments: { ...target, action: 'reset' } })).isError, true);
  const updated = structuredClone(read.source); updated.files['lib/color.ts'] = 'export const green = 0.75;';
  assert.notDeepEqual(updated, read.source);
  assert.equal(updated.files[updated.entry], read.source.files[read.source.entry], 'Only the imported helper changes');
  const second = parsed(await call('lux.studio.build', { expectedDraftVersion: first.draftVersion, source: updated }));
  assert.notEqual(second.status.authoring.revisionId, first.status.authoring.revisionId);
  const secondImage = await call('lux.studio.capture'), image2 = secondImage.content.find(part => part.type === 'image');
  assert.notEqual(image2.data, image1.data, 'A code revision must change actual rendered image bytes');
  const stale = await client.callTool({ name: 'lux.studio.build', arguments: { expectedDraftVersion: first.draftVersion, source: read.source } });
  assert.equal(stale.isError, true);
  const invalidHelper = structuredClone(updated); invalidHelper.files['lib/color.ts'] = 'export const green: number = "invalid";';
  const helperFailure = await client.callTool({ name: 'lux.studio.build', arguments: { expectedDraftVersion: second.draftVersion, source: invalidHelper } });
  assert.equal(helperFailure.isError, true);
  const retained = parsed(await call('lux.studio.read'));
  assert.deepEqual(retained.source, updated); assert.equal(retained.draftVersion, second.draftVersion);
  const hanging = structuredClone(updated);
  hanging.files[hanging.entry] = hanging.files[hanging.entry].replace('async create(context) {', 'async create(context) { while (true) {}');
  const failedCandidate = await client.callTool({ name: 'lux.studio.build', arguments: { expectedDraftVersion: second.draftVersion, source: hanging } }, undefined, { timeout: 75000 });
  assert.equal(failedCandidate.isError, true);
  assert.match(JSON.stringify(failedCandidate.content), /initialization stopped making progress/);
  const recovered = parsed(await call('lux.studio.status'));
  assert.equal(recovered.authoring.generation, second.status.authoring.generation);
  assert.equal(recovered.authoring.revisionId, second.status.authoring.revisionId);
  assert.equal(recovered.authoring.fault, null);
  await writeFile(join(folder, 'first.png'), Buffer.from(image1.data, 'base64'));
  await writeFile(join(folder, 'revised.png'), Buffer.from(image2.data, 'base64'));
  await writeFile(join(folder, 'result.json'), JSON.stringify({ ok: true, initial: first.status.authoring, revised: second.status.authoring, metadata: parsed(secondImage), controlsApplied: controlled, restarted: restarted.status.authoring, restartToReadyMs, helperOnlyRevisionChangedImage: true, invalidHelperPreservedDraft: true, staleGenerationRejected: true, staleEditRejected: true, hangingCandidateRejected: true, previousPreviewRetained: true }, null, 2));
  console.log('Actual MCP source/image/revision loop passed; stale edit and hanging candidate rejected, previous preview retained.');
} catch (error) { console.error(error); console.error(logs); process.exitCode = 1; }
finally {
  await client?.close();
  if (endpoint) await fetch(endpoint.url, { method: 'POST', headers: { authorization: `Bearer ${endpoint.token}` }, body: JSON.stringify({ id: 'test-shutdown', method: 'status', params: { shutdown: true } }) }).catch(() => {});
  await exited;
  await writeFile(join(folder, 'app.log'), logs);
}
