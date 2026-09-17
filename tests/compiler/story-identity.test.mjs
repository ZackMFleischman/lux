import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deriveAssets} from '../../packages/assets/src/index.mjs';
import {normalizeControlDeclarations,canonicalControlSchemaJson} from '../../packages/runtime-contracts/src/parameters.mjs';
import {normalizeStoryCapabilityDeclaration,canonicalStoryCapabilityJson} from '../../packages/runtime-contracts/src/story.mjs';
import {compiledArtifactSchema} from '../../packages/runtime-contracts/src/index.ts';
import {artifactBody,linkedBody,verifyArtifact,verifyLinked} from '../../apps/build-worker/src/artifact-identity.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const controls=normalizeControlDeclarations({brightness:{type:'number',label:'Brightness',default:1,min:0,max:2}});
const storyCapability=normalizeStoryCapabilityDeclaration({version:1,beats:{arrival:{kind:'timed',seek:'direct'},orbit:{kind:'sustained',seek:'none'}}});
const fields={controls,controlSchemaHash:hash(canonicalControlSchemaJson(controls)),storyCapability,storyCapabilityHash:hash(canonicalStoryCapabilityJson(storyCapability))};
const assets=await deriveAssets({},hash);
const linker={version:'0.28.2',implementationHash:'b'.repeat(64),apiHash:'c'.repeat(64),binaryHash:'d'.repeat(64)};
const sign=body=>({...body,bundleHash:hash(JSON.stringify(body))});
const linkSign=body=>({...body,linkedHash:hash(JSON.stringify(body))});

test('v6 artifact and linked identities bind the normalized Story capability',async()=>{
 const body=artifactBody({artifactVersion:6,sourceHash:'a'.repeat(64),entry:'main.js',modules:{'main.js':'','__lux/sdk.js':'','__lux/parameters.js':'','__lux/story.js':''},sourceMaps:{},sdkVersion:'0.2.0',compilerVersion:'7.0.2',dependencyHashes:{},...assets,...fields});
 const artifact=sign(body);
 assert.equal(compiledArtifactSchema.safeParse(artifact).success,true);
 assert.equal(compiledArtifactSchema.safeParse({...artifact,storyCapability:{version:1,beats:[{id:'bad id',kind:'sustained',seek:'none'}]}}).success,false);
 assert.equal(compiledArtifactSchema.safeParse({...artifact,storyCapability:{version:1,beats:[storyCapability.beats[0],storyCapability.beats[0]]}}).success,false);
 assert.deepEqual(await verifyArtifact(artifact,hash),artifact);
 const linkedBodyValue=linkedBody({linkedVersion:6,sdkVersion:'0.2.0',code:'export default {};',sourceMap:'',bundleHash:artifact.bundleHash,linker,...assets,...fields});
 const linked=linkSign(linkedBodyValue);
 assert.deepEqual(await verifyLinked(linked,hash,artifact),linked);
 let getterCalls=0;const hostile={version:1};Object.defineProperty(hostile,'beats',{enumerable:true,get(){getterCalls++;return storyCapability.beats;}});
 await assert.rejects(verifyArtifact({...artifact,storyCapability:hostile},hash));assert.equal(getterCalls,0);
 for(const patch of [{artifactVersion:3},{sdkVersion:'0.3.0'},{storyCapabilityHash:'0'.repeat(64)},{storyCapability:{version:1,beats:[{id:'arrival',kind:'sustained',seek:'none'}]}},{extra:true}]) {
  await assert.rejects(verifyArtifact({...artifact,...patch},hash));
 }
 for(const patch of [{linkedVersion:3},{sdkVersion:'0.3.0'},{storyCapabilityHash:'0'.repeat(64)},{storyCapability:{version:1,beats:[{id:'arrival',kind:'sustained',seek:'none'}]}},{extra:true}]) {
  await assert.rejects(verifyLinked({...linked,...patch},hash,artifact));
 }
});
