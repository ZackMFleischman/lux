import { spawn } from 'node:child_process';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateResolumeEvidence } from './gpu-evidence.mjs';

if (process.env.LUX_EXPERIMENT_MODE !== 'hardware' || !process.env.LUX_EXPERIMENT_RUN_ID ||
    !process.env.LUX_EXPERIMENT_DIRECTORY || !/^[1-9]\d*$/.test(process.env.LUX_RESOLUME_PID || '') ||
    !Number.isInteger(Number(process.env.LUX_EXPERIMENT_TIMEOUT_MS)) ||
    Number(process.env.LUX_EXPERIMENT_TIMEOUT_MS) < 25000) throw Error('Reviewed Resolume experiment with a 25000 ms budget required');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(process.env.LUX_EXPERIMENT_DIRECTORY, 'gpu');
await mkdir(output, { recursive: true });
const hostLog = join(tmpdir(), 'LuxTracer-tr02-host.jsonl');
const before = await readFile(hostLog, 'utf8');
const rows = text => text.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const history = rows(before);
const contextIndex = history.findLastIndex(row => row.kind === 'context' && row.pid === Number(process.env.LUX_RESOLUME_PID));
if (contextIndex < 0) throw Error('Load one Lux TR02 Probe source in the reviewed Resolume host before starting');
const initialCounters = history.slice(contextIndex).findLast(row => row.kind === 'counters');
if (!initialCounters) throw Error('Wait for the active source to record counters before starting');
await writeFile(join(output, 'host-before.jsonl'), before);
const stdout = await open(join(output, 'producer-stdout.log'), 'wx');
const stderr = await open(join(output, 'producer-stderr.log'), 'wx');
try {
  const env = { ...process.env, LUX_GPU_OUTPUT: output, LUX_GPU_DURATION_MS: '15000' };
  delete env.ELECTRON_RUN_AS_NODE;
  const outcome = await new Promise((done, reject) => {
    const child = spawn(join(root, 'node_modules/electron/dist/electron.exe'), [join(root, 'apps/render-host/src/main.cjs')],
      { cwd: root, env, windowsHide: true, stdio: ['ignore', stdout.fd, stderr.fd] });
    child.once('error', reject);
    child.once('exit', (code, signal) => done({ pid: child.pid, code, signal }));
  });
  const producer = JSON.parse(await readFile(join(output, 'probe.json'), 'utf8'));
  const after = await readFile(hostLog, 'utf8');
  if (!after.startsWith(before)) throw Error('Host log was replaced during the test');
  const receiver = rows(after.slice(before.length));
  await writeFile(join(output, 'receiver.jsonl'), after.slice(before.length));
  const { ok, consumed } = validateResolumeEvidence(producer, receiver, outcome, initialCounters);
  await writeFile(join(output, 'diagnostic.json'), JSON.stringify({ ok, scope: 'short-resolume-diagnostic-only', outcome,
    externalHostPid: Number(process.env.LUX_RESOLUME_PID), hostSupervised: false, consumed,
    controls: producer.filter(row => row.kind === 'host-control'), manualVisualCheckRequired: true }, null, 2));
  process.exitCode = ok ? 0 : 2;
} catch (error) {
  await writeFile(join(output, 'diagnostic.json'), JSON.stringify({ ok: false, error: String(error) }, null, 2));
  process.exitCode = 2;
} finally { await stdout.close(); await stderr.close(); }
