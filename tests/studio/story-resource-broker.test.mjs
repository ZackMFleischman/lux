import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deriveAssets} from '../../packages/assets/src/index.mjs';
import {decodeStoryAssets} from '../../apps/studio/src/assets/story-asset-decoder-worker.mjs';
import {createStoryResourceBroker} from '../../apps/studio/src/story/story-resource-broker.mjs';
import {prepareStoryAssetLeaseFactory,storyAssetDecoderVersion,storyAssetLeaseKey} from '../../apps/studio/src/assets/story-asset-leases.mjs';
const identity=generation=>({instanceId:'test',generation,scheduleHash:'a'.repeat(64),capsuleHash:'b'.repeat(64)});
const visual={id:'a',assetSetHash:'c'.repeat(64),assets:{'x.png':{mediaType:'image/png',encoding:'base64',data:'YWJj',sha256:'d'.repeat(64),byteLength:100,width:10,height:10}}};
const setup=()=>{const broker=createStoryResourceBroker();broker.reserveGeneration(identity(1),640,360,[visual]);return broker;};
const reserve=(generation=1,requestId='reserve')=>({kind:'story-asset-staging-reserve',requestId,identity:identity(generation),visualId:'a',assetSetHash:visual.assetSetHash,decoderVersion:storyAssetDecoderVersion,charge:{encodedBytes:100,rgbaBytes:400,totalBytes:500}});
const authorize=(grant,mode='lease')=>({kind:'story-asset-decode-authorize',requestId:'authorize',decodeRequestId:'decode',identity:grant.identity,grantId:grant.grantId,mode,visualId:'a',assetSetHash:visual.assetSetHash,decoderVersion:storyAssetDecoderVersion,charge:{encodedBytes:100,rgbaBytes:400,totalBytes:500}});
const decode=(grant,mode='lease')=>({kind:'story-assets-decode',mode,requestId:'decode',identity:grant.identity,stagingGrantId:grant.grantId,decoderVersion:storyAssetDecoderVersion,visualId:'a',assetSetHash:visual.assetSetHash,assets:structuredClone(visual.assets)});
const transfer=grant=>({kind:'story-asset-staging-transfer',requestId:'transfer',identity:grant.identity,grantId:grant.grantId,leaseKey:storyAssetLeaseKey(visual.assetSetHash)});
const release=(grant,disposition='verified')=>({kind:'story-asset-staging-release',requestId:'release-stage',identity:grant.identity,grantId:grant.grantId,disposition});
test('generation peak targets and nonsettled termination retain client capacity',()=>{
 const b=setup();b.reserveGeneration(identity(2),3840,2160,[visual]);
 assert.throws(()=>b.reserveGeneration(identity(3),640,360,[visual]),/capacity/i);
 b.markUnreclaimed(identity(1));assert.equal(b.status().generations.length,2);
 assert.throws(()=>b.releaseGeneration(identity(1),{storyTargetBytes:0}),/cleanup/i);
 assert.throws(()=>b.reserveGeneration(identity(3),640,360,[visual]),/capacity/i);
 assert.equal(b.status().storyTargetBytes,24*(640*360+3840*2160));
});
test('staging is client-wide, exact, and atomically transfers into a lease',()=>{
 const b=setup();b.reserveGeneration(identity(2),640,360,[visual]);
 assert.throws(()=>b.handle({...reserve(),charge:{encodedBytes:100,rgbaBytes:399,totalBytes:499}}),/charge/i);
 const grant=b.handle(reserve());assert.deepEqual(b.handle(reserve()),grant);
 assert.throws(()=>b.handle(reserve(2,'other')),/staging/i);
 b.handle(authorize(grant));b.authorizeDecode(decode(grant));b.finishDecode(identity(1),grant.grantId,'decode','decoded');
 const lease=b.handle(transfer(grant));
 assert.equal(b.status().assetStagingBytes,0);assert.equal(b.status().assetLeaseBytes,500);
 assert.throws(()=>b.handle({kind:'story-asset-lease-release',requestId:'wrong',identity:identity(2),leaseGrantId:lease.leaseGrantId,leaseKey:lease.leaseKey}),/grant/i);
 b.handle({kind:'story-asset-lease-release',requestId:'release',identity:identity(1),leaseGrantId:lease.leaseGrantId,leaseKey:lease.leaseKey});
 assert.equal(b.status().assetLeaseBytes,0);
});
test('capture is one client-wide reservation and cleanup requires all settled counters',()=>{
 const b=setup();b.reserveGeneration(identity(2),640,360,[visual]);
 const grant=b.reserveCapture(identity(1),'capture');assert.equal(grant.readbackBytes,640*360*4);
 assert.throws(()=>b.reserveCapture(identity(2),'capture2'),/capture/i);
 assert.throws(()=>b.releaseGeneration(identity(1),{pendingCreates:0,slots:0,assetLeases:0,assetStagingJobs:0,readbackGrants:0,readbackBytes:0,slotStates:{preparing:0,ready:0,active:0,retiring:0,unsettled:0},assetLeaseBytes:0,assetStagingBytes:0,storyTargetBytes:0,pendingImports:0,ownedModuleURLs:0,pendingCallbacks:0,gpuSubmissions:0}),/capture/i);
 b.releaseCapture(identity(1),grant.grantId);
 b.releaseGeneration(identity(1),{pendingCreates:0,slots:0,assetLeases:0,assetStagingJobs:0,readbackGrants:0,readbackBytes:0,slotStates:{preparing:0,ready:0,active:0,retiring:0,unsettled:0},assetLeaseBytes:0,assetStagingBytes:0,storyTargetBytes:0,pendingImports:0,ownedModuleURLs:0,pendingCallbacks:0,gpuSubmissions:0});
 assert.equal(b.status().generations.length,1);
});

