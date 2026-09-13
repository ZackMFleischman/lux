import { z } from 'zod';
import { hashSchema, outputSettingsSchema, sourceSdkVersionSchema } from '../../../runtime-contracts/src/index.ts';
import { projectIdSchema, sceneIdSchema, componentIdSchema, assetIdSchema } from '../../../runtime-contracts/src/identities.ts';
import { validateSavedControlSnapshot, verifySavedControlSnapshot, sceneHash } from '../scene-document.ts';
import type { SavedControlSnapshot } from '../scene-document.ts';
import { assetLimits } from '../../../assets/src/index.mjs';
import { metadataLimits, parseMetadataJson, snapshotJsonData, byteRecord } from './bounded-json.ts';
import { metadataPath, sourcePath, logicalAssetPath, uniquePaths } from './metadata-paths.ts';

export { metadataLimits, parseMetadataJson };
export type SavedControlIntent = SavedControlSnapshot;
export type Hash = z.infer<typeof hashSchema>;
export const projectLimits = Object.freeze({ scenes: 8, components: 32, authoredFiles: 256, authoredBytes: 8388608, assets: 64, assetBytes: 16777216, packages: 16, packageBytes: 33554432, closureFiles: 32, closureSourceBytes: 1048576 });
const exactVersion = z.string().regex(/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/);
const packageId = z.string().regex(/^[a-z][a-z0-9-]{0,63}\/[a-z][a-z0-9-]{0,63}$/);
const exportId = z.string().regex(/^[a-z][A-Za-z0-9_]{0,63}$/);
const path = z.string().transform(metadataPath);
const modulePath = z.string().transform(sourcePath);
const assetPath = z.string().transform(logicalAssetPath);
const name = z.string().min(1);
// Record keys validate UUID syntax; entity values retain neutral UUID brands.
const uuidKey = z.string().uuid();
const pin = z.object({ version: exactVersion, manifestHash: hashSchema, contentHash: hashSchema }).strict();
const pins = z.record(packageId, pin).superRefine((value, context) => {
  if (Object.keys(value).length > projectLimits.packages) context.addIssue({ code: 'custom', message: 'Package count limit exceeded' });
});
const ref = z.discriminatedUnion('kind', [z.object({ kind: z.literal('local'), componentId: componentIdSchema }).strict(), z.object({ kind: z.literal('package'), packageId, exportId }).strict()]);
const sourceFields = {
  kind: z.literal('code'), sdkVersion: sourceSdkVersionSchema, sourceVersion: z.union([z.literal(1), z.literal(2)]), entry: modulePath,
  files: z.array(modulePath).min(1).max(projectLimits.closureFiles), references: z.array(ref), assets: z.record(assetPath, assetIdSchema),
};
function checkDefinition(value: { entry: string; files: string[]; sourceVersion: number; assets: Record<string, string>; references: z.infer<typeof ref>[] }) {
  uniquePaths(value.files);
  uniquePaths(Object.keys(value.assets));
  if (!value.files.includes(value.entry)) throw Error('Definition entry must be in files');
  if (value.sourceVersion === 1 && Object.keys(value.assets).length) throw Error('Legacy v1 definition cannot contain assets');
  const refs = value.references.map(reference => reference.kind === 'local' ? `local:${reference.componentId.toLowerCase()}` : `package:${reference.packageId}:${reference.exportId}`);
  if (new Set(refs).size !== refs.length) throw Error('Duplicate definition reference');
  return value;
}
const code = z.object(sourceFields).strict().superRefine(value => { checkDefinition(value); });
const component = z.object({ schemaVersion: z.literal(1), componentId: componentIdSchema, name, ...sourceFields }).strict().superRefine(value => { checkDefinition(value); });
const scene = z.object({ schemaVersion: z.literal(1), sceneId: sceneIdSchema, name, implementation: ref, settings: outputSettingsSchema, savedControls: z.unknown().transform(validateSavedControlSnapshot) }).strict();
const project = z.object({ format: z.literal('lux-project'), schemaVersion: z.literal(1), projectId: projectIdSchema, name, scenes: z.record(uuidKey, path), components: z.record(uuidKey, path) }).strict().superRefine(value => {
  const scenes = Object.values(value.scenes), components = Object.values(value.components);
  if (scenes.length > projectLimits.scenes || components.length > projectLimits.components) throw Error('Project entity count limit exceeded');
  for (const [namespace, paths] of [['scenes', scenes], ['components', components]] as const) {
    for (const entry of paths) {
      if (!entry.startsWith(`${namespace}/`) || entry.split('/').some(segment => segment.includes('.'))) throw Error('Registry path is outside its directory namespace');
      metadataPath(`${entry}/${namespace === 'scenes' ? 'scene' : 'component'}.json`);
    }
    uniquePaths(paths, true);
  }
});
const asset = z.object({
  path, mediaType: z.enum(['image/bmp', 'image/png', 'image/jpeg']), sha256: hashSchema, byteLength: z.number().int().positive().max(assetLimits.imageBytes),
  interpretation: z.object({ colorSpace: z.literal('srgb'), alpha: z.literal('straight') }).strict(),
  provenance: z.object({ source: z.string().optional(), prompt: z.string().optional(), model: z.string().optional(), seed: z.string().optional(), referenceAssetIds: z.array(assetIdSchema).optional(), attribution: z.string().optional() }).strict().optional(),
}).strict();
const assetRecords = z.record(uuidKey, asset).superRefine(value => {
  if (Object.keys(value).length > projectLimits.assets) throw Error('Project asset count limit exceeded');
  uniquePaths(Object.values(value).map(entry => entry.path));
  for (const [id, entry] of Object.entries(value)) {
    if (!entry.path.startsWith(`assets/files/${id}/`)) throw Error('Asset path must belong to its stable ID');
    const extension = entry.path.split('.').at(-1);
    if (!(entry.mediaType === 'image/bmp' && extension === 'bmp' || entry.mediaType === 'image/png' && extension === 'png' || entry.mediaType === 'image/jpeg' && (extension === 'jpg' || extension === 'jpeg'))) throw Error('Asset media type and extension mismatch');
  }
});
const assets = z.object({ schemaVersion: z.literal(1), assets: assetRecords }).strict();
const toolchain = z.object({
  sdkVariants: z.record(z.string().refine(value => sourceSdkVersionSchema.safeParse(value).success), z.object({ declarationEntry: path, contractHash: hashSchema }).strict()),
  typescriptVersion: exactVersion, threeVersion: exactVersion, threeTypesVersion: exactVersion, declarationPackHash: hashSchema, runtimeBuildHash: hashSchema,
}).strict().superRefine(value => {
  if (!Object.keys(value.sdkVariants).length) throw Error('Toolchain must declare a supported SDK');
  uniquePaths(Object.values(value.sdkVariants).map(variant => variant.declarationEntry));
});
const lock = z.object({ schemaVersion: z.literal(1), toolchain, packages: pins }).strict();
const packageManifest = z.object({ format: z.literal('lux-package'), schemaVersion: z.literal(1), packageId, version: exactVersion, sdkRange: z.enum(['0.1.0', '0.2.0', '0.1.0 || 0.2.0']), exports: z.record(exportId, code), files: z.record(path, hashSchema), assets: assetRecords, dependencies: pins }).strict().superRefine(value => {
  uniquePaths(Object.keys(value.files));
  if (!Object.keys(value.exports).length) throw Error('Package must declare an export');
  const assetFiles = new Map(Object.values(value.assets).map(entry => [entry.path, entry]));
  for (const [file, hash] of Object.entries(value.files)) {
    const descriptor = assetFiles.get(file);
    if (descriptor) { if (descriptor.sha256 !== hash) throw Error('Package asset file hash mismatch'); }
  }
  for (const descriptor of assetFiles.values()) if (value.files[descriptor.path] !== descriptor.sha256) throw Error('Package asset missing from file inventory');
  for (const definition of Object.values(value.exports)) {
    if (!value.sdkRange.split(' || ').includes(definition.sdkVersion)) throw Error('Export SDK outside package range');
    for (const file of definition.files) if (!Object.hasOwn(value.files, file)) throw Error('Export file missing from package inventory');
    for (const reference of definition.references) if (reference.kind === 'local') throw Error('Package cannot reference project local definitions');
  }
});

