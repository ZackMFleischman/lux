import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, realpath, readdir, lstat, rmdir } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalWorkspace, createStudioConnection, resolveStudioSession, studioAppData } from './studio-session.mjs';
import { installedElectron } from './studio-electron.mjs';

function git(root, args) {
  return execFileSync('git', ['-c', 'core.excludesFile=', '-c', 'core.fsmonitor=false', '-c', `safe.directory=${root.replaceAll('\\', '/')}`, ...args],
    { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function locked(directory, name, operation) {
  await mkdir(directory, { recursive: true });
  const lock = join(directory, name);
  try { await mkdir(lock); }
  catch (error) { if (error.code === 'EEXIST') throw Error(`Creative startup is already reserved (${lock}). Inspect the owning launcher before removing a stale lock.`); throw error; }
  try { return await operation(); }
  finally { await rmdir(lock); }
}

/** Pin once. Never reset, clean, switch or rebuild an existing creative checkout. */
export async function prepareCreativeCheckout({ source, appData = studioAppData() }) {
  source = canonicalWorkspace(source);
  const common = git(source, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const checkout = resolve(dirname(common), '.worktrees', 'lux-creative');
  const directory = join(appData, 'Lux', 'Studio', 'profiles', 'creative');
  return locked(directory, 'prepare.lock', async () => {
    const recordPath = join(directory, 'checkout.json');
    let record = await readJson(recordPath);
    if (!record) {
      try { await lstat(checkout); throw Error(`Unregistered creative checkout exists at ${checkout}; inspect it before adopting or moving it.`); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      const commit = git(source, ['rev-parse', 'HEAD']);
      git(source, ['worktree', 'add', '--detach', checkout, commit]);
      git(source, ['worktree', 'lock', '--reason', 'Reserved user creative Studio; upgrades require explicit user request', checkout]);
      record = { version: 1, checkout: canonicalWorkspace(checkout), commit };
      await writeFile(recordPath, JSON.stringify(record, null, 2), { flag: 'wx' });
    }
    if (record.version !== 1 || !/^[0-9a-f]{40}$/.test(record.commit) ||
        record.checkout !== canonicalWorkspace(checkout)) throw Error('Creative checkout reservation does not match this repository');
    if (git(record.checkout, ['rev-parse', 'HEAD']) !== record.commit) throw Error('Creative checkout commit changed; an explicit upgrade is required');
    if (git(record.checkout, ['status', '--porcelain', '--untracked-files=no'])) throw Error('Creative checkout has modified source; preserve it and investigate before launch');
    return record;
  });
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
    if (!contains(canonicalWorkspace(checkout), canonicalWorkspace(physicalModules))) throw Error('Creative dependencies must be local to the pinned checkout');
    for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      const location = await realpath(join(modules, name));
      if (!contains(physicalModules, location)) throw Error(`Creative dependency ${name} resolves outside its own node_modules`);
      const installed = JSON.parse(await readFile(join(location, 'package.json'), 'utf8'));
      if (installed.name !== name || installed.version !== version) throw Error(`Creative dependency version mismatch: ${name}`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') throw Error(`Creative dependencies are not installed in ${modules}. Prepare the pinned dependencies there; do not link the development node_modules.`);
    throw error;
  }
}

async function buildInventory(directory) {
  const hashes = {};
  async function visit(path, prefix = '') {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const key = prefix + entry.name, full = join(path, entry.name);
      if (entry.isSymbolicLink()) throw Error('Creative build must not contain linked files');
      if (entry.isDirectory()) await visit(full, `${key}/`);
      else if (entry.isFile()) hashes[key] = createHash('sha256').update(await readFile(full)).digest('hex');
    }
  }
  await visit(directory);
  if (!hashes['main.cjs']) throw Error('Creative Studio build is incomplete');
  return Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)));
}

async function start(source, prepareOnly) {
  const appData = studioAppData(), directory = join(appData, 'Lux', 'Studio', 'profiles', 'creative');
  return locked(directory, 'launch.lock', async () => {
    const record = await prepareCreativeCheckout({ source, appData });
    const env = { ...process.env, LUX_STUDIO_PROFILE: 'creative', LUX_NODE_EXECUTABLE: process.execPath };
    delete env.LUX_STUDIO_MCP_TEST; delete env.LUX_STUDIO_SMOKE; delete env.ELECTRON_RUN_AS_NODE; delete env.LUX_STUDIO_SESSION_ID;
    const session = resolveStudioSession({ workspace: record.checkout, appData, env });
    const info = { ...record, profile: 'creative', adapter: join(record.checkout, 'scripts', 'studio-mcp.mjs') };
    if (prepareOnly) return { ...info, prepared: true };
    try { await createStudioConnection(session, { timeoutMs: 5000 })('status'); return { ...info, running: true, reused: true }; }
    catch (error) {
      const endpoint = await readJson(session.endpointPath);
      if (Number.isSafeInteger(endpoint?.pid) && endpoint.pid > 0) {
        let alive = true;
        try { process.kill(endpoint.pid, 0); } catch (probe) { if (probe.code === 'ESRCH') alive = false; }
        if (alive) throw Error(`Creative Studio already has a live process but could not connect: ${error.message}`);
      }
    }
    await verifyCreativeDependencies(record.checkout);
    // Resolve without loading electron/index.js, which can download a missing binary.
    installedElectron(record.checkout);
    const buildRecordPath = join(directory, 'build.json'), dist = join(record.checkout, 'apps', 'studio', 'dist');
    const built = await readJson(buildRecordPath);
    if (built) {
      if (built.commit !== record.commit || JSON.stringify(built.files) !== JSON.stringify(await buildInventory(dist))) {
        throw Error('Creative build changed; do not rebuild a reserved version without an explicit upgrade');
      }
    } else {
      execFileSync(process.execPath, [join(record.checkout, 'apps/studio/build.mjs')], { cwd: record.checkout, env, windowsHide: true, stdio: 'inherit' });
      await writeFile(buildRecordPath, JSON.stringify({ commit: record.commit, files: await buildInventory(dist) }), { flag: 'wx' });
    }
    const log = join(directory, 'startup.log');
    const { openSync, closeSync } = await import('node:fs');
    const fd = openSync(log, 'a');
    try {
      const child = spawn(process.execPath, [join(record.checkout, 'scripts/studio.mjs')], {
        cwd: record.checkout, env, detached: true, windowsHide: true, stdio: ['ignore', fd, fd] });
      await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
      child.unref();
      return { ...info, launched: true, launcherPid: child.pid, log, advice: 'Verify MCP live status before declaring readiness.' };
    } finally { closeSync(fd); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--prepare')) { console.error('Usage: node scripts/studio-creative.mjs [--prepare]'); process.exitCode = 1; }
  else start(resolve(import.meta.dirname, '..'), args.includes('--prepare'))
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
