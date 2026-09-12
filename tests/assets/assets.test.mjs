import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import * as api from '../../packages/assets/src/index.mjs';

// Independent fixture writer: 3x2 pixels, bottom-up rows with nonzero padding.
function bmp(width = 3, height = 2) {
  const stride = Math.ceil(width * 3 / 4) * 4;
  const bytes = Buffer.alloc(54 + stride * height, 0);
  bytes.write('BM'); bytes.writeUInt32LE(bytes.length, 2);
  bytes.writeUInt32LE(54, 10); bytes.writeUInt32LE(40, 14);
  bytes.writeInt32LE(width, 18); bytes.writeInt32LE(height, 22);
  bytes.writeUInt16LE(1, 26); bytes.writeUInt16LE(24, 28);
  if (width === 3 && height === 2) {
    bytes.set([255,255,0, 255,0,255, 0,255,255, 7,8,9,
      0,0,255, 0,255,0, 255,0,0, 10,11,12], 54);
  }
  return bytes;
}
const descriptor = bytes => ({ mediaType: 'image/bmp', encoding: 'base64', data: bytes.toString('base64') });
const source = bytes => ({ 'assets/checker.bmp': descriptor(bytes ?? bmp()) });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('decodes padded bottom-up BGR rows into top-down opaque RGBA', () => {
  assert.deepEqual(api.validateBmp(bmp()), { width: 3, height: 2, stride: 12, byteLength: 78, rgbaByteLength: 24 });
  assert.deepEqual([...api.decodeBmp(bmp()).data], [255,0,0,255, 0,255,0,255, 0,0,255,255, 0,255,255,255, 255,0,255,255, 255,255,0,255]);
  assert.equal(api.decodeBmp(bmp(512,512)).data.length, 1048576);
  const sized = bmp(); sized.writeUInt32LE(24,34);
  assert.equal(api.validateBmp(sized).width, 3);
  const offset = Buffer.concat([Buffer.alloc(7),bmp(),Buffer.alloc(9)]).subarray(7,85);
  assert.deepEqual(api.decodeBmp(offset),api.decodeBmp(bmp()));
});

test('rejects malformed BMP headers, unsupported variants and trailing pixels', () => {
  const cases = [[0,0,1], [2,77,4], [6,1,2], [8,1,2], [10,55,4], [14,108,4],
    [18,0,4], [18,513,4], [18,0xffffffff,4], [22,0,4], [22,513,4], [22,0xfffffffe,4],
    [26,2,2], [28,32,2], [30,1,4], [34,23,4], [46,1,4], [50,1,4]];
  for (const [offset,value,size] of cases) {
    const bytes = bmp(); bytes.writeUIntLE(value,offset,size);
    assert.throws(() => api.validateBmp(bytes), undefined, `field ${offset}: ${value}`);
  }
  for (const bytes of [Buffer.alloc(0), bmp().subarray(0,53), bmp().subarray(0,77), Buffer.concat([bmp(),Buffer.from([0])])]) {
    assert.throws(() => api.decodeBmp(bytes));
  }
});

test('base64 rejects noncanonical alphabets, padding and overlong input before decoding', () => {
  for (const value of ['', 'A', 'AA', 'AAA', 'A===', 'AA=A', 'AAAA=', 'AB==', 'AAB=', ' AA==', 'AA==\n', '_A==', '-A==', 'data:image/bmp;base64,AA==', 'A'.repeat(1048652)]) {
    assert.throws(() => api.decodeCanonicalBase64(value), undefined, value.slice(0,30));
  }
  assert.deepEqual([...api.decodeCanonicalBase64('AA==')], [0]);
  assert.deepEqual([...api.decodeCanonicalBase64('AAA=')], [0,0]);
  assert.deepEqual(api.decodeCanonicalBase64(bmp().toString('base64')), new Uint8Array(bmp()));
});

