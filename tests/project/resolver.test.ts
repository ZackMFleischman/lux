import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareProjectResolution, resolveProject, affectedScenes, mapProjectDiagnostic } from '../../packages/core/src/project/resolver.ts';
import { resolutionFixture, ids, bytes, model, inputFor, packageFixture, pinFor, hash, bmp, imageDescriptor, local, definition, paddedPng } from './resolver-fixtures.ts';
import { toolchain } from './fixtures.ts';
import { validateSource } from '../../apps/build-worker/src/source-policy.mjs';
import { componentIdSchema, sceneIdSchema, assetIdSchema } from '../../packages/runtime-contracts/src/identities.ts';
import { encode as encodePng } from 'fast-png';
import { readFileSync } from 'node:fs';

const prepare = (m: ReturnType<typeof model>) => prepareProjectResolution(inputFor(m), structuredClone(toolchain));

test('owns complete bytes before awaiting and exposes immutable exact source origins', async () => {
  const f = resolutionFixture(), text = new TextDecoder().decode(f.input.files[f.helperPath]);
  const pending = prepareProjectResolution(f.input, f.supportedToolchain);
  f.input.files[f.helperPath]!.fill(0); f.input.documents['project.json']!.fill(0); delete f.input.files['components/a/src/main.ts']; f.supportedToolchain.runtimeBuildHash = '0'.repeat(64);
  const snapshot = await pending, scene = resolveProject(snapshot, ids.a);
  assert.equal(scene.source.files[f.helperPath], text);
  assert.deepEqual(Object.keys(scene.source.files).sort(), ['components/a/src/main.ts', f.helperPath]);
  assert.deepEqual(scene.origins[f.helperPath], { projectPath: f.helperPath, owners: [{ kind: 'local', componentId: ids.H }] });
  assert.ok(Object.isFrozen(scene.source.files));
  assert.throws(() => resolveProject({} as typeof snapshot, ids.a));
  assert.deepEqual(affectedScenes(snapshot, snapshot), []);
});
test('requires complete exact content, including unused definitions', async () => {
  for (const kind of ['missing', 'extra', 'utf8']) {
    const f = resolutionFixture();
    if (kind === 'missing') delete f.input.files['components/u/src/main.ts'];
    if (kind === 'extra') f.input.files['extra.ts'] = bytes('');
    if (kind === 'utf8') f.input.files['components/u/src/main.ts'] = new Uint8Array([255]);
    await assert.rejects(prepareProjectResolution(f.input, f.supportedToolchain), { code: kind === 'missing' ? 'CONTENT_MISSING' : kind === 'extra' ? 'CONTENT_UNDECLARED' : 'SOURCE_BOUNDARY_VIOLATION' });
  }
});
test('rejects getters, shared buffers, extra top-level fields and content case collisions', async () => {
  for (const kind of ['getter', 'shared', 'extra', 'case', 'overlap']) {
    const f = resolutionFixture(); let called = 0;
    if (kind === 'getter') Object.defineProperty(f.input.files, f.helperPath, { get() { called++; return bytes(''); }, enumerable: true });
    if (kind === 'shared') f.input.files[f.helperPath] = new Uint8Array(new SharedArrayBuffer(5));
    if (kind === 'extra') Object.assign(f.input, { extra: {} });
    if (kind === 'case') f.input.files['components/Helper/src/helper.ts'] = bytes('');
    if (kind === 'overlap') f.input.files['project.json'] = f.input.documents['project.json']!;
    await assert.rejects(prepareProjectResolution(f.input, f.supportedToolchain)); assert.equal(called, 0);
  }
});
test('preserves BOM/CRLF bytes, accepts empty declared helper, and rejects real LFS pointers', async () => {
  const m = model(); m.files['components/u/src/main.ts'] = bytes('\ufeffexport const x = 1;\r\n');
  assert.equal(resolveProject(await prepare(m), ids.c).source.files['components/u/src/main.ts'], '\ufeffexport const x = 1;\r\n');
  m.files['components/helper/src/helper.ts'] = bytes(''); await prepare(m);
  m.files['components/helper/src/helper.ts'] = bytes('version https://git-lfs.github.com/spec/v1\noid sha256:' + 'a'.repeat(64) + '\nsize 20\n');
  await assert.rejects(prepare(m), { code: 'CONTENT_MISSING' });
});
test('resolves complete package originals, direct entries, all declaring owners and both SDK envelopes', async () => {
  for (const sdk of ['0.1.0', '0.2.0'] as const) {
    const m = model(), pkg = packageFixture(sdk); m.packages.push(pkg);
    pkg.manifest.exports.shared = structuredClone(pkg.manifest.exports.main!);
    pkg.manifest.exports.main!.references.push({ kind: 'package', packageId: pkg.manifest.packageId, exportId: 'shared' });
    m.scenes[0]!.implementation = { kind: 'package', packageId: pkg.manifest.packageId, exportId: 'main' };
    const scene = resolveProject(await prepare(m), ids.a), prefix = `libraries/${pinFor(pkg.manifest).contentHash}`;
    assert.equal(scene.source.entry, `${prefix}/src/main.ts`); assert.equal(scene.source.sdkVersion, sdk);
    assert.deepEqual(Object.keys(scene.source).sort(), sdk === '0.1.0' ? ['entry', 'files', 'sdkVersion'] : ['assets', 'entry', 'files', 'sdkVersion', 'sourceVersion']);
    assert.equal(Object.keys(scene.source.files).length, 2);
    assert.deepEqual(scene.origins[`${prefix}/src/helper.ts`]!.owners.map(o => o.kind === 'package' ? o.exportId : ''), ['main', 'shared']);
    assert.deepEqual(scene.source, validateSource(scene.source));
  }
});
test('validates unused pins, license bytes, exports and assets', async () => {
  for (const kind of ['license', 'export', 'asset', 'local']) {
    const m = model(), pkg = packageFixture(); m.packages.push(pkg);
    if (kind === 'license') pkg.files['LICENSE.txt']![0] = pkg.files['LICENSE.txt']![0]! ^ 1;
    if (kind === 'export') pkg.manifest.exports.main!.references.push({ kind: 'package', packageId: 'demo/missing', exportId: 'main' });
    if (kind === 'local') pkg.manifest.exports.main!.references.push(local(ids.H));
    if (kind === 'asset') { const b = bmp(); b[0] = 0; const d = imageDescriptor(b); m.assets.assets[ids.image] = d; m.files[d.path] = b; }
    await assert.rejects(prepare(m));
  }
});
test('valid decoded static imports, reexports, parent paths and allowed bare names retain source text', async () => {
  const m = model(); const path = 'components/a/src/main.ts';
  m.files[path] = bytes("import type { Vector3 } from 'three/webgpu';\nexport { start } from '../../hel\\u0070er/src/helper.ts';\nexport * from 'three/tsl';\n");
  const scene = resolveProject(await prepare(m), ids.a); assert.equal(scene.source.files[path], new TextDecoder().decode(m.files[path]));
});
for (const code of [
  "import './missing.ts';", "import '../../u/src/main.ts';", "export * from '../../u/src/main.ts';", "import '../../\\u0075/src/main.ts';",
  "import './main';", "import '/absolute.ts';", "import 'https://example.test/a.ts';", "import 'three';", "import '.\\\\main.ts';",
  "import('./main.ts');", "type X = import('./main.ts').X;", "import x = require('./main.ts');",
]) test(`rejects owner-boundary import: ${code}`, async () => {
  const m = model(); m.files['components/a/src/main.ts'] = bytes(code);
  await assert.rejects(prepare(m), { code: 'SOURCE_BOUNDARY_VIOLATION' });
});
test('caller union does not grant a dependency access to its sibling', async () => {
  const m = model(); m.components[0]!.references.push(local(ids.U));
  m.files['components/helper/src/helper.ts'] = bytes("import '../../u/src/main.ts';");
  await assert.rejects(prepare(m), { code: 'SOURCE_BOUNDARY_VIOLATION' });
});
test('definition cycle, mixed SDK, unknown exact ID and invalid case ownership reject authoritatively', async () => {
  for (const kind of ['cycle', 'sdk', 'id', 'case']) {
    const m = model();
    if (kind === 'cycle') m.components[2]!.references = [local(ids.A)];
    if (kind === 'sdk') m.components[2]!.sdkVersion = '0.1.0';
    if (kind === 'id') m.components[0]!.references = [local(componentIdSchema.parse('33000000-0000-4000-8000-000000000099'))];
    if (kind === 'case') { m.components[2]!.files.push('src/Helper.ts'); m.files['components/helper/src/Helper.ts'] = bytes(''); }
    await assert.rejects(prepare(m), (e: unknown) => { assert.equal((e as { code: string }).code, 'PROJECT_INVALID'); assert.equal((e as { owners?: unknown }).owners, undefined); return true; });
  }
});
test('actual admission alias collision is enriched with exact owners; malformed owner never guessed', async () => {
  const m = model(), b = bmp(), d = imageDescriptor(b); m.assets.assets[ids.image] = d; m.files[d.path] = b;
  m.components[0]!.assets['assets/same.bmp'] = ids.image; m.components[2]!.assets['assets/same.bmp'] = ids.image;
  await assert.rejects(prepare(m), (error: unknown) => {
    const e = error as { code: string; owners: unknown; cause: Error; path: string };
    assert.equal(e.code, 'PROJECT_INVALID'); assert.match(e.cause.message, /alias collision/); assert.equal(e.path, 'assets/same.bmp');
    assert.deepEqual(e.owners, [local(ids.A), local(ids.H)]); return true;
  });
  m.components[2]!.componentId = ids.U;
  await assert.rejects(prepare(m), (e: unknown) => { assert.equal((e as { owners?: unknown }).owners, undefined); return true; });
});
test('image originals and asset origins are exact, including unbound images', async () => {
  const m = model(), b = bmp(), d = imageDescriptor(b); m.assets.assets[ids.image] = d; m.files[d.path] = b;
  m.components[0]!.assets['assets/red.bmp'] = ids.image;
  const scene = resolveProject(await prepare(m), ids.a);
  assert.deepEqual(scene.assetOrigins['assets/red.bmp'], { projectPath: d.path, assetId: ids.image, owner: local(ids.A) });
  assert.ok('assets' in scene.source); assert.equal(scene.source.assets['assets/red.bmp']!.data, Buffer.from(b).toString('base64'));
  m.files[d.path] = b.slice(1); await assert.rejects(prepare(m), { code: 'ASSET_BOUNDARY_VIOLATION' });
});
test('source closure byte ceiling includes unimported helpers and preserves equality', async () => {
  const m = model(); m.files['components/a/src/main.ts'] = bytes(''); m.files['components/b/src/main.ts'] = bytes('');
  m.files['components/helper/src/helper.ts'] = bytes(' '.repeat(1048576)); await prepare(m);
  m.files['components/helper/src/helper.ts'] = bytes(' '.repeat(1048577)); await assert.rejects(prepare(m), { code: 'QUOTA_EXCEEDED' });
});
test('32 source files pass and 33 reject through the authoritative metadata closure quota', async () => {
  const m = model(); m.components[0]!.files = Array.from({ length: 31 }, (_, i) => i ? `src/f${i}.ts` : 'src/main.ts');
  for (const p of m.components[0]!.files) m.files[`components/a/${p}`] = bytes('');
  await prepare(m); m.components[0]!.files.push('src/last.ts'); m.files['components/a/src/last.ts'] = bytes('');
  await assert.rejects(prepare(m), (e: unknown) => { assert.match((e as Error).message, /closure quota/); return true; });
});
test('compressed PNG proves decoded RGBA ceiling independent of original-byte ceiling', async () => {
  const m = model(), b = encodePng({ width: 512, height: 512, data: new Uint8Array(512 * 512 * 4), channels: 4, depth: 8 });
  assert.ok(b.length * 3 < 1048576);
  const d = imageDescriptor(b, ids.image, 'png', 'image/png'); m.assets.assets[ids.image] = d; m.files[d.path] = b;
  m.components[0]!.assets = { 'assets/one.png': ids.image, 'assets/two.png': ids.image }; await prepare(m);
  const smallId = assetIdSchema.parse('44000000-0000-4000-8000-000000000002');
  const small = encodePng({ width: 1, height: 1, data: new Uint8Array(4), channels: 4, depth: 8 });
  const sd = imageDescriptor(small, smallId, 'png', 'image/png'); m.assets.assets[smallId] = sd; m.files[sd.path] = small;
  m.components[0]!.assets['assets/three.png'] = smallId; await assert.rejects(prepare(m), { code: 'QUOTA_EXCEEDED' });
});
test('both snapshots include old and new users, settings, renames, additions and removals', async () => {
  const m = model(), base = await prepare(m);
  m.files['components/helper/src/helper.ts'] = bytes('// helper\nexport const start: number = 0.75;\n');
  assert.deepEqual(affectedScenes(base, await prepare(m)), [ids.a, ids.b]);
  const removed = model(); removed.components[0]!.references = []; removed.files['components/a/src/main.ts'] = bytes('export const a = 1;');
  assert.deepEqual(affectedScenes(base, await prepare(removed)), [ids.a]);
  const settingsChanged = model(); settingsChanged.scenes[1]!.settings.seed++;
  assert.deepEqual(affectedScenes(base, await prepare(settingsChanged)), [ids.b]);
  const deleted = model(); deleted.scenes.pop(); delete deleted.project.scenes[ids.c];
  assert.deepEqual(affectedScenes(base, await prepare(deleted)), [ids.c]);
  const renamed = model(); renamed.project.scenes[ids.a] = 'scenes/renamed';
  assert.deepEqual(affectedScenes(base, await prepare(renamed)), [ids.a]);
  const added = model(), newId = sceneIdSchema.parse('22000000-0000-4000-8000-000000000004');
  added.scenes.push({ ...structuredClone(added.scenes[0]!), sceneId: newId }); added.project.scenes[newId] = 'scenes/new';
  assert.deepEqual(affectedScenes(base, await prepare(added)), [newId]);
});
test('unused edits and display name do not impact scenes; project identity and toolchain do', async () => {
  const m = model(), extra = componentIdSchema.parse('33000000-0000-4000-8000-000000000005');
  m.project.components[extra] = 'components/unused'; m.components.push({ ...definition(), schemaVersion: 1, componentId: extra, name: 'Unused' }); m.files['components/unused/src/main.ts'] = bytes('export const x = 1;');
  const base = await prepare(m); m.files['components/unused/src/main.ts'] = bytes('export const x = 2;'); m.project.name = 'Renamed';
  assert.deepEqual(affectedScenes(base, await prepare(m)), []);
  const t = structuredClone(toolchain); t.runtimeBuildHash = 'b'.repeat(64); m.lock.toolchain = t;
  assert.deepEqual(affectedScenes(base, await prepareProjectResolution(inputFor(m), t)), [ids.a, ids.b, ids.c]);
  const f = resolutionFixture(); const doc = JSON.parse(new TextDecoder().decode(f.input.documents['project.json'])); doc.projectId = '11000000-0000-4000-8000-000000000099'; f.input.documents['project.json'] = bytes(JSON.stringify(doc));
  assert.throws(() => affectedScenes(base, {} as typeof base));
  const other = await prepareProjectResolution(f.input, f.supportedToolchain); assert.throws(() => affectedScenes(base, other), { code: 'PROJECT_ID_MISMATCH' });
});
test('package license repin impacts every old/new package user; asset removal cannot produce snapshot', async () => {
  const m = model(), pkg = packageFixture(); m.packages.push(pkg); m.scenes[0]!.implementation = { kind: 'package', packageId: pkg.manifest.packageId, exportId: 'main' };
  const base = await prepare(m); pkg.files['LICENSE.txt'] = bytes('new license\n'); pkg.manifest.files['LICENSE.txt'] = hash(pkg.files['LICENSE.txt']);
  assert.deepEqual(affectedScenes(base, await prepare(m)), [ids.a]);
  const b = bmp(), d = imageDescriptor(b); m.assets.assets[ids.image] = d; m.files[d.path] = b; m.components[1]!.assets['assets/red.bmp'] = ids.image;
  const withImage = await prepare(m); delete m.files[d.path]; await assert.rejects(prepare(m));
  delete m.assets.assets[ids.image]; m.components[1]!.assets = {};
  assert.deepEqual(affectedScenes(withImage, await prepare(m)), [ids.b]);
});
test('diagnostic mapping is exact, retains location and leaves unknown/fileless diagnostics unmapped', async () => {
  const f = resolutionFixture(), scene = resolveProject(await prepareProjectResolution(f.input, f.supportedToolchain), ids.a);
  const diagnostic = { code: 'TS2322', message: 'exact message', file: f.helperPath, line: 2, column: 14 };
  const result = mapProjectDiagnostic(scene, diagnostic); assert.deepEqual(result.diagnostic, diagnostic); assert.equal(result.origin!.projectPath, f.helperPath);
  for (const d of [{ code: 'X', message: 'none' }, { ...diagnostic, file: 'helper.ts' }, { ...diagnostic, file: `source/${f.helperPath}` }]) assert.equal(mapProjectDiagnostic(scene, d).origin, undefined);
});
test('8 MiB aggregate local source accepts equality and rejects next byte before closure parsing', async () => {
  const m = model(); for (const path of Object.keys(m.files)) m.files[path] = bytes('');
  for (let i = 0; i < 8; i++) {
    const id = componentIdSchema.parse(`55000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`), prefix = `components/budget${i}`;
    m.project.components[id] = prefix; m.components.push({ ...definition(), schemaVersion: 1, componentId: id, name: 'Budget' });
    m.files[`${prefix}/src/main.ts`] = bytes(' '.repeat(1048576));
  }
  assert.equal(Object.values(m.files).reduce((n, b) => n + b.length, 0), 8388608); await prepare(m);
  m.files['components/u/src/main.ts'] = bytes('\n'); await assert.rejects(prepare(m), { code: 'QUOTA_EXCEEDED' });
});
test('aggregate vendored ceiling includes actual manifest bytes separately from helper originals', async () => {
  const m = model(), pkg = packageFixture(); m.packages.push(pkg);
  pkg.files['src/main.ts'] = bytes(''); pkg.files['src/helper.ts'] = bytes('');
  pkg.files['LICENSE.txt'] = bytes(''); pkg.manifest.files = Object.fromEntries(Object.entries(pkg.files).map(([p, b]) => [p, hash(b)]));
  const manifestBytes = bytes(JSON.stringify(pkg.manifest)).length;
  pkg.files['LICENSE.txt'] = new Uint8Array(33554432 - manifestBytes); pkg.manifest.files['LICENSE.txt'] = hash(pkg.files['LICENSE.txt']);
  assert.equal(bytes(JSON.stringify(pkg.manifest)).length + Object.values(pkg.files).reduce((n, b) => n + b.length, 0), 33554432);
  await prepare(m);
  pkg.files['LICENSE.txt'] = new Uint8Array(pkg.files['LICENSE.txt'].length + 1); pkg.manifest.files['LICENSE.txt'] = hash(pkg.files['LICENSE.txt']);
  await assert.rejects(prepare(m), { code: 'QUOTA_EXCEEDED' });
});
test('16 MiB exact project images are valid originals; next byte rejects through metadata quota', async () => {
  const m = model(); let total = 0;
  for (let i = 0; i < 23; i++) {
    const id = assetIdSchema.parse(`66000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
    const data = i < 21 ? bmp(512, 512) : i === 21 ? bmp(256, 256) : paddedPng(16777216 - total);
    const d = imageDescriptor(data, id, i === 22 ? 'png' : 'bmp', i === 22 ? 'image/png' : 'image/bmp');
    m.assets.assets[id] = d; m.files[d.path] = data; total += data.length;
  }
  assert.equal(total, 16777216); await prepare(m);
  const id = assetIdSchema.parse('66000000-0000-4000-8000-000000000023'), old = m.assets.assets[id]!;
  const data = paddedPng(old.byteLength + 1), d = imageDescriptor(data, id, 'png', 'image/png'); m.assets.assets[id] = d; m.files[d.path] = data;
  await assert.rejects(prepare(m), (error: unknown) => { assert.match((error as Error).message, /Project asset quota exceeded/); return true; });
});
test('64 images pass and a 65th rejects even while unused', async () => {
  const m = model(), data = bmp();
  for (let i = 0; i < 65; i++) {
    const id = assetIdSchema.parse(`66000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`), d = imageDescriptor(data, id);
    m.assets.assets[id] = d; m.files[d.path] = data;
    if (i === 63) await prepare(m);
  }
  await assert.rejects(prepare(m), (error: unknown) => { assert.match((error as Error).message, /asset count limit/); return true; });
});
test('four alias bindings pass and fifth rejects, even for the same tiny original', async () => {
  const m = model(), b = bmp(), d = imageDescriptor(b); m.assets.assets[ids.image] = d; m.files[d.path] = b;
  for (let i = 0; i < 5; i++) { m.components[0]!.assets[`assets/a${i}.bmp`] = ids.image; if (i === 3) await prepare(m); }
  await assert.rejects(prepare(m), (error: unknown) => { assert.match((error as Error).message, /closure quota/); return true; });
});
test('dimensions and image-byte ceiling retain actual decoder and metadata owners', async () => {
  const m = model(), b = bmp(512, 512), d = imageDescriptor(b); assert.equal(b.length, 786486); m.assets.assets[ids.image] = d; m.files[d.path] = b; await prepare(m);
  m.files[d.path] = new Uint8Array(786487); d.byteLength = 786487; d.sha256 = hash(m.files[d.path]!);
  await assert.rejects(prepare(m), { code: 'PROJECT_INVALID' });
  const png = encodePng({ width: 513, height: 1, channels: 4, depth: 8, data: new Uint8Array(513 * 4) });
  const next = imageDescriptor(png, ids.image, 'png', 'image/png'); delete m.files[d.path]; m.assets.assets[ids.image] = next; m.files[next.path] = png;
  await assert.rejects(prepare(m), { code: 'ASSET_BOUNDARY_VIOLATION' });
});
test('JPEG originals validate through the existing codec; corrupt unbound bytes reject', async () => {
  const m = model(), data = readFileSync(new URL('../assets/fixtures/jpeg/baseline.jpg', import.meta.url));
  const d = imageDescriptor(data, ids.image, 'jpg', 'image/jpeg'); m.assets.assets[ids.image] = d; m.files[d.path] = data; await prepare(m);
  const bad = Uint8Array.from(data); bad[0] = 0; d.sha256 = hash(bad); m.files[d.path] = bad;
  await assert.rejects(prepare(m), { code: 'ASSET_BOUNDARY_VIOLATION' });
});
test('cross-package closure byte accounting includes all declared source originals', async () => {
  const m = model(), pkg = packageFixture(); m.packages.push(pkg);
  pkg.files['src/main.ts'] = bytes(' '.repeat(524288)); pkg.files['src/helper.ts'] = bytes('');
  pkg.manifest.files = Object.fromEntries(Object.entries(pkg.files).map(([p, b]) => [p, hash(b)]));
  m.components[0]!.references = [{ kind: 'package', packageId: pkg.manifest.packageId, exportId: 'main' }];
  m.files['components/a/src/main.ts'] = bytes(' '.repeat(524288)); await prepare(m);
  m.files['components/a/src/main.ts'] = bytes(' '.repeat(524289)); await assert.rejects(prepare(m), { code: 'QUOTA_EXCEEDED' });
});
test('exact 1 MiB binding originals passes, next byte fails independently of decoded RGBA', async () => {
  const m = model(), lengths: number[] = [];
  for (let i = 0; i < 4; i++) {
    const id = assetIdSchema.parse(`77000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
    const data = i < 2 ? bmp(512, 256) : i === 2 ? bmp(256, 256) : paddedPng(1048576 - lengths.reduce((a, b) => a + b, 0));
    const ext = i === 3 ? 'png' : 'bmp', d = imageDescriptor(data, id, ext, i === 3 ? 'image/png' : 'image/bmp');
    m.assets.assets[id] = d; m.files[d.path] = data; m.components[0]!.assets[`assets/binding${i}.${ext}`] = id; lengths.push(data.length);
  }
  assert.deepEqual(lengths, [393270, 393270, 196662, 65374]); await prepare(m);
  const id = assetIdSchema.parse('77000000-0000-4000-8000-000000000004'), data = paddedPng(65375), d = imageDescriptor(data, id, 'png', 'image/png');
  m.assets.assets[id] = d; m.files[d.path] = data;
  await assert.rejects(prepare(m), (error: unknown) => { assert.match((error as Error).message, /closure quota/); return true; });
});
test('same-package shared file imports must be permitted under every declaring export', async () => {
  const m = model(), pkg = packageFixture(); m.packages.push(pkg);
  const secondary = definition(); secondary.files = ['src/shared.ts']; secondary.entry = 'src/shared.ts';
  pkg.manifest.exports.secondary = secondary; pkg.files['src/shared.ts'] = bytes("import './helper.ts';"); pkg.manifest.files['src/shared.ts'] = hash(pkg.files['src/shared.ts']);
  pkg.manifest.exports.main!.files.push('src/shared.ts');
  await assert.rejects(prepare(m), { code: 'SOURCE_BOUNDARY_VIOLATION' });
  secondary.references.push({ kind: 'package', packageId: pkg.manifest.packageId, exportId: 'main' }); await prepare(m);
});
test('a declared package dependency grants only explicitly referenced exports', async () => {
  const m = model(), parent = packageFixture(), dependency = packageFixture(); dependency.manifest.packageId = 'demo/dependency';
  parent.manifest.dependencies[dependency.manifest.packageId] = pinFor(dependency.manifest);
  const target = `../../${pinFor(dependency.manifest).contentHash}/src/helper.ts`;
  parent.files['src/main.ts'] = bytes(`export { start } from '${target}';`); parent.manifest.files['src/main.ts'] = hash(parent.files['src/main.ts']);
  m.packages = [parent, dependency]; await assert.rejects(prepare(m), { code: 'SOURCE_BOUNDARY_VIOLATION' });
  parent.manifest.exports.main!.references.push({ kind: 'package', packageId: dependency.manifest.packageId, exportId: 'main' }); await prepare(m);
});
test('source and asset relocation keep identity and report exact original paths and impacted users', async () => {
  const m = model(), image = bmp(), d = imageDescriptor(image); m.assets.assets[ids.image] = d; m.files[d.path] = image; m.components[0]!.assets['assets/one.bmp'] = ids.image;
  const base = await prepare(m); const old = d.path; d.path = old.replace('image.bmp', 'renamed.bmp'); m.files[d.path] = m.files[old]!; delete m.files[old];
  const next = await prepare(m); assert.deepEqual(affectedScenes(base, next), [ids.a]);
  assert.equal(resolveProject(next, ids.a).assetOrigins['assets/one.bmp']!.assetId, ids.image); assert.equal(resolveProject(next, ids.a).assetOrigins['assets/one.bmp']!.projectPath, d.path);
  const renamed = model(); renamed.project.components[ids.H] = 'components/renamed'; renamed.files['components/renamed/src/helper.ts'] = renamed.files['components/helper/src/helper.ts']!; delete renamed.files['components/helper/src/helper.ts'];
  for (const path of ['components/a/src/main.ts', 'components/b/src/main.ts']) renamed.files[path] = bytes(new TextDecoder().decode(renamed.files[path]).replace('/helper/', '/renamed/'));
  const first = await prepare(model()), last = await prepare(renamed); assert.deepEqual(affectedScenes(first, last), [ids.a, ids.b]);
  assert.deepEqual(resolveProject(last, ids.a).origins['components/renamed/src/helper.ts']!.owners, [local(ids.H)]);
});
test('malformed trusted selection is rejected as structured project data error without invoking accessors', async () => {
  const f = resolutionFixture(); let calls = 0;
  Object.defineProperty(f.supportedToolchain, 'runtimeBuildHash', { enumerable: true, get() { calls++; return '0'.repeat(64); } });
  await assert.rejects(prepareProjectResolution(f.input, f.supportedToolchain), { code: 'PROJECT_INVALID' }); assert.equal(calls, 0);
});
test('saved control intent, image provenance and alias edits affect exactly their users', async () => {
  const m = model(), b = bmp(), d = imageDescriptor(b); m.assets.assets[ids.image] = d; m.files[d.path] = b; m.components[0]!.assets['assets/red.bmp'] = ids.image;
  const base = await prepare(m); m.scenes[1]!.savedControls = { ...m.scenes[1]!.savedControls, values: { speed: 2 } };
  assert.deepEqual(affectedScenes(base, await prepare(m)), [ids.b]); m.scenes[1]!.savedControls = { ...m.scenes[1]!.savedControls, values: { speed: 1 } };
  d.provenance = { attribution: 'Updated author' }; assert.deepEqual(affectedScenes(base, await prepare(m)), [ids.a]);
  delete d.provenance; delete m.components[0]!.assets['assets/red.bmp']; m.components[0]!.assets['assets/renamed.bmp'] = ids.image;
  assert.deepEqual(affectedScenes(base, await prepare(m)), [ids.a]);
});
test('factory preserves complete package asset bytes and reports missing/extra original pin context', async () => {
  const m = model(), pkg = packageFixture(), b = bmp(), d = imageDescriptor(b); m.packages.push(pkg);
  pkg.manifest.assets[ids.image] = d; pkg.files[d.path] = b; pkg.manifest.files[d.path] = hash(b); pkg.manifest.exports.main!.assets['assets/package.bmp'] = ids.image;
  m.scenes[0]!.implementation = { kind: 'package', packageId: pkg.manifest.packageId, exportId: 'main' };
  const scene = resolveProject(await prepare(m), ids.a), prefix = `libraries/${pinFor(pkg.manifest).contentHash}`;
  assert.deepEqual(scene.assetOrigins['assets/package.bmp'], { projectPath: `${prefix}/${d.path}`, assetId: ids.image, owner: m.scenes[0]!.implementation });
  const input = inputFor(m); delete input.files[`${prefix}/LICENSE.txt`];
  await assert.rejects(prepareProjectResolution(input, toolchain), (e: unknown) => { const error = e as { code: string; packageId: string; message: string }; assert.equal(error.code, 'DEPENDENCY_UNAVAILABLE'); assert.equal(error.packageId, pkg.manifest.packageId); assert.ok(error.message.includes(`@1.2.3 (${pinFor(pkg.manifest).contentHash})`)); return true; });
  const extra = inputFor(m); extra.files[`${prefix}/EXTRA.txt`] = bytes(''); await assert.rejects(prepareProjectResolution(extra, toolchain), { code: 'PACKAGE_MODIFIED' });
});
test('factory caps record cardinality before copying excessive empty payload inventories', async () => {
  const f = resolutionFixture();
  const excessiveDocuments = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`d${i}.json`, bytes('')]));
  await assert.rejects(prepareProjectResolution({ ...f.input, documents: excessiveDocuments }, f.supportedToolchain), { code: 'QUOTA_EXCEEDED' });
  const excessiveFiles = Object.fromEntries(Array.from({ length: 65537 }, (_, i) => [`f${i}.ts`, bytes('')]));
  await assert.rejects(prepareProjectResolution({ ...f.input, files: excessiveFiles }, f.supportedToolchain), { code: 'QUOTA_EXCEEDED' });
});
