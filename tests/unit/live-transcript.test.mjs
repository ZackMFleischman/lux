import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { normalizeLivePolicyTranscript as normalize, encodeLivePolicyTranscript as encode, decodeLivePolicyTranscript as decode } from '../../packages/inputs/src/live-transcript.mjs';
import * as timeline from '../../packages/inputs/src/timeline.mjs';
import * as mapping from '../../packages/inputs/src/mapping.mjs';

const empty = () => ({ version:1, mode:'live-policy-transcript', profile:'i02b-v1', seed:1,
  mapping:{version:2,mapping:{version:1,targets:[],bindings:[]},smoothing:[]},
  initial:{epoch:0,startMs:0,definition:{version:1,sources:[],signals:[]}},
  clock:{inputDomainId:'input',observationDomainId:'receipt',unit:'ms'},
  sourceConfigs:[],operations:[],ending:{status:'complete',reason:'requested',lostRecords:0} });
const literal = '{"version":1,"mode":"live-policy-transcript","profile":"i02b-v1","seed":1,"mapping":{"version":2,"mapping":{"version":1,"targets":[],"bindings":[]},"smoothing":[]},"initial":{"epoch":0,"startMs":0,"definition":{"version":1,"sources":[],"signals":[]}},"clock":{"inputDomainId":"input","observationDomainId":"receipt","unit":"ms"},"sourceConfigs":[],"operations":[],"ending":{"status":"complete","reason":"requested","lostRecords":0}}';
const uuid = n => `${n.toString(16).padStart(8,'0')}-1111-4111-8111-111111111111`;
const target = {sceneId:uuid(1),nodePath:[],controlId:'gain'};
const source = (sourceId='a', signalId='level') => ({sourceId,signalId});
const authority = (sourceId='a', generation=0, calibrationId='cal0', connected=true) => ({sourceId,generation,connected,calibrationId});
const definition = () => ({version:1,sources:[authority(),authority('b')],signals:[{source:source(),kind:'continuous'},{source:source('a','note'),kind:'event'},{source:source('b','note'),kind:'event'}]});
const envelope = (sequence=0,timestampMs=0,kind='event',extra={}) => ({version:1,epoch:0,source:source('a',kind==='event'?'note':'level'),generation:0,calibrationId:'cal0',sequence,timestampMs,kind,...(kind==='event'?{payload:{type:'note',values:[60,1]}}:{value:1}),...extra});
const plan = (two=false) => {
  const bindings=[{id:uuid(2),phase:'macro',source:source(),target,inputMin:0,inputMax:1,outputMin:0,outputMax:1,exponent:1,invert:false,mode:two?'add':'replace',enabled:true}];
  if(two) bindings.push({...bindings[0],id:uuid(3),exponent:2});
  return {version:2,mapping:{version:1,targets:[{target,definition:{id:'gain',type:'number',label:'Gain',default:0,min:0,max:2,changeCost:'live'}}],bindings},smoothing:bindings.map((b,i)=>({bindingId:b.id,tauMs:i?200:100}))};
};
// This builder calls real owners. Test assertions below independently pin results.
function builder(p=empty().mapping, def=definition()) {
  const input=empty(); input.mapping=p; input.initial.definition=def;
  const configs=new Map();
  const cover=sources=>sources.forEach(a=>configs.set(JSON.stringify([a.sourceId,a.calibrationId]),{sourceId:a.sourceId,calibrationId:a.calibrationId,configuration:{}}));
  cover(def.sources);
  let state=timeline.createLiveInputState(def,0,0), timed=mapping.createTimedMappingState(p,0);
  const append=op=>{input.operations.push(op);return op;};
  return {input,get state(){return state;},get timed(){return timed;},
    admit(nowMs,envelopes,observedAtMs=null){const r=timeline.admitLiveInputs(state,nowMs,envelopes);state=r.state;return append({kind:'admit',observedAtMs,nowMs,envelopes,decisions:r.decisions});},
    sources(sources,observedAtMs=null){const r=timeline.changeLiveInputSources(state,sources);state=r.state;cover(sources);return append({kind:'sources',observedAtMs,sources,discarded:r.discarded});},
    reset(definition,epoch,startMs,observedAtMs=null){const r=timeline.resetLiveInputs(state,definition,epoch,startMs);state=r.state;timed=mapping.createTimedMappingState(p,epoch);cover(definition.sources);return append({kind:'reset',observedAtMs,definition,epoch,startMs,discarded:r.discarded});},
    step(timeMs,extra={},observedAtMs=null){const step={timeMs,authority:'studio',base:p.mapping.targets.map(({target})=>({target,value:0})),hostValues:[],...extra};const r=timeline.stepLiveInputs(state,step);const m=mapping.evaluateTimedNumericMappings(p,r.frame,timed);state=r.state;timed=m.state;const continuous=r.frame.signals.map(s=>{const a=state.continuous.find(a=>a.envelope.source.sourceId===s.source.sourceId&&a.envelope.source.signalId===s.source.signalId);return {epoch:a.envelope.epoch,ingress:a.ingress};});return append({kind:'step',observedAtMs,step,frame:r.frame,events:r.events,discarded:r.discarded,values:m.values,continuous});},
    finish(ending=input.ending){input.sourceConfigs=[...configs.values()];input.ending=ending;return structuredClone(input);}
  };
}
const invalid = input => assert.throws(()=>normalize(input),{code:'INVALID_LIVE_TRANSCRIPT'});
const corrupt=(input,change)=>{const copy=structuredClone(input);change(copy);invalid(copy);};
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-12,`${actual} != ${expected}`);

