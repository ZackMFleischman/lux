import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { limits, validateSource } from './source-policy.mjs';
import { assertResultBudgets } from './result-budget.mjs';
import { createHash } from 'node:crypto';
import { verifyArtifact } from './artifact-identity.mjs';
import { readBoundedJson, boundedJson } from './bounded-json.mjs';
import { deriveAssets } from '../../../packages/assets/src/index.mjs';
import { sourceArtifactVersion } from './sdk-selection.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const failure = (code, message) => ({ ok: false, code, diagnostics: [{ code, message }] });
const quote = value => '"' + value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1') + '"';

export async function readCompileResult(resultPath, expectedSource) {
  try {
    const result = await readBoundedJson(resultPath,limits.outputBytes + limits.diagnosticBytes);
    assertResultBudgets(result);
    if(result.ok===true) {
      result.artifact=await verifyArtifact(result.artifact,hash);
      if(expectedSource && (result.artifact.sourceHash!==hash(JSON.stringify(expectedSource)) || result.artifact.sdkVersion!==expectedSource.sdkVersion || (result.artifact.artifactVersion??1)!==sourceArtifactVersion(expectedSource))) throw Error('Compiler source/version identity mismatch');
      if(expectedSource && (expectedSource.sourceVersion===2 || expectedSource.sdkVersion==='0.2.0') && result.artifact.assetSetHash!==(await deriveAssets(expectedSource.assets??{},hash)).assetSetHash) throw Error('Compiler source asset identity mismatch');
    }
    return result;
  } catch(error) {return failure(error.code || 'SERVICE_UNAVAILABLE',error.message);}
}

/** @param {import('../../../packages/runtime-contracts/src/index.ts').CompileRequest} request
 * @param {{dependencyRoot?: string, timeoutMs?: number}} options
 * @returns {Promise<import('../../../packages/runtime-contracts/src/index.ts').CompileResult>} */
export async function compileVisual(request, options = {}) {
  let source;
  try {
    if (!request || Object.keys(request).some(key => key !== 'source')) throw Error('CompileRequest contains unsupported fields');
    source = validateSource(request.source);
    boundedJson({source},limits.requestBytes);
  } catch (error) { return failure(error.code || 'SOURCE_BOUNDARY_VIOLATION', error.message); }
  const timeoutMs = options.timeoutMs ?? limits.compileMs;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > limits.compileMs) return failure('QUOTA_EXCEEDED', 'Compile deadline must be 1–30000 ms');
  if (process.platform !== 'win32') return failure('SERVICE_UNAVAILABLE', 'Compiler requires the Windows Job Object supervisor');
  const directory = await mkdtemp(join(tmpdir(), 'lux-compile-'));
  let cleanupConfirmed = false, keepEvidence = false;
  try {
    const input = join(directory, 'input.json');
    await writeFile(input, boundedJson({ source, dependencyRoot: resolve(options.dependencyRoot || join(root, 'node_modules')) },limits.requestBytes));
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
    const job = await readBoundedJson(join(directory, 'result.json'),limits.diagnosticBytes);
    cleanupConfirmed = job.cleanupComplete === true;
    if (!cleanupConfirmed) return failure('SERVICE_UNAVAILABLE', 'Compiler cleanup could not be confirmed');
    if (job.timeout) return failure('TIMEOUT', 'Compiler initialization or compilation exceeded its process deadline');
    return await readCompileResult(join(directory, 'compile-result.json'),source);
  } catch (error) { keepEvidence = true; return failure('SERVICE_UNAVAILABLE', `${error.message}; retained evidence: ${directory}`); }
  finally {
    // The randomly allocated exact directory is owned by this invocation. Keep
    // all evidence after uncertain process cleanup; never remove a live job root.
    if (cleanupConfirmed && !keepEvidence) await rm(directory, { recursive: true, force: true });
  }
}
