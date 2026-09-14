const freeze=Object.freeze,arrayIsArray=Array.isArray,ownKeys=Reflect.ownKeys,descriptor=Object.getOwnPropertyDescriptor,prototype=Object.getPrototypeOf;
const objectPrototype=Object.prototype,arrayPrototype=Array.prototype,finite=Number.isFinite,stringify=JSON.stringify;
const hasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty),setHas=Function.prototype.call.bind(Set.prototype.has),setAdd=Function.prototype.call.bind(Set.prototype.add),regexTest=Function.prototype.call.bind(RegExp.prototype.test);
const shapes=new Set(['sine','triangle','saw','square']),hash=/^[a-f0-9]{64}$/;
function field(record,name){const value=descriptor(record,name);if(!value?.enumerable||!hasOwn(value,'value'))throw Error('Invalid control animation fields');return value.value;}
function record(value,fields){if(!value||typeof value!=='object'||arrayIsArray(value)||(prototype(value)!==objectPrototype&&prototype(value)!==null)||ownKeys(value).length!==fields.length)throw Error('Invalid control animation binding');for(const name of fields)field(value,name);return value;}
function path(value){if(!arrayIsArray(value)||prototype(value)!==arrayPrototype||value.length<1||value.length>8||ownKeys(value).length!==value.length+1)throw Error('Invalid animation node path');const result=[];for(let index=0;index<value.length;index++){const id=descriptor(value,String(index));if(!id?.enumerable||!hasOwn(id,'value')||typeof id.value!=='string')throw Error('Invalid animation node path');result.push(id.value);}return freeze(result);}

export function validateControlAnimationBindings(input){
 if(input===undefined)return freeze([]);
 if(!arrayIsArray(input)||prototype(input)!==arrayPrototype||input.length>32||ownKeys(input).length!==input.length+1)throw Error('Control animations must contain at most 32 bindings');
 const seen=new Set(),result=[];
 for(let index=0;index<input.length;index++){
  const element=descriptor(input,String(index));if(!element?.enumerable||!hasOwn(element,'value'))throw Error('Invalid control animation binding');const raw=record(element.value,['nodePath','definitionHash','schemaHash','controlId','shape','periodSeconds','amount','phase','enabled']);
  const nodePath=path(field(raw,'nodePath')),definitionHash=field(raw,'definitionHash'),schemaHash=field(raw,'schemaHash'),controlId=field(raw,'controlId'),shape=field(raw,'shape'),periodSeconds=field(raw,'periodSeconds'),amount=field(raw,'amount'),phase=field(raw,'phase'),enabled=field(raw,'enabled');
  if(typeof definitionHash!=='string'||!regexTest(hash,definitionHash)||typeof schemaHash!=='string'||!regexTest(hash,schemaHash)||typeof controlId!=='string'||!controlId||controlId.length>64||!setHas(shapes,shape)||typeof enabled!=='boolean')throw Error('Invalid control animation binding');
  if(!finite(periodSeconds)||periodSeconds<.05||periodSeconds>3600||!finite(amount)||amount<0||!finite(phase)||phase<0||phase>1)throw Error('Control animation is outside its supported range');
  const identity=`${stringify(nodePath)}:${controlId}`;if(setHas(seen,identity))throw Error('Duplicate control animation binding');setAdd(seen,identity);
  result.push(freeze({nodePath,definitionHash,schemaHash,controlId,shape,periodSeconds,amount,phase,enabled}));
 }
 return freeze(result);
}
