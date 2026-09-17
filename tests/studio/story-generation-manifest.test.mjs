import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deriveAssets} from '../../packages/assets/src/index.mjs';
import {canonicalControlSchemaJson} from '../../packages/runtime-contracts/src/parameters.mjs';
import {canonicalStoryCapabilityJson} from '../../packages/runtime-contracts/src/story.mjs';
import {sceneSourceHash} from '../../packages/core/src/scene-document.ts';
import {sharedVisualsBody} from '../../apps/build-worker/src/shared-link-identity.mjs';
import {prepareStoryGenerationManifest,verifyStoryGenerationPreparation} from '../../apps/studio/src/story/story-generation-manifest.mjs';
import {prepareAuthoredGenerationFactories} from '../../apps/studio/src/authored-worker-assets.mjs';
import {decodeStoryAssets} from '../../apps/studio/src/assets/story-asset-decoder-worker.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const linker={version:'0.28.2',implementationHash:'1'.repeat(64),apiHash:'2'.repeat(64),binaryHash:'3'.repeat(64)};
const dependencies={'three/core':'a'.repeat(64),'three/tsl':'b'.repeat(64),'three/webgpu':'c'.repeat(64)};
const oldSchema=[{id:'gain',type:'number',label:'Gain',default:2,min:0,max:10,step:1,changeCost:'live'}];
const nextSchema=[{id:'gain',type:'number',label:'Gain',default:2,min:0,max:5,step:1,changeCost:'live'},{id:'visible',type:'boolean',label:'Visible',default:true,changeCost:'live'}];
const capability={version:1,beats:[{id:'pulse',kind:'timed',seek:'direct'}]};
const source=id=>({sourceVersion:2,sdkVersion:'0.2.0',entry:'visual.ts',files:{'visual.ts':`export default ${JSON.stringify(id)}`},assets:{}});
const story={version:2,normalVisualId:'ambient',crossfadeSeconds:.5,beats:[{id:'pulse',label:'Pulse',timing:{kind:'timed',durationSeconds:2},visualId:'lead'}],sequence:[{id:'pulse-1',beatId:'pulse',visualId:'lead',follow:{kind:'manual'}}]};
function deepFreeze(value){if(value&&typeof value==='object'){for(const key of Object.keys(value))deepFreeze(value[key]);Object.freeze(value);}return value;}
async function fixture(){
 const assets=await deriveAssets({},hash),sources={ambient:source('ambient'),lead:source('lead')};
 const visualRows=[];for(const [index,id] of ['ambient','lead'].entries()){const schema=id==='lead'?nextSchema:[],version=id==='lead'?6:3;visualRows.push({id,entry:`v00${index}.js`,sourceHash:await sceneSourceHash(sources[id]),bundleHash:String(index+4).repeat(64),artifactVersion:version,sdkVersion:'0.2.0',controls:schema,controlSchemaHash:hash(canonicalControlSchemaJson(schema)),...assets,...(version===6?{storyCapability:capability,storyCapabilityHash:hash(canonicalStoryCapabilityJson(capability))}:{})});}
 const files=['runtime.js','v000.js','v001.js'].map(path=>({path,code:'export {};',sourceMap:'{}',codeHash:hash('export {};'),sourceMapHash:hash('{}'),imports:[]}));
 const body=sharedVisualsBody({kind:'lux-shared-visuals',version:1,linker,dependencyHashes:dependencies,runtimeEntry:'runtime.js',visuals:visualRows,files});
 const capsule=deepFreeze({...body,capsuleHash:hash(JSON.stringify(body))});
 const document={format:'lux-scene',version:7,visuals:[
  {id:'lead',source:sources.lead,controls:{sourceHash:'f'.repeat(64),schema:oldSchema,schemaHash:hash(canonicalControlSchemaJson(oldSchema)),values:{gain:8}},controlAnimations:[]},
  {id:'ambient',source:sources.ambient,controls:{sourceHash:'e'.repeat(64),schema:[],schemaHash:hash('[]'),values:{}},controlAnimations:[]},
 ],settings:{width:640,height:360,fps:60,seed:0},tempo:{bpm:120},story};
 return {capsule,document};
}

