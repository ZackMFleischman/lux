import { parse } from '@babel/parser';
import { admitProjectMetadata, validateMetadata, parseMetadataJson, metadataLimits, projectLimits, hashMetadata, hashPackage } from './contracts.ts';
import type { DependencyLock, ComponentRef, ProjectMetadata, CodeExport, AssetManifest, PackageManifest } from './contracts.ts';
import { snapshotJsonData } from './bounded-json.ts';
import { metadataPath, sourcePath, uniquePaths } from './metadata-paths.ts';
import { componentIdSchema, assetIdSchema } from '../../../runtime-contracts/src/identities.ts';
import type { SceneId, AssetId } from '../../../runtime-contracts/src/identities.ts';
import type { SourceBundle, CompileDiagnostic } from '../../../runtime-contracts/src/index.ts';
import { sdkMetadata } from '../../../visual-sdk/src/metadata.mjs';
import { deriveAssets } from '../../../assets/src/index.mjs';
import type { SourceAssets } from '../../../assets/src/index.mjs';
import { validateSource } from '../../../../apps/build-worker/src/source-policy.mjs';
import { verifyPackageBytes, captureBytes, ownRecord, resolutionError, freezeData, sha256 } from './library.ts';

export type ProjectResolutionInput = Readonly<{ documents: Readonly<Record<string, Uint8Array>>; files: Readonly<Record<string, Uint8Array>> }>;
declare const resolutionBrand: unique symbol;
export type ProjectResolutionSnapshot = Readonly<{ [resolutionBrand]: true }>;
export type SourceOrigin = Readonly<{ projectPath: string; owners: readonly ComponentRef[] }>;
export type AssetOrigin = Readonly<{ projectPath: string; assetId: AssetId; owner: ComponentRef }>;
export type ResolvedProjectScene = Readonly<{ sceneId: SceneId; source: SourceBundle; origins: Readonly<Record<string, SourceOrigin>>; assetOrigins: Readonly<Record<string, AssetOrigin>> }>;
export type ProjectDiagnostic = Readonly<{ diagnostic: CompileDiagnostic; origin?: SourceOrigin }>;
export type ProjectResolutionCode = 'PROJECT_INVALID' | 'DEPENDENCY_UNAVAILABLE' | 'PACKAGE_MODIFIED' | 'CONTENT_MISSING' | 'CONTENT_UNDECLARED' | 'SOURCE_BOUNDARY_VIOLATION' | 'COMPILE_FAILED' | 'ASSET_BOUNDARY_VIOLATION' | 'QUOTA_EXCEEDED' | 'UNKNOWN_SCENE' | 'PROJECT_ID_MISMATCH';
export type ProjectResolutionError = Error & Readonly<{ code: ProjectResolutionCode; path?: string; packageId?: string; expected?: string | number; actual?: string | number; owners?: readonly ComponentRef[] }>;
type Node = { key: string; owner: ComponentRef; definition: CodeExport; prefix: string; assets: AssetManifest['assets']; package?: PackageManifest };
type State = { metadata: ProjectMetadata; files: Record<string, Uint8Array>; nodes: Map<string, Node>; sceneKeys: Record<string, string> };
const snapshots = new WeakMap<ProjectResolutionSnapshot, State>();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const keyOf = (ref: ComponentRef) => ref.kind === 'local' ? `local:${ref.componentId}` : `package:${ref.packageId}:${ref.exportId}`;
const ordered = <T>(values: T[], key: (value: T) => string): T[] => values.sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);