test('forced termination retains readback charges and GPU work blocks cleanup',()=>{
 const b=setup(),grant=b.reserveCapture(identity(1),'x');b.markUnreclaimed(identity(1));
 assert.throws(()=>b.releaseCapture(identity(1),grant.grantId),/unreclaimed/i);assert.equal(b.status().readbackBytes,921600);
 const other=setup();assert.throws(()=>other.releaseGeneration(identity(1),{pendingCreates:0,slots:0,assetLeases:0,assetStagingJobs:0,readbackGrants:0,readbackBytes:0,slotStates:{preparing:0,ready:0,active:0,retiring:0,unsettled:0},assetLeaseBytes:0,assetStagingBytes:0,storyTargetBytes:0,pendingImports:0,ownedModuleURLs:0,pendingCallbacks:0,gpuSubmissions:1}),/cleanup/i);
});

test('pins decoder version and validates host-local capture IDs before reserving',()=>{
 const b=setup();assert.throws(()=>b.handle({...reserve(),decoderVersion:'worker-chosen'}),/decoder/i);
 assert.equal(b.status().assetStagingBytes,0);
 for(const id of ['',null,3,'x'.repeat(129)])assert.throws(()=>b.reserveCapture(identity(1),id),/request ID/i);
 assert.equal(b.status().readbackBytes,0);
 b.reserveCapture(identity(1),'valid');
});

test('authorizes exactly one decode and reconstructs its assets from the admitted snapshot',()=>{
 const admitted=structuredClone(visual),b=createStoryResourceBroker();b.reserveGeneration(identity(1),640,360,[admitted]);
 admitted.assets['x.png'].data='mutated after admission';
 const grant=b.handle(reserve()),request=authorize(grant);
 assert.throws(()=>b.authorizeDecode(decode(grant)),/authorization/i);
 const ack=b.handle(request);assert.equal(ack.decodeRequestId,'decode');assert.deepEqual(b.handle(request),ack);
 assert.throws(()=>b.handle({...request,requestId:'other'}),/authoriz/i);
 const incoming=decode(grant),trusted=b.authorizeDecode(incoming);
 assert.notEqual(trusted,incoming);assert.notEqual(trusted.assets,incoming.assets);assert.equal(trusted.assets['x.png'].data,'YWJj');
 assert.ok(Object.isFrozen(trusted.assets['x.png']));incoming.assets['x.png'].data='changed';assert.equal(trusted.assets['x.png'].data,'YWJj');
 assert.throws(()=>b.authorizeDecode(decode(grant)),/dispatch|pending|authoriz/i);
});

test('rejects substituted decoder identity, payload, mode and request ID without consuming authorization',()=>{
 const b=setup(),grant=b.handle(reserve());b.handle(authorize(grant));
 const substitutions=[{mode:'verify'},{requestId:'different'},{decoderVersion:'foreign'},{visualId:'other'},{assetSetHash:'e'.repeat(64)},{stagingGrantId:'other'},
  {identity:{...identity(1),capsuleHash:'f'.repeat(64)}},{identity:{...identity(1),scheduleHash:'f'.repeat(64)}},
  {assets:{...visual.assets,'extra.png':visual.assets['x.png']}},{assets:{'x.png':{...visual.assets['x.png'],data:'substituted'}}},
  {assets:{'x.png':{...visual.assets['x.png'],byteLength:99}}},{extra:'unexpected'}];
 for(const delta of substitutions)assert.throws(()=>b.authorizeDecode({...decode(grant),...delta}));
 assert.equal(b.status().assetStagingBytes,500);assert.equal(b.authorizeDecode(decode(grant)).requestId,'decode');
});

