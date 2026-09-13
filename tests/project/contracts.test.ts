import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMetadataJson, metadataLimits, validateMetadata, admitProjectMetadata, hashMetadata, hashInventory, hashPackage } from '../../packages/core/src/project/contracts.ts';
import { fixture, documents, ids, h, hash, toolchain, legacyControls } from './fixtures.ts';

const bytes = (text: string) => new TextEncoder().encode(text);
test('admits all three scenes, shared references, exact package and original asset metadata', async () => {
  const result = await admitProjectMetadata(documents(), toolchain);
  assert.equal(result.scenes[ids.a]!.savedControls.values.speed, 1);
  assert.equal(result.scenes[ids.b]!.savedControls.values.speed, 2);
  assert.equal(result.scenes[ids.c]!.implementation.kind, 'local');
  assert.equal(result.assets.assets[ids.asset]!.sha256, h);
  assert.equal(result.assets.assets[ids.asset]!.provenance!.seed, '42');
  assert.equal(result.scenes[ids.a]!.savedControls.sourceHash, h);
});
test('strict metadata schemas reject unknown fields, versions and malformed identities', () => {
  const f = fixture();
  for (const kind of ['project', 'scene', 'component', 'assets', 'lock', 'package'] as const) {
    const value = { project: f.project, scene: f.scenes[0], component: f.components[0], assets: f.assets, lock: f.lock, package: f.pkg }[kind];
    assert.throws(() => validateMetadata(kind, { ...value, surprise: true }));
    assert.throws(() => validateMetadata(kind, { ...value, schemaVersion: 2 }));
  }
  assert.throws(() => validateMetadata('project', { ...f.project, projectId: 'a'.repeat(64) }));
});
for (const [name, change] of Object.entries({
  'duplicate identities': (f: ReturnType<typeof fixture>) => { f.project.projectId = ids.a; },
  'registry mismatch': (f: ReturnType<typeof fixture>) => { f.components[0]!.componentId = ids.unique; },
  'unknown reference': (f: ReturnType<typeof fixture>) => { f.components[0]!.references.push({ kind: 'local', componentId: ids.project }); },
  'missing entry': (f: ReturnType<typeof fixture>) => { f.components[0]!.entry = 'src/missing.ts'; },
  'duplicate files': (f: ReturnType<typeof fixture>) => { f.components[0]!.files.push('src/main.ts'); },
  'case collision': (f: ReturnType<typeof fixture>) => { f.components[0]!.files.push('src/Main.ts'); },
  'overlap registry': (f: ReturnType<typeof fixture>) => { f.project.components[ids.helper] = 'components/particles/nested'; },
  'wrong namespace': (f: ReturnType<typeof fixture>) => { f.project.scenes[ids.a] = 'components/a'; },
  'cycle': (f: ReturnType<typeof fixture>) => { f.components[1]!.references.push({ kind: 'local', componentId: ids.shared }); },
  'mixed SDK': (f: ReturnType<typeof fixture>) => { f.components[1]!.sdkVersion = '0.1.0'; },
  'v1 asset closure': (f: ReturnType<typeof fixture>) => { f.components[0]!.sourceVersion = 1; },
  'asset alias collision': (f: ReturnType<typeof fixture>) => { f.components[1]!.assets['assets/spark.png'] = ids.asset; },
  'missing asset': (f: ReturnType<typeof fixture>) => { f.components[2]!.assets['assets/missing.png'] = ids.project; },
  'unknown provenance': (f: ReturnType<typeof fixture>) => { f.assets.assets[ids.asset]!.provenance.referenceAssetIds.push(ids.project); },
  'bad controls hash': (f: ReturnType<typeof fixture>) => { f.scenes[0]!.savedControls.schemaHash = 'b'.repeat(64); },
  'out of range controls': (f: ReturnType<typeof fixture>) => { f.scenes[0]!.savedControls.values.speed = 100; },
  'unknown export': (f: ReturnType<typeof fixture>) => { f.components[0]!.references.push({ kind: 'package', packageId: 'demo/noise', exportId: 'missing' }); },
  'package local ref': (f: ReturnType<typeof fixture>) => { f.pkg.exports.noise.references.push({ kind: 'local', componentId: ids.unique }); },
  'export missing file': (f: ReturnType<typeof fixture>) => { f.pkg.exports.noise.files.push('src/missing.ts'); },
  'bad sdk range': (f: ReturnType<typeof fixture>) => { f.pkg.sdkRange = '0.1.0' as typeof f.pkg.sdkRange; },
})) test(`admission rejects ${name} even in unused metadata`, async () => { const f = fixture(); change(f); await assert.rejects(admitProjectMetadata(documents(f), toolchain)); });
test('own-data admission never evaluates accessors or inherited records', () => {
  let evaluated = 0;
  const f = fixture();
  Object.defineProperty(f.project, 'name', { enumerable: true, get() { evaluated++; return 'bad'; } });
  assert.throws(() => validateMetadata('project', f.project));
  assert.equal(evaluated, 0);
  assert.throws(() => validateMetadata('project', Object.create(f.project)));
  const component = fixture().components[0]!;
  Object.defineProperty(component.files, '0', { enumerable: true, get() { evaluated++; return 'src/main.ts'; } });
  assert.throws(() => validateMetadata('component', component));
  assert.equal(evaluated, 0);
});
test('raw parser rejects duplicate decoded keys, invalid UTF-8, BOM, Unicode and nonfinite numbers', () => {
  for (const raw of ['{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '{"nested":{"x":0,"x":1}}', '"\\ud800"', '"\\udc00"', '1e400', '\ufeff{}', '{"a":1,}', '[1,]', '01', '{} false']) assert.throws(() => parseMetadataJson(bytes(raw)), raw);
  assert.throws(() => parseMetadataJson(new Uint8Array([0x22, 0xc3, 0x28, 0x22])));
  assert.equal(parseMetadataJson(bytes('"\\ud83c\\udf1f"')), '🌟');
  assert.equal(Object.getPrototypeOf(parseMetadataJson(bytes('{"__proto__":1}'))), null);
});
test('raw parser accepts exact byte/depth/node/string/key bounds and rejects one over', () => {
  assert.equal(parseMetadataJson(bytes('0' + ' '.repeat(metadataLimits.documentBytes - 1))), 0);
  assert.throws(() => parseMetadataJson(bytes('0' + ' '.repeat(metadataLimits.documentBytes))));
  assert.doesNotThrow(() => parseMetadataJson(bytes('['.repeat(32) + '0' + ']'.repeat(32))));
  assert.throws(() => parseMetadataJson(bytes('['.repeat(33) + '0' + ']'.repeat(33))));
  assert.doesNotThrow(() => parseMetadataJson(bytes('[' + Array(65535).fill(0).join(',') + ']')));
  assert.throws(() => parseMetadataJson(bytes('[' + Array(65536).fill(0).join(',') + ']')));
  assert.equal((parseMetadataJson(bytes(JSON.stringify('é'.repeat(32768)))) as string).length, 32768);
  assert.throws(() => parseMetadataJson(bytes(JSON.stringify('é'.repeat(32768) + 'a'))));
  assert.doesNotThrow(() => parseMetadataJson(bytes(JSON.stringify({ ['é'.repeat(120)]: 0 }))));
  assert.throws(() => parseMetadataJson(bytes(JSON.stringify({ ['é'.repeat(120) + 'a']: 0 }))));
});
test('metadata aggregate bytes are bounded across individually valid documents', async () => {
  const docs = documents();
  const total = Object.values(docs).reduce((n, value) => n + value.length, 0);
  docs['project.json'] = bytes(new TextDecoder().decode(docs['project.json']) + ' '.repeat(metadataLimits.documentBytes - total));
  await admitProjectMetadata(docs, toolchain);
  docs['project.json'] = bytes(new TextDecoder().decode(docs['project.json']) + ' ');
  await assert.rejects(admitProjectMetadata(docs, toolchain), /metadata.*byte/i);
});
test('pins require exact supported toolchain, package identities and computed hashes', async () => {
  for (const version of ['^1.2.3', '1.2', '01.2.3', '1.2.3-beta', '1.2.3+build', 'latest']) assert.throws(() => validateMetadata('package', { ...fixture().pkg, version }));
  const docs = documents();
  const lock = JSON.parse(new TextDecoder().decode(docs['dependencies.lock.json']));
  lock.packages['demo/noise'].manifestHash = 'b'.repeat(64);
  docs['dependencies.lock.json'] = bytes(JSON.stringify(lock));
  await assert.rejects(admitProjectMetadata(docs, toolchain), /hash/i);
  await assert.rejects(admitProjectMetadata(documents(), { ...toolchain, typescriptVersion: '7.0.3' }), /toolchain/i);
  const missing = documents(); delete missing[Object.keys(missing).find(path => path.startsWith('libraries/'))!];
  await assert.rejects(admitProjectMetadata(missing, toolchain));
});
test('lexical paths reject traversal, reserved names, unsafe segments and more than 240 characters', () => {
  for (const path of ['../main.ts', 'src\\main.ts', '/main.ts', 'C:/main.ts', 'src/con.ts', 'src/a .ts', 'src/é.ts', '__lux.ts', 'a'.repeat(238) + '.ts']) {
    const f = fixture().components[0]!; f.entry = path; f.files = [path]; assert.throws(() => validateMetadata('component', f), path);
  }
  const f = fixture().components[0]!; f.entry = 'a'.repeat(237) + '.ts'; f.files = [f.entry]; assert.doesNotThrow(() => validateMetadata('component', f));
});
test('asset metadata binds extension, original size and decoder interpretation without inline data', () => {
  const asset = fixture().assets.assets[ids.asset];
  for (const change of [{ mediaType: 'image/bmp' }, { byteLength: 0 }, { interpretation: { colorSpace: 'linear', alpha: 'straight' } }, { encoding: 'base64', data: 'AAAA' }]) assert.throws(() => validateMetadata('assets', { schemaVersion: 1, assets: { [ids.asset]: { ...asset, ...change } } }));
});
test('identity bodies are domain/version separated, canonical, and preserve raw bytes', async () => {
  const f = fixture();
  assert.equal(await hashInventory({ 'src/a.ts': bytes('x\r\n') }), hash(JSON.stringify(['lux-project-inventory', 1, [['src/a.ts', hash('x\r\n')]]])));
  assert.notEqual(await hashInventory({ 'src/a.ts': bytes('x\r\n') }), await hashInventory({ 'src/a.ts': bytes('x\n') }));
  const before = await hashMetadata('component', f.components[0]);
  f.components[0]!.references.pop();
  assert.notEqual(await hashMetadata('component', f.components[0]), before);
  const renamed = { ...f.project, name: 'Renamed', scenes: { ...f.project.scenes, [ids.a]: 'scenes/renamed' } };
  assert.equal(validateMetadata('project', renamed).projectId, ids.project);
  assert.deepEqual(Object.keys(validateMetadata('project', renamed).scenes), [ids.a, ids.b, ids.c]);
  const permuted = Object.fromEntries(Object.entries(f.project).reverse());
  assert.equal(await hashMetadata('project', f.project), await hashMetadata('project', permuted));
  assert.throws(() => validateMetadata('lock', { ...f.lock, toolchain: { ...toolchain, sdkVariants: { '0.3.0': { declarationEntry: 'sdk/x.d.ts', contractHash: h } } } }));
  await assert.rejects(hashPackage(f.pkg, {}), /inventory|file/i);
});
test('legacy v1 and empty-assets v2 stay distinct including direct package entries', async () => {
  const f = fixture();
  f.scenes[2]!.implementation = { kind: 'package', packageId: 'demo/noise', exportId: 'noise' };
  f.pkg.exports.noise.sourceVersion = 1;
  const before = await hashMetadata('package', f.pkg);
  await admitProjectMetadata(documents(f), toolchain);
  f.pkg.exports.noise.sourceVersion = 2;
  assert.notEqual(await hashMetadata('package', f.pkg), before);
  f.components[2]!.sdkVersion = '0.1.0'; f.components[2]!.sourceVersion = 1;
  f.scenes[2]!.implementation = { kind: 'local', componentId: ids.unique };
  f.scenes[2]!.savedControls = await legacyControls() as unknown as (typeof f.scenes)[number]['savedControls'];
  await admitProjectMetadata(documents(f), toolchain);
});
test('byte admission uses typed-array contents without executing caller getters or iterators', async () => {
  const docs = documents(); let evaluated = 0;
  Object.defineProperty(docs['project.json'], Symbol.iterator, { get() { evaluated++; throw Error('submitted iterator'); } });
  Object.defineProperty(docs['project.json'], 'byteLength', { get() { evaluated++; throw Error('submitted length'); } });
  await admitProjectMetadata(docs, toolchain);
  assert.equal(evaluated, 0);
  const raw = bytes('{}');
  Object.defineProperty(raw, 'byteLength', { get() { evaluated++; throw Error('submitted length'); } });
  assert.doesNotThrow(() => parseMetadataJson(raw));
  assert.equal(evaluated, 0);
});
test('unused package asset aliases and absent declaration pins fail admission', async () => {
  const f = fixture();
  f.pkg.exports.noise.assets['assets/missing.png'] = ids.asset;
  await assert.rejects(admitProjectMetadata(documents(f), toolchain), /asset/i);
  const absent = fixture(); delete (absent.lock.toolchain.sdkVariants as Partial<typeof toolchain.sdkVariants>)['0.2.0'];
  await assert.rejects(admitProjectMetadata(documents(absent), absent.lock.toolchain), /SDK/i);
});
test('closure limits count transitive source files and distinct image bindings', async () => {
  const f = fixture();
  f.components[0]!.files = ['src/main.ts', ...Array.from({ length: 29 }, (_, index) => `src/helper${index}.ts`)];
  // 30 + 2 + 1 transitive files exceed the existing compiler limit of 32.
  await assert.rejects(admitProjectMetadata(documents(f), toolchain), /closure quota/i);
  f.components[0]!.files.pop(); await admitProjectMetadata(documents(f), toolchain);
  for (let index = 0; index < 4; index++) f.components[0]!.assets[`assets/spark${index}.png`] = ids.asset;
  await assert.rejects(admitProjectMetadata(documents(f), toolchain), /closure quota/i);
});
test('admission rejects incomplete control values and mismatched exact dependency pins', async () => {
  const docs = documents();
  const scene = JSON.parse(new TextDecoder().decode(docs['scenes/a/scene.json'])); scene.savedControls.values = {};
  docs['scenes/a/scene.json'] = bytes(JSON.stringify(scene));
  await assert.rejects(admitProjectMetadata(docs, toolchain));
  const f = fixture();
  f.pkg.dependencies = { 'demo/missing': { version: '1.0.0', manifestHash: h, contentHash: h } };
  await assert.rejects(admitProjectMetadata(documents(f), toolchain), /dependency pin/i);
});
test('registry overlap remains invalid with a sibling sorting between parent and child', () => {
  const f = fixture();
  f.project.components[ids.helper] = 'components/particles-x';
  f.project.components[ids.unique] = 'components/particles/nested';
  assert.throws(() => validateMetadata('project', f.project), /overlapping/i);
});
test('actual manifest ID must match the registry at its existing declared location', async () => {
  const docs = documents();
  const path = 'components/particles/component.json';
  const component = JSON.parse(new TextDecoder().decode(docs[path])); component.componentId = ids.unique;
  docs[path] = bytes(JSON.stringify(component));
  await assert.rejects(admitProjectMetadata(docs, toolchain), /ID\/registry mismatch/);
});
test('JSON key strings do not consume value nodes and escaped Unicode keys count decoded bytes', () => {
  const raw = '{' + Array.from({ length: 65535 }, (_, index) => `"${index}":0`).join(',') + '}';
  assert.equal(Object.keys(parseMetadataJson(bytes(raw)) as object).length, 65535);
  assert.throws(() => parseMetadataJson(bytes(raw.slice(0, -1) + ',"last":0}')), /node limit/i);
  assert.doesNotThrow(() => parseMetadataJson(bytes('{"' + '\\u0061'.repeat(240) + '":0}')));
  assert.throws(() => parseMetadataJson(bytes('{"' + '\\u0061'.repeat(241) + '":0}')), /key byte/i);
});
test('package original inventory can retain non-source files without admitting them as modules', async () => {
  const f = fixture();
  Object.assign(f.pkg.files, { 'LICENSE.txt': h });
  await admitProjectMetadata(documents(f), toolchain);
  f.pkg.exports.noise.files.push('LICENSE.txt');
  assert.throws(() => validateMetadata('package', f.pkg), /TypeScript path/i);
});

// Literal canonical bytes are independent of both production and fixture encoders.
// In particular, object key "10" must precede "2" despite JS index enumeration.
const numericManifestJson = `{"assets":{},"dependencies":{},"exports":{"noise":{"assets":{},"entry":"src/main.ts","files":["src/main.ts"],"kind":"code","references":[],"sdkVersion":"0.2.0","sourceVersion":2}},"files":{"10":"${h}","2":"${h}","src/main.ts":"${h}"},"format":"lux-package","packageId":"demo/noise","schemaVersion":1,"sdkRange":"0.1.0 || 0.2.0","version":"1.2.3"}`;
const numericInventoryJson = `[["10","${h}"],["2","${h}"],["src/main.ts","${h}"]]`;
test('metadata identity preserves the golden lexical bytes for integer-like object keys', async () => {
  const pkg = fixture().pkg; Object.assign(pkg.files, { '2': h, '10': h });
  const expected = hash(`["lux-project-metadata",1,"package",${numericManifestJson}]`);
  assert.equal(expected, 'e5bb46673e7b154d6286bdc112d62773e2702b95d3c05d535c46c82d61e8e1cf');
  assert.equal(await hashMetadata('package', pkg), expected);
});
test('package identity preserves golden manifest bytes as well as sorted inventory pairs', async () => {
  const pkg = fixture().pkg; Object.assign(pkg.files, { '2': h, '10': h });
  const expected = hash(`["lux-project-package",1,${numericManifestJson},${numericInventoryJson}]`);
  assert.equal(expected, 'f508bfdc20a6bcb58ea5c29386e6cb86b2efc727f953b05da959dd55601b1ad5');
  assert.equal(await hashPackage(pkg, pkg.files), expected);
});
