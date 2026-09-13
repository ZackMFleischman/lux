import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { normalizeLivePolicyTranscript as normalize, encodeLivePolicyTranscript as encode, decodeLivePolicyTranscript as decode, liveTranscriptLimits as limits } from '../../packages/inputs/src/live-transcript.mjs';
import * as timeline from '../../packages/inputs/src/timeline.mjs';
import * as mapping from '../../packages/inputs/src/mapping.mjs';
import { normalizeScriptedReplayFixture, encodeScriptedReplayFixture } from '../../packages/inputs/src/replay-fixture.mjs';
import { createScriptedReplayCursor } from '../../packages/inputs/src/replay-cursor.mjs';
const empty=()=>({version:1,mode:'live-policy-transcript',profile:'i02b-v1',seed:1,mapping:{version:2,mapping:{version:1,targets:[],bindings:[]},smoothing:[]},initial:{epoch:0,startMs:0,definition:{version:1,sources:[],signals:[]}},clock:{inputDomainId:'input',observationDomainId:'receipt',unit:'ms'},sourceConfigs:[],operations:[],ending:{status:'complete',reason:'requested',lostRecords:0}});
const invalid=input=>assert.throws(()=>normalize(input),{code:'INVALID_LIVE_TRANSCRIPT'});
const quota=input=>assert.throws(()=>normalize(input),{code:'LIVE_TRANSCRIPT_QUOTA_EXCEEDED'});
const hash=json=>createHash('sha256').update(json).digest('hex');
const blank=()=>({kind:'admit',observedAtMs:null,nowMs:0,envelopes:[],decisions:[]});
const freezeCheck=x=>{if(x&&typeof x==='object'){assert.ok(Object.isFrozen(x));Object.values(x).forEach(freezeCheck);}};

test('readonly limits and detached synchronous outputs cover the exact API',()=>{
  assert.deepEqual(limits,{bytes:8388608,values:250000,depth:16,operations:1024,envelopes:8192,sourceConfigs:256,work:65536});freezeCheck(limits);
  const input=empty(),result=normalize(input);freezeCheck(result);input.clock.inputDomainId='changed';assert.equal(result.transcript.clock.inputDomainId,'input');
});

test('descriptor capture rejects getters, toJSON, sparse, exotic, cyclic and extra data without invoking accessors',()=>{
  let calls=0;const getter=empty();Object.defineProperty(getter,'seed',{enumerable:true,get(){calls++;return 1;}});invalid(getter);
  const toJSON=empty();toJSON.toJSON=()=>{calls++;return empty();};invalid(toJSON);assert.equal(calls,0);
  for(const change of [x=>x.operations=Array(1),x=>x.operations.extra=0,x=>x[Symbol('x')]=1,x=>Object.defineProperty(x,'extra',{value:1}),x=>x.clock=new Date(),x=>x.clock=x,x=>x.seed=NaN,x=>x.seed=Infinity,x=>x.seed=1n,x=>x.seed=undefined,x=>x.seed=()=>0,x=>x.initial.extra=0,x=>x.clock.extra=0,x=>x.ending.extra=0,x=>x.seed=-1,x=>x.seed=2**32,x=>x.seed=1.5,x=>x.clock.inputDomainId='constructor',x=>x.clock.unit='s',x=>x.mode='scripted',x=>x.profile='future',x=>x.version=2]){const x=empty();change(x);invalid(x);}
  const n=empty();Object.setPrototypeOf(n,null);assert.equal(normalize(n).transcript.seed,1);
});

test('foreign thrown values are never inspected or coerced and errors remain bounded',()=>{
  let reads=0;const thrown=new Proxy({}, {get(){reads++;throw 0;},getPrototypeOf(){reads++;throw 0;},ownKeys(){reads++;throw 0;}});
  for(const trap of ['getPrototypeOf','ownKeys','getOwnPropertyDescriptor']){
    const x=new Proxy(empty(),{[trap](){throw thrown;}});
    assert.throws(()=>normalize(x),e=>e.code==='INVALID_LIVE_TRANSCRIPT'&&e.path.length<=200&&e.message.length<=512&&!Object.hasOwn(e,'cause'));
  }assert.equal(reads,0);
});

