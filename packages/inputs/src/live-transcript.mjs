import { normalizeTimedMappingPlan, createTimedMappingState, evaluateTimedNumericMappings } from './mapping.mjs';
import { createLiveInputState, admitLiveInputs, changeLiveInputSources, resetLiveInputs, stepLiveInputs } from './timeline.mjs';

// A supplied policy transcript is data, not proof of truthful collection or an
// authority capability. Timeline and mapping remain the only policy owners.
export const liveTranscriptLimits = Object.freeze({ bytes: 8388608, values: 250000, depth: 16, operations: 1024, envelopes: 8192, sourceConfigs: 256, work: 65536 });
const encoder = new TextEncoder();
const MAX = Number.MAX_SAFE_INTEGER;
function failure(path, reason, code = 'INVALID_LIVE_TRANSCRIPT') {
  const bounded = path.slice(0, 200);
  return Object.assign(new Error(`${bounded}: ${reason.slice(0, 309)}`), { code, path: bounded });
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

export function normalizeLivePolicyTranscript(input) {
  // Per-call error membership avoids reading even a single property of an
  // arbitrary exception from Proxy reflection. No shared selected state exists.
  const errors = new WeakSet();
  function invalid(path, reason, code) { const e = failure(path, reason, code); errors.add(e); throw e; }
  const quota = (path, reason) => invalid(path, reason, 'LIVE_TRANSCRIPT_QUOTA_EXCEEDED');
  function owner(path, run) { try { return run(); } catch { invalid(path, 'policy owner rejected supplied operation'); } }
  function fields(value, keys, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k))) invalid(path, 'expected exact record fields');
    return value;
  }
  function array(value, path, limit, isQuota = false) {
    if (!Array.isArray(value)) invalid(path, 'expected array');
    if (limit !== undefined && value.length > limit) (isQuota ? quota : invalid)(path, 'array exceeds declared bound');
    return value;
  }
  function integer(value, path, max = MAX) { if (!Number.isSafeInteger(value) || value < 0 || value > max) invalid(path, 'expected bounded nonnegative integer'); return value; }
  function time(value, path) { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX) invalid(path, 'expected safe-range nonnegative milliseconds'); return value; }
  function id(value, path) { if (typeof value !== 'string' || !/^[a-z][A-Za-z0-9_]{0,63}$/.test(value) || ['constructor','prototype','__proto__'].includes(value)) invalid(path, 'invalid logical identifier'); return value; }
  function capture(value) {
    let bytes = 0, values = 0;
    const ancestors = new Set();
    function charge(n, path) { if (bytes > liveTranscriptLimits.bytes - n) quota(path, 'raw UTF-8 byte budget exceeded'); bytes += n; }
    function stringBytes(s, path) {
      if (s.length > liveTranscriptLimits.bytes) quota(path, 'raw string budget exceeded');
      return encoder.encode(JSON.stringify(s)).byteLength;
    }
    function copy(v, path, depth) {
      if (++values > liveTranscriptLimits.values) quota(path, 'visited value budget exceeded');
      if (depth > liveTranscriptLimits.depth) quota(path, 'raw depth budget exceeded');
      if (v === null) { charge(4,path); return null; }
      if (typeof v === 'string') { charge(stringBytes(v,path),path); return v; }
      if (typeof v === 'number') {
        if (!Number.isFinite(v)) invalid(path,'expected finite JSON number');
        const n = v === 0 ? 0 : v; charge(JSON.stringify(n).length,path); return n;
      }
      if (typeof v === 'boolean') { charge(v ? 4 : 5,path); return v; }
      if (!v || typeof v !== 'object' || ancestors.has(v)) invalid(path,'expected acyclic plain data');
      const isArray = Array.isArray(v), prototype = Object.getPrototypeOf(v);
      if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) invalid(path,'unexpected prototype');
      const keys = Reflect.ownKeys(v);
      if (isArray) {
        const length = Object.getOwnPropertyDescriptor(v,'length').value;
        if (length > 8192) quota(path,'raw array length budget exceeded');
        if (keys.length !== length + 1) invalid(path,'expected dense ordinary array');
        const descriptors = [];
        for (let i = 0; i < length; i++) {
          const d = Object.getOwnPropertyDescriptor(v,String(i));
          if (!d?.enumerable || !Object.hasOwn(d,'value')) invalid(path,'expected own data elements');
          descriptors.push(d);
        }
        charge(2 + Math.max(0,length - 1),path); ancestors.add(v);
        const out = descriptors.map((d,i) => copy(d.value,`${path}[${i}]`,depth + 1));
        ancestors.delete(v); return out;
      }
      if (keys.length > 32) quota(path,'record field budget exceeded');
      const descriptors = keys.map(key => {
        if (typeof key !== 'string') invalid(path,'symbol key is not JSON data');
        if (key.length > 64) quota(path,'record key budget exceeded');
        const d = Object.getOwnPropertyDescriptor(v,key);
        if (!d?.enumerable || !Object.hasOwn(d,'value')) invalid(path,'expected enumerable own data properties');
        return d;
      });
      // Snapshot every sibling descriptor and charge its key before descendants.
      charge(2 + Math.max(0,keys.length - 1),path);
      for (const key of keys) charge(stringBytes(key,path) + 1,path);
      ancestors.add(v); const out = {};
      keys.forEach((key,i) => Object.defineProperty(out,key,{value:copy(descriptors[i].value,`${path}.${key}`,depth + 1),enumerable:true}));
      ancestors.delete(v); return out;
    }
    return copy(value,'transcript',0);
  }
  // Reconstruction below owns field order only. Exported owners validate all
  // nested timeline/mapping semantics; no queue or smoothing math is copied.
  function record(value, keys, path) { fields(value,keys,path); return Object.fromEntries(keys.map(k => [k,value[k]])); }
  const ref = (v,p) => record(v,['sourceId','signalId'],p);
  const authority = (v,p) => record(v,['sourceId','generation','connected','calibrationId'],p);
  function definition(v,p) {
    fields(v,['version','sources','signals'],p);
    return {version:v.version,sources:array(v.sources,`${p}.sources`).map((s,i)=>authority(s,`${p}.sources[${i}]`)),signals:array(v.signals,`${p}.signals`).map((s,i)=>{
      const at=`${p}.signals[${i}]`;fields(s,['source','kind'],at);return {source:ref(s.source,`${at}.source`),kind:s.kind};
    })};
  }
  function envelope(v,p) {
    if (!v || !['continuous','event'].includes(v.kind)) invalid(p,'unsupported envelope kind');
    fields(v,['version','epoch','source','generation','calibrationId','sequence','timestampMs','kind',v.kind==='event'?'payload':'value'],p);
    const common={version:v.version,epoch:v.epoch,source:ref(v.source,`${p}.source`),generation:v.generation,calibrationId:v.calibrationId,sequence:v.sequence,timestampMs:v.timestampMs,kind:v.kind};
    return v.kind==='event' ? {...common,payload:record(v.payload,['type','values'],`${p}.payload`)} : {...common,value:v.value};
  }
  function inputValues(v,p) {
    return array(v,p).map((row,i)=>{const at=`${p}[${i}]`;fields(row,['target','value'],at);return {target:record(row.target,['sceneId','nodePath','controlId'],`${at}.target`),value:row.value};});
  }
  function compare(supplied, actual, path) {
    if (actual === null || typeof actual !== 'object') { if (supplied !== actual) invalid(path,'witness disagrees with policy result'); return; }
    if (Array.isArray(actual)) {
      if (!Array.isArray(supplied) || supplied.length !== actual.length) invalid(path,'witness array disagrees with policy result');
      actual.forEach((v,i)=>compare(supplied[i],v,`${path}[${i}]`)); return;
    }
    const keys=Object.keys(actual);fields(supplied,keys,path);keys.forEach(k=>compare(supplied[k],actual[k],`${path}.${k}`));
  }
  const pair = (a,b) => JSON.stringify([a,b]);
  const receipt = a => ({epoch:a.envelope.epoch,ingress:a.ingress});
  try {
    const raw=fields(capture(input),['version','mode','profile','seed','mapping','initial','clock','sourceConfigs','operations','ending'],'transcript');
    if (raw.version!==1 || raw.mode!=='live-policy-transcript' || raw.profile!=='i02b-v1') invalid('transcript','unsupported version, mode or profile');
    const seed=integer(raw.seed,'transcript.seed',0xffffffff);
    fields(raw.initial,['epoch','startMs','definition'],'transcript.initial');
    const initial={epoch:integer(raw.initial.epoch,'transcript.initial.epoch'),startMs:time(raw.initial.startMs,'transcript.initial.startMs'),definition:definition(raw.initial.definition,'transcript.initial.definition')};
    fields(raw.clock,['inputDomainId','observationDomainId','unit'],'transcript.clock');
    if(raw.clock.unit!=='ms')invalid('transcript.clock.unit','expected milliseconds');
    const clock={inputDomainId:id(raw.clock.inputDomainId,'transcript.clock.inputDomainId'),observationDomainId:id(raw.clock.observationDomainId,'transcript.clock.observationDomainId'),unit:'ms'};
    const sourceConfigs=array(raw.sourceConfigs,'transcript.sourceConfigs',256,true).map((c,i)=>{
      const p=`transcript.sourceConfigs[${i}]`;fields(c,['sourceId','calibrationId','configuration'],p);
      if(!c.configuration || typeof c.configuration!=='object' || Array.isArray(c.configuration))invalid(`${p}.configuration`,'expected flat configuration');
      const configuration={};
      for(const key of Object.keys(c.configuration).sort()) {
        id(key,p);const item=c.configuration[key];
        if(item!==null && !['string','number','boolean'].includes(typeof item))invalid(p,'expected configuration scalar');
        if(typeof item==='string' && item.length>256)invalid(p,'configuration string exceeds bound');
        configuration[key]=item;
      }
      return {sourceId:id(c.sourceId,p),calibrationId:id(c.calibrationId,p),configuration};
    });
    const configured=new Set();
    sourceConfigs.forEach(c=>{const key=pair(c.sourceId,c.calibrationId);if(configured.has(key))invalid('transcript.sourceConfigs','duplicate configuration pair');configured.add(key);});
    sourceConfigs.sort((a,b)=>a.sourceId<b.sourceId?-1:a.sourceId>b.sourceId?1:a.calibrationId<b.calibrationId?-1:a.calibrationId>b.calibrationId?1:0);
    const referenced=new Set();
    const cover=sources=>sources.forEach(s=>referenced.add(pair(s.sourceId,s.calibrationId)));
    cover(initial.definition.sources);
    const suppliedOperations=array(raw.operations,'transcript.operations',1024,true);
    // Validate count containers before charging, but delegate the plan itself.
    fields(raw.mapping,['version','mapping','smoothing'],'transcript.mapping');
    fields(raw.mapping.mapping,['version','targets','bindings'],'transcript.mapping.mapping');
    const targets=array(raw.mapping.mapping.targets,'transcript.mapping.mapping.targets').length;
    const bindings=array(raw.mapping.mapping.bindings,'transcript.mapping.mapping.bindings').length;
    let work=0,totalEnvelopes=0;
    function charge(terms,path) {
      let cost=0;for(const n of terms){if(!Number.isSafeInteger(n)||n<0||cost>MAX-n)quota(path,'work arithmetic exhausted');cost+=n;}
      if(work>liveTranscriptLimits.work-cost)quota(path,'reconciliation work budget exceeded');work+=cost;
    }
    charge([1,initial.definition.sources.length,initial.definition.signals.length,targets,bindings],'transcript.initial');
    const mapping=owner('transcript.mapping',()=>normalizeTimedMappingPlan(raw.mapping));
    let state=owner('transcript.initial',()=>createLiveInputState(initial.definition,initial.epoch,initial.startMs));
    let timed=owner('transcript.mapping',()=>createTimedMappingState(mapping,initial.epoch));
    let observed=-1;const operations=[];
    for(const [i,op] of suppliedOperations.entries()) {
      const p=`transcript.operations[${i}]`,kind=op?.kind;
      const union={admit:['nowMs','envelopes','decisions'],sources:['sources','discarded'],reset:['definition','epoch','startMs','discarded'],step:['step','frame','events','discarded','values','continuous']};
      if(!Object.hasOwn(union,kind))invalid(p,'unsupported operation kind');
      fields(op,['kind','observedAtMs',...union[kind]],p);
      const observedAtMs=op.observedAtMs===null?null:time(op.observedAtMs,`${p}.observedAtMs`);
      if(observedAtMs!==null){if(observedAtMs<observed)invalid(p,'observation clock moved backwards');observed=observedAtMs;}
      const count=kind==='admit'?array(op.envelopes,`${p}.envelopes`).length:0;
      if(totalEnvelopes>liveTranscriptLimits.envelopes-count)quota(p,'total envelope budget exceeded');totalEnvelopes+=count;
      const replacements=kind==='sources'?array(op.sources,`${p}.sources`).length:0;
      let resetSources=0,resetSignals=0;
      if(kind==='reset'){fields(op.definition,['version','sources','signals'],`${p}.definition`);resetSources=array(op.definition.sources,p).length;resetSignals=array(op.definition.signals,p).length;}
      charge([1,state.sources.length,state.signals.length,state.events.length,state.continuous.length,targets,bindings,count,replacements,resetSources,resetSignals],p);
      if(kind==='admit') {
        const nowMs=time(op.nowMs,`${p}.nowMs`),envelopes=op.envelopes.map((e,j)=>envelope(e,`${p}.envelopes[${j}]`));
        const r=owner(p,()=>admitLiveInputs(state,nowMs,envelopes));compare(op.decisions,r.decisions,`${p}.decisions`);
        operations.push({kind,observedAtMs,nowMs,envelopes,decisions:r.decisions});state=r.state;
      } else if(kind==='sources') {
        const sources=op.sources.map((s,j)=>authority(s,`${p}.sources[${j}]`));
        const r=owner(p,()=>changeLiveInputSources(state,sources));compare(op.discarded,r.discarded,`${p}.discarded`);cover(sources);
        operations.push({kind,observedAtMs,sources,discarded:r.discarded});state=r.state;
      } else if(kind==='reset') {
        const def=definition(op.definition,`${p}.definition`),epoch=integer(op.epoch,`${p}.epoch`),startMs=time(op.startMs,`${p}.startMs`);
        const r=owner(p,()=>resetLiveInputs(state,def,epoch,startMs));compare(op.discarded,r.discarded,`${p}.discarded`);
        const nextTimed=owner(p,()=>createTimedMappingState(mapping,epoch));cover(def.sources);
        operations.push({kind,observedAtMs,definition:def,epoch,startMs,discarded:r.discarded});state=r.state;timed=nextTimed;
      } else {
        fields(op.step,['timeMs','authority','base','hostValues'],`${p}.step`);
        const step={timeMs:time(op.step.timeMs,`${p}.step.timeMs`),authority:op.step.authority,base:inputValues(op.step.base,`${p}.step.base`),hostValues:inputValues(op.step.hostValues,`${p}.step.hostValues`)};
        const r=owner(p,()=>stepLiveInputs(state,step));
        const m=owner(p,()=>evaluateTimedNumericMappings(mapping,r.frame,timed));
        const held=new Map(r.state.continuous.map(a=>[pair(a.envelope.source.sourceId,a.envelope.source.signalId),a]));
        const continuous=r.frame.signals.map(signal=>{
          const a=held.get(pair(signal.source.sourceId,signal.source.signalId));
          if(!a || a.envelope.generation!==signal.generation || a.envelope.value!==signal.value || a.envelope.timestampMs>step.timeMs)invalid(p,'continuous contributor disagrees with held policy record');
          return receipt(a);
        });
        for(const [key,actual] of [['frame',r.frame],['events',r.events],['discarded',r.discarded],['values',m.values],['continuous',continuous]])compare(op[key],actual,`${p}.${key}`);
        operations.push({kind,observedAtMs,step,frame:r.frame,events:r.events,discarded:r.discarded,values:m.values,continuous});state=r.state;timed=m.state;
      }
    }
    if(referenced.size!==configured.size || [...referenced].some(k=>!configured.has(k)))invalid('transcript.sourceConfigs','configuration pairs must exactly cover authority snapshots');
    const ending=record(raw.ending,['status','reason','lostRecords'],'transcript.ending');
    if(ending.status==='complete') {
      if(ending.reason!=='requested'||ending.lostRecords!==0||state.events.length)invalid('transcript.ending','complete requires no pending events or loss');
    } else if(ending.status==='incomplete') {
      if(ending.reason==='output-loss') {if(ending.lostRecords!==null && integer(ending.lostRecords,'transcript.ending.lostRecords')===0)invalid('transcript.ending','output loss must be positive or unknown');}
      else {
        if(!['pending-events','owner-error','quota','cancelled','unrecordable-input'].includes(ending.reason)||ending.lostRecords!==0)invalid('transcript.ending','invalid incomplete ending');
        if(ending.reason==='pending-events'&&!state.events.length)invalid('transcript.ending','pending ending requires pending events');
      }
    } else invalid('transcript.ending','unsupported ending status');
    const transcript={version:1,mode:'live-policy-transcript',profile:'i02b-v1',seed,mapping,initial,clock,sourceConfigs,operations,ending};
    if(encoder.encode(JSON.stringify(transcript)).byteLength>liveTranscriptLimits.bytes)quota('transcript','canonical UTF-8 byte budget exceeded');
    return freeze({transcript,summary:{operations:operations.length,received:state.counters.received,counters:state.counters,pendingEvents:state.events.map(receipt),heldContinuous:state.continuous.map(receipt),work}});
  } catch(error) {
    if(errors.has(error))throw error;
    throw failure('transcript','descriptor capture or normalization failed');
  }
}

