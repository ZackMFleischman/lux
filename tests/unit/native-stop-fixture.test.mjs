import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {prepareTransportScene} from '../../scripts/transport-prepare.mjs';
import releaseIO from '../../tools/gpu-spike/transport-release.cjs';
import {fileURLToPath} from 'node:url';
test('inert hang fixture compiles and links with a disarmed saved host control',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'lux-stop-fixture-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const result=await prepareTransportScene(fileURLToPath(new URL('../fixtures/installed-sources/hung-js/scene.lux-scene',import.meta.url)),directory);
 const release=releaseIO.readTransportRelease(result.path);assert.equal(release.linked.linkedVersion,3);assert.deepEqual(release.linked.controls.map(row=>[row.id,row.default]),[['arm',0]]);assert.deepEqual(result.savedControls,{arm:0});
 assert.match(release.linked.code,/LUX_QA_INSTALLED_HANG_ENTERED/);
 assert.equal(release.linked.controls[0].min,-1);assert.equal(release.linked.controls[0].max,1);
 assert.match(release.linked.code,/recovered\.value = frame\.controls\.arm < 0 \? 1 : 0/);
 assert.match(release.linked.code,/\(recovered\.oneMinus\(\), recovered, 1, 1\)/);
});
