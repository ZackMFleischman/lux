import {verifyStorySceneDocumentV7} from '../../../../packages/core/src/story-scene-v2.ts';
import {sceneSourceHash} from '../../../../packages/core/src/scene-document.ts';
import {canonicalSceneStoryV2Json,normalizeSceneStoryV2,storyLifecycleLimits,validateStoryV2Capabilities} from '../../../../packages/runtime-contracts/src/story.mjs';
import {canonicalControlSchemaJson,normalizeControlSchema,reconcileControlValues,validateControlSnapshot} from '../../../../packages/runtime-contracts/src/parameters.mjs';
import {validateControlAnimationBindings} from '../../../../packages/runtime-contracts/src/control-animation.mjs';
import {snapshotRecord} from '../../../build-worker/src/source-policy.mjs';

const freeze=Object.freeze,RuntimeError=Error,encoder=new TextEncoder(),hashPattern=/^[a-f0-9]{64}$/;
const digest=crypto.subtle.digest.bind(crypto.subtle);
async function sha256(text){const value=new Uint8Array(await digest('SHA-256',encoder.encode(text)));return Array.from(value,byte=>byte.toString(16).padStart(2,'0')).join('');}
function deepFreeze(value){if(value&&typeof value==='object'){for(const key of Object.keys(value))deepFreeze(value[key]);freeze(value);}return value;}
function fail(message){throw new RuntimeError(message);}
function sorted(values){return [...values].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);}
function exact(value,fields,label){const row=snapshotRecord(value);if(Object.keys(row).length!==fields.length||fields.some(key=>!Object.hasOwn(row,key)))fail(`Invalid ${label}`);return row;}
function dense(input,label){if(!Array.isArray(input)||Reflect.ownKeys(input).length!==input.length+1)fail(`Invalid ${label}`);const result=[];for(let index=0;index<input.length;index++){const descriptor=Object.getOwnPropertyDescriptor(input,String(index));if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))fail(`Invalid ${label}`);result.push(descriptor.value);}return result;}

export function canonicalStoryScheduleJson(input){
 return JSON.stringify({version:1,story:input.story,capsuleHash:input.capsuleHash,visuals:input.visuals});
}

/**
 * Joins a verified Scene v7 document to a separately verified shared capsule.
 * The capsule must be an immutable full or structural shared-capsule admission.
 * Asset payload verification remains a separate brokered generation step. This
 * never treats the saved control cache's sourceHash as current compiled identity.
 */
export async function prepareStoryGenerationManifest(documentInput,capsule){
 const document=await verifyStorySceneDocumentV7(documentInput);
 if(!capsule||capsule.kind!=='lux-shared-visuals'||capsule.version!==1||typeof capsule.capsuleHash!=='string'||!Object.isFrozen(capsule))fail('Expected a verified immutable shared visual capsule');
 if(!Array.isArray(capsule.visuals)||capsule.visuals.length!==document.visuals.length)fail('Scene and shared capsule visual sets differ');
 const sourceRows=sorted(document.visuals),capsuleRows=sorted(capsule.visuals),files=capsule.files;
 const visuals=[],initialVisualStates=[],migrationIssues=[],capabilities=[];
 for(let index=0;index<sourceRows.length;index++){
  const source=sourceRows[index],linked=capsuleRows[index];
  if(source.id!==linked.id)fail('Scene and shared capsule visual sets differ');
  const currentSourceHash=await sceneSourceHash(source.source);
  if(currentSourceHash!==linked.sourceHash)fail(`Shared capsule source identity mismatch for ${source.id}`);
  let entryCodeHash;
  for(let fileIndex=0;fileIndex<files.length;fileIndex++)if(files[fileIndex].path===linked.entry){entryCodeHash=files[fileIndex].codeHash;break;}
  if(typeof entryCodeHash!=='string')fail(`Shared capsule entry is unavailable for ${source.id}`);
  const storyCapability=linked.artifactVersion===6?linked.storyCapability:null;
  capabilities.push(freeze({visualId:source.id,storyCapability}));
  const migrated=reconcileControlValues(source.controls.schema,source.controls.values,linked.controls);
  for(let issueIndex=0;issueIndex<migrated.changes.length;issueIndex++)migrationIssues.push(freeze({visualId:source.id,...migrated.changes[issueIndex]}));
  visuals.push(freeze({visualId:source.id,entry:linked.entry,entryCodeHash,sourceHash:linked.sourceHash,bundleHash:linked.bundleHash,
   controlSchemaHash:linked.controlSchemaHash,storyCapabilityHash:linked.artifactVersion===6?linked.storyCapabilityHash:null,assetSetHash:linked.assetSetHash}));
  initialVisualStates.push(freeze({visualId:source.id,sdkVersion:'0.2.0',controlSchema:linked.controls,controlSchemaHash:linked.controlSchemaHash,
   controls:migrated.values,controlSequence:0,controlAnimations:source.controlAnimations,animationSequence:0}));
 }
 validateStoryV2Capabilities(document.story,capabilities);
 const story=deepFreeze(JSON.parse(canonicalSceneStoryV2Json(document.story))),storyHash=await sha256(canonicalSceneStoryV2Json(story));
 const scheduleBody=deepFreeze({version:1,story,capsuleHash:capsule.capsuleHash,visuals:freeze(visuals)});
 const scheduleHash=await sha256(canonicalStoryScheduleJson(scheduleBody));
 const manifest=deepFreeze({...scheduleBody,storyHash,scheduleHash});
 const prepared=deepFreeze({manifest,initialVisualStates:freeze(initialVisualStates),migrationIssues:freeze(migrationIssues)});
 if(encoder.encode(JSON.stringify(prepared)).byteLength>storyLifecycleLimits.scheduleMetadataBytes)fail('Story generation schedule metadata exceeds 1 MiB');
 return prepared;
}

