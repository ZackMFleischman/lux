import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSceneDocument,validateSceneDocument,verifySceneDocument} from '../../packages/core/src/scene-document.ts';
import {exportSceneDocument} from '../../scripts/studio-export.mjs';
import {tmpdir} from 'node:os';

const source={sdkVersion:'0.2.0' as const,entry:'visual.ts',files:{'visual.ts':'export {}'}};
const settings={width:640,height:360,fps:60,seed:0};
const controls={sourceHash:'a'.repeat(64),schema:[],schemaHash:createHash('sha256').update('[]').digest('hex'),values:{}};
const story={version:1 as const,beats:[{id:'orbit',label:'Orbit',timing:{kind:'sustained' as const}}],sequence:[{id:'orbit-1',beatId:'orbit',follow:{kind:'after' as const,seconds:12}}]};

test('Story definitions round trip as scene v6 without playback state',async()=>{
  const document=createSceneDocument(source,settings,controls,[],[],undefined,story);
  assert.equal(document.version,6);
  assert.deepEqual(await verifySceneDocument(JSON.parse(JSON.stringify(document))),document);
  assert.throws(()=>validateSceneDocument({...document,story:{...story,activeBeat:'orbit'}}));
  assert.throws(()=>validateSceneDocument({...document,storyRevision:1}));
  assert.throws(()=>validateSceneDocument({...document,story:{...story,sequence:[{id:'bad',beatId:'missing',follow:{kind:'manual'}}]}}));
});

test('clearing Story retains scene v6 while legacy root scenes retain v3',()=>{
  const document=createSceneDocument(source,settings,controls,[],[],undefined,story);
  const {story:_story,...cleared}=document as any;
  assert.equal(validateSceneDocument(cleared).version,6);
  assert.equal(createSceneDocument(source,settings,controls).version,3);
  assert.equal(createSceneDocument(source,settings,controls,[],[],undefined,null,true).version,6);
  assert.throws(()=>validateSceneDocument({...document,source:{...source,sdkVersion:'0.4.0'}}),/SDK 0.2.0/);
});

test('Story export rejects explicitly before packaging',async()=>{
  const document=createSceneDocument(source,settings,controls,[],[],undefined,story);
  let prepared=false;
  await assert.rejects(exportSceneDocument({name:'Story',document,outputDirectory:tmpdir()},{prepare:async()=>{prepared=true;throw Error('unexpected prepare');}}),/Resolume export does not support Story/);
  assert.equal(prepared,false);
});
