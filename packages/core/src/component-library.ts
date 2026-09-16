import { componentIdSchema } from '../../runtime-contracts/src/identities.ts';
import { validateSource } from '../../../apps/build-worker/src/source-policy.mjs';
import type { SourceBundle } from '../../runtime-contracts/src/index.ts';

const mountPattern = /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/;

export type LibraryComponent = Readonly<{
  id: string;
  revision: number;
  name: string;
  description: string;
  updatedAt: string;
  source: SourceBundle;
  dependencies?: readonly LibraryDependency[];
}>;
export type LibraryDependency = Readonly<{
  componentId: string;
  revision: number;
  mountPath: string;
}>;
export type LibraryComponentSummary = Readonly<Omit<LibraryComponent, 'source' | 'dependencies'>>;
export type SceneLibraryLink = Readonly<{
  componentId: string;
  mountPath: string;
  resolvedRevision: number;
  files: readonly string[];
}>;

export function plainLibraryRecord(value: unknown, fields: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) throw Error(`${label} must be a plain record`);
  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length || fields.some(field => !keys.includes(field))) throw Error(`${label} has missing or unsupported fields`);
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) throw Error(`${label} must contain own data fields`);
    result[key] = descriptor.value;
  }
  return result;
}
export function libraryText(value: unknown, label: string, maximum: number): string {
  if (typeof value !== 'string' || !(value as string & {isWellFormed():boolean}).isWellFormed() || !value || value.trim() !== value || [...value].length > maximum || /[\u0000-\u001f\u007f-\u009f]/.test(value)) throw Error(`${label} must be 1–${maximum} Unicode characters without control characters or edge whitespace`);
  return value;
}
export function validateLibrarySource(value: unknown): SourceBundle {
  const result = validateSource(value) as SourceBundle;
  if (result.sdkVersion !== '0.4.0') throw Error('Library components require SDK 0.4.0 source');
  if ('sourceVersion' in result) throw Error('The first local component library path does not accept image assets');
  return structuredClone(result);
}
export function validateLibraryComponentSummary(value: unknown): LibraryComponentSummary {
  const raw = plainLibraryRecord(value, ['id', 'revision', 'name', 'description', 'updatedAt'], 'Library component summary');
  const id = componentIdSchema.parse(raw.id);
  if (!Number.isSafeInteger(raw.revision) || (raw.revision as number) < 1) throw Error('Library component revision must be a positive integer');
  const updatedAt = libraryText(raw.updatedAt, 'Updated time', 64);
  if (!Number.isFinite(Date.parse(updatedAt))) throw Error('Library component updated time is invalid');
  return Object.freeze({ id, revision: raw.revision as number, name: libraryText(raw.name, 'Component name', 80),
    description: libraryText(raw.description, 'Component description', 512), updatedAt });
}
export function validateLibraryDependencies(value: unknown): readonly LibraryDependency[] {
  if (!Array.isArray(value)) throw Error('Library dependencies must be an array');
  return Object.freeze(value.map(item => {
    const raw = plainLibraryRecord(item, ['componentId', 'revision', 'mountPath'], 'Library dependency');
    const componentId = componentIdSchema.parse(raw.componentId);
    if (!Number.isSafeInteger(raw.revision) || (raw.revision as number) < 1) throw Error('Library dependency revision must be a positive integer');
    return Object.freeze({ componentId, revision: raw.revision as number, mountPath: mount(raw.mountPath as string) });
  }));
}
export function validateLibraryComponent(value: unknown): LibraryComponent {
  const hasDependencies = !!value && typeof value === 'object' && Reflect.ownKeys(value).includes('dependencies');
  const raw = plainLibraryRecord(value, hasDependencies
    ? ['id', 'revision', 'name', 'description', 'updatedAt', 'source', 'dependencies']
    : ['id', 'revision', 'name', 'description', 'updatedAt', 'source'], 'Library component');
  const summary = validateLibraryComponentSummary({ id: raw.id, revision: raw.revision, name: raw.name,
    description: raw.description, updatedAt: raw.updatedAt });
  const dependencies = hasDependencies ? validateLibraryDependencies(raw.dependencies) : undefined;
  return Object.freeze({ ...summary, source: validateLibrarySource(raw.source),
    ...(dependencies?.length ? { dependencies } : {}) });
}