test('canonical storage rejects aliases, duplicate keys, unknowns and wrong digests',async()=>{
  const r=await encode(empty());
  for(const json of [' '+r.json,r.json+'\n','\ufeff'+r.json,r.json.replace('"seed":1','"seed":1.0'),r.json.replace('"seed":1','"seed":1e0'),r.json.replace('"seed":1','"seed":1,"seed":1'),r.json.replace('"input"','"\\u0069nput"'),r.json.replace('"version":1,"mode":"live-policy-transcript"','"mode":"live-policy-transcript","version":1'),r.json.replace('"seed":1','"seed":1,"extra":0'),r.json.slice(0,-1)])await assert.rejects(decode(json,hash(json)),{code:'INVALID_LIVE_TRANSCRIPT'});
  for(const digest of ['0'.repeat(64),r.sha256.toUpperCase(),new String(r.sha256),null])await assert.rejects(decode(r.json,digest),{code:'INVALID_LIVE_TRANSCRIPT'});
  await assert.rejects(decode(new String(r.json),r.sha256),{code:'INVALID_LIVE_TRANSCRIPT'});
  const x=empty();x.seed=-0;assert.equal(normalize(x).transcript.seed,0);
});

test('synchronous capture and canonical admission finish before async digest and remain stateless on reentry',async()=>{
  const x=empty();x.operations.push(blank());const expected=await encode(x);const running=encode(x);x.operations[0].nowMs=100;x.seed=2;assert.equal((await running).json,expected.json);
  let nested,once=false;const outer=empty();outer.clock=new Proxy(outer.clock,{ownKeys(target){if(!once){once=true;nested=normalize({...empty(),seed:99});}return Reflect.ownKeys(target);}});
  assert.equal(normalize(outer).transcript.seed,1);assert.equal(nested.transcript.seed,99);
  const other=await Promise.all([encode({...empty(),seed:7}),encode({...empty(),seed:8})]);assert.notEqual(other[0].sha256,other[1].sha256);
});

test('1024 actual empty owner operations reach the operation limit',()=>{
  const x=empty();let state=timeline.createLiveInputState(x.initial.definition,0,0);
  for(let i=0;i<1024;i++){const r=timeline.admitLiveInputs(state,0,[]);state=r.state;x.operations.push({...blank(),decisions:r.decisions});}
  assert.equal(normalize(x).summary.work,1025);x.operations.push(blank());quota(x);
});

test('raw byte, visited value, depth and container bounds fail before semantic owner admission',async()=>{
  const x=empty();x.mapping={invalid:'x'.repeat(limits.bytes)};quota(x);
  const v=empty();const alias=Array(8192).fill(null);v.mapping=Array(31).fill(alias);quota(v);
  const d=empty();let nested=null;for(let i=0;i<17;i++)nested=[nested];d.mapping=nested;quota(d);
  for(const change of [x=>x.mapping=Array(8193).fill(0),x=>x.mapping=Object.fromEntries(Array.from({length:33},(_,i)=>['f'+i,0])),x=>x.mapping={['a'.repeat(65)]:0}]){const x=empty();change(x);quota(x);}
  await assert.rejects(decode(' '.repeat(limits.bytes+1),'0'.repeat(64)),{code:'LIVE_TRANSCRIPT_QUOTA_EXCEEDED'});
  await assert.rejects(decode('é'.repeat(limits.bytes/2+1),'0'.repeat(64)),{code:'LIVE_TRANSCRIPT_QUOTA_EXCEEDED'});
});

test('cross-mode data cannot enter either transcript or scripted cursor',async()=>{
  const x=empty(),live=await encode(x);assert.throws(()=>normalizeScriptedReplayFixture(x),{code:'INVALID_REPLAY_FIXTURE'});
  await assert.rejects(createScriptedReplayCursor(live.json,live.sha256,1),{code:'INVALID_REPLAY_FIXTURE'});
  const scripted={version:1,mode:'scripted',durationMs:0,originEpoch:0,seed:1,generator:{id:'test',version:'1',configuration:{}},mapping:x.mapping,authority:'studio',base:[],definition:x.initial.definition,sourceConfigs:[],operations:[]};
  invalid(scripted);const r=await encodeScriptedReplayFixture(scripted);await assert.rejects(decode(r.json,r.sha256),{code:'INVALID_LIVE_TRANSCRIPT'});
});

const source={sourceId:'a',signalId:'level'};
const authority={sourceId:'a',generation:0,connected:true,calibrationId:'cal0'};
function populated(){const x=empty();x.initial.definition={version:1,sources:[authority],signals:[{source,kind:'continuous'}]};x.sourceConfigs=[{sourceId:'a',calibrationId:'cal0',configuration:{}}];return x;}
const envelope=i=>({version:1,epoch:0,source,generation:0,calibrationId:'cal0',sequence:i,timestampMs:0,kind:'continuous',value:1});

