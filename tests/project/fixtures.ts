import { sceneControlSnapshot, createSceneDocument } from '../../packages/core/src/scene-document.ts';
import { canonicalControlSchemaJson, normalizeControlSchema } from '../../packages/runtime-contracts/src/parameters.mjs';
import { createHash } from 'node:crypto';

export const ids = {
  project: '10000000-0000-4000-8000-000000000001',
  a: '20000000-0000-4000-8000-000000000001', b: '20000000-0000-4000-8000-000000000002', c: '20000000-0000-4000-8000-000000000003',
  shared: '30000000-0000-4000-8000-000000000001', helper: '30000000-0000-4000-8000-000000000002', unique: '30000000-0000-4000-8000-000000000003',
  asset: '40000000-0000-4000-8000-000000000001',
};
export const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
export const h = 'a'.repeat(64);
export const settings = { width: 640, height: 360, fps: 60, seed: 42 };
export const legacySource = { sdkVersion: '0.1.0' as const, entry: 'src/main.ts', files: { 'src/main.ts': 'export const legacy = 1;\n' } };
export const controlsSource = { sdkVersion: '0.2.0' as const, sourceVersion: 2 as const, entry: 'src/main.ts', files: { 'src/main.ts': 'export const controls = 1;\n' }, assets: {} };
export const controlSchema = normalizeControlSchema([{ id: 'speed', type: 'number', label: 'Speed', default: 1, min: 0, max: 4, unit: 'Hz', changeCost: 'live' }]);
export const savedControls = { sourceHash: h, schema: controlSchema, schemaHash: hash(canonicalControlSchemaJson(controlSchema)), values: { speed: 1 } };
export const toolchain = { sdkVariants: { '0.1.0': { declarationEntry: 'sdk/index.d.ts', contractHash: h }, '0.2.0': { declarationEntry: 'sdk/v2.d.ts', contractHash: h } }, typescriptVersion: '7.0.2', threeVersion: '0.186.0', threeTypesVersion: '0.186.0', declarationPackHash: h, runtimeBuildHash: h };
export function fixture() {
  const local = (componentId: string) => ({ kind: 'local' as const, componentId });
  const definition = (componentId: string, name: string) => ({ schemaVersion: 1 as const, componentId, name, kind: 'code' as const, sdkVersion: '0.2.0' as '0.1.0' | '0.2.0', sourceVersion: 2 as 1 | 2, entry: 'src/main.ts', files: ['src/main.ts', 'src/nested/noise.ts'], references: [] as ({ kind: 'local'; componentId: string } | { kind: 'package'; packageId: string; exportId: string })[], assets: {} as Record<string, string> });
  const shared = definition(ids.shared, 'Particles');
  shared.references.push(local(ids.helper), { kind: 'package', packageId: 'demo/noise', exportId: 'noise' });
  shared.assets['assets/spark.png'] = ids.asset;
  const helper = definition(ids.helper, 'Helper');
  const unique = definition(ids.unique, 'Unique');
  const project = { format: 'lux-project' as const, schemaVersion: 1 as const, projectId: ids.project, name: 'Set', scenes: { [ids.a]: 'scenes/a', [ids.b]: 'scenes/b', [ids.c]: 'scenes/c' }, components: { [ids.shared]: 'components/particles', [ids.helper]: 'components/helper', [ids.unique]: 'components/unique' } };
  const scene = (sceneId: string, name: string, componentId: string, speed: number) => ({ schemaVersion: 1 as const, sceneId, name, implementation: local(componentId) as ReturnType<typeof local> | { kind: 'package'; packageId: string; exportId: string }, settings, savedControls: { ...savedControls, values: { speed } } });
  const scenes = [scene(ids.a, 'A', ids.shared, 1), scene(ids.b, 'B', ids.shared, 2), scene(ids.c, 'C', ids.unique, 3)];
  const assets = { schemaVersion: 1 as const, assets: { [ids.asset]: { path: `assets/files/${ids.asset}/spark.png`, mediaType: 'image/png' as const, sha256: h, byteLength: 100, interpretation: { colorSpace: 'srgb' as const, alpha: 'straight' as const }, provenance: { prompt: 'a spark', seed: '42', attribution: 'fixture', referenceAssetIds: [] as string[] } } } };
  const pkg = { format: 'lux-package' as const, schemaVersion: 1 as const, packageId: 'demo/noise', version: '1.2.3', sdkRange: '0.1.0 || 0.2.0' as const, exports: { noise: { kind: 'code' as const, sdkVersion: '0.2.0' as '0.1.0' | '0.2.0', sourceVersion: 2 as 1 | 2, entry: 'src/main.ts', files: ['src/main.ts'], references: [] as typeof shared.references, assets: {} as Record<string, string> } }, files: { 'src/main.ts': h }, assets: {}, dependencies: {} };
  const lock = { schemaVersion: 1 as const, toolchain, packages: {} as Record<string, { version: string; manifestHash: string; contentHash: string }> };
  return structuredClone({ project, scenes, components: [shared, helper, unique], assets, pkg, lock });
}
// Independently specified canonical metadata/package bodies, not production helpers.
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function documents(f = fixture()): Record<string, Uint8Array> {
  const manifestHash = hash(canonicalJson(['lux-project-metadata', 1, 'package', f.pkg]));
  const contentHash = hash(canonicalJson(['lux-project-package', 1, f.pkg, Object.entries(f.pkg.files).sort()]));
  f.lock.packages[f.pkg.packageId] = { version: f.pkg.version, manifestHash, contentHash };
  const result: Record<string, unknown> = { 'project.json': f.project, 'assets/manifest.json': f.assets, 'dependencies.lock.json': f.lock, [`libraries/${contentHash}/package.json`]: f.pkg };
  for (const scene of f.scenes) result[`${f.project.scenes[scene.sceneId as keyof typeof f.project.scenes]}/scene.json`] = scene;
  for (const component of f.components) result[`${f.project.components[component.componentId as keyof typeof f.project.components]}/component.json`] = component;
  return Object.fromEntries(Object.entries(result).map(([path, value]) => [path, new TextEncoder().encode(JSON.stringify(value))]));
}
export async function legacyControls() { return sceneControlSnapshot(createSceneDocument(legacySource, settings, { intensity: 0.5 })); }
