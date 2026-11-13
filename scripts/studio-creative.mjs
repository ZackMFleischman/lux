import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, realpath, rmdir, unlink } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { canonicalWorkspace, createStudioConnection, openSceneInStudio, resolveSceneArgument, resolveStudioSession, studioAppData } from './studio-session.mjs';
import { ensureElectron } from './studio-electron.mjs';

function git(root, args) {
  return execFileSync('git', ['-c', 'core.excludesFile=', '-c', 'core.fsmonitor=false', '-c', `safe.directory=${root.replaceAll('\\', '/')}`, ...args],
    { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function processAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== 'ESRCH'; }
}
async function locked(directory, name, operation) {
  await mkdir(directory, { recursive: true });
  const lock = join(directory, name);
  try { await mkdir(lock); }
  catch (error) { if (error.code === 'EEXIST') throw Error(`Creative startup is already in progress (${lock}). Inspect the owning launcher before removing a stale lock.`); throw error; }
  try { return await operation(); }
  finally { await rmdir(lock); }
}

/** Select the caller's checkout. No Git mutation or persistent version reservation. */
export async function prepareCreativeCheckout({ source }) {
  const checkout = canonicalWorkspace(source);
  return { checkout, commit: git(checkout, ['rev-parse', 'HEAD']),
    branch: git(checkout, ['branch', '--show-current']) || null };
}

export function creativeEnvironment(source, parent = process.env) {
  const workspace = canonicalWorkspace(source);
  const env = { ...parent, LUX_STUDIO_PROFILE: 'creative-' + createHash('sha256').update(workspace).digest('hex').slice(0, 24),
    LUX_NODE_EXECUTABLE: process.execPath, LUX_WORKSPACE: workspace };
  for (const key of ['LUX_STUDIO_MCP_TEST', 'LUX_STUDIO_SMOKE', 'ELECTRON_RUN_AS_NODE', 'LUX_STUDIO_SESSION_ID', 'LUX_STUDIO_DIST']) delete env[key];
  return env;
}

function contains(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}
/** Do not fall back to the development checkout's mutable node_modules. */
export async function verifyCreativeDependencies(checkout) {
  const pkg = JSON.parse(await readFile(join(checkout, 'package.json'), 'utf8'));
  if (pkg.engines?.node !== process.versions.node) throw Error(`Creative Studio requires Node ${pkg.engines?.node}`);
  const modules = join(checkout, 'node_modules');
  try {
    const physicalModules = await realpath(modules);
    if (!contains(canonicalWorkspace(checkout), canonicalWorkspace(physicalModules))) throw Error('Creative dependencies must be local to the selected checkout');
    for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      const location = await realpath(join(modules, name));
      if (!contains(physicalModules, location)) throw Error(`Creative dependency ${name} resolves outside its own node_modules`);
      const installed = JSON.parse(await readFile(join(location, 'package.json'), 'utf8'));
      if (installed.name !== name || installed.version !== version) throw Error(`Creative dependency version mismatch: ${name}`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') throw Error(`Creative dependencies are not installed in ${modules}. Prepare the checkout dependencies there; do not link the development node_modules.`);
    throw error;
  }
}


export async function startCreativeStudio({ source, prepareOnly = false, scene, env = creativeEnvironment(source), appData = studioAppData(env) }) {
  const session = resolveStudioSession({ workspace: source, appData, env });
  const scenePath = scene === undefined ? undefined : await resolveSceneArgument(scene);
  const result = await launchCreativeStudio({ source, prepareOnly, session, appData, env });
  if (!scenePath || prepareOnly) return result;
  const connect = createStudioConnection({ ...session, expectedSessionId: result.studioSession.sessionId });
  return { ...result, openedScene: await openSceneInStudio(connect, scenePath) };
}

async function launchCreativeStudio({ source, prepareOnly, session, appData, env }) {
  const directory = session.directory;
  return locked(directory, 'launch.lock', async () => {
    const pendingPath = join(directory, 'launch.json');
    const record = await prepareCreativeCheckout({ source, appData });
    const info = { ...record, profile: session.profile, adapter: join(record.checkout, 'scripts', 'studio-mcp.mjs'),
      mcp: { command: process.execPath, args: [join(record.checkout, 'scripts', 'studio-mcp.mjs')], cwd: record.checkout,
        env: { LUX_STUDIO_PROFILE: session.profile } } };
    if (prepareOnly) return { ...info, prepared: true };
    try {
      const status = await createStudioConnection(session, { timeoutMs: 5000 })('status');
      info.mcp.env.LUX_STUDIO_SESSION_ID = status.studioSession.sessionId;
      return { ...info, running: true, reused: true, studioSession: status.studioSession,
        advice: 'Reused the existing app build; checkout commit describes current source, not the running build.' };
    }
    catch (error) {
      const endpoint = await readJson(session.endpointPath);
      if (processAlive(endpoint?.pid)) throw Error(`Creative Studio already has a live process but could not connect: ${error.message}`);
      const pending = await readJson(pendingPath);
      if (processAlive(pending?.launcherPid)) throw Error(`Studio launch is still running. Inspect ${join(directory, 'startup.log')} before retrying.`);
    }
    await verifyCreativeDependencies(record.checkout);
    ensureElectron(record.checkout);
    // Rebuild only after both app and pending launcher are gone. Keep disk use bounded.
    env.LUX_STUDIO_DIST = join(directory, 'build');
    execFileSync(process.execPath, [join(record.checkout, 'apps/studio/build.mjs')], { cwd: record.checkout, env, windowsHide: true, stdio: 'inherit' });
    const log = join(directory, 'startup.log');
    const { openSync, closeSync } = await import('node:fs');
    const fd = openSync(log, 'a');
    try {
      const child = spawn(process.execPath, [join(record.checkout, 'scripts/studio.mjs')], {
        cwd: record.checkout, env, detached: true, windowsHide: true, stdio: ['ignore', fd, fd] });
      await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
      child.unref();
      await writeFile(pendingPath, JSON.stringify({ launcherPid: child.pid, build: env.LUX_STUDIO_DIST }));
      // Hold the launch lock until the endpoint is ready, so a second start cannot rebuild or spawn a duplicate.
      const connect = createStudioConnection(session, { timeoutMs: 2000 });
      const deadline = Date.now() + 60000;
      let lastError;
      while (Date.now() < deadline) {
        try {
          const status = await connect('status');
          info.mcp.env.LUX_STUDIO_SESSION_ID = status.studioSession.sessionId;
          await unlink(pendingPath);
          return { ...info, running: true, launched: true, studioSession: status.studioSession,
            launcherPid: child.pid, build: env.LUX_STUDIO_DIST, log };
        } catch (error) { lastError = error; }
        await setTimeout(250);
      }
      throw Error(`Studio did not become ready within 60 seconds. Inspect ${log} before retrying: ${lastError?.message}`);
    } finally { closeSync(fd); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const openAt = args.indexOf('--open');
  const scene = openAt >= 0 ? args[openAt + 1] : undefined;
  const rest = openAt >= 0 ? args.filter((_, i) => i !== openAt && i !== openAt + 1) : args;
  if ((openAt >= 0 && !scene) || rest.some(arg => arg !== '--prepare')) { console.error('Usage: node scripts/studio-creative.mjs [--prepare] [--open <scene.lux-scene>]'); process.exitCode = 1; }
  else startCreativeStudio({ source: resolve(import.meta.dirname, '..'), prepareOnly: rest.includes('--prepare'), scene })
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
