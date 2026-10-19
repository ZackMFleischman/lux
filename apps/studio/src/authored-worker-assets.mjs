import {verifyLinked} from '../../../apps/build-worker/src/artifact-identity.mjs';
import {verifyDerivedAssets,createReadonlyAssetMap,createReadonlyImageMap} from '../../../packages/assets/src/index.mjs';
import {validateSingleImageProfile} from '../../../packages/runtime-contracts/src/component-profile.mjs';
import {snapshotRecord,limits as sourceLimits} from '../../../apps/build-worker/src/source-policy.mjs';
import {normalizeImageCompositionProfile} from '../../../packages/runtime-contracts/src/composition-profile.mjs';
import {normalizeStoryCapability,validateStoryAgainstCapability,canonicalSceneStoryJson} from '../../../packages/runtime-contracts/src/story.mjs';
import {canonicalControlSchemaJson} from '../../../packages/runtime-contracts/src/parameters.mjs';
import {prepareWorkerVisualControlFactory} from './controls/worker-control-state.mjs';
import {prepareStoryAssetLeaseFactory} from './assets/story-asset-leases.mjs';
import {verifyStoryGenerationPreparation} from './story/story-generation-manifest.mjs';

// This module is loaded in the pristine worker realm. All admission and private
// store construction finish before invoking the trusted submitted-code importer.
const freeze=Object.freeze,RuntimeError=Error,RuntimeMap=Map,call=Function.prototype.call,mapGet=call.bind(Map.prototype.get),mapSet=call.bind(Map.prototype.set);
const digest=crypto.subtle.digest.bind(crypto.subtle);
async function sha256(bytes) {
  const hash=new Uint8Array(await digest('SHA-256',bytes));
  return Array.from(hash,byte=>byte.toString(16).padStart(2,'0')).join('');
}
const limit=sourceLimits.linkedBytes,limitText=`Linked payload exceeds ${(limit/1048576).toFixed(1)} MiB`;
export async function prepareAuthoredModule(message) {
  message=snapshotRecord(message);
  let moduleSource,assets,images,admission=freeze({kind:'legacy'});
  if(Object.hasOwn(message,'linked')) {
    if(['moduleSource','assets','linkedVersion','artifactVersion','sourceVersion','assetSetHash'].some(key=>Object.hasOwn(message,key))) throw Error('Ambiguous linked module initialization');
    if(new TextEncoder().encode(JSON.stringify(message.linked)).byteLength>limit) throw Error(limitText);
    const linked=await verifyLinked(message.linked,sha256);
    if(new TextEncoder().encode(JSON.stringify(linked)).byteLength>limit) throw Error(limitText);
    const sourceAssets=linked.linkedVersion>=2 ? (await verifyDerivedAssets(linked.assets,linked.assetSetHash,sha256)).sourceAssets : {};
    assets=createReadonlyAssetMap(sourceAssets);
    images=createReadonlyImageMap(sourceAssets);
    moduleSource=linked.code;
    if(linked.linkedVersion===6){
      const storyCapability=normalizeStoryCapability(linked.storyCapability),story=message.story==null?null:validateStoryAgainstCapability(message.story,storyCapability);
      const storyHash=story?await sha256(new TextEncoder().encode(canonicalSceneStoryJson(story))):null;
      if(message.storyHash!==storyHash)throw Error('Story definition hash mismatch');
      admission=freeze({kind:'story',sdkVersion:linked.sdkVersion,storyCapability,storyCapabilityHash:linked.storyCapabilityHash,story,storyHash,controls:linked.controls,controlSchemaHash:linked.controlSchemaHash});
    }else if(linked.linkedVersion===5){
      const composition=normalizeImageCompositionProfile(linked.composition);
      admission=freeze({kind:'composition',sdkVersion:linked.sdkVersion,executionModel:linked.executionModel,composition,compositionHash:linked.compositionHash,controls:linked.controls,controlSchemaHash:linked.controlSchemaHash});
    }else if(linked.linkedVersion===4){
      const component=validateSingleImageProfile(linked.component);
      admission=freeze({kind:'component',sdkVersion:linked.sdkVersion,executionModel:linked.executionModel,component,componentMetadataHash:linked.componentMetadataHash,controls:linked.controls,controlSchemaHash:linked.controlSchemaHash});
    }else admission=freeze({kind:'visual',sdkVersion:linked.linkedVersion===3?'0.2.0':'0.1.0'});
  } else {
    if(message.sdkVersion==='0.3.0'||message.sdkVersion==='0.4.0')throw Error('Components require verified linked envelope');
    // Existing v1 installed/render-host readers send only moduleSource. Never
    // accept an asset-bearing message through this compatibility branch.
    if(['assets','linkedVersion','artifactVersion','sourceVersion','assetSetHash'].some(key=>Object.hasOwn(message,key))) throw Error('Assets require a verified linked envelope');
    moduleSource=message.moduleSource;
    if(typeof moduleSource!=='string' || new TextEncoder().encode(moduleSource).byteLength>limit) throw Error('Invalid linked module');
    assets=createReadonlyAssetMap({});
    images=createReadonlyImageMap({});
  }
  let imported=false;
  return freeze({admission,async import(importModule){
    if(imported)throw Error('Prepared module already imported');imported=true;
    return {module:await importModule(moduleSource),assets,images};
  }});
}

