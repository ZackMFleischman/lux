import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeControlDeclarations, normalizeControlSchema, canonicalControlSchemaJson,
  defaultControlValues, validateControlPatch, validateControlSnapshot, reconcileControlValues, isNumberControlDefinition,
} from '../../packages/runtime-contracts/src/parameters.mjs';

const number = (overrides = {}) => ({ type: 'number', label: 'Height', default: 1, min: 0, max: 4, ...overrides });
const boolean = (overrides = {}) => ({ type: 'boolean', label: 'Trail', default: true, ...overrides });
const enumeration = (overrides = {}) => ({
  type: 'enum', label: 'Direction', default: 'forward',
  options: [{ id: 'forward', label: 'Forward' }, { id: 'reverse', label: 'Reverse', description: 'Move backward' }],
  ...overrides,
});
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

test('optional groups preserve declared order while legacy schemas keep their canonical shape', () => {
  const legacy = normalizeControlDeclarations({ height: number() });
  assert.equal(canonicalControlSchemaJson(legacy), '[{"id":"height","type":"number","label":"Height","default":1,"min":0,"max":4,"changeCost":"live"}]');
  const grouped = normalizeControlDeclarations({
    speed: number({ label: 'Speed', group: '  Motion  ' }),
    height: number({ group: 'Shape' }),
  });
  assert.deepEqual(grouped.map(({ id, group }) => [id, group]), [['speed', 'Motion'], ['height', 'Shape']]);
  assert.deepEqual(normalizeControlSchema(grouped), grouped);
});

test('boolean and enum declarations normalize stable option identities and typed defaults', () => {
  const schema = normalizeControlDeclarations({
    trail: boolean({ label: '  Trail  ', group: ' Motion ' }),
    direction: enumeration({ options: [{ id: 'forward', label: ' Forward ' }, { id: 'reverse', label: ' Reverse ', description: ' Move backward ' }] }),
    mode: enumeration({ label: 'Mode', default: 'soft', presentation: 'segmented', options: [{ id: 'hard', label: 'Hard' }, { id: 'soft', label: 'Soft' }] }),
  });
  assert.deepEqual(schema, [
    { id: 'trail', type: 'boolean', label: 'Trail', default: true, group: 'Motion', changeCost: 'live' },
    { id: 'direction', type: 'enum', label: 'Direction', default: 'forward', options: [{ id: 'forward', label: 'Forward' }, { id: 'reverse', label: 'Reverse', description: 'Move backward' }], presentation: 'dropdown', changeCost: 'live' },
    { id: 'mode', type: 'enum', label: 'Mode', default: 'soft', options: [{ id: 'hard', label: 'Hard' }, { id: 'soft', label: 'Soft' }], presentation: 'segmented', changeCost: 'live' },
  ]);
  assert.deepEqual(defaultControlValues(schema), { trail: true, direction: 'forward', mode: 'soft' });
  assert.equal(isNumberControlDefinition(schema[0]), false);
  assert.equal(isNumberControlDefinition(normalizeControlDeclarations({ height: number() })[0]), true);
  assert.throws(() => { schema[1].options[0].label = 'Changed'; }, TypeError);
  assert.throws(() => schema[1].options.push({ id: 'other', label: 'Other' }), TypeError);
});

test('typed patches and snapshots enforce each declared control kind and enum membership', () => {
  const schema = normalizeControlDeclarations({ height: number(), trail: boolean(), direction: enumeration() });
  assert.deepEqual(validateControlPatch(schema, { trail: false, direction: 'reverse' }), { trail: false, direction: 'reverse' });
  assert.deepEqual(validateControlSnapshot(schema, { direction: 'forward', trail: true, height: 2 }), { height: 2, trail: true, direction: 'forward' });
  for (const values of [{ trail: 1 }, { trail: 'true' }, { direction: 'Forward' }, { direction: 'missing' }, { direction: false }]) {
    assert.throws(() => validateControlPatch(schema, values), /trail|direction/);
  }
});

