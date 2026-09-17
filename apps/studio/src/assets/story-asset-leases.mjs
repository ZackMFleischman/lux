import {storyLifecycleLimits} from '../../../../packages/runtime-contracts/src/story.mjs';

export const storyAssetDecoderVersion='lux-story-assets-v1';
const call=Function.prototype.call,freeze=Object.freeze,create=Object.create,RuntimeError=Error,RuntimeTypeError=TypeError,RuntimeMap=Map,RuntimeSet=Set,Bytes=Uint8Array;
const mapGet=call.bind(Map.prototype.get),mapSet=call.bind(Map.prototype.set),mapDelete=call.bind(Map.prototype.delete),mapHas=call.bind(Map.prototype.has);
const setAdd=call.bind(Set.prototype.add),setDelete=call.bind(Set.prototype.delete),setHas=call.bind(Set.prototype.has);
const ownKeys=Reflect.ownKeys,getDescriptor=Object.getOwnPropertyDescriptor,getPrototype=Object.getPrototypeOf,objectPrototype=Object.prototype;
const hasOwn=call.bind(Object.prototype.hasOwnProperty),stringify=JSON.stringify,iteratorSymbol=Symbol.iterator,isArray=Array.isArray,apply=Reflect.apply,isView=ArrayBuffer.isView,bytesPrototype=Uint8Array.prototype;
const defaultRequestId=crypto.randomUUID.bind(crypto);
function bad(message){throw new RuntimeError(message);}
export function storyAssetLeaseKey(assetSetHash){if(typeof assetSetHash!=='string'||!/^[a-f0-9]{64}$/.test(assetSetHash))bad('Invalid Story asset set identity');return `${storyAssetDecoderVersion}:${assetSetHash}`;}
function field(value,key){const descriptor=getDescriptor(value,key);if(!descriptor?.enumerable||!hasOwn(descriptor,'value'))bad('Invalid Story asset boundary message');return descriptor.value;}
function record(value){if(!value||typeof value!=='object'||getPrototype(value)!==objectPrototype)bad('Invalid Story asset boundary message');return value;}
function sameIdentity(actual,expected){try{return stringify(actual)===stringify(expected);}catch{return false;}}
function sameCharge(actual,expected){return !!actual&&field(actual,'encodedBytes')===expected.encodedBytes&&field(actual,'rgbaBytes')===expected.rgbaBytes&&field(actual,'totalBytes')===expected.totalBytes;}
function checkedCharge(assets){
 let encodedBytes=0,rgbaBytes=0;const paths=ownKeys(assets);
 for(let index=0;index<paths.length;index++){
  const row=record(field(assets,paths[index])),bytes=field(row,'byteLength'),width=field(row,'width'),height=field(row,'height');
  if(!Number.isSafeInteger(bytes)||bytes<1||!Number.isSafeInteger(width)||width<1||!Number.isSafeInteger(height)||height<1)bad('Invalid Story asset charge');
  const pixels=width*height*4;if(!Number.isSafeInteger(pixels)||encodedBytes>1048576-bytes||rgbaBytes>2097152-pixels)bad('Story asset charge exceeds per-source bounds');
  encodedBytes+=bytes;rgbaBytes+=pixels;
 }
 const totalBytes=encodedBytes+rgbaBytes;if(totalBytes>storyLifecycleLimits.assetStagingPerClient)bad('Story asset staging charge exceeds 3 MiB');
 return freeze({encodedBytes,rgbaBytes,totalBytes});
}
function copy(bytes){const result=new Bytes(bytes.byteLength);for(let index=0;index<bytes.byteLength;index++)result[index]=bytes[index];return result;}
function facade(entry,lease,images){
 const lookup=key=>{for(let index=0;index<entry.rows.length;index++)if(entry.rows[index].path===key)return index;return -1;};
 const active=()=>{if(!lease.active)bad('Story asset lease is released');};
 const value=index=>{active();const row=entry.rows[index];if(!row)return undefined;return images?freeze({width:row.width,height:row.height,colorSpace:'srgb',alphaMode:'straight',data:copy(row.pixels)}):copy(row.encoded);};
 const iterator=kind=>{let index=0;const result=create(null);result.next=()=>{active();if(index===entry.rows.length)return{value:undefined,done:true};const at=index++,key=entry.rows[at].path;return{value:kind===0?key:kind===1?value(at):[key,value(at)],done:false};};result[iteratorSymbol]=()=>result;return freeze(result);};
 const result=create(null);result.size=entry.rows.length;result.has=key=>{active();return lookup(key)!==-1;};result.get=key=>{active();const index=lookup(key);return index<0?undefined:value(index);};
 result.keys=()=>iterator(0);result.values=()=>iterator(1);result.entries=()=>iterator(2);result[iteratorSymbol]=result.entries;
 result.forEach=(callback,thisArg)=>{active();if(typeof callback!=='function')throw new RuntimeTypeError('Asset forEach callback must be a function');for(let index=0;index<entry.rows.length;index++)apply(callback,thisArg,[value(index),entry.rows[index].path,result]);};
 return freeze(result);
}

