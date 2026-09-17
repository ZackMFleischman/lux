import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {SceneFileStore} from '../../packages/core/src/scene-file.ts';
import {createSceneDocument,validateSceneDocument} from '../../packages/core/src/scene-document.ts';
import {normalizeControlDeclarations,canonicalControlSchemaJson} from '../../packages/runtime-contracts/src/parameters.mjs';
import {nodeIdSchema} from '../../packages/runtime-contracts/src/identities.ts';
import {exportSceneDocument} from '../../scripts/studio-export.mjs';

test('flat and per-node typed controls survive file save/open with option IDs and guards intact',async()=>{
  const schema=normalizeControlDeclarations({visible:{type:'boolean',label:'Visible',default:true},palette:{type:'enum',label:'Palette',default:'cool',options:[{id:'cool',label:'Cool'},{id:'warm',label:'Warm'}]}});
  const snapshot={sourceHash:'a'.repeat(64),schema,schemaHash:createHash('sha256').update(canonicalControlSchemaJson(schema)).digest('hex'),values:{visible:false,palette:'warm'}};
  const settings={width:640,height:360,fps:60,seed:0},folder=await mkdtemp(join(tmpdir(),'lux-typed-scene-'));
  try{
    const flat=createSceneDocument({sdkVersion:'0.2.0',entry:'visual.ts',files:{'visual.ts':'export {}'}},settings,snapshot);
    const nodes=createSceneDocument({sdkVersion:'0.4.0',entry:'visual.ts',files:{'visual.ts':'export {}'}},settings,{sourceHash:snapshot.sourceHash,nodes:[{nodePath:[nodeIdSchema.parse('11111111-1111-4111-8111-111111111111')],definitionHash:'b'.repeat(64),schema,schemaHash:snapshot.schemaHash,values:snapshot.values}]});
    for(const document of [flat,nodes]){
      const filename=join(folder,`${document.version}.lux-scene`);
      await new SceneFileStore().saveAs(filename,document);
      assert.deepEqual((await new SceneFileStore().open(filename)).document,document);
      let prepared=false;
      await assert.rejects(exportSceneDocument({name:'Typed',document,outputDirectory:folder},{prepare:async()=>{prepared=true;throw Error('unexpected prepare');},exporter:async()=>{throw Error('unexpected package');}}),/Resolume.*visible.*boolean/);
      assert.equal(prepared,false,'unsupported types fail before compiler or package preparation');
    }
  }finally{await rm(folder,{recursive:true,force:true});}
});

test('trigger declarations round trip while invocations and trigger values cannot enter a scene',async()=>{
  const schema=normalizeControlDeclarations({turn:{type:'trigger',label:'Turn'}});
  const snapshot={sourceHash:'a'.repeat(64),schema,schemaHash:createHash('sha256').update(canonicalControlSchemaJson(schema)).digest('hex'),values:{}};
  const source={sdkVersion:'0.2.0' as const,entry:'visual.ts',files:{'visual.ts':'export {}'}};
  const settings={width:640,height:360,fps:60,seed:0};
  const document=createSceneDocument(source,settings,snapshot);
  assert.deepEqual(validateSceneDocument(JSON.parse(JSON.stringify(document))),document);
  assert.throws(()=>createSceneDocument(source,settings,{...snapshot,values:{turn:1}}),/Trigger controls use the trigger command/);
  assert.throws(()=>validateSceneDocument({...document,triggerReceipt:{commandId:'click-1'}}),/unsupported scene fields/);
  let prepared=false;
  await assert.rejects(exportSceneDocument({name:'Actions',document,outputDirectory:join(tmpdir(),'lux-trigger-export-unused')},{prepare:async()=>{prepared=true;throw Error('unexpected prepare');},exporter:async()=>{throw Error('unexpected package');}}),/Resolume.*turn.*trigger/);
  assert.equal(prepared,false);
});
