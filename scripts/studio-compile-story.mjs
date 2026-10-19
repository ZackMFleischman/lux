import {pathToFileURL} from 'node:url';
import {compileVisual} from '../apps/build-worker/src/compile.mjs';
import {linkSharedVisuals} from '../apps/build-worker/src/shared-link-runtime.mjs';
import {verifyStorySceneDocumentV7} from '../packages/core/src/story-scene-v2.ts';
import {storyLifecycleLimits} from '../packages/runtime-contracts/src/story.mjs';

/** Trusted compiler orchestration. Overrides are test ports, never source data. */
export async function compileStoryDocument(value,{compile=compileVisual,link=linkSharedVisuals,dependencyRoot}={}){
 const document=await verifyStorySceneDocumentV7(value),artifacts=[];
 for(const visual of document.visuals){
  const result=await compile({source:visual.source},{...(dependencyRoot?{dependencyRoot}:{})});
  if(!result.ok)return {...result,visualId:visual.id,diagnostics:(result.diagnostics??[]).map(row=>({...row,visualId:visual.id}))};
  artifacts.push({id:visual.id,artifact:result.artifact});
 }
 return {ok:true,capsule:await link(artifacts,{...(dependencyRoot?{dependencyRoot}:{})})};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let input='',bytes=0;
 try{
  process.stdin.setEncoding('utf8');
  for await(const chunk of process.stdin){bytes+=Buffer.byteLength(chunk,'utf8');if(bytes>storyLifecycleLimits.sceneBytes+2097152)throw Error(`Story scene request exceeds ${storyLifecycleLimits.sceneBytes/1048576+2} MiB`);input+=chunk;}
  process.stdout.write(JSON.stringify(await compileStoryDocument(JSON.parse(input))));
 }catch(error){process.stdout.write(JSON.stringify({ok:false,code:'COMPILE_FAILED',diagnostics:[{code:error.code??'COMPILE_FAILED',message:String(error.message).slice(0,2000)}]}));}
}
