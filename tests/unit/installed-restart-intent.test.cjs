'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../../apps/installed-runtime/src/restart-intent.cjs');
const runtimeId = 'a'.repeat(64), supervisorEpoch = 'b'.repeat(32);
const id = n => n.toString(16).padStart(32, '0');
const op = 'e'.repeat(32), op2 = 'f'.repeat(32);
const code = expected => error => error.code === expected && error.message === expected;
function identity(n = 1) {
  return {version:1, runtimeId, releaseId:'c'.repeat(64), sourceHash:'d'.repeat(64),
    instanceId:id(n), hostPid:42, descriptorHash:null, attachmentId:id(n + 100)};
}
function fixture(phase = 'failed_clear', generation = 2, queue = api.createRestartQueue(runtimeId, supervisorEpoch), n = 1) {
  const value = identity(n), handle = api.attachRestart(queue, JSON.stringify(value));
  const observation = (g, p, operationId = null, attemptId = id(g)) =>
    JSON.stringify({generation:g, attemptId, phase:p, operationId});
  const observe = (g, p, operationId = null, now = 0, attemptId = id(g)) =>
    api.observeRestartOwner(handle, observation(g, p, operationId, attemptId), now);
  if (phase !== null) observe(generation, phase);
  const command = (commandSequence = 1, g = generation, operationId = op) =>
    JSON.stringify({version:1, supervisorEpoch, attachmentId:value.attachmentId,
      generation:g, commandSequence, operationId});
  return {queue, value, handle, observation, observe, command};
}
function rejected(f, action, expected, now = 2) {
  const before = api.inspectRestart(f.handle);
  assert.throws(action, code(expected));
  assert.deepEqual(api.inspectRestart(f.handle), before);
  // A rejected high time must not poison the queue's successful-mutation clock.
  api.takeRestart(f.handle, now);
}