test('enum declarations reject unsafe, duplicate, sparse, oversized and unknown option data without invoking accessors', () => {
  for (const options of [
    [], [{ id: 'forward', label: 'Forward' }],
    [{ id: 'forward', label: 'Forward' }, { id: 'forward', label: 'Again' }],
    [{ id: 'constructor', label: 'Unsafe' }, { id: 'forward', label: 'Forward' }],
    Array.from({ length: 65 }, (_, index) => ({ id: `option${index}`, label: `Option ${index}` })),
  ]) assert.throws(() => normalizeControlDeclarations({ direction: enumeration({ options }) }), /option|2.*64|duplicate|ID/i);
  for (const invalid of [
    enumeration({ default: 'missing' }), enumeration({ presentation: 'buttons' }),
    enumeration({ options: [{ id: 'forward', label: 'Forward', extra: true }, { id: 'reverse', label: 'Reverse' }] }),
  ]) assert.throws(() => normalizeControlDeclarations({ direction: invalid }), /default|presentation|field/i);
  const sparse = new Array(2); sparse[0] = { id: 'forward', label: 'Forward' };
  assert.throws(() => normalizeControlDeclarations({ direction: enumeration({ options: sparse }) }), /dense|array/i);
  let calls = 0;
  const options = [{ get id() { calls++; return 'forward'; }, label: 'Forward' }, { id: 'reverse', label: 'Reverse' }];
  assert.throws(() => normalizeControlDeclarations({ direction: enumeration({ options }) }));
  assert.equal(calls, 0);
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

test('metadata enforces Unicode validity, code-point lengths and UTF-8 byte budgets', () => {
  for (const label of ['', '  ', 'a\n', '\u007f', '\u0085', '\ud800', '😀'.repeat(81)]) {
    assert.throws(() => normalizeControlDeclarations({ height: number({ label }) }), /label/i);
  }
  for (const unit of ['', '\udfff', 'a'.repeat(25), 'm\t']) {
    assert.throws(() => normalizeControlDeclarations({ height: number({ unit }) }), /unit/i);
  }
  for (const group of ['', '\udfff', 'a'.repeat(81), 'Motion\t']) {
    assert.throws(() => normalizeControlDeclarations({ height: number({ group }) }), /group/i);
  }
  const maximum = Object.fromEntries(Array.from({ length: 32 }, (_, i) => [`control${i}`, number({ label: '😀'.repeat(80), unit: '😀'.repeat(24) })]));
  const schema = normalizeControlDeclarations(maximum);
  assert.ok(new TextEncoder().encode(canonicalControlSchemaJson(schema)).byteLength <= 32768);
  assert.equal(normalizeControlDeclarations({ ...maximum, extra: number() }).length, 33);
  const oversized = Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`control${i}`, number({ label: '😀'.repeat(80), unit: '😀'.repeat(24), description: '😀'.repeat(512) })]));
  assert.throws(() => normalizeControlDeclarations(oversized), /32 KiB/);
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

test('reconciliation preserves typed identities and reports option removal or kind changes', () => {
  const previous = normalizeControlDeclarations({
    trail: boolean(), direction: enumeration(), changed: boolean({ default: false }),
  });
  const next = normalizeControlDeclarations({
    trail: boolean({ label: 'Trail enabled', default: false }),
    direction: enumeration({ default: 'reverse', presentation: 'radio', options: [{ id: 'reverse', label: 'Back' }, { id: 'sideways', label: 'Sideways' }] }),
    changed: enumeration({ default: 'a', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }),
  });
  const result = reconcileControlValues(previous, { trail: true, direction: 'forward', changed: true }, next);
  assert.deepEqual(result.values, { trail: true, direction: 'reverse', changed: 'a' });
  assert.deepEqual(result.changes, [
    { id: 'direction', reason: 'option-removed', previousValue: 'forward', value: 'reverse' },
    { id: 'changed', reason: 'type-changed', previousValue: true, value: 'a' },
  ]);
});
