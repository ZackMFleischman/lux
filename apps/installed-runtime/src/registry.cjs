'use strict';
const id = /^[a-f0-9]{64}$/, instance = /^[a-f0-9]{32}$/;
const sameInstalledPath = (a, b) => require('node:path').win32.resolve(a).toLowerCase() === require('node:path').win32.resolve(b).toLowerCase();
function validateRequest(value, runtimeId) {
  if (!value || value.version !== 1 || !id.test(value.runtimeId) || value.runtimeId !== runtimeId || !id.test(value.releaseId) ||
      !instance.test(value.instanceId) || !Number.isSafeInteger(value.hostPid) || value.hostPid < 1 ||
      Object.keys(value).sort().join() !== 'hostPid,instanceId,releaseId,runtimeId,version') throw Error('Invalid installed instance request');
  return value;
}
class InstanceRegistry {
  constructor({runtimeId, start, limit = 16}) {
    if (!id.test(runtimeId)) throw Error('Invalid installed runtime identity');
    Object.assign(this, {runtimeId, start, limit}); this.entries = new Map(); this.errors = new Map();
  }
  async reconcile(requests, now) {
    const wanted = new Map();
    for (const raw of requests) { const value = validateRequest(raw, this.runtimeId); wanted.set(value.instanceId, value); }
    await Promise.all([...this.entries].filter(([key]) => !wanted.has(key)).map(async ([key, entry]) => {
      await entry.producer?.stop(); this.entries.delete(key); this.errors.delete(key);
    }));
    for (const [key, value] of wanted) {
      let entry = this.entries.get(key);
      if (entry && (entry.request.releaseId !== value.releaseId || entry.request.hostPid !== value.hostPid)) {
        this.errors.set(key, 'Instance identity cannot change while attached'); continue;
      }
      if (!entry) {
        if (this.entries.size >= this.limit) { this.errors.set(key, 'Installed runtime capacity reached (16 instances maximum)'); continue; }
        entry = {request: value, attempts: 0, retryAt: 0, producer: null}; this.entries.set(key, entry);
      }
      if (entry.producer && !entry.producer.exited) continue;
      if (entry.attempts >= 3 || now < entry.retryAt) continue;
      if (entry.producer) { await entry.producer.stop(); entry.producer = null; }
      entry.attempts++; entry.retryAt = now + 1000 * entry.attempts;
      try { entry.producer = await this.start(value); this.errors.delete(key); }
      catch (error) { this.errors.set(key, String(error.message || error)); }
    }
  }
  async close() { await Promise.all([...this.entries.values()].map(entry => entry.producer?.stop())); this.entries.clear(); }
}
module.exports = {InstanceRegistry, validateRequest, sameInstalledPath};