test('failed ownership admits one intent but only confirmed clear dispatches it', () => {
  const f = fixture('failed_owned'), bytes = f.command();
  assert.equal(api.requestRestart(f.handle, bytes, 1).status, 'accepted');
  assert.equal(api.takeRestart(f.handle, 2), null);
  assert.equal(api.takeRestart(f.handle, 2), null);
  f.observe(2, 'failed_clear', null, 3);
  const effect = api.takeRestart(f.handle, 4);
  assert.deepEqual(effect, {identity:f.value, supervisorEpoch, operationId:op,
    commandSequence:1, previousGeneration:2, targetGeneration:3});
  assert.equal(api.takeRestart(f.handle, 4), null);
  f.observe(3, 'starting', op, 5);
  let replay;
  assert.doesNotThrow(() => { replay = api.requestRestart(f.handle, bytes, 6); });
  assert.equal(replay.status, 'started');
  assert.equal(api.inspectRestart(f.handle).observed.generation, 3);
});
test('cancel retains sequence and busy rejection cannot consume the next sequence', () => {
  const f = fixture();
  api.requestRestart(f.handle, f.command(), 1);
  const before = api.inspectRestart(f.handle);
  assert.throws(() => api.requestRestart(f.handle, f.command(2, 2, op2), 1000), code('RESTART_BUSY'));
  assert.deepEqual(api.inspectRestart(f.handle), before);
  assert.equal(api.cancelRestart(f.handle, op, 1, 2).status, 'cancelled');
  assert.equal(api.cancelRestart(f.handle, op, 1, 2).status, 'cancelled');
  assert.equal(api.takeRestart(f.handle, 3), null);
  assert.equal(api.requestRestart(f.handle, f.command(), 4).status, 'cancelled');
  assert.equal(api.requestRestart(f.handle, f.command(2, 2, op2), 5).status, 'accepted');
  assert.throws(() => api.requestRestart(f.handle, f.command(), 6), code('STALE_COMMAND'));
});
test('automatic replacement supersedes queued old-generation intent', () => {
  const f = fixture(), bytes = f.command();
  api.requestRestart(f.handle, bytes, 1);
  f.observe(3, 'starting', null, 2);
  assert.equal(api.requestRestart(f.handle, bytes, 3).status, 'superseded');
  assert.equal(api.takeRestart(f.handle, 4), null);
  assert.equal(api.cancelRestart(f.handle, op, 1, 5).status, 'superseded');
});
test('close retains dispatched work and capacity until owner removal, including late explicit start', () => {
  const f = fixture(), bytes = f.command();
  api.requestRestart(f.handle, bytes, 1);
  api.takeRestart(f.handle, 2);
  assert.deepEqual(api.closeRestartQueue(f.queue, 3), {closed:true, retained:1});
  assert.equal(api.inspectRestart(f.handle).receipt.status, 'dispatched');
  assert.equal(api.requestRestart(f.handle, bytes, 3).status, 'dispatched');
  rejected(f, () => api.retireRestart(f.handle, 1000), 'OWNER_NOT_REMOVED', 3);
  f.observe(3, 'starting', op, 4);
  assert.equal(api.inspectRestart(f.handle).receipt.status, 'started');
  f.observe(3, 'removing', null, 5);
  f.observe(3, 'removed', null, 6);
  assert.deepEqual(api.retireRestart(f.handle, 7), {retired:true});
  assert.deepEqual(api.retireRestart(f.handle, 7), {retired:true});
  assert.deepEqual(api.closeRestartQueue(f.queue, 8), {closed:true, retained:0});
});
test('rejected generation mutation cannot alter queued command or clock', () => {
  const f = fixture();
  api.requestRestart(f.handle, f.command(), 1);
  const before = api.inspectRestart(f.handle);
  assert.throws(() => f.observe(4, 'starting', null, 1000), code('OWNER_CONFLICT'));
  assert.deepEqual(api.inspectRestart(f.handle), before);
  assert.equal(api.takeRestart(f.handle, 2).targetGeneration, 3);
});
test('handles and returned snapshots cannot forge or alter authority', () => {
  const f = fixture();
  for (const h of [f.queue, f.handle]) {
    assert.equal(Object.getPrototypeOf(h), null);
    assert.deepEqual(Reflect.ownKeys(h), []);
    assert.ok(Object.isFrozen(h));
  }
  for (const h of [{}, f.queue, api.inspectRestart(f.handle), new Proxy({}, {get(){throw Error('trap');}})]) {
    assert.throws(() => api.inspectRestart(h), code('INVALID_HANDLE'));
    assert.throws(() => api.observeRestartOwner(h, '', 0), code('INVALID_HANDLE'));
    assert.throws(() => api.requestRestart(h, '', 0), code('INVALID_HANDLE'));
    assert.throws(() => api.cancelRestart(h, op, 1, 0), code('INVALID_HANDLE'));
    assert.throws(() => api.takeRestart(h, 0), code('INVALID_HANDLE'));
    assert.throws(() => api.retireRestart(h, 0), code('INVALID_HANDLE'));
  }
  for (const h of [{}, f.handle]) {
    assert.throws(() => api.attachRestart(h, ''), code('INVALID_HANDLE'));
    assert.throws(() => api.closeRestartQueue(h, 0), code('INVALID_HANDLE'));
  }
  const receipt = api.requestRestart(f.handle, f.command(), 1);
  const effect = api.takeRestart(f.handle, 1), status = api.inspectRestart(f.handle);
  for (const value of [receipt, effect, effect.identity, status, status.identity, status.observed, status.receipt]) {
    assert.ok(Object.isFrozen(value));
    assert.throws(() => {value.intruder = true;}, TypeError);
  }
  assert.notEqual(status.identity, effect.identity);
  assert.notEqual(api.inspectRestart(f.handle).receipt, status.receipt);
  assert.equal(api.inspectRestart(f.handle).receipt.status, 'dispatched');
});
test('runtime, epoch and fresh attachment identities are bound privately', () => {
  const f = fixture(), other = fixture('failed_clear', 2, f.queue, 2);
  rejected(other, () => api.requestRestart(other.handle, f.command(), 1000), 'WRONG_ATTACHMENT');
  const cmd = JSON.parse(f.command()); cmd.supervisorEpoch = id(99);
  rejected(f, () => api.requestRestart(f.handle, JSON.stringify(cmd), 1000), 'WRONG_EPOCH');
  const value = identity(3); value.runtimeId = '1'.repeat(64);
  assert.throws(() => api.attachRestart(f.queue, JSON.stringify(value)), code('INVALID_INPUT'));
  assert.throws(() => api.attachRestart(f.queue, JSON.stringify(f.value)), code('ATTACHMENT_EXISTS'));
  for (const field of ['instanceId', 'attachmentId']) {
    const duplicate = identity(3); duplicate[field] = f.value[field];
    assert.throws(() => api.attachRestart(f.queue, JSON.stringify(duplicate)), code('ATTACHMENT_EXISTS'));
  }
  f.observe(2, 'removed', null, 2); api.retireRestart(f.handle, 2);
  const fresh = {...f.value, attachmentId:id(999)};
  const h = api.attachRestart(f.queue, JSON.stringify(fresh));
  assert.throws(() => api.requestRestart(h, f.command(), 1000), code('WRONG_ATTACHMENT'));
  for (const action of [() => api.observeRestartOwner(f.handle, {}, {}), () => api.requestRestart(f.handle, {}, {}),
    () => api.cancelRestart(f.handle, {}, {}, {}), () => api.takeRestart(f.handle, {})])
    assert.throws(action, code('ATTACHMENT_RETIRED'));
  assert.equal(api.inspectRestart(f.handle).retired, true);
});
test('hostile primitive arguments never trigger caller coercion or reflection', () => {
  let touches = 0;
  const hostile = new Proxy({}, {get(){touches++; throw Error('get');}, ownKeys(){touches++; throw Error('keys');}, getPrototypeOf(){touches++; throw Error('prototype');}});
  for (const value of [hostile, new String(runtimeId), null, undefined, 1n, Symbol('x')]) {
    assert.throws(() => api.createRestartQueue(value, supervisorEpoch), code('INVALID_INPUT'));
    assert.throws(() => api.createRestartQueue(runtimeId, value), code('INVALID_INPUT'));
    const f = fixture();
    assert.throws(() => api.attachRestart(f.queue, value), code('INVALID_INPUT'));
    rejected(f, () => api.observeRestartOwner(f.handle, value, 1000), 'INVALID_INPUT');
    rejected(f, () => api.requestRestart(f.handle, value, 1000), 'INVALID_INPUT');
    rejected(f, () => api.cancelRestart(f.handle, value, 1, 1000), 'INVALID_INPUT');
    rejected(f, () => api.cancelRestart(f.handle, op, value, 1000), 'INVALID_INPUT');
    rejected(f, () => api.takeRestart(f.handle, value), 'INVALID_CLOCK');
  }
  assert.equal(touches, 0);
});
test('canonical JSON rejects duplicate, reordered, extra, whitespace and oversize inputs atomically', () => {
  const f = fixture();
  const bytes = f.command();
  const malformed = ['null', '[]', '{}', '1', '"text"', '{', ' '+bytes,
    bytes.replace('"version":1', '"version":1,"version":1'),
    bytes.replace('"version":1', '"version":1,"extra":0'),
    JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(bytes)).reverse())),
    bytes.replace('"version"', '"\\u0076ersion"'), ' '.repeat(1025), 'é'.repeat(600)];
  assert.ok(malformed.at(-1).length < 1024 && Buffer.byteLength(malformed.at(-1)) > 1024);
  for (const text of malformed) rejected(f, () => api.requestRestart(f.handle, text, 1000), 'INVALID_INPUT');
  for (const text of ['[]', 'null', JSON.stringify({...f.value, extra:1}), JSON.stringify(f.value)+' '])
    assert.throws(() => api.attachRestart(f.queue, text), code('INVALID_INPUT'));
  for (const text of ['[]', 'null', f.observation(2, 'failed_clear').replace('"generation":2', '"generation":2,"generation":2')])
    rejected(f, () => api.observeRestartOwner(f.handle, text, 1000), 'INVALID_INPUT');
});

