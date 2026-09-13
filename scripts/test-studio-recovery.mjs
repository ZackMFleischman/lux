import { studioTestEnvironment, resolveStudioSession } from './studio-session.mjs';
import assert from 'node:assert/strict';
import { _electron } from 'playwright';
import { installedElectron } from './studio-electron.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { decode } from 'fast-png';

const root = resolve(import.meta.dirname, '..'), folder = join(root, 'artifacts/studio-recovery');
await mkdir(folder, { recursive: true });
const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath };
const testSession = resolveStudioSession({ workspace: root, env });
delete env.ELECTRON_RUN_AS_NODE; delete env.LUX_STUDIO_SMOKE;
const report = { ok: false, checks: [], runs: [], errors: [], physicalStopVerified: false, gpuCleanupVerified: false };
let app, client;
try {
  app = await _electron.launch({ executablePath: installedElectron(root), args: [join(root, 'apps/studio/dist/main.cjs')], cwd: root, env, timeout: 30000 });
  const page = await app.firstWindow(); page.on('pageerror', error => report.errors.push(error.stack ?? error.message));
  await page.getByRole('button', { name: 'Build', exact: true }).waitFor();
  const ownedPid = await app.evaluate(() => process.pid);
  let endpoint;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { endpoint = JSON.parse(await readFile(testSession.endpointPath, 'utf8')); if (endpoint.pid === ownedPid) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(endpoint?.pid, ownedPid, 'Only control this test app');
  client = new Client({ name: 'lux-recovery-qa', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(root, 'scripts/studio-mcp.mjs')], cwd: root, env }));
  const call = async (name, args = {}, timeout = 30000) => {
    const result = await client.callTool({ name: `lux.studio.${name}`, arguments: args }, undefined, { timeout });
    assert.equal(result.isError, undefined, JSON.stringify(result));
    return JSON.parse(result.content.find(part => part.type === 'text').text);
  };
  const template = await readFile(join(root, 'packages/visual-sdk/examples/parameters.ts'), 'utf8');
  for (const mode of ['throw', 'unresponsive']) {
    const injection = mode === 'throw' ? "throw Error('LUX_QA_RUNTIME_THROW');" : 'while (true) {}';
    const source = { sdkVersion: '0.2.0', entry: 'visual.ts', files: { 'visual.ts': template.replace('update(frame) {', `update(frame) { if (frame.timeSeconds > 0.35) { ${injection} }`) } };
    const current = await call('read');
    const built = await call('build', { expectedDraftVersion: current.draftVersion, source });
    const original = built.status.authoring;
    const parameters = { instanceId: original.instanceId, expectedGeneration: original.generation, expectedRevisionId: original.revisionId, expectedControlSchemaHash: original.controlSchemaHash };
    await call('parameters', { ...parameters, values: { brightness: 0.8, speed: 0.7 } });
    await call('playback', { instanceId: original.instanceId, expectedGeneration: original.generation, action: 'play' });
    const started = performance.now(), samples = [];
    let final;
    while (performance.now() - started < 20000) {
      const status = await call('status', {}, Math.max(100, Math.min(3000, 20000 - (performance.now() - started)))), runtime = status.authoring;
      samples.push({ elapsedMs: performance.now() - started, generation: runtime.generation, playback: runtime.playback, frameId: runtime.frameId, fault: runtime.fault, message: status.message });
      assert.equal(runtime.revisionId, original.revisionId);
      assert.deepEqual(runtime.controls, { brightness: 0.8, speed: 0.7 });
      assert.ok(runtime.generation <= original.generation + 1, 'Only one automatic restart is allowed');
      if (runtime.generation === original.generation + 1 && runtime.playback === 'failed') { final = runtime; break; }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(final, 'Repeated failure must reach the suppressed state within the test deadline');
    assert.ok(samples.some(sample => sample.generation === original.generation + 1 && sample.playback === 'playing'), 'Automatic recovery preserves playing intent');
    await new Promise(resolve => setTimeout(resolve, 1100));
    const suppressed = await call('status');
    assert.equal(suppressed.authoring.generation, final.generation);
    assert.equal(suppressed.authoring.playback, 'failed');
    assert.match(suppressed.message, /30 seconds/);
    const retained = await call('read');
    assert.deepEqual(retained.source, source); assert.equal(retained.draftVersion, built.draftVersion);
    const restarted = await call('restart', { instanceId: final.instanceId, expectedGeneration: final.generation });
    assert.equal(restarted.status.authoring.generation, final.generation + 1);
    assert.equal(restarted.status.authoring.playback, 'paused');
    assert.deepEqual(restarted.status.authoring.controls, { brightness: 0.8, speed: 0.7 });
    const capture = await client.callTool({ name: 'lux.studio.capture', arguments: {} });
    assert.equal(capture.isError, undefined);
    const png = Buffer.from(capture.content.find(part => part.type === 'image').data, 'base64');
    await writeFile(join(folder, `${mode}-explicit-recovery.png`), png);
    const pixels = decode(png), center = [...pixels.data.slice((540 * 1920 + 960) * 4, (540 * 1920 + 960) * 4 + 4)];
    assert.deepEqual([pixels.width, pixels.height], [1920, 1080]);
    assert.ok(center.every((value, channel) => Math.abs(value - [231, 124, 170, 255][channel]) <= 1), 'Recovered reference pixels reflect brightness 0.8');
    assert.equal(pixels.data[3], 0, 'Recovered scene retains its transparent outside area');
    const metadata = JSON.parse(capture.content.find(part => part.type === 'text').text);
    assert.equal(metadata.generation, final.generation + 1);
    assert.deepEqual(metadata.controls, { brightness: 0.8, speed: 0.7 });
    report.runs.push({ mode, samples, firstFaultObservedFromPlayMs: samples.find(sample => sample.generation === original.generation && sample.playback === 'failed')?.elapsedMs ?? null });
    report.checks.push(`${mode}: one automatic retry preserves playing and controls; second failure suppresses retries; source survives and explicit paused restart captures successfully`);
  }
  assert.deepEqual(report.errors, []);
  report.ok = true;
} catch (error) { report.error = String(error.stack ?? error); console.error(error); process.exitCode = 1; }
finally {
  try { await client?.close(); }
  catch (error) { report.ok = false; report.cleanupError = String(error); process.exitCode = 1; }
  finally { if (app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); } }
  await writeFile(join(folder, 'result.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ ...report, runs: report.runs.map(({ samples, ...run }) => ({ ...run, observations: samples.length })) }));
