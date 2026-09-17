import {normalizeControlSchema,canonicalControlSchemaJson,validateControlSnapshot} from '../../../../packages/runtime-contracts/src/parameters.mjs';
import {LEGACY_CONTROL_SCHEMA,LEGACY_CONTROL_SCHEMA_HASH,sha256} from './control-state.ts';
// Capture the operations used AFTER generated module evaluation. Holding the
// Object/JSON/Map objects is insufficient: their properties remain mutable.
import {prepareComponentDefinition} from './worker-component-definition.mjs';
import {createControlAnimationEvaluator,normalizeControlAnimations} from './control-animation.mjs';
const ownKeys=Reflect.ownKeys, getDescriptor=Object.getOwnPropertyDescriptor;
const getPrototype=Object.getPrototypeOf, defineProperty=Object.defineProperty;
const freeze=Object.freeze, createObject=Object.create, isArray=Array.isArray;
const objectPrototype=Object.prototype, arrayPrototype=Array.prototype;
const hasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty);
const isFiniteNumber=Number.isFinite,isSafeInteger=Number.isSafeInteger,RuntimeError=Error;
function bad(message){throw new RuntimeError(message);}
function own(input,key){const descriptor=getDescriptor(input,key);if(!descriptor||!descriptor.enumerable||!hasOwn(descriptor,'value'))bad('Control schema requires own data properties');return descriptor.value;}
function record(input){if(!input||typeof input!=='object'||(getPrototype(input)!==objectPrototype&&getPrototype(input)!==null))bad('Control schema requires plain records');return ownKeys(input);}
function sameData(actual,expected,depth=0){
  if(actual===expected)return true;
  if(depth>8||!actual||!expected||typeof actual!=='object'||typeof expected!=='object')return false;
  if(isArray(expected)){
    if(!isArray(actual)||getPrototype(actual)!==arrayPrototype||ownKeys(actual).length!==actual.length+1||actual.length!==expected.length)return false;
    for(let index=0;index<expected.length;index++)if(!sameData(own(actual,''+index),expected[index],depth+1))return false;
    return true;
  }
  const expectedKeys=ownKeys(expected);
  if(record(actual).length!==expectedKeys.length)return false;
  for(let index=0;index<expectedKeys.length;index++){const key=expectedKeys[index];if(typeof key!=='string'||!sameData(own(actual,key),expected[key],depth+1))return false;}
  return true;
}

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
  const scenePath=freeze([]),sceneNode=freeze({nodePath:scenePath,definitionHash:schemaHash,schemaHash,schema});
  const publicControlBindings=createObject(objectPrototype);
  for(const control of schema)defineProperty(publicControlBindings,control.id,{value:freeze([freeze({nodePath:scenePath,controlId:control.id,active:true})]),enumerable:true});
  const profile=freeze({nodes:freeze([sceneNode]),publicControls:schema,publicControlBindings:freeze(publicControlBindings)});
  let animations=normalizeControlAnimations(message.controlAnimations??[],profile),animationSequence=0;
  const base=freeze({values:()=>values,nodeValues:path=>isArray(path)&&path.length===0?values:freeze(createObject(objectPrototype))});
  const animated=createControlAnimationEvaluator(profile,base,animations);
  function validateValues(input){
    if(record(input).length!==schema.length)bad('Invalid full control snapshot');
    const result=createObject(objectPrototype);
    for(let index=0;index<schema.length;index++){
      const control=schema[index],value=own(input,control.id);let admitted;
      if(control.type==='number'){
        if(typeof value!=='number'||!isFiniteNumber(value)||value<control.min||value>control.max)bad('Invalid value for '+control.id);
        admitted=value===0?0:value;
      }else if(control.type==='boolean'){
        if(typeof value!=='boolean')bad('Invalid value for '+control.id);admitted=value;
      }else{
        if(typeof value!=='string')bad('Invalid value for '+control.id);let found=false;
        for(let optionIndex=0;optionIndex<control.options.length;optionIndex++)if(control.options[optionIndex].id===value){found=true;break;}
        if(!found)bad('Invalid value for '+control.id);admitted=value;
      }
      defineProperty(result,control.id,{value:admitted,enumerable:true});
    }
    return freeze(result);
  }
  function checkDefinition(module){
    if(componentCheck)return componentCheck(module);
    const definition=own(module,'default');record(definition);
    if(own(definition,'sdkVersion')!==sdkVersion)bad('Visual SDK mismatch');
    const declared=own(definition,'controls');
    if(!sameData(declared,schema))bad('Visual control schema mismatch');
    const create=own(definition,'create');if(typeof create!=='function')bad('Invalid visual create function');return create;
  }
  return freeze({checkDefinition,values:(timeSeconds=0,beatPosition=0)=>animated.values(timeSeconds,beatPosition),
    sample:(path,controlId,instanceKey,timeSeconds=0,beatPosition=0)=>animated.sample(path,controlId,instanceKey,timeSeconds,beatPosition),
    apply(input,nextSequence,hash){
      if(!isSafeInteger(nextSequence)||nextSequence<=sequence||(sdkVersion!=='0.1.0'&&hash!==schemaHash))bad('Invalid control snapshot sequence or schema');
      const next=validateValues(input);values=next;sequence=nextSequence;
    },
    applyAnimations(input,nextSequence,timeSeconds){
      if(!isSafeInteger(nextSequence)||nextSequence<=animationSequence)bad('Invalid animation snapshot sequence');
      animations=normalizeControlAnimations(input,profile);animated.replace(animations,timeSeconds);animationSequence=nextSequence;
    },
    restartAnimation(path,controlId,timeSeconds){animated.restart(path,controlId,timeSeconds);},
    resetAnimations(timeSeconds){for(let index=0;index<animations.bindings.length;index++){const binding=animations.bindings[index];animated.restart(binding.nodePath,binding.controlId,timeSeconds);}},
    applyAudioSnapshot(input,context){return animated.applyAudioSnapshot(input,context);},
    fenceAudioEvents(){animated.fenceAudioEvents();},
    state:(timeSeconds=0,beatPosition=0)=>({sdkVersion,controlSchemaHash:schemaHash,controls:values,controlSequence:sequence,effectiveControls:animated.values(timeSeconds,beatPosition),
      controlAnimations:animated.bindings(),controlAnimationIssues:animated.issues(),animationSequence,...(sdkVersion==='0.1.0'?{intensity:values.intensity}:{})}),
  });
}
