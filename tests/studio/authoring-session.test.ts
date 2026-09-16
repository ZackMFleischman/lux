import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceWorkspace } from '../../apps/studio/src/source/workspace.ts';
import { createAuthoringSession } from '../../apps/studio/src/source/authoring-session.ts';
import { createHash } from 'node:crypto';
import { normalizeControlDeclarations, canonicalControlSchemaJson, reconcileControlValues } from '../../packages/runtime-contracts/src/parameters.mjs';
import { validateSource } from '../../apps/build-worker/src/source-policy.mjs';
import { DEFAULT_OUTPUT } from '../../packages/runtime-contracts/src/index.ts';
import type { SourceBundle } from '../../packages/runtime-contracts/src/index.ts';
import { nodeIdSchema } from '../../packages/runtime-contracts/src/identities.ts';
import { createSceneDocument } from '../../packages/core/src/scene-document.ts';
const source = () => ({ sdkVersion: '0.1.0' as const, entry: 'main.ts', files: { 'main.ts': 'export {}', 'lib/color.ts': 'export const red = 1' } });
test('session reads, builds and saves a complete isolated draft', async () => {
  const w = createSourceWorkspace(source()), submitted: unknown[] = [], saved: any[] = [];
  const session = createAuthoringSession(w, { submit: async s => { submitted.push(s); },
    save: async request => { saved.push(request); return { token: 'saved', name: 'test.lux-scene' }; }, getControls: () => ({ intensity: 0.4 }),getTempo:()=>({bpm:136}) });
  w.edit('lib/color.ts', 'helper edit');
  const read = session.read(); read.source.files['main.ts'] = 'caller edit';
  assert.equal(w.getSnapshot().source.files['main.ts'], 'export {}');
  await session.build(session.read().source, session.read().draftVersion);
  assert.equal((submitted[0] as any).files['lib/color.ts'], 'helper edit');
  assert.equal(w.getSnapshot().dirty, true);
  await session.save(false);
  assert.equal(saved[0].document.source.files['lib/color.ts'], 'helper edit');
  assert.equal(saved[0].document.controls.intensity, 0.4);
  assert.deepEqual(saved[0].document.tempo,{bpm:136});
  assert.equal(w.getSnapshot().dirty, false);
  assert.equal(session.getSnapshot().name, 'test.lux-scene');
});
test('path save and reopen preserve the accepted preview resolution',async()=>{
  const output={width:640,height:360,fps:60,seed:0},accepted=createSceneDocument(source(),output,{intensity:.4});
  const w=createSourceWorkspace(source());let saved:any,submitted:any;
  const session=createAuthoringSession(w,{submit:async(_source,options)=>{submitted=options;},save:async()=>null,
    savePath:async request=>{saved=request.document;return {token:'saved',name:'audio.lux-scene'};},
    openPath:async()=>({token:'opened',name:'audio.lux-scene',document:saved}),acceptedDocument:()=>accepted,getOutput:()=>output,getControls:()=>({intensity:.4})});
  await session.savePath('audio.lux-scene',session.read().draftVersion,false);
  assert.deepEqual(saved.settings,output);
  await session.openPath('audio.lux-scene',session.read().draftVersion);
  assert.deepEqual(submitted.output,output);
  assert.deepEqual(submitted.savedTempo,{bpm:120});
});
test('cancelled/failed saves preserve dirty and an in-flight save excludes open/build/save', async () => {
  const w = createSourceWorkspace(source()); w.edit('main.ts', 'draft');
  let release!: (result: any) => void, opened = false;
  const session = createAuthoringSession(w, { submit: async () => assert.fail('must not submit'),
    save: () => new Promise(resolve => { release = resolve; }), getControls: () => ({ intensity: 0.5 }),
    open: async () => { opened = true; return null; } });
  const saving = session.save(false);
  await assert.rejects(session.build(source(), w.getSnapshot().version), /busy/);
  await assert.rejects(session.save(true), /busy/);
  await assert.rejects(session.open(), /busy/); assert.equal(opened, false);
  release(null); await saving; assert.equal(w.getSnapshot().dirty, true);
  const originalRelease=release;
  const newerSave = session.save(false); w.edit('main.ts', 'newer');
  while(release===originalRelease) await new Promise(resolve=>setTimeout(resolve,0));
  release({ token: 'saved', name: 'test' }); await newerSave; assert.equal(w.getSnapshot().dirty, true);
  const failing = createAuthoringSession(w, { submit: async () => {}, save: async () => { throw Error('disk'); }, getControls: () => ({ intensity: 0.5 }) });
  await assert.rejects(failing.save(false), /disk/); assert.equal(w.getSnapshot().dirty, true);
});

