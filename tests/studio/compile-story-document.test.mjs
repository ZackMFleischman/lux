import test from 'node:test';
import assert from 'node:assert/strict';
import {compileStoryDocument} from '../../scripts/studio-compile-story.mjs';
import {createHash} from 'node:crypto';

const hash=text=>createHash('sha256').update(text).digest('hex');
function document(){return {format:'lux-scene',version:7,visuals:['first','second'].map(id=>({id,source:{sdkVersion:'0.2.0',entry:'visual.ts',files:{'visual.ts':`// ${id} 🌌`}},controls:{sourceHash:'a'.repeat(64),schema:[],schemaHash:hash('[]'),values:{}},controlAnimations:[]})),settings:{width:640,height:360,fps:60,seed:0},tempo:{bpm:120},story:{version:2,normalVisualId:'first',crossfadeSeconds:.35,beats:[{id:'hold',label:'Hold',timing:{kind:'sustained'},visualId:'second'}],sequence:[]}};}

test('complete Story compilation preserves each source identity and links once after every compile succeeds',async()=>{
 const compiled=[],linked=[],capsule={capsuleHash:'c'.repeat(64)};
 const result=await compileStoryDocument(document(),{compile:async({source})=>{compiled.push(source);return {ok:true,artifact:{sourceHash:hash(JSON.stringify(source))}};},link:async rows=>{linked.push(rows);return capsule;}});
 assert.deepEqual(result,{ok:true,capsule});assert.equal(compiled.length,2);assert.equal(linked.length,1);
 assert.deepEqual(linked[0].map(row=>row.id),['first','second']);
 assert.equal(linked[0][0].artifact.sourceHash,hash(JSON.stringify(compiled[0])));
 assert.match(compiled[1].files['visual.ts'],/second 🌌/);
});

test('a failed source prevents linking and diagnostics identify that visual',async()=>{
 let count=0,linked=false;
 const result=await compileStoryDocument(document(),{compile:async()=>++count===1?{ok:true,artifact:{}}:{ok:false,code:'COMPILE_FAILED',diagnostics:[{code:'TS1005',message:'Expected expression',path:'visual.ts',line:2}]},link:async()=>{linked=true;}});
 assert.equal(result.ok,false);assert.equal(linked,false);assert.equal(result.visualId,'second');
 assert.equal(result.diagnostics[0].visualId,'second');assert.equal(result.diagnostics[0].message,'Expected expression');
});

test('invalid whole documents never start compiler jobs',async()=>{
 const value=document();value.story.normalVisualId='missing';let count=0;
 await assert.rejects(compileStoryDocument(value,{compile:async()=>{count++;},link:async()=>{count++;}}));assert.equal(count,0);
});
