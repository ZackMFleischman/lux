const freeze=Object.freeze,arrayIsArray=Array.isArray,ownKeys=Reflect.ownKeys,descriptor=Object.getOwnPropertyDescriptor,prototype=Object.getPrototypeOf;
const objectPrototype=Object.prototype,arrayPrototype=Array.prototype,finite=Number.isFinite,stringify=JSON.stringify;
const RuntimeSet=Set,RuntimeError=Error,runtimeString=String,call=Function.prototype.call;
const hasOwn=call.bind(Object.prototype.hasOwnProperty),setHas=call.bind(Set.prototype.has),setAdd=call.bind(Set.prototype.add),regexTest=call.bind(RegExp.prototype.test),arrayPush=call.bind(Array.prototype.push);
const encoder=new TextEncoder(),encode=call.bind(TextEncoder.prototype.encode);
const shapes=new RuntimeSet(['sine','triangle','saw','square']),hash=/^[a-f0-9]{64}$/;
function field(record,name){const value=descriptor(record,name);if(!value?.enumerable||!hasOwn(value,'value'))throw new RuntimeError('Invalid control animation fields');return value.value;}
function record(value,fields){if(!value||typeof value!=='object'||arrayIsArray(value)||(prototype(value)!==objectPrototype&&prototype(value)!==null)||ownKeys(value).length!==fields.length)throw new RuntimeError('Invalid control animation binding');for(let index=0;index<fields.length;index++)field(value,fields[index]);return value;}
function path(value){if(!arrayIsArray(value)||prototype(value)!==arrayPrototype||value.length>8||ownKeys(value).length!==value.length+1)throw new RuntimeError('Invalid animation node path');const result=[];for(let index=0;index<value.length;index++){const id=descriptor(value,runtimeString(index));if(!id?.enumerable||!hasOwn(id,'value')||typeof id.value!=='string')throw new RuntimeError('Invalid animation node path');arrayPush(result,id.value);}return freeze(result);}

export function validateControlAnimationBindings(input){
 if(input===undefined)return freeze([]);
 if(!arrayIsArray(input)||prototype(input)!==arrayPrototype||ownKeys(input).length!==input.length+1)throw new RuntimeError('Control animations must be a dense plain array');
 const seen=new RuntimeSet(),result=[];let bytes=2;
 for(let index=0;index<input.length;index++){
  const element=descriptor(input,runtimeString(index));if(!element?.enumerable||!hasOwn(element,'value'))throw new RuntimeError('Invalid control animation binding');const raw=record(element.value,['nodePath','definitionHash','schemaHash','controlId','shape','periodSeconds','amount','phase','enabled']);
  const nodePath=path(field(raw,'nodePath')),definitionHash=field(raw,'definitionHash'),schemaHash=field(raw,'schemaHash'),controlId=field(raw,'controlId'),shape=field(raw,'shape'),periodSeconds=field(raw,'periodSeconds'),amount=field(raw,'amount'),phase=field(raw,'phase'),enabled=field(raw,'enabled');
  if(typeof definitionHash!=='string'||!regexTest(hash,definitionHash)||typeof schemaHash!=='string'||!regexTest(hash,schemaHash)||typeof controlId!=='string'||!controlId||controlId.length>64||!setHas(shapes,shape)||typeof enabled!=='boolean')throw new RuntimeError('Invalid control animation binding');
  if(!finite(periodSeconds)||periodSeconds<.05||periodSeconds>3600||!finite(amount)||amount<0||!finite(phase)||phase<0||phase>1)throw new RuntimeError('Control animation is outside its supported range');
  const identity=`${stringify(nodePath)}:${controlId}`;if(setHas(seen,identity))throw new RuntimeError('Duplicate control animation binding');setAdd(seen,identity);
  const binding=freeze({nodePath,definitionHash,schemaHash,controlId,shape,periodSeconds,amount,phase,enabled});
  bytes+=encode(encoder,stringify(binding)).byteLength+(index?1:0);if(bytes>1048576)throw new RuntimeError('Control animation metadata exceeds 1 MiB');
  arrayPush(result,binding);
 }
 return freeze(result);
}