test('background builds keep runtime controls available while scene file operations protect them', async () => {
  const w=createSourceWorkspace(source());let finishBuild!:(value?:void)=>void,finishSave!:(value:any)=>void;
  const session=createAuthoringSession(w,{submit:()=>new Promise<void>(resolve=>{finishBuild=resolve;}),
    save:()=>new Promise(resolve=>{finishSave=resolve;}),getControls:()=>({intensity:.5})});
  const building=session.build(session.read().source,session.read().draftVersion);
  while(!finishBuild)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(session.getSnapshot().busy,true);assert.equal(session.getSnapshot().runtimeControlsAvailable,true);
  finishBuild();await building;
  const saving=session.save();while(!finishSave)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(session.getSnapshot().busy,true);assert.equal(session.getSnapshot().runtimeControlsAvailable,false);
  finishSave(null);await saving;assert.equal(session.getSnapshot().runtimeControlsAvailable,true);
});
test('stale build cannot submit and opening invalid code preserves the previous running identity', async () => {
  const w = createSourceWorkspace(source()); await w.submit(source(), 0, async () => {});
  let count = 0;
  const incoming = { ...source(), entry: 'other.ts', files: { 'other.ts': 'bad code', 'helper.ts': 'helper' } };
  const session = createAuthoringSession(w, { submit: async () => { count++; throw Error('compiler'); }, save: async () => null,
    getControls: () => ({ intensity: 0.5 }), open: async () => ({ token: 'new', name: 'new', document: {
      format: 'lux-scene', version: 1, source: incoming, settings: { width: 1920, height: 1080, fps: 60, seed: 0 }, controls: { intensity: 0.8 } } }) });
  await assert.rejects(session.build(source(), 0), /Editor changed/); assert.equal(count, 0);
  await assert.rejects(session.open(), /compiler/);
  assert.equal(w.getSnapshot().selectedFile, 'other.ts');
  assert.equal(w.getSnapshot().dirty, false);
  assert.equal(w.getSnapshot().hasRunningSource, true);
  assert.equal(w.getSnapshot().runningMatchesDraft, false);
  assert.equal(session.getSnapshot().name, 'new');
});

test('export validates a complete snapshot, excludes competing operations and preserves dirty state', async () => {
  const w = createSourceWorkspace(source()); w.edit('lib/color.ts', 'export const red = 0.2');
  const events: string[] = []; let captured: any, finish!: (value: any) => void;
  const session = createAuthoringSession(w, { submit: async s => { events.push('validated'); assert.equal(s.files['lib/color.ts'], 'export const red = 0.2'); },
    save: async () => null, getControls: () => ({ intensity: 0.42 }),
    export: async request => { events.push('export'); captured = request; return new Promise(resolve => { finish = resolve; }); } });
  const pending = session.exportSource('Tunnel');
  await assert.rejects(session.save(), /busy/);
  await assert.rejects(session.build(source(), w.getSnapshot().version), /busy/);
  while (!finish) await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(events, ['validated', 'export']);
  assert.equal(captured.name, 'Tunnel'); assert.equal(captured.document.controls.intensity, 0.42);
  assert.equal(captured.document.source.files['lib/color.ts'], 'export const red = 0.2');
  finish(null); assert.equal(await pending, null);
  assert.equal(w.getSnapshot().dirty, true); assert.equal(session.getSnapshot().busy, false);
});

