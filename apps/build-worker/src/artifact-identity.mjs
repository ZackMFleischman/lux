// Shared pure identity bodies: parents and children must hash identical fields.
import { verifyDerivedAssets } from '../../../packages/assets/src/index.mjs';
import { snapshotRecord, violation } from './source-policy.mjs';
const hashPattern = /^[a-f0-9]{64}$/;
const artifactFields = ['sourceHash','entry','modules','sourceMaps','sdkVersion','compilerVersion','dependencyHashes'];
const linkedFields = ['code','sourceMap','bundleHash','linker'];
function exact(input, fields, versionKey, identityKey) {
  const raw = snapshotRecord(input), v2 = Object.hasOwn(raw,versionKey);
  if (v2 && raw[versionKey] !== 2) throw violation(`Unsupported ${versionKey}`);
  const allowed = [...fields,...(v2 ? [versionKey,'assets','assetSetHash'] : []),...(Object.hasOwn(raw,identityKey)?[identityKey]:[])];
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
  const a=exact(input,artifactFields,'artifactVersion','bundleHash'), v2=a.artifactVersion===2;
  requireHash(a.sourceHash);
  if(typeof a.entry !== 'string' || a.sdkVersion !== '0.1.0' || a.compilerVersion !== '7.0.2') throw violation('Unsupported compiler or SDK identity');
  const body={sourceHash:a.sourceHash,entry:a.entry,modules:stringRecord(a.modules,v2),sourceMaps:stringRecord(a.sourceMaps,v2),sdkVersion:a.sdkVersion,compilerVersion:a.compilerVersion,dependencyHashes:stringRecord(a.dependencyHashes,v2,true)};
  return v2 ? {...body,artifactVersion:2,assets:a.assets,assetSetHash:a.assetSetHash} : body;
}
export function linkedBody(input) {
  const a=exact(input,linkedFields,'linkedVersion','linkedHash');
  if(typeof a.code !== 'string' || !a.code.isWellFormed() || typeof a.sourceMap !== 'string' || !a.sourceMap.isWellFormed()) throw violation('Invalid linked code or source map');
  requireHash(a.bundleHash);
  const linker=snapshotRecord(a.linker,['version','implementationHash','apiHash','binaryHash']);
  if(linker.version !== '0.28.2') throw violation('Unsupported linker version');
  for(const key of ['implementationHash','apiHash','binaryHash']) requireHash(linker[key]);
  const body={code:a.code,sourceMap:a.sourceMap,bundleHash:a.bundleHash,linker:{version:linker.version,implementationHash:linker.implementationHash,apiHash:linker.apiHash,binaryHash:linker.binaryHash}};
  return a.linkedVersion===2 ? {linkedVersion:2,...body,assets:a.assets,assetSetHash:a.assetSetHash} : body;
}
async function digest(body,hashBytes) {return hashBytes(new TextEncoder().encode(JSON.stringify(body)));}
export async function verifyArtifact(input,hashBytes) {
  const a=snapshotRecord(input), body=artifactBody(a); requireHash(a.bundleHash);
  if(body.artifactVersion===2) {
    const verified=await verifyDerivedAssets(body.assets,body.assetSetHash,hashBytes);body.assets=verified.assets;
  }
  if(await digest(body,hashBytes)!==a.bundleHash) throw violation('Compiled artifact hash mismatch');
  return {...body,bundleHash:a.bundleHash};
}
export async function verifyLinked(input,hashBytes,expectedArtifact) {
  const a=snapshotRecord(input), body=linkedBody(a); requireHash(a.linkedHash);
  if(body.linkedVersion===2) {
    const verified=await verifyDerivedAssets(body.assets,body.assetSetHash,hashBytes);body.assets=verified.assets;
  }
  if(expectedArtifact && (body.bundleHash!==expectedArtifact.bundleHash || (body.linkedVersion===2)!==(expectedArtifact.artifactVersion===2) || (body.linkedVersion===2 && body.assetSetHash!==expectedArtifact.assetSetHash))) throw violation('Linked result artifact/version identity mismatch');
  if(await digest(body,hashBytes)!==a.linkedHash) throw violation('Linked result hash mismatch');
  return {...body,linkedHash:a.linkedHash};
}
