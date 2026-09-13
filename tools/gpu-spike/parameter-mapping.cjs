'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
function policy(){return require(fs.existsSync(path.join(__dirname,'runtime-validation.cjs'))?'./runtime-validation.cjs':'./runtime-validation.mjs');}
function schemaHash(schema){return createHash('sha256').update(policy().canonicalControlSchemaJson(schema)).digest('hex');}
function parameterMapping(schema,values,expectedHash){
 const p=policy(),rows=p.normalizeControlSchema(schema);p.validateControlSnapshot(rows,values);
 if(schemaHash(rows)!==expectedHash)throw Error('Control schema hash mismatch');
 const used=new Set();
 return rows.map((row,index)=>{
  let label=row.label.normalize('NFKD').replace(/[^\x20-\x7e]/g,'').trim()||row.id;
  label=label.slice(0,16);
  if(used.has(label)){const suffix=' '+String(index+1);label=label.slice(0,16-suffix.length)+suffix;}
  while(used.has(label))label=String(index+1)+' '+label.slice(0,13);
  used.add(label);
  return {index,id:row.id,label:row.label,hostLabel:label,min:row.min,max:row.max,default:row.default,
   initial:Math.fround((values[row.id]-row.min)/(row.max-row.min))};
 });
}
function mapHostSnapshot(schema,expectedHash,snapshot){
 if(!snapshot||snapshot.initialized!==true||snapshot.schemaHash!==expectedHash)throw Error('Host control schema mismatch');
 if(snapshot.count!==schema.length||!Array.isArray(snapshot.values)||snapshot.values.length!==schema.length||
  typeof snapshot.sequence!=='string'||!(/^[1-9][0-9]{0,19}$/).test(snapshot.sequence)||BigInt(snapshot.sequence)>0xffffffffffffffffn)throw Error('Invalid host snapshot');
 const values={};
 schema.forEach((row,index)=>{const value=snapshot.values[index];if(!Number.isFinite(value)||value<0||value>1)throw Error('Invalid normalized host value');
  // Preserve declared endpoints exactly; intermediate floating point rounding must stay in range.
  values[row.id]=value===0?row.min:value===1?row.max:Math.min(row.max,Math.max(row.min,row.min+value*(row.max-row.min)));
 });
 return values;
}
module.exports={parameterMapping,mapHostSnapshot,schemaHash,policy};
