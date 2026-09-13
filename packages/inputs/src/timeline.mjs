// Internal live-input policy. All clocks, authority, and candidate commits belong
// to the caller. This module neither executes events nor evaluates mappings.
export const inputTimelineLimits = Object.freeze({ sources: 64, signals: 256, batch: 256, queuedEvents: 256, consumedPerStep: 32, liveLatenessMs: 100, freshnessMs: 500, payloadValues: 16, inputBytes: 262144, stateBytes: 1048576, resultBytes: 2097152, maxStepDeltaMs: 60000 });
const rejectionReasons = ['epoch', 'unknown-source', 'unknown-signal', 'kind', 'generation', 'disconnected', 'calibration', 'sequence', 'timestamp', 'future', 'late', 'overflow'];
const discardReasons = ['late', 'source-reset', 'reset'];
const counterFields = ['received', 'acceptedContinuous', 'acceptedEvents', 'rejected', 'consumedEvents', 'discarded', 'coalescedContinuous', 'expiredContinuous', 'clearedContinuous'];
const encoder = new TextEncoder();
const MAX = Number.MAX_SAFE_INTEGER;

function invalid(path, message) {
  const bounded = path.slice(0, 200);
  throw Object.assign(new Error(`${bounded}: ${message}`), { code: 'INVALID_INPUT_TIMELINE', path: bounded });
}

// Bound descriptor shape and JSON-equivalent bytes before copying descendants.
// No proxy-trap immunity or protection from modified intrinsics is promised.
function data(input, root, limit = inputTimelineLimits.inputBytes) {
  let bytes = 0;
  const ancestors = new Set();
  function charge(count, path) {
    bytes += count;
    if (bytes > limit) invalid(path, 'data exceeds UTF-8 byte budget');
  }
  function copy(value, path, depth) {
    if (depth > 8) invalid(path, 'data exceeds depth limit');
    if (value === null) { charge(4, path); return null; }
    if (typeof value === 'string') {
      if (value.length > inputTimelineLimits.inputBytes) invalid(path, 'string exceeds character budget');
      charge(encoder.encode(JSON.stringify(value)).byteLength, path); return value;
    }
    if (typeof value === 'number') { const result = finite(value, path); charge(JSON.stringify(result).length, path); return result; }
    if (typeof value === 'boolean') { charge(value ? 4 : 5, path); return value; }
    if (!value || typeof value !== 'object' || ancestors.has(value)) invalid(path, 'expected acyclic plain data');
    const isArray = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) invalid(path, 'unexpected prototype');
    const keys = Reflect.ownKeys(value);
    if (isArray) {
      const length = Object.getOwnPropertyDescriptor(value, 'length').value;
      if (length > 256 || keys.length !== length + 1) invalid(path, 'expected bounded dense array');
      const descriptors = [];
      for (let i = 0; i < length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
        if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) invalid(path, 'expected own data elements');
        descriptors.push(descriptor);
      }
      charge(2 + Math.max(0, length - 1), path); ancestors.add(value);
      const result = descriptors.map((descriptor, i) => copy(descriptor.value, `${path}[${i}]`, depth + 1));
      ancestors.delete(value); return result;
    }
    const fieldLimit = path.endsWith('.counters.rejected') ? rejectionReasons.length : 16;
    if (keys.length > fieldLimit) invalid(path, 'too many record fields');
    const descriptors = keys.map(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== 'string' || key.length > 64 || !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) invalid(path, 'expected enumerable own data properties');
      return descriptor;
    });
    charge(2 + Math.max(0, keys.length - 1), path); ancestors.add(value);
    const result = {};
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]; charge(encoder.encode(JSON.stringify(key)).byteLength + 1, path);
      Object.defineProperty(result, key, { value: copy(descriptors[i].value, `${path}.${key}`, depth + 1), writable: true, enumerable: true, configurable: true });
    }
    ancestors.delete(value); return result;
  }
  return copy(input, root, 0);
}