function graph(metadata: ProjectMetadata): Map<string, Node> {
  const nodes = new Map<string, Node>();
  for (const [id, definition] of Object.entries(metadata.components)) {
    const owner: ComponentRef = { kind: 'local', componentId: componentIdSchema.parse(id) };
    nodes.set(keyOf(owner), { key: keyOf(owner), owner, definition, prefix: metadata.project.components[id]!, assets: metadata.assets.assets });
  }
  for (const [id, pkg] of Object.entries(metadata.packages)) for (const [exportId, definition] of Object.entries(pkg.exports)) {
    const owner: ComponentRef = { kind: 'package', packageId: id, exportId };
    nodes.set(keyOf(owner), { key: keyOf(owner), owner, definition, prefix: `libraries/${metadata.lock.packages[id]!.contentHash}`, assets: pkg.assets, package: pkg });
  }
  return nodes;
}
function closure(nodes: Map<string, Node>, root: ComponentRef): Node[] {
  const done = new Set<string>(), active = new Set<string>(), result: Node[] = [];
  function visit(ref: ComponentRef) {
    const key = keyOf(ref);
    if (active.has(key)) throw resolutionError('PROJECT_INVALID', 'Definition reference cycle');
    if (done.has(key)) return;
    const node = nodes.get(key);
    if (!node) throw resolutionError('PROJECT_INVALID', `Unknown exact definition: ${key}`);
    if (done.size + active.size >= metadataLimits.nodes) throw resolutionError('QUOTA_EXCEEDED', 'Definition traversal bound exceeded');
    active.add(key); result.push(node);
    for (const ref of node.definition.references) visit(ref);
    active.delete(key); done.add(key);
  }
  visit(root); return ordered(result, n => n.key);
}
function sourceText(bytes: Uint8Array, path: string): string {
  try { return decoder.decode(bytes); }
  catch (cause) { throw resolutionError('SOURCE_BOUNDARY_VIOLATION', `Invalid UTF-8 source: ${path}`, { path }, cause); }
}
function originalBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}
function assetPath(node: Node, id: string): string {
  const descriptor = node.assets[id]!;
  return node.package ? `${node.prefix}/${descriptor.path}` : descriptor.path;
}
function assemble(state: State, rootRef: ComponentRef, sceneId: SceneId): ResolvedProjectScene {
  const nodes = closure(state.nodes, rootRef), root = state.nodes.get(keyOf(rootRef))!;
  const files: Record<string, string> = Object.create(null), origins: Record<string, { projectPath: string; owners: ComponentRef[] }> = Object.create(null);
  const assets: Record<string, SourceAssets[string]> = Object.create(null), assetOrigins: Record<string, AssetOrigin> = Object.create(null);
  const aliases = new Map<string, ComponentRef>(), paths = new Map<string, string>();
  for (const node of nodes) {
    for (const file of node.definition.files) {
      const path = sourcePath(`${node.prefix}/${file}`), folded = path.toLowerCase(), previous = paths.get(folded);
      if (previous && previous !== path) throw resolutionError('SOURCE_BOUNDARY_VIOLATION', 'Case-colliding resolved source paths', { path, owners: [...origins[previous]!.owners, node.owner] });
      paths.set(folded, path);
      if (!Object.hasOwn(files, path)) { files[path] = sourceText(state.files[path]!, path); origins[path] = { projectPath: path, owners: [] }; }
      origins[path]!.owners.push(node.owner);
    }
    for (const [alias, id] of Object.entries(node.definition.assets)) {
      const previous = aliases.get(alias.toLowerCase());
      if (previous) throw resolutionError('ASSET_BOUNDARY_VIOLATION', 'Asset alias collision', { path: alias, owners: ordered([previous, node.owner], keyOf) });
      aliases.set(alias.toLowerCase(), node.owner);
      const descriptor = node.assets[id]!, path = assetPath(node, id);
      assets[alias] = { mediaType: descriptor.mediaType, encoding: 'base64', data: originalBase64(state.files[path]!) };
      assetOrigins[alias] = { projectPath: path, assetId: assetIdSchema.parse(id), owner: node.owner };
    }
  }
  for (const origin of Object.values(origins)) ordered(origin.owners, keyOf);
  const source = { sdkVersion: root.definition.sdkVersion, entry: `${root.prefix}/${root.definition.entry}`, files };
  const envelope = root.definition.sourceVersion === 2 ? { sourceVersion: 2 as const, ...source, assets } : source;
  try { return freezeData({ sceneId, source: validateSource(envelope) as SourceBundle, origins, assetOrigins }); }
  catch (cause) {
    const e = cause as Error & { code?: string; path?: string };
    throw resolutionError(e.code === 'QUOTA_EXCEEDED' ? 'QUOTA_EXCEEDED' : 'SOURCE_BOUNDARY_VIOLATION', e.message, e.path ? { path: e.path } : {}, cause);
  }
}
function checkImports(scene: ResolvedProjectScene, owner: Node) {
  // This scene is the owner's own transitive closure, never its caller's union.
  for (const relative of owner.definition.files) {
    const file = `${owner.prefix}/${relative}`, text = scene.source.files[file]!;
    let ast;
    try { ast = parse(text, { sourceType: 'module', plugins: ['typescript'], errorRecovery: false }); }
    catch (cause) { throw resolutionError('COMPILE_FAILED', `Cannot parse ${file}: ${(cause as Error).message}`, { path: file, owners: [owner.owner] }, cause); }
    const stack: unknown[] = [ast.program];
    while (stack.length) {
      const value = stack.pop(); if (!value || typeof value !== 'object') continue;
      const node = value as Record<string, unknown>;
      if (['ImportExpression', 'TSImportType', 'TSImportEqualsDeclaration'].includes(node.type as string)) throw resolutionError('SOURCE_BOUNDARY_VIOLATION', 'Dynamic, import-type and import-equals forms are unsupported', { path: file, owners: [owner.owner] });
      if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type as string) && node.source) {
        const specifier = (node.source as { value: string }).value;
        if (!sdkMetadata.allowedImports.includes(specifier)) {
          const fail = () => resolutionError('SOURCE_BOUNDARY_VIOLATION', `Import is outside ${owner.key}'s declared closure: ${specifier}`, { path: file, owners: [owner.owner] });
          if (!(specifier.startsWith('./') || specifier.startsWith('../')) || !specifier.endsWith('.ts') || specifier.includes('\\')) throw fail();
          const parts = file.split('/').slice(0, -1);
          for (const segment of specifier.split('/')) {
            if (segment === '.') continue;
            if (segment === '..') { if (!parts.length) throw fail(); parts.pop(); }
            else { if (!segment) throw fail(); parts.push(segment); }
          }
          const target = parts.join('/');
          if (!Object.hasOwn(scene.source.files, target)) throw fail();
        }
      }
      for (const [key, child] of Object.entries(node)) if (!['loc', 'extra', 'comments', 'tokens'].includes(key)) {
        if (Array.isArray(child)) for (const item of child) stack.push(item);
        else if (child && typeof child === 'object') stack.push(child);
      }
    }
  }
}

