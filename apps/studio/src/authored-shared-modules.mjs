import {verifySharedVisuals} from '../../build-worker/src/shared-link-identity.mjs';

// Capture lifecycle operations before any authored entry can modify its realm.
const call=Function.prototype.call,freeze=Object.freeze,isFrozen=Object.isFrozen,getDescriptor=Object.getOwnPropertyDescriptor,ownKeys=Reflect.ownKeys,RuntimeError=Error,RuntimeMap=Map,RuntimeSet=Set;
const get=call.bind(Map.prototype.get),set=call.bind(Map.prototype.set),has=call.bind(Map.prototype.has);
const slice=call.bind(String.prototype.slice),quote=JSON.stringify;
const BlobType=Blob,createURL=URL.createObjectURL.bind(URL),revokeURL=URL.revokeObjectURL.bind(URL);
const digest=crypto.subtle.digest.bind(crypto.subtle);
const defaultImport=url=>import(url);
async function hashBytes(bytes){const hash=new Uint8Array(await digest('SHA-256',bytes));return Array.from(hash,byte=>byte.toString(16).padStart(2,'0')).join('');}
function isDeepFrozen(value,seen=new RuntimeSet()){
 if(!value||typeof value!=='object'||seen.has(value))return true;
 if(!isFrozen(value))return false;seen.add(value);
 for(const key of ownKeys(value)){const descriptor=getDescriptor(value,key);if(descriptor&&Object.hasOwn(descriptor,'value')&&!isDeepFrozen(descriptor.value,seen))return false;}
 return true;
}

/** Trusted host ports are injectable for CPU tests. Call only in a pristine worker.
 * The owner must dispose visual instances/GPU resources before disposing this
 * module graph. This is cooperative cleanup: an unsettled authored top-level
 * await keeps its import/URL ownership charged. The host must enforce its
 * external cleanup deadline and report forced termination separately; it must
 * never await this promise without that deadline or infer successful cleanup.
 * Revoking URLs does not unload imported ESM namespaces. */
export async function prepareAuthoredSharedModules(input,options={}){
 // admittedCapsule is a trusted worker-internal handoff. It is valid only after
 // the generation asset factory has completed brokered verifyAll admission.
 // All public/default callers retain complete capsule and asset verification.
 const admitted=options.admittedCapsule;
 if(admitted!==undefined&&(admitted!==input||!isDeepFrozen(admitted)))throw new RuntimeError('Invalid admitted shared capsule handoff');
 const capsule=admitted??await verifySharedVisuals(input,hashBytes);
 const runtimeEntry=capsule.runtimeEntry;
 function freezeData(value){if(value&&typeof value==='object'){for(const key of Object.keys(value))freezeData(value[key]);freeze(value);}return value;}
 freezeData(capsule);
 const makeURL=options.createModuleURL??(code=>createURL(new BlobType([code],{type:'text/javascript'})));
 const releaseURL=options.revokeModuleURL??revokeURL,importModule=options.importModule??defaultImport;
 const files=new RuntimeMap(),urls=new RuntimeMap(),visualEntries=new RuntimeMap(),imports=new RuntimeMap();
 const ownedURLs=[],pending=[];let closed=false,cleanupPromise,importCount=0,remainingURLs=0,pendingImports=0;
 for(const file of capsule.files)set(files,file.path,file);
 for(const visual of capsule.visuals)set(visualEntries,visual.id,visual.entry);
 function buildURL(path){
  if(has(urls,path))return get(urls,path);
  const file=get(files,path);if(!file)throw new RuntimeError('Shared module dependency is unavailable');
  let code=file.code;
  // Graph/ranges are parser-validated before this transformation. Reverse order
  // preserves original UTF-16 offsets even when URL literal lengths change.
  for(let index=file.imports.length-1;index>=0;index--){const edge=file.imports[index];code=slice(code,0,edge.start)+quote(buildURL(edge.target))+slice(code,edge.end);}
  const url=makeURL(code);if(typeof url!=='string'||url.length===0)throw new RuntimeError('Invalid shared module URL');
  ownedURLs[ownedURLs.length]=url;remainingURLs++;set(urls,path,url);return url;
 }
 try{for(const file of capsule.files)buildURL(file.path);}
 catch(error){for(let index=ownedURLs.length-1;index>=0;index--)try{releaseURL(ownedURLs[index]);}catch{}throw error;}
 function load(path){
  if(closed)return (async()=>{throw new RuntimeError('Shared module graph is disposed');})();
  if(has(imports,path))return get(imports,path);
  pendingImports++;
  const promise=(async()=>{try{const module=await importModule(get(urls,path));if(closed)throw new RuntimeError('Shared module graph closed during import');return module;}finally{pendingImports--;}})();
  set(imports,path,promise);pending[pending.length]=promise;importCount++;return promise;
 }
 function importRuntime(){return load(runtimeEntry);}
 async function importVisual(id){
  if(closed)throw new RuntimeError('Shared module graph is disposed');
  if(!has(visualEntries,id))throw new RuntimeError('Shared visual is unavailable');
  await importRuntime();return load(get(visualEntries,id));
 }
 function dispose(){
  if(cleanupPromise)return cleanupPromise;
  closed=true;
  cleanupPromise=(async()=>{
   for(let index=0;index<pending.length;index++)try{await pending[index];}catch{}
   let failure;
   for(let index=ownedURLs.length-1;index>=0;index--)try{releaseURL(ownedURLs[index]);remainingURLs--;}catch(error){failure??=error;}
   if(failure)throw failure;
  })();
  return cleanupPromise;
 }
 return freeze({capsule,importRuntime,importVisual,dispose,status:()=>freeze({closed,ownedModuleURLs:remainingURLs,importedEntries:importCount,pendingImports})});
}
