import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deriveAssets} from '../../packages/assets/src/index.mjs';
import {artifactBody,linkedBody,verifyArtifact,verifyLinked} from '../../apps/build-worker/src/artifact-identity.mjs';
import {readCompileResult} from '../../apps/build-worker/src/compile.mjs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const hash = bytes=>createHash('sha256').update(bytes).digest('hex');
const legacy = {sourceHash:'a'.repeat(64),entry:'main.js',modules:{'main.js':'export default 1;','__lux/sdk.js':''},sourceMaps:{},sdkVersion:'0.1.0',compilerVersion:'7.0.2',dependencyHashes:{}};
const linker = {version:'0.28.2',implementationHash:'b'.repeat(64),apiHash:'c'.repeat(64),binaryHash:'d'.repeat(64)};
const sign = body=>({...body,bundleHash:hash(JSON.stringify(body))});
const linkSign = body=>({...body,linkedHash:hash(JSON.stringify(body))});

test('legacy artifact and linked identity bodies preserve exact property order and algorithms',async()=>{
  assert.equal(JSON.stringify(artifactBody(legacy)),JSON.stringify(legacy));
  assert.deepEqual(await verifyArtifact(sign(legacy),hash),sign(legacy));
  const body={code:'export default 1;',sourceMap:'{}',bundleHash:hash(JSON.stringify(legacy)),linker};
  assert.equal(JSON.stringify(linkedBody(body)),JSON.stringify(body));
  assert.deepEqual(await verifyLinked(linkSign(body),hash,sign(legacy)),linkSign(body));
});

test('v2 verifies original-byte metadata and consistent artifact/linked versions',async()=>{
  const assets=await deriveAssets({'assets/red.bmp':{mediaType:'image/bmp',encoding:'base64',data:'Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA=='}},hash);
  const artifact=sign(artifactBody({...legacy,artifactVersion:2,...assets}));
  assert.deepEqual(await verifyArtifact(artifact,hash),artifact);
  const linked=linkSign(linkedBody({linkedVersion:2,code:'export default 1;',sourceMap:'{}',bundleHash:artifact.bundleHash,linker,...assets}));
  assert.deepEqual(await verifyLinked(linked,hash,artifact),linked);
  for (const change of [a=>{a.assets['assets/red.bmp'].width=2;},a=>{a.assets['assets/red.bmp'].sha256='0'.repeat(64);},a=>{a.assets={};},a=>{a.assetSetHash='0'.repeat(64);},a=>{delete a.artifactVersion;},a=>{a.artifactVersion=3;},a=>{a.extra=true;}]) {
    const bad=structuredClone(artifact);change(bad);await assert.rejects(verifyArtifact(bad,hash));
  }
  const forged=structuredClone(artifact);forged.assets['assets/red.bmp'].height=2;
  forged.bundleHash=hash(JSON.stringify(artifactBody(forged)));
  await assert.rejects(verifyArtifact(forged,hash));
  await assert.rejects(verifyLinked({...linked,linkedVersion:3},hash,artifact));
  await assert.rejects(verifyLinked(linked,hash,sign(legacy)));
  const badLink=structuredClone(linked);badLink.assets={};badLink.linkedHash=hash(JSON.stringify(linkedBody(badLink)));
  await assert.rejects(verifyLinked(badLink,hash,artifact));
});

test('compiler parent rejects internally consistent assets unrelated to submitted source',async()=>{
  const assets={'assets/red.bmp':{mediaType:'image/bmp',encoding:'base64',data:'Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA=='}};
  const source={sourceVersion:2,sdkVersion:'0.1.0',entry:'main.ts',files:{'main.ts':''},assets};
  const changed=structuredClone(assets), bytes=Buffer.from(changed['assets/red.bmp'].data,'base64');bytes[54]=123;changed['assets/red.bmp'].data=bytes.toString('base64');
  const artifact=sign(artifactBody({...legacy,sourceHash:hash(JSON.stringify(source)),artifactVersion:2,...await deriveAssets(changed,hash)}));
  const folder=await mkdtemp(join(tmpdir(),'lux-parent-asset-')),path=join(folder,'result.json');
  try {
    await writeFile(path,JSON.stringify({ok:true,artifact,diagnostics:[]}));
    const result=await readCompileResult(path,source);
    assert.equal(result.ok,false);assert.match(result.diagnostics[0].message,/source.*asset/i);
  } finally {await rm(folder,{recursive:true,force:true});}
});