test('numeric and identity fields reject invalid primitive domains', () => {
  for (const bad of [-1, -0.5, 1.5, Number.MAX_SAFE_INTEGER+1, null, '2', {}, []]) {
    const f = fixture();
    const obs = JSON.parse(f.observation(2, 'failed_clear')); obs.generation = bad;
    rejected(f, () => api.observeRestartOwner(f.handle, JSON.stringify(obs), 1000), 'INVALID_INPUT');
    for (const key of ['generation', 'commandSequence']) {
      const cmd = JSON.parse(f.command()); cmd[key] = bad;
      rejected(f, () => api.requestRestart(f.handle, JSON.stringify(cmd), 1000), 'INVALID_INPUT');
    }
    const value = identity(); value.hostPid = bad;
    assert.throws(() => api.attachRestart(api.createRestartQueue(runtimeId, supervisorEpoch), JSON.stringify(value)), code('INVALID_INPUT'));
  }
  const f = fixture();
  for (const text of [f.command().replace('"commandSequence":1','"commandSequence":0'),
    f.command().replace('"generation":2','"generation":-0'),
    f.command().replace('"commandSequence":1','"commandSequence":-0'),
    f.command().replace('"generation":2','"generation":1e400')])
    rejected(f, () => api.requestRestart(f.handle, text, 1000), 'INVALID_INPUT');
  for (const bad of ['', 'A'.repeat(32), '1'.repeat(31), {}, 42]) {
    const cmd = JSON.parse(f.command()); cmd.operationId = bad;
    rejected(f, () => api.requestRestart(f.handle, JSON.stringify(cmd), 1000), 'INVALID_INPUT');
  }
  for (const field of ['runtimeId','releaseId','sourceHash','instanceId','attachmentId','descriptorHash','version','hostPid']) {
    const value = identity(); value[field] = {};
    assert.throws(() => api.attachRestart(f.queue, JSON.stringify(value)), code('INVALID_INPUT'));
  }
  const q = api.createRestartQueue(runtimeId, supervisorEpoch), value = identity();
  value.descriptorHash = 'f'.repeat(64);
  assert.deepEqual(api.inspectRestart(api.attachRestart(q, JSON.stringify(value))).identity, value);
});
test('successful no-ops advance the shared clock; rejected calls and inspect do not', () => {
  const f = fixture(), sibling = fixture('failed_clear', 2, f.queue, 2);
  assert.equal(api.takeRestart(f.handle, -0), null);
  for (const now of [NaN, Infinity, -Infinity, -1, '1', null])
    rejected(f, () => api.takeRestart(f.handle, now), 'INVALID_CLOCK', 0);
  api.takeRestart(f.handle, 10);
  assert.throws(() => sibling.observe(2, 'failed_clear', null, 9), code('INVALID_CLOCK'));
  sibling.observe(2, 'failed_clear', null, 10);
  api.requestRestart(f.handle, f.command(), 10);
  api.requestRestart(f.handle, f.command(), 11);
  assert.throws(() => api.takeRestart(sibling.handle, 10), code('INVALID_CLOCK'));
  api.cancelRestart(f.handle, op, 1, 11);
  api.cancelRestart(f.handle, op, 1, 12);
  assert.throws(() => api.closeRestartQueue(f.queue, 11), code('INVALID_CLOCK'));
  api.closeRestartQueue(f.queue, 12);
  api.closeRestartQueue(f.queue, 13);
  assert.throws(() => f.observe(2, 'removed', null, 12), code('INVALID_CLOCK'));
  f.observe(2, 'removed', null, 13); api.retireRestart(f.handle, 14); api.retireRestart(f.handle, 15);
  assert.throws(() => api.takeRestart(sibling.handle, 14), code('INVALID_CLOCK'));
});
test('unobserved and nonfailed phases reject new restart', () => {
  for (const phase of [null, 'starting', 'running', 'removing', 'removed']) {
    const f = fixture(phase);
    rejected(f, () => api.requestRestart(f.handle, f.command(), 1000), 'NOT_FAILED');
  }
  const f = fixture();
  api.requestRestart(f.handle, f.command(), 1); f.observe(2, 'removing', null, 2);
  assert.equal(api.inspectRestart(f.handle).receipt.status, 'removed');
  assert.equal(api.takeRestart(f.handle, 3), null);
  assert.equal(api.cancelRestart(f.handle, op, 1, 3).status, 'removed');
});
test('command conflict, gap, stale and transition error precedence retain state', () => {
  const f = fixture('failed_owned');
  rejected(f, () => api.requestRestart(f.handle, f.command(2), 1000), 'COMMAND_GAP');
  rejected(f, () => api.requestRestart(f.handle, f.command(1, 1), 1000), 'STALE_GENERATION');
  api.requestRestart(f.handle, f.command(), 2);
  rejected(f, () => api.requestRestart(f.handle, f.command(1, 2, op2), 1000), 'COMMAND_CONFLICT');
  rejected(f, () => api.requestRestart(f.handle, f.command(2, 2, op), 1000), 'COMMAND_CONFLICT');
  rejected(f, () => api.requestRestart(f.handle, f.command(3, 2, op2), 1000), 'COMMAND_GAP');
  rejected(f, () => api.requestRestart(f.handle, f.command(2, 1, op2), 1000), 'RESTART_BUSY');
  api.closeRestartQueue(f.queue, 2);
  assert.equal(api.requestRestart(f.handle, f.command(), 2).status, 'closed');
  rejected(f, () => api.requestRestart(f.handle, f.command(2, 1, op2), 1000), 'QUEUE_CLOSED');
  assert.equal(api.cancelRestart(f.handle, op, 1, 2).status, 'closed');
  const bad = JSON.parse(f.command()); bad.supervisorEpoch=id(999); bad.attachmentId=id(998);
  rejected(f, () => api.requestRestart(f.handle, JSON.stringify(bad), 1000), 'WRONG_EPOCH');
});
test('owner phase and ordinal table permits only monotonic legal transitions', () => {
  const transitions = {
    starting:['running','failed_owned','failed_clear','removing','removed'],
    running:['failed_owned','failed_clear','removing','removed'],
    failed_owned:['failed_clear','removing','removed'],
    failed_clear:['removing','removed'], removing:['removed'], removed:[]
  };
  for (const [from, allowed] of Object.entries(transitions)) {
    for (const to of Object.keys(transitions)) {
      const f = fixture(from);
      if (to === from || allowed.includes(to)) assert.equal(f.observe(2, to).observed.phase, to);
      else rejected(f, () => f.observe(2, to, null, 1000), 'OWNER_CONFLICT');
    }
    for (const to of Object.keys(transitions)) {
      const f = fixture(from);
      if (from === 'failed_clear' && ['starting','running','failed_owned','failed_clear'].includes(to))
        assert.equal(f.observe(3, to).observed.generation, 3);
      else rejected(f, () => f.observe(3, to, null, 1000), 'OWNER_CONFLICT');
    }
  }
  for (const generation of [1, 4]) {
    const f = fixture(); rejected(f, () => f.observe(generation, 'starting', null, 1000), 'OWNER_CONFLICT');
  }
});
test('attempt IDs are stable within an ordinal and fresh at the next ordinal', () => {
  const f = fixture(null);
  f.observe(2, 'starting', null, 0, null);
  f.observe(2, 'starting', null, 1, id(2));
  f.observe(2, 'running', null, 1);
  rejected(f, () => f.observe(2, 'running', null, 1000, id(8)), 'OWNER_CONFLICT');
  rejected(f, () => f.observe(2, 'failed_clear', null, 1000, null), 'OWNER_CONFLICT');
  f.observe(2, 'failed_clear', null, 2);
  rejected(f, () => f.observe(3, 'starting', null, 1000, id(2)), 'OWNER_CONFLICT');
  f.observe(3, 'starting', null, 2, null);
  rejected(f, () => f.observe(3, 'running', null, 1000, id(2)), 'OWNER_CONFLICT');
  f.observe(3, 'running', null, 2, id(3));
  for (const phase of ['running', 'failed_owned']) {
    const g = fixture(null);
    rejected(g, () => g.observe(2, phase, null, 1000, null), 'INVALID_INPUT');
  }
});
test('explicit observation replay precedes operation checks and later fault refines started', () => {
  for (const phase of ['starting','running','failed_owned','failed_clear']) {
    const f = fixture(), bytes = f.command();
    api.requestRestart(f.handle, bytes, 1); api.takeRestart(f.handle, 2);
    for (const bad of [null, op2]) {
      const before = api.inspectRestart(f.handle);
      assert.throws(() => f.observe(3, phase, bad, 1000), code('OWNER_CONFLICT'));
      assert.deepEqual(api.inspectRestart(f.handle), before);
      assert.equal(api.takeRestart(f.handle, 2), null);
    }
    f.observe(3, phase, op, 3);
    const want = phase.startsWith('failed') ? 'start_failed' : 'started';
    assert.equal(api.requestRestart(f.handle, bytes, 4).status, want);
    assert.equal(f.observe(3, phase, op, 5).receipt.status, want);
    assert.equal(f.observe(3, phase, null, 6).receipt.status, want);
    rejected(f, () => f.observe(3, phase, op, 1000), 'OWNER_CONFLICT', 6);
    if (want === 'started') {
      assert.throws(() => api.cancelRestart(f.handle, op, 1, 1000), code('TOO_LATE'));
      f.observe(3, 'failed_clear', null, 7);
      assert.equal(api.requestRestart(f.handle, bytes, 8).status, 'start_failed');
    }
  }
});
test('new receipt evicts the old command and same-ordinal updates cannot refine the new receipt', () => {
  const f = fixture();
  api.requestRestart(f.handle, f.command(), 1); api.takeRestart(f.handle, 1);
  f.observe(3, 'failed_owned', op, 2);
  assert.equal(api.cancelRestart(f.handle, op, 1, 3).status, 'start_failed');
  const next = f.command(2, 3, op2);
  api.requestRestart(f.handle, next, 4); f.observe(3, 'failed_clear', null, 5);
  assert.equal(api.inspectRestart(f.handle).receipt.status, 'accepted');
  assert.equal(api.inspectRestart(f.handle).receipt.generation, 3);
  assert.throws(() => api.requestRestart(f.handle, f.command(), 1000), code('STALE_COMMAND'));
  assert.throws(() => api.cancelRestart(f.handle, op, 1, 1000), code('STALE_COMMAND'));
  assert.equal(api.takeRestart(f.handle, 6).targetGeneration, 4);
});
test('dispatched cancellation is too late and same-generation removal alone settles issued work', () => {
  const f = fixture();
  api.requestRestart(f.handle, f.command(), 1); api.takeRestart(f.handle, 1);
  rejected(f, () => api.cancelRestart(f.handle, op, 1, 1000), 'TOO_LATE');
  rejected(f, () => api.cancelRestart(f.handle, op2, 1, 1000), 'STALE_COMMAND');
  f.observe(2, 'removing', null, 2);
  assert.equal(api.inspectRestart(f.handle).receipt.status, 'dispatched');
  rejected(f, () => api.retireRestart(f.handle, 1000), 'OWNER_NOT_REMOVED');
  f.observe(2, 'removed', null, 3);
  assert.equal(api.inspectRestart(f.handle).receipt.status, 'removed');
  api.retireRestart(f.handle, 4);
});
test('sixteen unretired attachments retain capacity across dispatch, cancel and close', () => {
  const queue = api.createRestartQueue(runtimeId, supervisorEpoch);
  const fixtures = Array.from({length:16}, (_,i) => fixture('failed_clear', 2, queue, i+1));
  for (const f of fixtures) api.requestRestart(f.handle, f.command(), 0);
  const siblingBefore = api.inspectRestart(fixtures[1].handle);
  api.takeRestart(fixtures[0].handle, 0);
  api.cancelRestart(fixtures[2].handle, op, 1, 0);
  assert.deepEqual(api.inspectRestart(fixtures[1].handle), siblingBefore);
  assert.throws(() => fixture(null, 2, queue, 17), code('CAPACITY'));
  fixtures[2].observe(2, 'removing');
  assert.throws(() => api.retireRestart(fixtures[2].handle, 0), code('OWNER_NOT_REMOVED'));
  fixtures[2].observe(2, 'removed'); api.retireRestart(fixtures[2].handle, 0);
  fixture('starting', 2, queue, 17);
  assert.throws(() => fixture(null, 2, queue, 18), code('CAPACITY'));
  assert.deepEqual(api.closeRestartQueue(queue, 1), {closed:true, retained:16});
  assert.equal(api.inspectRestart(fixtures[0].handle).receipt.status, 'dispatched');
  assert.equal(api.inspectRestart(fixtures[1].handle).receipt.status, 'closed');
  assert.equal(api.takeRestart(fixtures[1].handle, 1), null);
  assert.throws(() => fixture(null, 2, queue, 18), code('QUEUE_CLOSED'));
});
test('close before first observation permits only zero-ordinal teardown and retirement', () => {
  for (const initial of ['removing', 'removed']) {
    const f = fixture(null);
    api.closeRestartQueue(f.queue, 1);
    assert.equal(f.observe(0, initial, null, 2, null).observed.generation, 0);
    if (initial === 'removing') f.observe(0, 'removed', null, 3, null);
    assert.equal(api.retireRestart(f.handle, 4).retired, true);
  }
  for (const phase of ['starting','running','failed_owned','failed_clear']) {
    const f = fixture(null);
    assert.throws(() => f.observe(0, phase, null, 1000, null),
      code(phase === 'running' || phase === 'failed_owned' ? 'INVALID_INPUT' : 'OWNER_CONFLICT'));
    assert.equal(api.inspectRestart(f.handle).observed, null);
    assert.equal(api.takeRestart(f.handle, 1), null);
  }
  const f = fixture(null);
  rejected(f, () => f.observe(0, 'removed', null, 1000, id(0)), 'OWNER_CONFLICT');
  f.observe(0, 'removing', null, 2, null);
  rejected(f, () => f.observe(1, 'starting', null, 1000), 'OWNER_CONFLICT');
});
test('reachable maximum generation rejects admission without overflow or clock change', () => {
  const f = fixture('failed_clear', Number.MAX_SAFE_INTEGER);
  rejected(f, () => api.requestRestart(f.handle, f.command(), 1000), 'IDENTITY_EXHAUSTED');
  assert.equal(api.inspectRestart(f.handle).lastSequence, 0);
  assert.equal(api.inspectRestart(f.handle).receipt, null);
});
test('one thousand sequential cancelled commands expose only the last receipt and consumed sequence', () => {
  const f = fixture();
  for (let n=1; n<=1000; n++) {
    const bytes = f.command(n, 2, id(n));
    assert.equal(api.requestRestart(f.handle, bytes, n).commandSequence, n);
    assert.equal(api.cancelRestart(f.handle, id(n), n, n).status, 'cancelled');
  }
  const status = api.inspectRestart(f.handle);
  assert.deepEqual(Object.keys(status), ['identity','supervisorEpoch','observed','lastSequence','receipt','closed','retired']);
  assert.equal(status.lastSequence, 1000);
  assert.deepEqual(status.receipt, {operationId:id(1000), commandSequence:1000,
    generation:2, targetGeneration:3, status:'cancelled'});
  assert.throws(() => api.requestRestart(f.handle, f.command(999, 2, id(999)), 10000), code('STALE_COMMAND'));
  assert.deepEqual(api.inspectRestart(f.handle), status);
  assert.deepEqual(api.closeRestartQueue(f.queue, 1001), {closed:true, retained:1});
});

