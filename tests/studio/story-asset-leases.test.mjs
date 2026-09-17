import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deriveAssets} from '../../packages/assets/src/index.mjs';
import {decodeStoryAssets} from '../../apps/studio/src/assets/story-asset-decoder-worker.mjs';
import {prepareStoryAssetLeaseFactory,storyAssetDecoderVersion,storyAssetLeaseKey} from '../../apps/studio/src/assets/story-asset-leases.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const sourceAsset={mediaType:'image/bmp',encoding:'base64',data:'Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA=='};
const identity=Object.freeze({instanceId:'story-assets-test',generation:1,scheduleHash:'a'.repeat(64),capsuleHash:'b'.repeat(64)});
function deepFreeze(value){if(value&&typeof value==='object'){for(const key of Object.keys(value))deepFreeze(value[key]);Object.freeze(value);}return value;}
async function capsule(){const derived=await deriveAssets({'assets/red.bmp':sourceAsset},hash);return deepFreeze({kind:'lux-shared-visuals',version:1,capsuleHash:identity.capsuleHash,visuals:[{id:'visual',assetSetHash:derived.assetSetHash,assets:derived.assets}]});}

function ports(){
 let next=0,staging,lease;const events=[];
 const broker=async request=>{
  events.push(request.kind);
  const base={requestId:request.requestId,identity};
  if(request.kind==='story-asset-staging-reserve'){
   assert.equal(request.decoderVersion,storyAssetDecoderVersion);assert.equal(staging,undefined);
   staging={grantId:`stage-${++next}`,visualId:request.visualId,assetSetHash:request.assetSetHash,decoderVersion:request.decoderVersion,charge:request.charge};
   return {...base,...staging,kind:'story-asset-staging-granted'};
  }
  assert.equal(request.grantId??lease?.leaseGrantId,request.kind==='story-asset-lease-release'?lease?.leaseGrantId:staging?.grantId);
  if(request.kind==='story-asset-decode-authorize')return {...base,...request,kind:'story-asset-decode-authorized'};
  if(request.kind==='story-asset-staging-release'){const result={...base,kind:'story-asset-staging-released',grantId:request.grantId,disposition:request.disposition};staging=undefined;return result;}
  if(request.kind==='story-asset-staging-transfer'){
   assert.equal(request.leaseKey,storyAssetLeaseKey(staging.assetSetHash));lease={leaseGrantId:`lease-${++next}`,leaseKey:request.leaseKey,charge:staging.charge};
   const result={...base,kind:'story-asset-lease-granted',grantId:request.grantId,...lease};staging=undefined;return result;
  }
  if(request.kind==='story-asset-lease-release'){const result={...base,kind:'story-asset-lease-released',leaseGrantId:request.leaseGrantId,leaseKey:request.leaseKey};lease=undefined;return result;}
  throw Error('unexpected broker request');
 };
 return {events,broker,decoder:decodeStoryAssets};
}

test('Story asset leases verify through staging, share charged backing, copy reads, and release exactly once',async()=>{
 const port=ports(),prepared=await prepareStoryAssetLeaseFactory({identity,capsule:await capsule(),broker:port.broker,decoder:port.decoder,requestId:(()=>{let id=0;return()=>`request-${++id}`;})()});
 assert.deepEqual(port.events,['story-asset-staging-reserve','story-asset-decode-authorize','story-asset-staging-release']);
 const first=await prepared.acquire('visual','slot-a'),second=await prepared.acquire('visual','slot-b');
 assert.deepEqual(port.events.slice(3),['story-asset-staging-reserve','story-asset-decode-authorize','story-asset-staging-transfer']);
 assert.deepEqual(prepared.status(),{closed:false,leaseCount:2,backingEntries:1,assetLeaseBytes:62,pendingStagingJobs:0,assetStagingBytes:0});
 const bytes=first.assets.get('assets/red.bmp'),pixels=first.images.get('assets/red.bmp');bytes.fill(0);pixels.data.fill(0);
 assert.equal(second.assets.get('assets/red.bmp')[0],0x42);assert.deepEqual([...second.images.get('assets/red.bmp').data],[255,0,0,255]);
 assert.equal(await first.release(),true);assert.equal(await first.release(),false);assert.throws(()=>first.assets.get('assets/red.bmp'),/released/i);
 assert.equal(prepared.status().assetLeaseBytes,62);await second.release();assert.equal(prepared.status().assetLeaseBytes,0);
 assert.deepEqual(port.events.slice(-1),['story-asset-lease-release']);await prepared.dispose();
});

test('decode failure releases staging without creating a live grant',async()=>{
 const port=ports(),value=await capsule();
 await assert.rejects(prepareStoryAssetLeaseFactory({identity,capsule:value,broker:port.broker,decoder:async request=>({...await decodeStoryAssets(request),assetSetHash:'0'.repeat(64)}),requestId:(()=>{let id=0;return()=>`bad-${++id}`;})()}),/decode result/i);
 assert.deepEqual(port.events.slice(-1),['story-asset-staging-release']);
});
