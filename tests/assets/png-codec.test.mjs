import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync, inflateSync, constants } from 'node:zlib';
import { unzlibSync } from 'fflate';
import * as codec from '../../packages/assets/src/png.mjs';
import { png, chunk, u32 } from './png-fixtures.mjs';

test('PNG returns straight sRGB alpha and preserves caller bytes', () => {
  assert.equal(typeof codec.decodePng, 'function');
  const bytes = png({width:2, rows:[0,255,12,34,0,11,222,33,128]});
  const copy = Buffer.from(bytes), image = codec.decodePng(bytes);
  assert.deepEqual(image, {width:2,height:1,colorSpace:'srgb',alphaMode:'straight',data:new Uint8Array([255,12,34,0,11,222,33,128])});
  assert.deepEqual(bytes,copy);
});

test('grayscale, RGB and grayscale-alpha decode including color-key transparency', () => {
  for (const [options, want] of [
    [{type:0,width:2,rows:[0,12,34],before:[chunk('tRNS',[0,12])]},[12,12,12,0,34,34,34,255]],
    [{type:2,width:2,rows:[0,1,2,3,4,5,6],before:[chunk('tRNS',[0,1,0,2,0,3])]},[1,2,3,0,4,5,6,255]],
    [{type:2,rows:[0,1,2,3],before:[chunk('tRNS',[0,1,0,2,0,3])]},[1,2,3,0]],
    [{type:4,width:2,rows:[0,12,0,34,128]},[12,12,12,0,34,34,34,128]],
  ]) assert.deepEqual([...codec.decodePng(png(options)).data],want);
});

test('packed indexed rows restart at each odd row boundary at every supported depth', () => {
  for (const [depth, rows] of [[1,[0,0x40,0,0xa0]],[2,[0,0x10,0,0x44]],[4,[0,0x01,0,0,0x10,0x10]],[8,[0,0,1,0,0,1,0,1]]]) {
    const bytes = png({type:3,depth,width:3,height:2,rows,before:[chunk('PLTE',[255,0,0,0,255,0]),chunk('tRNS',[0,128])]});
    assert.deepEqual([...codec.decodePng(bytes).data],[255,0,0,0,0,255,0,128,255,0,0,0,0,255,0,128,255,0,0,0,0,255,0,128]);
  }
});

test('strict chunk boundaries, CRC, dimensions, palette and unsupported modes fail', () => {
  const badCrc = png(); badCrc[29] ^= 1;
  const cases = [badCrc,png().subarray(0,-1),Buffer.concat([png(),Buffer.from([0])]),png({width:513}),png({width:0}),png({depth:16}),png({interlace:1}),
    png({before:[chunk('acTL',new Uint8Array(8))]}),png({before:[chunk('iCCP',[1])]}),png({before:[chunk('zTXt',[1])]}),png({before:[chunk('iTXt',[1])]}),png({before:[chunk('ABCD')]}),
    png({before:[chunk('sRGB',[0]),chunk('sRGB',[0])]}),png({before:[chunk('gAMA',u32(100000))]}),png({before:[chunk('tRNS',[0,1])]}),
    png({type:3,rows:[0,0]}),png({type:3,rows:[0,1],before:[chunk('PLTE',[255,0,0])]}),
    png({before:[chunk('tEXt',new Uint8Array(65537))]}),png({after:Array.from({length:254},()=>chunk('tEXt',[65,0]))}),
    png({after:[chunk('tEXt',[65,0]),chunk('IDAT')]}),
  ];
  for (const [index,bytes] of cases.entries()) assert.throws(()=>codec.decodePng(bytes),{code:'ASSET_BOUNDARY_VIOLATION'},`case ${index}`);
  assert.deepEqual([...codec.decodePng(png({after:[chunk('IDAT')]})).data],[255,0,0,128]);
});

test('tiny RGB tRNS fix retains exact type-specific lengths', () => {
  for (const type of [0,2]) for (const length of [0,1,2,3,4,5,6,7,8]) {
    if (length === (type === 0 ? 2 : 6)) continue;
    assert.throws(()=>codec.decodePng(png({type,rows:type === 0 ? [0,1] : [0,1,2,3],before:[chunk('tRNS',new Uint8Array(length))]})),{code:'ASSET_BOUNDARY_VIOLATION'});
  }
});

test('all PNG filter modes reconstruct independently specified grayscale rows', () => {
  // Row 1 is 10,20,30; row 2 is 15,25,35. Filter bytes are hand-derived.
  for (const row of [[0,15,25,35],[1,15,10,10],[2,5,5,5],[3,10,8,8],[4,5,5,5]]) {
    const result = codec.decodePng(png({type:0,width:3,height:2,rows:[0,10,20,30,...row]}));
    assert.deepEqual([...result.data],[10,10,10,255,20,20,20,255,30,30,30,255,15,15,15,255,25,25,25,255,35,35,35,255]);
  }
});

