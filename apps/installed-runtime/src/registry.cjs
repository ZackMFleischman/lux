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
  constructor({attemptId, startedAt, startupMs = 15000, heartbeatMs = 2500, frameMs = 4000}) {
    if (!instance.test(attemptId) || !Number.isFinite(startedAt)) throw Error('Invalid producer health identity');
    Object.assign(this, {attemptId, startedAt, startupMs, heartbeatMs, frameMs});
    this.sequence = 0; this.frame = 0n; this.completedFrames = 0; this.backpressureFrames = 0; this.ready = false;
    this.heartbeatAt = startedAt; this.frameAt = startedAt; this.outputAt = startedAt;
  }
  observe(value, now) {
    if (this.failure(now) || !value || value.version !== 1 || value.attemptId !== this.attemptId ||
        !Number.isSafeInteger(value.sequence) || value.sequence <= this.sequence || typeof value.ready !== 'boolean' ||
        typeof value.frameId !== 'string' || !/^\d{1,20}$/.test(value.frameId) ||
        !Number.isSafeInteger(value.completedFrames) || value.completedFrames < this.completedFrames ||
        !Number.isSafeInteger(value.backpressureFrames) || value.backpressureFrames < this.backpressureFrames ||
        Object.keys(value).sort().join() !== 'attemptId,backpressureFrames,completedFrames,frameId,ready,sequence,version') return false;
    const frame = BigInt(value.frameId);
    if (frame < this.frame || (this.ready && !value.ready) || (value.ready && (frame === 0n || value.completedFrames === 0))) return false;
    if (!this.ready && value.ready) { this.ready = true; this.frameAt = now; this.outputAt = now; }
    if (frame > this.frame) this.frameAt = now;
    if (value.completedFrames > this.completedFrames || value.backpressureFrames > this.backpressureFrames) this.outputAt = now;
    this.frame = frame; this.completedFrames = value.completedFrames; this.backpressureFrames = value.backpressureFrames;
    this.sequence = value.sequence; this.heartbeatAt = now;
    return true;
  }
  failure(now) {
    if (!this.ready) return now - this.startedAt >= this.startupMs ? 'Installed producer startup deadline exceeded' : null;
    if (now - this.heartbeatAt >= this.heartbeatMs) return 'Producer main heartbeat expired';
    if (now - this.frameAt >= this.frameMs) return 'Visual frame progress expired';
    if (now - this.outputAt >= this.frameMs) return 'Published output progress expired';
    return null;
  }
}
class InstanceRegistry {
  constructor({runtimeId, start, limit = 16}) {
    if (!id.test(runtimeId)) throw Error('Invalid installed runtime identity');
    Object.assign(this, {runtimeId, start, limit}); this.entries = new Map(); this.errors = new Map();
    this.draining = new Map(); this.starting = new Set(); this.closed = false;
  }
  retire(key, entry) {
    this.entries.delete(key); this.errors.delete(key);
    if (!entry.producer) return;
    // A three-second graceful drain must not stall sibling watchdog polling.
    // Retain ownership/capacity until cleanup ends, including during close().
    const drain = Promise.resolve().then(() => entry.producer.stop()).catch(error => {
      this.errors.set(key, 'Installed producer cleanup failed: ' + String(error.message || error));
    }).finally(() => { this.draining.delete(key); });
    this.draining.set(key, drain);
  }
  async reconcile(requests, now) {
    if (this.closed) return;
    const wanted = new Map();
    for (const raw of requests) { const value = validateRequest(raw, this.runtimeId); wanted.set(value.instanceId, value); }
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
        entry = {request: value, attempts: 0, retryAt: 0, producer: null}; this.entries.set(key, entry);
      }
      if (entry.producer) {
        const failure = entry.producer.exited ? 'Installed producer exited' : entry.producer.failure?.(now);
        if (!failure) continue;
        // A known hung/failed producer cannot drain reliably. Retire only its Job,
        // even on the final attempt, before applying the existing retry budget.
        await entry.producer.stop({force:true}); entry.producer = null;
        this.errors.set(key, failure); entry.retryAt = now + 1000 * entry.attempts;
        continue;
      }
      if (entry.attempts >= 3 || now < entry.retryAt) continue;
      entry.attempts++; entry.retryAt = now + 1000 * entry.attempts;
      let starting;
      try {
        starting = Promise.resolve(this.start(value, now)); this.starting.add(starting);
        entry.producer = await starting; this.errors.delete(key);
      }
      catch (error) { this.errors.set(key, String(error.message || error)); }
      finally { if (starting) this.starting.delete(starting); }
    }
  }
  async close() {
    this.closed = true;
    await Promise.allSettled(this.starting);
    for (const [key, entry] of this.entries) this.retire(key, entry);
    await Promise.all(this.draining.values());
  }
}
module.exports = {InstanceRegistry, ProducerHealth, validateRequest, sameInstalledPath};
