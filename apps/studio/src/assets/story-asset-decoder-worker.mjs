import {assetLimits,decodeCanonicalBase64,decodeBmp,validateAssetPath} from '../../../../packages/assets/src/index.mjs';
import {decodePng} from '../../../../packages/assets/src/png.mjs';
import {decodeJpeg} from '../../../../packages/assets/src/jpeg.mjs';

export const storyAssetDecoderVersion='lux-story-assets-v1';
const digest=crypto.subtle.digest.bind(crypto.subtle),encoder=new TextEncoder();
const getPrototype=Object.getPrototypeOf,ownKeys=Reflect.ownKeys,getDescriptor=Object.getOwnPropertyDescriptor,hasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty);
const objectPrototype=Object.prototype,arrayIsArray=Array.isArray,RuntimeError=Error,freeze=Object.freeze;
function fail(message,code='ASSET_BOUNDARY_VIOLATION'){throw Object.assign(new RuntimeError(message),{code});}
function record(value,fields,label){
 if(!value||typeof value!=='object'||arrayIsArray(value)||(getPrototype(value)!==objectPrototype&&getPrototype(value)!==null))fail(`Invalid ${label}`);
 const keys=ownKeys(value);if(keys.length!==fields.length)fail(`Invalid ${label}`);const result=Object.create(null);
 for(let index=0;index<fields.length;index++){const key=fields[index],field=getDescriptor(value,key);if(!field?.enumerable||!hasOwn(field,'value'))fail(`Invalid ${label}`);result[key]=field.value;}
 for(let index=0;index<keys.length;index++)if(typeof keys[index]!=='string'||!fields.includes(keys[index]))fail(`Invalid ${label}`);
 return result;
}
async function sha256(bytes){const value=new Uint8Array(await digest('SHA-256',bytes));return Array.from(value,byte=>byte.toString(16).padStart(2,'0')).join('');}
function mediaFor(path){return path.endsWith('.bmp')?'image/bmp':path.endsWith('.png')?'image/png':'image/jpeg';}
function charge(encodedBytes,rgbaBytes){const totalBytes=encodedBytes+rgbaBytes;if(!Number.isSafeInteger(totalBytes)||totalBytes>assetLimits.totalBytes+assetLimits.rgbaBytes)fail('Asset staging charge exceeds 3 MiB','QUOTA_EXCEEDED');return freeze({encodedBytes,rgbaBytes,totalBytes});}
function identity(value){
 const row=record(value,['instanceId','generation','scheduleHash','capsuleHash'],'Story asset generation identity');
 if(typeof row.instanceId!=='string'||!row.instanceId||!Number.isSafeInteger(row.generation)||row.generation<1||typeof row.scheduleHash!=='string'||!/^[a-f0-9]{64}$/.test(row.scheduleHash)||typeof row.capsuleHash!=='string'||!/^[a-f0-9]{64}$/.test(row.capsuleHash))fail('Invalid Story asset generation identity');
 return freeze({...row});
}

