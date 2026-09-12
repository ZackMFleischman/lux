// Shared pure identity bodies: parents and children must hash identical fields.
import { verifyDerivedAssets } from '../../../packages/assets/src/index.mjs';
import { snapshotRecord, violation } from './source-policy.mjs';
import { normalizeControlSchema, canonicalControlSchemaJson } from '../../../packages/runtime-contracts/src/parameters.mjs';
const hashPattern = /^[a-f0-9]{64}$/;
const artifactFields = ['sourceHash','entry','modules','sourceMaps','sdkVersion','compilerVersion','dependencyHashes'];
const linkedFields = ['code','sourceMap','bundleHash','linker'];
function exact(input, fields, versionKey, identityKey) {
  const raw = snapshotRecord(input), versioned = Object.hasOwn(raw,versionKey);
  if (versioned && ![2,3].includes(raw[versionKey])) throw violation(`Unsupported ${versionKey}`);
  const allowed = [...fields,...(versioned ? [versionKey,'assets','assetSetHash'] : []),...(raw[versionKey]===3 ? ['controls','controlSchemaHash'] : []),...(Object.hasOwn(raw,identityKey)?[identityKey]:[])];
  if (Object.keys(raw).length !== allowed.length || allowed.some(key=>!Object.hasOwn(raw,key))) throw violation('Missing or unsupported identity fields');
  return raw;
}
function stringRecord(input, sorted, hashes=false) {
  const raw=snapshotRecord(input), keys=Object.keys(raw);
  if(sorted) keys.sort();
  const result={};
  for(const key of keys) {
    if(typeof raw[key] !== 'string' || !raw[key].isWellFormed() || (hashes && !hashPattern.test(raw[key]))) throw violation('Invalid identity record value');
    Object.defineProperty(result,key,{value:raw[key],enumerable:true,writable:true,configurable:true});
  }
  return result;
}
function requireHash(hash) {if(typeof hash !== 'string' || !hashPattern.test(hash)) throw violation('Invalid SHA-256 identity');}
export function artifactBody(input) {
  const a=exact(input,artifactFields,'artifactVersion','bundleHash'), versioned=a.artifactVersion===2 || a.artifactVersion===3;
  requireHash(a.sourceHash);
  if(typeof a.entry !== 'string' || a.sdkVersion !== (a.artifactVersion===3 ? '0.2.0' : '0.1.0') || a.compilerVersion !== '7.0.2') throw violation('Unsupported compiler or SDK identity');
  const body={sourceHash:a.sourceHash,entry:a.entry,modules:stringRecord(a.modules,versioned),sourceMaps:stringRecord(a.sourceMaps,versioned),sdkVersion:a.sdkVersion,compilerVersion:a.compilerVersion,dependencyHashes:stringRecord(a.dependencyHashes,versioned,true)};
  if(a.artifactVersion===3) return {...body,artifactVersion:3,assets:a.assets,assetSetHash:a.assetSetHash,...parameterFields(a)};
  return versioned ? {...body,artifactVersion:2,assets:a.assets,assetSetHash:a.assetSetHash} : body;
}
function parameterFields(a) {
  requireHash(a.controlSchemaHash);
  try {return {controls:normalizeControlSchema(a.controls),controlSchemaHash:a.controlSchemaHash};}
  catch(error) {throw violation(error.message);}
}
export function linkedBody(input) {
  const a=exact(input,linkedFields,'linkedVersion','linkedHash');
  if(typeof a.code !== 'string' || !a.code.isWellFormed() || typeof a.sourceMap !== 'string' || !a.sourceMap.isWellFormed()) throw violation('Invalid linked code or source map');
  requireHash(a.bundleHash);
  const linker=snapshotRecord(a.linker,['version','implementationHash','apiHash','binaryHash']);
  if(linker.version !== '0.28.2') throw violation('Unsupported linker version');
  for(const key of ['implementationHash','apiHash','binaryHash']) requireHash(linker[key]);
  const body={code:a.code,sourceMap:a.sourceMap,bundleHash:a.bundleHash,linker:{version:linker.version,implementationHash:linker.implementationHash,apiHash:linker.apiHash,binaryHash:linker.binaryHash}};
  if(a.linkedVersion===3) return {linkedVersion:3,...body,assets:a.assets,assetSetHash:a.assetSetHash,...parameterFields(a)};
  return a.linkedVersion===2 ? {linkedVersion:2,...body,assets:a.assets,assetSetHash:a.assetSetHash} : body;
}
async function digest(body,hashBytes) {return hashBytes(new TextEncoder().encode(JSON.stringify(body)));}
export async function verifyArtifact(input,hashBytes) {
  const a=snapshotRecord(input), body=artifactBody(a); requireHash(a.bundleHash);
  if(body.artifactVersion===2 || body.artifactVersion===3) {
    const verified=await verifyDerivedAssets(body.assets,body.assetSetHash,hashBytes);body.assets=verified.assets;
  }
  if(body.artifactVersion===3 && await hashBytes(new TextEncoder().encode(canonicalControlSchemaJson(body.controls)))!==body.controlSchemaHash) throw violation('Control schema hash mismatch');
  if(await digest(body,hashBytes)!==a.bundleHash) throw violation('Compiled artifact hash mismatch');
  return {...body,bundleHash:a.bundleHash};
}
export async function verifyLinked(input,hashBytes,expectedArtifact) {
  const a=snapshotRecord(input), body=linkedBody(a); requireHash(a.linkedHash);
  if(body.linkedVersion===2 || body.linkedVersion===3) {
    const verified=await verifyDerivedAssets(body.assets,body.assetSetHash,hashBytes);body.assets=verified.assets;
  }
  if(body.linkedVersion===3 && await hashBytes(new TextEncoder().encode(canonicalControlSchemaJson(body.controls)))!==body.controlSchemaHash) throw violation('Control schema hash mismatch');
  if(expectedArtifact && (body.bundleHash!==expectedArtifact.bundleHash || (body.linkedVersion??1)!==(expectedArtifact.artifactVersion??1) ||
    (body.linkedVersion && body.assetSetHash!==expectedArtifact.assetSetHash) ||
    (body.linkedVersion===3 && (body.controlSchemaHash!==expectedArtifact.controlSchemaHash || canonicalControlSchemaJson(body.controls)!==canonicalControlSchemaJson(expectedArtifact.controls))))) throw violation('Linked result artifact/version/schema identity mismatch');
  if(await digest(body,hashBytes)!==a.linkedHash) throw violation('Linked result hash mismatch');
  return {...body,linkedHash:a.linkedHash};
}
