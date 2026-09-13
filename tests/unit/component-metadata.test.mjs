import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeComponentDeclaration, normalizeComponentMetadata, canonicalComponentMetadataJson,
} from '../../packages/runtime-contracts/src/components.mjs';
import { normalizeControlDeclarations, canonicalControlSchemaJson } from '../../packages/runtime-contracts/src/parameters.mjs';

const port = () => ({ type: { kind: 'image', colorSpace: 'linear-srgb', alphaMode: 'premultiplied' }, label: 'Image', description: 'Complete input image.' });
const number = () => ({ type: 'number', label: 'Radius', default: 2, min: 0, max: 8, unit: 'px' });
const declaration = () => ({
  declarationVersion: 1, key: 'lux/glow', label: 'Glow',
  description: 'Adds a controlled halo to an input image.', tags: ['effect'],
  inputs: { image: port() }, outputs: { image: port() }, controls: { radius: number() },
  controlDescriptions: { radius: 'Width of the halo.' }, lifecycle: { state: 'stateless', reset: 'seed' },
});

test('metadata preserves existing parameter policy without adding Intensity', () => {
  const source = declaration();
  source.controls.radius.label = ' Radius ';
  source.controls.radius.unit = ' px ';
  const metadata = normalizeComponentDeclaration(source);
  assert.deepEqual(metadata.controls, normalizeControlDeclarations(source.controls));
  assert.deepEqual(metadata.controls.map(control => control.id), ['radius']);
  assert.equal(metadata.controls[0].label, 'Radius');
  assert.equal(metadata.controls[0].unit, 'px');
  assert.equal(canonicalControlSchemaJson(metadata.controls), canonicalControlSchemaJson(normalizeControlDeclarations(source.controls)));
  const canonical = canonicalComponentMetadataJson(metadata);
  source.inputs.image.type.alphaMode = 'straight'; source.tags.push('changed');
  source.controlDescriptions.radius = 'Changed'; source.lifecycle.state = 'stateful';
  assert.equal(metadata.inputs.image.type.alphaMode, 'premultiplied');
  assert.equal(canonicalComponentMetadataJson(metadata), canonical);
  for (const mutate of [
    () => { metadata.label = 'Changed'; }, () => { metadata.inputs.image.label = 'Changed'; },
    () => { metadata.inputs.image.type.alphaMode = 'straight'; }, () => { metadata.inputs = {}; },
    () => { metadata.lifecycle.state = 'stateful'; }, () => { metadata.controls[0].default = 3; },
    () => { metadata.controlDescriptions.radius = 'Changed'; }, () => metadata.tags.push('changed'),
  ]) assert.throws(mutate, TypeError);
  assert.deepEqual(normalizeComponentDeclaration({ ...declaration(), controls: {}, controlDescriptions: {} }).controls, []);
  assert.equal(normalizeComponentDeclaration({ ...declaration(), lifecycle: { state: 'stateful', reset: 'seed' } }).lifecycle.state, 'stateful');
});

test('canonical bytes sort record keys and tags while retaining control presentation order', () => {
  const source = declaration();
  source.inputs = { zebra: port(), alpha: port() }; source.outputs = { z: port(), a: port() };
  source.controls = { zebra: number(), alpha: number() };
  source.controlDescriptions = { zebra: 'Z', alpha: 'A' };
  source.tags = ['\uE000', '😀', 'a', 'a'];
  const metadata = normalizeComponentDeclaration(source);
  const reverse = value => Object.fromEntries(Object.entries(value).reverse());
  const reordered = reverse({ ...metadata, inputs: reverse(metadata.inputs), outputs: reverse(metadata.outputs), controlDescriptions: reverse(metadata.controlDescriptions), tags: [...metadata.tags].reverse() });
  assert.equal(canonicalComponentMetadataJson(metadata), canonicalComponentMetadataJson(reordered));
  assert.deepEqual(Object.keys(metadata.inputs), ['alpha', 'zebra']);
  assert.deepEqual(Object.keys(metadata.outputs), ['a', 'z']);
  assert.deepEqual(Object.keys(metadata.controlDescriptions), ['alpha', 'zebra']);
  assert.deepEqual(metadata.tags, ['a', '😀', '\uE000']);
  assert.deepEqual(metadata.controls.map(row => row.id), ['zebra', 'alpha']);
  const differentOrder = { ...metadata, controls: [...metadata.controls].reverse() };
  assert.notEqual(canonicalComponentMetadataJson(metadata), canonicalComponentMetadataJson(differentOrder));
  assert.deepEqual(normalizeComponentMetadata(metadata), metadata);
});