function mount(value: string): string {
  if (typeof value !== 'string' || value.length > 180 || !mountPattern.test(value) || value.split('/').some(part => /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(part))) throw Error('Invalid library mount path');
  return value;
}
export function validateSceneLibraryLinks(value: unknown): readonly SceneLibraryLink[] {
  if (!Array.isArray(value)) throw Error('Scene library links must be an array');
  const ids = new Set<string>(), paths = new Set<string>();
  return Object.freeze(value.map(item => {
    const raw = plainLibraryRecord(item, ['componentId', 'mountPath', 'resolvedRevision', 'files'], 'Scene library link');
    const componentId = componentIdSchema.parse(raw.componentId), mountPath = mount(raw.mountPath as string);
    if (ids.has(componentId) || paths.has(mountPath.toLowerCase())) throw Error('Duplicate scene library link');
    ids.add(componentId); paths.add(mountPath.toLowerCase());
    if (!Number.isSafeInteger(raw.resolvedRevision) || (raw.resolvedRevision as number) < 1) throw Error('Resolved library revision must be a positive integer');
    if (!Array.isArray(raw.files) || raw.files.length < 1 || raw.files.length > 32) throw Error('Linked component must name 1–32 mounted files');
    const files = raw.files.map(path => {
      if (typeof path !== 'string' || !path.startsWith(`${mountPath}/`) || !/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.ts$/.test(path)) throw Error('Invalid mounted library file');
      return path;
    });
    if (new Set(files.map(path => path.toLowerCase())).size !== files.length) throw Error('Duplicate mounted library file');
    return Object.freeze({ componentId, mountPath, resolvedRevision: raw.resolvedRevision as number, files: Object.freeze(files) });
  }));
}
function mounted(component: LibraryComponent, mountPath: string): Record<string, string> {
  return Object.fromEntries(Object.entries(component.source.files).map(([path, code]) => [`${mountPath}/${path}`, code]));
}
function overlappingMount(left: string, right: string): boolean {
  const a = left.toLowerCase(), b = right.toLowerCase();
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}
export async function resolveLibraryComponent(
  componentValue: LibraryComponent,
  read: (id: string, revision?: number) => Promise<LibraryComponent>,
): Promise<LibraryComponent> {
  const resolveComponent = async (value: LibraryComponent, depth: number, ancestors: ReadonlySet<string>): Promise<LibraryComponent> => {
    const component = validateLibraryComponent(value), key = `${component.id}@${component.revision}`;
    if (ancestors.has(key)) throw Error(`Library dependency cycle includes ${key}`);
    if (depth > 8) throw Error('Library dependency resolution exceeds the depth limit');
    const dependencies = component.dependencies ?? [];
    for (let index = 0; index < dependencies.length; index++) {
      for (let other = index + 1; other < dependencies.length; other++) {
        if (overlappingMount(dependencies[index]!.mountPath, dependencies[other]!.mountPath)) {
          throw Error('Library dependency mount paths overlap');
        }
      }
      const mountPath = dependencies[index]!.mountPath.toLowerCase();
      if (Object.keys(component.source.files).some(path => path.toLowerCase().startsWith(`${mountPath}/`))) {
        throw Error(`Library dependency mount conflicts with local source: ${dependencies[index]!.mountPath}`);
      }
    }
    const files: Record<string, string> = { ...component.source.files };
    const nextAncestors = new Set(ancestors); nextAncestors.add(key);
    for (const dependency of dependencies) {
      const stored = validateLibraryComponent(await read(dependency.componentId, dependency.revision));
      if (stored.id !== dependency.componentId || stored.revision !== dependency.revision) {
        throw Error(`Library dependency does not match pinned identity or revision: ${dependency.componentId}@${dependency.revision}`);
      }
      const resolved = await resolveComponent(stored, depth + 1, nextAncestors);
      for (const [path, code] of Object.entries(resolved.source.files)) {
        const mountedPath = `${dependency.mountPath}/${path}`;
        const existing = Object.keys(files).find(candidate => candidate.toLowerCase() === mountedPath.toLowerCase());
        if (existing) throw Error(`Library dependency mount conflicts with source file: ${mountedPath}`);
        files[mountedPath] = code;
      }
    }
    const { dependencies: _dependencies, ...metadata } = component;
    return Object.freeze({ ...metadata, source: validateLibrarySource({ ...component.source, files }) });
  };
  return resolveComponent(componentValue, 1, new Set());
}
export function applyLibraryComponent(scene: SourceBundle, linksValue: readonly SceneLibraryLink[], componentValue: LibraryComponent, requestedMount: string) {
  const admitted = validateLibrarySource(scene), component = validateLibraryComponent(componentValue), links = [...validateSceneLibraryLinks(linksValue)];
  const existingIndex = links.findIndex(link => link.componentId === component.id), mountPath = existingIndex >= 0 ? links[existingIndex]!.mountPath : mount(requestedMount);
  if (existingIndex < 0 && links.some(link => link.mountPath.toLowerCase() === mountPath.toLowerCase())) throw Error('Library mount path is already linked');
  const previousFiles = existingIndex >= 0 ? links[existingIndex]!.files : [];
  const files = { ...admitted.files };
  for (const path of previousFiles) delete files[path];
  const additions = mounted(component, mountPath);
  for (const path of Object.keys(additions)) if (Object.hasOwn(files, path)) throw Error(`Library mount conflicts with scene file: ${path}`);
  Object.assign(files, additions);
  const nextSource = validateLibrarySource({ ...admitted, files });
  const nextLink: SceneLibraryLink = Object.freeze({ componentId: component.id, mountPath, resolvedRevision: component.revision, files: Object.freeze(Object.keys(additions).sort()) });
  if (existingIndex >= 0) links[existingIndex] = nextLink; else links.push(nextLink);
  return Object.freeze({ source: nextSource, links: validateSceneLibraryLinks(links) });
}
export function forkLibraryComponent(scene: SourceBundle, linksValue: readonly SceneLibraryLink[], componentId: string) {
  const admitted = validateLibrarySource(scene), links = validateSceneLibraryLinks(linksValue), id = componentIdSchema.parse(componentId);
  if (!links.some(link => link.componentId === id)) throw Error('Scene does not link this library component');
  return Object.freeze({ source: admitted, links: Object.freeze(links.filter(link => link.componentId !== id)) });
}
export async function checkLibraryLinks(scene: SourceBundle, linksValue: readonly SceneLibraryLink[], read: (id: string) => Promise<LibraryComponent>) {
  const admitted = structuredClone(validateSource(scene) as SourceBundle), links = validateSceneLibraryLinks(linksValue);
  const updates: Array<{ componentId: string; name: string; resolvedRevision: number; availableRevision: number }> = [];
  const fallbacks: Array<{ componentId: string; resolvedRevision: number; message: string }> = [];
  for (const link of links) {
    try {
      const current = validateLibraryComponent(await read(link.componentId));
      if (current.revision < link.resolvedRevision) throw Error('Library revision is older than the saved scene fallback');
      if (current.revision > link.resolvedRevision) updates.push({ componentId: current.id, name: current.name, resolvedRevision: link.resolvedRevision, availableRevision: current.revision });
    } catch (error) { fallbacks.push({ componentId: link.componentId, resolvedRevision: link.resolvedRevision, message: error instanceof Error ? error.message : String(error) }); }
  }
  return Object.freeze({ source: admitted === scene ? scene : admitted, links, updates: Object.freeze(updates), fallbacks: Object.freeze(fallbacks) });
}
