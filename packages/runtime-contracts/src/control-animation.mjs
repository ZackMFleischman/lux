import {normalizeAudioBandSource,normalizeAudioKickSource} from './audio-input.mjs';
const freeze=Object.freeze,arrayIsArray=Array.isArray,ownKeys=Reflect.ownKeys,descriptor=Object.getOwnPropertyDescriptor,prototype=Object.getPrototypeOf;
const objectPrototype=Object.prototype,arrayPrototype=Array.prototype,finite=Number.isFinite,stringify=JSON.stringify;
const RuntimeSet=Set,RuntimeError=Error,runtimeString=String,call=Function.prototype.call;
const hasOwn=call.bind(Object.prototype.hasOwnProperty),setHas=call.bind(Set.prototype.has),setAdd=call.bind(Set.prototype.add),regexTest=call.bind(RegExp.prototype.test),arrayPush=call.bind(Array.prototype.push);
const encoder=new TextEncoder(),encode=call.bind(TextEncoder.prototype.encode);
const shapes=new RuntimeSet(['sine','triangle','saw','square']),envelopes=new RuntimeSet(['linear','exponential']),hash=/^[a-f0-9]{64}$/;
function field(record,name){const value=descriptor(record,name);if(!value?.enumerable||!hasOwn(value,'value'))throw new RuntimeError('Invalid control animation fields');return value.value;}
function record(value,fields){if(!value||typeof value!=='object'||arrayIsArray(value)||(prototype(value)!==objectPrototype&&prototype(value)!==null)||ownKeys(value).length!==fields.length)throw new RuntimeError('Invalid control animation binding');for(let index=0;index<fields.length;index++)field(value,fields[index]);return value;}
function path(value){if(!arrayIsArray(value)||prototype(value)!==arrayPrototype||value.length>8||ownKeys(value).length!==value.length+1)throw new RuntimeError('Invalid animation node path');const result=[];for(let index=0;index<value.length;index++){const id=descriptor(value,runtimeString(index));if(!id?.enumerable||!hasOwn(id,'value')||typeof id.value!=='string')throw new RuntimeError('Invalid animation node path');arrayPush(result,id.value);}return freeze(result);}

export function validateControlAnimationBindings(input){
 if(input===undefined)return freeze([]);
 if(!arrayIsArray(input)||prototype(input)!==arrayPrototype||ownKeys(input).length!==input.length+1)throw new RuntimeError('Control animations must be a dense plain array');
 const seen=new RuntimeSet(),result=[];let bytes=2;
 for(let index=0;index<input.length;index++){
  const element=descriptor(input,runtimeString(index));if(!element?.enumerable||!hasOwn(element,'value'))throw new RuntimeError('Invalid control animation binding');
  const tagged=element.value&&typeof element.value==='object'&&hasOwn(element.value,'kind'),kind=tagged?field(element.value,'kind'):undefined,audio=kind==='audio',kick=kind==='kick';
  const raw=record(element.value,audio?['kind','nodePath','definitionHash','schemaHash','controlId','source','amount','attackMs','releaseMs','enabled']:kick?['kind','nodePath','definitionHash','schemaHash','controlId','source','amount','attackMs','releaseMs','sensitivity','retriggerMs','envelope','enabled']:['nodePath','definitionHash','schemaHash','controlId','shape','periodSeconds','amount','phase','enabled']);
  const nodePath=path(field(raw,'nodePath')),definitionHash=field(raw,'definitionHash'),schemaHash=field(raw,'schemaHash'),controlId=field(raw,'controlId'),amount=field(raw,'amount'),enabled=field(raw,'enabled');
  if(typeof definitionHash!=='string'||!regexTest(hash,definitionHash)||typeof schemaHash!=='string'||!regexTest(hash,schemaHash)||typeof controlId!=='string'||!controlId||controlId.length>64||typeof enabled!=='boolean'||!finite(amount)||amount<0)throw new RuntimeError('Invalid control animation binding');
  let binding;
  if(audio){
   if(field(raw,'kind')!=='audio')throw new RuntimeError('Invalid control animation binding');const source=normalizeAudioBandSource(field(raw,'source')),attackMs=field(raw,'attackMs'),releaseMs=field(raw,'releaseMs');
   if(!Number.isSafeInteger(attackMs)||attackMs<0||attackMs>60000||!Number.isSafeInteger(releaseMs)||releaseMs<0||releaseMs>60000)throw new RuntimeError('Control animation is outside its supported range');
   binding=freeze({kind:'audio',nodePath,definitionHash,schemaHash,controlId,source,amount,attackMs,releaseMs,enabled});
  }else if(kick){
   const source=normalizeAudioKickSource(field(raw,'source')),attackMs=field(raw,'attackMs'),releaseMs=field(raw,'releaseMs'),sensitivity=field(raw,'sensitivity'),retriggerMs=field(raw,'retriggerMs'),envelope=field(raw,'envelope');
   if(!Number.isSafeInteger(attackMs)||attackMs<0||attackMs>60000||!Number.isSafeInteger(releaseMs)||releaseMs<0||releaseMs>60000||!finite(sensitivity)||sensitivity<0||sensitivity>1||!Number.isSafeInteger(retriggerMs)||retriggerMs<0||retriggerMs>2000||!setHas(envelopes,envelope))throw new RuntimeError('Control animation is outside its supported range');
   binding=freeze({kind:'kick',nodePath,definitionHash,schemaHash,controlId,source,amount,attackMs,releaseMs,sensitivity,retriggerMs,envelope,enabled});
  }else{
   if(tagged)throw new RuntimeError('Invalid control animation binding');
   const shape=field(raw,'shape'),periodSeconds=field(raw,'periodSeconds'),phase=field(raw,'phase');if(!setHas(shapes,shape))throw new RuntimeError('Invalid control animation binding');
   if(!finite(periodSeconds)||periodSeconds<.05||periodSeconds>3600||!finite(phase)||phase<0||phase>1)throw new RuntimeError('Control animation is outside its supported range');
   binding=freeze({nodePath,definitionHash,schemaHash,controlId,shape,periodSeconds,amount,phase,enabled});
  }
  const identity=`${stringify(nodePath)}:${controlId}`;if(setHas(seen,identity))throw new RuntimeError('Duplicate control animation binding');setAdd(seen,identity);
  bytes+=encode(encoder,stringify(binding)).byteLength+(index?1:0);if(bytes>1048576)throw new RuntimeError('Control animation metadata exceeds 1 MiB');
  arrayPush(result,binding);
 }
 return freeze(result);
}
