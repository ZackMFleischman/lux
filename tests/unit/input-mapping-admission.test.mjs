import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNumericMappingPlan, evaluateNumericMappings } from '../../packages/inputs/src/mapping.mjs';

const uuid = n => `${n.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`;
const target = { sceneId: uuid(1), nodePath: [], controlId: 'height' };
const definition = { id: 'height', type: 'number', label: 'Height', default: 2, min: 0, max: 10, changeCost: 'live' };
const source = { sourceId: 'music', signalId: 'level' };
const binding = { id: uuid(2), phase: 'macro', source, target, inputMin: 0, inputMax: 1, outputMin: 0, outputMax: 2, exponent: 1, invert: false, mode: 'add', enabled: true };
const makePlan = () => JSON.parse(JSON.stringify({ version: 1, targets: [{ target, definition }], bindings: [binding] }));
const makeFrame = () => structuredClone({ authority: 'studio', base: [{ target, value: 2 }], signals: [{ source, value: 0.5 }], hostValues: [] });
const invalid = fn => assert.throws(fn, error => error.code === 'INVALID_INPUT_MAPPING' && typeof error.path === 'string' && error.path.length <= 200);

test('strict plan fields, definitions, ranges and identities reject malformed or duplicate data', () => {
  const mutations = [
    p => { p.extra = true; }, p => { p.version = 2; }, p => { delete p.bindings; },
    p => { p.targets[0].definition.id = 'other'; }, p => { p.targets[0].definition.type = 'trigger'; },
    p => { p.targets.push(structuredClone(p.targets[0])); }, p => { p.bindings.push(structuredClone(p.bindings[0])); },
    p => { p.bindings[0].target.nodePath = [uuid(8)]; },
    ...['bad', '00000000-0000-0000-0000-000000000000', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'AAAAAAAA-1111-4111-8111-111111111111', '11111111-1111-0111-8111-111111111111', '11111111-1111-4111-7111-111111111111'].map(id => p => { p.targets[0].target.sceneId = id; }),
    ...['__proto__', 'constructor', 'prototype', 'A', '', 'a'.repeat(65), 'has space'].map(id => p => { p.bindings[0].source.signalId = id; }),
    p => { p.targets[0].target.controlId = '__proto__'; }, p => { p.bindings[0].source.sourceId = ''; },
    p => { p.bindings[0].phase = 'late'; }, p => { p.bindings[0].mode = 'divide'; },
    p => { p.bindings[0].enabled = 1; }, p => { p.bindings[0].invert = 'false'; },
    p => { p.bindings[0].inputMax = 0; }, p => { p.bindings[0].outputMin = 3; },
    p => { p.bindings[0].inputMin = -Number.MAX_VALUE; p.bindings[0].inputMax = Number.MAX_VALUE; },
    p => { p.bindings[0].outputMin = -Number.MAX_VALUE; p.bindings[0].outputMax = Number.MAX_VALUE; },
    ...[NaN, Infinity, -Infinity, 0, 0.124, 8.001].map(value => p => { p.bindings[0].exponent = value; }),
  ];
  for (const mutate of mutations) { const p = makePlan(); mutate(p); invalid(() => normalizeNumericMappingPlan(p)); invalid(() => evaluateNumericMappings(p, makeFrame())); }
});

test('frame admission is complete, finite, in-range and unique even for unused signals', () => {
  const mutations = [
    f => { f.authority = 'other'; }, f => { f.extra = true; }, f => { f.base = []; },
    f => { f.base.push(structuredClone(f.base[0])); }, f => { f.base[0].target.sceneId = uuid(8); },
    ...[NaN, Infinity, -Infinity, -1, 11, '2'].map(value => f => { f.base[0].value = value; }),
    f => { f.signals.push(structuredClone(f.signals[0])); }, f => { f.signals[0].value = NaN; },
    f => { f.hostValues = [{ target, value: 1 }]; },
    f => { f.authority = 'host'; f.hostValues = [{ target, value: 11 }]; },
    f => { f.authority = 'host'; f.hostValues = [{ target, value: 1 }, { target, value: 2 }]; },
    f => { f.authority = 'host'; f.hostValues = [{ target: { ...target, sceneId: uuid(8) }, value: 1 }]; },
  ];
  for (const mutate of mutations) { const f = makeFrame(); mutate(f); invalid(() => evaluateNumericMappings(makePlan(), f)); }
});

