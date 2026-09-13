import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareTransportScene } from '../../scripts/transport-prepare.mjs';
import {readFile,rm} from 'node:fs/promises';
import {SceneFileStore,createSceneDocument} from '../../packages/core/src/scene-file.ts';
import {sceneSourceHash,sceneHash} from '../../packages/core/src/scene-document.ts';
import {normalizeControlDeclarations,canonicalControlSchemaJson} from '../../packages/runtime-contracts/src/parameters.mjs';
import transportIO from '../../tools/gpu-spike/transport-release.cjs';

test('saved-scene preparation rejects forbidden imports without publishing a release', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lux-prepare-rejection-'));
  const filename = join(directory, 'invalid.lux-scene'), output = join(directory, 'releases');
  await writeFile(filename, JSON.stringify({ format: 'lux-scene', version: 1,
    source: { sdkVersion: '0.1.0', entry: 'main.ts', files: {
      'main.ts': "import fs from 'node:fs'; export default fs;",
    } }, settings: { width: 1920, height: 1080, fps: 60, seed: 7 }, controls: { intensity: 0.91 },
  }));
  await assert.rejects(prepareTransportScene(filename, output), /import|allow|node:fs/i);
  await assert.rejects(access(output), { code: 'ENOENT' });
});

test('SDK 0.2 transport preserves declared controls, saved values and original JPEG bytes',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'lux-parameter-transport-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const declarations={gain:{type:'number',label:'Gain',min:-2,max:4,default:1}};
 const image=await readFile(new URL('../assets/fixtures/jpeg/baseline.jpg',import.meta.url));
 const source={sourceVersion:2,sdkVersion:'0.2.0',entry:'main.ts',files:{'main.ts':`import {defineVisual} from '@lux/visual-sdk';export default defineVisual({controls:${JSON.stringify(declarations)},async create(){return{update(frame){const value:number=frame.controls.gain;},render(){},reset(){},dispose(){}};}});`},assets:{'assets/test.jpg':{mediaType:'image/jpeg',encoding:'base64',data:image.toString('base64')}}};
 const schema=normalizeControlDeclarations(declarations),controls={sourceHash:await sceneSourceHash(source),schema,schemaHash:await sceneHash(canonicalControlSchemaJson(schema)),values:{gain:2.75}};
 const scene=join(directory,'scene.lux-scene');await new SceneFileStore().saveAs(scene,createSceneDocument(source,{width:1920,height:1080,fps:60,seed:7},controls));
 const prepared=await prepareTransportScene(scene,join(directory,'prepared')),loaded=transportIO.readTransportRelease(prepared.path);
 assert.equal(loaded.linked.linkedVersion,3);assert.deepEqual(prepared.savedControls,{gain:2.75});assert.equal(loaded.linked.assets['assets/test.jpg'].data,image.toString('base64'));assert.deepEqual(loaded.linked.controls,schema);
});