test('empty canonical identity is independently pinned',async()=>{
  const result=await encode(empty());assert.equal(result.json,literal);assert.equal(Buffer.byteLength(result.json),432);
  assert.equal(result.sha256,'0c25161254eb8af4f702a4dae47b28db9632741b610e9283c9c6466026bd703a');
  assert.equal(result.sha256,createHash('sha256').update(literal).digest('hex'));
  assert.deepEqual((await decode(result.json,result.sha256)).transcript,result.transcript);
  assert.deepEqual(result.summary.pendingEvents,[]);assert.equal(result.summary.work,1);
});

test('20 then 10 receipts retain ingress order while steps consume 1 then 0',async()=>{
  const b=builder();b.admit(20,[envelope(0,20),envelope(0,10,'event',{source:source('b','note')})]);b.step(10);b.step(20);
  const input=b.finish(), r=await encode(input), ops=r.transcript.operations;
  assert.deepEqual(ops[0].decisions.map(d=>d.admitted.ingress),[0,1]);
  assert.deepEqual(ops.slice(1).map(o=>o.events.map(e=>e.ingress)),[[1],[0]]);
  assert.deepEqual(ops[0].envelopes.map(e=>e.timestampMs),[20,10]);assert.equal(r.summary.received,2);
  for(const change of [x=>x.operations[0].decisions.reverse(),x=>x.operations[0].decisions.pop(),x=>x.operations[0].decisions[0].admitted.ingress++,x=>x.operations[0].decisions[0].admitted.receivedAtMs++,x=>x.operations[0].envelopes[0].timestampMs=10,x=>x.operations[1].events=x.operations[2].events,x=>x.operations.reverse()]) corrupt(input,change);
});

test('equal events and post-zero receipts retain distinct consumption opportunities',()=>{
  const b=builder();b.admit(0,[envelope(),envelope(1)]);b.step(0);b.step(0);b.admit(0,[envelope(2)]);b.step(0);b.step(1);
  const r=normalize(b.finish());assert.deepEqual(r.transcript.operations.filter(o=>o.kind==='step').map(o=>o.events.map(e=>e.ingress)),[[0,1],[],[],[2]]);
  assert.equal(r.summary.counters.consumedEvents,3);corrupt(b.finish(),x=>x.operations[1].events.pop());
});

