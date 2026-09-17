import {normalizeControlSchema,canonicalControlSchemaJson,validateControlSnapshot} from '../../../../packages/runtime-contracts/src/parameters.mjs';
import {LEGACY_CONTROL_SCHEMA,LEGACY_CONTROL_SCHEMA_HASH,sha256} from './control-state.ts';
// Capture the operations used AFTER generated module evaluation. Holding the
// Object/JSON/Map objects is insufficient: their properties remain mutable.
import {prepareComponentDefinition} from './worker-component-definition.mjs';
import {createControlAnimationEvaluator,normalizeControlAnimations} from './control-animation.mjs';
import {normalizeAudioBandSnapshot} from '../../../../packages/runtime-contracts/src/audio-input.mjs';
const ownKeys=Reflect.ownKeys, getDescriptor=Object.getOwnPropertyDescriptor;
const getPrototype=Object.getPrototypeOf, defineProperty=Object.defineProperty;
const freeze=Object.freeze, createObject=Object.create, isArray=Array.isArray;
const objectPrototype=Object.prototype, arrayPrototype=Array.prototype;
const hasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty);
const isFiniteNumber=Number.isFinite,isSafeInteger=Number.isSafeInteger,RuntimeError=Error;
function bad(message){throw new RuntimeError(message);}
function own(input,key){const descriptor=getDescriptor(input,key);if(!descriptor||!descriptor.enumerable||!hasOwn(descriptor,'value'))bad('Control schema requires own data properties');return descriptor.value;}
function optionalOwn(input,key,fallback){const descriptor=getDescriptor(input,key);if(!descriptor)return fallback;if(!descriptor.enumerable||!hasOwn(descriptor,'value'))bad('Control snapshot requires own data properties');return descriptor.value;}
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

/** Must finish before importing user code; createSlot remains safe afterwards. */
export async function prepareWorkerVisualControlFactory(message,admission){
  const sdkVersion=message.sdkVersion??'0.1.0';
  if(sdkVersion!=='0.1.0'&&sdkVersion!=='0.2.0'&&sdkVersion!=='0.3.0')bad('Unsupported visual SDK');
  const schema=normalizeControlSchema(message.controlSchema??(sdkVersion==='0.1.0'?LEGACY_CONTROL_SCHEMA:undefined));
  const schemaHash=await sha256(new TextEncoder().encode(canonicalControlSchemaJson(schema)));
  if((message.controlSchemaHash??(sdkVersion==='0.1.0'?LEGACY_CONTROL_SCHEMA_HASH:undefined))!==schemaHash)bad('Control schema hash mismatch');
  if(admission?.kind==='component'||sdkVersion==='0.3.0'){
    if(admission?.kind!=='component'||sdkVersion!==admission.sdkVersion||schemaHash!==admission.controlSchemaHash||canonicalControlSchemaJson(schema)!==canonicalControlSchemaJson(admission.controls))bad('Component linked/message schema or SDK mismatch');
  }
  if(admission?.kind==='story'&&(sdkVersion!=='0.2.0'||sdkVersion!==admission.sdkVersion||schemaHash!==admission.controlSchemaHash||canonicalControlSchemaJson(schema)!==canonicalControlSchemaJson(admission.controls)))bad('Story linked/message schema or SDK mismatch');
  const componentCheck=sdkVersion==='0.3.0'?prepareComponentDefinition(admission.component):undefined;
  const initialValues=validateControlSnapshot(schema,message.controls);
  const scenePath=freeze([]),sceneNode=freeze({nodePath:scenePath,definitionHash:schemaHash,schemaHash,schema});
  const publicControlBindings=createObject(objectPrototype);
  for(const control of schema)defineProperty(publicControlBindings,control.id,{value:freeze([freeze({nodePath:scenePath,controlId:control.id,active:true})]),enumerable:true});
  const profile=freeze({nodes:freeze([sceneNode]),publicControls:schema,publicControlBindings:freeze(publicControlBindings)});
  function validateValues(input){
    let persistent=0;for(let index=0;index<schema.length;index++)if(schema[index].type!=='trigger')persistent++;
    if(record(input).length!==persistent)bad('Invalid full control snapshot');
    const result=createObject(objectPrototype);
    for(let index=0;index<schema.length;index++){
      const control=schema[index];if(control.type==='trigger')continue;const value=own(input,control.id);let admitted;
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
  const initialAnimations=normalizeControlAnimations(message.controlAnimations??[],profile);
  const initialAudioSnapshot=normalizeAudioBandSnapshot({generation:0,sequence:0,available:false,level:0,bass:0,mids:0,highs:0,kickSequence:0,kickStrength:0});
  function createSlot(snapshot=message){
  let values=snapshot===message?initialValues:validateValues(own(snapshot,'controls'));
  let sequence=optionalOwn(snapshot,'controlSequence',0);
  let animationSequence=optionalOwn(snapshot,'animationSequence',0);
  if(!isSafeInteger(sequence)||sequence<0||!isSafeInteger(animationSequence)||animationSequence<0)bad('Invalid initial control sequence');
  const snapshotHash=optionalOwn(snapshot,'controlSchemaHash',schemaHash);
  if(sdkVersion!=='0.1.0'&&snapshotHash!==schemaHash)bad('Invalid initial control schema');
  let animations=snapshot===message?initialAnimations:normalizeControlAnimations(optionalOwn(snapshot,'controlAnimations',[]),profile);
  const base=freeze({values:()=>values,nodeValues:path=>isArray(path)&&path.length===0?values:freeze(createObject(objectPrototype))});
  const animated=createControlAnimationEvaluator(profile,base,animations,initialAudioSnapshot);
  function checkDefinition(module){
    if(componentCheck)return componentCheck(module);
    const definition=own(module,'default');record(definition);
    if(own(definition,'sdkVersion')!==sdkVersion)bad('Visual SDK mismatch');
    if(admission?.kind==='story'&&!sameData(own(definition,'story'),admission.storyCapability))bad('Visual Story capability mismatch');
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
    resolveTrigger(path,controlId){
      if(!isArray(path)||path.length!==0)bad('Scene trigger path is unavailable');let control;
      for(let index=0;index<schema.length;index++)if(schema[index].id===controlId){control=schema[index];break;}
      if(!control||control.type!=='trigger')bad('Scene trigger is unavailable');return freeze({nodePath:scenePath,controlId});
    },
    resetAnimations(timeSeconds){for(let index=0;index<animations.bindings.length;index++){const binding=animations.bindings[index];animated.restart(binding.nodePath,binding.controlId,timeSeconds);}},
    applyAudioSnapshot(input,context){return animated.applyAudioSnapshot(input,context);},
    fenceAudioEvents(){animated.fenceAudioEvents();},
    state:(timeSeconds=0,beatPosition=0)=>({sdkVersion,controlSchemaHash:schemaHash,controls:values,controlSequence:sequence,effectiveControls:animated.values(timeSeconds,beatPosition),
      controlAnimations:animated.bindings(),controlAnimationIssues:animated.issues(),animationSequence,...(sdkVersion==='0.1.0'?{intensity:values.intensity}:{})}),
  });
  }
  return freeze({sdkVersion,controlSchema:schema,controlSchemaHash:schemaHash,createSlot});
}

/** Compatibility helper for the existing single-slot worker route. */
export async function prepareWorkerControlState(message,admission){return (await prepareWorkerVisualControlFactory(message,admission)).createSlot();}
