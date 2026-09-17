import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SceneFileStore} from '../../packages/core/src/scene-file.ts';
import {sceneHash,sceneSourceHash} from '../../packages/core/src/scene-document.ts';

async function scene(large=false){
 const visuals=[];
 for(let index=0;index<(large?8:2);index++){
  const source={sdkVersion:'0.2.0' as const,entry:'visual.ts',files:{'visual.ts':`// visual ${index} ${large?'"'.repeat(600000):'draft'}`}};
  visuals.push({id:`visual${index+1}`,source,controls:{sourceHash:await sceneSourceHash(source),schema:[],schemaHash:await sceneHash('[]'),values:{}},controlAnimations:[]});
 }
 return {format:'lux-scene',version:7,visuals,settings:{width:640,height:360,fps:60,seed:0},tempo:{bpm:120},story:{version:2,normalVisualId:'visual1',crossfadeSeconds:.35,beats:[{id:'arrival',label:'Arrival',timing:{kind:'sustained'},visualId:'visual2'}],sequence:[{id:'arrival-1',beatId:'arrival',visualId:'visual2',follow:{kind:'manual'}}]}};
}

test('Story scene files roundtrip every source above the legacy file cap',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'lux-story-file-'));
 try{
  const path=join(folder,'story.lux-scene'),value=await scene(true),store=new SceneFileStore();
  const bytes=Buffer.byteLength(JSON.stringify(value,null,2)+'\n');assert.ok(bytes>8388608&&bytes<33554432);
  const saved=await store.saveAs(path,value,{overwrite:false});
  assert.deepEqual((await store.open(path)).document,value);
  const revised=structuredClone(value);revised.story.crossfadeSeconds=.7;
  await store.save(saved.token,revised);
  assert.deepEqual((await new SceneFileStore().open(path)).document,revised);
  await new SceneFileStore().saveAs(path,revised,{overwrite:true});
  assert.deepEqual((await new SceneFileStore().open(path)).document,revised);
  await writeFile(path,'external change');
  await assert.rejects(store.save(saved.token,value),/changed outside/);
  assert.equal(await readFile(path,'utf8'),'external change');
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('Story read cap and invalid source references preserve existing files',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'lux-story-file-bounds-'));
 try{
  const path=join(folder,'story.lux-scene'),value=await scene(),store=new SceneFileStore();
  const saved=await store.saveAs(path,value);const original=await readFile(path);
  const invalid=structuredClone(value);invalid.story.sequence[0]!.visualId='missing';
  await assert.rejects(async()=>store.save(saved.token,invalid));assert.deepEqual(await readFile(path),original);
  const tooLarge=join(folder,'too-large.lux-scene');await writeFile(tooLarge,' '.repeat(33554432)+JSON.stringify(value));
  await assert.rejects(store.open(tooLarge),/32 MiB/);
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('legacy files retain their existing raw byte limits',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'lux-story-legacy-bounds-'));
 try{
  const path=join(folder,'legacy.lux-scene');
  const value={format:'lux-scene',version:1,source:{sdkVersion:'0.1.0',entry:'visual.ts',files:{'visual.ts':'// draft'}},settings:{width:640,height:360,fps:60,seed:0},controls:{intensity:.5}};
  await writeFile(path,' '.repeat(8388608)+JSON.stringify(value));
  await assert.rejects(new SceneFileStore().open(path),/8 MiB/);
  const original=await readFile(path);
  await assert.rejects(new SceneFileStore().saveAs(path,await scene(),{overwrite:true}),/8 MiB/);
  assert.deepEqual(await readFile(path),original);
 }finally{await rm(folder,{recursive:true,force:true});}
});