const rejections = [
  ['unknown version', x => { x.declarationVersion = 2; }],
  ['unknown field', x => { x.extra = true; }], ['missing field', x => { delete x.tags; }],
  ...['lux/glow@1', '../glow', 'lux/a/b', 'Glow/glow', '550e8400-e29b-41d4-a716-446655440000', ' lux/glow', 'lux/glow ', 'lux/glow\n'].map(key => [`key ${JSON.stringify(key)}`, x => { x.key = key; }]),
  ['event port', x => { x.inputs.image.type = { kind: 'event' }; }],
  ['unsupported signal value', x => { x.inputs.image.type = { kind: 'signal', value: 'boolean', unit: null, clock: 'frame' }; }],
  ['unsupported signal clock', x => { x.inputs.image.type = { kind: 'signal', value: 'number', unit: null, clock: 'audio' }; }],
  ['straight alpha', x => { x.inputs.image.type.alphaMode = 'straight'; }],
  ['srgb image', x => { x.inputs.image.type.colorSpace = 'srgb'; }],
  ['extra port field', x => { x.inputs.image.optional = true; }],
  ['extra type field', x => { x.inputs.image.type.width = 1; }],
  ['invalid default', x => { x.controls.radius.default = 9; }],
  ['NaN default', x => { x.controls.radius.default = NaN; }],
  ['missing description', x => { delete x.controlDescriptions.radius; }],
  ['extra description', x => { x.controlDescriptions.intensity = 'Extra'; }],
  ['unknown lifecycle', x => { x.lifecycle.state = 'other'; }],
  ['unknown reset', x => { x.lifecycle.reset = 'none'; }],
  ['extra lifecycle', x => { x.lifecycle.extra = 1; }],
  ['symbol outer', x => { x[Symbol('hidden')] = 1; }],
  ['symbol port', x => { x.inputs[Symbol('hidden')] = port(); }],
  ['pollution field', x => { Object.defineProperty(x, '__proto__', { enumerable: true, value: {} }); }],
  ['inherited outer', x => { Object.setPrototypeOf(x, { inherited: true }); }],
  ['inherited port record', x => { x.inputs = Object.create({ image: port() }); }],
  ['nonenumerable field', x => { Object.defineProperty(x, 'label', { enumerable: false }); }],
  ['sparse tags', x => { x.tags = new Array(1); }],
  ['extra tag property', x => { x.tags.extra = true; }],
  ['symbol tags', x => { x.tags[Symbol('hidden')] = true; }],
  ['inherited tags', x => { Object.setPrototypeOf(x.tags, null); }],
  ...['constructor', 'prototype', '__proto__', ' image', 'image ', 'image\n', 'Image', 'image/name'].map(id => [`port ID ${JSON.stringify(id)}`, x => { x.inputs = Object.fromEntries([[id, port()]]); }]),
  ...['radius\n', ' radius', 'radius '].map(id => [`control ID ${JSON.stringify(id)}`, x => {
    x.controls = { [id]: number() }; x.controlDescriptions = { [id]: 'Width' };
  }]),
];
for (const [name, mutate] of rejections) test(`rejects ${name}`, () => {
  const source = declaration(); mutate(source);
  assert.throws(() => normalizeComponentDeclaration(source));
});

test('accessors at every metadata boundary reject without executing getters', () => {
  const targets = [x => [x, 'label'], x => [x.controls, 'radius'], x => [x.controls.radius, 'default'],
    x => [x.inputs, 'image'], x => [x.inputs.image, 'label'], x => [x.inputs.image.type, 'kind'],
    x => [x.tags, '0'], x => [x.controlDescriptions, 'radius'], x => [x.lifecycle, 'state']];
  for (const target of targets) {
    let calls = 0; const source = declaration(); const [object, key] = target(source);
    Object.defineProperty(object, key, { enumerable: true, get() { calls++; throw Error('executed getter'); } });
    assert.throws(() => normalizeComponentDeclaration(source)); assert.equal(calls, 0);
  }
  let calls = 0;
  const normalized = structuredClone(normalizeComponentDeclaration(declaration()));
  Object.defineProperty(normalized.controls, '0', { enumerable: true, get() { calls++; throw Error('executed getter'); } });
  assert.throws(() => normalizeComponentMetadata(normalized)); assert.equal(calls, 0);
});

test('normalized metadata rejects duplicate controls and declaration-shaped controls', () => {
  const metadata = normalizeComponentDeclaration(declaration());
  assert.throws(() => normalizeComponentMetadata({ ...metadata, controls: [...metadata.controls, ...metadata.controls] }));
  assert.throws(() => normalizeComponentMetadata(declaration()));
  assert.throws(() => normalizeComponentDeclaration(metadata));
  assert.throws(() => normalizeComponentMetadata({ ...metadata, controls: [{ ...metadata.controls[0], id: 'radius\n' }], controlDescriptions: { ['radius\n']: 'Width' } }));
});

