import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertResultBudgets } from './result-budget.mjs';
import { violation, limits } from './source-policy.mjs';
import { verifyArtifact, verifyLinked } from './artifact-identity.mjs';
import { readBoundedJson, boundedJson } from './bounded-json.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../../..');
export const linkedByteLimit = 16777216;
const quote = value => '"' + value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1') + '"';

/** Trusted service API. No worker path, command, or resolution hooks come from source.
 * @param {import('../../../packages/runtime-contracts/src/index.ts').CompiledArtifact} artifact
 * @param {{dependencyRoot?:string}} options */
export async function linkRuntime(artifact, options = {}) {
  assertResultBudgets({ ok: true, artifact, diagnostics: [] });
  artifact = await verifyArtifact(artifact,hash);
  if (process.platform !== 'win32') throw violation('Runtime linker requires Windows Job containment', 'SERVICE_UNAVAILABLE');
  const directory = await mkdtemp(join(tmpdir(), 'lux-link-'));
  let cleanup = false, keep = false;
  try {
    const input = join(directory, 'input.json'), config = join(directory, 'config.json');
    await writeFile(input, boundedJson({ artifact, dependencyRoot: resolve(options.dependencyRoot || join(root, 'node_modules')) },limits.requestBytes));
    await writeFile(config, JSON.stringify({ executable: process.execPath,
      commandLine: [process.execPath, '--max-old-space-size=256', join(here, 'link-worker.mjs'), input].map(quote).join(' '),
      cwd: directory, directory, timeoutMs: 30000, memoryLimitBytes: 1073741824 }));
    await new Promise((done, reject) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts/experiment-job.ps1'), '-Config', config], {
        windowsHide: true, stdio: ['ignore', 'ignore', 'ignore'],
        env: { SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, PATH: process.env.PATH },
      });
      const timer = setTimeout(() => { child.kill(); reject(violation('Linker supervisor deadline; cleanup unconfirmed', 'SERVICE_UNAVAILABLE')); }, 45000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('close', code => { clearTimeout(timer); code === 0 ? done() : reject(violation('Linker supervisor failed; cleanup unconfirmed', 'SERVICE_UNAVAILABLE')); });
    });
    const job = await readBoundedJson(join(directory, 'result.json'),limits.diagnosticBytes);
    cleanup = job.cleanupComplete === true;
    if (!cleanup) throw violation('Linker cleanup unconfirmed', 'SERVICE_UNAVAILABLE');
    if (job.timeout) throw violation('Runtime linking exceeded 30 seconds', 'TIMEOUT');
    const resultPath = join(directory, 'link-result.json');
    const result = await readBoundedJson(resultPath,linkedByteLimit);
    if (!result.ok) { if (result.code === 'SERVICE_UNAVAILABLE') keep = true; throw violation(result.message, result.code); }
    if (Buffer.byteLength(JSON.stringify(result.linked), 'utf8') > linkedByteLimit) throw violation('Linked result exceeds 16 MiB', 'QUOTA_EXCEEDED');
    return await verifyLinked(result.linked,hash,artifact);
  } catch (error) {
    if (!cleanup || keep) { keep = true; error.message += `; retained evidence: ${directory}`; }
    throw error;
  } finally { if (cleanup && !keep) await rm(directory, { recursive: true, force: true }); }
}