function fields(value, expected, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path, 'expected record');
  if (Object.keys(value).length !== expected.length || expected.some(key => !Object.hasOwn(value, key))) invalid(path, 'expected exact fields');
  return value;
}
function array(value, limit, path) { if (!Array.isArray(value) || value.length > limit) invalid(path, 'array exceeds declared limit'); return value; }
function finite(value, path) { if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path, 'expected finite number'); return Object.is(value, -0) ? 0 : value; }
function time(value, path) { const result = finite(value, path); if (result < 0 || result > MAX) invalid(path, 'milliseconds outside bounds'); return result; }
function counter(value, path) { const result = time(value, path); if (!Number.isSafeInteger(result)) invalid(path, 'expected safe integer'); return result; }
function choice(value, allowed, path) { if (!allowed.includes(value)) invalid(path, 'unsupported value'); return value; }
function id(value, path) { if (typeof value !== 'string' || !/^[a-z][A-Za-z0-9_]{0,63}$/.test(value) || ['constructor', 'prototype', '__proto__'].includes(value)) invalid(path, 'invalid ID'); return value; }
function uuid(value, path) { if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) invalid(path, 'expected canonical RFC UUID'); return value; }
function unique(set, key, path) { if (set.has(key)) invalid(path, 'duplicate identity'); set.add(key); }
function add(a, b, path) { if (a > MAX - b) invalid(path, 'safe counter exhausted'); return a + b; }
function increment(object, key, amount = 1) { object[key] = add(object[key], amount, `counters.${key}`); }
function sum(values, path) { return values.reduce((total, value) => add(total, value, path), 0); }
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function result(value) { return freeze(data(value, 'result', inputTimelineLimits.resultBytes)); }
const tuple = source => JSON.stringify([source.sourceId, source.signalId]);

function source(value, path) { fields(value, ['sourceId', 'signalId'], path); id(value.sourceId, path); id(value.signalId, path); return value; }
function authority(value, path) {
  fields(value, ['sourceId', 'generation', 'connected', 'calibrationId'], path);
  id(value.sourceId, path); counter(value.generation, path); choice(value.connected, [true, false], path); id(value.calibrationId, path);
  return value;
}
function authorities(value, path) {
  const ids = new Set();
  return array(value, 64, path).map((row, i) => { const at = `${path}[${i}]`; authority(row, at); unique(ids, row.sourceId, at); return row; });
}
function declarations(value, sources, path) {
  const ids = new Set(sources.map(row => row.sourceId)), tuples = new Set();
  return array(value, 256, path).map((row, i) => {
    const at = `${path}[${i}]`; fields(row, ['source', 'kind'], at); source(row.source, at); choice(row.kind, ['continuous', 'event'], at);
    if (!ids.has(row.source.sourceId)) invalid(at, 'undeclared source'); unique(tuples, tuple(row.source), at); return row;
  });
}
function definition(input) {
  const raw = fields(data(input, 'definition'), ['version', 'sources', 'signals'], 'definition');
  choice(raw.version, [1], 'definition.version'); authorities(raw.sources, 'definition.sources'); declarations(raw.signals, raw.sources, 'definition.signals'); return raw;
}
function envelope(value, path) {
  const common = ['version', 'epoch', 'source', 'generation', 'calibrationId', 'sequence', 'timestampMs', 'kind'];
  if (!value || typeof value !== 'object') invalid(path, 'expected envelope');
  choice(value.kind, ['continuous', 'event'], path);
  fields(value, [...common, value.kind === 'event' ? 'payload' : 'value'], path);
  choice(value.version, [1], path); counter(value.epoch, path); source(value.source, path); counter(value.generation, path);
  id(value.calibrationId, path); counter(value.sequence, path); time(value.timestampMs, path);
  if (value.kind === 'continuous') finite(value.value, path);
  else { fields(value.payload, ['type', 'values'], `${path}.payload`); id(value.payload.type, path); array(value.payload.values, 16, `${path}.payload.values`).forEach(item => finite(item, path)); }
  return value;
}
function counters(value) {
  fields(value, counterFields, 'state.counters');
  fields(value.rejected, rejectionReasons, 'state.counters.rejected'); fields(value.discarded, discardReasons, 'state.counters.discarded');
  for (const key of counterFields) {
    if (key === 'rejected' || key === 'discarded') Object.values(value[key]).forEach(item => counter(item, `state.counters.${key}`));
    else counter(value[key], `state.counters.${key}`);
  }
}