test('paths reject capabilities, device names, reserved segments and case collisions', () => {
  for (const path of ['x.bmp','/assets/x.bmp','assets\\x.bmp','assets/../x.bmp','assets//x.bmp','assets/a.b.bmp',
    'assets/x.BMP','assets/x%20.bmp','assets/x:y.bmp','assets/é.bmp','assets/con.bmp','assets/AUX/a.bmp',
    'assets/com9.bmp','assets/__lux/x.bmp','assets/__lux-secret.bmp','assets/\nx.bmp','assets/'+ 'a'.repeat(234)+'.bmp']) {
    assert.throws(() => api.validateAssetPath(path), undefined, path);
  }
  assert.equal(api.validateAssetPath('assets/Sub_1/A-2.bmp'), 'assets/Sub_1/A-2.bmp');
  assert.throws(() => api.validateSourceAssets({ 'assets/A.bmp': descriptor(bmp()), 'assets/a.bmp': descriptor(bmp()) }));
});

test('strict plain data records reject prototypes, accessors, symbols and unknown fields', () => {
  const getter = { ...descriptor(bmp()) }; Object.defineProperty(getter,'data',{get(){throw Error('getter executed');},enumerable:true});
  for (const input of [null, [], new Map(), Object.create(source()), {'assets/x.bmp':getter},
    { 'assets/x.bmp': {...descriptor(bmp()), width:3} }, { 'assets/x.bmp': {...descriptor(bmp()), encoding:'url'} },
    { 'assets/x.bmp': {...descriptor(bmp()), mediaType:'image/png'} }, { [Symbol()]: 1 }]) {
    assert.throws(() => api.validateSourceAssets(input), error => error.code === 'ASSET_BOUNDARY_VIOLATION');
  }
  const hidden = source(); Object.defineProperty(hidden,'hidden',{value:1});
  assert.throws(() => api.validateSourceAssets(hidden));
  const nullRecord = Object.assign(Object.create(null),source());
  assert.equal(api.validateSourceAssets(nullRecord)['assets/checker.bmp'].data, descriptor(bmp()).data);
  assert.deepEqual(api.validateSourceAssets({}), {});
});

test('all declared images count towards rejection quotas and records are canonical immutable snapshots', () => {
  const input = {'assets/z.bmp':descriptor(bmp()), 'assets/Z.bmp':descriptor(bmp())};
  delete input['assets/z.bmp']; input['assets/a.bmp'] = descriptor(bmp());
  const admitted = api.validateSourceAssets(input);
  assert.deepEqual(Object.keys(admitted), ['assets/Z.bmp','assets/a.bmp']);
  assert(Object.isFrozen(admitted)); assert(Object.isFrozen(admitted['assets/Z.bmp']));
  input['assets/Z.bmp'].data = '';
  assert.notEqual(admitted['assets/Z.bmp'].data, '');
  assert.throws(() => api.validateSourceAssets(Object.fromEntries([1,2,3,4,5].map(i=>[`assets/a${i}.bmp`,descriptor(bmp())]))), {code:'QUOTA_EXCEEDED'});
  assert.throws(() => api.validateSourceAssets({'assets/a.bmp':descriptor(bmp(512,512)), 'assets/b.bmp':descriptor(bmp(512,256))}), {code:'QUOTA_EXCEEDED'});
  assert.throws(() => api.validateSourceAssets({'assets/a.bmp':descriptor(bmp()), 'assets/unused.bmp':descriptor(Buffer.from('broken'))}));
});

test('derived identities cover exact original file bytes and reject forged metadata', async () => {
  const result = await api.deriveAssets(source(),hash);
  const d = result.assets['assets/checker.bmp'];
  assert.equal(d.sha256, hash(bmp())); assert.equal(d.byteLength,78); assert.equal(d.width,3); assert.equal(d.height,2);
  const identity = `[{"path":"assets/checker.bmp","mediaType":"image/bmp","byteLength":78,"sha256":"${hash(bmp())}","width":3,"height":2}]`;
  assert.equal(api.canonicalAssetSet(result.assets),identity);
  assert.equal(result.assetSetHash,hash(Buffer.from(identity)));
  assert.deepEqual((await api.verifyDerivedAssets(result.assets,result.assetSetHash,hash)).sourceAssets,source());
  for (const [field,value] of [['sha256','0'.repeat(64)],['byteLength',77],['width',2],['height',3],['unknown',true]]) {
    await assert.rejects(api.verifyDerivedAssets({'assets/checker.bmp':{...d,[field]:value}},result.assetSetHash,hash));
  }
  await assert.rejects(api.verifyDerivedAssets(result.assets,'0'.repeat(64),hash));
  await assert.rejects(api.verifyDerivedAssets(source(),result.assetSetHash,hash));
  await assert.rejects(api.deriveAssets(source(),()=> 'not-sha256'));
  const changed = bmp(); changed[54] ^= 1;
  assert.notEqual((await api.deriveAssets(source(changed),hash)).assetSetHash,result.assetSetHash);
  assert.equal((await api.deriveAssets({},hash)).assetSetHash,hash(Buffer.from('[]')));
});

