import {storyAssetDecoderVersion,storyAssetLeaseKey} from '../assets/story-asset-leases.mjs';

/** Client-side accounting of Lux-owned backing. Forced termination never releases a grant.
 * reserveGeneration accepts visuals only from the host's verified capsule, whose hash
 * must match identity.capsuleHash. Worker-supplied metadata is never admission input.
 */
export function createStoryResourceBroker(){
 const generations=new Map(),receipts=new Map(),usedIdentities=new Set();let staging=null,capture=null,next=0;
 const fail=message=>{throw Object.assign(Error(message),{code:'STORY_RESOURCE_REJECTED'});};
 const key=id=>JSON.stringify([id?.instanceId,id?.generation,id?.scheduleHash,id?.capsuleHash]);
 const integer=(value,label)=>{if(!Number.isSafeInteger(value)||value<0)fail(`Invalid ${label}`);return value;};
 const total=field=>[...generations.values()].reduce((sum,g)=>sum+g[field],0);
 const get=id=>{const g=generations.get(key(id));if(!g)fail('Unknown generation identity');return g;};
 const fresh=()=>`story-grant-${++next}`;
 const requestId=value=>{if(typeof value!=='string'||!value||value.length>128)fail('Invalid request ID');};
 const exactRecord=(value,fields,label)=>{if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail(`Invalid ${label}`);const keys=Reflect.ownKeys(value);if(keys.length!==fields.length||keys.some(key=>!fields.includes(key))||fields.some(key=>!Object.getOwnPropertyDescriptor(value,key)?.enumerable||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value')))fail(`Invalid ${label}`);};
 const assetFields=['mediaType','encoding','data','byteLength','sha256','width','height'];
 const sameCharge=(actual,expected)=>actual&&['encodedBytes','rgbaBytes','totalBytes'].every(field=>actual[field]===expected[field]);
 const activeStaging=(identity,grantId)=>{const g=get(identity);if(g.unreclaimed)fail('Generation is unreclaimed');if(!staging||staging.grantId!==grantId||key(staging.identity)!==key(identity))fail('Invalid staging grant');return staging;};
 const status=()=>Object.freeze({generations:[...generations.values()].map(g=>({identity:g.identity,unreclaimed:g.unreclaimed,storyTargetBytes:g.storyTargetBytes,assetLeaseBytes:g.assetLeaseBytes})),storyTargetBytes:total('storyTargetBytes'),assetLeaseBytes:total('assetLeaseBytes'),assetStagingBytes:staging?.charge.totalBytes??0,readbackBytes:capture?.readbackBytes??0});
 function reserveGeneration(identity,width,height,visuals){
  if(typeof identity?.instanceId!=='string'||!identity.instanceId||!Number.isSafeInteger(identity.generation)||identity.generation<1||!(/^[a-f0-9]{64}$/).test(identity.scheduleHash)||!(/^[a-f0-9]{64}$/).test(identity.capsuleHash))fail('Invalid generation identity');
  if(usedIdentities.has(key(identity)))fail('Generation identity already used');
  if(generations.size>=2)fail('Story generation capacity exhausted; client recovery required');
  integer(width,'width');integer(height,'height');if(width<1||height<1||width>3840||height>2160)fail('Invalid Story output dimensions');
  const storyTargetBytes=integer(24*width*height,'target bytes');
  if(storyTargetBytes>201326592||total('storyTargetBytes')+storyTargetBytes>402653184)fail('Story target capacity exceeded');
  const rows=new Map();for(const row of visuals){
   if(rows.has(row.id))fail('Duplicate visual identity');storyAssetLeaseKey(row.assetSetHash);
   let encodedBytes=0,rgbaBytes=0;const assets=Object.create(null);
   for(const [path,asset] of Object.entries(row.assets)){
    exactRecord(asset,assetFields,'admitted asset');
    encodedBytes+=integer(asset.byteLength,'asset bytes');rgbaBytes+=integer(asset.width*asset.height*4,'RGBA bytes');
    assets[path]=Object.freeze(Object.fromEntries(assetFields.map(field=>[field,asset[field]])));
   }
   if(encodedBytes>1048576||rgbaBytes>2097152)fail('Asset charge exceeds source bounds');
   rows.set(row.id,{assetSetHash:row.assetSetHash,assets:Object.freeze(assets),charge:Object.freeze({encodedBytes,rgbaBytes,totalBytes:encodedBytes+rgbaBytes})});
  }
  const fixed=Object.freeze({...identity});usedIdentities.add(key(identity));generations.set(key(identity),{identity:fixed,width,height,storyTargetBytes,assetLeaseBytes:0,visuals:rows,leases:new Map(),unreclaimed:false});
  return Object.freeze({identity:fixed,width,height,maxSlots:2,maxPendingCreates:1,storyTargetBytes,assetLeaseBytes:6291456});
 }
 function handle(request){
  const g=get(request.identity);if(g.unreclaimed)fail('Generation is unreclaimed');
  requestId(request.requestId);
  const receiptKey=`${key(request.identity)}:${request.requestId}`,payload=JSON.stringify(request),prior=receipts.get(receiptKey);
  if(prior){if(prior.payload!==payload)fail('Resource request ID reused with different payload');return prior.response;}
  if(receipts.size>=65536)fail('Resource receipt capacity exhausted');
  const base={requestId:request.requestId,identity:g.identity};let response;
  if(request.kind==='story-asset-staging-reserve'){
   const row=g.visuals.get(request.visualId);if(!row||row.assetSetHash!==request.assetSetHash)fail('Unknown visual asset identity');
   if(!request.charge||['encodedBytes','rgbaBytes','totalBytes'].some(field=>request.charge[field]!==row.charge[field]))fail('Asset charge mismatch');
   if(staging)fail('Client asset staging is busy');
   if(request.decoderVersion!==storyAssetDecoderVersion)fail('Invalid decoder version');
   staging={...base,grantId:fresh(),visualId:request.visualId,assetSetHash:request.assetSetHash,decoderVersion:request.decoderVersion,charge:Object.freeze({...row.charge})};
   response={...staging,kind:'story-asset-staging-granted'};
  }else if(request.kind==='story-asset-decode-authorize'){
   const stage=activeStaging(request.identity,request.grantId);
   if(stage.decode)fail('Staging decode is already authorized');
   requestId(request.decodeRequestId);
   if(!['verify','lease'].includes(request.mode)||request.visualId!==stage.visualId||request.assetSetHash!==stage.assetSetHash||request.decoderVersion!==storyAssetDecoderVersion)fail('Invalid decode authorization identity or mode');
   if(!sameCharge(request.charge,stage.charge))fail('Decode authorization charge mismatch');
   stage.decode={mode:request.mode,requestId:request.decodeRequestId,phase:'authorized'};
   response={...base,kind:'story-asset-decode-authorized',grantId:stage.grantId,mode:request.mode,decodeRequestId:request.decodeRequestId,visualId:stage.visualId,assetSetHash:stage.assetSetHash,decoderVersion:storyAssetDecoderVersion,charge:stage.charge};
  }else if(request.kind==='story-asset-staging-release'||request.kind==='story-asset-staging-transfer'){
   if(!staging||staging.grantId!==request.grantId||key(staging.identity)!==key(request.identity))fail('Invalid staging grant');
   if(staging.decode?.phase==='pending')fail('Decode pending; staging must remain charged until trusted settlement');
   if(request.kind==='story-asset-staging-release'){
    if(!['verified','failed','cancelled'].includes(request.disposition))fail('Invalid staging disposition');
    if(request.disposition==='verified'&&(staging.decode?.phase!=='decoded'||staging.decode.mode!=='verify'))fail('Verified disposition requires successful verify decode');
    if(staging.decode?.phase==='failed'&&request.disposition!=='failed')fail('Failed decode requires failed disposition');
    response={...base,kind:'story-asset-staging-released',grantId:request.grantId,disposition:request.disposition};staging=null;
   }else{
    if(staging.decode?.phase!=='decoded'||staging.decode.mode!=='lease')fail('Lease transfer requires settled successful lease decode');
    if(request.leaseKey!==storyAssetLeaseKey(staging.assetSetHash)||[...g.leases.values()].some(row=>row.leaseKey===request.leaseKey))fail('Invalid or duplicate lease key');
    const bytes=staging.charge.totalBytes;if(g.assetLeaseBytes+bytes>6291456||total('assetLeaseBytes')+bytes>12582912)fail('Asset lease capacity exceeded');
    const leaseGrantId=fresh();g.leases.set(leaseGrantId,{leaseKey:request.leaseKey,charge:staging.charge});g.assetLeaseBytes+=bytes;
    response={...base,kind:'story-asset-lease-granted',grantId:request.grantId,leaseGrantId,leaseKey:request.leaseKey,charge:staging.charge};staging=null;
   }
  }else if(request.kind==='story-asset-lease-release'){
   const lease=g.leases.get(request.leaseGrantId);if(!lease||lease.leaseKey!==request.leaseKey)fail('Invalid asset lease grant');
   g.assetLeaseBytes-=lease.charge.totalBytes;g.leases.delete(request.leaseGrantId);response={...base,kind:'story-asset-lease-released',leaseGrantId:request.leaseGrantId,leaseKey:request.leaseKey};
  }else fail('Unknown resource request');
  response=Object.freeze(response);receipts.set(receiptKey,{payload,response});return response;
 }
 function authorizeDecode(request){
  exactRecord(request,['kind','mode','requestId','identity','stagingGrantId','decoderVersion','visualId','assetSetHash','assets'],'decode request');
  exactRecord(request.identity,['instanceId','generation','scheduleHash','capsuleHash'],'decode generation identity');
  const stage=activeStaging(request.identity,request.stagingGrantId);
  if(!stage.decode||stage.decode.phase!=='authorized')fail('Missing or already dispatched decode authorization');
  if(request.kind!=='story-assets-decode'||request.mode!==stage.decode.mode||request.requestId!==stage.decode.requestId||request.decoderVersion!==storyAssetDecoderVersion||request.visualId!==stage.visualId||request.assetSetHash!==stage.assetSetHash)fail('Decode authorization identity mismatch');
  const row=get(request.identity).visuals.get(stage.visualId),paths=Object.keys(row.assets);
  exactRecord(request.assets,paths,'decode assets');
  for(const path of paths){exactRecord(request.assets[path],assetFields,'decode asset');if(assetFields.some(field=>request.assets[path][field]!==row.assets[path][field]))fail('Decode assets differ from admitted capsule');}
  // Construct from host-owned data. No worker-supplied asset object reaches the decoder.
  const trusted=Object.freeze({kind:'story-assets-decode',mode:stage.decode.mode,requestId:stage.decode.requestId,identity:stage.identity,stagingGrantId:stage.grantId,decoderVersion:storyAssetDecoderVersion,visualId:stage.visualId,assetSetHash:stage.assetSetHash,assets:row.assets});
  stage.decode.phase='pending';return trusted;
 }
 // Host-only: call after actual decoder settlement, never on a timeout/termination.
 function finishDecode(identity,stagingGrantId,decodeRequestId,outcome){
  const stage=activeStaging(identity,stagingGrantId);
  if(!stage.decode||stage.decode.phase!=='pending'||stage.decode.requestId!==decodeRequestId||!['decoded','failed'].includes(outcome))fail('Invalid trusted decode completion identity or outcome');
  stage.decode.phase=outcome;
 }
 function reserveCapture(identity,captureRequestId){const g=get(identity);if(g.unreclaimed)fail('Generation is unreclaimed');requestId(captureRequestId);if(capture)fail('Client capture is busy');const readbackBytes=(g.height-1)*Math.ceil(g.width*4/256)*256+g.width*4;if(readbackBytes>33554432)fail('Capture readback capacity exceeded');capture=Object.freeze({identity:g.identity,requestId:captureRequestId,grantId:fresh(),readbackBytes});return capture;}
 function releaseCapture(identity,grantId){if(get(identity).unreclaimed)fail('Unreclaimed generation retains capture grant');if(!capture||key(capture.identity)!==key(identity)||capture.grantId!==grantId)fail('Invalid capture grant');capture=null;}
 function releaseGeneration(identity,resources){const g=get(identity);if(!resources||['pendingCreates','slots','assetLeases','assetLeaseBytes','assetStagingJobs','assetStagingBytes','storyTargetBytes','pendingImports','ownedModuleURLs','pendingCallbacks','gpuSubmissions','readbackGrants','readbackBytes'].some(field=>resources[field]!==0)||!resources.slotStates||['preparing','ready','active','retiring','unsettled'].some(field=>resources.slotStates[field]!==0))fail('Incomplete settled cleanup receipt');if(g.unreclaimed)fail('Unreclaimed generation cannot claim settled cleanup');if(g.assetLeaseBytes||staging&&key(staging.identity)===key(identity))fail('Asset grants remain owned');if(capture&&key(capture.identity)===key(identity))fail('Capture grant remains owned');generations.delete(key(identity));for(const receiptKey of receipts.keys())if(receiptKey.startsWith(`${key(identity)}:`))receipts.delete(receiptKey);}
 return Object.freeze({reserveGeneration,handle,authorizeDecode,finishDecode,reserveCapture,releaseCapture,releaseGeneration,markUnreclaimed(identity){get(identity).unreclaimed=true;},status});
}