// Returns mutable private candidate data; public normalizer freezes a detached copy.
function state(input) {
  const raw = fields(data(input, 'state', inputTimelineLimits.stateBytes), ['version', 'epoch', 'startMs', 'lastStepMs', 'stepped', 'ingressNowMs', 'nextIngress', 'sources', 'signals', 'continuous', 'events', 'counters'], 'state');
  choice(raw.version, [1], 'state.version'); counter(raw.epoch, 'state.epoch'); counter(raw.nextIngress, 'state.nextIngress');
  for (const key of ['startMs', 'lastStepMs', 'ingressNowMs']) time(raw[key], `state.${key}`);
  choice(raw.stepped, [true, false], 'state.stepped');
  if (raw.lastStepMs < raw.startMs || raw.ingressNowMs < raw.startMs || (!raw.stepped && raw.lastStepMs !== raw.startMs)) invalid('state', 'contradictory time cursors');
  const cursors = array(raw.sources, 64, 'state.sources');
  for (const row of cursors) {
    fields(row, ['authority', 'sequence', 'timestampMs'], 'state.sources'); authority(row.authority, 'state.sources.authority');
    if ((row.sequence === null) !== (row.timestampMs === null)) invalid('state.sources', 'cursor nulls must be paired');
    if (row.sequence !== null) {
      counter(row.sequence, 'state.sources.sequence'); time(row.timestampMs, 'state.sources.timestampMs');
      if (row.timestampMs < raw.startMs || row.timestampMs > raw.ingressNowMs) invalid('state.sources', 'cursor timestamp outside ingress domain');
    }
  }
  authorities(cursors.map(row => row.authority), 'state.sources');
  declarations(raw.signals, cursors.map(row => row.authority), 'state.signals');
  const bySource = new Map(cursors.map(row => [row.authority.sourceId, row]));
  const declared = new Map(raw.signals.map((row, index) => [tuple(row.source), { ...row, index }]));
  const ingress = new Set(); let continuousIndex = -1, eventIngress = -1;
  for (const kind of ['continuous', 'event']) {
    const key = kind === 'event' ? 'events' : 'continuous';
    for (const [i, row] of array(raw[key], 256, `state.${key}`).entries()) {
      const path = `state.${key}[${i}]`;
      fields(row, ['envelope', 'ingress', 'receivedAtMs'], path); envelope(row.envelope, `${path}.envelope`); counter(row.ingress, path); time(row.receivedAtMs, path);
      const e = row.envelope, cursor = bySource.get(e.source.sourceId), declaration = declared.get(tuple(e.source));
      if (!cursor || !declaration || declaration.kind !== kind || e.kind !== kind || e.epoch !== raw.epoch || e.generation !== cursor.authority.generation || e.calibrationId !== cursor.authority.calibrationId || !cursor.authority.connected) invalid(path, 'retained input disagrees with current authority');
      if (e.timestampMs < raw.startMs || row.receivedAtMs < e.timestampMs || row.receivedAtMs > raw.ingressNowMs || cursor.sequence === null || cursor.sequence < e.sequence || cursor.timestampMs < e.timestampMs) invalid(path, 'retained input disagrees with time/source cursor');
      if (row.ingress >= raw.nextIngress) invalid(path, 'ingress outside accepted range'); unique(ingress, row.ingress, path);
      if (kind === 'event') { if (row.ingress <= eventIngress) invalid(path, 'event ingress must increase'); eventIngress = row.ingress; }
      else { if (declaration.index <= continuousIndex) invalid(path, 'held tuples must follow declaration order'); continuousIndex = declaration.index; }
    }
  }
  const retained = [...raw.continuous, ...raw.events].sort((a, b) => a.ingress - b.ingress), previous = new Map();
  let receivedAtMs = -1;
  for (const row of retained) {
    const e = row.envelope, prior = previous.get(e.source.sourceId);
    if (row.receivedAtMs < receivedAtMs || (prior && (e.sequence <= prior.sequence || e.timestampMs < prior.timestampMs))) invalid('state', 'retained receipt/source ordering contradicts ingress');
    receivedAtMs = row.receivedAtMs; previous.set(e.source.sourceId, e);
  }
  counters(raw.counters); const c = raw.counters;
  if (c.received !== sum([c.acceptedContinuous, c.acceptedEvents, ...Object.values(c.rejected)], 'state.counters') ||
      c.acceptedEvents !== sum([c.consumedEvents, ...Object.values(c.discarded), raw.events.length], 'state.counters') ||
      c.acceptedContinuous !== sum([c.coalescedContinuous, c.expiredContinuous, c.clearedContinuous, raw.continuous.length], 'state.counters')) invalid('state.counters', 'counter identities disagree');
  return raw;
}