const textFields = [
  ['component label', 80, (x, value) => { x.label = value; }],
  ['component description', 512, (x, value) => { x.description = value; }],
  ['port label', 80, (x, value) => { x.inputs.image.label = value; }],
  ['port description', 512, (x, value) => { x.inputs.image.description = value; }],
  ['control description', 512, (x, value) => { x.controlDescriptions.radius = value; }],
  ['tag', 32, (x, value) => { x.tags = [value]; }],
  ['signal unit', 24, (x, value) => { x.inputs.image.type = { kind: 'signal', value: 'number', unit: value, clock: 'frame' }; }],
];
for (const [name, maximum, set] of textFields) test(`${name} enforces exact nonempty Unicode code-point bounds without repairing text`, () => {
  const source = declaration(); set(source, '😀'.repeat(maximum));
  assert.doesNotThrow(() => normalizeComponentDeclaration(source));
  for (const value of ['😀'.repeat(maximum + 1), '', ' ', ' x', 'x ', '\uFEFFx', 'x\u00A0', '\uD800', '\uDC00', 'x\u0000y', 'x\u001Fy', 'x\u007Fy', 'x\u009Fy']) {
    set(source, value); assert.throws(() => normalizeComponentDeclaration(source), `${name}: ${JSON.stringify(value)}`);
  }
});

test('signal units require explicit null or exact admitted text', () => {
  const source = declaration();
  source.inputs.image.type = { kind: 'signal', value: 'number', unit: null, clock: 'frame' };
  assert.equal(normalizeComponentDeclaration(source).inputs.image.type.unit, null);
  delete source.inputs.image.type.unit;
  assert.throws(() => normalizeComponentDeclaration(source));
  const canonical = value => { source.inputs.image.type.unit = value; return canonicalComponentMetadataJson(normalizeComponentDeclaration(source)); };
  assert.notEqual(canonical('é'), canonical('e\u0301'));
  assert.notEqual(canonical('Hz'), canonical('hz'));
  source.tags = ['é', 'e\u0301', 'Hz', 'hz'];
  assert.deepEqual(normalizeComponentDeclaration(source).tags, ['Hz', 'e\u0301', 'hz', 'é']);
});

test('keys and port IDs admit exact ASCII boundaries', () => {
  const source = declaration(); source.key = `a/${'b'.repeat(94)}`;
  source.inputs = { ['a'.repeat(64)]: port() };
  assert.doesNotThrow(() => normalizeComponentDeclaration(source));
  source.key += 'b'; assert.throws(() => normalizeComponentDeclaration(source));
  source.key = 'lux/glow'; source.inputs = { ['a'.repeat(65)]: port() };
  assert.throws(() => normalizeComponentDeclaration(source));
});

test('port, control and raw tag count caps are checked before deduplication', () => {
  for (const side of ['inputs', 'outputs']) {
    const source = declaration(); source[side] = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`p${i}`, port()]));
    assert.doesNotThrow(() => normalizeComponentDeclaration(source));
    source[side].extra = port(); assert.throws(() => normalizeComponentDeclaration(source));
  }
  const source = declaration();
  source.controls = Object.fromEntries(Array.from({ length: 32 }, (_, i) => [`c${i}`, number()]));
  source.controlDescriptions = Object.fromEntries(Object.keys(source.controls).map(id => [id, 'Description']));
  source.tags = Array(16).fill('effect');
  assert.deepEqual(normalizeComponentDeclaration(source).tags, ['effect']);
  source.tags.push('effect'); assert.throws(() => normalizeComponentDeclaration(source));
  source.tags = []; source.controls.extra = number(); source.controlDescriptions.extra = 'Extra';
  assert.throws(() => normalizeComponentDeclaration(source));
});

test('canonical metadata accepts exactly 64 KiB UTF-8 and rejects one byte beyond', () => {
  const source = declaration();
  source.inputs = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`p${i}`, port()]));
  source.outputs = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`p${i}`, port()]));
  source.controls = Object.fromEntries(Array.from({ length: 32 }, (_, i) => [`c${i}`, number()]));
  source.controlDescriptions = Object.fromEntries(Object.keys(source.controls).map(id => [id, 'x']));
  const metadata = structuredClone(normalizeComponentDeclaration(source));
  const slots = [...Object.values(metadata.inputs), ...Object.values(metadata.outputs)].map(value => [value, 'description']);
  slots.push(...Object.keys(metadata.controlDescriptions).map(key => [metadata.controlDescriptions, key]));
  for (const [object, key] of slots) object[key] = 'x';
  let remaining = 65536 - Buffer.byteLength(JSON.stringify(metadata));
  for (const [object, key] of slots) {
    const extra = Math.min(remaining, 2047);
    const bytes = extra + 1, astral = Math.floor(bytes / 4), ascii = bytes % 4;
    // At most 512 code points; leave a few bytes for subsequent slots if needed.
    const text = '😀'.repeat(Math.min(astral, 511)) + 'x'.repeat(Math.min(ascii, 1));
    if (!text) continue;
    const growth = Buffer.byteLength(text) - 1;
    object[key] = text; remaining -= growth;
    if (!remaining) break;
  }
  assert.equal(remaining, 0, 'fixture reaches the exact UTF-8 boundary');
  assert.equal(Buffer.byteLength(canonicalComponentMetadataJson(metadata)), 65536);
  metadata.label += 'x';
  assert.throws(() => normalizeComponentMetadata(metadata), /64 KiB/);
});
