import {verifyLinked} from '../../../apps/build-worker/src/artifact-identity.mjs';
import {verifyDerivedAssets,createReadonlyAssetMap} from '../../../packages/assets/src/index.mjs';
import {snapshotRecord} from '../../../apps/build-worker/src/source-policy.mjs';

// This module is loaded in the pristine worker realm. All admission and private
// store construction finish before invoking the trusted submitted-code importer.
const digest=crypto.subtle.digest.bind(crypto.subtle);
async function sha256(bytes) {
  const hash=new Uint8Array(await digest('SHA-256',bytes));
  return Array.from(hash,byte=>byte.toString(16).padStart(2,'0')).join('');
}
const limit=16777216;
export async function loadAuthoredModule(message,importModule) {
  message=snapshotRecord(message);
  let moduleSource,assets;
  if(Object.hasOwn(message,'linked')) {
    if(['moduleSource','assets','linkedVersion','artifactVersion','sourceVersion','assetSetHash'].some(key=>Object.hasOwn(message,key))) throw Error('Ambiguous linked module initialization');
    if(new TextEncoder().encode(JSON.stringify(message.linked)).byteLength>limit) throw Error('Linked payload exceeds 16 MiB');
    const linked=await verifyLinked(message.linked,sha256);
    if(new TextEncoder().encode(JSON.stringify(linked)).byteLength>limit) throw Error('Linked payload exceeds 16 MiB');
    const sourceAssets=linked.linkedVersion===2 || linked.linkedVersion===3 ? (await verifyDerivedAssets(linked.assets,linked.assetSetHash,sha256)).sourceAssets : {};
    assets=createReadonlyAssetMap(sourceAssets);
    moduleSource=linked.code;
  } else {
    // Existing v1 installed/render-host readers send only moduleSource. Never
    // accept an asset-bearing message through this compatibility branch.
    if(['assets','linkedVersion','artifactVersion','sourceVersion','assetSetHash'].some(key=>Object.hasOwn(message,key))) throw Error('Assets require a verified linked envelope');
    moduleSource=message.moduleSource;
    if(typeof moduleSource!=='string' || new TextEncoder().encode(moduleSource).byteLength>limit) throw Error('Invalid linked module');
    assets=createReadonlyAssetMap({});
  }
  return {module:await importModule(moduleSource),assets};
}
