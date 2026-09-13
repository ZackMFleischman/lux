import { decodeScriptedReplayFixture } from './replay-fixture.mjs';
import { createTimedMappingState, evaluateTimedNumericMappings } from './mapping.mjs';

export const replayCursorLimits = Object.freeze({ evaluations: 32768, events: 8192, work: 1048576, resultBytes: 16777216 });
const cursors = new WeakMap();
const encoder = new TextEncoder();
const pair = source => JSON.stringify([source.sourceId, source.signalId]);
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const detached = value => freeze(structuredClone(value));

function invalid(path, reason, code = 'INVALID_REPLAY_CURSOR') {
  const bounded = path.slice(0, 200);
  throw Object.assign(new Error(`${bounded}: ${reason.slice(0, 309)}`), { code, path: bounded });
}
function quota(path) { invalid(path, 'replay result or work budget exceeded', 'REPLAY_CURSOR_QUOTA_EXCEEDED'); }
function epoch(value, path) { if (!Number.isSafeInteger(value) || value < 0) invalid(path, 'expected nonnegative safe epoch'); return value === 0 ? 0 : value; }
function time(value, path) { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) invalid(path, 'expected finite nonnegative time'); return value === 0 ? 0 : value; }
function stateOf(cursor) { const state = cursors.get(cursor); if (!state) invalid('cursor', 'expected authentic cursor'); return state; }

// Requests have only two exact record levels and numeric leaves. Inspect every
// descriptor before reading its value; never invoke a caller's getter/toJSON.
function record(input, keys, path) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) invalid(path, 'expected plain record');
  const names = Reflect.ownKeys(input);
  if (names.length !== keys.length || names.some(key => typeof key !== 'string' || !keys.includes(key))) invalid(path, 'expected exact fields');
  const descriptors = keys.map(key => Object.getOwnPropertyDescriptor(input, key));
  if (descriptors.some(d => !d?.enumerable || !Object.hasOwn(d, 'value'))) invalid(path, 'expected enumerable own data');
  return Object.fromEntries(keys.map((key, i) => [key, descriptors[i].value]));
}
function request(input, keys) {
  const r = record(input, keys, 'request');
  for (const key of keys) {
    if (key === 'budget') {
      r.budget = record(r.budget, ['evaluations', 'events', 'work'], 'request.budget');
      for (const kind of ['evaluations', 'events', 'work']) {
        const n = r.budget[kind];
        if (!Number.isSafeInteger(n) || n < 0) invalid(`request.budget.${kind}`, 'expected nonnegative safe count');
        if (n > replayCursorLimits[kind]) quota(`request.budget.${kind}`);
      }
    } else r[key] = key.endsWith('Epoch') ? epoch(r[key], `request.${key}`) : time(r[key], `request.${key}`);
  }
  if (jsonBytes(r) > 1024) invalid('request', 'request byte budget exceeded');
  return r;
}
function checkEpoch(state, r) {
  if (r.runtimeEpoch !== state.runtimeEpoch) invalid('request.runtimeEpoch', 'stale or incorrect epoch');
  if (Object.hasOwn(r, 'nextEpoch') && r.nextEpoch <= r.runtimeEpoch) invalid('request.nextEpoch', 'next epoch must strictly increase');
}
function initial(fixture, fixtureHash, runtimeEpoch) {
  return { fixture, fixtureHash, runtimeEpoch, positionMs: 0, zeroConsumed: false, canonicalMs: 0, operationIndex: 0,
    values: fixture.base, mappingState: createTimedMappingState(fixture.mapping, runtimeEpoch),
    authorities: fixture.definition.sources, held: new Map(), referenced: new Set(fixture.mapping.mapping.bindings.map(b => pair(b.source))) };
}
function view(state, values = state.values) {
  return { version: 1, fixtureHash: state.fixtureHash, runtimeEpoch: state.runtimeEpoch, seed: state.fixture.seed,
    durationMs: state.fixture.durationMs, positionMs: state.positionMs, zeroConsumed: state.zeroConsumed, values };
}
export async function createScriptedReplayCursor(json, expectedSha256, runtimeEpoch) {
  const capturedEpoch = epoch(runtimeEpoch, 'runtimeEpoch');
  const encoded = await decodeScriptedReplayFixture(json, expectedSha256);
  const handle = Object.freeze({});
  cursors.set(handle, initial(encoded.fixture, encoded.sha256, capturedEpoch));
  return handle;
}
export function inspectScriptedReplayCursor(cursor) { return detached(view(stateOf(cursor))); }

