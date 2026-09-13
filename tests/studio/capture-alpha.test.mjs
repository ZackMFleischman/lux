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
