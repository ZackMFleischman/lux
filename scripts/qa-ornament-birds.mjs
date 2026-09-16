import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const installation = JSON.parse(await readFile(process.env.LOCALAPPDATA + '/Programs/Lux/installation.json', 'utf8'));
const sessionId = '552d95c4d5fed7e01d911575b0d6a37fd86a';
const folder = 'artifacts/living-ornament/birds-' + Date.now();
await mkdir(folder, { recursive: true });
const client = new Client({ name: 'ornament-birds-qa', version: '1.0.0' });
const report = { folder, ok: false, captures: [] };
const scene = 'C:/Users/zFlei/.codex/visualizations/2026/09/15/01a0a5cb-03be-7ee2-a6cf-daf659f7ebac/Living Ornament - Companion Birds.lux-scene';
async function raw(name, args = {}) {
  const result = await client.callTool({ name: 'lux.studio.' + name, arguments: args }, undefined, { timeout: 75000 });
  if (result.isError) throw Error(JSON.stringify(result.content));
  return result;
}
const json = result => JSON.parse(result.content.find(item => item.type === 'text').text);
async function call(name, args = {}) { return json(await raw(name, args)); }
async function status() {
  const state = await call('status');
  assert.equal(state.studioSession.sessionId, sessionId);
  assert.equal(state.authoring.fault, null);
  return state;
}
async function playback(action) {
  const s = (await status()).authoring;
  await call('playback', { action, instanceId: s.instanceId, expectedGeneration: s.generation });
}
async function capture(label) {
  const r = await raw('capture');
  const png = r.content.find(c => c.type === 'image');
  const path = folder + '/' + label + '.png';
  await writeFile(path, Buffer.from(png.data, 'base64'));
  const metadata = json(r);
  await writeFile(folder + '/' + label + '.json', JSON.stringify(metadata, null, 2));
  report.captures.push({ path, metadata });
}
try {
  await client.connect(new StdioClientTransport({ command: installation.node, args: [installation.adapter], cwd: installation.workspace,
    env: { ...process.env, LUX_STUDIO_PROFILE: 'desktop', LUX_STUDIO_DESKTOP: '1', LUX_STUDIO_SESSION_ID: sessionId } }));
  const current = await call('read');
  assert.ok(Object.keys(current.source.files).some(p => p.endsWith('ornament-birds.ts')));
  assert.equal(current.libraryLinks.length, 10);
  await writeFile(folder + '/source.json', JSON.stringify(current, null, 2));
  await call('save', { path: scene, expectedDraftVersion: current.draftVersion, overwrite: true });
  report.scene = scene;
  await playback('play');
  const before = await status(); const start = performance.now();
  await delay(20000);
  const after = await status(); const end = performance.now();
  report.performance = { fps: Number(BigInt(after.authoring.frameId) - BigInt(before.authoring.frameId)) / ((end - start) / 1000), seconds: (end - start) / 1000, before, after };
  console.log(JSON.stringify({ folder, fps: report.performance.fps }));
  const pace = Math.max(0.1, after.authoring.controls.pace);
  await playback('pause'); await playback('reset'); await playback('play');
  for (const artisticTime of (process.argv.includes('--final') ? [6, 25] : [6, 15, 25, 32, 40])) {
    const target = artisticTime / pace;
    let s = (await status()).authoring;
    if (s.timeSeconds < target) await delay((target - s.timeSeconds) * 1000);
    await playback('pause'); await capture('flight-' + artisticTime); await playback('play');
    console.log(JSON.stringify({ captured: artisticTime }));
  }
  if (process.argv.includes('--final')) {
    for (const birdSpeed of [0, 2]) {
      const s = (await status()).authoring;
      await call('parameters', { instanceId: s.instanceId, expectedGeneration: s.generation,
        expectedRevisionId: s.revisionId, expectedControlSchemaHash: s.controlSchemaHash,
        values: { birdSpeed }, mode: 'live' });
      await delay(2500);
      assert.equal((await status()).authoring.controls.birdSpeed, birdSpeed);
      await capture('speed-' + birdSpeed);
    }
  }
  // Reopen the saved normal animated source, retaining parameters and links.
  await playback('pause');
  const latest = await call('read');
  await call('open', { path: scene, expectedDraftVersion: latest.draftVersion, discardDirty: true });
  const reopened = await call('read');
  assert.deepEqual(reopened.source, current.source);
  assert.deepEqual(reopened.libraryLinks, current.libraryLinks);
  report.restored = await status();
  assert.equal(report.restored.authoring.playback, 'playing');
  report.ok = true;
} finally {
  await writeFile(folder + '/result.json', JSON.stringify(report, null, 2));
  await client.close();
}
console.log(JSON.stringify({ ok: report.ok, folder, scene }));
