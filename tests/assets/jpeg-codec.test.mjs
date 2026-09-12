import test from 'node:test';
import assert from 'node:assert/strict';
import * as codec from '../../packages/assets/src/jpeg.mjs';
import { fixture,segment,insert,exif,findSegment,restartGray,progressiveGray } from './jpeg-fixtures.mjs';

test('baseline and progressive independent JPEG fixtures decode opaque sRGB', () => {
  assert.equal(typeof codec.decodeJpeg,'function');
  for (const name of ['baseline','progressive']) {
    const bytes = fixture(name), copy = new Uint8Array(bytes), image = codec.decodeJpeg(bytes);
    assert.equal(image.width,32); assert.equal(image.height,24);
    assert.equal(image.alphaMode,'straight'); assert.equal(image.colorSpace,'srgb');
    for (let y = 0; y < 24; y++) for (let x = 0; x < 32; x++) {
      const want = x < 16 ? [230,20,40] : [20,200,70], at = (y*32+x)*4;
      for (let c = 0; c < 3; c++) assert.ok(Math.abs(image.data[at+c]-want[c]) <= 2);
      assert.equal(image.data[at+3],255);
    }
    assert.deepEqual(bytes,copy);
  }
});

test('EXIF orientations 1..8 are applied with checked endian TIFF and swapped dimensions', () => {
  const expected = [[10,40,70,100,130,160],[70,40,10,160,130,100],[160,130,100,70,40,10],[100,130,160,10,40,70],[10,100,40,130,70,160],[100,10,130,40,160,70],[160,70,130,40,100,10],[70,160,40,130,10,100]];
  for (const little of [true,false]) for (let orientation = 1; orientation <= 8; orientation++) {
    const bytes = insert(fixture('gray'),exif(orientation,little)), image = codec.decodeJpeg(bytes);
    assert.equal(image.width,orientation >= 5 ? 2 : 3); assert.equal(image.height,orientation >= 5 ? 3 : 2);
    for (let i = 0; i < 6; i++) for (let c = 0; c < 3; c++) assert.ok(Math.abs(image.data[i*4+c]-expected[orientation-1][i]) <= 1);
    assert.deepEqual(codec.validateJpeg(bytes),{width:image.width,height:image.height,byteLength:bytes.length,rgbaByteLength:24});
  }
});

test('JPEG rejects invalid marker boundaries, frame dimensions, sampling, tables and profiles', () => {
  const original = fixture('baseline'), sof = findSegment(original,0xc0), sos = findSegment(original,0xda), dqt = findSegment(original,0xdb), dht = findSegment(original,0xc4);
  const mutations = [[sof+4,12],[sof+5,2],[sof+7,2],[sof+9,4],[sof+11,0],[sof+11,0x41],[sof+12,4],[sos+5,99],[sos+6,0x44],[dqt+5,0],[dht+4,0x40],[dht+5,255]];
  const cases = [original.subarray(0,-1),Buffer.concat([original,Buffer.from([0])]),Buffer.concat([original,original]),
    insert(original,segment(0xe2,Buffer.from('ICC_PROFILE\0'))),insert(original,exif(0)),insert(original,exif(9)),insert(original,exif(1),exif(2)),
    insert(original,segment(0xc1,[8,0,1,0,1,1,1,0x11,0])),insert(original,segment(0xfe,new Uint8Array(40000)),segment(0xfe,new Uint8Array(30000))),
  ];
  for (const [at,value] of mutations) { const bytes = new Uint8Array(original); bytes[at] = value; cases.push(bytes); }
  for (const [i,bytes] of cases.entries()) assert.throws(()=>codec.decodeJpeg(bytes),{code:'ASSET_BOUNDARY_VIOLATION'},`case ${i}`);
});

test('JPEG pixel/file budgets are checked before decoder allocation', () => {
  assert.throws(()=>codec.decodeJpeg(fixture('gray'),{maxRgbaBytes:23}),{code:'QUOTA_EXCEEDED'});
  assert.throws(()=>codec.decodeJpeg(new Uint8Array(786487)),{code:'QUOTA_EXCEEDED'});
});

test('grayscale restart decoding handles a final partial interval', () => {
  const image = codec.decodeJpeg(restartGray());
  assert.equal(image.width,24); assert.equal(image.height,8);
  for (let i = 0; i < image.data.length; i++) assert.equal(image.data[i],i%4 === 3 ? 255 : 128);
});

