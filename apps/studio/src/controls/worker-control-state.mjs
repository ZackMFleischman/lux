import {normalizeControlSchema,canonicalControlSchemaJson,validateControlSnapshot} from '../../../../packages/runtime-contracts/src/parameters.mjs';
import {LEGACY_CONTROL_SCHEMA,LEGACY_CONTROL_SCHEMA_HASH,sha256} from './control-state.ts';
// Capture the operations used AFTER generated module evaluation. Holding the
// Object/JSON/Map objects is insufficient: their properties remain mutable.
import {prepareComponentDefinition} from './worker-component-definition.mjs';
const ownKeys=Reflect.ownKeys, getDescriptor=Object.getOwnPropertyDescriptor;
const getPrototype=Object.getPrototypeOf, defineProperty=Object.defineProperty;
const freeze=Object.freeze, createObject=Object.create, isArray=Array.isArray;
const objectPrototype=Object.prototype, arrayPrototype=Array.prototype;
const hasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty);
const isFiniteNumber=Number.isFinite,isSafeInteger=Number.isSafeInteger,RuntimeError=Error;
function bad(message){throw new RuntimeError(message);}
function own(input,key){const descriptor=getDescriptor(input,key);if(!descriptor||!descriptor.enumerable||!hasOwn(descriptor,'value'))bad('Control schema requires own data properties');return descriptor.value;}
function record(input){if(!input||typeof input!=='object'||(getPrototype(input)!==objectPrototype&&getPrototype(input)!==null))bad('Control schema requires plain records');return ownKeys(input);}

/** Must finish before importing user code; post-import methods use captures. */
export async function prepareWorkerControlState(message,admission){
  const sdkVersion=message.sdkVersion??'0.1.0';
  if(sdkVersion!=='0.1.0'&&sdkVersion!=='0.2.0'&&sdkVersion!=='0.3.0')bad('Unsupported visual SDK');
  const schema=normalizeControlSchema(message.controlSchema??(sdkVersion==='0.1.0'?LEGACY_CONTROL_SCHEMA:undefined));
  const schemaHash=await sha256(new TextEncoder().encode(canonicalControlSchemaJson(schema)));
  if((message.controlSchemaHash??(sdkVersion==='0.1.0'?LEGACY_CONTROL_SCHEMA_HASH:undefined))!==schemaHash)bad('Control schema hash mismatch');
  if(admission?.kind==='component'||sdkVersion==='0.3.0'){
    if(admission?.kind!=='component'||sdkVersion!==admission.sdkVersion||schemaHash!==admission.controlSchemaHash||canonicalControlSchemaJson(schema)!==canonicalControlSchemaJson(admission.controls))bad('Component linked/message schema or SDK mismatch');
  }
  const componentCheck=sdkVersion==='0.3.0'?prepareComponentDefinition(admission.component):undefined;
  let values=validateControlSnapshot(schema,message.controls), sequence=0;
  const fields=schema.map(row=>ownKeys(row));
  function validateValues(input){
    if(record(input).length!==schema.length)bad('Invalid full control snapshot');
    const result=createObject(objectPrototype);
    for(let i=0;i<schema.length;i++){
      const control=schema[i],value=own(input,control.id);
      if(typeof value!=='number'||!isFiniteNumber(value)||value<control.min||value>control.max)bad('Invalid value for '+control.id);
      defineProperty(result,control.id,{value:value===0?0:value,enumerable:true});
    }
    return freeze(result);
  }
  function checkDefinition(module){
    if(componentCheck)return componentCheck(module);
    const definition=own(module,'default');record(definition);
    if(own(definition,'sdkVersion')!==sdkVersion)bad('Visual SDK mismatch');
    const declared=own(definition,'controls');
    if(!isArray(declared)||getPrototype(declared)!==arrayPrototype||getDescriptor(declared,'length').value!==schema.length||ownKeys(declared).length!==schema.length+1)bad('Visual control schema mismatch');
    for(let i=0;i<schema.length;i++){
      const row=own(declared,''+i),expected=schema[i],keys=fields[i];
      if(record(row).length!==keys.length)bad('Visual control schema mismatch');
      for(let j=0;j<keys.length;j++)if(own(row,keys[j])!==expected[keys[j]])bad('Visual control schema mismatch');
    }
    const create=own(definition,'create');if(typeof create!=='function')bad('Invalid visual create function');return create;
  }
  return freeze({checkDefinition,values:()=>values,
    apply(input,nextSequence,hash){
      if(!isSafeInteger(nextSequence)||nextSequence<=sequence||(sdkVersion!=='0.1.0'&&hash!==schemaHash))bad('Invalid control snapshot sequence or schema');
      const next=validateValues(input);values=next;sequence=nextSequence;
    },
    state:()=>({sdkVersion,controlSchemaHash:schemaHash,controls:values,controlSequence:sequence,...(sdkVersion==='0.1.0'?{intensity:values.intensity}:{})}),
  });
}
