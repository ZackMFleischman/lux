import test from 'node:test';
import assert from 'node:assert/strict';
import { defineVisual, sdkVersion } from '../../packages/visual-sdk/src/index.ts';
import { discoverVisualSdk } from '../../packages/visual-sdk/src/discovery.mjs';

test('SDK fixes and freezes literal intensity schema without calling visual creation', () => {
  let called = false;
  const visual = defineVisual({ async create() { called = true; throw Error('must not run'); } });
  assert.equal(called, false);
  assert.equal(sdkVersion, '0.1.0');
  assert.deepEqual(visual.controls, [{ id: 'intensity', type: 'number', label: 'Intensity', default: 0.5, min: 0, max: 1, changeCost: 'live' }]);
  assert.throws(() => { visual.controls[0].default = 1; }, TypeError);
  assert.throws(() => { visual.controls.push({}); }, TypeError);
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
});
