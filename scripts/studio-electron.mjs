import { createRequire } from 'node:module';
import { readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';

// Resolving the entry is inert; requiring modern Electron can download binaries.
export function installedElectron(workspace) {
  const root = dirname(createRequire(join(workspace, 'package.json')).resolve('electron'));
  let name;
  try { name = readFileSync(join(root, 'path.txt'), 'utf8').trim(); }
  catch { throw Error('Pinned Electron binary is not installed. Complete the approved Electron setup before starting Studio; no automatic download was attempted.'); }
  const dist = join(root, 'dist'), executable = join(dist, name), rel = relative(dist, executable);
  if (!name || isAbsolute(name) || rel === '..' || rel.startsWith(`..${sep}`) || !statSync(executable).isFile()) {
    throw Error('Installed Electron path is invalid');
  }
  return executable;
}