/** Only enrich an already rejected input. This never returns admitted metadata. */
async function rejectionDetails(documents: Record<string, Uint8Array>): Promise<{ path?: string; owners?: ComponentRef[] }> {
  try {
    const read = <K extends Parameters<typeof validateMetadata>[0]>(path: string, kind: K) => validateMetadata(kind, parseMetadataJson(documents[path]!));
    const project = read('project.json', 'project'), assets = read('assets/manifest.json', 'assets'), lock = read('dependencies.lock.json', 'lock');
    const components: ProjectMetadata['components'] = Object.create(null), packages: ProjectMetadata['packages'] = Object.create(null);
    for (const [id, directory] of Object.entries(project.components)) {
      const component = read(`${directory}/component.json`, 'component');
      if (component.componentId !== id) return {};
      for (const path of component.files) sourcePath(`${directory}/${path}`);
      components[id] = component;
    }
    for (const [id, pin] of Object.entries(lock.packages)) {
      const pkg = read(`libraries/${pin.contentHash}/package.json`, 'package');
      if (pkg.packageId !== id || pkg.version !== pin.version || await hashMetadata('package', pkg) !== pin.manifestHash || await hashPackage(pkg, pkg.files) !== pin.contentHash) return {};
      packages[id] = pkg;
    }
    const nodes = graph({ project, assets, lock, components, packages, scenes: {} });
    for (const node of nodes.values()) {
      const aliases = new Map<string, ComponentRef>();
      for (const reachable of closure(nodes, node.owner)) for (const [alias, id] of Object.entries(reachable.definition.assets)) {
        if (!Object.hasOwn(reachable.assets, id)) return {};
        const previous = aliases.get(alias.toLowerCase());
        if (previous) return { path: alias, owners: ordered([previous, reachable.owner], keyOf) };
        aliases.set(alias.toLowerCase(), reachable.owner);
      }
    }
  } catch { /* Ownership cannot be established; retain the original rejection. */ }
  return {};
}

