const freeze=Object.freeze,arrayIsArray=Array.isArray,objectKeys=Object.keys,hasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty),finite=Number.isFinite,stringify=JSON.stringify,shapes=new Set(['sine','triangle','saw','square']);
const hash=/^[a-f0-9]{64}$/;

export function validateControlAnimationBindings(input){
 if(input===undefined)return freeze([]);
 if(!arrayIsArray(input)||input.length>32)throw Error('Control animations must contain at most 32 bindings');
 const seen=new Set();
 return freeze(input.map(raw=>{
  if(!raw||typeof raw!=='object'||arrayIsArray(raw))throw Error('Invalid control animation binding');
  const fields=['nodePath','definitionHash','schemaHash','controlId','shape','periodSeconds','amount','phase','enabled'];
  if(objectKeys(raw).length!==fields.length||fields.some(field=>!hasOwn(raw,field)))throw Error('Invalid control animation fields');
  if(!arrayIsArray(raw.nodePath)||raw.nodePath.length<1||raw.nodePath.length>8||raw.nodePath.some(id=>typeof id!=='string'))throw Error('Invalid animation node path');
  if(!hash.test(raw.definitionHash)||!hash.test(raw.schemaHash)||typeof raw.controlId!=='string'||!raw.controlId||raw.controlId.length>64||!shapes.has(raw.shape)||typeof raw.enabled!=='boolean')throw Error('Invalid control animation binding');
  if(!finite(raw.periodSeconds)||raw.periodSeconds<.05||raw.periodSeconds>3600||!finite(raw.amount)||raw.amount<0||!finite(raw.phase)||raw.phase<0||raw.phase>1)throw Error('Control animation is outside its supported range');
  const identity=`${stringify(raw.nodePath)}:${raw.controlId}`;if(seen.has(identity))throw Error('Duplicate control animation binding');seen.add(identity);
  return freeze({nodePath:freeze([...raw.nodePath]),definitionHash:raw.definitionHash,schemaHash:raw.schemaHash,controlId:raw.controlId,shape:raw.shape,periodSeconds:raw.periodSeconds,amount:raw.amount,phase:raw.phase,enabled:raw.enabled});
 }));
}
