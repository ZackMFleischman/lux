import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareAuthoredSharedModules} from '../../apps/studio/src/authored-shared-modules.mjs';
import {sharedVisualsBody,sharedRequiredDependencyKeys,verifySharedVisuals,verifySharedVisualsStructure} from '../../apps/build-worker/src/shared-link-identity.mjs';
import {deriveAssets} from '../../packages/assets/src/index.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashes={version:'0.28.2',implementationHash:'1'.repeat(64),apiHash:'2'.repeat(64),binaryHash:'3'.repeat(64)};
async function fixture(){
 const emptyAssets=await deriveAssets({},hash);
 const code={
  'chunk-ABCDEFGH.js':'export class Shared {}',
  'runtime.js':'export { Shared } from "./chunk-ABCDEFGH.js";',
  'v000.js':'import { Shared } from "./chunk-ABCDEFGH.js"; globalThis.__luxLazyA++; export default Shared;',
  'v001.js':'import { Shared } from "./chunk-ABCDEFGH.js"; globalThis.__luxLazyB++; export default Shared;',
 };
 const files=Object.entries(code).map(([path,code])=>{
  const literal='"./chunk-ABCDEFGH.js"',start=code.indexOf(literal);
  return {path,code,sourceMap:'{}',codeHash:hash(code),sourceMapHash:hash('{}'),imports:start<0?[]:[{start,end:start+literal.length,target:'chunk-ABCDEFGH.js'}]};
 });
 const visuals=['a','b'].map((id,index)=>({id,entry:`v00${index}.js`,sourceHash:String(index+4).repeat(64),bundleHash:String(index+6).repeat(64),artifactVersion:3,sdkVersion:'0.2.0',controls:[],controlSchemaHash:hash('[]'),...emptyAssets}));
 const dependencyHashes=Object.fromEntries([...sharedRequiredDependencyKeys,'declarations/@types/three/src/Three.WebGPU.d.ts'].sort().map(key=>[key,hash(key)]));
 const body=sharedVisualsBody({kind:'lux-shared-visuals',version:1,linker:hashes,dependencyHashes,runtimeEntry:'runtime.js',visuals,files});
 return {...body,capsuleHash:hash(JSON.stringify(body))};
}
function ports(){
 const created=[],revoked=[];
 return {created,revoked,options:{createModuleURL(code){const url=`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;created.push(url);return url;},revokeModuleURL(url){revoked.push(url);}}};
}

test('shared graph preserves library identity and imports authored entries only once on demand',async()=>{
 globalThis.__luxLazyA=0;globalThis.__luxLazyB=0;const port=ports();
 const prepared=await prepareAuthoredSharedModules(await fixture(),port.options);
 try{
  assert.equal(port.created.length,4);assert.equal(globalThis.__luxLazyA,0);assert.equal(globalThis.__luxLazyB,0);
  const runtime=await prepared.importRuntime();assert.equal(globalThis.__luxLazyA,0);assert.equal(globalThis.__luxLazyB,0);
  assert.throws(()=>{prepared.capsule.runtimeEntry='v001.js';},TypeError);
  assert.throws(()=>{prepared.capsule.visuals[0].entry='v001.js';},TypeError);
  const a=await prepared.importVisual('a');assert.equal(globalThis.__luxLazyA,1);assert.equal(globalThis.__luxLazyB,0);
  const [b,again]=await Promise.all([prepared.importVisual('b'),prepared.importVisual('b')]);
  assert.equal(b,again);assert.equal(globalThis.__luxLazyB,1);assert.equal(a.default,runtime.Shared);assert.equal(b.default,runtime.Shared);
 }finally{await prepared.dispose();delete globalThis.__luxLazyA;delete globalThis.__luxLazyB;}
 assert.equal(port.revoked.length,4);assert.equal(prepared.status().ownedModuleURLs,0);await prepared.dispose();assert.equal(port.revoked.length,4);
 await assert.rejects(prepared.importVisual('a'),/disposed|closed/i);
});

test('changed code or import metadata is rejected before a URL or authored import is made',async()=>{
 for(const mutate of [value=>{value.files[0].code+=';throw Error("bad")';},value=>{value.files[1].imports[0].target='outside.js';}]){
  const value=await fixture();mutate(value);const port=ports();
  await assert.rejects(prepareAuthoredSharedModules(value,port.options));assert.equal(port.created.length,0);
 }
});

test('structural admission defers payload decoding and trusted handoff requires its exact deeply frozen capsule',async()=>{
 const value=await fixture(),admitted=await verifySharedVisualsStructure(value,async bytes=>hash(bytes)),port=ports();
 const prepared=await prepareAuthoredSharedModules(admitted,{...port.options,admittedCapsule:admitted,importModule:async()=>({})});
 assert.equal(port.created.length,4);await prepared.dispose();
 const shallow=structuredClone(admitted);Object.freeze(shallow);
 await assert.rejects(prepareAuthoredSharedModules(shallow,{...ports().options,admittedCapsule:shallow}),/admitted shared capsule/i);
 await assert.rejects(prepareAuthoredSharedModules(structuredClone(admitted),{...ports().options,admittedCapsule:admitted}),/admitted shared capsule/i);

 const derived=await deriveAssets({'assets/red.bmp':{mediaType:'image/bmp',encoding:'base64',data:'Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA=='}},hash);
 const altered=await fixture();Object.assign(altered.visuals[0],structuredClone(derived));altered.visuals[0].assets['assets/red.bmp'].data=Buffer.alloc(derived.assets['assets/red.bmp'].byteLength).toString('base64');altered.capsuleHash=hash(JSON.stringify(sharedVisualsBody(altered)));
 await verifySharedVisualsStructure(altered,async bytes=>hash(bytes));
 await assert.rejects(verifySharedVisuals(altered,async bytes=>hash(bytes)),/BMP|asset/i);
});

test('cleanup waits for an unsettled import and fences late publication',async()=>{
 const port=ports();let release;const waiting=new Promise(resolve=>{release=resolve;});
 const prepared=await prepareAuthoredSharedModules(await fixture(),{...port.options,importModule:()=>waiting});
 const pending=prepared.importRuntime();const rejected=assert.rejects(pending,/disposed|closed/i);
 let cleaned=false;const cleanup=prepared.dispose().then(()=>{cleaned=true;});await Promise.resolve();
 assert.equal(cleaned,false);assert.equal(port.revoked.length,0);
 assert.equal(prepared.status().pendingImports,1);assert.equal(prepared.status().ownedModuleURLs,4);
 release({});await rejected;await cleanup;assert.equal(port.revoked.length,4);
});

test('post-import lifecycle uses captured operations even after authored builtin mutation',async()=>{
 const port=ports(),prepared=await prepareAuthoredSharedModules(await fixture(),{...port.options,importModule:async()=>({})});
 await prepared.importVisual('a');
 const originals={get:Map.prototype.get,set:Map.prototype.set,has:Map.prototype.has,freeze:Object.freeze,iterator:Array.prototype[Symbol.iterator],settle:Promise.allSettled};
 const poison=()=>{throw Error('authored builtin mutation');};let observed;
 try{
  Map.prototype.get=poison;Map.prototype.set=poison;Map.prototype.has=poison;Object.freeze=poison;Array.prototype[Symbol.iterator]=poison;Promise.allSettled=poison;
  await prepared.importVisual('b');await prepared.dispose();observed=prepared.status();
 }finally{
  Map.prototype.get=originals.get;Map.prototype.set=originals.set;Map.prototype.has=originals.has;Object.freeze=originals.freeze;Array.prototype[Symbol.iterator]=originals.iterator;Promise.allSettled=originals.settle;
 }
 assert.equal(observed.ownedModuleURLs,0);assert.equal(observed.pendingImports,0);assert.equal(observed.importedEntries,3);
});

test('a nonsettling import retains ownership instead of claiming cooperative cleanup',async()=>{
 const port=ports(),prepared=await prepareAuthoredSharedModules(await fixture(),{...port.options,importModule:()=>new Promise(()=>{})});
 void prepared.importRuntime();let disposed=false;void prepared.dispose().then(()=>{disposed=true;});
 await new Promise(resolve=>setTimeout(resolve,10));assert.equal(disposed,false);
 assert.equal(prepared.status().closed,true);assert.equal(prepared.status().pendingImports,1);assert.equal(prepared.status().ownedModuleURLs,4);
 // The external worker owner must enforce the cleanup deadline/termination;
 // an unresolved Promise alone does not keep this CPU test's event loop alive.
});

test('failed imports remain cached and partial URL construction cleans up its own URLs',async()=>{
 const port=ports();let imports=0;
 const prepared=await prepareAuthoredSharedModules(await fixture(),{...port.options,importModule:async()=>{imports++;throw Error('injected import failure');}});
 await assert.rejects(prepared.importRuntime(),/injected/);await assert.rejects(prepared.importRuntime(),/injected/);assert.equal(imports,1);await prepared.dispose();
 const partial=ports();let count=0;
 await assert.rejects(prepareAuthoredSharedModules(await fixture(),{...partial.options,createModuleURL(code){if(++count===3)throw Error('injected URL failure');return partial.options.createModuleURL(code);}}),/injected URL failure/);
 assert.equal(partial.revoked.length,2);
});
