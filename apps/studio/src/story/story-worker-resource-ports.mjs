const freeze=Object.freeze,RuntimeError=Error,RuntimeString=String,define=Object.defineProperty,call=Function.prototype.call,RuntimePromise=Promise,promiseReject=RuntimePromise.reject.bind(RuntimePromise);
const MapCtor=Map,mapGet=call.bind(Map.prototype.get),mapSet=call.bind(Map.prototype.set),mapDelete=call.bind(Map.prototype.delete),mapClear=call.bind(Map.prototype.clear),mapValues=call.bind(Map.prototype.values),mapSize=call.bind(Object.getOwnPropertyDescriptor(Map.prototype,'size').get),arrayFrom=Array.from.bind(Array);
export function createStoryWorkerResourcePorts(identity,post){
 const pending=new MapCtor();let closed=false;
 const protocolIdentity=freeze({...identity,revisionId:identity.scheduleHash});
 const sameIdentity=message=>message?.instanceId===identity.instanceId&&message?.generation===identity.generation&&message?.revisionId===identity.scheduleHash&&message?.scheduleHash===identity.scheduleHash&&message?.capsuleHash===identity.capsuleHash;
 function transact(request){
  if(closed)return promiseReject(new RuntimeError('Story resource ports are closed'));
  if(!request||request.identity?.instanceId!==identity.instanceId||request.identity?.generation!==identity.generation||request.identity?.scheduleHash!==identity.scheduleHash||request.identity?.capsuleHash!==identity.capsuleHash||typeof request.requestId!=='string'||mapGet(pending,request.requestId))return promiseReject(new RuntimeError('Invalid Story resource request'));
  return new RuntimePromise((resolve,reject)=>{mapSet(pending,request.requestId,{resolve,reject});post({type:'story-resource-request',...protocolIdentity,requestId:request.requestId,request});});
 }
 function accept(message){
  if(closed||message?.type!=='story-resource-response'||!sameIdentity(message)||typeof message.requestId!=='string')return false;
  const wait=mapGet(pending,message.requestId);if(!wait)return false;mapDelete(pending,message.requestId);
  if(message.error){const error=new RuntimeError(RuntimeString(message.error.message??'Story resource request failed'));define(error,'code',{value:typeof message.error.code==='string'?message.error.code:'STORY_RESOURCE_FAILED',enumerable:true});wait.reject(error);}
  else wait.resolve(message.response);return true;
 }
 function close(){if(closed)return;closed=true;const waits=arrayFrom(mapValues(pending));mapClear(pending);for(let index=0;index<waits.length;index++)waits[index].reject(new RuntimeError('Story resource ports are closed'));}
 return freeze({broker:transact,decoder:transact,accept,close,status:()=>freeze({closed,pending:mapSize(pending)})});
}
