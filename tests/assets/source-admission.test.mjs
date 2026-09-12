import test from 'node:test';
import assert from 'node:assert/strict';
import * as policy from '../../apps/build-worker/src/source-policy.mjs';
const red = 'Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA==';
const source = (data = red, sdkVersion = '0.1.0') => ({sourceVersion:2,sdkVersion,entry:'main.ts',files:{'main.ts':'export {}'},assets:{'assets/red.bmp':{mediaType:'image/bmp',encoding:'base64',data}}});

test('cheap source envelope never certifies malformed image bytes', () => {
  assert.equal(typeof policy.validateSourceEnvelope,'function');
  const malformed = source('AA==');
  assert.equal(policy.validateSourceEnvelope(malformed).assets['assets/red.bmp'].data,'AA==');
  assert.throws(()=>policy.validateSource(malformed),{code:'SOURCE_BOUNDARY_VIOLATION'});
  assert.deepEqual(policy.validateSource(source()),source());
});

test('envelope snapshots descriptors, SDK versions and path/serialized budgets without image decoding', () => {
  for (const sdkVersion of ['0.1.0','0.2.0']) assert.equal(policy.validateSourceEnvelope(source(red,sdkVersion)).sdkVersion,sdkVersion);
  const input = source(), envelope = policy.validateSourceEnvelope(input);
  input.assets['assets/red.bmp'].data = 'caller mutation';
  assert.equal(envelope.assets['assets/red.bmp'].data,red);
  for (const bad of [
    {...source(),sdkVersion:'0.3.0'},
    {...source(),assets:{'assets/red.png':{mediaType:'image/png',encoding:'base64',data:red}}},
    {...source(),assets:{'assets/red.bmp':{...source().assets['assets/red.bmp'],extra:true}}},
    {...source(),assets:{...source().assets,'assets/Red.bmp':source().assets['assets/red.bmp']}},
    {...source(),assets:{'assets/red.bmp':{mediaType:'image/bmp',encoding:'base64',get data(){throw Error('getter invoked');}}}},
  ]) assert.throws(()=>policy.validateSourceEnvelope(bad));
  assert.throws(()=>policy.validateSourceEnvelope(source('A'.repeat(1048652))),{code:'QUOTA_EXCEEDED'});
  const OriginalDataView = globalThis.DataView;
  try {
    globalThis.DataView = class { constructor() { throw Error('image-header decoding disabled'); } };
    assert.equal(policy.validateSourceEnvelope(source()).assets['assets/red.bmp'].data,red);
    assert.throws(()=>policy.validateSource(source()),/image-header decoding disabled/);
  } finally { globalThis.DataView = OriginalDataView; }
});
