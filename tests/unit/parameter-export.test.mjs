import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { normalizeControlDeclarations, canonicalControlSchemaJson } from '../../packages/runtime-contracts/src/parameters.mjs';
import {validateControlSnapshot} from '../../packages/runtime-contracts/src/parameters.mjs';
import mapping from '../../tools/gpu-spike/parameter-mapping.cjs';
import registration from '../../packages/export/src/register.cjs';
import startup from '../../tools/gpu-spike/host-startup.cjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import packageIO from '../../packages/export/src/package.cjs';
import runtimeCapability from '../../packages/export/src/runtime-capability.cjs';
import {validateRequest} from '../../apps/installed-runtime/src/registry.cjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const controls = normalizeControlDeclarations({height:{type:'number',label:'Long identical label A',min:-2,max:2,default:0},speed:{type:'number',label:'Long identical label B',min:10,max:20,default:12}});
const schemaHash = hash(canonicalControlSchemaJson(controls));
const release = {version:2,releaseId:'a'.repeat(64),runtimeId:'b'.repeat(64),name:'Parameters',controls,controlSchemaHash:schemaHash,savedControls:{height:1,speed:15}};

test('v2 installed descriptor preserves ordered mapping, adapted unique labels and saved normalized defaults',()=>{
  const identity=registration.sourceIdentity(release);
  assert.match(identity.sidecar,/^lux-installed-source-v2\n/);
  assert.ok(identity.sidecar.includes(schemaHash));
  const rows=identity.sidecar.trimEnd().split('\n').slice(7);
  assert.equal(rows.length,2);
  assert.equal(rows[0].split('\t')[0],'height');
  assert.notEqual(rows[0].split('\t')[1],rows[1].split('\t')[1]);
  assert.equal(Number(rows[0].split('\t')[2]),0.75);
  assert.equal(Number(rows[1].split('\t')[2]),0.5);
});
test('normalized endpoints preserve exact decimal bounds and wide finite ranges',async()=>{
 const schema=normalizeControlDeclarations({gain:{type:'number',label:'Gain',min:-2,max:0.1,default:0},wide:{type:'number',label:'Wide',min:-1e307,max:1e307,default:0}});
 const expected=hash(canonicalControlSchemaJson(schema));
 for(const u of [0,0.5,1]){
  const values=mapping.mapHostSnapshot(schema,expected,{initialized:true,count:2,schemaHash:expected,sequence:'1',values:[u,u]});
  assert.doesNotThrow(()=>validateControlSnapshot(schema,values));if(u===1)assert.equal(values.gain,0.1);
 }
 assert.equal(mapping.parameterMapping(schema,{gain:0.1,wide:0},expected)[1].initial,0.5);
 let promoted;
 const host=new startup.HostStartup({revisionId:'decimal',schema,schemaHash:expected,
  init:async values=>{validateControlSnapshot(schema,values);return {type:'ready',revisionId:'decimal',frameId:'1',controls:values,controlSchemaHash:expected};},
  update:async values=>validateControlSnapshot(schema,values),observe:()=>{},promote:(_frame,values)=>promoted=values,stopped:()=>false});
 await host.apply({initialized:true,count:2,schemaHash:expected,sequence:'1',values:[1,0.5]});
 assert.equal(promoted.gain,0.1);
 await host.apply({initialized:true,count:2,schemaHash:expected,sequence:'2',values:[0,0]});
 await host.apply({initialized:true,count:2,schemaHash:expected,sequence:'3',values:[1,1]});
});

test('host startup maps an atomic normalized tuple and verifies first-frame full values',async()=>{
  const seen=[];const host=new startup.HostStartup({revisionId:'r',schema:controls,schemaHash,
    init:async values=>({type:'ready',revisionId:'r',frameId:'1',controls:values,controlSchemaHash:schemaHash}),
    update:async values=>seen.push(values),observe:()=>{},promote:(_frame,values)=>seen.push(values),stopped:()=>false});
  await host.apply({initialized:true,count:2,schemaHash,sequence:'1',values:[0.75,0.5]});
  assert.deepEqual(seen,[{height:1,speed:15}]);
  await host.apply({initialized:true,count:2,schemaHash,sequence:'2',values:[0,1]});
  assert.deepEqual(seen[1],{height:-2,speed:20});
});

