import test from 'node:test';
import assert from 'node:assert/strict';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
test('single-image runtime admits only the current owned token and one render per epoch',async()=>{
 const {createSingleImageVisual}=await import('../../packages/runtime/src/components/single-image.ts');
 let writes=0,old:any,context:any,output:any,mode='valid',disposed=0;
 const instance={update(){},async evaluate(_inputs:any,c:any){context=c;const token=await c.render({},{});if(mode==='double')await c.render({},{});output={image:token};if(mode==='clone')output.image={...token};if(mode==='old')output.image=old;if(mode==='getter')output={get image(){throw Error('getter ran');}};old=token;return output;},reset(){},dispose(){disposed++;}};
 const v=createSingleImageVisual(instance,{width:10,height:20,render(){writes++;}});
 await v.render();assert.equal(writes,1);await assert.rejects(context.render({},{}),/epoch|closed/i);
 for(mode of ['clone','old','getter','double'])await assert.rejects(v.render(),/token|output|render/i);
 await v.dispose();await v.dispose();assert.equal(disposed,1);
});
test('abandoned asynchronous render is independently observed, invalidated, and drained before reset/dispose',async()=>{
 const {createSingleImageVisual}=await import('../../packages/runtime/src/components/single-image.ts');
 for(const behavior of ['throw','invalid']) {
  const gate=deferred();let disposed=0,resets:number[]=[],issued=false;
  const v=createSingleImageVisual({update(){},async evaluate(_i:any,c:any){c.render({},{}).then(()=>issued=true,()=>{});if(behavior==='throw')throw Error('primary');return {} as any;},reset(seed:number){resets.push(seed);},dispose(){disposed++;}},{width:10,height:20,render:()=>gate.promise});
  await assert.rejects(v.render(),behavior==='throw'?/primary/:/output/);
  const reset=v.reset(3);await Promise.resolve();assert.deepEqual(resets,[]);gate.resolve();await reset;assert.equal(issued,false);assert.deepEqual(resets,[3]);
  await v.reset(4);assert.deepEqual(resets,[3,4]);await v.dispose();assert.equal(disposed,1);
 }
});
test('pending backend rejection cannot become an unhandled rejection or replace the primary error',async()=>{
 const {createSingleImageVisual}=await import('../../packages/runtime/src/components/single-image.ts');
 const v=createSingleImageVisual({update(){},async evaluate(_i:any,c:any){c.render({},{});throw Error('primary');},reset(){},dispose(){}},{width:1,height:1,render:async()=>{throw Error('backend');}});
 await assert.rejects(v.render(),/primary/);await v.dispose();await new Promise(r=>setImmediate(r));
});
test('reentrant backend cannot replace the tracked pending render with its rejected second call',async()=>{
 const {createSingleImageVisual}=await import('../../packages/runtime/src/components/single-image.ts');
 const gate=deferred();let context:any,disposed=0;
 const v=createSingleImageVisual({update(){},async evaluate(_i:any,c:any){context=c;c.render({},{});throw Error('primary');},reset(){},dispose(){disposed++;}},{width:1,height:1,render(){context.render({},{});return gate.promise;}});
 await assert.rejects(v.render(),/primary/);const disposal=v.dispose();await Promise.resolve();await Promise.resolve();assert.equal(disposed,0);gate.resolve();await disposal;assert.equal(disposed,1);
});
test('tokens cannot cross owners or resets and captured lifecycle methods cannot be replaced',async()=>{
 const {createSingleImageVisual}=await import('../../packages/runtime/src/components/single-image.ts');
 let token:any,updates=0;
 const instance={update(){updates++;},async evaluate(_i:any,c:any){token=await c.render({},{});return {image:token};},reset(){},dispose(){}};
 const backend={width:1,height:1,render(){}};const first=createSingleImageVisual(instance,backend);await first.render();
 instance.update=()=>{throw Error('replaced');};first.update({tick:0,timeSeconds:0,deltaSeconds:0,controls:{},events:[]});assert.equal(updates,1);
 const second=createSingleImageVisual({...instance,async evaluate(){return {image:token};}},backend);await assert.rejects(second.render(),/token/);
 await first.reset(1);const third=createSingleImageVisual({...instance,async evaluate(){return {image:token};}},backend);await assert.rejects(third.render(),/token/);
});
