import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSourceWorkspace} from '../../apps/studio/src/source/workspace.ts';
import {createAuthoringSession} from '../../apps/studio/src/source/authoring-session.ts';
import {createStorySceneDocumentV7} from '../../packages/core/src/story-scene-v2.ts';
import type {StorySceneDocumentV7} from '../../packages/core/src/story-scene-v2.ts';

const settings={width:640,height:360,fps:60,seed:0},tempo={bpm:120};
const schema=[] as const,schemaHash=createHash('sha256').update('[]').digest('hex');
const source=(id:string,text=`export default '${id}'`)=>({sdkVersion:'0.2.0' as const,entry:'visual.ts',files:{'visual.ts':text}});
const hashSource=(value:ReturnType<typeof source>)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const visual=(id:string)=>{const value=source(id);return {id,source:value,controls:{sourceHash:hashSource(value),schema,schemaHash,values:{}},controlAnimations:[]};};
const story={version:2 as const,normalVisualId:'ambient',crossfadeSeconds:.35,beats:[
 {id:'arrival',label:'Arrival',timing:{kind:'timed' as const,durationSeconds:4},visualId:'lead'},
 {id:'orbit',label:'Orbit',timing:{kind:'sustained' as const},visualId:'ambient'},
],sequence:[
 {id:'opening',beatId:'arrival',follow:{kind:'after' as const,seconds:5},visualId:'lead'},
 {id:'orbit-1',beatId:'orbit',follow:{kind:'manual' as const},visualId:'ambient'},
]};
const document=()=>createStorySceneDocumentV7([visual('ambient'),visual('lead')],settings,tempo,story);

test('v7 source selection preserves each draft and stays separate from Story playback identity',async()=>{
 let selected:string|undefined;
 const accepted=document(),workspace=createSourceWorkspace(source('base'));
 const session=createAuthoringSession(workspace,{submit:async()=>{},submitDocument:async()=>{},acceptedDocument:()=>accepted,selectVisual:id=>{selected=id;},save:async()=>null,
  open:async()=>({token:'story',name:'story.lux-scene',document:accepted})});
 await session.open();
 const catalog=session.getSnapshot().storySourceCatalog!;
 assert.equal(session.getSnapshot().activeWorkspace,catalog.selectedWorkspace);
 const guard=session.read().draftVersion;
 session.selectVisual('lead');assert.equal(selected,'lead');assert.equal(session.read().draftVersion,guard);
 session.getSnapshot().activeWorkspace.edit('visual.ts','lead draft');
 session.selectVisual('ambient');session.getSnapshot().activeWorkspace.edit('visual.ts','ambient draft');
 session.selectVisual('lead');
 const read=session.read();
 assert.equal(read.source.files['visual.ts'],'lead draft');assert.equal(Object.hasOwn(read,'selectedSource'),false);
 assert.equal(read.document!.visuals.find(row=>row.id==='lead')!.source.files['visual.ts'],'lead draft');
 assert.equal(read.document!.visuals.find(row=>row.id==='ambient')!.source.files['visual.ts'],'ambient draft');
 assert.equal(read.document!.story.normalVisualId,'ambient');
});

test('v7 open and openPath accept a nonzero uint32 seed while legacy scenes keep the seed-zero restriction',async()=>{
 const seeded={...document(),settings:{...settings,seed:17}};let accepted:StorySceneDocumentV7=seeded,submissions=0;
 const session=createAuthoringSession(createSourceWorkspace(source('base')),{submit:async()=>assert.fail('legacy submit must not run'),
  submitDocument:async next=>{submissions++;accepted=next;},acceptedDocument:()=>accepted,save:async()=>null,
  open:async()=>({token:'seeded-open',name:'seeded-open.lux-scene',document:seeded}),
  openPath:async()=>({token:'seeded-path',name:'seeded-path.lux-scene',document:seeded})});
 await session.open();assert.equal(session.read().document!.settings.seed,17);
 const opened=await session.openPath('seeded-path.lux-scene',session.read().draftVersion);
 assert.equal(opened!.name,'seeded-path.lux-scene');assert.equal(session.read().document!.settings.seed,17);assert.equal(submissions,2);

 const legacy={format:'lux-scene' as const,version:3 as const,source:source('legacy'),settings:{...settings,seed:17},controls:visual('legacy').controls,tempo};
 const legacySession=createAuthoringSession(createSourceWorkspace(source('base')),{submit:async()=>assert.fail('nonzero legacy seed must not submit'),save:async()=>null,
  open:async()=>({token:'legacy-open',name:'legacy-open.lux-scene',document:legacy}),
  openPath:async()=>({token:'legacy-path',name:'legacy-path.lux-scene',document:legacy})});
 await assert.rejects(legacySession.open(),/60 fps with seed 0/);
 await assert.rejects(legacySession.openPath('legacy-path.lux-scene',legacySession.read().draftVersion),/60 fps with seed 0/);
});

