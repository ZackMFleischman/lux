// Development-only MCP integration check. Own profile, own process, no creative session.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { studioTestEnvironment, resolveStudioSession } from '../../scripts/studio-session.mjs';
import { installedElectron } from '../../scripts/studio-electron.mjs';
import { connectMcp } from './mcp.ts';
const root = resolve(import.meta.dirname, '../..');
const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath };
const session = resolveStudioSession({ workspace: root, env });
const child = spawn(installedElectron(root), [join(root, 'apps/studio/dist/main.cjs')],
  { cwd: root, env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
const exited = once(child, 'exit');
let mcp;
try {
  for (let i = 0; i < 100; i++) {
    try { if (JSON.parse(await readFile(session.endpointPath, 'utf8')).pid === child.pid) break; } catch {}
    if (child.exitCode !== null) throw Error('Test Studio exited during startup');
    await new Promise(r => setTimeout(r, 200));
  }
  mcp = await connectMcp({ root, env });
  assert.equal(mcp.status.studioSession.pid, child.pid);
  console.log(JSON.stringify({ passed: true, pid: child.pid, profile: session.profile,
    tools: mcp.catalog.map(t => t.name), safeOperation: 'lux.studio.status' }));
} finally {
  await mcp?.close();
  child.kill();
  await exited;
}