test('canonical asset-set has a fixed interoperable byte and SHA-256 vector', async () => {
  const assets = {'assets/red.bmp':{mediaType:'image/bmp',encoding:'base64',data:'Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA=='}};
  const result = await api.deriveAssets(assets,hash);
  assert.equal(result.assets['assets/red.bmp'].sha256,'364d075814e300bdfe607a2f4e52dc4117373cc5d02793f18e4a0cb16b9b10a7');
  assert.equal(api.canonicalAssetSet(result.assets),'[{"path":"assets/red.bmp","mediaType":"image/bmp","byteLength":58,"sha256":"364d075814e300bdfe607a2f4e52dc4117373cc5d02793f18e4a0cb16b9b10a7","width":1,"height":1}]');
  assert.equal(result.assetSetHash,'ba26d9a92423b9e3ba6cbc73c0548a730196f68d40f4096556bff8e1e8ccda90');
});

test('asynchronous hashing snapshots input and sorts derived paths in ASCII order', async () => {
  const input = {'assets/a.bmp':descriptor(bmp()), 'assets/Z.bmp':descriptor(bmp())};
  const pending = api.deriveAssets(input,async bytes=>hash(bytes));
  input['assets/Z.bmp'].data=''; delete input['assets/a.bmp'];
  const result = await pending;
  assert.deepEqual(Object.keys(result.assets),['assets/Z.bmp','assets/a.bmp']);
  assert.equal(result.assets['assets/Z.bmp'].data,descriptor(bmp()).data);
  assert(Object.isFrozen(result)); assert(Object.isFrozen(result.assets)); assert(Object.isFrozen(result.assets['assets/Z.bmp']));
  const verified = await api.verifyDerivedAssets(result.assets,result.assetSetHash,async bytes=>hash(bytes));
  assert.deepEqual(Object.keys(verified.sourceAssets),['assets/Z.bmp','assets/a.bmp']);
});

test('admission snapshots checked descriptors and readmits under changing Proxy get traps', () => {
  const original = source(); let reads = 0;
  const swappingDescriptor = new Proxy({...original['assets/checker.bmp']}, {
    get(target,key) { return key === 'data' && ++reads > 1 ? '' : Reflect.get(target,key); },
  });
  const admitted = api.validateSourceAssets({'assets/checker.bmp':swappingDescriptor});
  assert.deepEqual(api.validateSourceAssets(admitted),original);
  assert.equal(reads,0);

  const changed = bmp(); changed[54] ^= 123;
  const swappingRecord = new Proxy(original, {get() { return descriptor(changed); }});
  assert.deepEqual(api.validateSourceAssets(swappingRecord),original);
});

test('verification binds projected facade bytes to checked data and metadata under Proxy substitution', async () => {
  const original = await api.deriveAssets(source(),hash);
  const changed = bmp(); changed[54] ^= 123;
  let reads = 0;
  const swappingData = new Proxy({...original.assets['assets/checker.bmp']}, {
    get(target,key) { return key === 'data' && ++reads > 1 ? changed.toString('base64') : Reflect.get(target,key); },
  });
  const verified = await api.verifyDerivedAssets({'assets/checker.bmp':swappingData},original.assetSetHash,hash);
  const bytes = api.createReadonlyAssetMap(verified.sourceAssets).get('assets/checker.bmp');
  assert.equal(hash(bytes),verified.assets['assets/checker.bmp'].sha256);
  assert.deepEqual(await api.deriveAssets(verified.sourceAssets,hash),original);
  assert.equal(reads,0);

  for (const [field,replacement] of [['byteLength',1],['width',512],['height',512],['sha256','f'.repeat(64)],['mediaType','image/png'],['encoding','url']]) {
    const swappingMetadata = new Proxy({...original.assets['assets/checker.bmp']}, {
      get(target,key) { return key === field ? replacement : Reflect.get(target,key); },
    });
    const result = await api.verifyDerivedAssets({'assets/checker.bmp':swappingMetadata},original.assetSetHash,hash);
    assert.deepEqual(result.assets,original.assets,field);
    assert.deepEqual(api.validateSourceAssets(result.sourceAssets),source(),field);
  }
});