test('v7 save keeps invalid drafts with the accepted cache provenance for each visual',async()=>{
 const accepted=document();let saved:StorySceneDocumentV7|undefined;
 const session=createAuthoringSession(createSourceWorkspace(source('base')),{submit:async()=>{},submitDocument:async()=>{},acceptedDocument:()=>accepted,
  save:async request=>{saved=request.document as StorySceneDocumentV7;return {token:'saved',name:'story.lux-scene'};},open:async()=>({token:'story',name:'story.lux-scene',document:accepted})});
 await session.open();session.selectVisual('lead');session.getSnapshot().activeWorkspace.edit('visual.ts','export default {');
 await session.save();
 const lead=saved!.visuals.find(row=>row.id==='lead')!;
 assert.equal(lead.source.files['visual.ts'],'export default {');
 assert.equal(lead.controls.sourceHash,accepted.visuals.find(row=>row.id==='lead')!.controls.sourceHash);
 assert.equal(session.getSnapshot().storySourceCatalog!.getSnapshot().dirty,false);
});

test('an edit made during v7 save remains dirty after the captured document is written',async()=>{
 const accepted=document();let finish!:(value:{token:string;name:string})=>void;
 const session=createAuthoringSession(createSourceWorkspace(source('base')),{submit:async()=>{},submitDocument:async()=>{},acceptedDocument:()=>accepted,
  save:()=>new Promise(resolve=>{finish=resolve;}),open:async()=>({token:'story',name:'story.lux-scene',document:accepted})});
 await session.open();session.selectVisual('lead');session.getSnapshot().activeWorkspace.edit('visual.ts','first draft');
 const saving=session.save();while(!finish)await new Promise(resolve=>setImmediate(resolve));
 session.getSnapshot().activeWorkspace.edit('visual.ts','newer draft');finish({token:'saved',name:'story.lux-scene'});await saving;
 assert.equal(session.getSnapshot().storySourceCatalog!.getSnapshot().dirty,true);
 assert.equal(session.read().source.files['visual.ts'],'newer draft');
});

test('failed v7 open and build preserve the prior catalog, file token and selected source',async()=>{
 const accepted=document();let fail=true,savedToken:string|undefined;
 const session=createAuthoringSession(createSourceWorkspace(source('base')),{submit:async()=>{},submitDocument:async()=>{if(fail)throw Error('candidate failed');},acceptedDocument:()=>accepted,
  save:async request=>{savedToken=request.token;return {token:'old',name:'old.lux-scene'};},open:async()=>({token:'new',name:'new.lux-scene',document:accepted})});
 await session.save();await assert.rejects(session.open(),/candidate failed/);
 assert.equal(session.getSnapshot().storySourceCatalog,null);assert.equal(session.getSnapshot().name,'old.lux-scene');
 await session.save();assert.equal(savedToken,'old');
 fail=false;await session.open();session.selectVisual('lead');const before=session.read(),beforeCatalog=session.getSnapshot().storySourceCatalog;
 fail=true;const changed={...accepted,story:{...accepted.story,crossfadeSeconds:1}};
 await assert.rejects(session.buildDocument(changed,session.read().draftVersion),/candidate failed/);
 assert.equal(session.getSnapshot().storySourceCatalog,beforeCatalog);assert.deepEqual(session.read(),before);
});

test('an edit during pending Open prevents cross-mode activation and preserves file identity',async()=>{
 const incoming=document();let release!:(value:any)=>void,submitted=0,savedToken:string|undefined;
 const session=createAuthoringSession(createSourceWorkspace(source('base')),{submit:async()=>{},submitDocument:async()=>{submitted++;},acceptedDocument:()=>incoming,
  save:async request=>{savedToken=request.token;return {token:'old',name:'old.lux-scene'};},open:()=>new Promise(resolve=>{release=resolve;})});
 await session.save();const opening=session.open();while(!release)await new Promise(resolve=>setImmediate(resolve));
 session.getSnapshot().activeWorkspace.edit('visual.ts','newer local edit');release({token:'new',name:'new.lux-scene',document:incoming});
 await assert.rejects(opening,/changed|again|stale/i);assert.equal(submitted,0);assert.equal(session.getSnapshot().storySourceCatalog,null);assert.equal(session.getSnapshot().name,'old.lux-scene');
 await session.save();assert.equal(savedToken,'old');assert.equal(session.read().source.files['visual.ts'],'newer local edit');
});