test('failed preview validation prevents export and releases the session lock', async () => {
  const w = createSourceWorkspace(source());
  const session = createAuthoringSession(w, { submit: async () => { throw Error('invalid visual'); },
    save: async () => null, getControls: () => ({ intensity: 0.5 }), export: async () => assert.fail('invalid visual must not export') });
  await assert.rejects(session.exportSource('Broken'), /invalid visual/);
  assert.equal(session.getSnapshot().busy, false);
});

test('failed open preserves document controls through save and applies them when repaired', async () => {
  const w = createSourceWorkspace(source()), saved: any[] = [];
  let invalid = true, intensity = 0.2;
  const session = createAuthoringSession(w, { submit: async (_source, options) => { if (invalid) throw Error('broken source'); const controls=options!.savedControls!;assert.ok('values' in controls);intensity = controls.values.intensity!; },
    save: async request => { saved.push(request); return { token: 'opened', name: 'broken.lux-scene' }; },
    getControls: () => ({ intensity }),
    open: async () => ({ token: 'opened', name: 'broken.lux-scene', document: { format: 'lux-scene', version: 1,
      source: source(), settings: { width: 1920, height: 1080, fps: 60, seed: 0 }, controls: { intensity: 0.8 } } }) });
  await assert.rejects(session.open(), /broken source/);
  intensity = 0.3; session.controlsChanged();
  assert.equal(session.getSnapshot().controlsDirty, false, 'Previous preview controls do not mutate the newly opened document');
  await session.save(); assert.equal(saved[0].document.controls.intensity, 0.8);
  invalid = false; await session.build(session.read().source, session.read().draftVersion);
  assert.equal(intensity, 0.8);
  intensity = 0.9; session.controlsChanged(); await session.save();
  assert.equal(saved[1].document.controls.intensity, 0.9);
});

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const parameterSource = () => ({...source(),sdkVersion:'0.2.0' as const});
const parameterSchema = normalizeControlDeclarations({height:{type:'number',label:'Height',default:1,min:0,max:2}});
const cache = (s:SourceBundle=parameterSource(),schema=parameterSchema,values:Readonly<Record<string,number>>={height:1.8}) => ({sourceHash:hash(JSON.stringify(validateSource(s))),schema,schemaHash:hash(canonicalControlSchemaJson(schema)),values});

test('new SDK draft saves an empty cache without inventing controls or executing source', async () => {
  const w=createSourceWorkspace(parameterSource()); let saved:any;
  const session=createAuthoringSession(w,{submit:async()=>assert.fail('save must not compile'),save:async r=>{saved=r.document;return null;},getControlSnapshot:()=>null});
  await session.save();
  assert.equal(saved.version,3); assert.deepEqual(saved.controls,cache(parameterSource(),[],{}));
});

test('invalid draft save retains the accepted snapshot provenance, not the draft hash', async () => {
  const w=createSourceWorkspace(parameterSource()),accepted=cache(); let saved:any;
  const session=createAuthoringSession(w,{submit:async()=>{throw Error('invalid');},save:async r=>{saved=r.document;return null;},getControlSnapshot:()=>accepted});
  w.edit('main.ts','unfinished invalid draft');
  await assert.rejects(session.build(session.read().source,session.read().draftVersion),/invalid/);
  await session.save();
  assert.equal(saved.source.files['main.ts'],'unfinished invalid draft');assert.deepEqual(saved.controls,accepted);
  assert.notEqual(saved.controls.sourceHash,hash(JSON.stringify(validateSource(saved.source))));
});

