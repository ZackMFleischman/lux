import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deriveAssets} from '../../packages/assets/src/index.mjs';
import {linkedBody} from '../../apps/build-worker/src/artifact-identity.mjs';
import {loadAuthoredModule} from '../../apps/studio/src/authored-worker-assets.mjs';
import {canonicalControlSchemaJson,normalizeControlDeclarations} from '../../packages/runtime-contracts/src/parameters.mjs';
const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const data='Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA==';
async function payload() {
  const assets=await deriveAssets({'assets/red.bmp':{mediaType:'image/bmp',encoding:'base64',data}},hash);
  const body=linkedBody({linkedVersion:2,code:'export default 1;',sourceMap:'{}',bundleHash:'a'.repeat(64),linker:{version:'0.28.2',implementationHash:'b'.repeat(64),apiHash:'c'.repeat(64),binaryHash:'d'.repeat(64)},...assets});
  return {...body,linkedHash:hash(JSON.stringify(body))};
}

test('v3 parameters retain verified private asset bytes before import and reject invalid identities',async()=>{
  const original=await payload();
  const controls=normalizeControlDeclarations({height:{type:'number',label:'Height',default:1,min:0,max:4}});
  const body=linkedBody({...original,linkedVersion:3,controls,controlSchemaHash:hash(canonicalControlSchemaJson(controls))});
  const linked={...body,linkedHash:hash(JSON.stringify(body))};
  const Bytes=globalThis.Uint8Array;let constructorCalls=0;
  try {
    const prepared=await loadAuthoredModule({linked},async()=>{
      globalThis.Uint8Array=function(){constructorCalls++;throw Error('untrusted constructor');} as any;
      return {};
    });
    assert.equal(prepared.assets.size,1);
    const bytes=prepared.assets.get('assets/red.bmp')!;
    assert.equal(bytes[0],66);(bytes as Uint8Array)[0]=0;
    assert.equal(prepared.assets.get('assets/red.bmp')![0],66);
    assert.equal((prepared.assets as any).set,undefined);assert.equal(constructorCalls,0);
  } finally {globalThis.Uint8Array=Bytes;}
  for(const bad of [{...linked,linkedHash:'0'.repeat(64)},{...linked,assets:{}},{...linked,controlSchemaHash:'0'.repeat(64)}]) {
    await assert.rejects(loadAuthoredModule({linked:bad},async()=>assert.fail('invalid v3 imported')));
  }
});
test('worker prepares verified isolated bytes before importing the submitted module',async()=>{
  const linked=await payload(); let imported='';
  const prepared=await loadAuthoredModule({linked},async code=>{imported=code;return {default:'visual'};});
  assert.equal(imported,linked.code);assert.deepEqual(prepared.module,{default:'visual'});
  assert.equal(hash(prepared.assets.get('assets/red.bmp')!),hash(Buffer.from(data,'base64')));
  (prepared.assets.get('assets/red.bmp') as Uint8Array).fill(0);
  assert.equal(hash(prepared.assets.get('assets/red.bmp')!),hash(Buffer.from(data,'base64')));
  assert.equal((prepared.assets as any).set,undefined);
  const missing=await loadAuthoredModule({moduleSource:'legacy'},async()=>({default:'legacy'}));
  assert.equal(missing.assets.size,0);assert(Object.isFrozen(missing.assets));assert.equal((missing.assets as any).set,undefined);
});
test('bad linked hashes, altered assets and ambiguous legacy messages fail before import',async()=>{
  const linked=await payload();
  for(const message of [{linked:{...linked,linkedHash:'0'.repeat(64)}},{linked:{...linked,assets:{}}},{linked,moduleSource:'other'},{moduleSource:'legacy',assets:{}},{moduleSource:'legacy',linkedVersion:2},{moduleSource:'x'.repeat(16777217)}]) {
    await assert.rejects(loadAuthoredModule(message,async()=>assert.fail('submitted import ran before admission')));
  }
});
test('protected byte construction completes before submitted import can replace constructors',async()=>{
  const linked=await payload(),Bytes=globalThis.Uint8Array;let calls=0;
  try {
    const prepared=await loadAuthoredModule({linked},async()=>{
      globalThis.Uint8Array=function(){calls++;throw Error('constructor replaced by submitted module');} as any;
      return {};
    });
    const bytes=prepared.assets.get('assets/red.bmp')!;
    assert.equal(bytes[0],66);assert.equal(bytes[1],77);assert.equal(calls,0);
  } finally {globalThis.Uint8Array=Bytes;}
});
test('actual worker rejects invalid linked identity before Blob import or GPU access',async t=>{
  const originals=new Map<string,PropertyDescriptor|undefined>();
  const replace=(key:string,value:any)=>{originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});};
  let imports=0,gpu=0;
  const oldUrl=URL.createObjectURL;
  URL.createObjectURL=()=>{imports++;throw Error('unexpected import');};
  replace('onmessage',null);replace('navigator',{get gpu(){gpu++;throw Error('unexpected GPU');}});
  const failure=new Promise<any>(resolve=>replace('postMessage',(message:any)=>{if(message.type==='failure')resolve(message);}));
  t.after(()=>{URL.createObjectURL=oldUrl;for(const [key,descriptor] of originals)descriptor?Object.defineProperty(globalThis,key,descriptor):Reflect.deleteProperty(globalThis,key);});
  await import(`../../apps/studio/src/visual-worker.mjs?asset-order=${crypto.randomUUID()}`);
  (globalThis as any).onmessage({data:{type:'init',instanceId:'cpu',generation:1,revisionId:'revision',linked:{...await payload(),linkedHash:'0'.repeat(64)},settings:{width:1920,height:1080,fps:60,seed:0},controls:{intensity:0.5}}});
  const result=await failure;
  assert.match(result.message,/hash mismatch/i);assert.equal(imports,0);assert.equal(gpu,0);
});

