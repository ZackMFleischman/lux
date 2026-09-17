import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSceneDocument,verifySceneDocument} from '../../packages/core/src/scene-document.ts';
import {canonicalControlSchemaJson,normalizeControlDeclarations} from '../../packages/runtime-contracts/src/parameters.mjs';
import {DEFAULT_OUTPUT} from '../../packages/runtime-contracts/src/index.ts';

test('flat scene saves animation separately from its base value and reopens it',async()=>{
  const schema=normalizeControlDeclarations({speed:{type:'number',label:'Speed',min:0,max:10,default:2}});
  const schemaHash=createHash('sha256').update(canonicalControlSchemaJson(schema)).digest('hex');
  const controls={sourceHash:'a'.repeat(64),schema,schemaHash,values:{speed:3}};
  const source={sdkVersion:'0.2.0' as const,entry:'visual.ts',files:{'visual.ts':'export {}'}};
  const animations=[{kind:'variation' as const,nodePath:[],definitionHash:schemaHash,schemaHash,controlId:'speed',distribution:'centered' as const,amount:1,enabled:true}];
  const saved=createSceneDocument(source,DEFAULT_OUTPUT,controls,[],animations);
  const reopened=await verifySceneDocument(JSON.parse(JSON.stringify(saved)));
  assert.equal(reopened.version,3);
  assert.deepEqual(reopened.controlAnimations,animations);
  assert.deepEqual(reopened.controls,controls);
});

test('legacy intensity scenes retain their original controls and optional animation',async()=>{
  const source={sdkVersion:'0.1.0' as const,entry:'visual.ts',files:{'visual.ts':'export {}'}};
  const animations=[{nodePath:[],definitionHash:'a'.repeat(64),schemaHash:'a'.repeat(64),controlId:'intensity',shape:'triangle' as const,periodSeconds:4,amount:.2,phase:0,enabled:true}];
  const saved=createSceneDocument(source,DEFAULT_OUTPUT,{intensity:.6},[],animations);
  const reopened=await verifySceneDocument(JSON.parse(JSON.stringify(saved)));
  assert.equal(reopened.version,1);
  assert.deepEqual(reopened.controls,{intensity:.6});
  assert.deepEqual(reopened.controlAnimations,animations);
});

test('audio animation persists only portable source identity and smoothing settings',async()=>{
  const schema=normalizeControlDeclarations({speed:{type:'number',label:'Speed',min:0,max:10,default:2}});
  const schemaHash=createHash('sha256').update(canonicalControlSchemaJson(schema)).digest('hex');
  const controls={sourceHash:'a'.repeat(64),schema,schemaHash,values:{speed:3}};
  const source={sdkVersion:'0.2.0' as const,entry:'visual.ts',files:{'visual.ts':'export {}'}};
  const animations=[{kind:'audio' as const,nodePath:[],definitionHash:schemaHash,schemaHash,controlId:'speed',
    source:{kind:'audio-band' as const,logicalInputId:'primary-audio' as const,band:'highs' as const,
      analyzer:{version:1 as const,fftSize:2048 as const,minDecibels:-100,maxDecibels:-30}},
    amount:2,attackMs:50,releaseMs:400,enabled:true}];
  const saved=createSceneDocument(source,DEFAULT_OUTPUT,controls,[],animations);
  const serialized=JSON.stringify(saved);
  assert.equal(serialized.includes('deviceId'),false);
  const reopened=await verifySceneDocument(JSON.parse(serialized));
  assert.equal(reopened.version,3);
  assert.deepEqual(reopened.controlAnimations,animations);
  assert.deepEqual(reopened.controls,controls);
});

test('all scene versions normalize and persist a bounded manual tempo',async()=>{
 const source={sdkVersion:'0.1.0' as const,entry:'visual.ts',files:{'visual.ts':'export {}'}};
 const withoutTempo:any={format:'lux-scene',version:1,source,settings:DEFAULT_OUTPUT,controls:{intensity:.5}};
 const normalized=await verifySceneDocument(withoutTempo);
 assert.deepEqual(normalized.tempo,{bpm:120});
 const saved=createSceneDocument(source,DEFAULT_OUTPUT,{intensity:.5},[],[],{bpm:137.5});
 assert.deepEqual(saved.tempo,{bpm:137.5});
 assert.deepEqual((await verifySceneDocument(JSON.parse(JSON.stringify(saved)))).tempo,{bpm:137.5});
 assert.throws(()=>createSceneDocument(source,DEFAULT_OUTPUT,{intensity:.5},[],[],{bpm:19.99}),/tempo/i);
});