export async function loadAuthoredModule(message,importModule){return (await prepareAuthoredModule(message)).import(importModule);}

/** Complete pristine per-visual admission. Shared module imports happen later. */
export async function prepareAuthoredGenerationFactories(message,ports){
 const {identity:rawIdentity,capsule}=message??{},identity=rawIdentity&&freeze({...rawIdentity}),prepared=await verifyStoryGenerationPreparation({manifest:message?.manifest,initialVisualStates:message?.initialVisualStates},capsule),{manifest,initialVisualStates}=prepared;
 if(!identity||!capsule||identity.capsuleHash!==capsule.capsuleHash||identity.scheduleHash!==manifest.scheduleHash||identity.generation<1)throw new RuntimeError('Invalid authored generation identity');
 if(!Array.isArray(capsule.visuals)||!Array.isArray(manifest.visuals)||capsule.visuals.length!==manifest.visuals.length||capsule.visuals.length!==initialVisualStates.length)throw new RuntimeError('Authored generation visual sets differ');
 const states=new RuntimeMap();for(let index=0;index<initialVisualStates.length;index++){const state=initialVisualStates[index];if(!state||typeof state.visualId!=='string'||mapGet(states,state.visualId))throw new RuntimeError('Invalid authored generation initial state');mapSet(states,state.visualId,state);}
 const visuals=new RuntimeMap();
 for(let index=0;index<capsule.visuals.length;index++){
  const linked=capsule.visuals[index],bound=manifest.visuals[index],initial=mapGet(states,linked.id);
  if(!bound||bound.visualId!==linked.id||bound.entry!==linked.entry||bound.sourceHash!==linked.sourceHash||bound.bundleHash!==linked.bundleHash||bound.controlSchemaHash!==linked.controlSchemaHash||bound.assetSetHash!==linked.assetSetHash||bound.storyCapabilityHash!==(linked.artifactVersion===6?linked.storyCapabilityHash:null)||!initial||initial.sdkVersion!=='0.2.0'||initial.controlSchemaHash!==linked.controlSchemaHash||canonicalControlSchemaJson(initial.controlSchema)!==canonicalControlSchemaJson(linked.controls))throw new RuntimeError(`Authored generation identity mismatch for ${linked.id}`);
  let entryCodeHash;for(let fileIndex=0;fileIndex<capsule.files.length;fileIndex++)if(capsule.files[fileIndex].path===linked.entry){entryCodeHash=capsule.files[fileIndex].codeHash;break;}
  if(bound.entryCodeHash!==entryCodeHash)throw new RuntimeError(`Authored generation entry mismatch for ${linked.id}`);
  const admission=linked.artifactVersion===6?freeze({kind:'story',sdkVersion:'0.2.0',storyCapability:linked.storyCapability,storyCapabilityHash:linked.storyCapabilityHash,controls:linked.controls,controlSchemaHash:linked.controlSchemaHash}):freeze({kind:'visual',sdkVersion:'0.2.0',controls:linked.controls,controlSchemaHash:linked.controlSchemaHash});
  const controls=await prepareWorkerVisualControlFactory(initial,admission);mapSet(visuals,linked.id,freeze({visualId:linked.id,admission,controls}));
 }
 const assets=await prepareStoryAssetLeaseFactory({identity,capsule,broker:ports?.broker,decoder:ports?.decoder,...(ports?.requestId?{requestId:ports.requestId}:{})});
 return freeze({preparation:prepared,visual(id){const result=mapGet(visuals,id);if(!result)throw new RuntimeError('Unknown authored generation visual');return result;},assets,
  status(){return freeze({identity,assetResources:assets.status()});},dispose(){return assets.dispose();}});
}
