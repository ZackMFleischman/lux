import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {compileVisual} from '../../apps/build-worker/src/compile.mjs';
import {linkRuntime} from '../../apps/build-worker/src/link-runtime.mjs';
import {componentSource} from './component-fixture.mjs';
import {artifactBody} from '../../apps/build-worker/src/artifact-identity.mjs';
import {createHash} from 'node:crypto';
const options={dependencyRoot:process.env.LUX_COMPILER_DEPENDENCIES||resolve('node_modules')};
test('internal SDK compiles and links the actual component with a closed v4 policy inventory',async()=>{
  for(const envelope of [{},{sourceVersion:2,assets:{'assets/red.png':{mediaType:'image/png',encoding:'base64',data:'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP4z8DQwPCfAUiByP//HQA9HAe6h6QALgAAAABJRU5ErkJggg=='}}}]) {
    const result=await compileVisual({source:{sdkVersion:'0.3.0',entry:'main.ts',files:{'main.ts':componentSource()},...envelope}},options);
    assert.equal(result.ok,true,JSON.stringify(result));
    assert.equal(result.artifact.artifactVersion,4);
    assert.equal(result.artifact.executionModel,'single-image-source-v1');
    assert.ok(result.artifact.modules['__lux/components.js']);
    const linked=await linkRuntime(result.artifact,options);
    assert.equal(linked.linkedVersion,4);assert.equal(linked.sdkVersion,'0.3.0');
    assert.deepEqual(linked.component,result.artifact.component);
    assert.doesNotMatch(linked.code,/from ['"](?:\.\.?\/|@lux\/|node:)/);
    for(const mutate of [a=>{delete a.modules['__lux/components.js'];},a=>{a.modules['__lux/components.js']+='\nexport const tampered=true;';},a=>{a.dependencyHashes['contracts/components.mjs']='0'.repeat(64);},a=>{delete a.dependencyHashes['contracts/component-profile.mjs'];}]){
      const altered=structuredClone(result.artifact);mutate(altered);const body=artifactBody(altered);altered.bundleHash=createHash('sha256').update(JSON.stringify(body)).digest('hex');await assert.rejects(linkRuntime(altered,options),/missing|dependency|policy/i);
    }
  }
});
test('component compilation preserves prohibited capability/import boundaries and never executes source',async()=>{
 for(const prefix of ["import 'node:process';","import 'new-dependency';","import './__lux/components.ts';",'process.exit();',"import('three/webgpu');"]){
  const result=await compileVisual({source:{sdkVersion:'0.3.0',entry:'main.ts',files:{'main.ts':prefix+componentSource()}}},options);assert.equal(result.ok,false);
 }
 const result=await compileVisual({source:{sdkVersion:'0.3.0',entry:'main.ts',files:{'main.ts':"throw Error('top level must never run');"+componentSource()}}},options);assert.equal(result.ok,true,JSON.stringify(result));await linkRuntime(result.artifact,options);
});
