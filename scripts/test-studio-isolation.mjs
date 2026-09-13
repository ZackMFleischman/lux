// Scheduled physical demonstration. Requires an already-running creative scene
// and approved Electron inputs. Never launches, edits or closes the creative app.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { canonicalWorkspace, createStudioConnection, resolveStudioSession, studioTestEnvironment } from './studio-session.mjs';
import { installedElectron } from './studio-electron.mjs';

const root = resolve(import.meta.dirname, '..');
if (process.argv.length !== 4 || process.argv[2] !== '--creative-checkout') {
  throw Error('Usage: node scripts/test-studio-isolation.mjs --creative-checkout PATH (after reserving GPU time and approved executable inputs)');
}
const creativeRoot = canonicalWorkspace(process.argv[3]);
assert.notEqual(creativeRoot, canonicalWorkspace(root), 'Demonstrate isolation across separate worktrees');
const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath };
const testSession = resolveStudioSession({ workspace: root, env });
const creativeEnv = { ...process.env, LUX_STUDIO_PROFILE: 'creative' };
delete creativeEnv.LUX_STUDIO_MCP_TEST; delete creativeEnv.LUX_STUDIO_SMOKE; delete creativeEnv.LUX_STUDIO_SESSION_ID;
const output = join(root, 'artifacts', 'studio-isolation', randomUUID());
await mkdir(output, { recursive: true });
const report = { ok: false, checks: [], creativeRoot, testRoot: root, testProfile: testSession.profile, errors: [] };
const clients = [];
const parse = result => JSON.parse(result.content.find(item => item.type === 'text').text);
async function connect(workspace, environment) {
  const client = new Client({ name: 'lux-isolation-demonstration', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(workspace, 'scripts/studio-mcp.mjs')], cwd: workspace, env: environment }));
  clients.push(client);
  return async (name, args = {}) => {
    const result = await client.callTool({ name: `lux.studio.${name}`, arguments: args }, undefined, { timeout: 75000 });
    assert.ok(!result.isError, JSON.stringify(result)); return result;
  };
}
function preserved(read, status) {
  const state = status.authoring;
  return { source: read.source, draftVersion: read.draftVersion, session: status.studioSession,
    runtime: state && { instanceId: state.instanceId, generation: state.generation, revisionId: state.revisionId,
      playback: state.playback, clockEpoch: state.clockEpoch, controls: state.controls, intensity: state.intensity,
      controlSchemaHash: state.controlSchemaHash, controlSequence: state.controlSequence } };
}
async function capture(call, name) {
  const result = await call('capture');
  const png = result.content.find(item => item.type === 'image'); assert.ok(png?.data);
  await writeFile(join(output, `${name}.png`), Buffer.from(png.data, 'base64'));
  await writeFile(join(output, `${name}.json`), JSON.stringify(parse(result), null, 2));
}
let child, exited, control;
try {
  const creative = await connect(creativeRoot, creativeEnv);
  const beforeStatus = parse(await creative('status')), beforeRead = parse(await creative('read'));
  assert.equal(beforeStatus.studioSession.profile, 'creative');
  assert.ok(beforeStatus.authoring, 'Create a working visual in the creative Studio first');
  const before = preserved(beforeRead, beforeStatus);
  await capture(creative, 'creative-before');
  child = spawn(installedElectron(root), [join(root, 'apps/studio/dist/main.cjs')], { cwd: root, env, windowsHide: true, stdio: 'ignore' });
  exited = once(child, 'exit');
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const endpoint = JSON.parse(await readFile(testSession.endpointPath, 'utf8'));
      if (endpoint.pid === child.pid) {
        control = createStudioConnection({ ...testSession, expectedSessionId: endpoint.sessionId }); break;
      }
    } catch { /* A newly launched test app may not have published its endpoint. */ }
    if (child.exitCode !== null) throw Error('Test Studio exited before readiness');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(control, 'Only connect to the test process launched by this demonstration');
  const testing = await connect(root, env), testRead = parse(await testing('read'));
  const built = parse(await testing('build', { expectedDraftVersion: testRead.draftVersion, source: testRead.source }));
  assert.ok(built.status.authoring);
  await capture(testing, 'test-preview');
  assert.deepEqual(preserved(parse(await creative('read')), parse(await creative('status'))), before);
  report.checks.push('Creative source, runtime, controls and playback survived another worktree building a preview');
  await capture(creative, 'creative-during');
  await control('status', { shutdown: true });
  await Promise.race([exited, new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('Test Studio did not exit')), 5000); timer.unref(); })]);
  assert.equal(child.exitCode, 0);
  assert.deepEqual(preserved(parse(await creative('read')), parse(await creative('status'))), before);
  await capture(creative, 'creative-after');
  report.checks.push('Test Studio exited; creative connection and scene remained intact');
  report.ok = true;
} catch (error) { report.errors.push(error.message); process.exitCode = 1; }
finally {
  for (const client of clients) await client.close();
  if (child && child.exitCode === null) {
    if (control) await control('status', { shutdown: true }).catch(() => {});
    if (child.exitCode === null) child.kill();
  }
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, output }, null, 2));
}
