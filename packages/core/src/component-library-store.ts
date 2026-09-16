import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rm, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { componentIdSchema } from '../../runtime-contracts/src/identities.ts';
import type { SourceBundle } from '../../runtime-contracts/src/index.ts';
import { libraryText, plainLibraryRecord, resolveLibraryComponent, validateLibraryComponent, validateLibraryComponentSummary, validateLibraryDependencies, validateLibrarySource } from './component-library.ts';
import type { LibraryComponent, LibraryComponentSummary, LibraryDependency } from './component-library.ts';

const libraryBytes = 8 * 1024 * 1024;
const componentCount = 32;
const sourcePathPattern = /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.ts$/;

type CatalogReference = Readonly<{ id: string; revision: number }>;
type LibraryCatalog = Readonly<{ format: 'lux-component-library-catalog'; version: 1; components: readonly CatalogReference[] }>;
type LegacyLibraryFile = Readonly<{ format: 'lux-component-library'; version: 1; components: readonly LibraryComponent[] }>;
type ComponentManifest = Readonly<{
  format: 'lux-library-component'; version: 1; id: string; revision: number; name: string;
  description: string; updatedAt: string;
  source: Readonly<{ sdkVersion: string; entry: string; files: readonly string[] }>;
  dependencies?: readonly LibraryDependency[];
}>;
type StoreOptions = {
  id?: () => string;
  now?: () => string;
  validateCandidate?: (source: SourceBundle) => Promise<void>;
  legacyPath?: string;
  seedRoot?: string;
  seedRoots?: readonly string[];
  lockWaitMs?: number;
};

const emptyCatalog = (): LibraryCatalog => Object.freeze({
  format: 'lux-component-library-catalog', version: 1, components: Object.freeze([]),
});

function catalog(value: unknown): LibraryCatalog {
  const raw = plainLibraryRecord(value, ['format', 'version', 'components'], 'Component library catalog');
  if (raw.format !== 'lux-component-library-catalog' || raw.version !== 1 || !Array.isArray(raw.components) || raw.components.length > componentCount) {
    throw Error('Invalid component library catalog');
  }
  const ids = new Set<string>();
  const components = raw.components.map(value => {
    const item = plainLibraryRecord(value, ['id', 'revision'], 'Component library catalog entry');
    const id = componentIdSchema.parse(item.id);
    if (ids.has(id)) throw Error('Duplicate library component ID');
    ids.add(id);
    if (!Number.isSafeInteger(item.revision) || (item.revision as number) < 1) throw Error('Library component revision must be a positive integer');
    return Object.freeze({ id, revision: item.revision as number });
  });
  return Object.freeze({ format: 'lux-component-library-catalog', version: 1, components: Object.freeze(components) });
}

function legacyFile(value: unknown): LegacyLibraryFile {
  const raw = plainLibraryRecord(value, ['format', 'version', 'components'], 'Component library');
  if (raw.format !== 'lux-component-library' || raw.version !== 1 || !Array.isArray(raw.components) || raw.components.length > componentCount) {
    throw Error('Invalid component library file');
  }
  const components = raw.components.map(validateLibraryComponent), ids = new Set<string>();
  for (const component of components) {
    if (ids.has(component.id)) throw Error('Duplicate library component ID');
    ids.add(component.id);
  }
  return Object.freeze({ format: 'lux-component-library', version: 1, components: Object.freeze(components) });
}

function componentManifest(value: unknown): ComponentManifest {
  const hasDependencies = !!value && typeof value === 'object' && Reflect.ownKeys(value).includes('dependencies');
  const raw = plainLibraryRecord(value, hasDependencies
    ? ['format', 'version', 'id', 'revision', 'name', 'description', 'updatedAt', 'source', 'dependencies']
    : ['format', 'version', 'id', 'revision', 'name', 'description', 'updatedAt', 'source'], 'Library component manifest');
  if (raw.format !== 'lux-library-component' || raw.version !== 1) throw Error('Invalid library component manifest');
  const summary = validateLibraryComponentSummary({ id: raw.id, revision: raw.revision, name: raw.name,
    description: raw.description, updatedAt: raw.updatedAt });
  const source = plainLibraryRecord(raw.source, ['sdkVersion', 'entry', 'files'], 'Library component source manifest');
  if (typeof source.sdkVersion !== 'string' || typeof source.entry !== 'string' || !Array.isArray(source.files) || source.files.length < 1 || source.files.length > 32) {
    throw Error('Invalid library component source manifest');
  }
  const paths = source.files.map(path => {
    if (typeof path !== 'string' || path.length > 240 || !sourcePathPattern.test(path)) throw Error('Invalid library component source path');
    return path;
  });
  if (new Set(paths.map(path => path.toLowerCase())).size !== paths.length) throw Error('Duplicate library component source path');
  const dependencies = hasDependencies ? validateLibraryDependencies(raw.dependencies) : undefined;
  return Object.freeze({
    format: 'lux-library-component', version: 1, ...summary,
    source: Object.freeze({ sdkVersion: source.sdkVersion, entry: source.entry, files: Object.freeze(paths) }),
    ...(dependencies?.length ? { dependencies } : {}),
  });
}