test('readonly facade isolates get, iteration, forEach, input mutation and independent candidates', () => {
  const input = source(); const map = api.createReadonlyAssetMap(input); const other = api.createReadonlyAssetMap(input);
  assert(Object.isFrozen(map)); assert.equal(map.size,1); assert.equal(map.set,undefined); assert.equal(map.delete,undefined);
  assert.equal(map.has('assets/checker.bmp'),true); assert.equal(map.has('missing'),false); assert.equal(map.get('missing'),undefined);
  for (const bytes of [map.get('assets/checker.bmp'),...map.values(),...Array.from(map.entries(),e=>e[1]),...Array.from(map,e=>e[1])]) bytes.fill(0);
  let context; map.forEach(function(value,key,facade) { context=this; assert.equal(facade,map); assert.equal(key,'assets/checker.bmp'); value.fill(0); },input);
  assert.equal(context,input); input['assets/checker.bmp'].data='';
  assert.deepEqual(map.get('assets/checker.bmp'),new Uint8Array(bmp()));
  assert.deepEqual(other.get('assets/checker.bmp'),new Uint8Array(bmp()));
  assert.deepEqual([...map.keys()],['assets/checker.bmp']);
  assert.equal(api.createReadonlyAssetMap({}).size,0);
});

test('facade retains private bytes under replaced intrinsics, prototype methods and species hooks', () => {
  const map = api.createReadonlyAssetMap(source());
  const restore = [];
  let intercepted = 0;
  const poison = function() { intercepted++; throw Error('untrusted intrinsic called'); };
  const patch = (target,key,descriptor) => {
    const original = Object.getOwnPropertyDescriptor(target,key);
    Object.defineProperty(target,key,{configurable:true,...descriptor});
    restore.push(()=> original ? Object.defineProperty(target,key,original) : delete target[key]);
  };
  const typedProto = Object.getPrototypeOf(Uint8Array.prototype);
  const values = []; let callbackMap; let resultSize; let resultHas; let missing;
  try {
    for (const key of ['slice','subarray','set','values','entries','keys','forEach']) patch(typedProto,key,{value:poison});
    patch(typedProto,'buffer',{get:poison}); patch(typedProto,'length',{get:poison});
    patch(Uint8Array.prototype,'constructor',{get:poison}); patch(Uint8Array,Symbol.species,{get:poison});
    for (const key of ['get','has','values','entries','keys','forEach']) patch(Map.prototype,key,{value:poison});
    patch(Map.prototype,Symbol.iterator,{value:poison});
    patch(Array.prototype,Symbol.iterator,{value:poison});
    patch(Array.prototype,'slice',{value:poison}); patch(Array.prototype,'map',{value:poison});
    patch(Function.prototype,'call',{value:poison}); patch(Function.prototype,'apply',{value:poison});
    patch(globalThis,'Map',{value:poison}); patch(globalThis,'Uint8Array',{value:poison});
    patch(Object,'freeze',{value:poison}); patch(Object,'create',{value:poison}); patch(Reflect,'apply',{value:poison});
    values[0]=map.get('assets/checker.bmp');
    values[1]=map.values().next().value;
    values[2]=map.entries().next().value[1];
    values[3]=map[Symbol.iterator]().next().value[1];
    const keys = map.keys(); if(keys.next().value !== 'assets/checker.bmp' || !keys.next().done) throw Error('key iteration');
    map.forEach((bytes,key,facade)=>{values[4]=bytes;callbackMap=facade;});
    resultSize=map.size; resultHas=map.has('assets/checker.bmp'); missing=map.get('missing');
    for(let i=0;i<5;i++) values[i][0]=0;
    values[5]=map.get('assets/checker.bmp');
  } finally {
    // Restoration itself must not consult patched call/apply/array iteration.
    for(let i=restore.length-1;i>=0;i--) restore[i]();
  }
  assert.equal(intercepted,0); assert.equal(callbackMap,map); assert.equal(resultSize,1); assert.equal(resultHas,true); assert.equal(missing,undefined);
  assert.deepEqual(values[5],new Uint8Array(bmp()));
  assert.deepEqual(map.get('assets/checker.bmp'),new Uint8Array(bmp()));
});