test('Story manifest binds current capsule identity while migrating saved values outside schedule identity',async()=>{
 const {capsule,document}=await fixture(),prepared=await prepareStoryGenerationManifest(document,capsule);
 assert.deepEqual(prepared.manifest.visuals.map(row=>row.visualId),['ambient','lead']);
 assert.equal(prepared.manifest.capsuleHash,capsule.capsuleHash);assert.match(prepared.manifest.scheduleHash,/^[a-f0-9]{64}$/);
 assert.deepEqual(prepared.initialVisualStates.find(row=>row.visualId==='lead').controls,{gain:2,visible:true});
 assert.deepEqual(prepared.migrationIssues.map(row=>[row.visualId,row.id,row.reason]),[['lead','gain','out-of-range'],['lead','visible','added']]);
 const changed=structuredClone(document);changed.visuals[0].controls.values.gain=3;
 const next=await prepareStoryGenerationManifest(changed,capsule);assert.equal(next.manifest.scheduleHash,prepared.manifest.scheduleHash);assert.equal(next.initialVisualStates.find(row=>row.visualId==='lead').controls.gain,3);
});

test('Story manifest rejects current source or per-reference capability mismatch',async()=>{
 const {capsule,document}=await fixture(),changed=structuredClone(document);changed.visuals[0].source.files['visual.ts']='export default "changed"';
 await assert.rejects(prepareStoryGenerationManifest(changed,capsule),/source identity/i);
 const unsupported=structuredClone(document);unsupported.story.beats[0].id='other';unsupported.story.sequence[0].beatId='other';
 await assert.rejects(prepareStoryGenerationManifest(unsupported,capsule),/capability|other/i);
});

test('authored generation prepares stable per-visual control factories before module import',async()=>{
 const {capsule,document}=await fixture(),prepared=await prepareStoryGenerationManifest(document,capsule);
 const identity=Object.freeze({instanceId:'generation-test',generation:1,scheduleHash:prepared.manifest.scheduleHash,capsuleHash:capsule.capsuleHash});let grant=0,staging;
 const broker=async request=>{
  const base={requestId:request.requestId,identity};
  if(request.kind==='story-asset-staging-reserve'){staging={grantId:`grant-${++grant}`,...request};return {...base,kind:'story-asset-staging-granted',grantId:staging.grantId,visualId:request.visualId,assetSetHash:request.assetSetHash,decoderVersion:request.decoderVersion,charge:request.charge};}
  if(request.kind==='story-asset-decode-authorize')return {...base,...request,kind:'story-asset-decode-authorized'};
  if(request.kind==='story-asset-staging-release'){staging=undefined;return{...base,kind:'story-asset-staging-released',grantId:request.grantId,disposition:request.disposition};}
  throw Error('unexpected broker request');
 };
 const cloned=structuredClone({manifest:prepared.manifest,initialVisualStates:prepared.initialVisualStates}),generation=await prepareAuthoredGenerationFactories({identity,capsule,...cloned},{broker,decoder:decodeStoryAssets,requestId:(()=>{let id=0;return()=>`generation-${++id}`;})()});
 assert.equal(staging,undefined);assert.equal(generation.visual('lead'),generation.visual('lead'));assert.throws(()=>generation.visual('missing'),/unknown/i);
 assert.ok(Object.isFrozen(generation.preparation.manifest));assert.ok(Object.isFrozen(generation.preparation.initialVisualStates));
 const lead=generation.visual('lead'),slot=lead.controls.createSlot();assert.deepEqual(slot.state().controls,{gain:2,visible:true});
 assert.deepEqual(generation.status().assetResources,{closed:false,leaseCount:0,backingEntries:0,assetLeaseBytes:0,pendingStagingJobs:0,assetStagingBytes:0});await generation.dispose();
});

test('worker re-admits cloned generation identity and rejects host hash or snapshot mutation',async()=>{
 const {capsule,document}=await fixture(),prepared=await prepareStoryGenerationManifest(document,capsule),cloned=structuredClone({manifest:prepared.manifest,initialVisualStates:prepared.initialVisualStates});
 const admitted=await verifyStoryGenerationPreparation(cloned,capsule);assert.ok(Object.isFrozen(admitted.manifest));assert.ok(Object.isFrozen(admitted.initialVisualStates[0]));
 const reordered=structuredClone(cloned),row=reordered.manifest.visuals[0];reordered.manifest.visuals[0]={assetSetHash:row.assetSetHash,visualId:row.visualId,entry:row.entry,entryCodeHash:row.entryCodeHash,sourceHash:row.sourceHash,bundleHash:row.bundleHash,controlSchemaHash:row.controlSchemaHash,storyCapabilityHash:row.storyCapabilityHash};
 await verifyStoryGenerationPreparation(reordered,capsule);
 for(const mutate of [value=>{value.manifest.storyHash='0'.repeat(64);},value=>{value.manifest.visuals[0].assetSetHash='0'.repeat(64);},value=>{value.initialVisualStates[0].controlSequence=-1;}]){
  const changed=structuredClone(cloned);mutate(changed);await assert.rejects(verifyStoryGenerationPreparation(changed,capsule),/Story|state|identity|hash/i);
 }
});
