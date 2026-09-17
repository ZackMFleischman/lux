import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoryRenderScope} from '../../apps/studio/src/controls/story-render-scope.mjs';

test('an abandoned authored render is captured and drained before the callback settles',async()=>{
 const events=[];let release;
 const backend=new Promise(resolve=>release=resolve);
 const renderer={setRenderTarget(target){events.push(target?'target':'restore')},async render(){events.push('render');await backend;events.push('rendered')}};
 const scope=createStoryRenderScope({renderer,target:{}});
 let facade;
 const callback=scope.run(async value=>{facade=value;void value.render({},{});events.push('returned')});
 await Promise.resolve();await Promise.resolve();
 assert.deepEqual(events,['returned','target','render']);assert.equal(scope.status().pendingCallbacks,1);
 release();await callback;assert.deepEqual(events,['returned','target','render','rendered','restore']);assert.equal(scope.status().pendingCallbacks,0);
 await assert.rejects(facade.render({},{}),/Closed render callback/);
});

test('concurrent and late render calls reject while target restoration and drain remain exact',async()=>{
 const events=[];let release;
 const renderer={setRenderTarget(target){events.push(target?'target':'restore')},async render(){await new Promise(resolve=>release=resolve)}};
 const scope=createStoryRenderScope({renderer,target:{}});
 let second;
 const callback=scope.run(async facade=>{void facade.render({},{});second=facade.render({},{});await assert.rejects(second,/already in flight/)});
 await Promise.resolve();await Promise.resolve();release();await callback;assert.deepEqual(events,['target','restore']);
 await scope.close();assert.equal(scope.status().closed,true);await assert.rejects(scope.run(()=>{}),/closed/);
});

test('backend failure restores the target and is reported even when authored code ignores it',async()=>{
 const events=[],renderer={setRenderTarget(target){events.push(target?'target':'restore')},async render(){throw Error('backend')}};
 const scope=createStoryRenderScope({renderer,target:{}});
 await assert.rejects(scope.run(facade=>{void facade.render({},{});}),/backend/);
 assert.deepEqual(events,['target','restore']);
 await assert.rejects(scope.drain(),/backend/);
});

test('post-import intrinsic mutation cannot bypass callback ownership or drain',async()=>{
 const scope=createStoryRenderScope({renderer:{setRenderTarget(){},async render(){}},target:{}});
 const descriptors={resolve:Object.getOwnPropertyDescriptor(Promise,'resolve'),allSettled:Object.getOwnPropertyDescriptor(Promise,'allSettled'),from:Object.getOwnPropertyDescriptor(Array,'from'),add:Object.getOwnPropertyDescriptor(Set.prototype,'add')};
 try{
  Promise.resolve=()=>{throw Error('mutated resolve')};Promise.allSettled=()=>{throw Error('mutated allSettled')};Array.from=()=>{throw Error('mutated from')};Set.prototype.add=()=>{throw Error('mutated add')};
  await scope.run(facade=>facade.render({},{}));assert.equal(scope.status().pendingCallbacks,0);await scope.close();
 }finally{for(const [target,key,descriptor] of [[Promise,'resolve',descriptors.resolve],[Promise,'allSettled',descriptors.allSettled],[Array,'from',descriptors.from],[Set.prototype,'add',descriptors.add]])Object.defineProperty(target,key,descriptor);}
});
