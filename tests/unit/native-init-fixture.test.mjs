import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {compileVisual} from '../../apps/build-worker/src/compile.mjs';
import {linkRuntime} from '../../apps/build-worker/src/link-runtime.mjs';
test('initialization-loop source compiles and links without executing authored create',async()=>{
 const source={sdkVersion:'0.2.0',entry:'visual.ts',files:{'visual.ts':fs.readFileSync(new URL('../fixtures/installed-sources/hung-init/visual.ts.txt',import.meta.url),'utf8')}};
 const result=await compileVisual({source});assert.equal(result.ok,true,JSON.stringify(result));
 const linked=await linkRuntime(result.artifact);assert.equal(linked.linkedVersion,3);assert.deepEqual(linked.controls,[]);
 assert.match(linked.code,/LUX_QA_INSTALLED_INIT_HANG_ENTERED/);assert.match(linked.code,/while \(true\)/);
});
