import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSource } from '../../apps/build-worker/src/source-policy.mjs';
import { sourceBundleSchema } from '../../packages/runtime-contracts/src/index.ts';
export const redAsset = { mediaType:'image/bmp', encoding:'base64', data:'Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA==' };
export const assetSource = () => ({sourceVersion:2,sdkVersion:'0.1.0',entry:'a.ts',files:{'a.ts':'','Z.ts':''},assets:{'assets/red.bmp':{...redAsset}}});

test('source v2 is strict and ASCII canonical while legacy normalization stays byte-identical', () => {
  const old = {sdkVersion:'0.1.0',entry:'a.ts',files:{'Z.ts':'','a.ts':''}};
  assert.equal(JSON.stringify(validateSource(old)),'{"sdkVersion":"0.1.0","entry":"a.ts","files":{"a.ts":"","Z.ts":""}}');
  const admitted = validateSource(assetSource());
  assert.equal(JSON.stringify(admitted),`{"sourceVersion":2,"sdkVersion":"0.1.0","entry":"a.ts","files":{"Z.ts":"","a.ts":""},"assets":{"assets/red.bmp":${JSON.stringify(redAsset)}}}`);
  assert(sourceBundleSchema.safeParse(admitted).success);
  assert.equal(validateSource({...assetSource(),assets:{}}).sourceVersion,2);
  for (const source of [{...assetSource(),sourceVersion:3},{...old,assets:{}},{...assetSource(),extra:1}, {...assetSource(),assets:undefined}]) assert.throws(()=>validateSource(source));
  const inherited = Object.create(assetSource()); assert.throws(()=>validateSource(inherited));
  const getter = assetSource(); Object.defineProperty(getter,'entry',{get(){throw Error('executed');},enumerable:true});
  assert.throws(()=>validateSource(getter), /data properties/);
  const swapped = new Proxy(assetSource(),{get(){throw Error('ordinary property get');}});
  assert.deepEqual(validateSource(swapped),admitted);
});

test('source v2 charges exact escaped compact JSON and validates unused image bytes', () => {
  assert.throws(()=>validateSource({...assetSource(),files:{'a.ts':'\0'.repeat(1048576)}}),{code:'QUOTA_EXCEEDED'});
  assert.throws(()=>validateSource({...assetSource(),assets:{'assets/red.bmp':{...redAsset,data:'broken'}}}),{code:'SOURCE_BOUNDARY_VIOLATION'});
});
