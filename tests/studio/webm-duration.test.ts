import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patchWebmDurationHeader } from '../../apps/studio/src/webm-duration.ts';

const bytes = (hex: string) => Uint8Array.from(hex.match(/../g)!.map(value => Number.parseInt(value, 16)));
const find = (value: Uint8Array, sequence: number[]) => value.findIndex((_byte, index) => sequence.every((byte, offset) => value[index + offset] === byte));

test('WebM finalizer inserts duration into Info without changing an unknown Segment size', () => {
  const source = bytes('1a45dfa3801853806701ffffffffffffff1549a966872ad7b1830f42401f43b67580');

  const patched = patchWebmDurationHeader(source, 2500);

  assert.equal(patched.delta, 11);
  assert.equal(patched.bytes[21], 0x92, 'Info payload grows from 7 to 18 bytes');
  assert.deepEqual([...patched.bytes.subarray(5, 13)], [0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff], 'unknown Segment size remains unknown');
  const duration = find(patched.bytes, [0x44, 0x89, 0x88]);
  assert.ok(duration > 0);
  assert.equal(new DataView(patched.bytes.buffer, patched.bytes.byteOffset + duration + 3, 8).getFloat64(0), 2500);
  assert.equal(find(patched.bytes, [0x1f, 0x43, 0xb6, 0x75]), source.length - 5 + 11);
});

test('WebM finalizer replaces an existing duration without growing the file', () => {
  const source = bytes('1a45dfa3801853806701ffffffffffffff1549a966922ad7b1830f424044898800000000000000001f43b67580');

  const patched = patchWebmDurationHeader(source, 1333.5);

  assert.equal(patched.delta, 0);
  assert.equal(patched.bytes.length, source.length);
  const duration = find(patched.bytes, [0x44, 0x89, 0x88]);
  assert.equal(new DataView(patched.bytes.buffer, patched.bytes.byteOffset + duration + 3, 8).getFloat64(0), 1333.5);
});

test('WebM finalizer rejects missing or truncated Info instead of emitting a corrupt clip', () => {
  assert.throws(() => patchWebmDurationHeader(bytes('1a45dfa3801853806701ffffffffffffff1f43b67580'), 1000), /Info/);
  assert.throws(() => patchWebmDurationHeader(bytes('1a45dfa3801853806701ffffffffffffff1549a966ff'), 1000), /Info/);
  assert.throws(() => patchWebmDurationHeader(bytes('1a45dfa3801853806701ffffffffffffff1549a96687'), Number.POSITIVE_INFINITY), /duration/);
});