// Streaming twice avoids allocating a schedule before its exact budgets pass.
// This iterator reads only immutable fixture data and local scalar indices.
function* schedule(state, nextMs) {
  if (state.zeroConsumed && nextMs === state.positionMs) return;
  const operations = state.fixture.operations;
  let index = state.operationIndex, at = state.canonicalMs;
  if (!state.zeroConsumed) yield { fromMs: 0, toMs: 0, reason: 'initial', operationIndex: null };
  while (true) {
    while (index < operations.length && operations[index].atMs === at) {
      const op = operations[index];
      yield { fromMs: at, toMs: at, reason: op.kind === 'sources' ? 'sources' : op.envelope.kind, operationIndex: index++ };
    }
    if (at === state.fixture.durationMs) break;
    const boundary = Math.min(operations[index]?.atMs ?? Infinity, (Math.floor(at / 60000) + 1) * 60000, state.fixture.durationMs);
    if (boundary > nextMs) break;
    yield { fromMs: at, toMs: boundary, reason: 'advance', operationIndex: null };
    at = boundary;
  }
  if (nextMs > at) yield { fromMs: at, toMs: nextMs, reason: 'projection', operationIndex: null };
}
function preflight(state, nextMs, budget) {
  let events = 0, evaluations = 0;
  for (const row of schedule(state, nextMs)) {
    if (row.reason === 'event') events++; else evaluations++;
  }
  const factor = 1 + state.fixture.mapping.mapping.targets.length + state.fixture.mapping.mapping.bindings.length;
  if (evaluations > budget.evaluations || evaluations > replayCursorLimits.evaluations) quota('request.budget.evaluations');
  if (events > budget.events || events > replayCursorLimits.events) quota('request.budget.events');
  if (evaluations > Math.floor(Math.min(budget.work, replayCursorLimits.work) / factor)) quota('request.budget.work');
  return evaluations * factor;
}