test('an edit during asynchronous v7 verification prevents whole-document activation',async t=>{
 const incoming=document(),nativeDigest=globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
 let release! :()=>void,verificationStarted=false,submitted=0;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 t.mock.method(globalThis.crypto.subtle,'digest',async (algorithm:AlgorithmIdentifier,data:BufferSource)=>{verificationStarted=true;await gate;return nativeDigest(algorithm,data);});
 const session=createAuthoringSession(createSourceWorkspace(source('base')),{submit:async()=>{},submitDocument:async()=>{submitted++;},acceptedDocument:()=>incoming,save:async()=>null});
 const building=session.buildDocument(incoming,session.read().draftVersion);
 while(!verificationStarted)await new Promise(resolve=>setImmediate(resolve));
 session.getSnapshot().activeWorkspace.edit('visual.ts','newer local edit');release();
 await assert.rejects(building,/changed|again|stale/i);assert.equal(submitted,0);assert.equal(session.getSnapshot().storySourceCatalog,null);
 assert.equal(session.read().source.files['visual.ts'],'newer local edit');
});

test('an edit during pending openPath preserves the v7 catalog and token before legacy activation',async()=>{
 const accepted=document(),legacy={format:'lux-scene' as const,version:3 as const,source:source('legacy'),settings,controls:visual('legacy').controls,tempo};
 let release!:(value:any)=>void,legacySubmits=0,savedToken:string|undefined;
 const session=createAuthoringSession(createSourceWorkspace(source('base')),{submit:async()=>{legacySubmits++;},submitDocument:async()=>{},acceptedDocument:()=>accepted,
  save:async request=>{savedToken=request.token;return {token:'story-token',name:'story.lux-scene'};},open:async()=>({token:'story-token',name:'story.lux-scene',document:accepted}),openPath:()=>new Promise(resolve=>{release=resolve;})});
 await session.open();await session.save();const beforeCatalog=session.getSnapshot().storySourceCatalog,before=session.read(),opening=session.openPath('legacy.lux-scene',before.draftVersion);
 while(!release)await new Promise(resolve=>setImmediate(resolve));session.getSnapshot().activeWorkspace.edit('visual.ts','newer story edit');release({token:'legacy-token',name:'legacy.lux-scene',document:legacy});
 await assert.rejects(opening,/changed|again|stale/i);assert.equal(legacySubmits,0);assert.equal(session.getSnapshot().storySourceCatalog,beforeCatalog);assert.equal(session.getSnapshot().name,'story.lux-scene');
 await session.save();assert.equal(savedToken,'story-token');assert.equal(session.read().source.files['visual.ts'],'newer story edit');
});

test('whole-document build blocks catalog edits until atomic promotion settles',async()=>{
 const initial=document();let accepted=initial,release!:(value?:void)=>void,pending=false;
 const session=createAuthoringSession(createSourceWorkspace(source('base')),{submit:async()=>{},submitDocument:next=>{if(!pending){accepted=next;return Promise.resolve();}return new Promise(resolve=>{release=()=>{accepted=next;resolve();};});},acceptedDocument:()=>accepted,
  save:async()=>null,open:async()=>({token:'story',name:'story',document:initial})});
 await session.open();pending=true;const next={...initial,story:{...initial.story,crossfadeSeconds:1}},building=session.buildDocument(next,session.read().draftVersion);
 while(!release)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(session.getSnapshot().storySourceCatalog!.getSnapshot().busy,true);
 assert.throws(()=>session.getSnapshot().activeWorkspace.edit('visual.ts','lost edit'),/busy/i);
 release();await building;assert.equal(session.read().document!.story.crossfadeSeconds,1);
});

test('whole-document guard stays stale across mode changes and generic build is rejected in v7',async()=>{
 const accepted=document();let submissions=0;
 const session=createAuthoringSession(createSourceWorkspace(source('base')),{submit:async()=>{},submitDocument:async()=>{submissions++;},acceptedDocument:()=>accepted,
  save:async()=>null,open:async()=>({token:'story',name:'story',document:accepted})});
 const legacyGuard=session.read().draftVersion;await session.open();
 assert.ok(session.read().draftVersion>legacyGuard);
 await assert.rejects(session.buildDocument(accepted,legacyGuard),/changed|again|stale/i);assert.equal(submissions,1);
 await assert.rejects(session.build(session.read().source,session.read().draftVersion),/whole document|v7/i);
});

