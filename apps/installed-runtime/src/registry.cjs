'use strict';
const id = /^[a-f0-9]{64}$/, instance = /^[a-f0-9]{32}$/;
const restartLedger = require('./restart-intent.cjs');
const restartOwners = new WeakMap(), restartHandles = new WeakMap();
const ownerError = code => Object.assign(new Error(code), {code});
// Never read an arbitrary thrown object's message/getters or coerce it.
function diagnostic(value) {
  if (typeof value === 'string' && value) return value.slice(0,512);
  try {
    if (typeof Error.isError==='function' ? Error.isError(value) : value instanceof Error) {
      const message=Object.getOwnPropertyDescriptor(value,'message');
      if (message && typeof message.value === 'string' && message.value) return message.value.slice(0,512);
    }
  } catch { /* A proxy is not a trusted diagnostic. */ }
  return 'Installed producer operation failed';
}
function mutateRestart(state, action) {
  const now=state.now();
  if (typeof now!=='number' || !Number.isFinite(now) || now<0 || now<state.time) throw ownerError('INVALID_CLOCK');
  const result=action(now);state.time=now;return result;
}
function ownedHandle(registry, handle) {
  const state=restartOwners.get(registry), owner=restartHandles.get(handle);
  if (!state || !owner || owner.token!==state.token) throw ownerError('INVALID_HANDLE');
  return state;
}
function publish(registry,entry,phase,operationId=null) {
  const state=restartOwners.get(registry),join=state?.entries.get(entry);
  if (!join?.handle) return;
  mutateRestart(state,now=>restartLedger.observeRestartOwner(join.handle,JSON.stringify({generation:entry.attempts,
    attemptId:entry.attemptId,phase,operationId}),now));
}
function finishRetirement(registry,key,entry) {
  if (entry.startPending || entry.producer || entry.stopping) return;
  const state=restartOwners.get(registry),join=state?.entries.get(entry);
  if (join?.handle) {
    publish(registry,entry,'removed');
    mutateRestart(state,now=>restartLedger.retireRestart(join.handle,now));
    restartHandles.get(join.handle).entry=null;
    state.entries.delete(entry);
  }
  if (registry.draining.get(key)===entry) registry.draining.delete(key);
  if (!entry.ownerFailure) registry.errors.delete(key);
}
function attemptContext(registry,key,entry,generation) {
  const state=restartOwners.get(registry);
  if (!state) return undefined;
  let used=false;
  const context=Object.freeze({generation,bindValidated(sourceHash,attemptId) {
    if (registry.closed || entry.removing) throw ownerError('REGISTRY_CLOSED');
    if (used || !entry.startPending || entry.attempts!==generation || registry.entries.get(key)!==entry)
      throw ownerError('RESTART_OWNER_CONFLICT');
    used=true;
    if (typeof sourceHash!=='string' || !id.test(sourceHash) || typeof attemptId!=='string' || !instance.test(attemptId))
      throw ownerError('RESTART_IDENTITY_UNAVAILABLE');
    if (attemptId===entry.previousAttemptId) throw ownerError('RESTART_OWNER_CONFLICT');
    const request=entry.request;
    const identity={version:1,runtimeId:request.runtimeId,releaseId:request.releaseId,sourceHash,
      instanceId:request.instanceId,hostPid:request.hostPid,descriptorHash:request.version===2?request.descriptorHash:null};
    let join=state.entries.get(entry);
    if (join) {
      for (const field of Object.keys(identity)) if (identity[field]!==join.identity[field]) throw ownerError('RESTART_OWNER_CONFLICT');
    } else {
      const attachmentId=state.nonce();
      const bound={...identity,attachmentId};
      // Sampling before attach prevents invalid clocks from creating provenance.
      mutateRestart(state,()=>{
        const handle=restartLedger.attachRestart(state.queue,JSON.stringify(bound));
        join={handle,identity:bound};state.entries.set(entry,join);
        restartHandles.set(handle,{token:state.token,entry});
      });
    }
    entry.attemptId=attemptId;
    publish(registry,entry,'starting');
  }});
  return context;
}
const sameInstalledPath = (a, b) => require('node:path').win32.resolve(a).toLowerCase() === require('node:path').win32.resolve(b).toLowerCase();
function validateRequest(value, runtimeId) {
  if (!value || ![1,2].includes(value.version) || !id.test(value.runtimeId) || value.runtimeId !== runtimeId || !id.test(value.releaseId) ||
      !instance.test(value.instanceId) || !Number.isSafeInteger(value.hostPid) || value.hostPid < 1 ||
      (value.version===2&&!id.test(value.descriptorHash))||Object.keys(value).sort().join() !== (value.version===2?'descriptorHash,hostPid,instanceId,releaseId,runtimeId,version':'hostPid,instanceId,releaseId,runtimeId,version')) throw Error('Invalid installed instance request');
  return value;
}
// All time values are the supervisor's monotonic clock, never child wall time.
class ProducerHealth {
  constructor({attemptId, startedAt, startupMs = 15000, heartbeatMs = 1250, workerMs = 1250, frameMs = 4000}) {
    if (!instance.test(attemptId) || !Number.isFinite(startedAt)) throw Error('Invalid producer health identity');
    Object.assign(this, {attemptId, startedAt, startupMs, heartbeatMs, workerMs, frameMs});
    this.sequence = 0; this.frame = 0n; this.completedFrames = 0; this.backpressureFrames = 0; this.ready = false;
    this.heartbeatAt = startedAt; this.frameAt = startedAt; this.outputAt = startedAt;
    this.workerHeartbeat=0;this.workerAt=null;
  }
  observe(value, now) {
    if (this.failure(now) || !value || value.version !== 2 || value.attemptId !== this.attemptId ||
        !Number.isSafeInteger(value.sequence) || value.sequence <= this.sequence || typeof value.ready !== 'boolean' ||
        !Number.isSafeInteger(value.workerHeartbeat)||value.workerHeartbeat<this.workerHeartbeat||value.workerHeartbeat<0||
        typeof value.frameId !== 'string' || !/^\d{1,20}$/.test(value.frameId) ||
        !Number.isSafeInteger(value.completedFrames) || value.completedFrames < this.completedFrames ||
        !Number.isSafeInteger(value.backpressureFrames) || value.backpressureFrames < this.backpressureFrames ||
        Object.keys(value).sort().join() !== 'attemptId,backpressureFrames,completedFrames,frameId,ready,sequence,version,workerHeartbeat') return false;
    const frame = BigInt(value.frameId);
    if (frame < this.frame || (this.ready && !value.ready) || (value.ready && (frame === 0n || value.completedFrames === 0 || value.workerHeartbeat===0))) return false;
    if (!this.ready && value.ready) { this.ready = true; this.frameAt = now; this.outputAt = now; }
    if (frame > this.frame) this.frameAt = now;
    if (value.completedFrames > this.completedFrames || value.backpressureFrames > this.backpressureFrames) this.outputAt = now;
    this.frame = frame; this.completedFrames = value.completedFrames; this.backpressureFrames = value.backpressureFrames;
    if(value.workerHeartbeat>this.workerHeartbeat)this.workerAt=now;
    this.workerHeartbeat=value.workerHeartbeat;
    this.sequence = value.sequence; this.heartbeatAt = now;
    return true;
  }
  failure(now) {
    // Startup may spend 15s loading Electron/awaiting healthy async initialization.
    // Once each event loop reports, its independent liveness deadline is armed
    // even before ready. Fresh main/file writes never renew worker liveness.
    if (this.sequence>0 && now - this.heartbeatAt >= this.heartbeatMs) return 'Producer main heartbeat expired';
    if (this.workerAt!==null && now-this.workerAt>=this.workerMs)return 'Visual worker heartbeat expired';
    if (!this.ready) return now - this.startedAt >= this.startupMs ? 'Installed producer startup deadline exceeded' : null;
    if (now - this.frameAt >= this.frameMs) return 'Visual frame progress expired';
    if (now - this.outputAt >= this.frameMs) return 'Published output progress expired';
    return null;
  }
}
class InstanceRegistry {
  constructor({runtimeId, start, limit = 16, restart}) {
    if (!id.test(runtimeId)) throw Error('Invalid installed runtime identity');
    Object.assign(this, {runtimeId, start, limit}); this.entries = new Map(); this.errors = new Map();
    this.draining = new Map(); this.starting = new Set(); this.closed = false;this.lastNow=0;
    if (restart!==undefined) {
      if (limit!==16 || typeof restart.now!=='function' || typeof restart.nonce!=='function') throw ownerError('INVALID_INPUT');
      const queue=restartLedger.createRestartQueue(runtimeId,restart.supervisorEpoch);
      restartOwners.set(this,{queue,now:restart.now,nonce:restart.nonce,time:0,token:{},entries:new WeakMap()});
    }
  }
  restartTarget(instanceId) {
    const entry=this.entries.get(instanceId);
    return !entry || entry.removing ? null : restartOwners.get(this)?.entries.get(entry)?.handle ?? null;
  }
  requestRestart(handle,commandJson) {
    const state=ownedHandle(this,handle);
    // Keep the ledger's retired-handle precedence even when the clock is bad.
    if (restartLedger.inspectRestart(handle).retired) throw ownerError('ATTACHMENT_RETIRED');
    return mutateRestart(state,now=>restartLedger.requestRestart(handle,commandJson,now));
  }
  cancelRestart(handle,operationId,commandSequence) {
    const state=ownedHandle(this,handle);
    if (restartLedger.inspectRestart(handle).retired) throw ownerError('ATTACHMENT_RETIRED');
    return mutateRestart(state,now=>restartLedger.cancelRestart(handle,operationId,commandSequence,now));
  }
  inspectRestart(handle) {
    ownedHandle(this,handle);return restartLedger.inspectRestart(handle);
  }
  ownerFailure(key,entry,error) {
    entry.ownerFailure=true;
    this.errors.set(key,diagnostic(error));
    this.closed=true;
    // Cleanup remains live even when the queue cannot publish its status.
    void this.close().catch(()=>{});
  }
  retire(key, entry) {
    entry.removing=true;
    this.entries.delete(key);
    this.draining.set(key, entry);
    try { publish(this,entry,'removing'); }
    finally {
      if (entry.producer) this.stopEntry(key,entry);
      else finishRetirement(this,key,entry);
    }
  }
  stopEntry(key,entry) {
    if(entry.stopping)return entry.stopping;
    const producer=entry.producer;
    if(!producer){finishRetirement(this,key,entry);return Promise.resolve();}
    // One cleanup owner across fault, removal and close. Keep the producer and
    // capacity reservation until its stop confirms exit, including on rejection.
    const stopping=Promise.resolve().then(()=>producer.stop(entry.faulted?{force:true}:undefined)).then(()=>{
      entry.producer=null;entry.stopping=null;
      try {
        if(entry.removing)finishRetirement(this,key,entry);
        else if(entry.faulted)publish(this,entry,'failed_clear');
      } catch(error){this.ownerFailure(key,entry,error);throw error;}
    },error=>{
      entry.stopping=null;
      this.errors.set(key,'Installed producer cleanup failed: '+diagnostic(error));
      throw error;
    });
    entry.stopping=stopping;
    void stopping.catch(()=>{}); // Polling observes the error; close awaits it.
    return stopping;
  }
  fault(key,entry,message,now) {
    const retry=entry.lastFaultAt===null||now-entry.lastFaultAt>=30000;
    entry.lastFaultAt=now;entry.retryAt=retry?now+250:Infinity;
    this.errors.set(key,retry?message:message+'; second fault within 30 seconds. Remove and re-add this source to retry.');
  }
  async reconcile(requests, now) {
    if (this.closed) return;
    if(!Number.isFinite(now)||now<this.lastNow)throw Error('Registry clock must be monotonic');
    this.lastNow=now;
    const wanted = new Map();
    for (const raw of requests) { const value = validateRequest(raw, this.runtimeId); wanted.set(value.instanceId, value); }
    for(const [key,entry] of this.draining)if(!entry.stopping){
      try {this.stopEntry(key,entry);}catch(error){this.ownerFailure(key,entry,error);throw error;}
    }
    for (const [key, entry] of this.entries) if (!wanted.has(key)) {
      try {this.retire(key,entry);}catch(error){this.ownerFailure(key,entry,error);throw error;}
    }
    for (const [key, value] of wanted) {
      if (this.closed) break;
      if (this.draining.has(key)) continue;
      let entry = this.entries.get(key);
      if (entry && (entry.request.version!==value.version || entry.request.releaseId !== value.releaseId || entry.request.hostPid !== value.hostPid || entry.request.descriptorHash!==value.descriptorHash)) {
        this.errors.set(key, 'Instance identity cannot change while attached'); continue;
      }
      if (!entry) {
        if (this.entries.size + this.draining.size >= this.limit) { this.errors.set(key, 'Installed runtime capacity reached (16 instances maximum)'); continue; }
        entry = {request: {...value}, attempts: 0, retryAt: 0, lastFaultAt:null, producer: null,stopping:null,
          faulted:false,startPending:false,attemptId:null,previousAttemptId:null,removing:false}; this.entries.set(key, entry);
      }
      if(entry.stopping || entry.startPending)continue;
      if (entry.producer) {
        if(entry.faulted){this.stopEntry(key,entry);continue;}
        const failure = entry.producer.exited ? 'Installed producer exited' : entry.producer.failure?.(now);
        if (!failure) continue;
        // A known hung/failed producer cannot drain reliably. Retire only its Job,
        // even when automatic retry is suppressed, before admitting a replacement.
        this.fault(key,entry,diagnostic(failure),now);
        entry.faulted=true;
        try {publish(this,entry,'failed_owned');}
        catch(error){this.ownerFailure(key,entry,error);throw error;}
        finally {this.stopEntry(key,entry);}
        continue;
      }
      const state=restartOwners.get(this),join=state?.entries.get(entry);
      let effect;
      try {
        effect=join ? mutateRestart(state,at=>restartLedger.takeRestart(join.handle,at)) : null;
        if (!effect && now < entry.retryAt) continue;
        if (entry.attempts===Number.MAX_SAFE_INTEGER) throw ownerError('IDENTITY_EXHAUSTED');
        if (effect && (effect.previousGeneration!==entry.attempts || effect.targetGeneration!==entry.attempts+1 ||
            JSON.stringify(effect.identity)!==JSON.stringify(join.identity))) throw ownerError('RESTART_OWNER_CONFLICT');
        entry.attempts++;
        entry.startPending=true;entry.previousAttemptId=entry.attemptId;entry.attemptId=null;
        publish(this,entry,'starting',effect?.operationId ?? null);
      } catch(error){entry.startPending=false;this.ownerFailure(key,entry,error);throw error;}
      const attempt=attemptContext(this,key,entry,entry.attempts);
      let resolveStart,rejectStart;
      const starting=new Promise((resolve,reject)=>{resolveStart=resolve;rejectStart=reject;});
      this.starting.add(starting);
      let result,startError,failed=false;
      try {
        try {resolveStart(this.start(entry.request,now,attempt));}catch(error){rejectStart(error);}
        try {result=await starting;}catch(error){failed=true;startError=error;}
        if (!failed) entry.producer=result; // Retain before dropping pending ownership.
        entry.startPending=false;
        if (this.closed || entry.removing) {
          if (!entry.removing) this.retire(key,entry);
          else if (entry.producer) this.stopEntry(key,entry);
          else finishRetirement(this,key,entry);
          continue;
        }
        if (failed) {
          this.fault(key,entry,diagnostic(startError),now);entry.faulted=true;
          publish(this,entry,'failed_clear');
          const failureCode=diagnostic(startError);
          if (['RESTART_OWNER_CONFLICT','RESTART_IDENTITY_UNAVAILABLE','INVALID_CLOCK','ATTACHMENT_EXISTS'].includes(failureCode)) {
            this.ownerFailure(key,entry,startError);throw startError;
          }
        } else {
          if (state && !entry.attemptId) throw ownerError('RESTART_IDENTITY_UNAVAILABLE');
          const initialFailure=result?.initialFailure;
          if (initialFailure) {
            this.fault(key,entry,diagnostic(initialFailure),now);entry.faulted=true;
            publish(this,entry,'failed_owned');this.stopEntry(key,entry);
          } else {entry.faulted=false;this.errors.delete(key);publish(this,entry,'running');}
        }
      }
      catch (error) {this.ownerFailure(key,entry,error);throw error;}
      finally {this.starting.delete(starting);}
    }
  }
  async close() {
    this.closed = true;
    let publicationError;
    const state=restartOwners.get(this);
    try {if(state)mutateRestart(state,now=>restartLedger.closeRestartQueue(state.queue,now));}
    catch(error){publicationError=error;}
    // Removing is synchronous; close cannot authorize a deferred bind.
    for (const [key,entry] of this.entries) {
      try {this.retire(key,entry);}catch(error){entry.ownerFailure=true;this.errors.set(key,diagnostic(error));publicationError??=error;}
    }
    await Promise.allSettled(this.starting);
    await Promise.all([...this.draining].map(([key,entry])=>this.stopEntry(key,entry)));
    if(publicationError)throw publicationError;
  }
}
module.exports = {InstanceRegistry, ProducerHealth, validateRequest, sameInstalledPath};
