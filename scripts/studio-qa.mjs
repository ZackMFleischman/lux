import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
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
    return { commit, trackedDiffSha256: hash(diff) };
  } catch { return { commit: null, trackedDiffSha256: null }; }
};

/** Creates one auditable, isolated attempt. Failed attempts are intentionally retained. */
export async function createStudioQaAttempt({ root, expectedWorkspace = root, label, dependencyCheck = true, evidenceRoot = join(root, 'artifacts', 'problem-easy-wins', 'studio-qa') }) {
  const sourceRoot = resolve(root);
  const workspace = canonicalWorkspace(sourceRoot);
  if (workspace !== canonicalWorkspace(expectedWorkspace)) throw Error('Studio QA checkout mismatch');
  const env = { ...studioTestEnvironment(), LUX_NODE_EXECUTABLE: process.execPath };
  const session = resolveStudioSession({ workspace, env });
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.LUX_STUDIO_SMOKE;
  const directory = join(evidenceRoot, `${label}-${Date.now()}-${randomUUID()}`);
  await mkdir(directory, { recursive: true });
  const manifest = { ok: false, label, workspace, profile: session.profile, sessionDirectory: session.directory,
    source: sourceState(sourceRoot), resolution: null, cleanup: { ownedPid: null, attempted: false, completed: false }, error: null };
  const persist = () => writeFile(join(directory, 'attempt.json'), JSON.stringify(manifest, null, 2));
  if (dependencyCheck) {
    manifest.resolution = resolve(installedElectron(sourceRoot));
    const dependencyRelative = relative(sourceRoot, manifest.resolution);
    if (isAbsolute(dependencyRelative) || dependencyRelative === '..' || dependencyRelative.startsWith(`..${sep}`)) {
      manifest.error = 'Studio QA requires dependencies local to the selected checkout';
      await persist();
      throw Error(manifest.error);
    }
  }
  await persist();
  let app;
  return {
    directory, env, session, manifest,
    async launch({ viewport, timeoutMs = 30000, ready = page => page.getByRole('button', { name: 'Build', exact: true }).waitFor() } = {}) {
      const executablePath = manifest.resolution ?? resolve(installedElectron(workspace));
      app = await _electron.launch({ executablePath, args: [join(workspace, 'apps/studio/dist/main.cjs')], cwd: workspace, env, timeout: timeoutMs, chromiumSandbox: true });
      const page = await app.firstWindow();
      manifest.cleanup.ownedPid = await app.evaluate(() => process.pid);
      if (viewport) await page.setViewportSize(viewport);
      await page.waitForFunction(() => document.readyState === 'complete', undefined, { timeout: timeoutMs });
      await ready(page);
      await persist();
      return { app, page };
    },
    async finish({ ok = false, error = null } = {}) {
      manifest.ok = ok; manifest.error = error;
      if (app) {
        manifest.cleanup.attempted = true;
        await app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => {});
        await app.close().catch(() => {});
        manifest.cleanup.completed = true;
      }
      await persist();
    },
  };
}
