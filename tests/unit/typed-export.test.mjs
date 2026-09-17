import test from 'node:test';
import assert from 'node:assert/strict';
import {assertNumericExportControls} from '../../scripts/transport-prepare.mjs';
import {prepareTransportScene} from '../../scripts/transport-prepare.mjs';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {SceneFileStore} from '../../packages/core/src/scene-file.ts';
import {compositionSourceBundle,ballId} from '../compiler/composition-fixture.mjs';

test('export preflight names unsupported typed controls before preparation',()=>{
  assert.doesNotThrow(()=>assertNumericExportControls([{id:'speed',type:'number'}]));
  for(const type of ['boolean','enum','trigger'])assert.throws(()=>assertNumericExportControls([{id:'palette',type}]),new RegExp(`Resolume.*palette.*${type}`));
});

for(const type of ['boolean','trigger'])test(`export rejects current unexposed ${type} component controls even when saved schemas are stale`,async()=>{
  const folder=await mkdtemp(join(tmpdir(),'lux-stale-typed-export-'));
  try{
    const source=compositionSourceBundle();
    source.files['ball.ts']=source.files['ball.ts'].replace('controls:{intensity:',`controls:{hidden:{type:'${type}',label:'Hidden'${type==='boolean'?',default:false':''}},intensity:`);
    source.files['ball.ts']=source.files['ball.ts'].replace('controlDescriptions:{intensity:',"controlDescriptions:{hidden:'Unexposed switch',intensity:");
    const document={format:'lux-scene',version:4,source,settings:{width:1920,height:1080,fps:60,seed:0},controls:{sourceHash:'a'.repeat(64),nodes:[{nodePath:[ballId],definitionHash:'b'.repeat(64),schema:[],schemaHash:createHash('sha256').update('[]').digest('hex'),values:{}}]}};
    const filename=join(folder,'stale.lux-scene'),output=join(folder,'prepared');
    await new SceneFileStore().saveAs(filename,document);
    await assert.rejects(prepareTransportScene(filename,output),new RegExp(`Resolume.*hidden.*${type}`));
    await assert.rejects(readdir(output),{code:'ENOENT'},'preflight must fail before linked transport files are written');
  }finally{await rm(folder,{recursive:true,force:true});}
});
