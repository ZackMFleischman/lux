import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {parseDeclarationPackManifest as parse,verifyDeclarationPack as verify} from '../../packages/core/src/project/tooling.ts';
const sha = value => createHash('sha256').update(value).digest('hex');
const encode = value => new TextEncoder().encode(value);
function fixture(extra = {}) {
  const files = { 'sdk/0.1.0/index.d.ts': encode('export {};\n'), 'sdk/0.2.0/index.d.ts': encode('export {};\n'),
    'node_modules/demo/package.json': encode('{"name":"demo","version":"1.0.0"}'), 'licenses/demo/LICENSE': encode('abc'), ...extra };
  const manifest = { format: 'lux-declaration-pack', version: 1, typescriptVersion: '7.0.2', threeVersion: '0.186.0', threeTypesVersion: '0.186.0',
    sdkVariants: { '0.1.0': { declarationEntry: 'sdk/0.1.0/index.d.ts', contractHash: '1'.repeat(64) }, '0.2.0': { declarationEntry: 'sdk/0.2.0/index.d.ts', contractHash: '2'.repeat(64) } },
    packages: [{ name: 'demo', version: '1.0.0', metadataPath: 'node_modules/demo/package.json', licensePaths: ['licenses/demo/LICENSE'] }], files: [] };
  return rebuild({manifest, files});
}
function rebuild(p) {
  p.manifest.files = Object.entries(p.files).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([path, bytes]) => ({path,byteLength:bytes.byteLength,sha256:sha(bytes)}));
  return wire(p);
}
function wire(p) { p.raw=encode(JSON.stringify(p.manifest)); p.hash=sha(JSON.stringify(['lux-declaration-pack',1,p.manifest])); return p; }
const check = test;
check('canonical identity binds exact bytes and returns private snapshots before yielding', async () => {
  const p=fixture();
  assert.equal(p.hash,'6d24408d27f11abe4e6b9ff32029edf03952101ef8c133e8709eb799d86bcd4e');
  assert.equal(sha(p.files['licenses/demo/LICENSE']),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const pending=verify(p.raw,p.files,p.hash); p.files['licenses/demo/LICENSE'].fill(0); p.raw.fill(0);
  const result=await pending;
  assert.equal(result.declarationPackHash,p.hash);
  assert.equal(new TextDecoder().decode(result.files['licenses/demo/LICENSE']),'abc');
  assert.notEqual(result.files['licenses/demo/LICENSE'],p.files['licenses/demo/LICENSE']);
  assert.ok(Object.isFrozen(result.manifest.sdkVariants['0.2.0']));
  assert.ok(Object.isFrozen(result.files));
});
check('canonicalizes record order, package order, license order and JSON whitespace', async () => {
  const p=fixture({'licenses/demo/NOTICE.txt':encode('notice')});
  p.manifest.packages[0].licensePaths.push('licenses/demo/NOTICE.txt');
  p.manifest.packages.push({...p.manifest.packages[0],name:'alpha',licensePaths:[...p.manifest.packages[0].licensePaths]});
  p.manifest.packages.sort((a,b)=>a.name<b.name?-1:1);wire(p);
  const canonical=parse(p.raw);
  p.manifest.packages.reverse(); for(const pkg of p.manifest.packages)pkg.licensePaths.reverse();
  const reordered={...p.manifest,files:[...p.manifest.files].reverse()};
  const raw=encode(JSON.stringify(Object.fromEntries(Object.entries(reordered).reverse()),null,2));
  assert.deepEqual(parse(raw),canonical); assert.equal((await verify(raw,p.files,p.hash)).declarationPackHash,p.hash);
});
check('rejects changes, missing bytes and unexpected files with specified codes', async () => {
  for(const kind of ['byte','length','hash','missing','extra']) {
    const p=fixture();
    if(kind==='byte') p.files['licenses/demo/LICENSE'][0]=0;
    if(kind==='length') p.files['licenses/demo/LICENSE']=encode('abcd');
    if(kind==='hash') p.hash='0'.repeat(64);
    if(kind==='missing') delete p.files['licenses/demo/LICENSE'];
    if(kind==='extra') p.files['extra.txt']=encode('');
    await assert.rejects(verify(p.raw,p.files,p.hash),{code:kind==='missing'?'TOOLCHAIN_UNAVAILABLE':kind==='extra'?'TOOLCHAIN_INVALID':'TOOLCHAIN_MODIFIED'});
  }
});
check('rejects malformed raw JSON, duplicate decoded keys, BOM and unknown fields', () => {
  const p=fixture();
  for(const raw of ['{"format":"lux-declaration-pack","for\\u006dat":"lux-declaration-pack"}', '\ufeff'+JSON.stringify(p.manifest), '{"version":1e999}', '{"x":', JSON.stringify({...p.manifest,unknown:1}), JSON.stringify({...p.manifest,version:2})]) assert.throws(()=>parse(encode(raw)),{code:'TOOLCHAIN_INVALID'});
  assert.throws(()=>parse(new Uint8Array([0xff])),{code:'TOOLCHAIN_INVALID'});
});
check('rejects unsafe and executable paths including collisions and own pack.json', () => {
  for(const path of ['/a.d.ts','C:/a.d.ts','a\\b.d.ts','a/../b.d.ts','a//b.d.ts','a/./b.d.ts','a/con.d.ts','a/NUL.txt','a/CONIN$.txt','a/CONOUT$.txt','a./x.d.ts','a /x.d.ts','a:x.d.ts','é.d.ts','a.js','a.mjs','a.cjs','a.exe','a.dll','a.wasm','a.node','pack.json','PACK.json']) {
    const p=fixture({[path]:encode('')}); assert.throws(()=>parse(p.raw),{code:'TOOLCHAIN_INVALID'},path);
  }
  for(const extra of [{'SDK/0.1.0/index.d.ts':encode('')},{'sdk/0.1.0/index.d.ts/x.txt':encode('')}]) assert.throws(()=>parse(fixture(extra).raw),{code:'TOOLCHAIN_INVALID'});
  const p=fixture(); p.manifest.files.push(p.manifest.files[0]); assert.throws(()=>parse(wire(p).raw),{code:'TOOLCHAIN_INVALID'});
  assert.ok(parse(fixture({'a b/file name.d.ts':encode('')}).raw));
});
check('requires declared SDK entries, package metadata and at least one inventoried notice', () => {
  for(const kind of ['entry','metadata','notice','empty','duplicate']) {
    const p=fixture();
    if(kind==='entry') p.manifest.sdkVariants['0.2.0'].declarationEntry='absent.d.ts';
    if(kind==='metadata') p.manifest.packages[0].metadataPath='absent/package.json';
    if(kind==='notice') p.manifest.packages[0].licensePaths=['absent.txt'];
    if(kind==='empty') p.manifest.packages[0].licensePaths=[];
    if(kind==='duplicate') p.manifest.packages.push({...p.manifest.packages[0]});
    assert.throws(()=>parse(wire(p).raw),{code:kind==='duplicate'?'TOOLCHAIN_INVALID':'TOOLCHAIN_UNAVAILABLE'});
  }
});
check('never invokes file-map or typed-array accessors, iterators or species', async () => {
  const p=fixture(); let calls=0;
  for(const bytes of Object.values(p.files)) for(const key of ['byteLength','buffer','constructor',Symbol.iterator]) Object.defineProperty(bytes,key,{get(){calls++; throw Error('getter');}});
  await verify(p.raw,p.files,p.hash); assert.equal(calls,0);
  Object.defineProperty(p.files,'licenses/demo/LICENSE',{enumerable:true,get(){calls++; throw Error('getter');}});
  await assert.rejects(verify(p.raw,p.files,p.hash),{code:'TOOLCHAIN_INVALID'}); assert.equal(calls,0);
});
check('rejects shared, detached, non-byte views and non-data maps', async () => {
  for(const bytes of [new Uint8Array(new SharedArrayBuffer(1)),new Uint16Array(1),new DataView(new ArrayBuffer(1))]) {
    const p=fixture(); p.files['licenses/demo/LICENSE']=bytes;
    await assert.rejects(verify(p.raw,p.files,p.hash),{code:'TOOLCHAIN_INVALID'});
  }
  const p=fixture(); structuredClone(p.files['licenses/demo/LICENSE'].buffer,{transfer:[p.files['licenses/demo/LICENSE'].buffer]});
  await assert.rejects(verify(p.raw,p.files,p.hash),{code:'TOOLCHAIN_INVALID'});
  for(const map of [[],Object.create({}),new Map(),{...fixture().files,[Symbol()]:new Uint8Array()}]) await assert.rejects(verify(fixture().raw,map,fixture().hash),{code:'TOOLCHAIN_INVALID'});
});
check('accepts exact manifest and path byte ceilings and rejects +1', () => {
  const p=fixture(); const padding=1048576-p.raw.length;
  assert.ok(parse(encode(JSON.stringify(p.manifest)+' '.repeat(padding))));
  assert.throws(()=>parse(encode(JSON.stringify(p.manifest)+' '.repeat(padding+1))),{code:'QUOTA_EXCEEDED'});
  assert.ok(parse(fixture({['x'.repeat(235)+'.d.ts']:encode('')}).raw));
  assert.throws(()=>parse(fixture({['x'.repeat(236)+'.d.ts']:encode('')}).raw),{code:'QUOTA_EXCEEDED'});
});
check('accepts exact file and aggregate bytes, rejects overflow before copies or hashes', async t => {
  const p=fixture(); for(const key of Object.keys(p.files))p.files[key]=new Uint8Array();
  for(let i=0;i<4;i++)p.files[`large${i}.txt`]=new Uint8Array(8388608);
  rebuild(p); assert.equal(Object.keys((await verify(p.raw,p.files,p.hash)).files).length,8);
  const originalSet=Uint8Array.prototype.set, originalDigest=crypto.subtle.digest; let copies=0,digests=0;
  const payloads=new Set(Object.values(p.files));
  t.mock.method(Uint8Array.prototype,'set',function(source,...rest){if(payloads.has(source))copies++; return originalSet.call(this,source,...rest);});
  t.mock.method(crypto.subtle,'digest',function(...args){digests++;return originalDigest.apply(this,args);});
  p.files['large0.txt']=new Uint8Array(8388609);
  await assert.rejects(verify(p.raw,p.files,p.hash),{code:'QUOTA_EXCEEDED'});
  p.files['large0.txt']=new Uint8Array(8388608); p.files['licenses/demo/LICENSE']=new Uint8Array(1);
  await assert.rejects(verify(p.raw,p.files,p.hash),{code:'QUOTA_EXCEEDED'}); assert.equal(copies,0);assert.equal(digests,0);
});
check('enforces file and package cardinality before payload work, including equality', async () => {
  const p=fixture(); for(let i=4;i<8192;i++)p.files[`f${i}.txt`]=new Uint8Array(); rebuild(p);
  assert.equal((await verify(p.raw,p.files,p.hash)).manifest.files.length,8192);
  p.files['overflow.txt']=new Uint8Array(); await assert.rejects(verify(p.raw,p.files,p.hash),{code:'QUOTA_EXCEEDED'});
  rebuild(p);assert.throws(()=>parse(p.raw),{code:'QUOTA_EXCEEDED'});
  const q=fixture(); q.manifest.packages=Array.from({length:32},(_,i)=>({...q.manifest.packages[0],name:`p${i}`})); assert.equal(parse(wire(q).raw).packages.length,32);
  q.manifest.packages.push({...q.manifest.packages[0],name:'overflow'});assert.throws(()=>parse(wire(q).raw),{code:'QUOTA_EXCEEDED'});
});
check('rejects manifest file and aggregate byte ceilings before hashing originals',()=>{
  const p=fixture();p.manifest.files[0].byteLength=8388609;assert.throws(()=>parse(wire(p).raw),{code:'QUOTA_EXCEEDED'});
  const q=fixture({'fifth.txt':encode('')});for(const file of q.manifest.files)file.byteLength=8388608;
  assert.throws(()=>parse(wire(q).raw),{code:'QUOTA_EXCEEDED'});
});
