import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { ProjectManifest, SceneFile, ComponentFile, AssetManifest, DependencyLock, PackageManifest, CodeExport } from '../../packages/core/src/project/contracts.ts';
import { projectIdSchema, componentIdSchema, sceneIdSchema, assetIdSchema } from '../../packages/runtime-contracts/src/identities.ts';
import { savedControls, settings, toolchain } from './fixtures.ts';
import { encode as encodePng } from 'fast-png';

export const bytes = (text: string) => new TextEncoder().encode(text);
export const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export const ids = {
  project: projectIdSchema.parse('11000000-0000-4000-8000-000000000001'),
  a: sceneIdSchema.parse('22000000-0000-4000-8000-000000000001'), b: sceneIdSchema.parse('22000000-0000-4000-8000-000000000002'), c: sceneIdSchema.parse('22000000-0000-4000-8000-000000000003'),
  A: componentIdSchema.parse('33000000-0000-4000-8000-000000000001'), B: componentIdSchema.parse('33000000-0000-4000-8000-000000000002'), H: componentIdSchema.parse('33000000-0000-4000-8000-000000000003'), U: componentIdSchema.parse('33000000-0000-4000-8000-000000000004'),
  image: assetIdSchema.parse('44000000-0000-4000-8000-000000000001'),
};
export const local = (componentId: typeof ids.A) => ({ kind: 'local' as const, componentId });
export const fixtureText = (name: string) => readFileSync(new URL(`../fixtures/project/resolver/${name}.ts.txt`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
export function definition(): CodeExport {
  return { kind: 'code', sdkVersion: '0.2.0', sourceVersion: 2, entry: 'src/main.ts', files: ['src/main.ts'], references: [], assets: {} };
}
export function bmp(width = 1, height = 1): Uint8Array {
  const stride = Math.ceil(width * 3 / 4) * 4, data = new Uint8Array(54 + stride * height), view = new DataView(data.buffer);
  data.set([0x42, 0x4d]); view.setUint32(2, data.length, true); view.setUint32(10, 54, true); view.setUint32(14, 40, true);
  view.setInt32(18, width, true); view.setInt32(22, height, true); view.setUint16(26, 1, true); view.setUint16(28, 24, true);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data[54 + stride * y + x * 3 + 2] = 255;
  return data;
}
/** Valid 1x1 PNG with a bounded inert tEXt chunk, used for exact-byte boundaries. */
export function paddedPng(length: number): Uint8Array {
  const base = encodePng({ width: 1, height: 1, data: new Uint8Array([255, 0, 0, 255]), channels: 4, depth: 8 });
  const size = length - base.length - 12;
  if (size < 8 || size > 65536) throw Error('Requested PNG padding exceeds fixture bounds');
  const chunk = new Uint8Array(size + 12), view = new DataView(chunk.buffer);
  view.setUint32(0, size); chunk.set(bytes('tEXt'), 4); chunk.set(bytes('Padding\0'), 8); chunk.fill(32, 16, size + 8);
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, size + 8)) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  view.setUint32(size + 8, (crc ^ 0xffffffff) >>> 0);
  const result = new Uint8Array(length); result.set(base.subarray(0, 33)); result.set(chunk, 33); result.set(base.subarray(33), 33 + chunk.length); return result;
}
export function imageDescriptor(data = bmp(), id = ids.image, extension = 'bmp', mediaType: 'image/bmp' | 'image/png' | 'image/jpeg' = 'image/bmp'): AssetManifest['assets'][string] {
  return { path: `assets/files/${id}/image.${extension}`, mediaType, sha256: hash(data), byteLength: data.length, interpretation: { colorSpace: 'srgb', alpha: 'straight' } };
}
export function pinFor(manifest: PackageManifest): DependencyLock['packages'][string] {
  return { version: manifest.version, manifestHash: hash(canonical(['lux-project-metadata', 1, 'package', manifest])), contentHash: hash(canonical(['lux-project-package', 1, manifest, Object.entries(manifest.files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)])) };
}
export function packageFixture(sdk: '0.1.0' | '0.2.0' = '0.2.0') {
  const files: Record<string, Uint8Array> = { 'src/main.ts': bytes(fixtureText(sdk === '0.1.0' ? 'entry-v1' : 'entry-v2')), 'src/helper.ts': bytes(fixtureText('helper-valid')), 'LICENSE.txt': bytes('Resolver fixture license\n') };
  const entry = definition(); entry.sdkVersion = sdk; entry.sourceVersion = sdk === '0.1.0' ? 1 : 2; entry.files.push('src/helper.ts');
  const manifest: PackageManifest = { format: 'lux-package', schemaVersion: 1, packageId: 'demo/pattern', version: '1.2.3', sdkRange: '0.1.0 || 0.2.0', exports: { main: entry }, files: Object.fromEntries(Object.entries(files).map(([p, b]) => [p, hash(b)])), assets: {}, dependencies: {} };
  return { manifest, files, pin: pinFor(manifest) };
}
export type Model = { project: ProjectManifest; scenes: SceneFile[]; components: ComponentFile[]; assets: AssetManifest; lock: DependencyLock; files: Record<string, Uint8Array>; packages: ReturnType<typeof packageFixture>[] };
export function model(): Model {
  const components = [ids.A, ids.B, ids.H, ids.U].map((componentId, i) => ({ ...definition(), schemaVersion: 1 as const, componentId, name: ['A', 'B', 'Helper', 'Independent'][i]! }));
  components[0]!.references = [local(ids.H)]; components[1]!.references = [local(ids.H)]; components[2]!.entry = 'src/helper.ts'; components[2]!.files = ['src/helper.ts'];
  const project: ProjectManifest = { format: 'lux-project', schemaVersion: 1, projectId: ids.project, name: 'Resolver', scenes: { [ids.a]: 'scenes/a', [ids.b]: 'scenes/b', [ids.c]: 'scenes/c' }, components: { [ids.A]: 'components/a', [ids.B]: 'components/b', [ids.H]: 'components/helper', [ids.U]: 'components/u' } };
  const scenes: SceneFile[] = [ids.a, ids.b, ids.c].map((sceneId, i) => ({ schemaVersion: 1, sceneId, name: String(i), implementation: local([ids.A, ids.B, ids.U][i]!), settings: structuredClone(settings), savedControls: structuredClone(savedControls) }));
  const main = fixtureText('entry-v2').replace("'./helper.ts'", "'../../helper/src/helper.ts'");
  return { project, scenes, components, assets: { schemaVersion: 1, assets: {} }, lock: { schemaVersion: 1, toolchain: structuredClone(toolchain), packages: {} }, files: { 'components/a/src/main.ts': bytes(main), 'components/b/src/main.ts': bytes(main), 'components/helper/src/helper.ts': bytes(fixtureText('helper-valid')), 'components/u/src/main.ts': bytes('export const independent = 1;\n') }, packages: [] };
}
export function inputFor(m: Model) {
  const documents: Record<string, Uint8Array> = {}, files = { ...m.files };
  const put = (path: string, value: unknown) => { documents[path] = bytes(JSON.stringify(value)); };
  const lock = structuredClone(m.lock);
  for (const pkg of m.packages) {
    const pin = pinFor(pkg.manifest); lock.packages[pkg.manifest.packageId] = pin;
    put(`libraries/${pin.contentHash}/package.json`, pkg.manifest);
    for (const [p, b] of Object.entries(pkg.files)) files[`libraries/${pin.contentHash}/${p}`] = b;
  }
  put('project.json', m.project); put('assets/manifest.json', m.assets); put('dependencies.lock.json', lock);
  for (const scene of m.scenes) put(`${m.project.scenes[scene.sceneId]}/scene.json`, scene);
  for (const component of m.components) put(`${m.project.components[component.componentId]}/component.json`, component);
  return { documents, files };
}
export function resolutionFixture() {
  const m = model(), input = inputFor(m), helperPath = 'components/helper/src/helper.ts';
  const change = (path: string, value: Uint8Array) => ({ documents: structuredClone(input.documents), files: { ...structuredClone(input.files), [path]: value } });
  return { m, input, supportedToolchain: structuredClone(toolchain), sceneA: ids.a, sceneB: ids.b, sceneC: ids.c, helperPath, change, typeErrorInput: () => change(helperPath, bytes(fixtureText('helper-type-error'))) };
}