test('add source explicitly converts accepted v6, appends free IDs, and rejects an unbuilt source draft',async()=>{
 const v1Story={version:1 as const,beats:[{id:'orbit',label:'Orbit',timing:{kind:'sustained' as const}}],sequence:[{id:'orbit-1',beatId:'orbit',follow:{kind:'manual' as const}}]};
 const base=visual('base'),v6={format:'lux-scene' as const,version:6 as const,source:base.source,settings,controls:base.controls,controlAnimations:base.controlAnimations,tempo,story:v1Story};
 let accepted:any=v6,settles=0,submissions=0;
 const session=createAuthoringSession(createSourceWorkspace(base.source),{submit:async()=>{},submitDocument:async next=>{submissions++;accepted=next;},acceptedDocument:()=>accepted,
  settleControls:async()=>{settles++;},save:async()=>null,getControlSnapshot:()=>base.controls,getControlAnimations:()=>[]});
 session.controlsChanged();await session.addSource(session.read().draftVersion);
 let read=session.read();assert.equal(read.document!.version,7);assert.deepEqual(read.document!.visuals.map(row=>row.id),['visual1','visual2']);
 assert.equal(read.document!.story.crossfadeSeconds,.35);assert.equal(read.document!.story.normalVisualId,'visual1');
 assert.ok(read.document!.story.beats.every(row=>row.visualId==='visual1'));assert.ok(read.document!.story.sequence.every(row=>row.visualId==='visual1'));
 assert.equal(settles,1);assert.equal(submissions,1);
 await session.addSource(session.read().draftVersion);read=session.read();assert.deepEqual(read.document!.visuals.map(row=>row.id),['visual1','visual2','visual3']);
 session.selectVisual('visual2');session.getSnapshot().activeWorkspace.edit('visual.ts','unbuilt draft');
 await assert.rejects(session.addSource(session.read().draftVersion),/build|accepted|draft/i);assert.equal(submissions,2);
});

test('buildDocument honors an explicit replacement table and fields without selected-cache rebinding',async()=>{
 const initial=document();let accepted:StorySceneDocumentV7=initial,submitted:StorySceneDocumentV7|undefined;
 const session=createAuthoringSession(createSourceWorkspace(source('base')),{submit:async()=>{},submitDocument:async next=>{submitted=next;accepted=next;},acceptedDocument:()=>accepted,
  save:async()=>null,open:async()=>({token:'story',name:'story',document:initial})});
 await session.open();session.selectVisual('lead');
 const replacement=createStorySceneDocumentV7([visual('replacement')],{...settings,width:800},{bpm:137},{version:2,normalVisualId:'replacement',crossfadeSeconds:0,beats:[{id:'still',label:'Still',timing:{kind:'sustained'},visualId:'replacement'}],sequence:[]});
 await session.buildDocument(replacement,session.read().draftVersion);
 assert.deepEqual(submitted,replacement);assert.deepEqual(session.read().document,replacement);assert.equal(session.read().source.files['visual.ts'],source('replacement').files['visual.ts']);
});

test('v7 Looks save accepted bytes and load atomically through whole-document submission',async()=>{
 const initial=document(),replacement=createStorySceneDocumentV7([visual('look')],settings,tempo,{version:2,normalVisualId:'look',crossfadeSeconds:0,beats:[{id:'still',label:'Still',timing:{kind:'sustained'},visualId:'look'}],sequence:[]});
 let accepted:StorySceneDocumentV7=initial,fail=false,savedLook:StorySceneDocumentV7|undefined;
 const look={format:'lux-look' as const,version:1 as const,id:'look-id',revision:1,name:'Whole Story',updatedAt:'2026-09-17T00:00:00Z',document:replacement};
 const session=createAuthoringSession(createSourceWorkspace(source('base')),{submit:async()=>{},submitDocument:async next=>{if(fail)throw Error('look failed');accepted=next;},acceptedDocument:()=>accepted,save:async()=>null,
  open:async()=>({token:'story',name:'story',document:initial}),saveLook:async request=>{savedLook=request.document as StorySceneDocumentV7;return {id:'saved',revision:1,name:request.name,updatedAt:look.updatedAt};},readLook:async()=>look});
 await session.open();session.selectVisual('lead');session.getSnapshot().activeWorkspace.edit('visual.ts','invalid draft');
 await session.saveLook('Accepted');assert.deepEqual(savedLook,initial);
 const before=session.read();fail=true;await assert.rejects(session.loadLook('look-id'),/look failed/);assert.deepEqual(session.read(),before);
 fail=false;await session.loadLook('look-id');assert.deepEqual(session.read().document,replacement);assert.equal(session.getSnapshot().name,'Whole Story');
});