async function hash(bytes) {
  try {
    const subtle=globalThis.crypto?.subtle;
    const digest=subtle?.digest;
    if(typeof digest!=='function')throw null;
    // Capture the digest method and receiver before suspension.
    const result=await digest.call(subtle,'SHA-256',bytes);
    const view=new Uint8Array(result);
    if(view.length!==32)throw null;
    return Array.from(view,n=>n.toString(16).padStart(2,'0')).join('');
  } catch { throw failure('transcript.sha256','Web Crypto SHA-256 is unavailable','LIVE_TRANSCRIPT_HASH_UNAVAILABLE'); }
}
export async function encodeLivePolicyTranscript(input) {
  const normalized=normalizeLivePolicyTranscript(input),json=JSON.stringify(normalized.transcript),bytes=encoder.encode(json);
  const sha256=await hash(bytes);
  return Object.freeze({...normalized,json,sha256});
}
export async function decodeLivePolicyTranscript(json,expectedSha256) {
  if(typeof json!=='string')throw failure('transcript.json','expected primitive JSON string');
  if(json.length>liveTranscriptLimits.bytes)throw failure('transcript.json','raw string budget exceeded','LIVE_TRANSCRIPT_QUOTA_EXCEEDED');
  if(typeof expectedSha256!=='string'||!/^[0-9a-f]{64}$/.test(expectedSha256))throw failure('transcript.sha256','expected lowercase SHA-256');
  const bytes=encoder.encode(json);
  if(bytes.byteLength>liveTranscriptLimits.bytes)throw failure('transcript.json','UTF-8 byte budget exceeded','LIVE_TRANSCRIPT_QUOTA_EXCEEDED');
  let raw;try{raw=JSON.parse(json);}catch{throw failure('transcript.json','malformed JSON');}
  const normalized=normalizeLivePolicyTranscript(raw);
  if(JSON.stringify(normalized.transcript)!==json)throw failure('transcript.json','expected exact canonical JSON representation');
  const sha256=await hash(bytes);
  if(sha256!==expectedSha256)throw failure('transcript.sha256','SHA-256 mismatch');
  return Object.freeze({...normalized,json,sha256});
}
