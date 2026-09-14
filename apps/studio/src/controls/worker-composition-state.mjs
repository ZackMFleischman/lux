import {normalizeImageCompositionProfile} from '../../../../packages/runtime-contracts/src/composition-profile.mjs';
import {canonicalComponentMetadataJson} from '../../../../packages/runtime-contracts/src/components.mjs';
import {canonicalControlSchemaJson,normalizeControlSchema,validateControlSnapshot} from '../../../../packages/runtime-contracts/src/parameters.mjs';
import {createCompositionControlState} from '../../../../packages/runtime/src/components/composition-controls.ts';
import {createControlAnimationEvaluator,normalizeControlAnimations} from './control-animation.mjs';
const keys=Reflect.ownKeys,descriptor=Object.getOwnPropertyDescriptor,prototype=Object.getPrototypeOf,freeze=Object.freeze,stringify=JSON.stringify,objectPrototype=Object.prototype;
const hasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty),safe=Number.isSafeInteger;
function bad(){throw Error('Composition definition metadata mismatch');}
function own(value,key){const d=descriptor(value,key);if(!d?.enumerable||!hasOwn(d,'value'))bad();return d.value;}
function plain(value,expected){if(!value||typeof value!=='object'||(prototype(value)!==objectPrototype&&prototype(value)!==null)||keys(value).length!==expected.length)bad();for(const key of expected)own(value,key);return value;}
function data(value){if(value===null||typeof value!=='object')return value;if(Array.isArray(value)){if(prototype(value)!==Array.prototype||keys(value).length!==value.length+1)bad();return value.map((_,i)=>data(own(value,String(i))));}const result={};for(const key of keys(value)){if(typeof key!=='string')bad();result[key]=data(own(value,key));}return result;}
export async function prepareWorkerCompositionState(message,admission){
 if(admission?.kind!=='composition'||message.sdkVersion!=='0.4.0'||admission.sdkVersion!=='0.4.0'||admission.executionModel!=='image-chain-v1')bad();const profile=normalizeImageCompositionProfile(admission.composition),schema=normalizeControlSchema(message.controlSchema);if(canonicalControlSchemaJson(schema)!==canonicalControlSchemaJson(profile.publicControls)||message.controlSchemaHash!==admission.controlSchemaHash)bad();
 const state=createCompositionControlState(profile,message.nodeControls);state.apply(validateControlSnapshot(schema,message.controls));let sequence=0;
 let animations=normalizeControlAnimations(message.controlAnimations,profile),animationSequence=0;const animated=createControlAnimationEvaluator(profile,state,animations);
 function checkDefinition(module){
  const byHash={},modules=profile.moduleDeclarations??{[profile.graph.rootDefinitionHash]:{definitionNames:profile.definitionNames,declaration:profile.declaration}};
  function visit(value,definitionHash){
   const admitted=profile.definitions[definitionHash];if(!admitted)bad();
   if(admitted.kind==='code'){
    const component=plain(value,['kind','sdkVersion','metadata','create']);if(own(component,'kind')!=='component'||own(component,'sdkVersion')!=='0.4.0'||typeof own(component,'create')!=='function'||canonicalComponentMetadataJson(data(own(component,'metadata')))!==canonicalComponentMetadataJson(admitted.metadata))bad();
    if(byHash[definitionHash]&&byHash[definitionHash]!==component)bad();byHash[definitionHash]=component;return;
   }
   const sealed=modules[definitionHash];if(!sealed)bad();const declaration=sealed.declaration,literalFields=Object.keys(declaration).filter(key=>key!=='definitions'),definition=plain(value,['kind','sdkVersion','definitions',...literalFields]);if(own(definition,'kind')!=='composition'||own(definition,'sdkVersion')!=='0.4.0')bad();for(const field of literalFields)if(stringify(data(own(definition,field)))!==stringify(declaration[field]))bad();const actual=plain(own(definition,'definitions'),Object.keys(sealed.definitionNames));for(const [name,childHash] of Object.entries(sealed.definitionNames))visit(own(actual,name),childHash);
  }
  visit(own(module,'default'),profile.graph.rootDefinitionHash);return freeze(byHash);
 }
 return freeze({checkDefinition,values:animated.values,nodeValues:animated.nodeValues,
  apply(input,nextSequence,hash){if(!safe(nextSequence)||nextSequence<=sequence||hash!==admission.controlSchemaHash)bad();state.apply(validateControlSnapshot(schema,input));sequence=nextSequence;},
  applyNode(path,input,nextSequence,hash){if(!safe(nextSequence)||nextSequence<=sequence)bad();state.applyNode(path,input,hash);sequence=nextSequence;},
  applyAnimations(input,nextSequence,timeSeconds){if(!safe(nextSequence)||nextSequence<=animationSequence)bad();animations=normalizeControlAnimations(input,profile);animated.replace(animations,timeSeconds);animationSequence=nextSequence;},
  restartAnimation(path,controlId,timeSeconds){animated.restart(path,controlId,timeSeconds);},
  resetAnimations(timeSeconds){for(const binding of animations.bindings)animated.restart(binding.nodePath,binding.controlId,timeSeconds);},
  state:(timeSeconds=0)=>{const base=state.snapshot();return {sdkVersion:'0.4.0',controlSchemaHash:admission.controlSchemaHash,controls:state.values(),controlSequence:sequence,nodeControls:base,
    effectiveNodeControls:freeze({...base,nodes:freeze(base.nodes.map(node=>freeze({...node,values:animated.nodeValues(node.nodePath,timeSeconds)})))}),
    controlAnimations:animated.bindings(),controlAnimationIssues:animated.issues(),animationSequence};},
 });
}
