import {normalizeImageCompositionProfile} from '../../../../packages/runtime-contracts/src/composition-profile.mjs';
import {canonicalComponentMetadataJson} from '../../../../packages/runtime-contracts/src/components.mjs';
import {canonicalControlSchemaJson,normalizeControlSchema,validateControlSnapshot} from '../../../../packages/runtime-contracts/src/parameters.mjs';
import {createCompositionControlState} from '../../../../packages/runtime/src/components/composition-controls.ts';
const keys=Reflect.ownKeys,descriptor=Object.getOwnPropertyDescriptor,prototype=Object.getPrototypeOf,freeze=Object.freeze,stringify=JSON.stringify,objectPrototype=Object.prototype;
const hasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty),safe=Number.isSafeInteger;
function bad(){throw Error('Composition definition metadata mismatch');}
function own(value,key){const d=descriptor(value,key);if(!d?.enumerable||!hasOwn(d,'value'))bad();return d.value;}
function plain(value,expected){if(!value||typeof value!=='object'||(prototype(value)!==objectPrototype&&prototype(value)!==null)||keys(value).length!==expected.length)bad();for(const key of expected)own(value,key);return value;}
function data(value){if(value===null||typeof value!=='object')return value;if(Array.isArray(value)){if(prototype(value)!==Array.prototype||keys(value).length!==value.length+1)bad();return value.map((_,i)=>data(own(value,String(i))));}const result={};for(const key of keys(value)){if(typeof key!=='string')bad();result[key]=data(own(value,key));}return result;}
export async function prepareWorkerCompositionState(message,admission){
 if(admission?.kind!=='composition'||message.sdkVersion!=='0.4.0'||admission.sdkVersion!=='0.4.0'||admission.executionModel!=='image-chain-v1')bad();const profile=normalizeImageCompositionProfile(admission.composition),schema=normalizeControlSchema(message.controlSchema);if(canonicalControlSchemaJson(schema)!==canonicalControlSchemaJson(profile.publicControls)||message.controlSchemaHash!==admission.controlSchemaHash)bad();
 const state=createCompositionControlState(profile,message.nodeControls);state.apply(validateControlSnapshot(schema,message.controls));let sequence=0;
 function checkDefinition(module){const definition=plain(own(module,'default'),['kind','sdkVersion','definitions','nodes','edges','output','expose']);if(own(definition,'kind')!=='composition'||own(definition,'sdkVersion')!=='0.4.0')bad();for(const field of ['nodes','edges','output','expose'])if(stringify(data(own(definition,field)))!==stringify(profile.declaration[field]))bad();const actual=plain(own(definition,'definitions'),Object.keys(profile.definitionNames)),byHash={};for(const [name,definitionHash] of Object.entries(profile.definitionNames)){const component=plain(own(actual,name),['kind','sdkVersion','metadata','create']);if(own(component,'kind')!=='component'||own(component,'sdkVersion')!=='0.4.0'||typeof own(component,'create')!=='function'||canonicalComponentMetadataJson(data(own(component,'metadata')))!==canonicalComponentMetadataJson(profile.definitions[definitionHash].metadata))bad();byHash[definitionHash]=component;}return freeze(byHash);}
 return freeze({checkDefinition,values:state.values,nodeValues:state.nodeValues,
  apply(input,nextSequence,hash){if(!safe(nextSequence)||nextSequence<=sequence||hash!==admission.controlSchemaHash)bad();state.apply(validateControlSnapshot(schema,input));sequence=nextSequence;},
  state:()=>({sdkVersion:'0.4.0',controlSchemaHash:admission.controlSchemaHash,controls:state.values(),controlSequence:sequence,nodeControls:state.snapshot()}),
 });
}
