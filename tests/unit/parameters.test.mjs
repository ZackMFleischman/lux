import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeControlDeclarations, normalizeControlSchema, canonicalControlSchemaJson,
  defaultControlValues, validateControlPatch, validateControlSnapshot, reconcileControlValues,
} from '../../packages/runtime-contracts/src/parameters.mjs';

const number = (overrides = {}) => ({ type: 'number', label: 'Height', default: 1, min: 0, max: 4, ...overrides });
const declarations = () => ({ spikeHeight: number(), roughness: number({ label: 'Roughness', default: 0.4, max: 1, step: 0.1 }) });

test('declarations preserve semantic IDs/order, normalize metadata, and freeze independent snapshots', () => {
  const input = declarations();
  input.spikeHeight.label = '  Spike height  ';
  input.spikeHeight.unit = ' m ';
  const schema = normalizeControlDeclarations(input);
  assert.deepEqual(schema, [
    { id: 'spikeHeight', type: 'number', label: 'Spike height', default: 1, min: 0, max: 4, unit: 'm', changeCost: 'live' },
    { id: 'roughness', type: 'number', label: 'Roughness', default: 0.4, min: 0, max: 1, step: 0.1, changeCost: 'live' },
  ]);
  input.spikeHeight.default = 3;
  assert.equal(schema[0].default, 1);
  assert.throws(() => { schema[0].default = 3; }, TypeError);
  assert.throws(() => schema.push({}), TypeError);
});

test('empty declarations produce no implicit control and support an empty full snapshot', () => {
  assert.deepEqual(normalizeControlDeclarations({}), []);
  assert.deepEqual(defaultControlValues([]), {});
  assert.deepEqual(validateControlSnapshot([], {}), {});
  assert.throws(() => validateControlPatch([], {}), /nonempty/i);
  assert.throws(() => validateControlSnapshot([], { intensity: 0.5 }), /intensity/);
});

test('schema canonicalization ignores input field order, preserves control order, and normalizes negative zero', () => {
  const a = normalizeControlDeclarations({ z: number({ default: -0, min: -0 }), a: number() });
  const b = [{ changeCost: 'live', max: 4, min: 0, default: 0, label: 'Height', type: 'number', id: 'z' }, a[1]];
  assert.equal(canonicalControlSchemaJson(a), canonicalControlSchemaJson(b));
  assert.equal(Object.is(a[0].default, -0), false);
  assert.equal(Object.is(a[0].min, -0), false);
  assert.notEqual(canonicalControlSchemaJson(a), canonicalControlSchemaJson([...a].reverse()));
  assert.deepEqual(normalizeControlSchema(b), a);
});

test('invalid IDs, duplicate normalized IDs and unsupported descriptor fields are rejected', () => {
  for (const id of ['1abc', 'A', 'a-b', '__proto__', 'constructor', 'prototype', 'a'.repeat(65)]) {
    assert.throws(() => normalizeControlDeclarations(Object.fromEntries([[id, number()]])), /control|id/i, id);
  }
  const schema = normalizeControlDeclarations({ height: number() });
  assert.throws(() => normalizeControlSchema([schema[0], schema[0]]), /duplicate/i);
  for (const extra of [{ id: 'other' }, { changeCost: 'rebuild' }, { surprise: true }]) {
    assert.throws(() => normalizeControlDeclarations({ height: number(extra) }), /field|property/i);
  }
  assert.throws(() => normalizeControlSchema([{ ...schema[0], changeCost: 'rebuild' }]), /live/);
  assert.throws(() => normalizeControlDeclarations({ height: number({ type: 'color' }) }), /number/);
});

test('descriptor finite range/default/step invariants reject invalid values without clamping', () => {
  for (const invalid of [
    { default: NaN }, { default: Infinity }, { min: -Infinity }, { max: Infinity },
    { min: 4 }, { min: 5 }, { default: -1 }, { default: 5 }, { max: '4' },
    { min: -Number.MAX_VALUE, max: Number.MAX_VALUE },
    { step: 0 }, { step: -1 }, { step: Infinity }, { step: 5 }, { step: undefined },
  ]) assert.throws(() => normalizeControlDeclarations({ height: number(invalid) }), /height/);
  assert.deepEqual(defaultControlValues(normalizeControlDeclarations({ low: number({ default: 0 }), high: number({ default: 4 }) })), { low: 0, high: 4 });
});

test('metadata enforces Unicode validity, code-point lengths, controls, and UTF-8/count budgets', () => {
  for (const label of ['', '  ', 'a\n', '\u007f', '\u0085', '\ud800', '😀'.repeat(81)]) {
    assert.throws(() => normalizeControlDeclarations({ height: number({ label }) }), /label/i);
  }
  for (const unit of ['', '\udfff', 'a'.repeat(25), 'm\t']) {
    assert.throws(() => normalizeControlDeclarations({ height: number({ unit }) }), /unit/i);
  }
  const maximum = Object.fromEntries(Array.from({ length: 32 }, (_, i) => [`control${i}`, number({ label: '😀'.repeat(80), unit: '😀'.repeat(24) })]));
  const schema = normalizeControlDeclarations(maximum);
  assert.ok(new TextEncoder().encode(canonicalControlSchemaJson(schema)).byteLength <= 32768);
  assert.throws(() => normalizeControlDeclarations({ ...maximum, overflow: number() }), /32/);
});