// Every exported schema snapshots own data before Zod can read caller fields.
export const componentRefSchema = z.preprocess(snapshotJsonData, ref);
export const projectManifestSchema = z.preprocess(snapshotJsonData, project);
export const sceneFileSchema = z.preprocess(snapshotJsonData, scene);
export const componentFileSchema = z.preprocess(snapshotJsonData, component);
export const assetManifestSchema = z.preprocess(snapshotJsonData, assets);
export const dependencyLockSchema = z.preprocess(snapshotJsonData, lock);
export const packageManifestSchema = z.preprocess(snapshotJsonData, packageManifest);
export const codeExportSchema = z.preprocess(snapshotJsonData, code);
export type ComponentRef = z.infer<typeof componentRefSchema>;
export type ProjectManifest = z.infer<typeof projectManifestSchema>;
export type SceneFile = z.infer<typeof sceneFileSchema>;
export type ComponentFile = z.infer<typeof componentFileSchema>;
export type AssetManifest = z.infer<typeof assetManifestSchema>;
export type DependencyLock = z.infer<typeof dependencyLockSchema>;
export type PackageManifest = z.infer<typeof packageManifestSchema>;
export type CodeExport = z.infer<typeof codeExportSchema>;
const schemas = { project: projectManifestSchema, scene: sceneFileSchema, component: componentFileSchema, assets: assetManifestSchema, lock: dependencyLockSchema, package: packageManifestSchema };
export type MetadataKind = keyof typeof schemas;
export type MetadataOf<K extends MetadataKind> = z.infer<(typeof schemas)[K]>;
/** Shape/relationship checks within one document. Full admission verifies caches. */
export function validateMetadata<K extends MetadataKind>(kind: K, input: unknown): MetadataOf<K> { return schemas[kind].parse(input) as MetadataOf<K>; }

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical((value as Record<string, unknown>)[key])]));
  return Object.is(value, -0) ? 0 : value;
}
/** Semantic identity, not raw-file identity or the compiler's sourceHash. */
export async function hashMetadata<K extends MetadataKind>(kind: K, input: unknown): Promise<Hash> {
  const value = validateMetadata(kind, input);
  if (kind === 'scene') await verifySavedControlSnapshot((value as SceneFile).savedControls);
  return sceneHash(JSON.stringify(['lux-project-metadata', 1, kind, canonical(value)]));
}
async function rawHash(bytes: Uint8Array): Promise<Hash> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
/** Hashes exactly supplied raw inventory bytes; does not attest completeness. */
export async function hashInventory(input: Record<string, Uint8Array>): Promise<Hash> {
  const files = byteRecord(input);
  uniquePaths(Object.keys(files));
  const entries = await Promise.all(Object.keys(files).sort().map(async path => [path, await rawHash(files[path]!)]));
  return sceneHash(JSON.stringify(['lux-project-inventory', 1, entries]));
}
/** Computes identity from declared hashes, not evidence of actual vendored bytes. */
export async function hashPackage(input: unknown, inventory: unknown): Promise<Hash> {
  const manifest = validateMetadata('package', input);
  const files = z.record(path, hashSchema).parse(snapshotJsonData(inventory));
  uniquePaths(Object.keys(files));
  if (JSON.stringify(canonical(files)) !== JSON.stringify(canonical(manifest.files))) throw Error('Package file inventory mismatch');
  return sceneHash(JSON.stringify(['lux-project-package', 1, canonical(manifest), Object.keys(files).sort().map(path => [path, files[path]])]));
}

