import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as assets from '../../packages/assets/src/index.mjs';
import { png } from './png-fixtures.mjs';
import { fixture, exif, insert } from './jpeg-fixtures.mjs';
import { sourceAssetSchema } from '../../packages/runtime-contracts/src/index.ts';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const descriptor = (mediaType, bytes) => ({mediaType,encoding:'base64',data:Buffer.from(bytes).toString('base64')});

test('production admission preserves PNG/JPEG originals and validates derived oriented dimensions', async () => {
  const original = {'assets/alpha.png':descriptor('image/png',png()),'assets/photo.jpg':descriptor('image/jpeg',insert(fixture('baseline'),exif(6)))};
  const admitted = assets.validateSourceAssets(original);
  assert.deepEqual(admitted,original);
  assert.equal(sourceAssetSchema.safeParse(original['assets/alpha.png']).success,true,'PNG wire contract');
  assert.equal(sourceAssetSchema.safeParse(original['assets/photo.jpg']).success,true,'JPEG wire contract');
  const derived = await assets.deriveAssets(original,hash);
  assert.equal(derived.assets['assets/alpha.png'].width,1);
  assert.equal(derived.assets['assets/alpha.png'].sha256,hash(png()));
  assert.deepEqual((await assets.verifyDerivedAssets(derived.assets,derived.assetSetHash,hash)).sourceAssets,original);
  const corrupt = structuredClone(derived.assets); corrupt['assets/photo.jpg'].width++;
  await assert.rejects(assets.verifyDerivedAssets(corrupt,derived.assetSetHash,hash));
});

test('production admission rejects extension/media mismatch and malformed compressed input', () => {
  for (const input of [
    {'assets/a.png':descriptor('image/jpeg',fixture('baseline'))},
    {'assets/a.jpg':descriptor('image/png',png())},
    {'assets/a.png':descriptor('image/png',png().subarray(0,50))},
  ]) assert.throws(()=>assets.validateSourceAssets(input),{code:'ASSET_BOUNDARY_VIOLATION'});
});

test('trusted decoded facade retains straight alpha and returns isolated copies', () => {
  const source = {'assets/alpha.png':descriptor('image/png',png({width:2,rows:[0,255,0,0,128,23,45,67,0]}))};
  const map = assets.createReadonlyImageMap(source);
  const first = map.get('assets/alpha.png');
  assert.deepEqual({...first,data:[...first.data]},{width:2,height:1,colorSpace:'srgb',alphaMode:'straight',data:[255,0,0,128,23,45,67,0]});
  first.data.fill(0);
  source['assets/alpha.png'].data = '';
  assert.deepEqual([...map.get('assets/alpha.png').data],[255,0,0,128,23,45,67,0]);
  assert.equal(map.get('missing'),undefined);
  assert.equal(map.size,1);
});