function empty(def, epoch, startMs, counts) {
  return { version: 1, epoch, startMs, lastStepMs: startMs, stepped: false, ingressNowMs: startMs, nextIngress: 0,
    sources: def.sources.map(authority => ({ authority, sequence: null, timestampMs: null })), signals: def.signals, continuous: [], events: [],
    counters: counts ?? { received: 0, acceptedContinuous: 0, acceptedEvents: 0, rejected: Object.fromEntries(rejectionReasons.map(key => [key, 0])), consumedEvents: 0, discarded: Object.fromEntries(discardReasons.map(key => [key, 0])), coalescedContinuous: 0, expiredContinuous: 0, clearedContinuous: 0 } };
}
export function createLiveInputState(input, epoch, startMs) { const def = definition(input); return result(empty(def, counter(epoch, 'epoch'), time(startMs, 'startMs'))); }
export function normalizeLiveInputState(input) { return result(state(input)); }

export function admitLiveInputs(input, nowMs, envelopes) {
  const next = state(input), now = time(nowMs, 'nowMs');
  const batch = array(data(envelopes, 'envelopes'), 256, 'envelopes').map((row, i) => envelope(row, `envelopes[${i}]`));
  if (now < next.ingressNowMs || now < next.startMs) invalid('nowMs', 'ingress clock moved backwards');
  const sources = new Map(next.sources.map(row => [row.authority.sourceId, row]));
  const declared = new Map(next.signals.map(row => [tuple(row.source), row]));
  const held = new Map(next.continuous.map(row => [tuple(row.envelope.source), row]));
  const decisions = [];
  for (const e of batch) {
    increment(next.counters, 'received');
    const cursor = sources.get(e.source.sourceId), signal = declared.get(tuple(e.source));
    let reason = e.epoch !== next.epoch ? 'epoch' : !cursor ? 'unknown-source' : !signal ? 'unknown-signal' : e.kind !== signal.kind ? 'kind' :
      e.generation !== cursor.authority.generation ? 'generation' : !cursor.authority.connected ? 'disconnected' : e.calibrationId !== cursor.authority.calibrationId ? 'calibration' :
      cursor.sequence !== null && e.sequence <= cursor.sequence ? 'sequence' : e.timestampMs < next.startMs || cursor.timestampMs !== null && e.timestampMs < cursor.timestampMs ? 'timestamp' : e.timestampMs > now ? 'future' : null;
    if (!reason) {
      // A late/overflow receipt still closes this source sequence. Identity,
      // ordering and future-clock rejections above leave the cursor untouched.
      cursor.sequence = e.sequence; cursor.timestampMs = e.timestampMs;
      if (e.kind === 'event') reason = now - e.timestampMs > 100 ? 'late' : next.events.length >= 256 ? 'overflow' : null;
    }
    if (reason) { increment(next.counters.rejected, reason); decisions.push({ status: 'rejected', rejected: { envelope: e, reason } }); continue; }
    const admitted = { envelope: e, ingress: next.nextIngress, receivedAtMs: now };
    next.nextIngress = add(next.nextIngress, 1, 'state.nextIngress');
    if (e.kind === 'event') { increment(next.counters, 'acceptedEvents'); next.events.push(admitted); }
    else {
      increment(next.counters, 'acceptedContinuous'); const key = tuple(e.source);
      if (held.delete(key)) increment(next.counters, 'coalescedContinuous');
      if (now - e.timestampMs > 500) increment(next.counters, 'expiredContinuous'); else held.set(key, admitted);
    }
    decisions.push({ status: 'accepted', admitted });
  }
  next.continuous = next.signals.flatMap(row => held.has(tuple(row.source)) ? [held.get(tuple(row.source))] : []);
  next.ingressNowMs = now;
  return result({ state: next, decisions });
}