test('opened parameters enter first candidate initialization and failed open retains document ownership', async () => {
  const incoming=cache(); const w=createSourceWorkspace(parameterSource()); let invalid=true,applied=cache(parameterSource(),parameterSchema,{height:0.2});
  let saved:any; const firstFrames:unknown[]=[];
  const nextSchema=normalizeControlDeclarations({height:{type:'number',label:'Height',default:0.4,min:0,max:1},speed:{type:'number',label:'Speed',default:2,min:0,max:3}});
  let changes:unknown;
  const session=createAuthoringSession(w,{getControlSnapshot:()=>applied,save:async r=>{saved=r.document;return null;},
    open:async()=>({token:'opened',name:'opened',document:{format:'lux-scene',version:3,source:parameterSource(),settings:{width:1920,height:1080,fps:60,seed:0},controls:incoming}}),
    submit:async(s,options)=>{ assert.deepEqual(options?.savedControls,incoming); if(invalid) throw Error('broken');
      const reconciled=reconcileControlValues(options!.savedControls!.schema,options!.savedControls!.values,nextSchema);
      changes=reconciled.changes;applied=cache(s,nextSchema,reconciled.values);firstFrames.push(applied.values);
    }});
  await assert.rejects(session.open(),/broken/);session.controlsChanged();assert.equal(session.getSnapshot().controlsDirty,false);
  await session.save();assert.deepEqual(saved.controls,incoming);
  invalid=false;await session.build(session.read().source,session.read().draftVersion);
  assert.deepEqual(firstFrames,[{height:0.4,speed:2}]);assert.deepEqual(changes,[{id:'height',reason:'out-of-range',previousValue:1.8,value:0.4},{id:'speed',reason:'added',value:2}]);
  await session.save();assert.deepEqual(saved.controls,applied);
});

test('scene export refuses accepted controls belonging to unrelated source', async () => {
  const w=createSourceWorkspace(parameterSource());w.edit('main.ts','changed');
  const session=createAuthoringSession(w,{submit:async()=>{},save:async()=>null,getControlSnapshot:()=>cache(),export:async()=>assert.fail('unrelated controls cannot export')});
  await assert.rejects(session.exportSource('visual'),/accepted.*source|source.*accepted/i);
});

test('invalid opened cache is rejected before replacing the current document or submitting', async () => {
  const w=createSourceWorkspace(parameterSource()),before=w.getSnapshot();let submitted=false;
  const session=createAuthoringSession(w,{submit:async()=>{submitted=true;},save:async()=>null,getControlSnapshot:()=>cache(),
    open:async()=>({token:'bad',name:'bad',document:{format:'lux-scene',version:3,source:parameterSource(),settings:{width:1920,height:1080,fps:60,seed:0},controls:{...cache(),schemaHash:'b'.repeat(64)}}})});
  await assert.rejects(session.open(),/schema hash/i);assert.equal(submitted,false);
  assert.equal(w.getSnapshot(),before);assert.equal(session.getSnapshot().name,'Untitled');
});

test('a successful SDK 0.2 build cannot save a missing accepted cache as an empty visual', async () => {
  const w=createSourceWorkspace(parameterSource());
  const session=createAuthoringSession(w,{submit:async()=>{},save:async()=>assert.fail('missing accepted snapshot'),getControlSnapshot:()=>null});
  await session.build(session.read().source,session.read().draftVersion);
  await assert.rejects(session.save(),/accepted controls.*unavailable/i);
});

test('opening a saved draft whose cache migrates marks the accepted controls dirty', async () => {
  const w=createSourceWorkspace(parameterSource()),incoming=cache(); let applied=cache();
  const changed={...parameterSource(),files:{'main.ts':'edited saved draft'}};
  const session=createAuthoringSession(w,{submit:async(s,options)=>{assert.deepEqual(options?.savedControls,incoming);applied=cache(s);},
    save:async()=>({token:'saved',name:'saved'}),getControlSnapshot:()=>applied,
    open:async()=>({token:'saved',name:'saved',document:{format:'lux-scene',version:3,source:changed,settings:{width:1920,height:1080,fps:60,seed:0},controls:incoming}})});
  await session.open();assert.equal(w.getSnapshot().dirty,false);assert.equal(session.getSnapshot().controlsDirty,true);
  await session.save();assert.equal(session.getSnapshot().controlsDirty,false);
});

const libraryId='11111111-1111-4111-8111-111111111111';
const compositionSource=()=>({sdkVersion:'0.4.0' as const,entry:'composition.ts',files:{'composition.ts':'import shared from "./library/shared/component.ts"; export default shared;'}});
const componentRecord=(revision:number,color:string)=>({id:libraryId,revision,name:'Shared color',description:'A shared color component.',updatedAt:'2026-09-13T20:00:00.000Z',source:{sdkVersion:'0.4.0' as const,entry:'component.ts',files:{'component.ts':`export const color = "${color}";`}}});
const compositionCache=(s:SourceBundle)=>({sourceHash:hash(JSON.stringify(validateSource(s))),nodes:[{nodePath:[nodeIdSchema.parse('22222222-2222-4222-8222-222222222222')],definitionHash:'b'.repeat(64),schema:parameterSchema,schemaHash:hash(canonicalControlSchemaJson(parameterSchema)),values:{height:1.8}}]});