function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

async function ensureDirectory(path: string): Promise<string> {
  await mkdir(path, { recursive: true });
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) throw Error(`Library path is not a regular directory: ${path}`);
  return realpath(path);
}

async function readBounded(path: string, label: string): Promise<Buffer | null> {
  let info;
  try { info = await lstat(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  if (!info.isFile() || info.isSymbolicLink()) throw Error(`${label} must be a regular file`);
  if (info.size > libraryBytes) throw Error('Component library exceeds 8 MiB');
  const bytes = await readFile(path);
  if (bytes.length > libraryBytes) throw Error('Component library exceeds 8 MiB');
  return bytes;
}

async function readJson(path: string, label: string): Promise<unknown | null> {
  const bytes = await readBounded(path, label);
  return bytes ? JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) : null;
}

function revisionDirectory(root: string, reference: CatalogReference): string {
  return join(root, 'components', reference.id, 'revisions', String(reference.revision));
}

async function assertStoredPath(root: string, path: string): Promise<void> {
  const [realRoot, realPath] = await Promise.all([realpath(root), realpath(path)]);
  if (!inside(realRoot, realPath)) throw Error('Library source path escapes its root');
}

async function readComponentDirectory(root: string, directory: string, reference: CatalogReference): Promise<LibraryComponent> {
  await assertStoredPath(root, directory);
  const manifestValue = await readJson(join(directory, 'component.json'), 'Library component manifest');
  if (!manifestValue) throw Error(`Library component revision is missing: ${reference.id}@${reference.revision}`);
  const manifest = componentManifest(manifestValue);
  if (manifest.id !== reference.id || manifest.revision !== reference.revision) throw Error('Library component manifest does not match its catalog entry');
  const files: Record<string, string> = Object.create(null);
  let bytes = 0;
  for (const path of manifest.source.files) {
    const sourcePath = join(directory, 'source', ...path.split('/'));
    await assertStoredPath(root, sourcePath);
    const source = await readBounded(sourcePath, 'Library component source');
    if (!source) throw Error(`Library component source is missing: ${path}`);
    bytes += source.length;
    if (bytes > libraryBytes) throw Error('Component library exceeds 8 MiB');
    files[path] = new TextDecoder('utf-8', { fatal: true }).decode(source);
  }
  return validateLibraryComponent({ id: manifest.id, revision: manifest.revision, name: manifest.name,
    description: manifest.description, updatedAt: manifest.updatedAt,
    source: { sdkVersion: manifest.source.sdkVersion, entry: manifest.source.entry, files },
    ...(manifest.dependencies ? { dependencies: manifest.dependencies } : {}) });
}

async function readStoredComponent(root: string, reference: CatalogReference): Promise<LibraryComponent> {
  return readComponentDirectory(root, revisionDirectory(root, reference), reference);
}

/** Read only catalog and manifest metadata. This intentionally does not prepare,
 * migrate, lock, or read source files. */
export async function readLibraryCatalogSummaries(rootValue: string, missing = false): Promise<readonly LibraryComponentSummary[]> {
  const root = resolve(rootValue), current = await loadCatalog(root, missing);
  return Object.freeze(await Promise.all(current.components.map(async reference => {
    const directory = revisionDirectory(root, reference);
    await assertStoredPath(root, directory);
    const value = await readJson(join(directory, 'component.json'), 'Library component manifest');
    if (!value) throw Error(`Library component revision is missing: ${reference.id}@${reference.revision}`);
    const manifest = componentManifest(value);
    if (manifest.id !== reference.id || manifest.revision !== reference.revision) throw Error('Library component manifest does not match its catalog entry');
    return validateLibraryComponentSummary({ id: manifest.id, revision: manifest.revision, name: manifest.name,
      description: manifest.description, updatedAt: manifest.updatedAt });
  })));
}

async function availableSeedRevisions(root: string, component: LibraryComponent): Promise<number[]> {
  const directory = dirname(revisionDirectory(root, component));
  await assertStoredPath(root, directory);
  const entries = await readdir(directory, { withFileTypes: true });
  const revisions = entries.map(entry => {
    const revision = Number(entry.name);
    if (!entry.isDirectory() || entry.isSymbolicLink() || !/^[1-9][0-9]*$/.test(entry.name) || !Number.isSafeInteger(revision)) {
      throw Error('Invalid library revision directory');
    }
    return revision;
  }).filter(revision => revision <= component.revision).sort((a, b) => a - b);
  // Legacy profiles retain only their latest revision. Preserve that available
  // suffix and any later updates; never invent missing historical source.
  if (revisions.at(-1) !== component.revision || revisions.some((revision, index) => revision !== revisions[0]! + index)) {
    throw Error(`Library component revision is missing: ${component.id}`);
  }
  return revisions;
}

async function loadCatalog(root: string, missing = false): Promise<LibraryCatalog> {
  try { await assertStoredPath(root, root); }
  catch (error) {
    if (missing && (error as NodeJS.ErrnoException).code === 'ENOENT') return emptyCatalog();
    throw error;
  }
  const value = await readJson(join(root, 'catalog.json'), 'Component library catalog');
  return value === null ? emptyCatalog() : catalog(value);
}

async function loadComponents(root: string, missing = false): Promise<{ catalog: LibraryCatalog; components: LibraryComponent[] }> {
  const current = await loadCatalog(root, missing);
  const components: LibraryComponent[] = [];
  let bytes = 0;
  for (const reference of current.components) {
    const component = await readStoredComponent(root, reference);
    bytes += Buffer.byteLength(JSON.stringify(component));
    if (bytes > libraryBytes) throw Error('Component library exceeds 8 MiB');
    components.push(component);
  }
  return { catalog: current, components };
}

function sameComponent(left: LibraryComponent, right: LibraryComponent): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function manifestFor(component: LibraryComponent): ComponentManifest {
  return { format: 'lux-library-component', version: 1, id: component.id, revision: component.revision,
    name: component.name, description: component.description, updatedAt: component.updatedAt,
    source: { sdkVersion: component.source.sdkVersion, entry: component.source.entry,
      files: Object.freeze(Object.keys(component.source.files).sort()) },
    ...(component.dependencies ? { dependencies: component.dependencies } : {}) };
}

async function writeComponentDirectory(root: string, destination: string, component: LibraryComponent): Promise<void> {
  try {
    await lstat(destination);
    const existing = await readComponentDirectory(root, destination, component);
    if (!sameComponent(existing, component)) throw Error(`Library revision storage conflict: ${component.id}@${component.revision}`);
    return;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const staging = join(root, `.staging-${randomUUID()}`);
  await ensureDirectory(staging);
  try {
    const sourceRoot = join(staging, 'source');
    for (const [path, text] of Object.entries(component.source.files)) {
      const target = join(sourceRoot, ...path.split('/'));
      await mkdir(dirname(target), { recursive: true });
      await assertStoredPath(root, dirname(target));
      const handle = await open(target, 'wx');
      try { await handle.writeFile(text, 'utf8'); await handle.sync(); }
      finally { await handle.close(); }
    }
    const handle = await open(join(staging, 'component.json'), 'wx');
    try { await handle.writeFile(`${JSON.stringify(manifestFor(component), null, 2)}\n`); await handle.sync(); }
    finally { await handle.close(); }
    await ensureDirectory(dirname(destination));
    await assertStoredPath(root, dirname(destination));
    try { await rename(staging, destination); }
    catch (error) {
      if (!['EEXIST', 'ENOTEMPTY'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
      const existing = await readComponentDirectory(root, destination, component);
      if (!sameComponent(existing, component)) throw Error(`Library revision storage conflict: ${component.id}@${component.revision}`);
    }
  } finally { await rm(staging, { recursive: true, force: true }); }
}

async function writeStoredComponent(root: string, component: LibraryComponent): Promise<void> {
  await writeComponentDirectory(root, revisionDirectory(root, component), component);
}

async function writeCatalog(root: string, value: LibraryCatalog): Promise<void> {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  if (bytes.length > libraryBytes) throw Error('Component library exceeds 8 MiB');
  const temporary = join(root, `.catalog-${randomUUID()}.tmp`);
  let committed = false;
  try {
    const handle = await open(temporary, 'wx');
    try { await handle.writeFile(bytes); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temporary, join(root, 'catalog.json'));
    committed = true;
  } finally { if (!committed) await unlink(temporary).catch(() => {}); }
}

async function archiveConflict(root: string, component: LibraryComponent): Promise<void> {
  const hash = createHash('sha256').update(JSON.stringify(component)).digest('hex');
  await writeComponentDirectory(root, join(root, 'conflicts', component.id, hash), component);
}

export class ComponentLibraryStore {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly root: string;
  private readonly id: () => string;
  private readonly now: () => string;
  private readonly validateCandidate: (source: SourceBundle) => Promise<void>;
  private readonly legacyPath?: string;
  private readonly seedRoots: readonly string[];
  private readonly lockWaitMs: number;

  constructor(root: string, options: StoreOptions = {}) {
    this.root = resolve(root);
    this.id = options.id ?? randomUUID;
    this.now = options.now ?? (() => new Date().toISOString());
    this.validateCandidate = options.validateCandidate ?? (async () => {});
    this.legacyPath = options.legacyPath && resolve(options.legacyPath);
    this.seedRoots = Object.freeze([...(options.seedRoots ?? []), ...(options.seedRoot ? [options.seedRoot] : [])]
      .map(path => resolve(path)).filter((path, index, values) => values.indexOf(path) === index));
    this.lockWaitMs = options.lockWaitMs ?? 10_000;
  }

  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation);
    this.queue = result.catch(() => {});
    return result;
  }

  private async locked<T>(operation: () => Promise<T>): Promise<T> {
    await ensureDirectory(this.root);
    const lockPath = join(this.root, '.write.lock'), deadline = Date.now() + this.lockWaitMs, token = randomUUID();
    let handle;
    while (!handle) {
      try {
        const candidate = await open(lockPath, 'wx');
        try { await candidate.writeFile(JSON.stringify({ pid: process.pid, token, createdAt: new Date().toISOString() })); handle = candidate; }
        catch (error) { await candidate.close(); await unlink(lockPath).catch(() => {}); throw error; }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        if (Date.now() >= deadline) throw Error(`Component library is busy. If no Studio process is using it, remove ${lockPath}`);
        await delay(Math.min(20, Math.max(1, deadline - Date.now())));
      }
    }
    try { return await operation(); }
    finally {
      await handle.close();
      try {
        const current = JSON.parse((await readBounded(lockPath, 'Component library lock'))?.toString('utf8') ?? 'null') as { token?: unknown } | null;
        if (current?.token === token) await unlink(lockPath);
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
  }

  private async prepareLocked(): Promise<{ catalog: LibraryCatalog; components: LibraryComponent[] }> {
    const current = await loadComponents(this.root), components = [...current.components], references = [...current.catalog.components];
    let changed = false;
    const missingRevision = (error: unknown): boolean =>
      (error as NodeJS.ErrnoException).code === 'ENOENT' || String(error).includes('revision is missing');
    const readSeedHistory = async (sourceRoot: string, candidate: LibraryComponent): Promise<LibraryComponent[] | null> => {
      const revisions: LibraryComponent[] = [];
      try {
        for (const revision of await availableSeedRevisions(sourceRoot, candidate)) {
          revisions.push(await readStoredComponent(sourceRoot, { id: candidate.id, revision }));
        }
      } catch (error) {
        if (missingRevision(error)) return null;
        throw error;
      }
      if (!sameComponent(revisions.at(-1)!, candidate)) throw Error('Library seed current revision does not match its immutable history');
      return revisions;
    };
    const backfillSeedHistory = async (revisions: readonly LibraryComponent[]): Promise<void> => {
      const missing: LibraryComponent[] = [];
      for (const revision of revisions) {
        let stored: LibraryComponent;
        try { stored = await readStoredComponent(this.root, { id: revision.id, revision: revision.revision }); }
        catch (error) {
          if (missingRevision(error)) { missing.push(revision); continue; }
          throw error;
        }
        if (!sameComponent(stored, revision)) {
          await archiveConflict(this.root, revision);
          throw Error(`Component library seed history conflict for ${revision.id}@${revision.revision}; both sources were preserved`);
        }
      }
      for (const revision of missing) await writeStoredComponent(this.root, revision);
    };
    const add = async (candidate: LibraryComponent, kind: 'seed' | 'migration', sourceRoot?: string): Promise<void> => {
      const index = components.findIndex(component => component.id === candidate.id), existing = components[index];
      if (!existing) {
        if (components.length >= componentCount) throw Error('Component library supports at most 32 entries');
        if (kind === 'seed' && sourceRoot) {
          const revisions = await readSeedHistory(sourceRoot, candidate);
          if (!revisions) {
            await archiveConflict(this.root, candidate);
            throw Error(`Component library seed history is incomplete for ${candidate.id}; the current source was preserved`);
          }
          for (const revision of revisions) await writeStoredComponent(this.root, revision);
        } else await writeStoredComponent(this.root, candidate);
        components.push(candidate); references.push({ id: candidate.id, revision: candidate.revision }); changed = true;
        return;
      }
      if (sameComponent(existing, candidate)) {
        if (kind === 'seed' && sourceRoot) {
          const revisions = await readSeedHistory(sourceRoot, candidate);
          if (!revisions) {
            await archiveConflict(this.root, candidate);
            throw Error(`Component library seed history is incomplete for ${candidate.id}; the current source was preserved`);
          }
          await backfillSeedHistory(revisions);
        }
        return;
      }
      if (kind === 'seed' && sourceRoot && candidate.revision > existing.revision) {
        const revisions = await readSeedHistory(sourceRoot, candidate);
        const base = revisions?.find(revision => revision.revision === existing.revision);
        if (base && sameComponent(base, existing)) {
          await backfillSeedHistory(revisions!);
          components[index] = candidate; references[index] = { id: candidate.id, revision: candidate.revision }; changed = true;
          return;
        }
      }
      if (existing.revision > candidate.revision) {
        try {
          const historical = await readStoredComponent(this.root, { id: candidate.id, revision: candidate.revision });
          if (sameComponent(historical, candidate)) return;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !String(error).includes('revision is missing')) throw error;
        }
      }
      await archiveConflict(this.root, candidate);
      throw Error(`Component library ${kind} conflict for ${candidate.id}; both sources were preserved`);
    };

    for (const seedRoot of this.seedRoots) {
      if (seedRoot === this.root) continue;
      const seed = await loadComponents(seedRoot, true);
      for (const component of seed.components) await add(component, 'seed', seedRoot);
    }

    let legacyBytes: Buffer | null = null;
    if (this.legacyPath) legacyBytes = await readBounded(this.legacyPath, 'Component library');
    if (legacyBytes) {
      const legacy = legacyFile(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(legacyBytes)));
      for (const component of legacy.components) await add(component, 'migration');
    }

    const next = catalog({ format: 'lux-component-library-catalog', version: 1, components: references });
    if (changed || !(await readBounded(join(this.root, 'catalog.json'), 'Component library catalog'))) await writeCatalog(this.root, next);
    if (legacyBytes && this.legacyPath) {
      let destination = `${this.legacyPath}.migrated`;
      try { await lstat(destination); destination = `${destination}-${createHash('sha256').update(legacyBytes).digest('hex').slice(0, 12)}`; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      await rename(this.legacyPath, destination);
    }
    return { catalog: next, components };
  }

  async list(): Promise<readonly LibraryComponentSummary[]> {
    return this.exclusive(() => this.locked(async () => (await this.prepareLocked()).components
      .map(({ source: _source, dependencies: _dependencies, ...summary }) => Object.freeze(summary))));
  }

  async read(id: string, revision?: number): Promise<LibraryComponent> {
    id = componentIdSchema.parse(id);
    if (revision !== undefined && (!Number.isSafeInteger(revision) || revision < 1)) throw Error('Library component revision must be a positive integer');
    return this.exclusive(() => this.locked(async () => {
      const current = await this.prepareLocked(), result = current.components.find(component => component.id === id);
      if (!result) throw Error('Library component is missing');
      if (revision === undefined || revision === result.revision) return structuredClone(result);
      if (revision > result.revision) throw Error(`Library component revision is missing: ${id}@${revision}`);
      return structuredClone(await readStoredComponent(this.root, { id, revision }));
    }));
  }

  create(input: { name: string; description: string; source: SourceBundle; dependencies?: readonly LibraryDependency[] }): Promise<LibraryComponent> {
    return this.exclusive(async () => {
      const candidateSource = validateLibrarySource(input.source);
      const dependencies = input.dependencies === undefined ? undefined : validateLibraryDependencies(input.dependencies);
      const candidate = validateLibraryComponent({ id: componentIdSchema.parse(this.id()), revision: 1,
        name: libraryText(input.name, 'Component name', 80), description: libraryText(input.description, 'Component description', 512),
        updatedAt: this.now(), source: candidateSource, ...(dependencies?.length ? { dependencies } : {}) });
      const expanded = await this.locked(async () => {
        const current = await this.prepareLocked();
        if (current.components.length >= componentCount) throw Error('Component library supports at most 32 entries');
        if (current.components.some(component => component.id === candidate.id)) throw Error('Library component ID already exists');
        return resolveLibraryComponent(candidate, async (id, revision) => {
          const reference = current.catalog.components.find(item => item.id === id);
          if (!reference || revision === undefined || revision > reference.revision) throw Error('Library component is missing');
          return readStoredComponent(this.root, { id, revision });
        });
      });
      await this.validateCandidate(expanded.source);
      return this.locked(async () => {
        const current = await this.prepareLocked();
        if (current.components.length >= componentCount) throw Error('Component library supports at most 32 entries');
        if (current.components.some(component => component.id === candidate.id)) throw Error('Library component ID already exists');
        await writeStoredComponent(this.root, candidate);
        await writeCatalog(this.root, catalog({ format: 'lux-component-library-catalog', version: 1,
          components: [...current.catalog.components, { id: candidate.id, revision: candidate.revision }] }));
        return structuredClone(candidate);
      });
    });
  }

  update(input: { id: string; expectedRevision: number; name?: string; description?: string; source?: SourceBundle; dependencies?: readonly LibraryDependency[] }): Promise<LibraryComponent> {
    return this.exclusive(async () => {
      const id = componentIdSchema.parse(input.id);
      if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) throw Error('Library revision conflict');
      const prepared = await this.locked(async () => {
        const state = await this.prepareLocked(), current = state.components.find(component => component.id === id);
        if (!current) throw Error('Library component is missing');
        if (current.revision !== input.expectedRevision) throw Error(`Library revision conflict: expected ${input.expectedRevision}, current ${current.revision}`);
        const snapshot = structuredClone(current);
        const candidateSource = input.source === undefined ? snapshot.source : validateLibrarySource(input.source);
        const dependencies = input.dependencies === undefined ? snapshot.dependencies : validateLibraryDependencies(input.dependencies);
        const candidate = validateLibraryComponent({ id, revision: snapshot.revision + 1,
          name: input.name === undefined ? snapshot.name : libraryText(input.name, 'Component name', 80),
          description: input.description === undefined ? snapshot.description : libraryText(input.description, 'Component description', 512),
          updatedAt: this.now(), source: candidateSource, ...(dependencies?.length ? { dependencies } : {}) });
        const expanded = await resolveLibraryComponent(candidate, async (dependencyId, revision) => {
          const reference = state.catalog.components.find(item => item.id === dependencyId);
          if (!reference || revision === undefined || revision > reference.revision) throw Error('Library component is missing');
          return readStoredComponent(this.root, { id: dependencyId, revision });
        });
        return { candidate, expanded };
      });
      await this.validateCandidate(prepared.expanded.source);
      const candidate = prepared.candidate;
      return this.locked(async () => {
        const current = await this.prepareLocked(), index = current.components.findIndex(component => component.id === id);
        if (index < 0) throw Error('Library component is missing');
        const previous = current.components[index]!;
        if (previous.revision !== input.expectedRevision) throw Error(`Library revision conflict: expected ${input.expectedRevision}, current ${previous.revision}`);
        await writeStoredComponent(this.root, candidate);
        const references = [...current.catalog.components]; references[index] = { id, revision: candidate.revision };
        await writeCatalog(this.root, catalog({ format: 'lux-component-library-catalog', version: 1, components: references }));
        return structuredClone(candidate);
      });
    });
  }
}
