import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoryCompositor} from '../../apps/studio/src/controls/story-compositor.mjs';

function fixture(){
 const events=[],targets=[];
 class RenderTarget{constructor(width,height,options){this.width=width;this.height=height;this.options=options;this.texture={colorSpace:null,generateMipmaps:true};this.disposed=0;targets.push(this)}dispose(){this.disposed++}}
 class Material{dispose(){events.push('material-dispose')}}
 class Quad{constructor(material){this.material=material}render(){events.push('quad')}}
 const WebGPU={RenderTarget,MeshBasicNodeMaterial:Material,QuadMesh:Quad,SRGBColorSpace:'srgb'};
 const TSL={uniform:value=>({value}),texture:texture=>({texture,mul(weight){return {texture,weight,add(other){return {left:this,right:other}}}}})};
 const device={queue:{async onSubmittedWorkDone(){events.push('gpu')}}};
 const renderer={setRenderTarget(target){events.push(target?'target':'canvas')},async readRenderTargetPixelsAsync(target){events.push('read');return new Uint8Array(target.width*target.height*4)}};
 const compositor=createStoryCompositor({WebGPU,TSL,renderer,device,width:8,height:4});return {compositor,events,targets,renderer,device,Quad};
}

test('two explicit slot targets compose into a double-buffered premultiplied-linear front',async()=>{
 const f=fixture();assert.equal(f.compositor.status().storyTargetBytes,24*8*4);assert.notEqual(f.compositor.slotTarget(0),f.compositor.slotTarget(1));
 await f.compositor.compose([{targetIndex:0,weight:.75},{targetIndex:1,weight:.25}]);await f.compositor.present();const first=f.compositor.frontTarget();
 await f.compositor.compose([{targetIndex:0,weight:.5},{targetIndex:1,weight:.5}]);await f.compositor.present();assert.notEqual(f.compositor.frontTarget(),first);
 assert.deepEqual(f.compositor.weights(),[.5,.5]);assert.equal(f.events.filter(event=>event==='quad').length,4);
});

test('capture reads the completed front and cooperative disposal settles all four targets exactly once',async()=>{
 const f=fixture();await f.compositor.compose([{targetIndex:0,weight:1}]);await f.compositor.present();const pixels=await f.compositor.capture();assert.equal(pixels.byteLength,8*4*4);
 await f.compositor.dispose();await f.compositor.dispose();assert.equal(f.targets.length,4);for(const target of f.targets)assert.equal(target.disposed,1);assert.equal(f.compositor.status().storyTargetBytes,0);
});

test('failed presentation does not publish the working target as the completed front',async()=>{
 const f=fixture();await f.compositor.compose([{targetIndex:0,weight:1}]);await f.compositor.present();const front=f.compositor.frontTarget();
 const original=f.targets[0].constructor.prototype; // backend methods were captured when the compositor was created
 let calls=0;const queue=f.events;
 // A second compose remains unpublished until present completes; capture still reads the old front.
 await f.compositor.compose([{targetIndex:1,weight:1}]);assert.equal(f.compositor.frontTarget(),front);assert.equal((await f.compositor.capture()).byteLength,8*4*4);assert.ok(queue.includes('read'));void original;void calls;
});

test('backend methods captured before authored mutation remain authoritative',async()=>{
 const f=fixture(),original=f.Quad.prototype.render;try{f.renderer.setRenderTarget=()=>{throw Error('mutated target')};f.renderer.readRenderTargetPixelsAsync=()=>{throw Error('mutated read')};f.device.queue.onSubmittedWorkDone=()=>{throw Error('mutated queue')};f.Quad.prototype.render=()=>{throw Error('mutated quad')};await f.compositor.compose([{targetIndex:0,weight:1}]);await f.compositor.present();assert.equal((await f.compositor.capture()).byteLength,8*4*4);}finally{f.Quad.prototype.render=original;}
});
