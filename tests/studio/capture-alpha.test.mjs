import test from 'node:test';
import assert from 'node:assert/strict';
import { decode } from 'fast-png';
import { encodeCapturedTarget } from '../../apps/studio/src/capture-png.mjs';

test('actual encoded PNG converts sRGB-stored linear premultiplication to straight alpha', () => {
  // Actual GPU readback from the common-image conformance fixture. These are
  // E(alpha * linearColor), not alpha * E(linearColor).
  const pixels = Uint8Array.from([188,0,0,128, 0,255,0,255, 0,0,0,0, 137,137,137,64]);
  const copy = pixels.slice(), image = decode(encodeCapturedTarget(pixels, 2, 2));
  assert.deepEqual(Array.from(image.data), [255,0,0,128, 0,255,0,255, 0,0,0,0, 255,255,255,64]);
  assert.deepEqual(pixels, copy, 'Conversion does not change the completed render target readback');
});

test('encoded capture uses linear division, keeps opaque bytes, and canonicalizes zero alpha', () => {
  // D(100)/0.502 encodes to ~138, not the encoded-space division result 199.
  const image = decode(encodeCapturedTarget(Uint8Array.from([100,50,20,128, 20,40,60,255, 255,50,80,0]), 3, 1));
  assert.deepEqual(Array.from(image.data), [138,71,31,128, 20,40,60,255, 0,0,0,0]);
});

test('low-alpha output is encoded directly without an ImageData premultiplication roundtrip', () => {
  const image = decode(encodeCapturedTarget(Uint8Array.from([1,2,3,1, 4,8,12,16, 0,0,0,0]), 3, 1));
  assert.deepEqual(Array.from(image.data), [79,110,132,1, 38,55,68,16, 0,0,0,0]);
});

test('capture rejects inconsistent or oversized readback before encoding', () => {
  assert.throws(() => encodeCapturedTarget(new Uint8Array(4), 1920, 1080), /readback/);
  assert.throws(() => encodeCapturedTarget(new Uint8Array(4), 1, 1081), /readback/);
});

test('Studio preview capture accepts a non-default render size', () => {
  const pixels = new Uint8Array(1280 * 720 * 4); pixels[3] = 255;
  assert.ok(encodeCapturedTarget(pixels, 1280, 720).byteLength > 0);
});

test('Studio preview capture removes Three WebGPU padding from only preceding non-aligned rows', () => {
  const width = 2400, height = 2, row = width * 4, stride = Math.ceil(row / 256) * 256;
  const pixels = new Uint8Array(stride + row); pixels.set([188, 0, 0, 128], 0); pixels.set([0, 255, 0, 255], stride);
  const image = decode(encodeCapturedTarget(pixels, width, height));
  assert.equal(image.data.length, row * height); assert.deepEqual(Array.from(image.data.slice(0, 4)), [255, 0, 0, 128]);
  assert.deepEqual(Array.from(image.data.slice(row, row + 4)), [0, 255, 0, 255]);
  assert.throws(() => encodeCapturedTarget(new Uint8Array(stride * height), width, height), /readback/);
});
