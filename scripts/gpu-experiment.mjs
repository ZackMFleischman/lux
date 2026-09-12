import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, open } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProbeEvidence } from './gpu-evidence.mjs';
import releaseIO from '../tools/gpu-spike/transport-release.cjs';

if (process.env.LUX_EXPERIMENT_MODE !== 'hardware' || !process.env.LUX_EXPERIMENT_RUN_ID || !process.env.LUX_EXPERIMENT_DIRECTORY) {
  throw Error('Reviewed experiment supervisor required');
}
if (Number(process.env.LUX_EXPERIMENT_TIMEOUT_MS) < 15000 || !Number.isFinite(Number(process.env.LUX_EXPERIMENT_TIMEOUT_MS))) {
  throw Error('Short GPU pair requires at least a 15000 ms supervisor budget; use 20000 ms');
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(process.env.LUX_EXPERIMENT_DIRECTORY, 'gpu');
await mkdir(output, { recursive: true });
// The outer Windows Job owns both processes from creation through teardown.
// Never use process-name termination here. Failure exits cause job-wide cleanup.
async function child(name, executable, args, env) {
  const stdout = await open(join(output, name + '-stdout.log'), 'wx');
  const stderr = await open(join(output, name + '-stderr.log'), 'wx');
  try {
    return await new Promise((resolveResult, reject) => {
      const process = spawn(executable, args, { cwd: root, env, windowsHide: true, stdio: ['ignore', stdout.fd, stderr.fd] });
      process.once('error', reject);
      process.once('exit', (code, signal) => code === 0 ? resolveResult({ name, pid: process.pid, code }) : reject(Error(`${name} failed: ${code}/${signal}`)));
    });
  } finally { await stdout.close(); await stderr.close(); }
}
try {
  const env = { ...process.env, LUX_GPU_OUTPUT: output, LUX_HOST_LOG: join(output, 'receiver.jsonl'), LUX_GPU_DURATION_MS: '5000', LUX_STANDALONE_DURATION_MS: '10000' };
  delete env.ELECTRON_RUN_AS_NODE;
  const outcomes = await Promise.all([
    child('receiver', join(root, 'native/build/Release/lux_standalone_host.exe'), [join(root, 'native/build/Release/LuxTracerTR02.dll'), join(output, 'final.rgba')], env),
    child('producer', join(root, 'node_modules/electron/dist/electron.exe'), [join(root, 'apps/render-host/src/main.cjs')], env),
  ]);
  const producer = JSON.parse(await readFile(join(output, 'probe.json'), 'utf8'));
  const receiver = (await readFile(join(output, 'receiver.jsonl'), 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const release=process.env.LUX_TRANSPORT_BUNDLE?releaseIO.readTransportRelease(process.env.LUX_TRANSPORT_BUNDLE):null;
  const result = { ...validateProbeEvidence(producer, receiver, release), outcomes };
  await writeFile(join(output, 'diagnostic.json'), JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 2);
} catch (error) {
  await writeFile(join(output, 'diagnostic.json'), JSON.stringify({ ok: false, error: String(error) }, null, 2));
  process.exit(2);
}