test('an edit during pending Look read prevents both v7 and legacy activation',async()=>{
 const incoming=document();let release!:(value:any)=>void,documentSubmits=0;
 const session=createAuthoringSession(createSourceWorkspace(source('base')),{submit:async()=>assert.fail('legacy submit must not run'),submitDocument:async()=>{documentSubmits++;},acceptedDocument:()=>incoming,save:async()=>null,
  readLook:()=>new Promise(resolve=>{release=resolve;})});
 const loading=session.loadLook('v7');while(!release)await new Promise(resolve=>setImmediate(resolve));session.getSnapshot().activeWorkspace.edit('visual.ts','newer base edit');
 release({format:'lux-look',version:1,id:'v7',revision:1,name:'V7',updatedAt:'2026-09-17T00:00:00Z',document:incoming});
 await assert.rejects(loading,/changed|again|stale/i);assert.equal(documentSubmits,0);assert.equal(session.getSnapshot().storySourceCatalog,null);assert.equal(session.read().source.files['visual.ts'],'newer base edit');

 let accepted=incoming,legacySubmits=0;const legacy={format:'lux-scene' as const,version:3 as const,source:source('legacy'),settings,controls:visual('legacy').controls,tempo};
 const storySession=createAuthoringSession(createSourceWorkspace(source('base')),{submit:async()=>{legacySubmits++;},submitDocument:async()=>{},acceptedDocument:()=>accepted,save:async()=>null,
  open:async()=>({token:'story',name:'story',document:incoming}),readLook:()=>new Promise(resolve=>{release=resolve;})});
 await storySession.open();const beforeCatalog=storySession.getSnapshot().storySourceCatalog,legacyLoading=storySession.loadLook('legacy');while(!release)await new Promise(resolve=>setImmediate(resolve));
 storySession.getSnapshot().activeWorkspace.edit('visual.ts','newer story edit');release({format:'lux-look',version:1,id:'legacy',revision:1,name:'Legacy',updatedAt:'2026-09-17T00:00:00Z',document:legacy});
 await assert.rejects(legacyLoading,/changed|again|stale/i);assert.equal(legacySubmits,0);assert.equal(storySession.getSnapshot().storySourceCatalog,beforeCatalog);assert.equal(storySession.read().source.files['visual.ts'],'newer story edit');
});

test('an edit during legacy Look snapshot verification is not rebound to a fresh guard',async t=>{
 const legacy={format:'lux-scene' as const,version:3 as const,source:source('legacy'),settings,controls:visual('legacy').controls,tempo};
 const nativeDigest=globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);let calls=0,release! :()=>void,preparationStarted=false,submits=0;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 t.mock.method(globalThis.crypto.subtle,'digest',async (algorithm:AlgorithmIdentifier,data:BufferSource)=>{calls++;if(calls===2){preparationStarted=true;await gate;}return nativeDigest(algorithm,data);});
 const session=createAuthoringSession(createSourceWorkspace(source('base')),{submit:async()=>{submits++;},save:async()=>null,
  readLook:async()=>({format:'lux-look',version:1,id:'legacy',revision:1,name:'Legacy',updatedAt:'2026-09-17T00:00:00Z',document:legacy})});
 const loading=session.loadLook('legacy');while(!preparationStarted)await new Promise(resolve=>setImmediate(resolve));
 session.getSnapshot().activeWorkspace.edit('visual.ts','newer local edit');release();
 await assert.rejects(loading,/changed|again|stale/i);assert.equal(submits,0);assert.equal(session.read().source.files['visual.ts'],'newer local edit');
});

test('v7 to legacy activation locks the selected Story workspace until promotion finishes',async()=>{
 const accepted=document(),legacy={format:'lux-scene' as const,version:3 as const,source:source('legacy'),settings,controls:visual('legacy').controls,tempo};
 let release! :()=>void,activationStarted=false;
 const session=createAuthoringSession(createSourceWorkspace(source('base')),{submit:()=>new Promise<void>(resolve=>{activationStarted=true;release=resolve;}),submitDocument:async()=>{},acceptedDocument:()=>accepted,save:async()=>null,
  open:async()=>({token:'story',name:'story',document:accepted}),openPath:async()=>({token:'legacy',name:'legacy',document:legacy})});
 await session.open();const opening=session.openPath('legacy.lux-scene',session.read().draftVersion);while(!activationStarted)await new Promise(resolve=>setImmediate(resolve));
 assert.throws(()=>session.getSnapshot().activeWorkspace.edit('visual.ts','lost edit'),/busy/i);release();await opening;
 assert.equal(session.getSnapshot().storySourceCatalog,null);assert.equal(session.read().source.files['visual.ts'],source('legacy').files['visual.ts']);
});
