import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStoryCapabilityDeclaration, normalizeStoryCapability, canonicalStoryCapabilityJson,
  normalizeSceneStory, canonicalSceneStoryJson, validateStoryAgainstCapability,
} from '../../packages/runtime-contracts/src/story.mjs';

const capabilityDeclaration = () => ({version:1,beats:{
  arrival:{kind:'timed',seek:'direct'},
  orbit:{kind:'sustained',seek:'none'},
}});
const story = () => ({version:1,beats:[
  {id:'arrival',label:' Arrival ',timing:{kind:'timed',durationSeconds:4}},
  {id:'orbit',label:'Orbit',timing:{kind:'sustained'}},
],sequence:[
  {id:'opening',beatId:'arrival',follow:{kind:'after',seconds:5}},
  {id:'orbit.first',beatId:'orbit',follow:{kind:'manual'}},
  {id:'orbit.return',beatId:'orbit',follow:{kind:'after',seconds:8}},
]});

test('source capability normalizes ordered literal beat identities and canonical bytes',()=>{
 const capability=normalizeStoryCapabilityDeclaration(capabilityDeclaration());
 assert.deepEqual(capability,{version:1,beats:[
  {id:'arrival',kind:'timed',seek:'direct'},
  {id:'orbit',kind:'sustained',seek:'none'},
 ]});
 assert.deepEqual(normalizeStoryCapability(capability),capability);
 assert.equal(canonicalStoryCapabilityJson(capability),'{"version":1,"beats":[{"id":"arrival","kind":"timed","seek":"direct"},{"id":"orbit","kind":"sustained","seek":"none"}]}');
 assert.throws(()=>{capability.beats[0].id='changed';},TypeError);
});

test('scene Story preserves repeated occurrences and keeps timing separate from dwell',()=>{
 const normalized=normalizeSceneStory(story());
 assert.deepEqual(normalized,{version:1,beats:[
  {id:'arrival',label:'Arrival',timing:{kind:'timed',durationSeconds:4}},
  {id:'orbit',label:'Orbit',timing:{kind:'sustained'}},
 ],sequence:[
  {id:'opening',beatId:'arrival',follow:{kind:'after',seconds:5}},
  {id:'orbit.first',beatId:'orbit',follow:{kind:'manual'}},
  {id:'orbit.return',beatId:'orbit',follow:{kind:'after',seconds:8}},
 ]});
 assert.equal(canonicalSceneStoryJson(normalized),JSON.stringify(normalized));
 assert.deepEqual(validateStoryAgainstCapability(normalized,normalizeStoryCapabilityDeclaration(capabilityDeclaration())),normalized);
 assert.deepEqual(normalizeSceneStory({...story(),sequence:[]}).sequence,[]);
});

test('Story admission rejects invalid IDs, duplicate identities, references, timing and dwell',()=>{
 const mutate=change=>{const value=structuredClone(story());change(value);return value;};
 for(const value of [
  mutate(value=>{value.beats[0].id=' arrival';}),
  mutate(value=>{value.beats[1].id='arrival';}),
  mutate(value=>{value.sequence[1].id='opening';}),
  mutate(value=>{value.sequence[0].beatId='missing';}),
  mutate(value=>{value.beats[0].timing.durationSeconds=0;}),
  mutate(value=>{value.beats[0].timing.durationSeconds=Infinity;}),
  mutate(value=>{value.sequence[0].follow.seconds=0;}),
  mutate(value=>{value.sequence[0].follow.seconds=NaN;}),
  mutate(value=>{value.beats[0].extra=true;}),
  mutate(value=>{value.sequence[0].follow.extra=true;}),
 ]) assert.throws(()=>normalizeSceneStory(value));
 const tooMany=story();tooMany.sequence=Array.from({length:1025},(_,index)=>({id:`row.${index}`,beatId:'orbit',follow:{kind:'manual'}}));
 assert.throws(()=>normalizeSceneStory(tooMany),/1,024|1024|occurrence/i);
});

test('capability admission rejects mismatched kinds, undeclared beats and hostile records without invoking accessors',()=>{
 const capability=normalizeStoryCapabilityDeclaration(capabilityDeclaration());
 assert.throws(()=>validateStoryAgainstCapability({...story(),beats:[...story().beats,{id:'extra',label:'Extra',timing:{kind:'sustained'}}]},capability),/capability|extra/i);
 assert.throws(()=>validateStoryAgainstCapability({...story(),beats:[{id:'arrival',label:'Arrival',timing:{kind:'sustained'}},story().beats[1]]},capability),/timing|arrival/i);
 for(const declaration of [
  {version:1,beats:{}},
  {version:1,beats:{arrival:{kind:'timed',seek:'none'}}},
  {version:1,beats:{arrival:{kind:'sustained',seek:'direct'}}},
  {version:1,beats:{arrival:{kind:'timed',seek:'direct',extra:true}}},
 ]) assert.throws(()=>normalizeStoryCapabilityDeclaration(declaration));
 let calls=0;
 const getter={version:1,get beats(){calls++;return capabilityDeclaration().beats;}};
 assert.throws(()=>normalizeStoryCapabilityDeclaration(getter));
 const raw=story();Object.defineProperty(raw.beats[0],'label',{enumerable:true,get(){calls++;return 'Arrival';}});
 assert.throws(()=>normalizeSceneStory(raw));
 assert.equal(calls,0);
});
