import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {SceneFileStore,soundtrackForScene,soundtrackCandidates} from '../../packages/core/src/scene-file.ts';
import {validateSceneDocument,withSceneSoundtrack,sceneHash,sceneSourceHash} from '../../packages/core/src/scene-document.ts';
import {normalizeSceneSoundtrack,soundtrackFileName} from '../../packages/core/src/scene-soundtrack.ts';

const root=resolve(import.meta.dirname,'../..');
const legacy={format:'lux-scene',version:1,source:{sdkVersion:'0.1.0',entry:'visual.ts',files:{'visual.ts':'// draft'}},settings:{width:640,height:360,fps:60,seed:0},controls:{intensity:.5},tempo:{bpm:120}};
async function storyV7(){
 const visuals=[];
 for(const id of ['visual1','visual2']){
  const source={sdkVersion:'0.2.0' as const,entry:'visual.ts',files:{'visual.ts':`// ${id}`}};
  visuals.push({id,source,controls:{sourceHash:await sceneSourceHash(source),schema:[],schemaHash:await sceneHash('[]'),values:{}},controlAnimations:[]});
 }
 return {format:'lux-scene',version:7,visuals,settings:{width:640,height:360,fps:60,seed:0},tempo:{bpm:120},story:{version:2,normalVisualId:'visual1',crossfadeSeconds:.35,beats:[{id:'arrival',label:'Arrival',timing:{kind:'sustained'},visualId:'visual2'}],sequence:[{id:'arrival-1',beatId:'arrival',visualId:'visual2',follow:{kind:'manual'}}]}};
}
function soundtrack(folder:string){
 const absolutePath=join(folder,'audio','One More Dawn.mp3');
 return {path:absolutePath,absolutePath,sha256:'a'.repeat(64),offsetSeconds:1.25,volume:.8};
}
async function fixtures(){
 const files=(await readdir(join(root,'visuals'))).filter(name=>name.endsWith('.lux-scene')).map(name=>join(root,'visuals',name));
 const opened=await Promise.all(files.map(async path=>({path,bytes:await readFile(path),document:(await new SceneFileStore().open(path)).document})));
 return [...opened,{path:null,bytes:null,document:validateSceneDocument(legacy)},{path:null,bytes:null,document:validateSceneDocument(await storyV7())}];
}

test('scenes without a soundtrack load and save byte-identically on every version',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'lux-soundtrack-absent-'));
 try{
  const seen=new Set<number>();
  for(const [index,item] of (await fixtures()).entries()){
   seen.add(item.document.version);
   assert.equal(Object.hasOwn(item.document,'soundtrack'),false);
   const target=join(folder,`copy-${index}.lux-scene`);
   await new SceneFileStore().saveAs(target,item.document,{overwrite:false});
   const saved=await readFile(target);
   assert.equal(saved.toString('utf8'),JSON.stringify(item.document,null,2)+'\n');
   if(item.bytes)assert.ok(saved.equals(item.bytes),`${item.path} changed bytes on resave`);
  }
  for(const version of [1,3,4,5,7])assert.ok(seen.has(version),`missing v${version} fixture`);
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('soundtrack is an optional key on Scene v1-v7 and roundtrips with a scene-relative path',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'lux-soundtrack-present-'));
 try{
  await mkdir(join(folder,'audio'));
  const linked=soundtrack(folder);
  for(const [index,item] of (await fixtures()).entries()){
   const document=withSceneSoundtrack(item.document,normalizeSceneSoundtrack(linked));
   assert.deepEqual(document.soundtrack,linked);
   assert.equal(document.version,item.document.version,'soundtrack must not change the version');
   const target=join(folder,`scene-${index}.lux-scene`),store=new SceneFileStore();
   const saved=await store.saveAs(target,document,{overwrite:false});
   assert.deepEqual(saved.document.soundtrack,{...linked,path:'audio/One More Dawn.mp3'});
   const reopened=await new SceneFileStore().open(target);
   assert.deepEqual(reopened.document.soundtrack,{...linked,path:'audio/One More Dawn.mp3'});
   assert.deepEqual(soundtrackCandidates(reopened.document.soundtrack!,target),[linked.absolutePath]);
   const removed=withSceneSoundtrack(reopened.document,null);
   assert.equal(Object.hasOwn(removed,'soundtrack'),false);
   await store.save(saved.token,removed);
   assert.equal(await readFile(target,'utf8'),JSON.stringify(item.document,null,2)+'\n');
  }
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('soundtrack paths resolve relative first and fall back to the absolute path',()=>{
 const scene=resolve(tmpdir(),'show','scene.lux-scene'),absolutePath=resolve(tmpdir(),'elsewhere','song.mp3');
 const moved={path:'audio/song.mp3',absolutePath};
 assert.deepEqual(soundtrackCandidates(moved,scene),[resolve(tmpdir(),'show','audio','song.mp3'),absolutePath]);
 const located=soundtrackForScene({...moved,sha256:'b'.repeat(64),offsetSeconds:0,volume:1},scene);
 assert.equal(located.path,'../elsewhere/song.mp3');
 if(process.platform==='win32'){
  const otherDrive=soundtrackForScene({path:'x',absolutePath:'Q:\\music\\song.mp3',sha256:'b'.repeat(64),offsetSeconds:0,volume:1},'C:\\show\\scene.lux-scene');
  assert.equal(otherDrive.path,'Q:\\music\\song.mp3');
 }
 assert.equal(soundtrackFileName({absolutePath}),'song.mp3');
});

test('invalid soundtracks are rejected without bumping or rewriting the scene',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'lux-soundtrack-invalid-'));
 try{
  const valid=soundtrack(folder);
  const bad=[
   {...valid,sha256:'A'.repeat(64)},{...valid,sha256:'abc'},{...valid,volume:1.5},{...valid,volume:-0.1},
   {...valid,offsetSeconds:-1},{...valid,offsetSeconds:Number.NaN},{...valid,absolutePath:join(folder,'song.exe'),path:'song.exe'},
   {...valid,path:''},{...valid,extra:true},(({volume:_volume,...rest})=>rest)(valid),'song.mp3',null,
  ];
  const story=await storyV7();
  for(const value of bad){
   assert.throws(()=>validateSceneDocument({...legacy,soundtrack:value}));
   assert.throws(()=>validateSceneDocument({...story,soundtrack:value}));
  }
  const path=join(folder,'scene.lux-scene'),store=new SceneFileStore();
  const saved=await store.saveAs(path,legacy,{overwrite:false}),before=await readFile(path);
  await assert.rejects(async()=>store.save(saved.token,{...legacy,soundtrack:{...valid,volume:2}}));
  assert.ok((await readFile(path)).equals(before));
 }finally{await rm(folder,{recursive:true,force:true});}
});
