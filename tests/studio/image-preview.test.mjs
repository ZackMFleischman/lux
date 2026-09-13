import test from 'node:test';
import assert from 'node:assert/strict';
import { png } from '../assets/png-fixtures.mjs';
import { handleSourceAdmission } from '../../apps/studio/src/source/admission-worker-handler.mjs';
import * as handler from '../../apps/studio/src/source/admission-worker-handler.mjs';

test('source worker admits a real transparent PNG and rejects truncated originals',()=>{
  const source={sdkVersion:'0.1.0',sourceVersion:2,entry:'a.ts',files:{'a.ts':'export {}'},assets:{'assets/alpha.png':{mediaType:'image/png',encoding:'base64',data:png().toString('base64')}}};
  assert.equal(handleSourceAdmission({id:1,source}).ok,true);
  source.assets['assets/alpha.png'].data=png().subarray(0,50).toString('base64');
  assert.equal(handleSourceAdmission({id:2,source}).ok,false);
});
test('preview worker returns decoded straight-alpha pixels and rejects bad media',()=>{
  assert.equal(typeof handler.handleImagePreview,'function');
  const asset={mediaType:'image/png',encoding:'base64',data:png().toString('base64')};
  const result=handler.handleImagePreview({asset});
  assert.equal(result.ok,true);
  assert.deepEqual([...result.pixels.data],[255,0,0,128]);
  assert.equal(handler.handleImagePreview({asset:{...asset,mediaType:'image/jpeg'}}).ok,false);
});
