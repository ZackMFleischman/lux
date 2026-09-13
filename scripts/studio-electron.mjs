import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, rmdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

function electronPackage(workspace) {
  const pkg = JSON.parse(readFileSync(join(workspace, 'package.json'), 'utf8'));
  const version = pkg.devDependencies?.electron ?? pkg.dependencies?.electron;
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version ?? '')) throw Error('Electron requires an exact package version pin');
  let root;
  try { root = dirname(createRequire(join(workspace, 'package.json')).resolve('electron')); }
  catch { throw Error('Electron package is not installed. Run pnpm install --frozen-lockfile in this checkout.'); }
  const installed = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (installed.name !== 'electron' || installed.version !== version) {
    throw Error(`Electron package version does not match pin ${version}. Run pnpm install --frozen-lockfile in this checkout.`);
  }
  return { root, version };
}

function missing(message) {
  return Object.assign(Error(`${message}. Run pnpm studio:setup in this checkout.`), { code: 'LUX_ELECTRON_MISSING' });
}

function executablePath({ root, version }) {
  let name, actual;
  try {
    name = readFileSync(join(root, 'path.txt'), 'utf8').trim();
    actual = readFileSync(join(root, 'dist', 'version'), 'utf8').trim().replace(/^v/, '');
  } catch (error) {
    if (error.code === 'ENOENT') throw missing('Pinned Electron binary is not installed');
    throw error;
  }
  const dist = join(root, 'dist'), executable = join(dist, name), rel = relative(dist, executable);
  if (!name || isAbsolute(name) || rel === '..' || rel.startsWith(`..${sep}`)) throw Error('Installed Electron path is invalid');
  if (actual !== version) throw missing(`Installed Electron runtime version ${actual} does not match ${version}`);
  try { if (!statSync(executable).isFile()) throw missing('Pinned Electron executable is not installed'); }
  catch (error) { if (error.code === 'ENOENT') throw missing('Pinned Electron executable is not installed'); throw error; }
  return executable;
}

// Resolving the entry is inert; requiring modern Electron can download binaries.
export function installedElectron(workspace) {
  return executablePath(electronPackage(workspace));
}

/** Launch/setup only. Uses the pinned package's official checksum-verifying installer. */
export function ensureElectron(workspace) {
  const pkg = electronPackage(workspace);
  try { return executablePath(pkg); }
  catch (error) { if (error.code !== 'LUX_ELECTRON_MISSING') throw error; }
  // Never repair a parent checkout or a shared/junctioned dependency tree.
  const rel = relative(realpathSync(workspace), realpathSync(pkg.root));
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) {
    throw Error('Electron setup requires dependencies local to this checkout. Run pnpm install --frozen-lockfile here.');
  }
  const lock = join(pkg.root, '.lux-install.lock');
  try { mkdirSync(lock); }
  catch (error) {
    if (error.code === 'EEXIST') throw Error(`Electron setup is already in progress (${lock}). If interrupted, inspect the owning process before removing its stale lock.`);
    throw error;
  }
  try {
    // Another setup may have completed between the initial check and the lock.
    try { return executablePath(pkg); }
    catch (error) { if (error.code !== 'LUX_ELECTRON_MISSING') throw error; }
    const env = { ...process.env };
    // Runtime setup is for this host and the official pinned distribution.
    // Keep Electron's standard shared cache (or electron_config_cache) and proxy settings.
    for (const key of Object.keys(env)) {
      // @electron/get accepts direct, npm config, and package config aliases,
      // including both camelCase and snake_case spellings.
      const normalized = key.toLowerCase().replaceAll('_', '');
      if (/^(?:(?:npmconfig|npmpackageconfig)?electron(?:mirror|nightlymirror|customdir|customfilename|customversion|overridedistpath|installplatform|installarch|useremotechecksums)|npmconfig(?:platform|arch))$/.test(normalized)) delete env[key];
    }
    console.error(`Preparing Electron ${pkg.version} for ${process.platform}-${process.arch} (shared download cache)...`);
    try { execFileSync(process.execPath, [join(pkg.root, 'install.js')], { cwd: workspace, env, stdio: 'inherit', windowsHide: true }); }
    catch (error) { throw Error('Electron setup failed. Check the installer output and rerun pnpm studio:setup.', { cause: error }); }
    return executablePath(pkg);
  } finally { rmdirSync(lock); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.some(arg => arg !== '--check')) throw Error('Usage: node scripts/studio-electron.mjs [--check]');
    console.log((args.includes('--check') ? installedElectron : ensureElectron)(resolve(import.meta.dirname, '..')));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