export async function decodeStoryAssets(input){
 const request=record(input,['kind','mode','requestId','identity','stagingGrantId','decoderVersion','visualId','assetSetHash','assets'],'Story asset decode request');
 if(request.kind!=='story-assets-decode'||!['verify','lease'].includes(request.mode)||typeof request.requestId!=='string'||!request.requestId||typeof request.stagingGrantId!=='string'||!request.stagingGrantId||request.decoderVersion!==storyAssetDecoderVersion||typeof request.visualId!=='string'||!request.visualId||typeof request.assetSetHash!=='string'||!/^[a-f0-9]{64}$/.test(request.assetSetHash))fail('Invalid Story asset decode request');
 const admittedIdentity=identity(request.identity),assets=record(request.assets,ownKeys(request.assets),'derived asset set'),paths=ownKeys(assets);
 if(paths.length>assetLimits.count)fail('At most four image assets are supported','QUOTA_EXCEEDED');
 for(let index=0;index<paths.length;index++)if(typeof paths[index]!=='string')fail('Invalid derived asset path');
 paths.sort();const rows=[],identityRows=[];let encodedBytes=0,rgbaBytes=0;
 for(let index=0;index<paths.length;index++){
  const path=validateAssetPath(paths[index]),asset=record(assets[path],['mediaType','encoding','data','byteLength','sha256','width','height'],`derived asset ${path}`);
  if(asset.mediaType!==mediaFor(path)||asset.encoding!=='base64'||!Number.isSafeInteger(asset.byteLength)||asset.byteLength<1||typeof asset.sha256!=='string'||!/^[a-f0-9]{64}$/.test(asset.sha256)||!Number.isSafeInteger(asset.width)||!Number.isSafeInteger(asset.height))fail(`Invalid derived asset metadata: ${path}`);
  const encoded=decodeCanonicalBase64(asset.data);if(encoded.byteLength!==asset.byteLength||await sha256(encoded)!==asset.sha256)fail(`Derived asset identity mismatch: ${path}`);
  if(encodedBytes>assetLimits.totalBytes-encoded.byteLength)fail('Aggregate asset byte budget exceeded','QUOTA_EXCEEDED');encodedBytes+=encoded.byteLength;
  const image=asset.mediaType==='image/bmp'?decodeBmp(encoded):(asset.mediaType==='image/png'?decodePng:decodeJpeg)(encoded,{maxRgbaBytes:assetLimits.rgbaBytes-rgbaBytes});
  if(image.width!==asset.width||image.height!==asset.height||!(image.data instanceof Uint8Array)||image.data.byteLength!==image.width*image.height*4)fail(`Derived asset decode mismatch: ${path}`);
  if(rgbaBytes>assetLimits.rgbaBytes-image.data.byteLength)fail('Aggregate decoded image budget exceeded','QUOTA_EXCEEDED');rgbaBytes+=image.data.byteLength;
  identityRows.push({path,mediaType:asset.mediaType,byteLength:asset.byteLength,sha256:asset.sha256,width:asset.width,height:asset.height});
  if(request.mode==='lease')rows.push(freeze({path,mediaType:asset.mediaType,encoded,width:image.width,height:image.height,pixels:image.data}));
 }
 if(await sha256(encoder.encode(JSON.stringify(identityRows)))!==request.assetSetHash)fail('Asset set SHA-256 mismatch');
 return freeze({kind:'story-assets-decoded',mode:request.mode,requestId:request.requestId,identity:admittedIdentity,stagingGrantId:request.stagingGrantId,
  decoderVersion:storyAssetDecoderVersion,visualId:request.visualId,assetSetHash:request.assetSetHash,charge:charge(encodedBytes,rgbaBytes),rows:freeze(rows)});
}

const scope=globalThis;
if(typeof scope.addEventListener==='function'&&typeof scope.postMessage==='function'&&typeof document==='undefined')scope.addEventListener('message',event=>{
 const input=event.data;
 decodeStoryAssets(input).then(result=>{
  const transfers=[];for(let index=0;index<result.rows.length;index++){transfers.push(result.rows[index].encoded.buffer,result.rows[index].pixels.buffer);}
  scope.postMessage(result,transfers);
 },error=>{
  let requestId='',stagingGrantId='',visualId='',assetSetHash='',admittedIdentity;
  try{requestId=String(input?.requestId??'').slice(0,128);stagingGrantId=String(input?.stagingGrantId??'').slice(0,128);visualId=String(input?.visualId??'').slice(0,128);assetSetHash=String(input?.assetSetHash??'').slice(0,64);admittedIdentity=identity(input?.identity);}catch{}
  if(admittedIdentity)scope.postMessage({kind:'story-assets-decode-error',requestId,identity:admittedIdentity,stagingGrantId,visualId,assetSetHash,code:typeof error?.code==='string'?error.code:'ASSET_BOUNDARY_VIOLATION',message:String(error?.message??error).slice(0,500)});
 });
});
