import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright';
import { installedElectron } from './studio-electron.mjs';
import { canonicalWorkspace, resolveStudioSession, studioTestEnvironment } from './studio-session.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const sourceState = root => {
  try {
    const options = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
    const gitRoot = root.replaceAll('\\', '/');
    const base = ['-c', 'core.excludesFile=', '-c', `safe.directory=${gitRoot}`, '-C', gitRoot];
    const commit = execFileSync('git', [...base, 'rev-parse', 'HEAD'], options).trim();
    const diff = execFileSync('git', [...base, 'diff', '--binary', commit], options);
    const status = execFileSync('git', [...base, 'status', '--porcelain=v1', '--untracked-files=all'], options);
    return { commit, trackedDiffSha256: hash(diff), worktreeStatusSha256: hash(status) };
  } catch { return { commit: null, trackedDiffSha256: null, worktreeStatusSha256: null }; }
};

/** Creates one auditable, isolated attempt. Failed attempts are intentionally retained. */
export async function createStudioQaAttempt({ root, expectedWorkspace = root, label, dependencyCheck = true, evidenceRoot = join(root, 'artifacts', 'problem-easy-wins', 'studio-qa') }) {
  const sourceRoot = resolve(root);
  const workspace = canonicalWorkspace(sourceRoot);
  if (workspace !== canonicalWorkspace(expectedWorkspace)) throw Error('Studio QA checkout mismatch');
  const directory = join(evidenceRoot, `${label}-${Date.now()}-${randomUUID()}`);
  await mkdir(directory, { recursive: true });
  const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath };
  const session = resolveStudioSession({ workspace, env });
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.LUX_STUDIO_SMOKE;
  const manifest = { ok: false, label, workspace, profile: session.profile, sessionDirectory: session.directory,
    source: sourceState(sourceRoot), resolution: null, viewport: null, cleanup: { ownedPid: null, attempted: false, completed: false }, error: null };
  const persist = () => writeFile(join(directory, 'attempt.json'), JSON.stringify(manifest, null, 2));
  if (dependencyCheck) {
    try {
      await access(join(sourceRoot, 'apps/studio/dist/main.cjs'));
      manifest.resolution = { executablePath: resolve(installedElectron(sourceRoot)), entryPath: join(sourceRoot, 'apps/studio/dist/main.cjs') };
    } catch (error) { manifest.error = String(error.message ?? error); }
  }
  await persist();
  if (manifest.error) throw Error(manifest.error);
  let app;
  return {
    directory, env, session, manifest,
    async launch({ viewport, timeoutMs = 30000, ready = page => page.waitForFunction(() => {
      const build = [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Build');
      const canvas = document.querySelector('.preview-surface canvas')?.getBoundingClientRect();
      return !!build && !build.disabled && !!canvas && canvas.width > 0 && canvas.height > 0;
    }, undefined, { timeout: timeoutMs }) } = {}) {
      const executablePath = manifest.resolution?.executablePath ?? resolve(installedElectron(workspace));
      app = await _electron.launch({ executablePath, args: [join(workspace, 'apps/studio/dist/main.cjs')], cwd: workspace, env, timeout: timeoutMs, chromiumSandbox: true });
      const page = await app.firstWindow();
      manifest.cleanup.ownedPid = await app.evaluate(() => process.pid);
      await persist();
      if (viewport) {
        await page.setViewportSize(viewport);
        await page.waitForFunction(({ width, height }) => window.innerWidth === width && window.innerHeight === height, viewport, { timeout: timeoutMs });
        manifest.viewport = { requested: viewport, actual: await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })) };
      }
      await page.waitForFunction(() => document.readyState === 'complete', undefined, { timeout: timeoutMs });
      await ready(page);
      await persist();
      return { app, page };
    },
    async finish({ ok = false, error = null } = {}) {
      manifest.ok = ok; manifest.error = error;
      if (app) {
        manifest.cleanup.attempted = true;
        const child = app.process();
        let closeError = null;
        await app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(error => { closeError = String(error); });
        await app.close().catch(error => { closeError ??= String(error); });
        if (manifest.cleanup.ownedPid === null) manifest.cleanup.error ??= 'Studio process PID was unavailable';
        else try {
          const deadline = Date.now() + 5000;
          while (Date.now() < deadline) {
            try { process.kill(manifest.cleanup.ownedPid, 0); await new Promise(resolve => setTimeout(resolve, 50)); }
            catch (error) { if (error.code === 'ESRCH') break; throw error; }
          }
          try { process.kill(manifest.cleanup.ownedPid, 0); manifest.cleanup.completed = false; }
          catch (error) { manifest.cleanup.completed = error.code === 'ESRCH'; }
        } catch (error) { manifest.cleanup.error = String(error.stack ?? error); manifest.cleanup.completed = false; }
        if (!manifest.cleanup.completed) manifest.ok = false;
        if (closeError) manifest.cleanup.error = closeError;
      }
      await persist();
    },
  };
}
