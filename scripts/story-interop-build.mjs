import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {compileVisual} from '../apps/build-worker/src/compile.mjs';
import {linkRuntime} from '../apps/build-worker/src/link-runtime.mjs';
import {linkSharedVisuals} from '../apps/build-worker/src/shared-link-runtime.mjs';
import {ordinarySource,tslSource} from './story-interop/sources.mjs';

const sha256=value=>createHash('sha256').update(value).digest('hex');
export async function prepareStoryInteropProbe({workspace=resolve(import.meta.dirname,'..'),write=true}={}){
 const root=resolve(workspace),dependencyRoot=process.env.LUX_COMPILER_DEPENDENCIES||join(root,'node_modules'),compile=async(source,name)=>{
  const result=await compileVisual({source},{dependencyRoot});if(!result.ok)throw Error(`${name} compile failed: ${JSON.stringify(result.diagnostics)}`);
  const linked=await linkRuntime(result.artifact,{dependencyRoot});assert.equal(result.artifact.sdkVersion,'0.2.0');assert.equal(linked.linkedVersion,3);
  return {source,artifact:result.artifact,linked,identity:{name,sdkVersion:result.artifact.sdkVersion,sourceHash:result.artifact.sourceHash,bundleHash:result.artifact.bundleHash,linkedHash:linked.linkedHash,controlSchemaHash:linked.controlSchemaHash,compilerVersion:result.artifact.compilerVersion,linker:linked.linker,dependencyHashes:result.artifact.dependencyHashes,sourceBytes:Buffer.byteLength(JSON.stringify(source),'utf8'),linkedBytes:Buffer.byteLength(JSON.stringify(linked),'utf8')}};
 };
 const [ordinary,tsl]=await Promise.all([compile(ordinarySource,'ordinary-lit-material'),compile(tslSource,'foreign-tsl-fn-if')]);
 assert.notEqual(ordinary.identity.sourceHash,tsl.identity.sourceHash);assert.notEqual(ordinary.identity.linkedHash,tsl.identity.linkedHash);
 const capsule=await linkSharedVisuals([{id:'ordinary',artifact:ordinary.artifact},{id:'tsl',artifact:tsl.artifact}],{dependencyRoot});
 const prepared={schema:2,settings:{width:64,height:64,weight:0.5,colorFormat:'rgba8unorm-srgb',depthFormat:'depth24plus',slot:{count:2,depthBuffer:true,stencilBuffer:false,samples:0,mips:1,layers:1,logicalBytesPerPixel:8},composition:{count:2,depthBuffer:false,stencilBuffer:false,samples:0,mips:1,layers:1,logicalBytesPerPixel:4}},capsule,ordinary:{identity:ordinary.identity},tsl:{identity:tsl.identity}};
 if(write){const dist=join(root,'scripts/story-interop/dist'),artifact=join(root,'artifacts/story-interop');await Promise.all([mkdir(dist,{recursive:true}),mkdir(artifact,{recursive:true})]);
  await build({absWorkingDir:root,entryPoints:['scripts/story-interop/probe-worker.mjs'],outfile:join(dist,'probe-worker.js'),bundle:true,format:'esm',platform:'browser',target:'chrome145',sourcemap:true,logLevel:'silent'});
  const text=JSON.stringify(prepared);await writeFile(join(artifact,'prepared.json'),text);await writeFile(join(artifact,'source-identities.json'),JSON.stringify({ordinary:ordinary.identity,tsl:tsl.identity,preparedSha256:sha256(text)},null,2)+'\n');
 }
 return prepared;
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href){const prepared=await prepareStoryInteropProbe();console.log(JSON.stringify({ordinary:prepared.ordinary.identity,tsl:prepared.tsl.identity,settings:prepared.settings}));}
