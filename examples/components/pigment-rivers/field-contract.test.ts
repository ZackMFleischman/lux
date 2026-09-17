import assert from 'node:assert/strict';
import test from 'node:test';
import { BAND_ABI, BAND_VALUE_KEYS, readField } from './field-contract.ts';

const field = {
  version: 1, abi: BAND_ABI, fragments: { helpers: 'source' },
  values: { scale: 1, fold: 1, flow: 0.3, seed: 7 },
};

test('accepts the exact field and rejects incompatible resources before shader creation', () => {
  assert.equal(readField(field, BAND_ABI, BAND_VALUE_KEYS), field);
  assert.throws(() => readField({ ...field, abi: 'other/v1' }, BAND_ABI, BAND_VALUE_KEYS));
  assert.throws(() => readField({ ...field, values: { ...field.values, fold: NaN } }, BAND_ABI, BAND_VALUE_KEYS));
  assert.throws(() => readField({ ...field, values: { scale: 1 } }, BAND_ABI, BAND_VALUE_KEYS));
  assert.throws(() => readField({ ...field, fragments: { helpers: 'source', extra: 'source' } }, BAND_ABI, BAND_VALUE_KEYS));
});
