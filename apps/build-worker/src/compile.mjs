import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { limits, validateSource } from './source-policy.mjs';
import { assertResultBudgets } from './result-budget.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const failure = (code, message) => ({ ok: false, code, diagnostics: [{ code, message }] });
const quote = value => '"' + value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1') + '"';

export async function readCompileResult(resultPath) {
  if ((await stat(resultPath)).size > limits.outputBytes + limits.diagnosticBytes) return failure('QUOTA_EXCEEDED', 'Compiler result exceeds bounded output limit');
  const result = JSON.parse(await readFile(resultPath, 'utf8'));
  try { assertResultBudgets(result); }
  catch (error) { return failure(error.code || 'SERVICE_UNAVAILABLE', error.message); }
  return result;
}

/** @param {import('../../../packages/runtime-contracts/src/index.ts').CompileRequest} request
 * @param {{dependencyRoot?: string, timeoutMs?: number}} options
 * @returns {Promise<import('../../../packages/runtime-contracts/src/index.ts').CompileResult>} */
export async function compileVisual(request, options = {}) {
  let source;
  try {
    if (!request || Object.keys(request).some(key => key !== 'source')) throw Error('CompileRequest contains unsupported fields');
    source = validateSource(request.source);
  } catch (error) { return failure(error.code || 'SOURCE_BOUNDARY_VIOLATION', error.message); }
  const timeoutMs = options.timeoutMs ?? limits.compileMs;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > limits.compileMs) return failure('QUOTA_EXCEEDED', 'Compile deadline must be 1–30000 ms');
  if (process.platform !== 'win32') return failure('SERVICE_UNAVAILABLE', 'Compiler requires the Windows Job Object supervisor');
  const directory = await mkdtemp(join(tmpdir(), 'lux-compile-'));
  let cleanupConfirmed = false, keepEvidence = false;
  try {
    const input = join(directory, 'input.json');
    await writeFile(input, JSON.stringify({ source, dependencyRoot: resolve(options.dependencyRoot || join(root, 'node_modules')) }));
    const config = join(directory, 'config.json');
    await writeFile(config, JSON.stringify({ executable: process.execPath,
      commandLine: [process.execPath, '--max-old-space-size=256', join(here, 'worker.mjs'), input].map(quote).join(' '),
      cwd: directory, directory, timeoutMs, memoryLimitBytes: 1073741824 }));
    await new Promise((done, reject) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts/experiment-job.ps1'), '-Config', config], {
        windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, PATH: process.env.PATH },
      });
      let bytes = 0;
      child.stderr.on('data', data => { bytes += data.length; if (bytes > limits.diagnosticBytes) child.kill(); });
      const timer = setTimeout(() => { child.kill(); reject(Error('Compiler supervisor deadline exceeded; cleanup unconfirmed')); }, timeoutMs + 15000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('close', code => { clearTimeout(timer); code === 0 ? done() : reject(Error(`Compiler supervisor failed (${code}); cleanup unconfirmed`)); });
    });
    const job = JSON.parse(await readFile(join(directory, 'result.json'), 'utf8'));
    cleanupConfirmed = job.cleanupComplete === true;
    if (!cleanupConfirmed) return failure('SERVICE_UNAVAILABLE', 'Compiler cleanup could not be confirmed');
    if (job.timeout) return failure('TIMEOUT', 'Compiler initialization or compilation exceeded its process deadline');
    return await readCompileResult(join(directory, 'compile-result.json'));
  } catch (error) { keepEvidence = true; return failure('SERVICE_UNAVAILABLE', `${error.message}; retained evidence: ${directory}`); }
  finally {
    // The randomly allocated exact directory is owned by this invocation. Keep
    // all evidence after uncertain process cleanup; never remove a live job root.
    if (cleanupConfirmed && !keepEvidence) await rm(directory, { recursive: true, force: true });
  }
}