/** Re-admit the structured-cloned host preparation in the pristine worker. */
export async function verifyStoryGenerationPreparation(input,capsule){
 const raw=exact(input,['manifest','initialVisualStates'],'Story generation preparation'),manifestRaw=exact(raw.manifest,['version','story','storyHash','capsuleHash','scheduleHash','visuals'],'Story generation manifest');
 if(!capsule||capsule.kind!=='lux-shared-visuals'||capsule.version!==1||!Object.isFrozen(capsule)||manifestRaw.version!==1||manifestRaw.capsuleHash!==capsule.capsuleHash||typeof manifestRaw.storyHash!=='string'||!hashPattern.test(manifestRaw.storyHash)||typeof manifestRaw.scheduleHash!=='string'||!hashPattern.test(manifestRaw.scheduleHash))fail('Invalid Story generation identity');
 const story=normalizeSceneStoryV2(manifestRaw.story),storyJson=canonicalSceneStoryV2Json(story);if(await sha256(storyJson)!==manifestRaw.storyHash)fail('Story generation Story hash mismatch');
 const visualRows=dense(manifestRaw.visuals,'Story generation visuals'),visuals=[],capabilities=[];
 if(visualRows.length!==capsule.visuals.length)fail('Story generation visual sets differ');
 for(let index=0;index<visualRows.length;index++){
  const linked=capsule.visuals[index],row=exact(visualRows[index],['visualId','entry','entryCodeHash','sourceHash','bundleHash','controlSchemaHash','storyCapabilityHash','assetSetHash'],'Story generation visual');let entryCodeHash;
  for(let fileIndex=0;fileIndex<capsule.files.length;fileIndex++)if(capsule.files[fileIndex].path===linked.entry){entryCodeHash=capsule.files[fileIndex].codeHash;break;}
  const expected={visualId:linked.id,entry:linked.entry,entryCodeHash,sourceHash:linked.sourceHash,bundleHash:linked.bundleHash,controlSchemaHash:linked.controlSchemaHash,storyCapabilityHash:linked.artifactVersion===6?linked.storyCapabilityHash:null,assetSetHash:linked.assetSetHash};
  for(const key of Object.keys(expected))if(row[key]!==expected[key])fail(`Story generation identity mismatch for ${linked.id}`);
  visuals.push(freeze(expected));capabilities.push(freeze({visualId:linked.id,storyCapability:linked.artifactVersion===6?linked.storyCapability:null}));
 }
 validateStoryV2Capabilities(story,capabilities);
 const scheduleBody=deepFreeze({version:1,story,capsuleHash:capsule.capsuleHash,visuals:freeze(visuals)}),scheduleHash=await sha256(canonicalStoryScheduleJson(scheduleBody));
 if(scheduleHash!==manifestRaw.scheduleHash)fail('Story generation schedule hash mismatch');
 const stateRows=dense(raw.initialVisualStates,'Story initial visual states'),initialVisualStates=[];if(stateRows.length!==capsule.visuals.length)fail('Story initial visual sets differ');
 for(let index=0;index<stateRows.length;index++){
  const linked=capsule.visuals[index],state=exact(stateRows[index],['visualId','sdkVersion','controlSchema','controlSchemaHash','controls','controlSequence','controlAnimations','animationSequence'],'Story initial visual state');
  const controlSchema=normalizeControlSchema(state.controlSchema);if(state.visualId!==linked.id||state.sdkVersion!=='0.2.0'||state.controlSchemaHash!==linked.controlSchemaHash||canonicalControlSchemaJson(controlSchema)!==canonicalControlSchemaJson(linked.controls)||!Number.isSafeInteger(state.controlSequence)||state.controlSequence<0||!Number.isSafeInteger(state.animationSequence)||state.animationSequence<0)fail(`Invalid Story initial state for ${linked.id}`);
  const controls=validateControlSnapshot(controlSchema,state.controls),controlAnimations=validateControlAnimationBindings(state.controlAnimations);
  initialVisualStates.push(deepFreeze({visualId:linked.id,sdkVersion:'0.2.0',controlSchema,controlSchemaHash:linked.controlSchemaHash,controls,controlSequence:state.controlSequence,controlAnimations,animationSequence:state.animationSequence}));
 }
 const manifest=deepFreeze({...scheduleBody,storyHash:manifestRaw.storyHash,scheduleHash}),prepared=deepFreeze({manifest,initialVisualStates:freeze(initialVisualStates)});
 if(encoder.encode(JSON.stringify(prepared)).byteLength>storyLifecycleLimits.scheduleMetadataBytes)fail('Story generation schedule metadata exceeds 1 MiB');return prepared;
}
