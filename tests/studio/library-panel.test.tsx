import test,{after,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>',{url:'http://studio.test/'});
for(const name of ['window','document','navigator','HTMLElement','Element','Node','ShadowRoot','DocumentFragment','Event','KeyboardEvent','MouseEvent','getComputedStyle'] as const)Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{configurable:true,writable:true,value:true});
const {render,screen,cleanup,waitFor,fireEvent}=await import('@testing-library/react');
const {LibraryPanel}=await import('../../apps/studio/src/library/LibraryPanel.tsx');
const {completeLibraryMutation}=await import('../../apps/studio/src/library/library-mutation.ts');
afterEach(()=>cleanup());after(()=>dom.window.close());
const id='11111111-1111-4111-8111-111111111111';
const source={sdkVersion:'0.4.0' as const,entry:'component.ts',files:{'component.ts':'export default 1;','helper.ts':'export const value=1;'}};
test('library panel browses readable source and copies the exact agent request without inserting code',async()=>{
 const calls:string[]=[];const component={id,revision:2,name:'Shared Violet',description:'A reusable violet image.',updatedAt:'2026-09-13T20:00:00.000Z',source};
 const client={list:async()=>[component],read:async()=>{calls.push('read');return component;},copyRequest:async()=>{calls.push('copy');return 'request';},create:async()=>component,update:async()=>component};
 render(<LibraryPanel client={client} links={[]} updates={[]} fallbacks={[]} onApplyUpdates={async()=>{}} onFork={()=>{}} onError={reason=>assert.fail(String(reason))}/>);
 await waitFor(()=>screen.getByRole('button',{name:/Shared Violet/}));
 assert.ok(screen.getByText('A reusable violet image.'));
 fireEvent.click(screen.getByRole('button',{name:/Shared Violet/}));
 await waitFor(()=>screen.getByText('export default 1;'));
 fireEvent.click(screen.getByRole('button',{name:'helper.ts'}));assert.ok(screen.getByText('export const value=1;'));
 fireEvent.click(screen.getByRole('button',{name:'Copy agent request'}));
 await waitFor(()=>assert.deepEqual(calls,['read','copy']));assert.ok(screen.getByRole('status').textContent?.includes('copied'));
});
test('library panel offers explicit apply and fork actions with visible fallback status',async()=>{
 const actions:string[]=[];const component={id,revision:2,name:'Shared Violet',description:'A reusable violet image.',updatedAt:'2026-09-13T20:00:00.000Z',source};
 const client={list:async()=>[component],read:async()=>component,copyRequest:async()=>'request',create:async()=>component,update:async()=>component};
 render(<LibraryPanel client={client} links={[{componentId:id,mountPath:'library/shared',resolvedRevision:1,files:['library/shared/component.ts']}]} updates={[{componentId:id,name:'Shared Violet',resolvedRevision:1,availableRevision:2}]} fallbacks={[{componentId:id,resolvedRevision:1,message:'Library missing'}]} onApplyUpdates={async()=>{actions.push('apply');}} onFork={value=>actions.push(`fork:${value}`)} onError={reason=>assert.fail(String(reason))}/>);
 await waitFor(()=>screen.getByText(/revision 2 is available/i));assert.ok(screen.getByText(/using saved revision 1/i));
 fireEvent.click(screen.getByRole('button',{name:'Apply update'}));fireEvent.click(screen.getByRole('button',{name:'Fork Shared Violet'}));
 await waitFor(()=>assert.deepEqual(actions,['apply',`fork:${id}`]));
});
test('refresh advances the selected summary and readable source together',async()=>{
 let current={id,revision:1,name:'Shared Violet',description:'A reusable violet image.',updatedAt:'2026-09-13T20:00:00.000Z',source};
 const client={list:async()=>[current],read:async()=>current,copyRequest:async()=>'request',create:async()=>current,update:async()=>current};
 render(<LibraryPanel client={client} links={[]} updates={[]} fallbacks={[]} onApplyUpdates={async()=>{}} onFork={()=>{}} onError={reason=>assert.fail(String(reason))}/>);
 fireEvent.click(await screen.findByRole('button',{name:/Shared Violet/}));await screen.findByText('export default 1;');
 current={...current,revision:2,source:{...source,files:{...source.files,'component.ts':'export default 2;'}}};
 fireEvent.click(screen.getByRole('button',{name:'Refresh'}));
 await waitFor(()=>assert.ok(screen.getByText('r2')));assert.ok(screen.getByText('export default 2;'));assert.equal(screen.queryByText('export default 1;'),null);
});
test('a late inspection response cannot replace the user’s newer selection',async()=>{
 const alpha={id,revision:1,name:'Alpha',description:'Alpha description.',updatedAt:'2026-09-13T20:00:00.000Z',source:{...source,files:{'component.ts':'alpha source'}}};
 const beta={...alpha,id:'22222222-2222-4222-8222-222222222222',name:'Beta',description:'Beta description.',source:{...source,files:{'component.ts':'beta source'}}};
 let resolveAlpha!:(value:typeof alpha)=>void,resolveBeta!:(value:typeof beta)=>void;
 const client={list:async()=>[alpha,beta],read:(value:string)=>new Promise<any>(resolve=>value===alpha.id?resolveAlpha=resolve:resolveBeta=resolve),copyRequest:async()=>'request',create:async()=>alpha,update:async()=>alpha};
 render(<LibraryPanel client={client} links={[]} updates={[]} fallbacks={[]} onApplyUpdates={async()=>{}} onFork={()=>{}} onError={reason=>assert.fail(String(reason))}/>);
 fireEvent.click(await screen.findByRole('button',{name:/Alpha/}));fireEvent.click(screen.getByRole('button',{name:/Beta/}));
 resolveBeta(beta);await screen.findByText('beta source');resolveAlpha(alpha);await new Promise(resolve=>setTimeout(resolve,0));
 assert.ok(screen.getByText('beta source'));assert.equal(screen.queryByText('alpha source'),null);assert.equal(screen.getByRole('button',{name:/Beta/}).getAttribute('aria-pressed'),'true');
});
test('a committed library mutation remains successful while a busy scene refresh retries',async()=>{
 let revision=0,refreshes=0;const errors:unknown[]=[];
 const create=()=>completeLibraryMutation(async()=>({revision:++revision}),async()=>{if(refreshes++===0)throw Error('Studio is busy');},reason=>errors.push(reason),async()=>{});
 assert.deepEqual(await create(),{revision:1});await waitFor(()=>assert.equal(refreshes,2));assert.deepEqual(errors,[]);
 const update=(expected:number)=>completeLibraryMutation(async()=>{if(expected!==revision)throw Error('revision conflict');return {revision:++revision};},async()=>{},reason=>errors.push(reason));
 assert.deepEqual(await update(1),{revision:2});await assert.rejects(update(1),/revision conflict/);assert.deepEqual(errors,[]);
});
