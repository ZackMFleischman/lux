import test from 'node:test';
import assert from 'node:assert/strict';
import { defineVisual, sdkVersion } from '../../packages/visual-sdk/src/index.ts';
import { discoverVisualSdk } from '../../packages/visual-sdk/src/discovery.mjs';
import {compileVisual} from '../../apps/build-worker/src/compile.mjs';

test('SDK fixes and freezes literal intensity schema without calling visual creation', () => {
  let called = false;
  const visual = defineVisual({ async create() { called = true; throw Error('must not run'); } });
  assert.equal(called, false);
  assert.equal(sdkVersion, '0.1.0');
  assert.deepEqual(visual.controls, [{ id: 'intensity', type: 'number', label: 'Intensity', default: 0.5, min: 0, max: 1, changeCost: 'live' }]);
  assert.throws(() => { visual.controls[0].default = 1; }, TypeError);
  assert.throws(() => { visual.controls.push({}); }, TypeError);
});

test('discoverable typed parameter example compiles with number, boolean and enum controls',async()=>{
  const discovery=await discoverVisualSdk();
  const result=await compileVisual({source:{sdkVersion:'0.2.0',entry:'visual.ts',files:{'visual.ts':discovery.example}}});
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.deepEqual(result.artifact.controls.map(control=>control.type),['number','number','boolean','enum']);
});

test('discovery exposes real SDK source and the submitted example without execution', async () => {
  const discovery = await discoverVisualSdk();
  assert.equal(discovery.sdkVersion, '0.2.0');
  assert.equal(discovery.legacy.sdkVersion, sdkVersion);
  assert.match(discovery.parameterContractSource, /NumberDeclaration/);
  assert.match(discovery.example, /brightness:/);
  assert.deepEqual(discovery.allowedImports, ['@lux/visual-sdk', 'three/webgpu', 'three/tsl']);
  assert.match(discovery.contractSource, /interface VisualContext/);
  assert.match(discovery.example, /export default defineVisual/);
  assert.deepEqual(discovery.composition.authoring.graphIds,{kind:'uuid-or-readable-v1',readablePattern:'^[a-z][a-z0-9._-]{0,95}$'});
  assert.equal(discovery.composition.authoring.componentInputs,'typed-record-v1');
  assert.equal(discovery.composition.authoring.visualExternalInputs,false);
});

test('discoverable trigger example compiles its event declaration without a saved value',async()=>{
  const discovery=await discoverVisualSdk();
  const result=await compileVisual({source:{sdkVersion:'0.2.0',entry:'visual.ts',files:{'visual.ts':discovery.triggerExample}}});
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.deepEqual(result.artifact.controls.map(control=>control.type),['number','trigger']);
  assert.equal(Object.hasOwn(result.artifact.controls[1],'default'),false);
});
