import assert from 'node:assert/strict';
import {decode} from 'fast-png';

const close=(actual,expected,tolerance,label)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: expected ${expected}±${tolerance}, received ${actual}`);
const pixel=(image,width,height)=>Array.from(image.data.slice(((Math.floor(height/2)*width)+Math.floor(width/2))*4,((Math.floor(height/2)*width)+Math.floor(width/2))*4+4));

export function validateStoryInteropResult(result,{width=64,height=64}={}){
 assert.equal(result.rendererBundle,'shared-runtime');assert.equal(result.foreignBundle,'tsl');
 assert.deepEqual(result.foreignFeatures,['MeshLambertNodeMaterial','Fn','If','AmbientLight']);assert.equal(result.unproved,null);
 assert.deepEqual(result.cleanup,{instanceDisposals:4,resourceDisposal:'complete',deviceDestroyed:true,sharedModules:{closed:true,ownedModuleURLs:0,importedEntries:3,pendingImports:0}});assert.equal(result.results.length,2);
 for(const [index,row] of result.results.entries()){
  const ordinary=row.slotPixels.ordinary,tsl=row.slotPixels.tsl,composed=row.pixel;
  [[ordinary,[188,0,0,128],'ordinary slot'],[tsl,[0,0,137,64],'foreign TSL slot'],[composed,[137,0,99,96],'composed raw']].forEach(([actual,expected,label])=>expected.forEach((want,channel)=>close(actual[channel],want,3,`pass ${index+1} ${label} channel ${channel}`)));
  const image=decode(Uint8Array.from(row.png));assert.equal(image.width,width);assert.equal(image.height,height);const captured=pixel(image,width,height);
  [213,0,156,96].forEach((want,channel)=>close(captured[channel],want,4,`pass ${index+1} PNG channel ${channel}`));row.capturedPixel=captured;
 }
 assert.deepEqual(result.results[0].pixel,result.results[1].pixel);assert.deepEqual(result.results[0].slotPixels,result.results[1].slotPixels);
 assert.equal(result.publicTargets.length,4);for(const [index,target] of result.publicTargets.entries())assert.deepEqual(target,{width,height,depthBuffer:index<2,stencilBuffer:false,samples:0,count:1,depth:1,format:1023,type:1009,colorSpace:'srgb',generateMipmaps:false});
 const colors=result.textureDescriptors.filter(row=>row.format==='rgba8unorm-srgb'),depths=result.textureDescriptors.filter(row=>row.format==='depth24plus');assert.ok(colors.length>=4,'real GPU descriptors include four sRGB color attachments');assert.ok(depths.length>=2,'real GPU descriptors include two depth24plus attachments');
 for(const row of [...colors,...depths]){assert.equal(row.sampleCount,1);assert.equal(row.mipLevelCount,1);assert.equal(row.size.width,width);assert.equal(row.size.height,height);assert.equal(row.size.depthOrArrayLayers,1);}
 return result;
}
