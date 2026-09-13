import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { normalizeControlDeclarations, canonicalControlSchemaJson } from '../../packages/runtime-contracts/src/parameters.mjs';
import registration from '../../packages/export/src/register.cjs';
import startup from '../../tools/gpu-spike/host-startup.cjs';
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
