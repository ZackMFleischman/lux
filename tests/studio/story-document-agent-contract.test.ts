import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sourceBuildInputSchema,sourceReadResult,agentTransportLimits} from '../../apps/studio/src/source/agent-contract.ts';
import {createStorySceneDocumentV7} from '../../packages/core/src/story-scene-v2.ts';
import {createSourceWorkspace} from '../../apps/studio/src/source/workspace.ts';
import {createAuthoringSession} from '../../apps/studio/src/source/authoring-session.ts';

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
 assert.deepEqual(agentTransportLimits,{requestBytes:34*1024*1024,responseBytes:52*1024*1024,readToolResultBytes:104*1024*1024});
});

test('a worst-case escaped valid Scene v7 read fits without duplicating the selected source',async()=>{
 const visuals=Array.from({length:8},(_,index)=>{const value={sdkVersion:'0.2.0' as const,entry:'visual.ts',files:{'visual.ts':'\0'.repeat(index===0?1024*1024:600000)}};return {id:`visual${index+1}`,source:value,controls:{...controls,sourceHash:String(index).repeat(64)},controlAnimations:[]};});
 const large=createStorySceneDocumentV7(visuals,{width:640,height:360,fps:60,seed:0},{bpm:120},{version:2,normalVisualId:'visual1',crossfadeSeconds:.35,beats:[{id:'ambient',label:'Ambient',timing:{kind:'sustained'},visualId:'visual1'}],sequence:[]});
 const session=createAuthoringSession(createSourceWorkspace(source),{submit:async()=>{},submitDocument:async()=>{},acceptedDocument:()=>large,save:async()=>null,open:async()=>({token:'large',name:'large.lux-scene',document:large})});
 const encoder=new TextEncoder(),documentBytes=encoder.encode(JSON.stringify(large,null,2)+'\n').byteLength,selectedSourceBytes=encoder.encode(JSON.stringify(large.visuals[0]!.source)).byteLength;
 assert.ok(documentBytes>30*1024*1024&&documentBytes<=32*1024*1024);assert.ok(selectedSourceBytes>6*1024*1024);
 await session.open();const read=session.read(),bytes=encoder.encode(JSON.stringify(read)).byteLength;
 assert.equal(Object.hasOwn(read,'selectedSource'),false);assert.ok(bytes>34*1024*1024);assert.ok(bytes<agentTransportLimits.responseBytes);
 assert.doesNotThrow(()=>sourceReadResult(read));
});