test('untrusted records and schema arrays never invoke accessors or accept inherited/hidden/symbol data', () => {
  let calls = 0;
  const getter = { get height() { calls++; return number(); } };
  const hidden = Object.defineProperty({}, 'height', { value: number() });
  const symbol = { height: number(), [Symbol('extra')]: 1 };
  for (const value of [getter, hidden, symbol, Object.create({ height: number() }), [], null]) {
    assert.throws(() => normalizeControlDeclarations(value));
  }
  const descriptor = { ...number(), get label() { calls++; return 'Height'; } };
  assert.throws(() => normalizeControlDeclarations({ height: descriptor }));
  const row = normalizeControlDeclarations({ height: number() })[0];
  const accessorArray = []; Object.defineProperty(accessorArray, '0', { enumerable: true, get() { calls++; return row; } });
  const hiddenArray = [row]; Object.defineProperty(hiddenArray, '0', { enumerable: false });
  const inheritedArray = [row]; Object.setPrototypeOf(inheritedArray, { inherited: true });
  for (const value of [accessorArray, hiddenArray, inheritedArray, new Array(1), Object.assign([row], { extra: 1 }), Object.assign([row], { [Symbol('x')]: 1 })]) {
    assert.throws(() => normalizeControlSchema(value));
  }
  assert.equal(calls, 0);
  assert.deepEqual(normalizeControlDeclarations(Object.assign(Object.create(null), { height: number() })), [row]);
});

test('patches permit finite values between UI steps and full snapshots require exactly all keys', () => {
  const schema = normalizeControlDeclarations(declarations());
  assert.deepEqual(validateControlPatch(schema, { roughness: 0.12345 }), { roughness: 0.12345 });
  assert.deepEqual(validateControlSnapshot(schema, { roughness: 0, spikeHeight: 4 }), { spikeHeight: 4, roughness: 0 });
  assert.throws(() => validateControlSnapshot(schema, { roughness: 0.2 }), /spikeHeight/);
  assert.throws(() => validateControlPatch(schema, {}), /nonempty/i);
  for (const values of [{ intensity: 0.5 }, { roughness: 2 }, { roughness: NaN }, { roughness: Infinity }, { roughness: '0.2' }]) {
    assert.throws(() => validateControlPatch(schema, values), /roughness|intensity/);
  }
  const input = { roughness: -0 };
  const result = validateControlPatch(schema, input);
  input.roughness = 0.9;
  assert.equal(Object.is(result.roughness, -0), false);
  assert.throws(() => { result.roughness = 1; }, TypeError);
});

test('invalid multi-key patch is atomic and rejects own-record attacks without evaluating values', () => {
  const schema = normalizeControlDeclarations(declarations()), current = { spikeHeight: 1, roughness: 0.4 };
  const invalid = { spikeHeight: 2, roughness: 99 };
  assert.throws(() => validateControlPatch(schema, invalid), /roughness.*0.*1/);
  assert.deepEqual(current, { spikeHeight: 1, roughness: 0.4 });
  assert.deepEqual(invalid, { spikeHeight: 2, roughness: 99 });
  let calls = 0;
  const values = { get roughness() { calls++; return 0.2; } };
  assert.throws(() => validateControlPatch(schema, values));
  assert.throws(() => validateControlSnapshot(schema, Object.create(current)));
  assert.throws(() => validateControlPatch(schema, Object.defineProperty({}, 'roughness', { value: 0.2 })));
  assert.equal(calls, 0);
});

test('reconciliation preserves compatible values and reports added, removed, narrowed-range and unit changes', () => {
  const previous = normalizeControlDeclarations({
    height: number({ unit: 'm' }), removed: number(), narrowed: number(), units: number({ unit: 'm' }),
  });
  const next = normalizeControlDeclarations({
    added: number({ default: 3 }), height: number({ label: 'Renamed', unit: 'm', default: 0.5, max: 3 }),
    narrowed: number({ default: 0.5, max: 1 }), units: number({ unit: 'cm', default: 0.2 }),
  });
  const oldValues = { height: 2, removed: 1, narrowed: 2, units: 1 };
  const result = reconcileControlValues(previous, oldValues, next);
  assert.deepEqual(result.values, { added: 3, height: 2, narrowed: 0.5, units: 0.2 });
  assert.deepEqual(result.changes, [
    { id: 'added', reason: 'added', value: 3 },
    { id: 'narrowed', reason: 'out-of-range', previousValue: 2, value: 0.5 },
    { id: 'units', reason: 'unit-changed', previousValue: 1, value: 0.2 },
    { id: 'removed', reason: 'removed', previousValue: 1 },
  ]);
  assert.deepEqual(oldValues, { height: 2, removed: 1, narrowed: 2, units: 1 });
  assert.throws(() => { result.changes[0].value = 9; }, TypeError);
  assert.throws(() => { result.values.height = 9; }, TypeError);
});

test('reconciliation validates saved snapshots and handles first build, empty schema and removed units', () => {
  const next = normalizeControlDeclarations({ height: number() });
  assert.deepEqual(reconcileControlValues([], {}, next), { values: { height: 1 }, changes: [{ id: 'height', reason: 'added', value: 1 }] });
  assert.deepEqual(reconcileControlValues(next, { height: 2 }, []), { values: {}, changes: [{ id: 'height', reason: 'removed', previousValue: 2 }] });
  assert.throws(() => reconcileControlValues(next, { height: 999 }, next));
  assert.throws(() => reconcileControlValues(next, {}, next));
  const old = normalizeControlDeclarations({ height: number({ unit: 'm' }) });
  assert.equal(reconcileControlValues(old, { height: 2 }, next).changes[0].reason, 'unit-changed');
});