test('8192 original continuous receipts in 32 real batches reach their distinct cap',()=>{
  const x=populated();let state=timeline.createLiveInputState(x.initial.definition,0,0);
  for(let batch=0;batch<32;batch++){
    const envelopes=Array.from({length:256},(_,i)=>envelope(batch*256+i));const r=timeline.admitLiveInputs(state,0,envelopes);state=r.state;
    x.operations.push({kind:'admit',observedAtMs:null,nowMs:0,envelopes,decisions:r.decisions});
  }
  const result=normalize(x);assert.equal(result.summary.received,8192);assert.equal(result.summary.counters.acceptedContinuous,8192);assert.equal(result.summary.counters.coalescedContinuous,8191);
  assert.deepEqual(result.summary.heldContinuous,[{epoch:0,ingress:8191}]);assert.equal(result.summary.work,8322);
  assert.equal(result.transcript.operations.length,32);assert.equal(result.transcript.operations.reduce((sum,o)=>sum+o.decisions.length,0),8192);
  const next=[envelope(8192)],r=timeline.admitLiveInputs(state,0,next);assert.equal(r.decisions[0].status,'accepted');
  x.operations.push({kind:'admit',observedAtMs:null,nowMs:0,envelopes:next,decisions:r.decisions});quota(x);
});

test('real 251-step work boundary passes and step 252 is rejected before its owner call',()=>{
  // Instrument only call observation in an isolated process. Every owner result
  // comes from the actual exported implementation, including fixture creation.
  const moduleURL=new URL('../../packages/inputs/src/live-transcript.mjs',import.meta.url).href;
  const script=`
    import assert from 'node:assert/strict';import {mock} from 'node:test';
    const ownerURL=new URL('./timeline.mjs',${JSON.stringify(moduleURL)}).href;
    const actual=await import(ownerURL);let calls=0,creates=0;
    mock.module(ownerURL,{namedExports:{...actual,stepLiveInputs(...args){calls++;return actual.stepLiveInputs(...args);},createLiveInputState(...args){creates++;return actual.createLiveInputState(...args);}}});
    const {normalizeLivePolicyTranscript:normalize}=await import(${JSON.stringify(moduleURL)});
    const mapping=await import(new URL('./mapping.mjs',${JSON.stringify(moduleURL)}));
    const x=${JSON.stringify(populated())};
    const uuid=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
    const target={sceneId:uuid(1),nodePath:[],controlId:'gain'};
    const bindings=Array.from({length:256},(_,i)=>({id:uuid(i+2),phase:'macro',source:{sourceId:'a',signalId:'level'},target,inputMin:0,inputMax:1,outputMin:0,outputMax:1,exponent:1,invert:false,mode:'replace',enabled:false}));
    x.mapping={version:2,mapping:{version:1,targets:[{target,definition:{id:'gain',type:'number',label:'Gain',default:0,min:0,max:1,changeCost:'live'}}],bindings},smoothing:bindings.map(b=>({bindingId:b.id,tauMs:0}))};
    let state=actual.createLiveInputState(x.initial.definition,0,0),timed=mapping.createTimedMappingState(x.mapping,0);
    for(let i=0;i<252;i++){const step={timeMs:0,authority:'studio',base:[{target,value:0}],hostValues:[]};const r=actual.stepLiveInputs(state,step),m=mapping.evaluateTimedNumericMappings(x.mapping,r.frame,timed);state=r.state;timed=m.state;x.operations.push({kind:'step',observedAtMs:null,step,frame:r.frame,events:r.events,discarded:r.discarded,values:m.values,continuous:[]});}
    const prefix={...x,operations:x.operations.slice(0,251)};
    assert.equal(normalize(prefix).summary.work,65520);assert.equal(calls,251);
    calls=0;assert.throws(()=>normalize(x),{code:'LIVE_TRANSCRIPT_QUOTA_EXCEEDED'});assert.equal(calls,251);
    creates=0;const hostile={...x,mapping:'x'.repeat(8388608)};assert.throws(()=>normalize(hostile),{code:'LIVE_TRANSCRIPT_QUOTA_EXCEEDED'});assert.equal(creates,0);
    console.log(JSON.stringify({steps:251,work:65520,nextWork:65780,ownerCallsBeforeRejection:calls,preflightOwnerCalls:creates,bytes:Buffer.byteLength(JSON.stringify(prefix))}));
  `;
  const r=spawnSync(process.execPath,['--experimental-test-module-mocks','--input-type=module','-e',script],{encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
  assert.equal(r.status,0,r.stderr+r.stdout);const evidence=JSON.parse(r.stdout.trim());assert.equal(evidence.ownerCallsBeforeRejection,251);assert.ok(evidence.bytes<limits.bytes);console.log('work boundary',evidence);
});

test('nested field order normalizes while all semantic arrays and config identities stay significant',async()=>{
  const x=populated();x.sourceConfigs[0].configuration={z:1,a:'x',flag:true,nullable:null};
  const r=await encode(x),reverse=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(reverse):Object.fromEntries(Object.entries(v).reverse().map(([k,value])=>[k,reverse(value)]))):v;
  assert.equal((await encode(reverse(x))).json,r.json);assert.deepEqual(Object.keys(r.transcript.sourceConfigs[0].configuration),['a','flag','nullable','z']);
  for(const change of [x=>x.seed++,x=>x.clock.inputDomainId='other',x=>x.sourceConfigs[0].configuration.z=2,x=>x.ending={status:'incomplete',reason:'cancelled',lostRecords:0}]){const copy=structuredClone(x);change(copy);assert.notEqual((await encode(copy)).sha256,r.sha256);}
  for(const config of [{nested:{}},{text:'x'.repeat(257)},{constructor:0}]){const copy=populated();copy.sourceConfigs[0].configuration=config;invalid(copy);}
  const states=empty();states.operations=[{...blank(),nowMs:1},{...blank(),nowMs:2}];const forward=await encode(states);states.operations.reverse();invalid(states);assert.equal(forward.transcript.operations[0].nowMs,1);
});

test('observation clock is monotonic across nulls and resets but independent of input clock',()=>{
  const x=empty();x.operations=[{...blank(),observedAtMs:20},{...blank(),observedAtMs:null},{kind:'reset',observedAtMs:21,definition:x.initial.definition,epoch:1,startMs:0,discarded:[]},{...blank(),observedAtMs:21}];
  assert.equal(normalize(x).summary.operations,4);
  for(const value of [19,-1,Infinity,Number.MAX_SAFE_INTEGER+1]){const c=structuredClone(x);c.operations[3].observedAtMs=value;invalid(c);}
});

test('digest capability is captured and closed failures never inspect thrown exceptions',async()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'crypto'),crypto=globalThis.crypto;
  let reads=0;const thrown=new Proxy({},{get(){reads++;throw 0;}});
  try{
    for(const replacement of [undefined,{subtle:{digest(){throw thrown;}}},{subtle:{digest(){return Promise.reject(thrown);}}},{get subtle(){throw thrown;}}]){
      Object.defineProperty(globalThis,'crypto',{configurable:true,value:replacement});
      await assert.rejects(encode(empty()),e=>e.code==='LIVE_TRANSCRIPT_HASH_UNAVAILABLE'&&e.message.length<=512&&!Object.hasOwn(e,'cause'));
    }
    assert.equal(reads,0);
    let unblock,called=0;const gate=new Promise(resolve=>unblock=resolve);
    Object.defineProperty(globalThis,'crypto',{configurable:true,value:{subtle:{digest(algorithm,bytes){called++;return gate.then(()=>crypto.subtle.digest(algorithm,bytes));}}}});
    const x=populated();const run=encode(x);assert.equal(called,1);x.initial.definition.sources[0]={...authority,generation:9};x.sourceConfigs[0].configuration.changed=true;
    Object.defineProperty(globalThis,'crypto',{configurable:true,value:undefined});unblock();const result=await run;
    assert.equal(result.transcript.initial.definition.sources[0].generation,0);assert.deepEqual(result.transcript.sourceConfigs[0].configuration,{});
    // Canonical failure is completed synchronously before even requesting digest.
    called=0;Object.defineProperty(globalThis,'crypto',{configurable:true,value:{subtle:{digest(){called++;return Promise.reject(0);}}}});
    await assert.rejects(decode(' '+result.json,result.sha256),{code:'INVALID_LIVE_TRANSCRIPT'});assert.equal(called,0);
  }finally{Object.defineProperty(globalThis,'crypto',original);}
});

