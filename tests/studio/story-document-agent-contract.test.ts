import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sourceBuildInputSchema,sourceReadResult,agentTransportLimits} from '../../apps/studio/src/source/agent-contract.ts';
import {createStorySceneDocumentV7} from '../../packages/core/src/story-scene-v2.ts';
import {createSourceWorkspace} from '../../apps/studio/src/source/workspace.ts';
import {createAuthoringSession} from '../../apps/studio/src/source/authoring-session.ts';
import {limits} from '../../apps/build-worker/src/source-policy.mjs';
import {storyLifecycleLimits} from '../../packages/runtime-contracts/src/story.mjs';

const source={sdkVersion:'0.2.0' as const,entry:'visual.ts',files:{'visual.ts':'export default {}'}};
const controls={sourceHash:createHash('sha256').update(JSON.stringify(source)).digest('hex'),schema:[] as const,schemaHash:createHash('sha256').update('[]').digest('hex'),values:{}};
const document=createStorySceneDocumentV7([{id:'ambient',source,controls,controlAnimations:[]}],{width:640,height:360,fps:60,seed:0},{bpm:120},{version:2,normalVisualId:'ambient',crossfadeSeconds:.35,beats:[{id:'ambient',label:'Ambient',timing:{kind:'sustained'},visualId:'ambient'}],sequence:[]});

test('MCP build accepts exactly one complete source or Scene v7 document',()=>{
 assert.deepEqual(sourceBuildInputSchema.parse({expectedDraftVersion:4,document}).document,document);
 assert.equal(sourceBuildInputSchema.safeParse({expectedDraftVersion:4}).success,false);
 assert.equal(sourceBuildInputSchema.safeParse({expectedDraftVersion:4,source,document}).success,false);
 assert.equal(sourceBuildInputSchema.safeParse({expectedDraftVersion:4,document,story:null}).success,false);
 assert.equal(sourceBuildInputSchema.safeParse({expectedDraftVersion:4,document,libraryLinks:[]}).success,false);
 assert.equal(sourceBuildInputSchema.safeParse({expectedDraftVersion:4,document:{...document,injected:true}}).success,false);
 assert.equal(sourceBuildInputSchema.safeParse({expectedDraftVersion:4,source}).success,true);
});

test('whole-document agent transport has explicit bounded Scene v7 and escaped-result caps',()=>{
 const mib=1024*1024,readJson=storyLifecycleLimits.sceneBytes+limits.sourceJsonBytes+13*mib;
 assert.deepEqual(agentTransportLimits,{requestBytes:Math.max(storyLifecycleLimits.sceneBytes,limits.sourceJsonBytes)+2*mib,responseBytes:readJson,
  readToolResultBytes:readJson+2*(storyLifecycleLimits.aggregateSourceTextBytes+limits.sourceBytes)+8*mib,operationMs:limits.agentOperationMs});
 // The escaped MCP result must remain one V8 string.
 assert.ok(agentTransportLimits.readToolResultBytes<2**29-24);
});

test('a worst-case escaped valid Scene v7 read fits without duplicating the selected source',async()=>{
 const rest=Math.floor((storyLifecycleLimits.aggregateSourceTextBytes-limits.sourceBytes)/7);
 const visuals=Array.from({length:8},(_,index)=>{const value={sdkVersion:'0.2.0' as const,entry:'visual.ts',files:{'visual.ts':'\0'.repeat(index===0?limits.sourceBytes:rest)}};return {id:`visual${index+1}`,source:value,controls:{...controls,sourceHash:String(index).repeat(64)},controlAnimations:[]};});
 const large=createStorySceneDocumentV7(visuals,{width:640,height:360,fps:60,seed:0},{bpm:120},{version:2,normalVisualId:'visual1',crossfadeSeconds:.35,beats:[{id:'ambient',label:'Ambient',timing:{kind:'sustained'},visualId:'visual1'}],sequence:[]});
 const session=createAuthoringSession(createSourceWorkspace(source),{submit:async()=>{},submitDocument:async()=>{},acceptedDocument:()=>large,save:async()=>null,open:async()=>({token:'large',name:'large.lux-scene',document:large})});
 const encoder=new TextEncoder(),documentBytes=encoder.encode(JSON.stringify(large,null,2)+'\n').byteLength,selectedSourceBytes=encoder.encode(JSON.stringify(large.visuals[0]!.source)).byteLength;
 assert.ok(documentBytes>5.9*storyLifecycleLimits.aggregateSourceTextBytes&&documentBytes<=storyLifecycleLimits.sceneBytes);assert.ok(selectedSourceBytes>5.9*limits.sourceBytes);
 await session.open();const read=session.read(),bytes=encoder.encode(JSON.stringify(read)).byteLength;
 assert.equal(Object.hasOwn(read,'selectedSource'),false);assert.ok(bytes>documentBytes);assert.ok(bytes<agentTransportLimits.responseBytes);
 assert.doesNotThrow(()=>sourceReadResult(read));
});
