import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {compileVisual} from '../../apps/build-worker/src/compile.mjs';
import {linkRuntime} from '../../apps/build-worker/src/link-runtime.mjs';
import {canonicalStoryCapabilityJson} from '../../packages/runtime-contracts/src/story.mjs';

const dependencyRoot=process.env.LUX_COMPILER_DEPENDENCIES||resolve('node_modules');
const hash=value=>createHash('sha256').update(value).digest('hex');
const source=story=>`import {defineVisual} from '@lux/visual-sdk';
export default defineVisual({controls:{brightness:{type:'number',label:'Brightness',default:1,min:0,max:2}},${story?`story:${story},`:''}
async create(){return {update(frame){void frame.story;},render(){},reset(){},dispose(){}}}});`;
const request=text=>({source:{sdkVersion:'0.2.0',entry:'main.ts',files:{'main.ts':text}}});

test('SDK0.2 Story source compiles and links as explicit v6 while legacy source remains v3',async()=>{
 const result=await compileVisual(request(source(`{version:1,beats:{arrival:{kind:'timed',seek:'direct'},orbit:{kind:'sustained',seek:'none'}}}`)),{dependencyRoot});
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(result.artifact.artifactVersion,6);
 assert.equal(result.artifact.sdkVersion,'0.2.0');
 assert.deepEqual(result.artifact.storyCapability,{version:1,beats:[{id:'arrival',kind:'timed',seek:'direct'},{id:'orbit',kind:'sustained',seek:'none'}]});
 assert.equal(result.artifact.storyCapabilityHash,hash(canonicalStoryCapabilityJson(result.artifact.storyCapability)));
 assert.ok(result.artifact.modules['__lux/story.js']);
 assert.ok(result.artifact.dependencyHashes['contracts/story.mjs']);
 assert.ok(result.artifact.dependencyHashes['contracts/story.d.mts']);
 assert.ok(result.artifact.dependencyHashes['compiler/story-declarations.mjs']);
 const linked=await linkRuntime(result.artifact,{dependencyRoot});
 assert.equal(linked.linkedVersion,6);
 assert.equal(linked.sdkVersion,'0.2.0');
 assert.deepEqual(linked.storyCapability,result.artifact.storyCapability);
 assert.equal(linked.storyCapabilityHash,result.artifact.storyCapabilityHash);
 const legacy=await compileVisual(request(source(null)),{dependencyRoot});
 assert.equal(legacy.ok,true,JSON.stringify(legacy));
 assert.equal(legacy.artifact.artifactVersion,3);
});
