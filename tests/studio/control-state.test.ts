import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonicalControlSchemaJson, normalizeControlDeclarations } from '../../packages/runtime-contracts/src/parameters.mjs';
import { validateSavedControls, initialControlValues, LEGACY_CONTROL_SCHEMA, LEGACY_CONTROL_SCHEMA_HASH } from '../../apps/studio/src/controls/control-state.ts';

const schema = normalizeControlDeclarations({height:{type:'number',label:'Height',default:1,min:0,max:4},speed:{type:'number',label:'Speed',default:0.5,min:0,max:2}});
const hash = (value:string) => createHash('sha256').update(value).digest('hex');
test('saved control snapshots verify their own schema hash and values without requiring a match to changed draft source', async()=>{
  const saved={sourceHash:'a'.repeat(64),schema,schemaHash:hash(canonicalControlSchemaJson(schema)),values:{height:3,speed:1}};
  assert.deepEqual(await validateSavedControls(saved),saved);
  await assert.rejects(validateSavedControls({...saved,schemaHash:'b'.repeat(64)}),/schema hash/i);
  await assert.rejects(validateSavedControls({...saved,sourceHash:'not-a-hash'}),/source hash/i);
  await assert.rejects(validateSavedControls({...saved,values:{height:99,speed:1}}),/height/);
  const before={schema,values:{height:2,speed:0.8}};
  assert.deepEqual(initialControlValues(schema,before).values,{height:2,speed:0.8});
  assert.deepEqual(initialControlValues([],before).values,{});
  assert.deepEqual(initialControlValues(schema).values,{height:1,speed:0.5});
  assert.equal(LEGACY_CONTROL_SCHEMA_HASH,hash(canonicalControlSchemaJson(LEGACY_CONTROL_SCHEMA)));
});
