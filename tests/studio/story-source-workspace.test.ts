import test from 'node:test';
import assert from 'node:assert/strict';
import {createStorySourceWorkspace} from '../../apps/studio/src/source/story-source-workspace.ts';
import type {SourceBundle} from '../../packages/runtime-contracts/src/index.ts';
import {workerFactory} from './fixtures/admission-worker-factory.mjs';

const source=(name:string,text=`export const name = '${name}'`):SourceBundle=>({sdkVersion:'0.2.0',entry:'main.ts',files:{'main.ts':text,'lib/shared.ts':`export const shared = '${name}'`}});

test('visual selection preserves each source draft, tabs and replacement undo without changing the document guard',async()=>{
  const holder=createStorySourceWorkspace([{id:'calm',source:source('calm')},{id:'orbit',source:source('orbit')}],'calm');
  const selected=holder.selectedWorkspace,initialGuard=holder.getSnapshot().version;
  const calmDocumentKey=selected.getSnapshot().documentKey;
  selected.openFile('lib/shared.ts');
  holder.select('orbit');selected.openFile('lib/shared.ts');selected.edit('main.ts','orbit draft');
  assert.notEqual(selected.getSnapshot().documentKey,calmDocumentKey,'selection changes the editor presentation identity');
  const afterEdit=holder.getSnapshot().version;assert.equal(afterEdit,initialGuard+1);assert.equal(holder.getSnapshot().dirty,true);
  holder.select('calm');assert.deepEqual(selected.getSnapshot().openFiles,['main.ts','lib/shared.ts']);assert.equal(selected.getSnapshot().source.files['main.ts'],source('calm').files['main.ts']);
  const calmVersion=selected.getSnapshot().version;await selected.submit(source('calm','accepted replacement'),calmVersion,async()=>{});
  assert.equal(selected.getSnapshot().canUndoReplacement,true);const afterReplacement=holder.getSnapshot().version;assert.equal(afterReplacement,afterEdit+1);
  holder.select('orbit');holder.select('calm');selected.undoReplacement();assert.equal(selected.getSnapshot().source.files['main.ts'],source('calm').files['main.ts']);assert.equal(holder.getSnapshot().version,afterReplacement+1);
  const beforeNavigation=holder.getSnapshot().version;selected.openFile('main.ts');holder.select('orbit');holder.select('calm');assert.equal(holder.getSnapshot().version,beforeNavigation,'tabs and visual selection are local UI state');
  assert.equal(holder.snapshot('orbit').source.files['main.ts'],'orbit draft');assert.equal(holder.snapshot('orbit').runningMatchesDraft,false);
});

test('accepted state is explicit and aggregate saved state covers every visual',async()=>{
  const holder=createStorySourceWorkspace([{id:'a',source:source('a')},{id:'b',source:source('b')}]);
  assert.ok(holder.getSnapshot().sources.every(row=>!row.snapshot.runningMatchesDraft));
  await holder.markAccepted(0);assert.ok(holder.getSnapshot().sources.every(row=>row.snapshot.runningMatchesDraft));assert.equal(holder.getSnapshot().version,0);
  holder.select('b');holder.selectedWorkspace.edit('main.ts','b draft');assert.equal(holder.getSnapshot().dirty,true);
  holder.markSaved(holder.getSnapshot().version);assert.equal(holder.getSnapshot().dirty,false);assert.equal(holder.getSnapshot().version,1,'marking saved does not mutate the complete-document draft guard');
});

test('failed candidate activation preserves the old visual set and successful replacement detaches it atomically',async()=>{
  const holder=createStorySourceWorkspace([{id:'old',source:source('old')}]);const old=holder.snapshot('old'),guard=holder.getSnapshot().version;
  await assert.rejects(holder.replaceVisuals([{id:'new',source:source('new')}],'new',guard,async()=>{throw Error('candidate failed');}),/candidate failed/);
  assert.deepEqual(holder.getSnapshot().visualIds,['old']);assert.equal(holder.getSnapshot().selectedVisualId,'old');assert.equal(holder.snapshot('old'),old);assert.equal(holder.getSnapshot().version,guard);
  await holder.replaceVisuals([{id:'new',source:source('new')}],'new',guard,async entries=>assert.deepEqual(entries.map(row=>row.id),['new']));
  assert.deepEqual(holder.getSnapshot().visualIds,['new']);assert.equal(holder.selectedWorkspace.getSnapshot().runningMatchesDraft,true);assert.equal(holder.getSnapshot().version,guard+1);
  assert.throws(()=>holder.snapshot('old'),/unknown story visual/i);
});

test('whole-document activation exposes busy state and has no mutable child bypass',async()=>{
  const holder=createStorySourceWorkspace([{id:'old',source:source('old')}]);let release!:()=>void;
  const pending=holder.replaceVisuals([{id:'new',source:source('new')}],'new',0,()=>new Promise<void>(resolve=>{release=resolve;}));
  assert.equal(holder.getSnapshot().busy,true);assert.equal(holder.selectedWorkspace.getSnapshot().busy,true);
  assert.equal('workspace' in holder,false);assert.throws(()=>holder.selectedWorkspace.edit('main.ts','lost edit'),/busy/);
  release();await pending;assert.equal(holder.getSnapshot().busy,false);
});

test('whole-document operations reject while a child admission is busy',async()=>{
  const holder=createStorySourceWorkspace([{id:'a',source:source('a')}]),hung=workerFactory('hang');
  const admission=holder.selectedWorkspace.replaceDocumentAsync(source('replacement'),hung,100);
  assert.equal(holder.selectedWorkspace.getSnapshot().busy,true);
  await assert.rejects(holder.markAccepted(0),/busy/);
  await assert.rejects(holder.replaceVisuals([{id:'b',source:source('b')}],'b',0,async()=>{}),/busy/);
  await assert.rejects(admission,/timed out/);for(const item of hung.created)await item.exited;
});

test('visual IDs and candidate catalogs are bounded before activation',async()=>{
  assert.throws(()=>createStorySourceWorkspace([{id:'constructor',source:source('bad')}]),/visual ID/);
  assert.throws(()=>createStorySourceWorkspace([{id:'same',source:source('a')},{id:'same',source:source('b')}]),/duplicate/i);
  const holder=createStorySourceWorkspace([{id:'a',source:source('a')}]);
  assert.throws(()=>holder.select('missing'),/unknown story visual/i);assert.throws(()=>holder.snapshot('missing'),/unknown story visual/i);
  let activated=false;await assert.rejects(holder.replaceVisuals([], 'a',holder.getSnapshot().version,async()=>{activated=true;}),/1–8/);assert.equal(activated,false);
  const stale=holder.getSnapshot().version;holder.selectedWorkspace.edit('main.ts','changed');
  await assert.rejects(holder.replaceVisuals([{id:'b',source:source('b')}],'b',stale,async()=>{activated=true;}),/changed; read it again/);assert.equal(activated,false);
});
