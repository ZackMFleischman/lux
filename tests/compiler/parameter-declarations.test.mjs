import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '@babel/parser';
import { extractControlDeclarations } from '../../apps/build-worker/src/parameter-declarations.mjs';

const descriptor = `{ type: 'number', label: 'Height', default: 1, min: -2, max: 4 }`;
const source = controls => `import { defineVisual as visual } from '@lux/visual-sdk';
export default visual({ controls: ${controls}, async create() { throw Error('never execute metadata'); } });`;
const extract = text => extractControlDeclarations(parse(text, { sourceType: 'module', plugins: ['typescript'] }));

test('static extraction accepts aliases, literal keys, negative numbers and TS wrappers', () => {
  assert.deepEqual(extract(source(`({ spikeHeight: (${descriptor} as const) } satisfies Record<string, unknown>)`)), [
    { id: 'spikeHeight', type: 'number', label: 'Height', default: 1, min: -2, max: 4, changeCost: 'live' },
  ]);
  assert.deepEqual(extract(source('{}')), []);
  assert.deepEqual(extract(source(`{ 'spikeHeight': ${descriptor} }`)), extract(source(`{ spikeHeight: ${descriptor} }`)));
});

test('static extraction rejects executable/reference metadata, spreads, duplicate and computed keys', () => {
  for (const controls of [
    'settings', 'makeControls()', `{ ...settings }`, `{ height: settings }`, `{ height: makeControl() }`,
    `{ ["height"]: ${descriptor} }`, `{ height: ${descriptor}, height: ${descriptor} }`,
    `{ get height() { return ${descriptor}; } }`, `{ height }`,
    `{ height: { ...settings } }`, `{ height: { type:'number',label:'Height',default:1+1,min:0,max:4 } }`,
    `{ height: { type:'number',label:'Height',default:1,min:0,max:4,max:5 } }`,
    `{ height: { type:'number',label:'Height',default:Math.random(),min:0,max:4 } }`,
    `{ height: { type:'number',label:'Height',default:1,min:0,max:4,get unit(){return 'm';} } }`,
    `{ height: { type:'number',label:'Height',default:1,min:0,max:4,['unit']:'m' } }`,
  ]) {
    assert.throws(() => extract(source(controls)), error => {
      assert.equal(error.code, 'COMPILE_FAILED');
      assert.ok(error.loc.line >= 1); assert.ok(error.loc.column >= 0);
      assert.match(error.message, /literal|duplicate/i);
      return true;
    }, controls);
  }
});

test('outer declaration must bind directly to imported SDK and contain literal controls exactly once', () => {
  for (const text of [
    source('{}').replace('controls: {},', ''),
    source('{}').replace('controls: {},', 'controls: {}, controls: {},'),
    source('{}').replace('controls: {},', '...settings, controls: {},'),
    source('{}').replace('controls: {},', '["controls"]: {},'),
    source('{}').replace('controls: {},', 'get controls(){return {};},'),
    source('{}').replace('visual({', 'other({'),
    source('{}').replace('visual({', 'visual(...args, {'),
    source('{}').replace("from '@lux/visual-sdk'", "from './helper.ts'"),
  ]) assert.throws(() => extract(text), { code: 'COMPILE_FAILED' });
});

test('policy failures identify the literal field and cannot publish unsupported controls', () => {
  for (const [controls, field] of [
    [`{height:{type:'number',label:'Height',default:9,min:0,max:4}}`, 'default'],
    [`{height:{type:'color',label:'Color',default:1,min:0,max:4}}`, 'number'],
    [`{constructor:${descriptor}}`, 'ID'],
  ]) assert.throws(() => extract(source(controls)), error => {
    assert.equal(error.code, 'COMPILE_FAILED'); assert.match(error.message, new RegExp(field));
    assert.equal(error.loc.line, 2); return true;
  });
});