test('strict JPEG entropy admission rejects unused bytes and non-one padding', () => {
  for (const entropy of [[0x3f,0],[0x3f,255,0],[0x30]]) {
    assert.throws(()=>codec.decodeJpeg(restartGray({width:8,restart:0,entropy})),{code:'ASSET_BOUNDARY_VIOLATION'});
  }
  // Four ZRL symbols would skip 64 AC positions, but only 63 exist.
  assert.throws(()=>codec.decodeJpeg(restartGray({width:8,restart:0,ac:0xf0,entropy:[0x07]})),{code:'ASSET_BOUNDARY_VIOLATION'});
  assert.throws(()=>codec.decodeJpeg(restartGray({width:8,restart:0,ac:0xf1,entropy:[0x2a,255,0]})),{code:'ASSET_BOUNDARY_VIOLATION'});
  for (const [ac,acEntropy] of [[0xf0,[0x0f]],[0xf1,[0x55]],[0x10,[0x7f]]]) {
    assert.throws(()=>codec.decodeJpeg(progressiveGray(2,{ac,acEntropy})),{code:'ASSET_BOUNDARY_VIOLATION'});
  }
});

test('restart ordering/count and truncated entropy fail without tolerant recovery', () => {
  for (const entropy of [[0x0f,255,0xd1,0x3f],[0x0f,0x3f],[0x0f,255,0xd0],[0x00,255,0xd0,0x3f],[0x0f,255,0xd0,0x3f,255,0xd1,0x3f]]) {
    assert.throws(()=>codec.decodeJpeg(restartGray({entropy})),{code:'ASSET_BOUNDARY_VIOLATION'});
  }
});

test('EXIF offsets/counts and marker/table caps fail bounded preflight', () => {
  const original = fixture('baseline'), badExif = exif(1);
  const metadataMutations = [[14,255],[14,1],[18,129],[22,4],[24,2],[28,0]];
  for (const [at,value] of metadataMutations) {
    const changed = Buffer.from(badExif); changed[at] = value;
    assert.throws(()=>codec.decodeJpeg(insert(original,changed)),{code:'ASSET_BOUNDARY_VIOLATION'});
  }
  assert.throws(()=>codec.decodeJpeg(insert(original,...Array.from({length:1024},()=>segment(0xfe)))),{code:'ASSET_BOUNDARY_VIOLATION'});
  const malformedTables = [segment(0xc4,[0,...new Uint8Array(16)]),segment(0xc4,[0,2,...new Uint8Array(15),0,1]),segment(0xc4,[0,1,...new Uint8Array(15),12]),segment(0xdb,[0,...new Uint8Array(63).fill(1)])];
  for (const table of malformedTables) assert.throws(()=>codec.decodeJpeg(insert(original,table)),{code:'ASSET_BOUNDARY_VIOLATION'});
});

test('Adobe RGB transform is explicit and conflicting declarations fail', () => {
  const adobe = transform => segment(0xee,[65,100,111,98,101,0,100,0,0,0,0,transform]);
  const original = fixture('baseline');
  assert.throws(()=>codec.decodeJpeg(insert(original,adobe(0))),{code:'ASSET_BOUNDARY_VIOLATION'});
  assert.throws(()=>codec.decodeJpeg(insert(original,adobe(2))),{code:'ASSET_BOUNDARY_VIOLATION'});
  const ycbcr = codec.decodeJpeg(insert(original,adobe(1)));
  assert.ok(Math.abs(ycbcr.data[0]-230) <= 2);
});

test('progressive scans reject duplicates and unsupported scan counts', () => {
  const original = fixture('progressive'), first = findSegment(original,0xda);
  let next = first+2;
  while (next < original.length-1) { if (original[next] === 255 && original[next+1] !== 0 && original[next+1] !== 255) break; next++; }
  const bytes = Buffer.concat([original.subarray(0,next),original.subarray(first,next),original.subarray(next)]);
  assert.throws(()=>codec.decodeJpeg(bytes),{code:'ASSET_BOUNDARY_VIOLATION'});
  assert.equal(codec.decodeJpeg(progressiveGray(16)).data[0],128);
  assert.throws(()=>codec.decodeJpeg(progressiveGray(17)),{code:'ASSET_BOUNDARY_VIOLATION'});
});
