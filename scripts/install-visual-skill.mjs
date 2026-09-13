import { lstat, readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillNames = ['lux-visual-creation', 'start-lux'];

async function inspect(path) {
  try { return await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// Check ancestors as well as tree entries: a normal-looking destination can
// otherwise write through a symlink/junction in its parent path.
async function rejectLinkedPath(path) {
  for (let cursor = resolve(path); ; cursor = dirname(cursor)) {
    if ((await inspect(cursor))?.isSymbolicLink()) throw Error(`Linked path is not supported: ${cursor}`);
    if (dirname(cursor) === cursor) return;
  }
}

async function inventory(root) {
  await rejectLinkedPath(root);
  const entries = new Map(), rootInfo = await inspect(root);
  if (!rootInfo) return entries;
  if (!rootInfo.isDirectory()) throw Error(`Expected a directory: ${root}`);
  async function visit(directory, prefix = '') {
    for (const name of (await readdir(directory)).sort()) {
      const path = join(directory, name), key = prefix + name, info = await lstat(path);
      if (info.isSymbolicLink()) throw Error(`Linked path is not supported: ${path}`);
      if (info.isDirectory()) {
        entries.set(key, { directory: true });
        await visit(path, `${key}/`);
      } else if (info.isFile()) {
        if (info.nlink > 1) throw Error(`Hard linked file is not supported: ${path}`);
        entries.set(key, { bytes: await readFile(path) });
      } else throw Error(`Unsupported file type: ${path}`);
    }
  }
  await visit(root);
  return entries;
}

function contains(parent, child) {
  const path = relative(parent, child);
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

/** Destination is the skill directory itself, not the parent skills folder.
 * Extras are deliberately never deleted: review/move them before reinstalling.
 */
export async function installVisualSkill({ skill = 'lux-visual-creation',
  source = fileURLToPath(new URL(`../skills/${skill}`, import.meta.url)),
  destination = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'skills', skill), check = false } = {}) {
  if (!skillNames.includes(skill)) throw Error('Unknown Lux skill');
  source = resolve(source); destination = resolve(destination);
  await rejectLinkedPath(source); await rejectLinkedPath(destination);
  if (contains(source, destination) || contains(destination, source)) throw Error('Source and destination must not overlap');
  const wanted = await inventory(source);
  if (!wanted.get('SKILL.md')?.bytes) throw Error(`Source must contain SKILL.md: ${source}`);
  const installed = await inventory(destination);
  const missing = [], changed = [], unexpected = [];
  for (const [path, entry] of wanted) {
    const current = installed.get(path);
    if (!current) missing.push(path);
    else if (Boolean(entry.directory) !== Boolean(current.directory)) throw Error(`File/directory conflict; left untouched: ${join(destination, path)}`);
    else if (entry.bytes && !entry.bytes.equals(current.bytes)) changed.push(path);
  }
  for (const path of installed.keys()) if (!wanted.has(path)) unexpected.push(path);
  const current = !missing.length && !changed.length && !unexpected.length;
  const result = { source, destination, current, missing, changed, unexpected };
  if (check || current) return result;
  if (unexpected.length) throw Error(`Unexpected or stale files/directories left untouched in ${destination}: ${unexpected.join(', ')}. Review and move them out before reinstalling.`);
  await mkdir(destination, { recursive: true });
  for (const path of [...missing, ...changed]) {
    const entry = wanted.get(path), target = join(destination, path);
    await rejectLinkedPath(target);
    if (entry.directory) await mkdir(target, { recursive: true });
    else {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, entry.bytes);
    }
  }
  return { ...result, current: true };
}

async function main(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--check') options.check = true;
    else if (arg === '--source' || arg === '--destination' || arg === '--skill') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error(`Missing value for ${arg}`);
      options[arg.slice(2)] = args[++i];
    } else if (arg === '--help') {
      console.log('Usage: node scripts/install-visual-skill.mjs [--skill lux-visual-creation|start-lux] [--check] [--source DIR] [--destination SKILL_DIR]');
      return;
    } else throw Error(`Unknown argument: ${arg}`);
  }
  const result = await installVisualSkill(options);
  console.log(JSON.stringify(result, null, 2));
  if (!result.current) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
