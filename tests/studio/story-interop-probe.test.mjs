import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareStoryInteropProbe} from '../../scripts/story-interop-build.mjs';

test('Story interop probe uses two distinct normally linked SDK 0.2 bundles and the pinned target recipe',async()=>{
 const prepared=await prepareStoryInteropProbe({write:false});
 for(const row of [prepared.ordinary,prepared.tsl]){assert.equal(row.identity.sdkVersion,'0.2.0');assert.equal(row.identity.compilerVersion,'7.0.2');assert.match(row.identity.sourceHash,/^[a-f0-9]{64}$/);assert.match(row.identity.linkedHash,/^[a-f0-9]{64}$/);assert.ok(row.identity.linkedBytes<16*1024*1024);}
 assert.notEqual(prepared.ordinary.identity.sourceHash,prepared.tsl.identity.sourceHash);assert.notEqual(prepared.ordinary.identity.linkedHash,prepared.tsl.identity.linkedHash);
 assert.deepEqual(prepared.settings.slot,{count:2,depthBuffer:true,stencilBuffer:false,samples:0,mips:1,layers:1,logicalBytesPerPixel:8});
 assert.deepEqual(prepared.settings.composition,{count:2,depthBuffer:false,stencilBuffer:false,samples:0,mips:1,layers:1,logicalBytesPerPixel:4});
 assert.equal(prepared.settings.colorFormat,'rgba8unorm-srgb');assert.equal(prepared.settings.depthFormat,'depth24plus');
 assert.equal(prepared.capsule.kind,'lux-shared-visuals');assert.deepEqual(prepared.capsule.visuals.map(row=>row.id),['ordinary','tsl']);assert.ok(prepared.capsule.files.some(row=>row.path==='runtime.js'));
});