export type ProjectMetadata = Readonly<{ project: ProjectManifest; scenes: Record<string, SceneFile>; components: Record<string, ComponentFile>; assets: AssetManifest; lock: DependencyLock; packages: Record<string, PackageManifest> }>;

/** Admit only metadata supplied as raw documents. No source reads, decoder or execution.
 * supportedToolchain is the caller's installed, verified selection; never read it
 * from the project and pass it back as evidence of local toolchain availability.
 */
export async function admitProjectMetadata(input: Record<string, Uint8Array>, supportedToolchain: DependencyLock['toolchain']): Promise<ProjectMetadata> {
  const documents = byteRecord(input, metadataLimits.projectBytes);
  uniquePaths(Object.keys(documents));
  if (Object.values(documents).reduce((total, bytes) => total + bytes.byteLength, 0) > metadataLimits.projectBytes) throw Error('Project metadata byte limit exceeded');
  const used = new Set<string>();
  function read<K extends MetadataKind>(path: string, kind: K): MetadataOf<K> {
    const bytes = documents[path];
    if (!bytes) throw Error(`Missing ${kind} metadata: ${path}`);
    used.add(path);
    return validateMetadata(kind, parseMetadataJson(bytes));
  }
  const project = read('project.json', 'project'), assets = read('assets/manifest.json', 'assets'), lock = read('dependencies.lock.json', 'lock');
  const installed = toolchain.parse(snapshotJsonData(supportedToolchain));
  if (JSON.stringify(canonical(installed)) !== JSON.stringify(canonical(lock.toolchain))) throw Error('Unsupported toolchain selection');
  const scenes: Record<string, SceneFile> = Object.create(null), components: Record<string, ComponentFile> = Object.create(null), packages: Record<string, PackageManifest> = Object.create(null);
  const identities = new Set<string>();
  function identity(id: string) { if (identities.has(id.toLowerCase())) throw Error('Duplicate UUID identity'); identities.add(id.toLowerCase()); }
  identity(project.projectId);
  for (const [id, directory] of Object.entries(project.scenes)) {
    identity(id); const scene = read(`${directory}/scene.json`, 'scene');
    if (scene.sceneId !== id) throw Error('Scene ID/registry mismatch');
    scenes[id] = scene;
  }
  let authoredFiles = 0;
  for (const [id, directory] of Object.entries(project.components)) {
    identity(id); const component = read(`${directory}/component.json`, 'component');
    if (component.componentId !== id) throw Error('Component ID/registry mismatch');
    for (const file of component.files) sourcePath(`${directory}/${file}`);
    authoredFiles += component.files.length; components[id] = component;
  }
  if (authoredFiles > projectLimits.authoredFiles) throw Error('Authored source file count limit exceeded');
  for (const [id, pin] of Object.entries(lock.packages)) {
    const manifest = read(`libraries/${pin.contentHash}/package.json`, 'package');
    if (manifest.packageId !== id || manifest.version !== pin.version) throw Error('Package pin identity/version mismatch');
    if (await hashMetadata('package', manifest) !== pin.manifestHash || await hashPackage(manifest, manifest.files) !== pin.contentHash) throw Error('Package pin hash mismatch');
    for (const file of Object.keys(manifest.files)) metadataPath(`libraries/${pin.contentHash}/${file}`);
    packages[id] = manifest;
  }
  if (used.size !== Object.keys(documents).length) throw Error('Unknown or unregistered metadata document');
  const assetOwners = [assets.assets, ...Object.values(packages).map(pkg => pkg.assets)];
  let assetCount = 0, assetBytes = 0;
  for (const records of assetOwners) {
    for (const [id, descriptor] of Object.entries(records)) {
      identity(id); assetCount++; assetBytes += descriptor.byteLength;
      for (const reference of descriptor.provenance?.referenceAssetIds ?? []) if (!Object.hasOwn(records, reference)) throw Error('Unknown provenance asset ID');
    }
  }
  if (assetCount > projectLimits.assets || assetBytes > projectLimits.assetBytes) throw Error('Project asset quota exceeded');
  for (const pkg of Object.values(packages)) for (const [id, pin] of Object.entries(pkg.dependencies)) {
    if (!Object.hasOwn(lock.packages, id) || JSON.stringify(canonical(pin)) !== JSON.stringify(canonical(lock.packages[id]))) throw Error('Missing or mismatched package dependency pin');
  }
  checkPackageCycles(packages);
  validateClosures({ project, scenes, components, assets, lock, packages });
  for (const scene of Object.values(scenes)) await verifySavedControlSnapshot(scene.savedControls);
  return { project, scenes, components, assets, lock, packages };
}