test('owner operation IDs reject without a dispatch or without its next ordinal', () => {
  const f = fixture(null);
  rejected(f, () => f.observe(2, 'starting', op, 1000), 'OWNER_CONFLICT');
  f.observe(2, 'failed_clear', null, 2);
  rejected(f, () => f.observe(2, 'failed_clear', op, 1000), 'OWNER_CONFLICT');
  api.requestRestart(f.handle, f.command(), 2); api.takeRestart(f.handle, 2);
  rejected(f, () => f.observe(2, 'failed_clear', op, 1000), 'OWNER_CONFLICT');
  assert.equal(api.inspectRestart(f.handle).receipt.status, 'dispatched');
});
test('all primitive arguments validate before closed or transition-state rejections', () => {
  const f = fixture(); api.closeRestartQueue(f.queue, 1);
  rejected(f, () => api.requestRestart(f.handle, '{}', 1000), 'INVALID_INPUT');
  rejected(f, () => api.requestRestart(f.handle, f.command(), NaN), 'INVALID_CLOCK');
  assert.throws(() => api.attachRestart(f.queue, '{}'), code('INVALID_INPUT'));
  rejected(f, () => api.cancelRestart(f.handle, op, -0, 1000), 'INVALID_INPUT');
  rejected(f, () => api.closeRestartQueue(f.queue, {}), 'INVALID_CLOCK');
  rejected(f, () => api.retireRestart(f.handle, {}), 'INVALID_CLOCK');
  assert.equal(api.inspectRestart(f.handle).closed, true);
});
test('exact observations and terminal cancellation return fresh frozen copies', () => {
  const f = fixture();
  const first = f.observe(2, 'failed_clear', null, 1);
  const next = f.observe(2, 'failed_clear', null, 2);
  assert.notEqual(first, next); assert.notEqual(first.observed, next.observed);
  assert.deepEqual(first, next);
  assert.throws(() => api.takeRestart(f.handle, 1), code('INVALID_CLOCK'));
  api.requestRestart(f.handle, f.command(), 2);
  const cancelled = api.cancelRestart(f.handle, op, 1, 2);
  const replay = api.cancelRestart(f.handle, op, 1, 3);
  assert.notEqual(cancelled, replay); assert.deepEqual(cancelled, replay);
  assert.ok(Object.isFrozen(replay));
});

test('removed observation is terminal even when its attempt ID was never known', () => {
  const f = fixture(null);
  f.observe(2, 'removed', null, 1, null);
  rejected(f, () => f.observe(2, 'removed', null, 1000, id(2)), 'OWNER_CONFLICT');
  assert.equal(api.retireRestart(f.handle, 2).retired, true);
});