test('linked build resolves the latest library source, persists its revision, shows updates, and fork keeps source',async()=>{
 const w=createSourceWorkspace(compositionSource());let current=componentRecord(1,'violet'),accepted=compositionCache(compositionSource()),saved:any;
 const submissions:SourceBundle[]=[];
 const session=createAuthoringSession(w,{readLibraryComponent:async()=>current,getControlSnapshot:()=>accepted,
  submit:async s=>{submissions.push(s);accepted=compositionCache(s);},save:async r=>{saved=r.document;return {token:'saved',name:'linked.lux-scene'};}});
 await session.build(session.read().source,session.read().draftVersion,[{componentId:libraryId,mountPath:'library/shared'}]);
 assert.equal(submissions[0]!.files['library/shared/component.ts'],'export const color = "violet";');
 assert.equal(session.read().libraryLinks[0]?.resolvedRevision,1);
 await session.save();assert.equal(saved.version,5);assert.equal(saved.libraryLinks[0].resolvedRevision,1);

 current=componentRecord(2,'blue');await session.checkLibraryUpdates();
 assert.deepEqual(session.getSnapshot().libraryUpdates,[{componentId:libraryId,name:'Shared color',resolvedRevision:1,availableRevision:2}]);
 await session.applyLibraryUpdates();
 assert.equal(session.read().source.files['library/shared/component.ts'],'export const color = "blue";');
 assert.equal(session.read().libraryLinks[0]?.resolvedRevision,2);
 session.forkLibraryComponent(libraryId);assert.deepEqual(session.read().libraryLinks,[]);
 assert.equal(session.read().source.files['library/shared/component.ts'],'export const color = "blue";');
 await session.save();assert.equal(saved.version,4);
});

test('opening a linked scene tries the latest revision then visibly falls back to the saved working source',async()=>{
 const fallbackSource={...compositionSource(),files:{...compositionSource().files,'library/shared/component.ts':'export const color = "violet";'}};
 const link={componentId:libraryId,mountPath:'library/shared',resolvedRevision:1,files:['library/shared/component.ts']};
 const cached=compositionCache(fallbackSource),animations=[{nodePath:cached.nodes[0]!.nodePath,definitionHash:cached.nodes[0]!.definitionHash,schemaHash:cached.nodes[0]!.schemaHash,controlId:'height',shape:'triangle' as const,periodSeconds:3,amount:.2,phase:.25,enabled:true}];
 const document=createSceneDocument(fallbackSource,DEFAULT_OUTPUT,cached,[link],animations);
 const w=createSourceWorkspace(compositionSource()),attempts:string[]=[],appliedAnimations:unknown[]=[];let accepted=compositionCache(compositionSource());
 const session=createAuthoringSession(w,{readLibraryComponent:async()=>componentRecord(2,'invalid'),getControlSnapshot:()=>accepted,getControlAnimations:()=>animations,save:async()=>null,
  open:async()=>({token:'opened',name:'linked.lux-scene',document}),submit:async(s,options)=>{attempts.push(s.files['library/shared/component.ts']!);appliedAnimations.push(options?.savedControlAnimations);if(s.files['library/shared/component.ts']!.includes('invalid'))throw Error('updated component failed');accepted=compositionCache(s);}});
 await session.open();
 assert.deepEqual(attempts,['export const color = "invalid";','export const color = "violet";']);
 assert.equal(session.read().libraryLinks[0]?.resolvedRevision,1);
 assert.match(session.getSnapshot().libraryFallbacks[0]?.message??'',/updated component failed/);
 assert.deepEqual(appliedAnimations,[animations,animations]);
 assert.equal(w.getSnapshot().hasRunningSource,true);
});