test('empty initialized snapshot starts while null/uninitialized and wrong schema never promote',async()=>{
 const emptyHash=hash(canonicalControlSchemaJson([]));let count=0;
 const host=new startup.HostStartup({revisionId:'r',schema:[],schemaHash:emptyHash,init:async values=>({type:'ready',revisionId:'r',frameId:'1',controls:values,controlSchemaHash:emptyHash}),update:async()=>{},observe:()=>{},promote:()=>count++,stopped:()=>false});
 await host.apply(null);assert.equal(count,0);
 await host.apply({initialized:true,count:0,schemaHash:emptyHash,sequence:'1',values:[]});assert.equal(count,1);
 await assert.rejects(host.apply({initialized:true,count:0,schemaHash,sequence:'2',values:[]}),/schema/i);
});

test('parameter release pins complete mapping and self-contained validators, with original bytes and tamper rejection',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lux-parameter-package-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const runtime=path.join(root,'runtime');
 for(const name of [...packageIO.requiredRuntimeFiles,...registration.supervisorFiles]){
  const target=path.join(runtime,name);fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,name==='electron/version'?'44.3.0':runtimeCapability.parameterCapabilities[name]??'fixture');
 }
 for(const name of ['package.cjs','install.cjs','register.cjs','runtime-capability.cjs'])fs.copyFileSync(new URL('../../packages/export/src/'+name,import.meta.url),path.join(runtime,name));
 for(const name of ['transport-release.cjs','parameter-mapping.cjs','runtime-validation.cjs']){
  fs.copyFileSync(new URL('../../tools/gpu-spike/'+name,import.meta.url),path.join(runtime,name));
  fs.copyFileSync(new URL('../../tools/gpu-spike/'+name,import.meta.url),path.join(runtime,'tools/gpu-spike',name));
 }
 const linked={linkedVersion:3,code:'export default {};',sourceMap:'',bundleHash:'b'.repeat(64),linker:{version:'0.28.2',implementationHash:'c'.repeat(64),apiHash:'d'.repeat(64),binaryHash:'e'.repeat(64)},assets:{},assetSetHash:hash('[]'),controls,controlSchemaHash:schemaHash};
 linked.linkedHash=hash(JSON.stringify(linked));
 const transport={format:'lux-transport',version:1,sourceHash:'a'.repeat(64),settings:{width:1920,height:1080,fps:60,seed:0},linked};
 const bytes=JSON.stringify(transport),transportPath=path.join(root,hash(bytes)+'.json');fs.writeFileSync(transportPath,bytes);
 const result=packageIO.createPackage({name:'Parameters',transportPath,runtimeDirectory:runtime,electronVersion:'44.3.0',outputDirectory:path.join(root,'out'),savedControls:{height:1,speed:15}});
 const loaded=packageIO.validatePackage(result.path);assert.equal(loaded.release.version,2);assert.equal(loaded.runtime.version,2);
 assert.deepEqual(loaded.release.savedControls,{height:1,speed:15});assert.equal(loaded.release.controlMapping[0].initial,0.75);
 const descriptor=registration.sourceIdentity(loaded.release).sidecar;
 assert.equal(validateRequest({version:2,releaseId:result.releaseId,runtimeId:result.runtimeId,instanceId:'a'.repeat(32),hostPid:1,descriptorHash:hash(descriptor)},result.runtimeId).version,2);
 const releaseFile=path.join(result.path,'release/release.json');loaded.release.controlMapping[0].id='changed';fs.writeFileSync(releaseFile,JSON.stringify(loaded.release));
 assert.throws(()=>packageIO.validatePackage(result.path),/identity mismatch/);
});
