import test from 'node:test';
import assert from 'node:assert/strict';
import {encode} from 'fast-png';
import {validateStoryInteropResult} from '../../scripts/story-interop/validate.mjs';

const png=()=>Array.from(encode({width:1,height:1,channels:4,depth:8,data:new Uint8Array([213,0,156,96])}));
const result=()=>({rendererBundle:'shared-runtime',foreignBundle:'tsl',foreignFeatures:['MeshLambertNodeMaterial','Fn','If','AmbientLight'],unproved:null,cleanup:{instanceDisposals:4,resourceDisposal:'complete',deviceDestroyed:true,sharedModules:{closed:true,ownedModuleURLs:0,importedEntries:3,pendingImports:0}},results:[0,1].map(pass=>({pass,pixel:[137,0,99,96],slotPixels:{ordinary:[188,0,0,128],tsl:[0,0,137,64]},png:png()})),publicTargets:[0,1,2,3].map(index=>({width:1,height:1,depthBuffer:index<2,stencilBuffer:false,samples:0,count:1,depth:1,format:1023,type:1009,colorSpace:'srgb',generateMipmaps:false})),textureDescriptors:[...Array.from({length:4},()=>({format:'rgba8unorm-srgb',sampleCount:1,mipLevelCount:1,size:{width:1,height:1,depthOrArrayLayers:1}})),...Array.from({length:2},()=>({format:'depth24plus',sampleCount:1,mipLevelCount:1,size:{width:1,height:1,depthOrArrayLayers:1}}))]});

test('Story interop result validates analytic premultiplied-linear slots, composition, PNG, targets, and cleanup',()=>assert.equal(validateStoryInteropResult(result(),{width:1,height:1}).results.length,2));
test('Story interop result rejects alpha drift and incomplete cleanup',()=>{const alpha=result();alpha.results[0].pixel[3]=70;assert.throws(()=>validateStoryInteropResult(alpha,{width:1,height:1}),/composed raw/);const cleanup=result();cleanup.cleanup.deviceDestroyed=false;assert.throws(()=>validateStoryInteropResult(cleanup,{width:1,height:1}));});
