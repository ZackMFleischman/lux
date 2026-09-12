import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { deriveAssets } from '../../packages/assets/src/index.mjs';
import { normalizeControlDeclarations, canonicalControlSchemaJson } from '../../packages/runtime-contracts/src/parameters.mjs';
import { artifactBody, linkedBody, verifyArtifact, verifyLinked } from '../../apps/build-worker/src/artifact-identity.mjs';
import { readCompileResult } from '../../apps/build-worker/src/compile.mjs';
import { validateSource } from '../../apps/build-worker/src/source-policy.mjs';
import { sourceBundleSchema, compiledArtifactSchema } from '../../packages/runtime-contracts/src/index.ts';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const controls = normalizeControlDeclarations({ height: {type:'number',label:'Height',default:1,min:0,max:4} });
const controlSchemaHash = hash(canonicalControlSchemaJson(controls));
const assets = await deriveAssets({}, hash);
const base = { sourceHash:'a'.repeat(64),entry:'main.js',modules:{'main.js':'export default 1;','__lux/sdk.js':''},sourceMaps:{},sdkVersion:'0.2.0',compilerVersion:'7.0.2',dependencyHashes:{},artifactVersion:3,...assets,controls,controlSchemaHash };
const linker = {version:'0.28.2',implementationHash:'b'.repeat(64),apiHash:'c'.repeat(64),binaryHash:'d'.repeat(64)};
const sign = body => ({...body,bundleHash:hash(JSON.stringify(body))});
const signLink = body => ({...body,linkedHash:hash(JSON.stringify(body))});

test('SDK 0.2 source envelopes are independent from asset envelope version', () => {
  for (const envelope of [{}, {sourceVersion:2,assets:{}}]) {
    const source = validateSource({sdkVersion:'0.2.0',entry:'main.ts',files:{'main.ts':''},...envelope});
    assert.equal(source.sdkVersion, '0.2.0'); assert.equal(sourceBundleSchema.safeParse(source).success, true);
  }
  assert.throws(() => validateSource({sdkVersion:'../../evil',entry:'main.ts',files:{'main.ts':''}}), /SDK/);
});

test('SDK 0.2 source metadata and files reject inherited/accessor data without evaluating getters', () => {
  let calls = 0;
  const source = {sdkVersion:'0.2.0',entry:'main.ts',files:{'main.ts':''}};
  const getter = {...source}; Object.defineProperty(getter,'sdkVersion',{enumerable:true,get(){calls++;return '0.2.0';}});
  assert.throws(() => validateSource(getter), /data properties/);
  const fileGetter = {...source,files:{get 'main.ts'(){calls++;return '';}}};
  assert.throws(() => validateSource(fileGetter), /data properties/);
  assert.throws(() => validateSource(Object.create(source)), /plain data record/);
  assert.equal(calls,0);
});

test('v3 artifact/link identities seal schema and assets with consistent SDK/version and no extra fields', async () => {
  const artifact = sign(artifactBody(base));
  assert.equal(compiledArtifactSchema.safeParse(artifact).success, true);
  assert.deepEqual(await verifyArtifact(artifact, hash), artifact);
  const linked = signLink(linkedBody({linkedVersion:3,code:'export default 1;',sourceMap:'{}',bundleHash:artifact.bundleHash,linker,...assets,controls,controlSchemaHash}));
  assert.deepEqual(await verifyLinked(linked, hash, artifact), linked);
  for (const mutate of [
    value => { value.controls[0].max = 9; }, value => { value.controlSchemaHash = '0'.repeat(64); },
    value => { value.controls = []; }, value => { delete value.controlSchemaHash; },
    value => { value.artifactVersion = 2; }, value => { value.sdkVersion = '0.1.0'; }, value => { value.extra = 1; },
  ]) { const bad = structuredClone(artifact); mutate(bad); await assert.rejects(verifyArtifact(bad, hash)); }
  const badHash = structuredClone(artifact); badHash.controls[0].max = 3;
  const {bundleHash: _hash, ...badBody} = badHash; badHash.bundleHash = hash(JSON.stringify(badBody));
  await assert.rejects(verifyArtifact(badHash, hash), /schema.*hash/i);
  const wrong = structuredClone(linked); wrong.controls = []; wrong.controlSchemaHash = hash('[]');
  wrong.linkedHash = hash(JSON.stringify(linkedBody(wrong)));
  await assert.rejects(verifyLinked(wrong, hash, artifact), /schema|identity/i);
  await assert.rejects(verifyLinked({...linked,linkedVersion:2}, hash, artifact));
});

test('compiler parent binds v3 to SDK, source hash and source assets including absent assets', async () => {
  const source = validateSource({sdkVersion:'0.2.0',entry:'main.ts',files:{'main.ts':''}});
  const artifact = sign(artifactBody({...base,sourceHash:hash(JSON.stringify(source))}));
  const directory = await mkdtemp(join(tmpdir(),'lux-parameter-parent-')), path = join(directory,'result.json');
  try {
    await writeFile(path,JSON.stringify({ok:true,artifact,diagnostics:[]}));
    assert.equal((await readCompileResult(path,source)).ok,true);
    const other = {...source,sdkVersion:'0.1.0'};
    assert.equal((await readCompileResult(path,other)).ok,false);
    const red = {'assets/red.bmp':{mediaType:'image/bmp',encoding:'base64',data:'Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA=='}};
    const wrongAssets = sign(artifactBody({...artifact,...await deriveAssets(red,hash)}));
    await writeFile(path,JSON.stringify({ok:true,artifact:wrongAssets,diagnostics:[]}));
    const result = await readCompileResult(path,source);
    assert.equal(result.ok,false); assert.match(result.diagnostics[0].message,/source.*asset/i);
  } finally { if(dirname(resolve(directory))!==resolve(tmpdir()))throw Error('Unsafe cleanup'); await rm(directory,{recursive:true,force:true}); }
});