test('overflow and late drops preserve originals and closed retry reasons',()=>{
  const b=builder();b.admit(0,Array.from({length:256},(_,i)=>envelope(i)));b.admit(0,[envelope(256),envelope(256)]);b.step(0);b.step(50);b.step(101);
  const input=b.finish(),r=normalize(input);assert.deepEqual(r.transcript.operations[1].decisions.map(d=>d.rejected.reason),['overflow','sequence']);
  assert.deepEqual(r.transcript.operations.slice(2).map(o=>o.events.length),[32,32,0]);assert.equal(r.transcript.operations[4].discarded.length,192);
  assert.equal(r.summary.counters.discarded.late,192);corrupt(input,x=>x.operations[4].discarded[0].reason='reset');corrupt(input,x=>x.operations[1].decisions[0].rejected.reason='late');
  const late=builder();late.admit(100.001,[envelope(),envelope()]);assert.deepEqual(normalize(late.finish()).transcript.operations[0].decisions.map(d=>d.rejected.reason),['late','sequence']);
});

test('continuous originals survive coalescing and exact held identity and freshness reconcile',async()=>{
  for(const equal of [false,true]){
    const b=builder();b.admit(10,[envelope(0,0,'continuous',{value:equal?1:0}),envelope(1,10,'continuous')]);b.step(5);b.step(10);b.step(510);b.step(510.001);
    const input=b.finish(),r=await encode(input),round=await decode(r.json,r.sha256);
    assert.equal(round.transcript.operations[0].decisions.length,2);assert.equal(r.summary.counters.coalescedContinuous,1);
    assert.deepEqual(r.transcript.operations.slice(1).map(o=>o.continuous),[[],[{epoch:0,ingress:1}],[{epoch:0,ingress:1}],[]]);
    assert.equal(r.transcript.operations[2].frame.signals[0].value,1);assert.equal(r.summary.counters.expiredContinuous,1);
    for(const change of [x=>x.operations[2].continuous[0].ingress=0,x=>x.operations[2].continuous=[],x=>x.operations[2].continuous.push({epoch:0,ingress:1}),x=>x.operations[2].frame.signals[0].value=0])corrupt(input,change);
  }
  const stale=builder();stale.admit(0,[envelope(0,0,'continuous')]);stale.admit(501,[envelope(1,0,'continuous')]);
  const r=normalize(stale.finish());assert.equal(r.summary.received,2);assert.equal(r.summary.counters.coalescedContinuous,1);assert.equal(r.summary.counters.expiredContinuous,1);assert.deepEqual(r.summary.heldContinuous,[]);
});

test('source calibration transitions and reset preserve discard and epoch-qualified identities',()=>{
  const b=builder();b.admit(0,[envelope(0,0,'continuous'),envelope(1),envelope(0,0,'event',{source:source('b','note')})]);
  b.sources([authority('a',1,'cal1'),authority('b')]);b.admit(0,[envelope(2),envelope(0,0,'event',{generation:1,calibrationId:'cal1'})]);
  b.reset(definition(),1,1000);b.admit(1000,[envelope(0,1000,'event',{epoch:1})]);
  const input=b.finish({status:'incomplete',reason:'pending-events',lostRecords:0}),r=normalize(input);
  assert.deepEqual(r.transcript.operations[1].discarded.map(d=>d.admitted.ingress),[1]);assert.equal(r.summary.counters.clearedContinuous,1);
  assert.equal(r.transcript.operations[2].decisions[0].rejected.reason,'generation');assert.deepEqual(r.transcript.operations[3].discarded.map(d=>d.admitted.ingress),[2,3]);
  assert.deepEqual(r.summary.pendingEvents,[{epoch:1,ingress:0}]);assert.equal(r.summary.received,6);
  for(const change of [x=>x.sourceConfigs.pop(),x=>x.sourceConfigs.push({...x.sourceConfigs[0]}),x=>x.sourceConfigs.push({sourceId:'unused',calibrationId:'cal0',configuration:{}}),x=>x.operations[1].sources[0].generation=0,x=>x.operations[3].discarded[0].admitted.envelope.epoch=1,x=>x.operations[1].discarded=[],x=>x.operations[3].discarded=[]])corrupt(input,change);
});

