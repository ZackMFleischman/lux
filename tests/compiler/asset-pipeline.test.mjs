import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,cp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {compileVisual} from '../../apps/build-worker/src/compile.mjs';
import {linkRuntime} from '../../apps/build-worker/src/link-runtime.mjs';
import {artifactBody} from '../../apps/build-worker/src/artifact-identity.mjs';
const dependencyRoot=process.env.LUX_COMPILER_DEPENDENCIES || resolve('node_modules');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const image='Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA==';

test('contained v2 compiler/linker retains assets and pixel-only changes change every compiled identity',async()=>{
  const text=await readFile(new URL('../../packages/visual-sdk/examples/intensity.ts',import.meta.url),'utf8');
  const source={sourceVersion:2,sdkVersion:'0.1.0',entry:'main.ts',files:{'main.ts':text},assets:{'assets/red.bmp':{mediaType:'image/bmp',encoding:'base64',data:image}}};
  const compiled=await compileVisual({source},{dependencyRoot});assert.equal(compiled.ok,true,JSON.stringify(compiled));
  const artifact=compiled.artifact;
  assert.equal(artifact.artifactVersion,2);assert.equal(artifact.assets['assets/red.bmp'].data,image);
  assert.equal(artifact.assets['assets/red.bmp'].sha256,hash(Buffer.from(image,'base64')));
  for(const key of ['assets/index.mjs','compiler/artifact-identity.mjs','compiler/bounded-json.mjs']) assert.equal(artifact.dependencyHashes[key].length,64);
  const linked=await linkRuntime(artifact,{dependencyRoot});assert.equal(linked.linkedVersion,2);
  assert.deepEqual(linked.assets,artifact.assets);assert.equal(linked.assetSetHash,artifact.assetSetHash);assert(!linked.code.includes(image));
  const changed=structuredClone(source),bytes=Buffer.from(image,'base64');bytes[54]=123;changed.assets['assets/red.bmp'].data=bytes.toString('base64');
  const next=await compileVisual({source:changed},{dependencyRoot});assert.equal(next.ok,true,JSON.stringify(next));
  assert.deepEqual(next.artifact.modules,artifact.modules);
  for(const key of ['sourceHash','assetSetHash','bundleHash'])assert.notEqual(next.artifact[key],artifact[key]);
  assert.notEqual((await linkRuntime(next.artifact,{dependencyRoot})).linkedHash,linked.linkedHash);
  for(const mutate of [a=>{a.assets['assets/red.bmp'].data=changed.assets['assets/red.bmp'].data;},a=>{a.assets['assets/red.bmp'].width=2;},a=>{a.assets={};}]) {
    const bad=structuredClone(artifact);mutate(bad);bad.bundleHash=hash(JSON.stringify(artifactBody(bad)));
    await assert.rejects(linkRuntime(bad,{dependencyRoot}));
  }
  const importing=structuredClone(source);importing.files['main.ts']="import './assets/red.bmp';\n"+text;
  const rejected=await compileVisual({source:importing},{dependencyRoot});assert.equal(rejected.ok,false);assert.equal(rejected.code,'SOURCE_BOUNDARY_VIOLATION');

  // Copy the trusted linker closure into a private scratch checkout. Change only
  // asset helper bytes there; never mutate this checkout or node_modules.
  const scratch=await mkdtemp(join(tmpdir(),'lux-helper-identity-'));
  try {
    for(const path of ['apps/build-worker/src','packages/assets/src','packages/visual-sdk/src','packages/runtime-contracts/src','scripts/experiment-job.ps1','scripts/experiment-job.cs']) {
      await mkdir(dirname(join(scratch,path)),{recursive:true});await cp(resolve(path),join(scratch,path),{recursive:true});
    }
    const helper=join(scratch,'packages/assets/src/index.mjs');await writeFile(helper,(await readFile(helper,'utf8'))+'\n// helper-only byte change\n');
    const copied=await import(pathToFileURL(join(scratch,'apps/build-worker/src/link-runtime.mjs')).href);
    await assert.rejects(copied.linkRuntime(artifact,{dependencyRoot}),/Dependency hash mismatch: assets\/index\.mjs/);
  } finally {await rm(scratch,{recursive:true,force:true});}
});