test('admitted metadata remains bounded and sRGB declarations are explicit', () => {
  const standard = [31270,32900,64000,33000,30000,60000,15000,6000];
  assert.deepEqual([...codec.decodePng(png({before:[chunk('sRGB',[3]),chunk('gAMA',u32(45455)),chunk('cHRM',Buffer.concat(standard.map(u32))),chunk('pHYs',[0,0,0,1,0,0,0,1,1]),chunk('tEXt',[65,0,66])],after:[chunk('tIME',[7,232,2,29,23,59,60])]})).data],[255,0,0,128]);
  for (const bad of [chunk('sRGB',[4]),chunk('gAMA',[1]),chunk('cHRM',new Uint8Array(32)),chunk('pHYs',new Uint8Array(8)),chunk('pHYs',[0,0,0,0,0,0,0,0,2]),chunk('tEXt',[0]),chunk('tEXt',[32,65,0]),chunk('tEXt',[65,32,32,66,0]),chunk('tEXt',[65,0,0]),chunk('tIME',[7,233,2,29,0,0,0])]) {
    assert.throws(()=>codec.decodePng(png({before:[bad]})),{code:'ASSET_BOUNDARY_VIOLATION'});
  }
  for (const before of [[chunk('PLTE',[1,2])],[chunk('PLTE',new Uint8Array(771))],[chunk('PLTE',[1,2,3]),chunk('tRNS',[0,1])]]) {
    assert.throws(()=>codec.decodePng(png({type:3,rows:[0,0],before})),{code:'ASSET_BOUNDARY_VIOLATION'});
  }
  assert.throws(()=>codec.decodePng(new Uint8Array(786487)),{code:'QUOTA_EXCEEDED'});
});

test('accepted zlib corpus agrees with independent native inflate and fflate', () => {
  let state = 0x12345678, accepted = 0;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state >>> 0; };
  for (const size of [1,17,129]) for (const strategy of [constants.Z_DEFAULT_STRATEGY,constants.Z_FIXED,constants.Z_HUFFMAN_ONLY]) for (const level of [0,1,9]) {
    const rows = new Uint8Array(size*(size+1));
    for (let y = 0; y < size; y++) for (let x = 1; x <= size; x++) rows[y*(size+1)+x] = random() & 255;
    const compressed = deflateSync(rows,{strategy,level});
    const variants = [compressed];
    for (let i = 0; i < 24; i++) { const mutation = Buffer.from(compressed); mutation[random()%mutation.length] ^= 1<<(random()%8); variants.push(mutation); }
    for (const candidate of variants) {
      let image;
      try { image = codec.decodePng(png({type:0,width:size,height:size,compressed:candidate,split:true})); }
      catch (error) { assert.equal(error.code,'ASSET_BOUNDARY_VIOLATION'); continue; }
      accepted++;
      const native = inflateSync(candidate);
      assert.deepEqual(unzlibSync(candidate),new Uint8Array(native));
      assert.equal(native.length,rows.length);
      // Every valid, unmutated fixture has filter 0 and an independent pixel oracle.
      if (candidate === compressed) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) assert.equal(image.data[(y*size+x)*4],rows[y*(size+1)+x+1]);
    }
  }
  assert.ok(accepted >= 27);
});

test('bounded zlib requires exact output, Adler, filters, one complete stream and no dictionary', () => {
  const valid = deflateSync(Buffer.from([0,255,0,0,128]));
  const badAdler = Buffer.from(valid); badAdler[badAdler.length-1] ^= 1;
  for (const compressed of [badAdler,valid.subarray(0,-1),Buffer.concat([valid,valid]),Buffer.concat([valid,Buffer.from([0])]),
    deflateSync(Buffer.from([0,255,0,0])),deflateSync(Buffer.from([0,255,0,0,128,0])),deflateSync(Buffer.from([5,255,0,0,128])),
    deflateSync(new Uint8Array(2_000_000)),deflateSync(Buffer.from([0,255,0,0,128]),{dictionary:Buffer.from('dictionary')})]) {
    assert.throws(()=>codec.decodePng(png({compressed})),{code:'ASSET_BOUNDARY_VIOLATION'});
  }
  assert.deepEqual([...codec.decodePng(png({split:true})).data],[255,0,0,128]);
});

test('RGBA allocation budget is enforced before decode and metadata retains original byte length', () => {
  const bytes = png();
  assert.throws(()=>codec.decodePng(bytes,{maxRgbaBytes:3}),{code:'QUOTA_EXCEEDED'});
  assert.deepEqual(codec.validatePng(bytes),{width:1,height:1,byteLength:bytes.length,rgbaByteLength:4});
  class DisguisedBytes extends Uint8Array { get byteLength() { return 1; } }
  assert.throws(()=>codec.decodePng(new DisguisedBytes(786487)),{code:'QUOTA_EXCEEDED'});
  const backing = new ArrayBuffer(bytes.length,{maxByteLength:800000});
  const growing = new Uint8Array(backing); growing.set(bytes);
  assert.throws(()=>codec.decodePng(growing,{get maxRgbaBytes() { backing.resize(786487); return 2097152; }}),{code:'QUOTA_EXCEEDED'});
});