export async function prepareProjectResolution(input: ProjectResolutionInput, supportedToolchain: DependencyLock['toolchain']): Promise<ProjectResolutionSnapshot> {
  // Entire capture is synchronous, before metadata hashing can yield to the caller.
  const top = ownRecord(input, 2);
  if (Object.keys(top).sort().join(',') !== 'documents,files') throw resolutionError('PROJECT_INVALID', 'Expected exactly documents and files');
  const documents = captureBytes(ownRecord(top.documents, 3 + projectLimits.scenes + projectLimits.components + projectLimits.packages), metadataLimits.projectBytes);
  const files = captureBytes(ownRecord(top.files), projectLimits.authoredBytes + projectLimits.assetBytes + projectLimits.packageBytes);
  let installed: DependencyLock['toolchain'];
  try { installed = snapshotJsonData(supportedToolchain) as DependencyLock['toolchain']; }
  catch (cause) { throw resolutionError('PROJECT_INVALID', `Invalid trusted toolchain selection: ${(cause as Error).message}`, {}, cause); }
  let metadata: ProjectMetadata;
  try { metadata = await admitProjectMetadata(documents, installed); }
  catch (cause) { throw resolutionError('PROJECT_INVALID', `Project metadata rejected: ${(cause as Error).message}`, await rejectionDetails(documents), cause); }
  try { uniquePaths([...Object.keys(documents), ...Object.keys(files)]); }
  catch (cause) { throw resolutionError('PROJECT_INVALID', (cause as Error).message, {}, cause); }
  const expected = new Map<string, { kind: 'local' | 'asset' | 'package'; packageId?: string }>();
  for (const [id, component] of Object.entries(metadata.components)) for (const file of component.files) expected.set(`${metadata.project.components[id]}/${file}`, { kind: 'local' });
  for (const descriptor of Object.values(metadata.assets.assets)) expected.set(descriptor.path, { kind: 'asset' });
  let packageBytes = 0;
  for (const [id, pkg] of Object.entries(metadata.packages)) {
    const prefix = `libraries/${metadata.lock.packages[id]!.contentHash}`;
    packageBytes += documents[`${prefix}/package.json`]!.byteLength;
    for (const path of Object.keys(pkg.files)) {
      const fullPath = `${prefix}/${path}`; metadataPath(fullPath);
      if (Object.hasOwn(documents, fullPath) || expected.has(fullPath)) throw resolutionError('PROJECT_INVALID', 'Metadata/content or ownership overlap', { path: fullPath });
      expected.set(fullPath, { kind: 'package', packageId: id });
    }
  }
  for (const [path, owner] of expected) if (!Object.hasOwn(files, path)) {
    const pin = owner.packageId ? metadata.lock.packages[owner.packageId]! : undefined;
    throw resolutionError(pin ? 'DEPENDENCY_UNAVAILABLE' : 'CONTENT_MISSING', pin ? `Missing ${owner.packageId}@${pin.version} (${pin.contentHash}) original: ${path}` : `Missing project content: ${path}`, { path, ...(owner.packageId ? { packageId: owner.packageId } : {}) });
  }
  for (const path of Object.keys(files)) if (!expected.has(path)) {
    const pkg = Object.entries(metadata.lock.packages).find(([, pin]) => path.startsWith(`libraries/${pin.contentHash}/`));
    throw resolutionError(pkg ? 'PACKAGE_MODIFIED' : 'CONTENT_UNDECLARED', `Undeclared project content: ${path}`, { path, ...(pkg ? { packageId: pkg[0] } : {}) });
  }
  let authoredBytes = 0, assetBytes = 0;
  for (const [path, owner] of expected) {
    const bytes = files[path]!;
    if (owner.kind === 'local') authoredBytes += bytes.length;
    if (owner.kind === 'package') packageBytes += bytes.length;
    const header = new TextDecoder().decode(bytes.subarray(0, 1024));
    if (/^version https:\/\/git-lfs.github.com\/spec\/v1\r?\noid sha256:[a-f0-9]{64}\r?\nsize [0-9]+(?:\r?\n|$)/.test(header)) throw resolutionError(owner.kind === 'package' ? 'DEPENDENCY_UNAVAILABLE' : 'CONTENT_MISSING', `Required content is an unresolved Git LFS pointer: ${path}`, { path });
  }
  if (authoredBytes > projectLimits.authoredBytes || packageBytes > projectLimits.packageBytes) throw resolutionError('QUOTA_EXCEEDED', 'Project authored or vendored original-byte limit exceeded');
  // Verify packages sequentially; never retain all per-package payload copies.
  for (const [id, pkg] of Object.entries(metadata.packages)) {
    const pin = metadata.lock.packages[id]!, prefix = `libraries/${pin.contentHash}`;
    await verifyPackageBytes(pkg, pin, Object.fromEntries(Object.keys(pkg.files).map(path => [path, files[`${prefix}/${path}`]!])));
  }
  const assets = [ { prefix: '', records: metadata.assets.assets }, ...Object.entries(metadata.packages).map(([id, pkg]) => ({ prefix: `libraries/${metadata.lock.packages[id]!.contentHash}/`, records: pkg.assets })) ];
  for (const group of assets) for (const descriptor of Object.values(group.records)) assetBytes += files[`${group.prefix}${descriptor.path}`]!.length;
  if (assetBytes > projectLimits.assetBytes) throw resolutionError('QUOTA_EXCEEDED', 'Project asset original-byte limit exceeded');
  for (const group of assets) for (const descriptor of Object.values(group.records)) {
    const path = `${group.prefix}${descriptor.path}`, bytes = files[path]!;
    if (bytes.length !== descriptor.byteLength || await sha256(bytes) !== descriptor.sha256) throw resolutionError('ASSET_BOUNDARY_VIOLATION', `Asset original does not match descriptor: ${path}`, { path });
    const extension = descriptor.mediaType === 'image/bmp' ? 'bmp' : descriptor.mediaType === 'image/png' ? 'png' : 'jpg';
    try { await deriveAssets({ [`assets/check.${extension}`]: { mediaType: descriptor.mediaType, encoding: 'base64', data: originalBase64(bytes) } }, sha256); }
    catch (cause) { throw resolutionError((cause as { code?: string }).code === 'QUOTA_EXCEEDED' ? 'QUOTA_EXCEEDED' : 'ASSET_BOUNDARY_VIOLATION', `Invalid image original ${path}: ${(cause as Error).message}`, { path }, cause); }
  }
  const state: State = { metadata, files, nodes: graph(metadata), sceneKeys: Object.create(null) };
  // Validate all definitions, including unselected exports and unimported helpers.
  for (const node of state.nodes.values()) {
    if (node.definition.sdkVersion !== '0.1.0' && node.definition.sdkVersion !== '0.2.0') throw resolutionError('PROJECT_INVALID', 'Project v1 supports only SDK 0.1/0.2');
    const scene = assemble(state, node.owner, '' as SceneId); checkImports(scene, node);
  }
  const nodeKeys = new Map<string, unknown>();
  for (const node of state.nodes.values()) {
    const sourceHashes = [];
    for (const path of node.definition.files.map(p => `${node.prefix}/${p}`).sort()) sourceHashes.push([path, await sha256(files[path]!)]);
    const imageKeys = [];
    for (const [alias, id] of Object.entries(node.definition.assets).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
      imageKeys.push([alias, id, assetPath(node, id), await hashMetadata('assets', { schemaVersion: 1, assets: { [id]: node.assets[id] } })]);
    }
    nodeKeys.set(node.key, [node.key, node.prefix, node.package ? metadata.lock.packages[node.package.packageId] : await hashMetadata('component', metadata.components[(node.owner as { componentId: string }).componentId]), sourceHashes, imageKeys]);
  }
  const toolchainKey = await hashMetadata('lock', { schemaVersion: 1, toolchain: installed, packages: {} });
  for (const scene of Object.values(metadata.scenes)) state.sceneKeys[scene.sceneId] = JSON.stringify([toolchainKey, metadata.project.scenes[scene.sceneId], await hashMetadata('scene', scene), closure(state.nodes, scene.implementation).map(n => nodeKeys.get(n.key))]);
  const token = Object.freeze({}) as ProjectResolutionSnapshot; snapshots.set(token, state); return token;
}
function stateOf(snapshot: ProjectResolutionSnapshot): State {
  const state = snapshots.get(snapshot);
  if (!state) throw resolutionError('PROJECT_INVALID', 'Expected a snapshot issued by this resolver');
  return state;
}
export function resolveProject(snapshot: ProjectResolutionSnapshot, sceneId: SceneId): ResolvedProjectScene {
  const state = stateOf(snapshot), scene = state.metadata.scenes[sceneId];
  if (!scene) throw resolutionError('UNKNOWN_SCENE', `Unknown exact scene ID: ${sceneId}`);
  return assemble(state, scene.implementation, sceneId);
}
export function affectedScenes(base: ProjectResolutionSnapshot, next: ProjectResolutionSnapshot): readonly SceneId[] {
  const a = stateOf(base), b = stateOf(next);
  if (a.metadata.project.projectId !== b.metadata.project.projectId) throw resolutionError('PROJECT_ID_MISMATCH', 'Cannot compare different project identities');
  return Object.freeze([...new Set([...Object.keys(a.sceneKeys), ...Object.keys(b.sceneKeys)])].sort().filter(id => a.sceneKeys[id] !== b.sceneKeys[id]) as SceneId[]);
}
export function mapProjectDiagnostic(scene: ResolvedProjectScene, diagnostic: CompileDiagnostic): ProjectDiagnostic {
  const copy = { ...snapshotJsonData(diagnostic) as CompileDiagnostic };
  const origin = copy.file && Object.hasOwn(scene.origins, copy.file) ? structuredClone(scene.origins[copy.file]!) : undefined;
  return freezeData({ diagnostic: copy, ...(origin ? { origin } : {}) });
}