test('actual worker exposes verified assets during create and missing keys fail before readiness',async t=>{
  const originals=new Map<string,PropertyDescriptor|undefined>();
  const replace=(key:string,value:any)=>{if(!originals.has(key))originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});};
  const oldUrl=URL.createObjectURL;
  const makeCode=(sdkVersion:string,controls:unknown)=>`export default {sdkVersion:${JSON.stringify(sdkVersion)},controls:${JSON.stringify(controls)},async create(context){
    const bytes=context.assets.get('assets/red.bmp');if(!bytes)throw Error('Missing required asset: assets/red.bmp');
    if(bytes[0]!==66||bytes[1]!==77||context.assets.set||!Object.isFrozen(context.assets))throw Error('Invalid asset context');
    bytes[0]=0;if(context.assets.get('assets/red.bmp')[0]!==66)throw Error('Shared private storage');
    return {update(){},render(){},reset(){},dispose(){}};
  }};
  export class WebGPURenderer {backend={isWebGPUBackend:true};setSize(){}async init(){}dispose(){}}
  export class RenderTarget {texture={};dispose(){}}
  export class MeshBasicNodeMaterial {dispose(){}}
  export class QuadMesh {constructor(material){this.material=material;}}
  export const SRGBColorSpace='srgb';export const sampleTexture=()=>({});`;
  let code='';
  URL.createObjectURL=()=>`data:text/javascript,${encodeURIComponent(code)}`;
  replace('navigator',{gpu:{requestAdapter:async()=>({requestDevice:async()=>({lost:new Promise(()=>{}),queue:{onSubmittedWorkDone:async()=>{}},destroy(){}})})}});
  replace('onmessage',null);replace('close',()=>{});
  t.after(()=>{URL.createObjectURL=oldUrl;for(const [key,descriptor] of originals)descriptor?Object.defineProperty(globalThis,key,descriptor):Reflect.deleteProperty(globalThis,key);});
  for(const sdkVersion of ['0.1.0','0.2.0']) for(const missing of [false,true]) {
    const controls=normalizeControlDeclarations(sdkVersion==='0.1.0'?{intensity:{type:'number',label:'Intensity',default:0.5,min:0,max:1}}:{height:{type:'number',label:'Height',default:1,min:0,max:4}});
    const controlSchemaHash=hash(canonicalControlSchemaJson(controls));
    code=makeCode(sdkVersion,controls);
    const original:any=await payload();
    const assetFields=missing?await deriveAssets({},hash):{assets:original.assets,assetSetHash:original.assetSetHash};
    const body=linkedBody({...original,code,...assetFields,...(sdkVersion==='0.2.0'?{linkedVersion:3,controls,controlSchemaHash}:{})});const linked={...body,linkedHash:hash(JSON.stringify(body))};
    const result=new Promise<any>(resolve=>replace('postMessage',(message:any)=>{if(['ready','failure'].includes(message.type))resolve(message);}));
    await import(`../../apps/studio/src/visual-worker.mjs?asset-create=${crypto.randomUUID()}`);
    const identity={instanceId:'cpu',generation:1,revisionId:'revision'};
    (globalThis as any).onmessage({data:{type:'init',...identity,linked,settings:{width:1920,height:1080,fps:60,seed:0},sdkVersion,controlSchema:controls,controlSchemaHash,controls:Object.fromEntries(controls.map(row=>[row.id,row.default]))}});
    const message=await result;
    if(missing) {assert.equal(message.type,'failure');assert.match(message.message,/Missing required asset: assets\/red.bmp/);}
    else {
      assert.equal(message.type,'ready',message.message);
      const disposed=new Promise<void>(resolve=>replace('close',resolve));
      (globalThis as any).onmessage({data:{type:'dispose',...identity}});await disposed;
    }
  }
});
