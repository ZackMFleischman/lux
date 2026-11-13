import {normalizeImageCompositionProfile} from '../../../../packages/runtime-contracts/src/composition-profile.mjs';
import {canonicalControlSchemaJson,normalizeControlSchema,validateControlSnapshot} from '../../../../packages/runtime-contracts/src/parameters.mjs';
import {createCompositionControlState} from '../../../../packages/runtime/src/components/composition-controls.ts';
import {createControlAnimationEvaluator,normalizeControlAnimations} from './control-animation.mjs';
const keys=Reflect.ownKeys,descriptor=Object.getOwnPropertyDescriptor,prototype=Object.getPrototypeOf,freeze=Object.freeze,objectPrototype=Object.prototype;
const arrayIsArray=Array.isArray,arrayPrototype=Array.prototype,objectKeys=Object.keys,objectEntries=Object.entries;
const call=Function.prototype.call,arrayMap=call.bind(Array.prototype.map),arrayPush=call.bind(Array.prototype.push);
const hasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty),safe=Number.isSafeInteger;
function bad(){throw Error('Composition definition metadata mismatch');}
function own(value,key){const d=descriptor(value,key);if(!d?.enumerable||!hasOwn(d,'value'))bad();return d.value;}
function plain(value,expected){if(!value||typeof value!=='object'||(prototype(value)!==objectPrototype&&prototype(value)!==null)||keys(value).length!==expected.length)bad();for(let index=0;index<expected.length;index++)own(value,expected[index]);return value;}
function sameData(actual,expected,depth=0){
 if(actual===expected)return true;
 if(depth>16||!actual||!expected||typeof actual!=='object'||typeof expected!=='object')return false;
 if(arrayIsArray(expected)){
  if(!arrayIsArray(actual)||prototype(actual)!==arrayPrototype||keys(actual).length!==actual.length+1||actual.length!==expected.length)return false;
  for(let index=0;index<expected.length;index++)if(!sameData(own(actual,String(index)),expected[index],depth+1))return false;
  return true;
 }
 const expectedKeys=keys(expected);if((prototype(actual)!==objectPrototype&&prototype(actual)!==null)||keys(actual).length!==expectedKeys.length)return false;
 for(let index=0;index<expectedKeys.length;index++){const key=expectedKeys[index];if(typeof key!=='string'||!sameData(own(actual,key),expected[key],depth+1))return false;}
 return true;
}
export async function prepareWorkerCompositionState(message,admission){
 if(admission?.kind!=='composition'||message.sdkVersion!=='0.4.0'||admission.sdkVersion!=='0.4.0'||!['image-chain-v1','typed-image-graph-v1'].includes(admission.executionModel))bad();const profile=normalizeImageCompositionProfile(admission.composition),schema=normalizeControlSchema(message.controlSchema);if((profile.version===2)!==(admission.executionModel==='typed-image-graph-v1'))bad();if(canonicalControlSchemaJson(schema)!==canonicalControlSchemaJson(profile.publicControls)||message.controlSchemaHash!==admission.controlSchemaHash)bad();
 const state=createCompositionControlState(profile,message.nodeControls);state.apply(validateControlSnapshot(schema,message.controls));let sequence=0;
 let animations=normalizeControlAnimations(message.controlAnimations,profile),animationSequence=0;const animated=createControlAnimationEvaluator(profile,state,animations);
 function checkDefinition(module){
  const byHash={},modules=profile.moduleDeclarations??{[profile.graph.rootDefinitionHash]:{definitionNames:profile.definitionNames,declaration:profile.declaration}};
  function visit(value,definitionHash){
   const admitted=profile.definitions[definitionHash];if(!admitted)bad();
   if(admitted.kind==='code'){
    const component=plain(value,['kind','sdkVersion','metadata','create']);if(own(component,'kind')!=='component'||own(component,'sdkVersion')!=='0.4.0'||typeof own(component,'create')!=='function'||!sameData(own(component,'metadata'),admitted.metadata))bad();
    if(byHash[definitionHash]&&byHash[definitionHash]!==component)bad();byHash[definitionHash]=component;return;
   }
   const sealed=modules[definitionHash];if(!sealed)bad();const declaration=sealed.declaration,declarationKeys=objectKeys(declaration),literalFields=[];
   for(let index=0;index<declarationKeys.length;index++)if(declarationKeys[index]!=='definitions')arrayPush(literalFields,declarationKeys[index]);
   const expectedFields=['kind','sdkVersion','definitions'];for(let index=0;index<literalFields.length;index++)arrayPush(expectedFields,literalFields[index]);
   const definition=plain(value,expectedFields);if(own(definition,'kind')!=='composition'||own(definition,'sdkVersion')!=='0.4.0')bad();
   for(let index=0;index<literalFields.length;index++){const field=literalFields[index];if(!sameData(own(definition,field),declaration[field]))bad();}
   const actual=plain(own(definition,'definitions'),objectKeys(sealed.definitionNames)),entries=objectEntries(sealed.definitionNames);
   for(let index=0;index<entries.length;index++){const entry=entries[index];visit(own(actual,entry[0]),entry[1]);}
  }
  visit(own(module,'default'),profile.graph.rootDefinitionHash);return freeze(byHash);
 }
 return freeze({checkDefinition,values:animated.values,nodeValues:animated.nodeValues,sample:animated.sample,
  resolveTrigger(path,controlId){const target=state.resolveControl(path,controlId);if(target.type!=='trigger')throw Error('Composition trigger is unavailable');return freeze({nodePath:target.nodePath,controlId:target.controlId});},
  apply(input,nextSequence,hash){if(!safe(nextSequence)||nextSequence<=sequence||hash!==admission.controlSchemaHash)bad();state.apply(validateControlSnapshot(schema,input));sequence=nextSequence;},
  applyNode(path,input,nextSequence,hash){if(!safe(nextSequence)||nextSequence<=sequence)bad();state.applyNode(path,input,hash);sequence=nextSequence;},
  applyAnimations(input,nextSequence,timeSeconds){if(!safe(nextSequence)||nextSequence<=animationSequence)bad();animations=normalizeControlAnimations(input,profile);animated.replace(animations,timeSeconds);animationSequence=nextSequence;},
  restartAnimation(path,controlId,timeSeconds){animated.restart(path,controlId,timeSeconds);},
  resetAnimations(timeSeconds){for(let index=0;index<animations.bindings.length;index++){const binding=animations.bindings[index];animated.restart(binding.nodePath,binding.controlId,timeSeconds);}},
  applyAudioSnapshot(input,context){return animated.applyAudioSnapshot(input,context);},
  fenceAudioEvents(){animated.fenceAudioEvents();},
  state:(timeSeconds=0,beatPosition=0)=>{const base=state.snapshot();return {sdkVersion:'0.4.0',controlSchemaHash:admission.controlSchemaHash,controls:state.values(),effectiveControls:animated.values(timeSeconds,beatPosition),controlSequence:sequence,nodeControls:base,
    effectiveNodeControls:freeze({...base,nodes:freeze(arrayMap(base.nodes,node=>freeze({...node,values:animated.nodeValues(node.nodePath,timeSeconds,beatPosition)})))}),
    controlAnimations:animated.bindings(),controlAnimationIssues:animated.issues(),animationSequence};},
 });
}
