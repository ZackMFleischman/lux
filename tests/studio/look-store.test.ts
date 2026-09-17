import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LookStore} from '../../packages/core/src/look-store.ts';
import {createSceneDocument} from '../../packages/core/src/scene-document.ts';
import {DEFAULT_OUTPUT} from '../../packages/runtime-contracts/src/index.ts';
const document=createSceneDocument({sdkVersion:'0.1.0',entry:'visual.ts',files:{'visual.ts':'export default {}'}},DEFAULT_OUTPUT,{intensity:.4});
test('Looks persist separately, reject collisions and stale updates, and keep prior bytes on failed write',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'lux-looks-'));
 try{
 const store=new LookStore(directory),first=await store.save({name:'Amber',document});
  const reopened=(await new LookStore(directory).read(first.id)).document;
  assert.equal(reopened.version,1);
  assert.deepEqual(reopened.controls,{intensity:.4});
  await assert.rejects(store.save({name:'  AMBER  ',document}),/name/i);
  const second=await store.save({name:'Blue',document});assert.notEqual(first.id,second.id);
  await assert.rejects(store.save({id:first.id,expectedRevision:0,name:'Amber',document}),/revision/i);
  const before=await readFile(join(directory,first.id+'.json'),'utf8');
  const failing=new LookStore(directory,{beforeRename:async()=>{throw Error('interrupted write');}});
  await assert.rejects(failing.save({id:first.id,expectedRevision:first.revision,name:'Amber',document}),/interrupted/);
  assert.equal(await readFile(join(directory,first.id+'.json'),'utf8'),before);
  await writeFile(join(directory,second.id+'.json'),'{damaged');
  const rows=await store.list();assert.equal(rows.length,2);assert.ok(rows.find(row=>row.id===second.id)?.error);
  assert.equal((await store.read(first.id)).name,'Amber');
  await assert.rejects(store.read('../escape'),/ID/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