test('pending decode retains staging until exact trusted completion, then only canonical lease transfer succeeds',()=>{
 const b=setup(),grant=b.handle(reserve());
 assert.throws(()=>b.handle(transfer(grant)),/decode|settle/i);
 b.handle(authorize(grant));b.authorizeDecode(decode(grant));
 assert.throws(()=>b.handle(release(grant,'failed')),/pending|flight/i);
 assert.throws(()=>b.handle(transfer(grant)),/pending|settle/i);
 assert.throws(()=>b.finishDecode(identity(1),grant.grantId,'wrong','decoded'),/decode|identity/i);
 b.finishDecode(identity(1),grant.grantId,'decode','decoded');
 assert.throws(()=>b.handle({...transfer(grant),leaseKey:'arbitrary'}),/lease key/i);
 assert.throws(()=>b.handle(release(grant)),/verify|disposition/i);
 const lease=b.handle(transfer(grant));assert.equal(lease.leaseKey,`lux-story-assets-v1:${'c'.repeat(64)}`);
 assert.equal(b.status().assetStagingBytes,0);assert.equal(b.status().assetLeaseBytes,500);
 assert.deepEqual(b.handle(transfer(grant)),lease);assert.equal(b.status().assetLeaseBytes,500);
});

test('failed decode permits failed release only and forced termination preserves pending staging',()=>{
 const b=setup(),grant=b.handle(reserve());b.handle(authorize(grant,'verify'));b.authorizeDecode(decode(grant,'verify'));
 b.finishDecode(identity(1),grant.grantId,'decode','failed');
 assert.throws(()=>b.handle(release(grant)),/failed|disposition/i);
 assert.throws(()=>b.handle(transfer(grant)),/failed|lease|decode/i);
 b.handle(release(grant,'failed'));assert.equal(b.status().assetStagingBytes,0);
 const other=setup(),held=other.handle(reserve());other.handle(authorize(held));other.authorizeDecode(decode(held));other.markUnreclaimed(identity(1));
 assert.throws(()=>other.finishDecode(identity(1),held.grantId,'decode','decoded'),/unreclaimed/i);
 assert.throws(()=>other.handle(release(held,'failed')),/unreclaimed/i);assert.equal(other.status().assetStagingBytes,500);
});

test('successful verify releases staging without a lease and rejects charge changes in authorization',()=>{
 const b=setup(),grant=b.handle(reserve());
 assert.throws(()=>b.handle({...authorize(grant,'verify'),charge:{encodedBytes:100,rgbaBytes:401,totalBytes:501}}),/charge/i);
 b.handle(authorize(grant,'verify'));b.authorizeDecode(decode(grant,'verify'));b.finishDecode(identity(1),grant.grantId,'decode','decoded');
 assert.throws(()=>b.handle(transfer(grant)),/lease|mode/i);
 b.handle(release(grant));assert.equal(b.status().assetStagingBytes,0);assert.equal(b.status().assetLeaseBytes,0);
 assert.throws(()=>b.authorizeDecode(decode(grant,'verify')),/staging|grant/i);
});

test('real lease factory and pristine decoder share admitted backing through the host broker',async()=>{
 const derived=await deriveAssets({'assets/red.bmp':{mediaType:'image/bmp',encoding:'base64',data:'Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA=='}},bytes=>createHash('sha256').update(bytes).digest('hex'));
 const capsule=Object.freeze({capsuleHash:identity(1).capsuleHash,visuals:[{id:'red',assetSetHash:derived.assetSetHash,assets:derived.assets}]});
 const b=createStoryResourceBroker();b.reserveGeneration(identity(1),640,360,capsule.visuals);
 const prepared=await prepareStoryAssetLeaseFactory({identity:identity(1),capsule,broker:async request=>b.handle(request),decoder:async request=>{
  const trusted=b.authorizeDecode(request);
  try{const result=await decodeStoryAssets(trusted);b.finishDecode(trusted.identity,trusted.stagingGrantId,trusted.requestId,'decoded');return result;}
  catch(error){b.finishDecode(trusted.identity,trusted.stagingGrantId,trusted.requestId,'failed');throw error;}
 }});
 assert.equal(b.status().assetStagingBytes,0);assert.equal(b.status().assetLeaseBytes,0);
 const first=await prepared.acquire('red','slot-a'),second=await prepared.acquire('red','slot-b');
 assert.deepEqual([...first.images.get('assets/red.bmp').data],[255,0,0,255]);assert.equal(b.status().assetLeaseBytes,62);
 await first.release();assert.equal(b.status().assetLeaseBytes,62);await second.release();assert.equal(b.status().assetLeaseBytes,0);
 await prepared.dispose();assert.equal(b.status().assetStagingBytes,0);
});