test('accessors, symbols, hidden properties, custom prototypes and sparse arrays never pass admission', () => {
  let called = 0;
  const getter = object => Object.defineProperty(object, 'value', { enumerable: true, get() { called++; return 1; } });
  const p = makePlan(); Object.defineProperty(p.bindings[0], 'exponent', { enumerable: true, get() { called++; return 1; } });
  invalid(() => normalizeNumericMappingPlan(p));
  const f = makeFrame(); getter(f.base[0]); invalid(() => evaluateNumericMappings(makePlan(), f));
  const arr = makePlan(); Object.defineProperty(arr.targets, '0', { enumerable: true, get() { called++; return null; } }); invalid(() => normalizeNumericMappingPlan(arr));
  for (const mutate of [
    p => { p[Symbol('x')] = true; }, p => { Object.defineProperty(p, 'hidden', { value: true }); },
    p => { Object.setPrototypeOf(p.targets[0], { inherited: true }); }, p => { Object.setPrototypeOf(p.targets, null); },
    p => { p.targets.length = 2; }, p => { p.targets.extra = true; },
  ]) { const raw = makePlan(); mutate(raw); invalid(() => normalizeNumericMappingPlan(raw)); }
  assert.equal(called, 0);
  const nullRecord = Object.assign(Object.create(null), makePlan());
  assert.equal(normalizeNumericMappingPlan(nullRecord).version, 1);
});

test('finite operands that overflow intermediate subtraction, division, add or multiply fail atomically', () => {
  for (const changes of [
    { inputMin: -Number.MAX_VALUE, inputMax: 0 },
    { inputMin: 0, inputMax: Number.MIN_VALUE },
    { mode: 'add', outputMin: Number.MAX_VALUE, outputMax: Number.MAX_VALUE },
    { mode: 'multiply', outputMin: Number.MAX_VALUE, outputMax: Number.MAX_VALUE },
  ]) {
    const p = makePlan(), f = makeFrame(); Object.assign(p.bindings[0], changes);
    if (changes.inputMax !== undefined) f.signals[0].value = Number.MAX_VALUE;
    else { p.targets[0].definition = { ...definition, min: 0, max: Number.MAX_VALUE }; f.base[0].value = Number.MAX_VALUE; }
    const before = structuredClone({ p, f });
    invalid(() => evaluateNumericMappings(p, f)); assert.deepEqual({ p, f }, before);
  }
});

test('exact count/depth boundaries pass while the next element fails including disabled/unused data', () => {
  const targets = Array.from({ length: 256 }, (_, i) => ({ target: { ...target, sceneId: uuid(i + 1), nodePath: i === 0 ? Array(8).fill(uuid(5)) : [] }, definition }));
  const bindings = Array.from({ length: 256 }, (_, i) => ({ ...binding, id: uuid(i + 1), target: targets[i].target, source: { sourceId: `source${i}`, signalId: 'x' }, enabled: false }));
  const p = { version: 1, targets, bindings };
  const f = { authority: 'studio', base: targets.map(({ target }) => ({ target, value: 2 })), signals: bindings.map(({ source }) => ({ source, value: 0 })), hostValues: [] };
  assert.equal(evaluateNumericMappings(p, f).values.length, 256);
  for (const field of ['targets', 'bindings']) { const raw = structuredClone(p); raw[field].push(raw[field][0]); invalid(() => normalizeNumericMappingPlan(raw)); }
  const depth = makePlan(); depth.targets[0].target.nodePath = Array(9).fill(uuid(5)); invalid(() => normalizeNumericMappingPlan(depth));
  const excess = structuredClone(f); excess.signals.push({ source: { sourceId: 'excess', signalId: 'x' }, value: 0 }); invalid(() => evaluateNumericMappings(p, excess));
  // The union, not merely each array, bounds distinct source references.
  const union = structuredClone(f); union.signals[0].source.sourceId = 'different'; invalid(() => evaluateNumericMappings(p, union));
});

test('raw UTF-8 metadata budget is bounded before normalization can trim it away', () => {
  const p = makePlan(); p.targets[0].definition.label = ' '.repeat(262144) + 'Height'; invalid(() => normalizeNumericMappingPlan(p));
  const large = makePlan(); large.targets = Array.from({ length: 256 }, (_, i) => ({ target: { ...target, sceneId: uuid(i + 1) }, definition: { ...definition, label: '\u3000'.repeat(400) + 'Height' } }));
  assert.ok(JSON.stringify(large).length < 262144);
  assert.ok(Buffer.byteLength(JSON.stringify(large)) > 262144);
  invalid(() => normalizeNumericMappingPlan(large));
});

test('exact UTF-8 budget admits the last byte and rejects the next byte', () => {
  const p = makePlan();
  const size = Buffer.byteLength(JSON.stringify(p));
  p.targets[0].definition.label = ' '.repeat(262144 - size) + 'Height';
  assert.equal(Buffer.byteLength(JSON.stringify(p)), 262144);
  assert.equal(normalizeNumericMappingPlan(p).targets[0].definition.label, 'Height');
  p.targets[0].definition.label = ' ' + p.targets[0].definition.label;
  invalid(() => normalizeNumericMappingPlan(p));
});
