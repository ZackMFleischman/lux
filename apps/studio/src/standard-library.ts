import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const luxProjectId = '34723eb7-f57d-45c3-8831-adcb2bbfe485';
const markerBytes = 4096;

type StandardLibraryOptions = Readonly<{
  workspace: string;
  appData: string;
  desktop: boolean;
  overrideRoot?: string;
  canonicalRoot?: string;
  gitCommonDirectory?: () => string;
}>;

export type StandardLibraryLocation = Readonly<{
  root: string;
  kind: 'repository' | 'fallback' | 'test';
  seedRoots: readonly string[];
}>;

function readGitCommonDirectory(workspace: string): string {
  return execFileSync('git', ['-c', 'core.excludesFile=', '-c', `safe.directory=${workspace.replaceAll('\\', '/')}`,
    '-C', workspace, 'rev-parse', '--path-format=absolute', '--git-common-dir'],
  { encoding: 'utf8', windowsHide: true }).trim();
}

function hasCanonicalMarker(root: string): boolean {
  const marker = join(root, 'repository.json');
  try {
    const directory = lstatSync(root), file = lstatSync(marker);
    if (!directory.isDirectory() || directory.isSymbolicLink() || !file.isFile() || file.isSymbolicLink()) {
      throw Error('Corrupt Lux standard library repository marker');
    }
    if (file.size > markerBytes) throw Error('Corrupt Lux standard library repository marker: file is too large');
    const value = JSON.parse(readFileSync(marker, 'utf8')) as Record<string, unknown>;
    if (value.format !== 'lux-standard-library' || value.version !== 1 || value.projectId !== luxProjectId || Reflect.ownKeys(value).length !== 3) {
      throw Error('Corrupt Lux standard library repository marker');
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    if (error instanceof SyntaxError) throw Error(`Corrupt Lux standard library repository marker: ${error.message}`);
    throw error;
  }
}

/** Resolve storage independently from a Studio profile. Checkout worktrees and
 * installed builds share a marked repository library when it is available.
 * Standalone installations use one visible app-data fallback seeded by the package. */
export function resolveStandardLibrary(options: StandardLibraryOptions): StandardLibraryLocation {
  const workspace = resolve(options.workspace);
  const packaged = join(workspace, 'library');
  if (options.overrideRoot) return Object.freeze({ root: resolve(options.overrideRoot), kind: 'test', seedRoots: Object.freeze([packaged]) });
  if (options.desktop) {
    const fallback = join(resolve(options.appData), 'Lux', 'Studio', 'library');
    if (options.canonicalRoot && hasCanonicalMarker(resolve(options.canonicalRoot))) return Object.freeze({
      root: resolve(options.canonicalRoot), kind: 'repository', seedRoots: Object.freeze([packaged, fallback]),
    });
    return Object.freeze({ root: fallback, kind: 'fallback', seedRoots: Object.freeze([packaged]) });
  }
  const common = resolve(workspace, (options.gitCommonDirectory ?? (() => readGitCommonDirectory(workspace)))());
  if (basename(common).toLowerCase() !== '.git') throw Error(`Unsupported Git common directory: ${common}`);
  return Object.freeze({ root: join(dirname(common), 'library'), kind: 'repository', seedRoots: Object.freeze([]) });
}
