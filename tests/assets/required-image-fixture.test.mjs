import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { decodeBmp, decodeCanonicalBase64, createReadonlyAssetMap } from '../../packages/assets/src/index.mjs';

const document = JSON.parse(await readFile(new URL('../fixtures/installed-sources/required-image/scene.lux-scene', import.meta.url), 'utf8'));
function load(path, require = () => { throw Error('Unexpected import'); }) {
  const code = transformSync(document.source.files[path], { loader: 'ts', format: 'cjs', target: 'es2022' }).code;
  const module = { exports: {} };
  vm.runInNewContext(code, { exports: module.exports, module, require, Uint8Array, DataView });
  return module.exports;
}
test('required-image helper decodes the exact asset, including asymmetric rows and padding', () => {
  const bytes = decodeCanonicalBase64(document.source.assets['assets/checker.bmp'].data);
  const expected = [255,0,0,255, 0,255,0,255, 0,0,255,255, 0,255,255,255, 255,0,255,255, 255,255,0,255];
  const trusted = decodeBmp(bytes), fixture = load('bmp.ts').decodeBmp(bytes);
  assert.deepEqual([...fixture.data], expected);
  assert.deepEqual([...fixture.data], [...trusted.data]);
  assert.equal(fixture.width, 3); assert.equal(fixture.height, 2);
  for (const change of [b => b[0] = 0, b => b[28] = 32, b => b[30] = 1, b => b[18] = 0]) {
    const invalid = new Uint8Array(bytes); change(invalid);
    assert.throws(() => load('bmp.ts').decodeBmp(invalid));
  }
  assert.throws(() => load('bmp.ts').decodeBmp(bytes.subarray(0, bytes.length - 1)));
});
test('fixture requires its image, uses its bytes for the displayed material and disposes the texture', async () => {
  const textures = [], materials = [], geometries = [];
  class Texture { constructor(data, width, height) { Object.assign(this, { data, width, height }); textures.push(this); } dispose() { this.disposed = true; } }
  class Material { constructor() { materials.push(this); } dispose() { this.disposed = true; } }
  class Geometry { constructor() { geometries.push(this); } dispose() { this.disposed = true; } }
  class Scene { add(mesh) { this.mesh = mesh; } }
  class Mesh { constructor(geometry, material) { Object.assign(this, { geometry, material }); } }
  const three = { DataTexture: Texture, MeshBasicNodeMaterial: Material, PlaneGeometry: Geometry,
    Scene, Mesh, OrthographicCamera: class {}, NearestFilter: 'nearest', SRGBColorSpace: 'srgb', RGBAFormat: 'rgba', UnsignedByteType: 'byte' };
  const visual = load('visual.ts', name => name === '@lux/visual-sdk' ? { defineVisual: value => value }
    : name === 'three/webgpu' ? three : name === './bmp.ts' ? load('bmp.ts') : assert.fail(`Unexpected import ${name}`)).default;
  await assert.rejects(visual.create({ assets: new Map() }), /Missing required asset: assets\/checker.bmp/);
  assert.equal(textures.length, 0);
  let rendered;
  const instance = await visual.create({ assets: createReadonlyAssetMap(document.source.assets), renderer: { render: (...args) => { rendered = args; } } });
  assert.deepEqual([...textures[0].data], [...decodeBmp(decodeCanonicalBase64(document.source.assets['assets/checker.bmp'].data)).data]);
  assert.equal(materials[0].map, textures[0]);
  assert.equal(textures[0].minFilter, 'nearest'); assert.equal(textures[0].magFilter, 'nearest');
  assert.equal(textures[0].colorSpace, 'srgb'); assert.equal(textures[0].flipY, true);
  const target = {}; await instance.render(target);
  assert.equal(rendered[0].mesh.material.map, textures[0]); assert.equal(rendered[2], target);
  instance.dispose(); assert.ok(textures[0].disposed && materials[0].disposed && geometries[0].disposed);
});
