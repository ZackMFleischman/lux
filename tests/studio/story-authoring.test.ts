import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSourceWorkspace} from '../../apps/studio/src/source/workspace.ts';
import {createAuthoringSession} from '../../apps/studio/src/source/authoring-session.ts';
import {sourceBuildInputSchema} from '../../apps/studio/src/source/agent-contract.ts';
const source={sdkVersion:'0.2.0' as const,entry:'visual.ts',files:{'visual.ts':'export {}'}};
const story={version:1 as const,beats:[{id:'orbit',label:'Orbit',timing:{kind:'sustained' as const}}],sequence:[]};
const controls={sourceHash:'a'.repeat(64),schema:[],schemaHash:createHash('sha256').update('[]').digest('hex'),values:{}};

test('build input validates Story references and preserves omitted versus explicit clear',()=>{
  const input={source,expectedDraftVersion:0};
  assert.equal(Object.hasOwn(sourceBuildInputSchema.parse(input),'story'),false);
  assert.equal(sourceBuildInputSchema.parse({...input,story:null}).story,null);
  assert.deepEqual(sourceBuildInputSchema.parse({...input,story}).story,story);
  assert.equal(sourceBuildInputSchema.safeParse({...input,story:{...story,beats:[{...story.beats[0],label:'🌌'.repeat(160)}]}}).success,true);
  assert.equal(sourceBuildInputSchema.safeParse({...input,story:{...story,beats:[{...story.beats[0],label:'🌌'.repeat(161)}]}}).success,false);
  assert.equal(sourceBuildInputSchema.safeParse({...input,story:{...story,sequence:[{id:'missing',beatId:'unknown',follow:{kind:'manual'}}]}}).success,false);
});

test('Story authoring promotes atomically, preserves omitted definitions, and explicitly clears without downgrading',async()=>{
  let fail=false;const options:any[]=[],saved:any[]=[];
  const workspace=createSourceWorkspace(source);
  const session=createAuthoringSession(workspace,{submit:async(_source,value)=>{options.push(value);if(fail)throw Error('candidate failed');},getControlSnapshot:()=>controls,save:async request=>{saved.push(request);return {token:'saved',name:'story.lux-scene'};}});
  await session.build(source,session.read().draftVersion,undefined,story);
  assert.deepEqual(session.read().story,story);
  await session.build(source,session.read().draftVersion);
  assert.deepEqual(options.at(-1).story,story);
  fail=true;
  await assert.rejects(session.build(source,session.read().draftVersion,undefined,null),/candidate failed/);
  assert.deepEqual(session.read().story,story);
  fail=false;
  await session.save();
  assert.equal(saved.at(-1).document.version,6);
  assert.deepEqual(saved.at(-1).document.story,story);
  await session.build(source,session.read().draftVersion,undefined,null);
  assert.equal(session.read().story,null);
  await session.save();
  assert.equal(saved.at(-1).document.version,6);
  assert.equal(saved.at(-1).document.story,undefined);
});

test('failed Story open preserves accepted document and save destination',async()=>{
  let fail=false;const saved:any[]=[];
  const workspace=createSourceWorkspace(source);
  const document={format:'lux-scene',version:6,source,settings:{width:640,height:360,fps:60,seed:0},controls,story};
  const session=createAuthoringSession(workspace,{submit:async()=>{if(fail)throw Error('invalid incoming');},getControlSnapshot:()=>controls,
    save:async request=>{saved.push(request);return {token:'old',name:'old.lux-scene'};},open:async()=>({token:'new',name:'new.lux-scene',document})});
  await session.build(source,session.read().draftVersion,undefined,story);await session.save();
  const before=session.read();fail=true;
  await assert.rejects(session.open(),/invalid incoming/);
  assert.deepEqual(session.read(),before);
  assert.equal(session.getSnapshot().name,'old.lux-scene');
  await session.save();assert.equal(saved.at(-1).token,'old');
});
