'use strict';

// Process-local capabilities only. The later registry adapter owns cleanup truth.
const queues = new WeakMap(), attachments = new WeakMap();
const MAX = Number.MAX_SAFE_INTEGER;
const identityKeys = ['version','runtimeId','releaseId','sourceHash','instanceId','hostPid','descriptorHash','attachmentId'];
const observationKeys = ['generation','attemptId','phase','operationId'];
const commandKeys = ['version','supervisorEpoch','attachmentId','generation','commandSequence','operationId'];
const phases = new Set(['starting','running','failed_owned','failed_clear','removing','removed']);
const handle = () => Object.freeze(Object.create(null));
function fail(code) { throw Object.assign(new Error(code), {code}); }
function hex(value, size) { return typeof value === 'string' && value.length === size && /^[0-9a-f]+$/.test(value); }
function integer(value, minimum = 0) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && !Object.is(value, -0);
}
function canonical(text, keys) {
  if (typeof text !== 'string' || text.length > 1024 || Buffer.byteLength(text, 'utf8') > 1024) fail('INVALID_INPUT');
  let value;
  try { value = JSON.parse(text); } catch { fail('INVALID_INPUT'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail('INVALID_INPUT');
  const ordered = Object.fromEntries(keys.map(key => [key, value[key]]));
  if (JSON.stringify(ordered) !== text) fail('INVALID_INPUT');
  return ordered;
}
function queueState(queue) {
  const state = queues.get(queue);
  if (!state) fail('INVALID_HANDLE');
  return state;
}
function attachmentState(attachment, allowRetired = false) {
  const state = attachments.get(attachment);
  if (!state) fail('INVALID_HANDLE');
  if (state.retired && !allowRetired) fail('ATTACHMENT_RETIRED');
  return state;
}
function time(nowMs) {
  if (typeof nowMs !== 'number' || !Number.isFinite(nowMs) || nowMs < 0) fail('INVALID_CLOCK');
  return nowMs === 0 ? 0 : nowMs;
}
function clock(queue, now) { if (now < queue.time) fail('INVALID_CLOCK'); }
function identityCopy(v) {
  return Object.freeze({version:v.version, runtimeId:v.runtimeId, releaseId:v.releaseId,
    sourceHash:v.sourceHash, instanceId:v.instanceId, hostPid:v.hostPid,
    descriptorHash:v.descriptorHash, attachmentId:v.attachmentId});
}
function receiptCopy(v) {
  return v === null ? null : Object.freeze({operationId:v.operationId, commandSequence:v.commandSequence,
    generation:v.generation, targetGeneration:v.targetGeneration, status:v.status});
}
function statusCopy(s) {
  const v = s.observed;
  return Object.freeze({identity:identityCopy(s.identity), supervisorEpoch:s.queue.supervisorEpoch,
    observed:v === null ? null : Object.freeze({generation:v.generation, attemptId:v.attemptId,
      phase:v.phase, operationId:v.operationId}), lastSequence:s.lastSequence,
    receipt:receiptCopy(s.receipt), closed:s.queue.closed, retired:s.retired});
}
function createRestartQueue(runtimeId, supervisorEpoch) {
  if (!hex(runtimeId,64) || !hex(supervisorEpoch,32)) fail('INVALID_INPUT');
  const q = handle();
  queues.set(q, {runtimeId, supervisorEpoch, closed:false, time:0, instances:new Map(), members:new Map()});
  return q;
}
function attachRestart(queue, identityJson) {
  const q = queueState(queue), v = canonical(identityJson, identityKeys);
  if (v.version !== 1 || !hex(v.runtimeId,64) || !hex(v.releaseId,64) || !hex(v.sourceHash,64) ||
      !hex(v.instanceId,32) || !integer(v.hostPid,1) || !(v.descriptorHash === null || hex(v.descriptorHash,64)) ||
      !hex(v.attachmentId,32)) fail('INVALID_INPUT');
  if (v.runtimeId !== q.runtimeId) fail('INVALID_INPUT');
  if (q.closed) fail('QUEUE_CLOSED');
  if (q.instances.has(v.instanceId) || q.members.has(v.attachmentId)) fail('ATTACHMENT_EXISTS');
  if (q.members.size >= 16) fail('CAPACITY');
  const h = handle();
  const s = {queue:q, identity:v, observed:null, observationJson:null, previousAttemptId:null, lastSequence:0,
    receipt:null, commandJson:null, retired:false};
  attachments.set(h,s); q.members.set(v.attachmentId,s); q.instances.set(v.instanceId,s);
  return h;
}
function inspectRestart(attachment) { return statusCopy(attachmentState(attachment,true)); }

const failed = phase => phase === 'failed_owned' || phase === 'failed_clear';
const outstanding = receipt => receipt !== null && (receipt.status === 'accepted' || receipt.status === 'dispatched');
function withStatus(receipt, status) { return {...receipt, status}; }
function legalPhase(from, to) {
  if (from === to) return true;
  if (from === 'removed') return false;
  if (to === 'removing' || to === 'removed') return true;
  if (from === 'starting') return to === 'running' || failed(to);
  if (from === 'running') return failed(to);
  return from === 'failed_owned' && to === 'failed_clear';
}
function observeRestartOwner(attachment, observationJson, nowMs) {
  const s = attachmentState(attachment), v = canonical(observationJson, observationKeys);
  if (!integer(v.generation) || !(v.attemptId === null || hex(v.attemptId,32)) ||
      typeof v.phase !== 'string' || !phases.has(v.phase) || !(v.operationId === null || hex(v.operationId,32)) ||
      ((v.phase === 'running' || v.phase === 'failed_owned') && v.attemptId === null)) fail('INVALID_INPUT');
  const now = time(nowMs), q = s.queue;
  clock(q,now);
  // Admission observations may be replayed after they have settled a dispatch.
  if (observationJson === s.observationJson) { q.time = now; return statusCopy(s); }
  const old = s.observed, receipt = s.receipt;
  const next = old !== null && v.generation !== old.generation;
  let previousAttemptId = s.previousAttemptId;
  if (v.generation === 0 && (v.attemptId !== null || v.operationId !== null ||
      (v.phase !== 'removing' && v.phase !== 'removed'))) fail('OWNER_CONFLICT');
  if (old !== null) {
    if (next) {
      // Check before adding one; ordinals never wrap or jump.
      if (old.generation === 0 || old.generation === MAX || v.generation !== old.generation + 1 ||
          old.phase !== 'failed_clear' || v.phase === 'removing' || v.phase === 'removed') fail('OWNER_CONFLICT');
      previousAttemptId = old.attemptId;
    } else {
      if (!legalPhase(old.phase,v.phase) || ((old.attemptId !== null || old.phase === 'removed') &&
          v.attemptId !== old.attemptId)) fail('OWNER_CONFLICT');
    }
  }
  if (v.attemptId !== null && v.attemptId === previousAttemptId) fail('OWNER_CONFLICT');
  const dispatched = receipt !== null && receipt.status === 'dispatched';
  if (v.operationId !== null && (!dispatched || !next || v.operationId !== receipt.operationId)) fail('OWNER_CONFLICT');
  if (dispatched && next && v.operationId !== receipt.operationId) fail('OWNER_CONFLICT');

  let updated = receipt;
  if (dispatched && next) updated = withStatus(receipt, failed(v.phase) ? 'start_failed' : 'started');
  else if (receipt !== null && receipt.status === 'accepted' && next) updated = withStatus(receipt,'superseded');
  else if (receipt !== null && receipt.status === 'started' && v.generation === receipt.targetGeneration && failed(v.phase))
    updated = withStatus(receipt,'start_failed');
  if (receipt !== null && ((receipt.status === 'accepted' && (v.phase === 'removing' || v.phase === 'removed')) ||
      (receipt.status === 'dispatched' && v.phase === 'removed'))) updated = withStatus(receipt,'removed');
  // All rejection paths precede this publication. No caller code can run here.
  s.observed = v; s.observationJson = observationJson; s.previousAttemptId = previousAttemptId;
  s.receipt = updated; q.time = now;
  return statusCopy(s);
}
function requestRestart(attachment, commandJson, nowMs) {
  const s = attachmentState(attachment), v = canonical(commandJson,commandKeys);
  if (v.version !== 1 || !hex(v.supervisorEpoch,32) || !hex(v.attachmentId,32) ||
      !integer(v.generation) || !integer(v.commandSequence,1) || !hex(v.operationId,32)) fail('INVALID_INPUT');
  const now = time(nowMs), q = s.queue;
  clock(q,now);
  if (v.supervisorEpoch !== q.supervisorEpoch) fail('WRONG_EPOCH');
  if (v.attachmentId !== s.identity.attachmentId) fail('WRONG_ATTACHMENT');
  // Transport replay is resolved before any current-generation or close checks.
  if (commandJson === s.commandJson) { q.time = now; return receiptCopy(s.receipt); }
  if (v.commandSequence === s.lastSequence || (s.receipt !== null && v.operationId === s.receipt.operationId)) fail('COMMAND_CONFLICT');
  if (v.commandSequence < s.lastSequence) fail('STALE_COMMAND');
  if (s.lastSequence === MAX) fail('IDENTITY_EXHAUSTED');
  if (v.commandSequence !== s.lastSequence + 1) fail('COMMAND_GAP');
  if (q.closed) fail('QUEUE_CLOSED');
  if (outstanding(s.receipt)) fail('RESTART_BUSY');
  if (s.observed === null || !failed(s.observed.phase)) fail('NOT_FAILED');
  if (v.generation !== s.observed.generation) fail('STALE_GENERATION');
  if (v.generation === MAX) fail('IDENTITY_EXHAUSTED');
  const receipt = {operationId:v.operationId, commandSequence:v.commandSequence,
    generation:v.generation, targetGeneration:v.generation + 1, status:'accepted'};
  s.receipt = receipt; s.commandJson = commandJson; s.lastSequence = v.commandSequence; q.time = now;
  return receiptCopy(receipt);
}
function cancelRestart(attachment, operationId, commandSequence, nowMs) {
  const s = attachmentState(attachment);
  if (!hex(operationId,32) || !integer(commandSequence,1)) fail('INVALID_INPUT');
  const now = time(nowMs), q = s.queue;
  clock(q,now);
  const receipt = s.receipt;
  if (receipt === null || receipt.operationId !== operationId || receipt.commandSequence !== commandSequence) fail('STALE_COMMAND');
  if (receipt.status === 'dispatched' || receipt.status === 'started') fail('TOO_LATE');
  if (receipt.status === 'accepted') s.receipt = withStatus(receipt,'cancelled');
  q.time = now;
  return receiptCopy(s.receipt);
}
function takeRestart(attachment, nowMs) {
  const s = attachmentState(attachment), now = time(nowMs), q = s.queue;
  clock(q,now);
  const r = s.receipt;
  if (q.closed || r === null || r.status !== 'accepted' || s.observed === null || s.observed.phase !== 'failed_clear') {
    q.time = now; return null;
  }
  const effect = Object.freeze({identity:identityCopy(s.identity), supervisorEpoch:q.supervisorEpoch,
    operationId:r.operationId, commandSequence:r.commandSequence, previousGeneration:r.generation,
    targetGeneration:r.targetGeneration});
  s.receipt = withStatus(r,'dispatched'); q.time = now;
  return effect;
}
function closeRestartQueue(queue, nowMs) {
  const q = queueState(queue), now = time(nowMs);
  clock(q,now);
  for (const s of q.members.values()) {
    if (s.receipt !== null && s.receipt.status === 'accepted') s.receipt = withStatus(s.receipt,'closed');
  }
  q.closed = true; q.time = now;
  return Object.freeze({closed:true, retained:q.members.size});
}
function retireRestart(attachment, nowMs) {
  const s = attachmentState(attachment,true), now = time(nowMs), q = s.queue;
  clock(q,now);
  if (!s.retired && (s.observed === null || s.observed.phase !== 'removed')) fail('OWNER_NOT_REMOVED');
  if (!s.retired) {
    q.members.delete(s.identity.attachmentId); q.instances.delete(s.identity.instanceId); s.retired = true;
  }
  q.time = now;
  return Object.freeze({retired:true});
}

module.exports = {createRestartQueue, attachRestart, observeRestartOwner, requestRestart,
  cancelRestart, takeRestart, inspectRestart, closeRestartQueue, retireRestart};