test('Save Look uses accepted bytes after dirty edits and survives thumbnail failure',async()=>{
 const w=createSourceWorkspace(source()),accepted=createSceneDocument(source(),{...DEFAULT_OUTPUT,width:1280,height:720},{intensity:.75});
 let saved:any;
 const session=createAuthoringSession(w,{submit:async()=>{},save:async()=>null,acceptedDocument:()=>accepted,
  lookThumbnail:async()=>{throw Error('capture failed');},saveLook:async request=>{saved=request;return {id:'look',revision:1,name:request.name,updatedAt:'2026-09-14T00:00:00Z'};}});
 w.edit('main.ts','invalid draft');const before=w.getSnapshot();
 await session.saveLook('Accepted');assert.deepEqual(saved.document,accepted);assert.equal(saved.thumbnail,undefined);assert.equal(w.getSnapshot().source.files['main.ts'],'invalid draft');assert.equal(w.getSnapshot().version,before.version);
});
test('Load Look commits only after activation and preserves all authoring state on failure',async()=>{
 const w=createSourceWorkspace(source());let fail=true,options:any;
 const document=createSceneDocument({...source(),files:{'main.ts':'export const replacement=1'}},{...DEFAULT_OUTPUT,width:1280,height:720},{intensity:.8});
 const session=createAuthoringSession(w,{submit:async(_source,value)=>{options=value;if(fail)throw Error('activation failed');},save:async()=>null,
  readLook:async()=>({format:'lux-look',version:1,id:'look',revision:1,name:'Warm',updatedAt:'2026-09-14T00:00:00Z',document})});
 w.edit('main.ts','my unsaved work');session.controlsChanged();const before=w.getSnapshot(),beforeIO=session.getSnapshot(),beforeRead=session.read();
 await assert.rejects(session.loadLook('look'),/activation failed/);assert.deepEqual(w.getSnapshot(),before);assert.deepEqual(session.getSnapshot(),beforeIO);assert.deepEqual(session.read(),beforeRead);
 fail=false;await session.loadLook('look');assert.deepEqual(options.output,document.settings);assert.equal(w.getSnapshot().source.files['main.ts'],'export const replacement=1');assert.equal(w.getSnapshot().dirty,false);assert.equal(session.getSnapshot().controlsDirty,false);assert.equal(session.getSnapshot().name,'Warm');
});

test('linked composition expands pinned Library dependencies and preserves its complete saved fallback',async()=>{
 const childId='33333333-3333-4333-8333-333333333333';
 const child={...componentRecord(1,'violet'),id:childId};
 const parent={...componentRecord(1,'unused'),source:{sdkVersion:'0.4.0' as const,entry:'component.ts',files:{'component.ts':'export {color} from "./generator/component.ts";'}},dependencies:[{componentId:childId,revision:1,mountPath:'generator'}]};
 const w=createSourceWorkspace(compositionSource());let accepted=compositionCache(compositionSource()),saved:any,available=true;
 const requests:Array<[string,number|undefined]>=[];
 const session=createAuthoringSession(w,{readLibraryComponent:async(id,revision)=>{requests.push([id,revision]);if(!available)throw Error('Library offline');return id===childId?child:parent;},getControlSnapshot:()=>accepted,
 submit:async s=>{accepted=compositionCache(s);},save:async r=>{saved=r.document;return {token:'saved',name:'linked.lux-scene'};},
 open:async()=>({token:'saved',name:'linked.lux-scene',document:saved})});
 await session.build(session.read().source,session.read().draftVersion,[{componentId:libraryId,mountPath:'library/shared'}]);
 assert.ok(requests.some(([id,rev])=>id===childId&&rev===1));
 assert.equal(session.read().source.files['library/shared/generator/component.ts'],child.source.files['component.ts']);
 assert.deepEqual(session.read().libraryLinks[0]?.files,['library/shared/component.ts','library/shared/generator/component.ts']);
 await session.save();available=false;
 await session.open();
 assert.equal(session.read().source.files['library/shared/generator/component.ts'],child.source.files['component.ts']);
 assert.match(session.getSnapshot().libraryFallbacks[0]?.message??'',/offline/);
});