export async function prepareStoryAssetLeaseFactory(input){
 const identity=freeze({...record(input.identity)}),identityJson=stringify(identity),capsule=input.capsule,broker=input.broker,decoder=input.decoder,requestId=input.requestId??defaultRequestId;
 if(typeof identity.instanceId!=='string'||!identity.instanceId||!Number.isSafeInteger(identity.generation)||identity.generation<1||typeof identity.scheduleHash!=='string'||!/^[a-f0-9]{64}$/.test(identity.scheduleHash)||typeof identity.capsuleHash!=='string'||!/^[a-f0-9]{64}$/.test(identity.capsuleHash)||identity.capsuleHash!==capsule?.capsuleHash||typeof broker!=='function'||typeof decoder!=='function'||typeof requestId!=='function'||!Object.isFrozen(capsule))bad('Invalid Story asset factory input');
 const visuals=new RuntimeMap(),pools=new RuntimeMap(),leases=new RuntimeMap(),slotKeys=new RuntimeSet(),pending=[],poolList=[],leaseList=[];
 let closed=false,pendingStagingJobs=0,assetStagingBytes=0;
 for(let index=0;index<capsule.visuals.length;index++){const visual=capsule.visuals[index];mapSet(visuals,visual.id,freeze({visualId:visual.id,assetSetHash:visual.assetSetHash,assets:visual.assets,charge:checkedCharge(visual.assets)}));}
 function id(){const value=requestId();if(typeof value!=='string'||!value||value.length>128)bad('Invalid Story asset request ID');return value;}
 function checkIdentity(value){if(!sameIdentity(value,identity)||stringify(value)!==identityJson)bad('Story asset broker identity mismatch');}
 async function reserve(row){
  const request=freeze({kind:'story-asset-staging-reserve',requestId:id(),identity,visualId:row.visualId,assetSetHash:row.assetSetHash,decoderVersion:storyAssetDecoderVersion,charge:row.charge});
  const response=record(await broker(request));
  if(field(response,'kind')!=='story-asset-staging-granted'||field(response,'requestId')!==request.requestId||field(response,'visualId')!==row.visualId||field(response,'assetSetHash')!==row.assetSetHash||field(response,'decoderVersion')!==storyAssetDecoderVersion||typeof field(response,'grantId')!=='string'||!field(response,'grantId')||!sameCharge(field(response,'charge'),row.charge))bad('Invalid Story asset staging grant');
  checkIdentity(field(response,'identity'));pendingStagingJobs++;assetStagingBytes+=row.charge.totalBytes;
  return freeze({grantId:field(response,'grantId'),row});
 }
 async function releaseStaging(stage,disposition){
  const request=freeze({kind:'story-asset-staging-release',requestId:id(),identity,grantId:stage.grantId,disposition}),response=record(await broker(request));
  if(field(response,'kind')!=='story-asset-staging-released'||field(response,'requestId')!==request.requestId||field(response,'grantId')!==stage.grantId||field(response,'disposition')!==disposition)bad('Invalid Story asset staging release');
  checkIdentity(field(response,'identity'));pendingStagingJobs--;assetStagingBytes-=stage.row.charge.totalBytes;
 }
 async function decode(stage,mode){
  const row=stage.row,decodeRequestId=id(),authorization=freeze({kind:'story-asset-decode-authorize',requestId:id(),decodeRequestId,identity,grantId:stage.grantId,mode,visualId:row.visualId,assetSetHash:row.assetSetHash,decoderVersion:storyAssetDecoderVersion,charge:row.charge});
  const admitted=record(await broker(authorization));
  if(field(admitted,'kind')!=='story-asset-decode-authorized'||field(admitted,'requestId')!==authorization.requestId||field(admitted,'decodeRequestId')!==decodeRequestId||field(admitted,'grantId')!==stage.grantId||field(admitted,'mode')!==mode||field(admitted,'visualId')!==row.visualId||field(admitted,'assetSetHash')!==row.assetSetHash||field(admitted,'decoderVersion')!==storyAssetDecoderVersion||!sameCharge(field(admitted,'charge'),row.charge))bad('Invalid Story asset decode authorization');
  checkIdentity(field(admitted,'identity'));
  const request=freeze({kind:'story-assets-decode',mode,requestId:decodeRequestId,identity,stagingGrantId:stage.grantId,decoderVersion:storyAssetDecoderVersion,visualId:row.visualId,assetSetHash:row.assetSetHash,assets:row.assets});
  const response=record(await decoder(request));
  if(field(response,'kind')==='story-assets-decode-error')bad(String(field(response,'message')).slice(0,500));
  if(field(response,'kind')!=='story-assets-decoded'||field(response,'mode')!==mode||field(response,'requestId')!==request.requestId||field(response,'stagingGrantId')!==stage.grantId||field(response,'decoderVersion')!==storyAssetDecoderVersion||field(response,'visualId')!==row.visualId||field(response,'assetSetHash')!==row.assetSetHash||!sameCharge(field(response,'charge'),row.charge)||!isArray(field(response,'rows')))bad('Invalid Story asset decode result');
  checkIdentity(field(response,'identity'));return response;
 }
 async function verifyRow(row){
  const stage=await reserve(row);let disposition='failed';
  try{const result=await decode(stage,'verify');if(result.rows.length!==0)bad('Verify-only asset decode returned backing');disposition='verified';}
  finally{await releaseStaging(stage,disposition);}
 }
 for(let index=0;index<capsule.visuals.length;index++)await verifyRow(mapGet(visuals,capsule.visuals[index].id));
 async function transfer(stage,leaseKey){
  const request=freeze({kind:'story-asset-staging-transfer',requestId:id(),identity,grantId:stage.grantId,leaseKey}),response=record(await broker(request));
  if(field(response,'kind')!=='story-asset-lease-granted'||field(response,'requestId')!==request.requestId||field(response,'grantId')!==stage.grantId||field(response,'leaseKey')!==leaseKey||typeof field(response,'leaseGrantId')!=='string'||!field(response,'leaseGrantId')||!sameCharge(field(response,'charge'),stage.row.charge))bad('Invalid Story asset lease grant');
  checkIdentity(field(response,'identity'));pendingStagingJobs--;assetStagingBytes-=stage.row.charge.totalBytes;
  return field(response,'leaseGrantId');
 }
 function decodedRows(result,row){
  const rows=[];if(result.rows.length!==ownKeys(row.assets).length)bad('Story asset decode row count mismatch');
  for(let index=0;index<result.rows.length;index++){
   const value=record(result.rows[index]),path=field(value,'path'),expected=getDescriptor(row.assets,path)?.value;
   const encoded=field(value,'encoded'),pixels=field(value,'pixels');
   if(!expected||field(value,'mediaType')!==expected.mediaType||field(value,'width')!==expected.width||field(value,'height')!==expected.height||!isView(encoded)||getPrototype(encoded)!==bytesPrototype||encoded.byteLength!==expected.byteLength||!isView(pixels)||getPrototype(pixels)!==bytesPrototype||pixels.byteLength!==expected.width*expected.height*4)bad('Invalid Story asset decoded backing');
   rows[rows.length]={path,mediaType:expected.mediaType,encoded,width:expected.width,height:expected.height,pixels};
  }
  return rows;
 }
 async function releaseBacking(entry){
  if(entry.refs!==0||entry.released)return;
  if(entry.releasing)return entry.releasing;
  entry.releasing=(async()=>{
   const request=freeze({kind:'story-asset-lease-release',requestId:id(),identity,leaseGrantId:entry.leaseGrantId,leaseKey:entry.leaseKey}),response=record(await broker(request));
   if(field(response,'kind')!=='story-asset-lease-released'||field(response,'requestId')!==request.requestId||field(response,'leaseGrantId')!==entry.leaseGrantId||field(response,'leaseKey')!==entry.leaseKey)bad('Invalid Story asset lease release');
   checkIdentity(field(response,'identity'));entry.released=true;entry.rows=[];mapDelete(pools,entry.leaseKey);
  })();
  try{await entry.releasing;}catch(error){entry.releasing=undefined;throw error;}
 }
 async function acquireInternal(visualId,slotKey){
  if(closed)bad('Story asset factory is disposed');if(typeof slotKey!=='string'||!slotKey||setHas(slotKeys,slotKey))bad('Invalid or duplicate Story asset slot key');
  const row=mapGet(visuals,visualId);if(!row)bad('Unknown Story visual assets');const leaseKey=storyAssetLeaseKey(row.assetSetHash);
  let entry=mapGet(pools,leaseKey);
  if(!entry){
   const stage=await reserve(row);let transferred=false;
   try{
    const result=await decode(stage,'lease'),rows=decodedRows(result,row),leaseGrantId=await transfer(stage,leaseKey);transferred=true;
    entry={leaseKey,leaseGrantId,charge:row.charge,rows,refs:0,released:false,releasing:undefined};mapSet(pools,leaseKey,entry);poolList[poolList.length]=entry;
   }finally{if(!transferred)await releaseStaging(stage,'failed');}
  }
  if(closed){if(entry.refs===0)await releaseBacking(entry);bad('Story asset factory closed during acquisition');}
  const leaseId=id(),lease={active:true,entry,slotKey,leaseId,visualId};entry.refs++;setAdd(slotKeys,slotKey);mapSet(leases,leaseId,lease);leaseList[leaseList.length]=lease;
  const result={leaseId,visualId,assetSetHash:row.assetSetHash,chargedBytes:entry.charge.totalBytes};
  result.assets=facade(entry,lease,false);result.images=facade(entry,lease,true);
  result.release=async()=>{if(!lease.active)return false;lease.active=false;mapDelete(leases,leaseId);setDelete(slotKeys,slotKey);entry.refs--;await releaseBacking(entry);return true;};
  return freeze(result);
 }
 function acquire(visualId,slotKey){const promise=acquireInternal(visualId,slotKey);pending[pending.length]=promise;return promise;}
 async function dispose(){
  closed=true;for(let index=0;index<pending.length;index++)try{await pending[index];}catch{}
  let failure;for(let index=0;index<leaseList.length;index++)try{const exposed=leaseList[index];if(exposed.active){exposed.active=false;mapDelete(leases,exposed.leaseId);setDelete(slotKeys,exposed.slotKey);exposed.entry.refs--;}}catch(error){failure??=error;}
  for(let index=0;index<poolList.length;index++)try{await releaseBacking(poolList[index]);}catch(error){failure??=error;}
  if(failure)throw failure;
 }
 function status(){let bytes=0,entries=0,leaseCount=0;for(let index=0;index<poolList.length;index++)if(!poolList[index].released){entries++;bytes+=poolList[index].charge.totalBytes;}for(let index=0;index<leaseList.length;index++)if(leaseList[index].active)leaseCount++;return freeze({closed,leaseCount,backingEntries:entries,assetLeaseBytes:bytes,pendingStagingJobs,assetStagingBytes});}
 return freeze({verifyAll:async()=>{},acquire,status,dispose});
}
