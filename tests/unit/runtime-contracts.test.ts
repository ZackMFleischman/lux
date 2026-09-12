import test from 'node:test';
import assert from 'node:assert/strict';
import { controlDefinitionSchema, controlValuesSchema, INTENSITY_CONTROL, outputSettingsSchema, compileResultSchema } from '../../packages/runtime-contracts/src/index.ts';

test('tracer retains fixed intensity schema and rejects invalid control snapshots', () => {
  assert.equal(controlDefinitionSchema.parse(INTENSITY_CONTROL).default, 0.5);
  assert.equal(controlDefinitionSchema.safeParse({...INTENSITY_CONTROL,default:0.65}).success,false);
  for (const value of [NaN,Infinity,-0.1,1.1]) assert.equal(controlValuesSchema.safeParse({intensity:value}).success,false);
  assert.equal(controlValuesSchema.safeParse({intensity:0.5,other:1}).success,false);
});
test('output and compiler failures cannot masquerade as validated artifacts', () => {
  assert.equal(outputSettingsSchema.safeParse({width:1920,height:1080,fps:60,seed:0}).success,true);
  assert.equal(outputSettingsSchema.safeParse({width:0,height:1080,fps:60,seed:0}).success,false);
  assert.equal(compileResultSchema.safeParse({ok:false,code:'TIMEOUT',diagnostics:[]}).success,true);
  assert.equal(compileResultSchema.safeParse({ok:true,artifact:{bundleHash:'invalid'}}).success,false);
});
