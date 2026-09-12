import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createExportService, runExportChild } from '../../apps/studio/src/export-process.ts';
const document = { format: 'lux-scene', version: 1, source: { sdkVersion: '0.1.0', entry: 'main.ts', files: { 'main.ts': '', 'lib/color.ts': '🌈' } },
  settings: { width: 1920, height: 1080, fps: 60, seed: 0 }, controls: { intensity: 0.75 } };
test('export owns an isolated full document across folder selection and excludes overlapping jobs', async () => {
  let choose!: (value: string | null) => void, received: any;
  const service = createExportService({ chooseDirectory: () => new Promise(resolve => { choose = resolve; }),
    run: async request => { received = request; return { path: 'package', releaseId: 'release', runtimeId: 'runtime' }; } });
  const request = { name: ' Named visual ', document: structuredClone(document) }, pending = service.create(request);
  request.document.source.files['lib/color.ts'] = 'changed after export';
  await assert.rejects(service.create(request), /already in progress/);
  choose('selected-directory'); await pending;
  assert.equal(received.name, 'Named visual'); assert.equal(received.outputDirectory, 'selected-directory');
  assert.equal(received.document.source.files['lib/color.ts'], '🌈'); assert.equal(received.document.controls.intensity, 0.75);
  const cancel = service.create(request); choose(null); assert.equal(await cancel, null);
});
test('invalid names and oversized JSON never open a dialog; failed export releases exclusion', async () => {
  let dialogs = 0;
  const service = createExportService({ chooseDirectory: async () => { dialogs++; return 'folder'; }, run: async () => { throw Error('packaging failed'); } });
  for (const value of [null, { name: '', document }, { name: 'x'.repeat(81), document }, { name: 'bad\nname', document }, { name: 'name', document, outputDirectory: 'injected' }, { name: 'name', document: { text: 'x'.repeat(8388608) } }]) {
    await assert.rejects(service.create(value)); }
  assert.equal(dialogs, 0);
  await assert.rejects(service.create({ name: 'Valid', document }), /packaging failed/);
  await assert.rejects(service.create({ name: 'Valid', document }), /packaging failed/);
  assert.equal(dialogs, 2);
});
test('bounded child transports JSON and rejects errors, malformed output, overflow, timeout and cancellation', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lux-export-child-'));
  const script = join(folder, 'fixture.mjs'), controller = new AbortController();
  const request = { name: 'Test', document: document as any, outputDirectory: folder };
  async function fixture(body: string, options = {}) {
    await writeFile(script, body);
    return runExportChild(request, { workspace: folder, executable: process.execPath, script, ...options });
  }
  try {
    const result = await fixture(`let input=''; for await(const part of process.stdin) input+=part; const request=JSON.parse(input); console.log(JSON.stringify({ok:true,result:{path:request.outputDirectory+'/release',releaseId:'a'.repeat(64),runtimeId:'b'.repeat(64)}}));`);
    assert.match(result.path, /release$/); assert.equal(result.releaseId, 'a'.repeat(64));
    await assert.rejects(fixture(`console.log(JSON.stringify({ok:false,error:'Missing native payload'})); process.exitCode=1;`), /Missing native payload/);
    await assert.rejects(fixture(`console.log('not json');`), /Invalid export result/);
    await assert.rejects(fixture(`console.log('x'.repeat(70000));`), /exceeded/);
    await assert.rejects(fixture(`setInterval(()=>{},1000);`, { timeoutMs: 50 }), /deadline/);
    const aborting = fixture(`setInterval(()=>{},1000);`, { signal: controller.signal }); controller.abort();
    await assert.rejects(aborting, /cancelled/);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
