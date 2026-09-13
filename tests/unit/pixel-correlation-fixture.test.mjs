import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';
import {prepareTransportScene} from '../../scripts/transport-prepare.mjs';import releaseIO from '../../tools/gpu-spike/transport-release.cjs';
test('single-control pixel fixture compiles with exact integer steps and initial zero',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'lux-pixel-fixture-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const result=await prepareTransportScene(fileURLToPath(new URL('../fixtures/installed-sources/pixel-correlation/scene.lux-scene',import.meta.url)),directory);
 const release=releaseIO.readTransportRelease(result.path);assert.equal(release.linked.linkedVersion,3);assert.deepEqual(release.linked.controls.map(x=>[x.id,x.min,x.max,x.step,x.default]),[['probeStep',0,8,1,0]]);assert.deepEqual(result.savedControls,{probeStep:0});
 assert.match(release.linked.code,/frameNumber.value = frame.tick \+ 1/);assert.match(release.linked.code,/version.value = frame.controls.probeStep/);
});
