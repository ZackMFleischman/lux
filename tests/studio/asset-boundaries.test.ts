import test from 'node:test';
import assert from 'node:assert/strict';
import { StandaloneClient } from '../../apps/studio/src/standalone-client.ts';
import { sourceBuildInputSchema, sourceReadResult } from '../../apps/studio/src/source/agent-contract.ts';
import { sourceBundleSchema } from '../../packages/runtime-contracts/src/index.ts';
import { createAgentBridge } from '../../apps/studio/src/agent-bridge.ts';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { SceneFileStore, createSceneDocument } from '../../packages/core/src/scene-file.ts';
import { prepareTransportScene } from '../../scripts/transport-prepare.mjs';
import { exportSceneDocument } from '../../scripts/studio-export.mjs';

const source = { sourceVersion: 2 as const, sdkVersion: '0.1.0' as const, entry: 'main.ts', files: { 'main.ts': 'export const label = "日本";' }, assets: {} };
test('MCP full-source schema preserves v2 and rejects omitted assets or unknown fields', () => {
  const result = sourceBuildInputSchema.parse({ source, expectedDraftVersion: 3 });
  assert.deepEqual(result.source, sourceBundleSchema.parse(source));
  assert.equal(sourceBuildInputSchema.safeParse({ source: { ...source, assets: undefined }, expectedDraftVersion: 3 }).success, false);
  assert.equal(sourceBuildInputSchema.safeParse({ source: { ...source, other: true }, expectedDraftVersion: 3 }).success, false);
  assert.deepEqual(JSON.parse(sourceReadResult({ source, draftVersion: 3 }).content[0]!.text), { source, draftVersion: 3 });
  assert.throws(() => sourceReadResult({ text: '\\'.repeat(8 * 1024 * 1024) }), /16 MiB/);
});
test('v2 source reaches preview compilation and compiler failure keeps the current preview', async () => {
  let compiled = false;
  const client = new StandaloneClient({ compile: async (input:any) => { compiled = true; assert.deepEqual(input,source);return {ok:false,diagnostics:[{code:'COMPILE_FAILED',message:'invalid source'}]}; } } as any);
  const before = client.getSnapshot().authoring;
  await assert.rejects(client.submit(source), /invalid source/);
  assert.equal(compiled, true); assert.equal(client.getSnapshot().authoring, before);
});
test('source and linked versions must match before creating a preview worker',async()=>{
  const client=new StandaloneClient({compile:async()=>({ok:true,linked:{code:'legacy'},sourceHash:'revision'})} as any);
  await assert.rejects(client.submit(source),/versions do not match/);
  assert.equal(client.getSnapshot().authoring,null);
});
test('agent bridge round-trips complete Unicode source and rejects oversized read responses', async () => {
  const bridge = await createAgentBridge(async method => method === 'read' ? { value: 'x'.repeat(16 * 1024 * 1024) } : source);
  try {
    const headers = { authorization: `Bearer ${bridge.token}` };
    const response = await fetch(bridge.url, { method: 'POST', headers, body: JSON.stringify({ id: 'source', method: 'build', params: { source } }) });
    assert.deepEqual((await response.json()).result, source);
    const rejected = await fetch(bridge.url, { method: 'POST', headers, body: JSON.stringify({ id: 'large', method: 'read' }) });
    assert.equal(rejected.status, 400);
    assert.match((await rejected.json()).error, /16 MiB/);
    const malformed = Buffer.concat([Buffer.from('{"id":"bad","method":"build","params":{"text":"'), Buffer.from([0xc3]), Buffer.from('"}}')]);
    assert.equal((await fetch(bridge.url, { method: 'POST', headers, body: malformed })).status, 400);
  } finally { bridge.close(); }
});
test('asset export reaches validation and invalid source never publishes a transport', async () => {
  const compiled = spawnSync(process.execPath, ['scripts/studio-compile.mjs'], { input: JSON.stringify(source), encoding: 'utf8', windowsHide: true, timeout: 10000 });
  assert.equal(compiled.status, 0, compiled.stderr);
  const result = JSON.parse(compiled.stdout); assert.equal(result.ok, false);
  assert.match(result.diagnostics[0].message, /Entry must export default/);
  const directory = await mkdtemp(join(tmpdir(), 'lux-asset-gate-'));
  try {
    const document = createSceneDocument(source, { width: 1920, height: 1080, fps: 60, seed: 0 }, { intensity: 0.5 });
    const path = join(directory, 'scene.lux-scene'), output = join(directory, 'output');
    await new SceneFileStore().saveAs(path, document);
    await assert.rejects(prepareTransportScene(path, output), /Entry must export default/);
    await assert.rejects(access(output));
    await assert.rejects(exportSceneDocument({ name: 'Image', document, outputDirectory: directory }, {
      prepare: async () => {throw Error('invalid asset scene source');}, exporter: async () => assert.fail('must not publish'),
    }), /invalid asset scene source/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