test('owner structural and numerical limits remain effective without widening',()=>{
  const x=populated();const bad=[envelope(0)];bad[0]={...bad[0],kind:'event',payload:{type:'note',values:Array(17).fill(0)}};delete bad[0].value;
  const attempts=[Array.from({length:257},(_,i)=>envelope(i)),bad];
  for(const envelopes of attempts){const c=structuredClone(x);c.operations=[{kind:'admit',observedAtMs:null,nowMs:0,envelopes,decisions:[]}];invalid(c);}
  const sources=empty();sources.initial.definition.sources=Array.from({length:65},(_,i)=>({...authority,sourceId:'a'+i}));sources.sourceConfigs=sources.initial.definition.sources.map(a=>({sourceId:a.sourceId,calibrationId:a.calibrationId,configuration:{}}));invalid(sources);
  const signals=populated();signals.initial.definition.signals=Array.from({length:257},(_,i)=>({source:{sourceId:'a',signalId:'s'+i},kind:'continuous'}));invalid(signals);
  const step=empty();step.operations=[{kind:'step',observedAtMs:null,step:{timeMs:60000.001,authority:'studio',base:[],hostValues:[]},frame:{epoch:0,deltaMs:60000.001,authority:'studio',base:[],signals:[],hostValues:[]},events:[],discarded:[],values:[],continuous:[]}];invalid(step);
});
