'use strict';
const id = /^[a-f0-9]{64}$/, instance = /^[a-f0-9]{32}$/;
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
  constructor({runtimeId, start, limit = 16}) {
    if (!id.test(runtimeId)) throw Error('Invalid installed runtime identity');
    Object.assign(this, {runtimeId, start, limit}); this.entries = new Map(); this.errors = new Map();
    this.draining = new Map(); this.starting = new Set(); this.closed = false;this.lastNow=0;
  }
  retire(key, entry) {
    this.entries.delete(key); this.errors.delete(key);
    if (!entry.producer) return;
    this.draining.set(key, entry);
    this.stopEntry(key,entry);
  }
  stopEntry(key,entry) {
    if(entry.stopping)return entry.stopping;
    const producer=entry.producer;
    if(!producer)return Promise.resolve();
    // One cleanup owner across fault, removal and close. Keep the producer and
    // capacity reservation until its stop confirms exit, including on rejection.
    const stopping=Promise.resolve().then(()=>producer.stop(entry.faulted?{force:true}:undefined)).then(()=>{
      entry.producer=null;entry.stopping=null;
      if(this.draining.get(key)===entry)this.draining.delete(key);
    },error=>{
      entry.stopping=null;
      this.errors.set(key,'Installed producer cleanup failed: '+String(error.message||error));
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
    for(const [key,entry] of this.draining)if(!entry.stopping)this.stopEntry(key,entry);
    for (const [key, entry] of this.entries) if (!wanted.has(key)) this.retire(key, entry);
    for (const [key, value] of wanted) {
      if (this.closed) break;
      if (this.draining.has(key)) continue;
      let entry = this.entries.get(key);
      if (entry && (entry.request.releaseId !== value.releaseId || entry.request.hostPid !== value.hostPid || entry.request.descriptorHash!==value.descriptorHash)) {
        this.errors.set(key, 'Instance identity cannot change while attached'); continue;
      }
      if (!entry) {
        if (this.entries.size + this.draining.size >= this.limit) { this.errors.set(key, 'Installed runtime capacity reached (16 instances maximum)'); continue; }
        entry = {request: value, attempts: 0, retryAt: 0, lastFaultAt:null, producer: null,stopping:null,faulted:false}; this.entries.set(key, entry);
      }
      if(entry.stopping)continue;
      if (entry.producer) {
        if(entry.faulted){this.stopEntry(key,entry);continue;}
        const failure = entry.producer.exited ? 'Installed producer exited' : entry.producer.failure?.(now);
        if (!failure) continue;
        // A known hung/failed producer cannot drain reliably. Retire only its Job,
        // even when automatic retry is suppressed, before admitting a replacement.
        this.fault(key,entry,failure,now);
        entry.faulted=true;this.stopEntry(key,entry);
        continue;
      }
      if (now < entry.retryAt) continue;
      entry.attempts++;
      let starting;
      try {
        starting = Promise.resolve(this.start(value, now)); this.starting.add(starting);
        entry.producer = await starting;entry.faulted=false;this.errors.delete(key);
      }
      catch (error) { this.fault(key,entry,String(error.message || error),now); }
      finally { if (starting) this.starting.delete(starting); }
    }
  }
  async close() {
    this.closed = true;
    await Promise.allSettled(this.starting);
    for (const [key, entry] of this.entries) this.retire(key, entry);
    await Promise.all([...this.draining].map(([key,entry])=>this.stopEntry(key,entry)));
  }
}
module.exports = {InstanceRegistry, ProducerHealth, validateRequest, sameInstalledPath};
