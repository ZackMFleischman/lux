import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import releaseIO from '../../tools/gpu-spike/transport-release.cjs';
import {readFile,copyFile,mkdir,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {linkedBody} from '../../apps/build-worker/src/artifact-identity.mjs';
import {normalizeComponentDeclaration,canonicalComponentMetadataJson} from '../../packages/runtime-contracts/src/components.mjs';
import {canonicalControlSchemaJson} from '../../packages/runtime-contracts/src/parameters.mjs';
import {deriveAssets} from '../../packages/assets/src/index.mjs';
import {declaration} from '../compiler/component-fixture.mjs';
import exportPackage from '../../packages/export/src/package.cjs';

test('actual transport reader rejects well-formed v4 with freshly built shared policy and source fallback before staging',async()=>{
 const component=normalizeComponentDeclaration(declaration),hash=releaseIO.hash;
 const body=linkedBody({linkedVersion:4,code:'export default {};',sourceMap:'',bundleHash:'a'.repeat(64),linker:{version:'0.28.2',implementationHash:'a'.repeat(64),apiHash:'b'.repeat(64),binaryHash:'c'.repeat(64)},sdkVersion:'0.3.0',executionModel:'single-image-source-v1',component,componentMetadataHash:hash(canonicalComponentMetadataJson(component)),controls:component.controls,controlSchemaHash:hash(canonicalControlSchemaJson(component.controls)),...await deriveAssets({},hash)});
 const directory=await mkdtemp(join(tmpdir(),'lux-component-release-'));
 const bytes=JSON.stringify({format:'lux-transport',version:1,sourceHash:'b'.repeat(64),settings:{width:1920,height:1080,fps:60,seed:7},linked:{...body,linkedHash:hash(JSON.stringify(body))}}),filename=join(directory,hash(bytes)+'.json');await writeFile(filename,bytes);
 for(const generated of [false,true]){
  const readers=join(directory,generated?'generated':'source');await mkdir(readers);
  for(const name of ['transport-release.cjs','parameter-mapping.cjs'])await copyFile(new URL('../../tools/gpu-spike/'+name,import.meta.url),join(readers,name));
  const policyURL=new URL('../../tools/gpu-spike/runtime-validation.mjs',import.meta.url);
  if(generated)await build({entryPoints:[fileURLToPath(policyURL)],outfile:join(readers,'runtime-validation.cjs'),bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
  else await writeFile(join(readers,'runtime-validation.mjs'),`export * from ${JSON.stringify(policyURL.href)};`);
  const require=createRequire(join(readers,'test.cjs')),policy=require('./parameter-mapping.cjs').policy();assert.equal(policy.linkedBody(body).linkedVersion,4,'the rebuilt/shared generic policy must structurally accept v4');
  assert.throws(()=>require('./transport-release.cjs').readTransportRelease(filename),/Unsupported.*profile/i);
 }
 const runtime=join(directory,'runtime'),output=join(directory,'output');await mkdir(runtime);await mkdir(output);
 assert.throws(()=>exportPackage.createPackage({name:'Component',transportPath:filename,runtimeDirectory:runtime,outputDirectory:output,electronVersion:'1.2.3'}),/Unsupported.*profile/i);
 assert.deepEqual(await readdir(output),[]);
});
test('transport release binds linked code and output settings to immutable bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-release-'));
  const body = { code: 'export default {};', sourceMap: '{}', bundleHash: 'a'.repeat(64), linker: {version:'test'} };
  const release = {format:'lux-transport',version:1,sourceHash:'b'.repeat(64),settings:{width:1920,height:1080,fps:60,seed:7},
    linked:{...body,linkedHash:releaseIO.hash(JSON.stringify(body))}};
  const bytes = JSON.stringify(release), filename = join(directory, releaseIO.hash(bytes) + '.json');
  await writeFile(filename, bytes);
  assert.equal(releaseIO.readTransportRelease(filename).settings.seed, 7);
  await writeFile(filename, bytes + ' ');
  assert.throws(() => releaseIO.readTransportRelease(filename), /content hash/);
  release.linked.code += 'changed';
  const changed = JSON.stringify(release), changedPath = join(directory, releaseIO.hash(changed) + '.json');
  await writeFile(changedPath, changed);
  assert.throws(() => releaseIO.readTransportRelease(changedPath), /Linked module hash/);
});
