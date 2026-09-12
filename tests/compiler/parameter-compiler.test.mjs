import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { compileVisual } from '../../apps/build-worker/src/compile.mjs';
import { linkRuntime } from '../../apps/build-worker/src/link-runtime.mjs';
import { artifactBody, verifyLinked } from '../../apps/build-worker/src/artifact-identity.mjs';
import { canonicalControlSchemaJson } from '../../packages/runtime-contracts/src/parameters.mjs';

const dependencyRoot = process.env.LUX_COMPILER_DEPENDENCIES || resolve('node_modules');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const declarations = `{
  spikeHeight:{type:'number',label:'Spike height',default:0.8,min:0,max:2,step:0.01},
  noiseScale:{type:'number',label:'Noise scale',default:2,min:0.1,max:8,step:0.1},
  sharpness:{type:'number',label:'Sharpness',default:3,min:0.5,max:8},
  motionSpeed:{type:'number',label:'Motion speed',default:0.3,min:0,max:2},
  roughness:{type:'number',label:'Roughness',default:0.4,min:0,max:1}
}`;
const text = (controls = declarations, update = 'const height: number = frame.controls.spikeHeight;') => `
import { defineVisual as visual } from '@lux/visual-sdk';
export default visual({controls:(${controls} as const),async create(context){
  throw Error('source must never execute in compiler or linker');
  return {update(frame){${update}},render(target){},reset(seed){},dispose(){}};
}});`;
const request = (code, envelope = {}) => ({source:{sdkVersion:'0.2.0',entry:'main.ts',files:{'main.ts':code},...envelope}});

test('real compiler emits deterministic v3 five-control and empty schemas with closed SDK policy modules', async () => {
  const result = await compileVisual(request(text()), {dependencyRoot});
  assert.equal(result.ok,true,JSON.stringify(result));
  const artifact = result.artifact;
  assert.equal(artifact.artifactVersion,3);
  assert.equal(artifact.sdkVersion,'0.2.0');
  assert.deepEqual(artifact.controls.map(row=>row.id),['spikeHeight','noiseScale','sharpness','motionSpeed','roughness']);
  assert.equal(artifact.controlSchemaHash,hash(canonicalControlSchemaJson(artifact.controls)));
  assert.deepEqual(artifact.assets,{});
  assert.match(artifact.modules['__lux/sdk.js'], /from ['"]\.\/parameters\.js['"]/);
  assert.ok(artifact.modules['__lux/parameters.js']);
  assert.ok(artifact.dependencyHashes['contracts/parameters.mjs']);
  assert.ok(artifact.dependencyHashes['contracts/parameters.d.mts']);
  assert.ok(artifact.dependencyHashes['compiler/parameter-declarations.mjs']);
  assert.ok(artifact.dependencyHashes['sdk/sdk-v2.ts']);
  assert.doesNotMatch(artifact.modules['__lux/sdk.js'],/\.\.\/\.\.\//);
  const again = await compileVisual(request(text()), {dependencyRoot});
  assert.equal(again.ok,true,JSON.stringify(again));
  assert.equal(again.artifact.bundleHash,artifact.bundleHash);
  const empty = await compileVisual(request(text('{}','')), {dependencyRoot});
  assert.equal(empty.ok,true,JSON.stringify(empty));
  assert.deepEqual(empty.artifact.controls,[]);
  assert.equal(empty.artifact.controlSchemaHash,hash('[]'));
});

test('real compiler rejects undeclared typed keys and executable metadata with source locations', async () => {
  for (const [code, pattern] of [
    [text(declarations,'frame.controls.intensity;'),/intensity/],
    [text('makeControls()',''),/literal/],
    [text('{ height: {type:"number",label:"Height",default:99,min:0,max:4} }',''),/default/],
  ]) {
    const result = await compileVisual(request(code),{dependencyRoot});
    assert.equal(result.ok,false); assert.equal(result.code,'COMPILE_FAILED',JSON.stringify(result));
    assert.match(result.diagnostics[0].message,pattern);
    assert.equal(result.diagnostics[0].file,'main.ts'); assert.ok(result.diagnostics[0].line>0); assert.ok(result.diagnostics[0].column>0);
  }
});

test('SDK 0.2 asset source compiles and links as v3 with schema and asset identities preserved', async () => {
  const assets = {'assets/red.bmp':{mediaType:'image/bmp',encoding:'base64',data:'Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA=='}};
  const result = await compileVisual(request(text(),{sourceVersion:2,assets}),{dependencyRoot});
  assert.equal(result.ok,true,JSON.stringify(result));
  const linked = await linkRuntime(result.artifact,{dependencyRoot});
  assert.equal(linked.linkedVersion,3);
  assert.equal(linked.controlSchemaHash,result.artifact.controlSchemaHash);
  assert.deepEqual(linked.controls,result.artifact.controls);
  assert.equal(linked.assetSetHash,result.artifact.assetSetHash);
  assert.equal(linked.assets['assets/red.bmp'].data,assets['assets/red.bmp'].data);
  assert.doesNotMatch(linked.code,/from ["'](?:\.\.?\/|@lux\/|node:)/);
  const second = await linkRuntime(result.artifact,{dependencyRoot});
  assert.equal(second.linkedHash,linked.linkedHash);
  const altered = structuredClone(linked); altered.controls[0].max=9;
  await assert.rejects(verifyLinked(altered,hash,result.artifact),/schema.*hash/i);
  const wrongDependency = structuredClone(result.artifact); wrongDependency.dependencyHashes['contracts/parameters.mjs']='0'.repeat(64);
  const body = artifactBody(wrongDependency); wrongDependency.bundleHash=hash(JSON.stringify(body));
  await assert.rejects(linkRuntime(wrongDependency,{dependencyRoot}),/dependency hash/i);
});