// Exact JSON-equivalent UTF-8 count over internal admitted data. No complete
// result serialization, event copying or array append precedes its byte guard.
function jsonBytes(value) {
  if (value === null || typeof value !== 'object') return encoder.encode(JSON.stringify(value)).byteLength;
  if (Array.isArray(value)) return 2 + Math.max(0, value.length - 1) + value.reduce((n, v) => n + jsonBytes(v), 0);
  const keys = Object.keys(value);
  return 2 + Math.max(0, keys.length - 1) + keys.reduce((n, k) => n + jsonBytes(k) + 1 + jsonBytes(value[k]), 0);
}
function chargeResult(bytes, addition) {
  if (!Number.isSafeInteger(addition) || addition < 0 || bytes > replayCursorLimits.resultBytes - addition) quota('result');
  return bytes + addition;
}
function signals(state) {
  const result = [];
  for (const declaration of state.fixture.definition.signals) {
    const key = pair(declaration.source), sample = state.held.get(key);
    if (declaration.kind === 'continuous' && state.referenced.has(key) && sample) result.push({ source: declaration.source, generation: sample.generation, value: sample.value });
  }
  return result;
}
function sources(state, incoming) {
  const previous = new Map(state.authorities.map(a => [a.sourceId, a]));
  const changed = new Set(incoming.filter(a => {
    const before = previous.get(a.sourceId);
    return !before || a.generation !== before.generation || a.connected !== before.connected || a.calibrationId !== before.calibrationId;
  }).map(a => a.sourceId));
  for (const [key, sample] of state.held) if (changed.has(sample.source.sourceId)) state.held.delete(key);
  state.authorities = incoming;
}
function execute(start, nextMs, budget) {
  const work = preflight(start, nextMs, budget);
  const candidate = { ...start, held: new Map(start.held), positionMs: nextMs, zeroConsumed: true };
  const result = { view: view(candidate, []), previousMs: start.positionMs, nextMs, events: [], evaluations: [], work };
  let bytes = chargeResult(0, jsonBytes(result));
  for (const row of schedule(start, nextMs)) {
    const op = row.operationIndex === null ? null : start.fixture.operations[row.operationIndex];
    if (row.reason === 'event') {
      const shell = { fixtureHash: start.fixtureHash, operationIndex: row.operationIndex, original: null, runtime: null };
      const eventBytes = jsonBytes(shell) - 8 + 2 * jsonBytes(op.envelope) + jsonBytes(start.runtimeEpoch) - jsonBytes(op.envelope.epoch);
      bytes = chargeResult(bytes, eventBytes + (result.events.length ? 1 : 0));
      const event = { fixtureHash: start.fixtureHash, operationIndex: row.operationIndex, original: op.envelope, runtime: { ...op.envelope, epoch: start.runtimeEpoch } };
      result.events.push(detached(event));
    } else {
      bytes = chargeResult(bytes, jsonBytes(row) + (result.evaluations.length ? 1 : 0));
      if (row.reason === 'continuous') candidate.held.set(pair(op.envelope.source), op.envelope);
      if (row.reason === 'sources') sources(candidate, op.sources);
      const evaluated = evaluateTimedNumericMappings(start.fixture.mapping, { epoch: start.runtimeEpoch, deltaMs: row.toMs - row.fromMs,
        authority: 'studio', base: start.fixture.base, signals: signals(candidate), hostValues: [] }, candidate.mappingState);
      candidate.values = evaluated.values;
      if (row.reason !== 'projection') { candidate.mappingState = evaluated.state; candidate.canonicalMs = row.toMs; }
      result.evaluations.push(row);
    }
    if (op) candidate.operationIndex = row.operationIndex + 1;
  }
  for (const value of candidate.values) {
    bytes = chargeResult(bytes, jsonBytes(value) + (result.view.values.length ? 1 : 0));
    result.view.values.push(detached(value));
  }
  return { candidate, result: freeze(result) };
}
export function advanceScriptedReplayCursor(cursor, input) {
  const state = stateOf(cursor), r = request(input, ['runtimeEpoch', 'previousMs', 'nextMs', 'budget']);
  checkEpoch(state, r);
  if (r.previousMs !== state.positionMs) invalid('request.previousMs', 'position must match cursor');
  if (r.nextMs < r.previousMs || r.nextMs > state.fixture.durationMs) invalid('request.nextMs', 'outside forward fixture interval');
  const { candidate, result } = execute(state, r.nextMs, r.budget);
  cursors.set(cursor, candidate);
  return result;
}
export function resetScriptedReplayCursor(cursor, input) {
  const state = stateOf(cursor), r = request(input, ['runtimeEpoch', 'nextEpoch']);
  checkEpoch(state, r);
  const candidate = initial(state.fixture, state.fixtureHash, r.nextEpoch), result = detached(view(candidate));
  cursors.set(cursor, candidate);
  return result;
}
export function seekScriptedReplayCursor(cursor, input) {
  const state = stateOf(cursor), r = request(input, ['runtimeEpoch', 'nextEpoch', 'nextMs', 'budget']);
  checkEpoch(state, r);
  if (r.nextMs > state.fixture.durationMs) invalid('request.nextMs', 'outside fixture interval');
  const start = initial(state.fixture, state.fixtureHash, r.nextEpoch);
  const { candidate, result } = execute(start, r.nextMs, r.budget);
  cursors.set(cursor, candidate);
  return result;
}