export function changeLiveInputSources(input, replacements) {
  const next = state(input), sources = authorities(data(replacements, 'sources'), 'sources');
  if (sources.length !== next.sources.length) invalid('sources', 'source catalogue requires epoch reset');
  const changed = new Set();
  for (let i = 0; i < sources.length; i++) {
    const old = next.sources[i].authority, current = sources[i];
    if (old.sourceId !== current.sourceId || current.generation < old.generation) invalid('sources', 'source order/generation disagrees');
    if (current.generation === old.generation) {
      if (current.connected !== old.connected || current.calibrationId !== old.calibrationId) invalid('sources', 'authority changes require greater generation');
    } else { changed.add(current.sourceId); next.sources[i] = { authority: current, sequence: null, timestampMs: null }; }
  }
  const discarded = [];
  next.events = next.events.filter(admitted => {
    if (!changed.has(admitted.envelope.source.sourceId)) return true;
    increment(next.counters.discarded, 'source-reset'); discarded.push({ admitted, reason: 'source-reset' }); return false;
  });
  next.continuous = next.continuous.filter(admitted => { if (!changed.has(admitted.envelope.source.sourceId)) return true; increment(next.counters, 'clearedContinuous'); return false; });
  return result({ state: next, discarded });
}

function values(input, path) {
  const ids = new Set();
  return array(input, 256, path).map((row, i) => {
    const at = `${path}[${i}]`; fields(row, ['target', 'value'], at); fields(row.target, ['sceneId', 'nodePath', 'controlId'], at);
    uuid(row.target.sceneId, at); id(row.target.controlId, at); array(row.target.nodePath, 8, at).forEach(node => uuid(node, at)); finite(row.value, at);
    unique(ids, JSON.stringify([row.target.sceneId, row.target.nodePath, row.target.controlId]), at); return row;
  });
}
export function stepLiveInputs(input, inputStep) {
  const next = state(input), step = fields(data(inputStep, 'step'), ['timeMs', 'authority', 'base', 'hostValues'], 'step');
  time(step.timeMs, 'step.timeMs'); choice(step.authority, ['studio', 'host'], 'step.authority'); values(step.base, 'step.base'); values(step.hostValues, 'step.hostValues');
  if (step.authority === 'studio' && step.hostValues.length) invalid('step.hostValues', 'Studio cannot supply host values');
  const deltaMs = step.timeMs - next.lastStepMs;
  if (deltaMs < 0 || deltaMs > 60000) invalid('step.timeMs', 'step delta outside bounds; reset required for large gaps');
  const events = [], discarded = [];
  if (!next.stepped || deltaMs > 0) next.events = next.events.filter(admitted => {
    const timestamp = admitted.envelope.timestampMs;
    if (timestamp > step.timeMs) return true;
    if (step.timeMs - timestamp > 100) { increment(next.counters.discarded, 'late'); discarded.push({ admitted, reason: 'late' }); return false; }
    if (events.length >= 32) return true;
    increment(next.counters, 'consumedEvents'); events.push(admitted); return false;
  });
  const signals = [];
  next.continuous = next.continuous.filter(admitted => {
    const e = admitted.envelope;
    if (step.timeMs - e.timestampMs > 500) { increment(next.counters, 'expiredContinuous'); return false; }
    if (e.timestampMs <= step.timeMs) signals.push({ source: e.source, generation: e.generation, value: e.value });
    return true;
  });
  next.lastStepMs = step.timeMs; next.stepped = true;
  // Uncommitted candidate: publish this state together with the mapping state
  // only after evaluateTimedNumericMappings accepts the frame.
  return result({ state: next, frame: { epoch: next.epoch, deltaMs, authority: step.authority, base: step.base, signals, hostValues: step.hostValues }, events, discarded });
}

export function resetLiveInputs(input, inputDefinition, epoch, startMs) {
  const old = state(input), def = definition(inputDefinition), newEpoch = counter(epoch, 'epoch'), start = time(startMs, 'startMs');
  if (newEpoch <= old.epoch) invalid('epoch', 'reset requires strictly greater epoch');
  const discarded = old.events.map(admitted => ({ admitted, reason: 'reset' }));
  increment(old.counters.discarded, 'reset', old.events.length); increment(old.counters, 'clearedContinuous', old.continuous.length);
  return result({ state: empty(def, newEpoch, start, old.counters), discarded });
}
