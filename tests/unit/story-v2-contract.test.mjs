import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSceneStoryV2, canonicalSceneStoryV2Json, validateStoryV2Capabilities,
} from '../../packages/runtime-contracts/src/story.mjs';

const story=()=>({version:2,normalVisualId:'ambient',crossfadeSeconds:0,beats:[
  {id:'arrival',label:' Arrival ',timing:{kind:'timed',durationSeconds:4},visualId:'lead'},
  {id:'orbit',label:'Orbit',timing:{kind:'sustained'},visualId:'ambient'},
],sequence:[
  {id:'opening',beatId:'arrival',follow:{kind:'after',seconds:5},visualId:'alternate'},
  {id:'orbit.first',beatId:'orbit',follow:{kind:'manual'},visualId:'ambient'},
  {id:'orbit.return',beatId:'orbit',follow:{kind:'after',seconds:8},visualId:'alternate'},
]});
const capability=(...beats)=>({version:1,beats});
const rows=()=>[
  {visualId:'ambient',storyCapability:capability({id:'orbit',kind:'sustained',seek:'none'})},
  {visualId:'lead',storyCapability:capability({id:'arrival',kind:'timed',seek:'direct'})},
  {visualId:'alternate',storyCapability:capability(
    {id:'arrival',kind:'timed',seek:'direct'},
    {id:'orbit',kind:'sustained',seek:'none'},
  )},
  {visualId:'normal-only',storyCapability:null},
];

test('Story v2 normalizes visual references, zero crossfade and canonical bytes',()=>{
 const normalized=normalizeSceneStoryV2(story());
 assert.deepEqual(normalized,{version:2,normalVisualId:'ambient',crossfadeSeconds:0,beats:[
  {id:'arrival',label:'Arrival',timing:{kind:'timed',durationSeconds:4},visualId:'lead'},
  {id:'orbit',label:'Orbit',timing:{kind:'sustained'},visualId:'ambient'},
 ],sequence:[
  {id:'opening',beatId:'arrival',follow:{kind:'after',seconds:5},visualId:'alternate'},
  {id:'orbit.first',beatId:'orbit',follow:{kind:'manual'},visualId:'ambient'},
  {id:'orbit.return',beatId:'orbit',follow:{kind:'after',seconds:8},visualId:'alternate'},
 ]});
 assert.equal(canonicalSceneStoryV2Json(normalized),JSON.stringify(normalized));
 assert.throws(()=>{normalized.beats[0].visualId='changed';},TypeError);
});

test('Story v2 validates beat and occurrence visual capabilities independently',()=>{
 assert.deepEqual(validateStoryV2Capabilities(story(),rows()),rows());
 const wrongBeat=rows();wrongBeat[1].storyCapability=capability({id:'arrival',kind:'sustained',seek:'none'});
 assert.throws(()=>validateStoryV2Capabilities(story(),wrongBeat),/lead|arrival|timing|capability/i);
 const wrongOccurrence=rows();wrongOccurrence[2].storyCapability=capability({id:'arrival',kind:'timed',seek:'direct'});
 assert.throws(()=>validateStoryV2Capabilities(story(),wrongOccurrence),/alternate|orbit|capability/i);
 const missing=rows().filter(row=>row.visualId!=='alternate');
 assert.throws(()=>validateStoryV2Capabilities(story(),missing),/alternate|visual/i);
});

test('Story v2 permits null capability only for unreferenced or normal-only visuals',()=>{
 const normalOnly={...story(),normalVisualId:'normal-only'};
 assert.deepEqual(validateStoryV2Capabilities(normalOnly,rows()),rows());
 const referenced=rows();referenced[2].storyCapability=null;
 assert.throws(()=>validateStoryV2Capabilities(story(),referenced),/alternate|capability/i);
});

test('Story v2 rejects malformed records without invoking accessors',()=>{
 const mutate=change=>{const value=structuredClone(story());change(value);return value;};
 for(const value of [
  mutate(value=>{value.crossfadeSeconds=-0.01;}),
  mutate(value=>{value.crossfadeSeconds=5.01;}),
  mutate(value=>{value.crossfadeSeconds=NaN;}),
  mutate(value=>{value.normalVisualId=' bad';}),
  mutate(value=>{value.beats[1].id='arrival';}),
  mutate(value=>{value.beats[0].visualId=' bad';}),
  mutate(value=>{value.sequence[0].beatId='missing';}),
  mutate(value=>{value.sequence[0].visualId=' bad';}),
  mutate(value=>{value.beats[0].extra=true;}),
 ]) assert.throws(()=>normalizeSceneStoryV2(value));
 let calls=0;const value=story();Object.defineProperty(value,'beats',{enumerable:true,get(){calls++;return [];}});
 assert.throws(()=>normalizeSceneStoryV2(value));
 const capabilityRows=rows();Object.defineProperty(capabilityRows[0],'storyCapability',{enumerable:true,get(){calls++;return null;}});
 assert.throws(()=>validateStoryV2Capabilities(story(),capabilityRows));
 assert.equal(calls,0);
});
