import { spawn } from 'node:child_process';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { StudioExportRequest, StudioExportResult } from './export-client.ts';
export const exportLimits = Object.freeze({ requestBytes: 8388608, responseBytes: 65536, timeoutMs: 180000 });
type ChildRequest = StudioExportRequest & { outputDirectory: string };
function encode(value: unknown) {
  const json = JSON.stringify(value);
  if (!json || Buffer.byteLength(json) > exportLimits.requestBytes) throw Error('Export request exceeds 8 MiB');
  return json;
}
function admit(value: unknown): StudioExportRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid export request');
  const request = value as Record<string, unknown>;
  if (Object.keys(request).some(key => key !== 'name' && key !== 'document')) throw Error('Unsupported export request field');
  if (typeof request.name !== 'string' || !request.name.trim() || request.name.length > 80 || /[\x00-\x1f]/.test(request.name)) throw Error('Source name must contain 1–80 characters without control characters');
  if (!request.document || typeof request.document !== 'object') throw Error('Export requires a scene document');
  // The child validates the full document through SceneFileStore before compiling.
  return JSON.parse(encode({ name: request.name.trim(), document: request.document })) as StudioExportRequest;
}
export function createExportService(ports: {
  chooseDirectory(): Promise<string | null>;
  run(request: ChildRequest): Promise<StudioExportResult>;
}) {
  let busy = false;
  return { async create(value: unknown): Promise<StudioExportResult | null> {
    if (busy) throw Error('Another export is already in progress');
    const request = admit(value); busy = true;
    try { const outputDirectory = await ports.chooseDirectory(); if (!outputDirectory) return null;
      return await ports.run({ ...request, outputDirectory });
    } finally { busy = false; }
  } };
}
/** Runs packaging outside Electron's main process. No shell or user-selected executable is involved. */
export async function runExportChild(request: ChildRequest, options: {
  workspace: string; executable: string; script?: string; timeoutMs?: number; signal?: AbortSignal;
}): Promise<StudioExportResult> {
  const encoded = encode(request);
  if (options.signal?.aborted) throw Error('Export cancelled because Studio is closing');
  return new Promise((done, reject) => {
    const child = spawn(options.executable, [options.script ?? join(options.workspace, 'scripts/studio-export.mjs')],
      { cwd: options.workspace, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let settled = false, failure: Error | null = null, bytes = 0, stderrBytes = 0;
    const chunks: Buffer[] = [], stderr: Buffer[] = [];
    let killDeadline: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: Error, result?: StudioExportResult) => {
      if (settled) return; settled = true; clearTimeout(timer); clearTimeout(killDeadline);
      options.signal?.removeEventListener('abort', aborted);
      error ? reject(error) : done(result!);
    };
    const stop = (reason: Error) => {
      if (settled || failure) return; failure = reason;
      // Kill the compiler descendants too, rather than orphaning a child on Windows.
      if (process.platform === 'win32' && child.pid) {
        const killer = spawn(join(process.env.SystemRoot ?? 'C:/Windows', 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.once('error', () => { child.kill(); });
        killer.once('close', code => { if (code !== 0) child.kill(); });
      } else child.kill();
      killDeadline = setTimeout(() => { child.kill(); finish(reason); }, 3000);
    };
    const aborted = () => stop(Error('Export cancelled because Studio is closing'));
    const timer = setTimeout(() => stop(Error('Export packaging deadline exceeded')), options.timeoutMs ?? exportLimits.timeoutMs);
    options.signal?.addEventListener('abort', aborted, { once: true });
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length; if (bytes > exportLimits.responseBytes) stop(Error('Export result exceeded its limit')); else chunks.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderrBytes += chunk.length; if (stderrBytes > exportLimits.responseBytes) stop(Error('Export diagnostic output exceeded its limit')); else stderr.push(chunk);
    });
    child.once('error', error => finish(error));
    child.once('close', code => {
      if (failure) { finish(failure); return; }
      try {
        let response;
        try { response = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { throw Error(code === 0 ? 'Invalid export result' : `Export process failed${stderrBytes ? ': ' + Buffer.concat(stderr).toString('utf8').slice(0, 2000) : ''}`); }
        if (!response.ok || code !== 0) throw Error(typeof response.error === 'string' ? response.error.slice(0, 4000) : 'Export process failed');
        const result = response.result;
        if (!result || typeof result.path !== 'string' || !isAbsolute(result.path) || !/^[a-f0-9]{64}$/.test(result.releaseId) || !/^[a-f0-9]{64}$/.test(result.runtimeId)) throw Error('Invalid export result');
        const inside = relative(resolve(request.outputDirectory), resolve(result.path));
        if (!inside || isAbsolute(inside) || inside === '..' || inside.startsWith('..' + sep)) throw Error('Export result is outside the selected directory');
        finish(undefined, { path: result.path, releaseId: result.releaseId, runtimeId: result.runtimeId });
      } catch (error) { finish(error instanceof Error ? error : Error(String(error))); }
    });
    child.stdin.on('error', () => {}); child.stdin.end(encoded);
  });
}