test('real smoothing and host/base authority reconcile only committed successful steps',async()=>{
  const b=builder(plan());b.admit(0,[envelope(0,0,'continuous',{value:0})]);b.step(0);b.admit(100,[envelope(1,100,'continuous')]);b.step(100);
  near(normalize(b.finish()).transcript.operations[3].values[0].value,0.6321205588285577);
  b.admit(100,[envelope(2,100)]);const prior=b.state;assert.throws(()=>b.step(101,{base:[]}),{code:'INVALID_INPUT_MAPPING'});assert.equal(b.state,prior);
  b.step(101);b.step(102,{authority:'host',hostValues:[{target,value:0.75}]});const input=b.finish(),r=await encode(input);
  assert.deepEqual(r.transcript.operations[5].events.map(e=>e.ingress),[2]);assert.equal(r.transcript.operations[6].values[0].value,0.75);
  for(const change of [x=>x.operations[5].step.base=[],x=>x.operations[3].values[0].value=1,x=>x.operations[3].frame.deltaMs=99,x=>x.operations[6].step.authority='studio',x=>x.operations[6].frame.hostValues[0].value=0.5])corrupt(input,change);
  const changed=b.finish();changed.operations[6].step.base[0].value=0.25;changed.operations[6].frame.base[0].value=0.25;assert.notEqual((await encode(changed)).sha256,r.sha256);
});

test('two nonlinear bindings retain separate smoothing and reset starts fresh',()=>{
  const b=builder(plan(true));b.admit(0,[envelope(0,0,'continuous',{value:0})]);b.step(0);b.admit(100,[envelope(1,100,'continuous',{value:0.5})]);b.step(100);
  const expected=[0.5*(1-Math.exp(-1)),0.25*(1-Math.exp(-0.5))];b.timed.bindings.forEach((row,i)=>near(row.value,expected[i]));
  near(normalize(b.finish()).transcript.operations[3].values[0].value,expected[0]+expected[1]);
  b.sources([authority('a',1,'cal1'),authority('b')]);b.admit(100,[envelope(0,100,'continuous',{generation:1,calibrationId:'cal1',value:0.5})]);b.step(100);
  assert.equal(normalize(b.finish()).transcript.operations[6].values[0].value,0.75);
  b.reset(definition(),1,0);b.admit(0,[envelope(0,0,'continuous',{epoch:1,value:0.5})]);b.step(0);assert.equal(normalize(b.finish()).transcript.operations[9].values[0].value,0.75);
});

test('endings keep pending events and output loss explicit',()=>{
  const b=builder();b.admit(0,[envelope()]);invalid(b.finish());
  const pending=b.finish({status:'incomplete',reason:'pending-events',lostRecords:0});assert.deepEqual(normalize(pending).summary.pendingEvents,[{epoch:0,ingress:0}]);
  for(const reason of ['owner-error','quota','cancelled','unrecordable-input']) assert.equal(normalize(b.finish({status:'incomplete',reason,lostRecords:0})).transcript.ending.reason,reason);
  for(const lostRecords of [1,null,Number.MAX_SAFE_INTEGER])assert.equal(normalize(b.finish({status:'incomplete',reason:'output-loss',lostRecords})).transcript.ending.lostRecords,lostRecords);
  for(const ending of [{status:'incomplete',reason:'output-loss',lostRecords:0},{status:'complete',reason:'requested',lostRecords:1},{status:'incomplete',reason:'quota',lostRecords:null}])invalid(b.finish(ending));
  corrupt(empty(),x=>delete x.ending);const e=empty();e.ending={status:'incomplete',reason:'pending-events',lostRecords:0};invalid(e);
});