function checkPackageCycles(packages: Record<string, PackageManifest>) {
  const active = new Set<string>(), done = new Set<string>();
  function visit(id: string) {
    if (active.has(id)) throw Error('Package dependency cycle');
    if (done.has(id)) return;
    active.add(id);
    for (const dependency of Object.keys(packages[id]!.dependencies)) visit(dependency);
    active.delete(id); done.add(id);
  }
  for (const id of Object.keys(packages)) visit(id);
}

function validateClosures(metadata: ProjectMetadata) {
  const { project, components, packages, lock, assets, scenes } = metadata;
  type Node = { key: string; definition: CodeExport; assetRecords: AssetManifest['assets']; prefix: string; package?: PackageManifest };
  function resolve(reference: ComponentRef, owner?: PackageManifest): Node {
    if (reference.kind === 'local') {
      if (owner) throw Error('Package references cannot escape to local definitions');
      const definition = components[reference.componentId];
      if (!definition) throw Error('Unknown local component reference');
      return { key: `local:${reference.componentId}`, definition, assetRecords: assets.assets, prefix: project.components[reference.componentId]! };
    }
    const pkg = packages[reference.packageId];
    if (!pkg || !Object.hasOwn(pkg.exports, reference.exportId)) throw Error('Unknown package/export reference');
    if (owner && reference.packageId !== owner.packageId && !Object.hasOwn(owner.dependencies, reference.packageId)) throw Error('Undeclared package dependency reference');
    return { key: `package:${reference.packageId}:${reference.exportId}`, definition: pkg.exports[reference.exportId]!, assetRecords: pkg.assets, prefix: `libraries/${lock.packages[reference.packageId]!.contentHash}`, package: pkg };
  }
  function closure(root: Node) {
    const active = new Set<string>(), done = new Set<string>(), files = new Set<string>(), aliases = new Set<string>();
    let originalBytes = 0;
    function visit(node: Node) {
      if (active.has(node.key)) throw Error('Component reference cycle');
      if (done.has(node.key)) return;
      const definition = node.definition;
      if (!Object.hasOwn(lock.toolchain.sdkVariants, definition.sdkVersion)) throw Error('Missing SDK toolchain variant');
      if (definition.sdkVersion !== root.definition.sdkVersion) throw Error('Mixed SDK reference closure');
      active.add(node.key);
      for (const file of definition.files) files.add(sourcePath(`${node.prefix}/${file}`));
      for (const [alias, id] of Object.entries(definition.assets)) {
        const descriptor = node.assetRecords[id];
        if (!descriptor) throw Error('Unknown asset binding ID');
        if (aliases.has(alias.toLowerCase())) throw Error('Asset alias collision across reference closure');
        aliases.add(alias.toLowerCase());
        const extension = alias.split('.').at(-1);
        if (!(descriptor.mediaType === 'image/bmp' && extension === 'bmp' || descriptor.mediaType === 'image/png' && extension === 'png' || descriptor.mediaType === 'image/jpeg' && (extension === 'jpg' || extension === 'jpeg'))) throw Error('Asset alias media type mismatch');
        // Compiler quotas count every logical image binding, even shared pixels.
        originalBytes += descriptor.byteLength;
      }
      for (const reference of definition.references) visit(resolve(reference, node.package));
      active.delete(node.key); done.add(node.key);
    }
    visit(root);
    uniquePaths([...files]);
    if (aliases.size && root.definition.sourceVersion !== 2) throw Error('Legacy v1 entry cannot acquire an asset closure');
    if (files.size > projectLimits.closureFiles || aliases.size > assetLimits.count || originalBytes > assetLimits.totalBytes) throw Error('Scene closure quota exceeded');
  }
  // Unused managed definitions/exports are validated too; scenes may use either SDK.
  for (const id of Object.keys(components)) closure(resolve({ kind: 'local', componentId: componentIdSchema.parse(id) }));
  for (const pkg of Object.values(packages)) for (const exportId of Object.keys(pkg.exports)) closure(resolve({ kind: 'package', packageId: pkg.packageId, exportId }));
  for (const scene of Object.values(scenes)) closure(resolve(scene.implementation));
}
