import { normalizeTimedMappingPlan, createTimedMappingState, evaluateTimedNumericMappings } from './mapping.mjs';
import { createLiveInputState } from './timeline.mjs';

// Portable scripted data only. No live admission, playback, or authority token.
export const replayFixtureLimits = Object.freeze({ bytes: 8388608, values: 250000, depth: 16, operations: 8192, durationMs: 600000, sourceConfigs: 256, configEntries: 32, configStringChars: 256 });
const encoder = new TextEncoder();
const logical = /^[a-z][A-Za-z0-9_]{0,63}$/;
const reserved = new Set(['constructor', 'prototype', '__proto__']);
const rootFields = ['version', 'mode', 'durationMs', 'originEpoch', 'seed', 'generator', 'mapping', 'authority', 'base', 'definition', 'sourceConfigs', 'operations'];

function invalid(path, reason, code = 'INVALID_REPLAY_FIXTURE') {
  const bounded = path.slice(0, 200);
  throw Object.assign(new Error(`${bounded}: ${reason.slice(0, 309)}`), { code, path: bounded });
}
function finite(value, path) { if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path, 'expected finite number'); return Object.is(value, -0) ? 0 : value; }
function integer(value, path, max = Number.MAX_SAFE_INTEGER) { if (!Number.isSafeInteger(value) || value < 0 || value > max) invalid(path, 'expected bounded nonnegative integer'); return value; }
function id(value, path) { if (typeof value !== 'string' || !logical.test(value) || reserved.has(value)) invalid(path, 'invalid logical identifier'); return value; }
function fields(value, expected, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== expected.length || expected.some(k => !Object.hasOwn(value, k))) invalid(path, 'expected exact record fields');
  return value;
}
function array(value, max, path) { if (!Array.isArray(value) || value.length > max) invalid(path, 'array exceeds declared bound'); return value; }
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function owner(path, run) { try { return run(); } catch (error) { invalid(path, typeof error?.message === 'string' ? error.message : 'nested owner rejected data'); } }

// Capture descriptors before reading descendants. Every acyclic alias occurrence
// is charged and copied separately. This does not promise proxy-trap immunity.
function capture(input) {
  let bytes = 0, values = 0;
  const ancestors = new Set();
  function charge(count, path) { bytes += count; if (bytes > replayFixtureLimits.bytes) invalid(path, 'raw UTF-8 byte budget exceeded'); }
  function stringBytes(value, path) {
    if (value.length > replayFixtureLimits.bytes) invalid(path, 'raw UTF-8 byte budget exceeded');
    return encoder.encode(JSON.stringify(value)).byteLength;
  }
  function copy(value, path, depth) {
    if (++values > replayFixtureLimits.values) invalid(path, 'visited value budget exceeded');
    if (depth > replayFixtureLimits.depth) invalid(path, 'raw depth budget exceeded');
    if (value === null) { charge(4, path); return null; }
    if (typeof value === 'string') { charge(stringBytes(value, path), path); return value; }
    if (typeof value === 'number') { const n = finite(value, path); charge(JSON.stringify(n).length, path); return n; }
    if (typeof value === 'boolean') { charge(value ? 4 : 5, path); return value; }
    if (!value || typeof value !== 'object' || ancestors.has(value)) invalid(path, 'expected acyclic plain data');
    const isArray = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) invalid(path, 'unexpected prototype');
    const keys = Reflect.ownKeys(value);
    if (isArray) {
      const length = Object.getOwnPropertyDescriptor(value, 'length').value;
      if (length > replayFixtureLimits.operations || keys.length !== length + 1) invalid(path, 'expected bounded dense array');
      const descriptors = [];
      for (let i = 0; i < length; i++) {
        const d = Object.getOwnPropertyDescriptor(value, String(i));
        if (!d?.enumerable || !Object.hasOwn(d, 'value')) invalid(path, 'expected own enumerable array data');
        descriptors.push(d);
      }
      charge(2 + Math.max(0, length - 1), path); ancestors.add(value);
      const result = descriptors.map((d, i) => copy(d.value, `${path}[${i}]`, depth + 1));
      ancestors.delete(value); return result;
    }
    if (keys.length > 32) invalid(path, 'record field budget exceeded');
    const descriptors = keys.map(key => {
      const d = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== 'string' || key.length > 64 || !d?.enumerable || !Object.hasOwn(d, 'value')) invalid(path, 'expected bounded enumerable own data properties');
      return d;
    });
    charge(2 + Math.max(0, keys.length - 1), path); ancestors.add(value);
    const result = {};
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]; charge(stringBytes(key, path) + 1, path);
      Object.defineProperty(result, key, { value: copy(descriptors[i].value, `${path}.${key}`, depth + 1), enumerable: true, writable: true, configurable: true });
    }
    ancestors.delete(value); return result;
  }
  return copy(input, 'fixture', 0);
}

function config(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path, 'expected flat configuration record');
  const result = {};
  for (const key of Object.keys(value).sort()) {
    id(key, path); const item = value[key];
    if (item !== null && !['string', 'number', 'boolean'].includes(typeof item)) invalid(`${path}.${key}`, 'expected configuration scalar');
    if (typeof item === 'string' && item.length > 256) invalid(`${path}.${key}`, 'configuration string exceeds character bound');
    result[key] = item;
  }
  return result;
}
function sourceRef(value, path) { fields(value, ['sourceId', 'signalId'], path); return { sourceId: id(value.sourceId, path), signalId: id(value.signalId, path) }; }
function authority(value, path) {
  fields(value, ['sourceId', 'generation', 'connected', 'calibrationId'], path);
  if (typeof value.connected !== 'boolean') invalid(path, 'expected connected boolean');
  return { sourceId: id(value.sourceId, path), generation: integer(value.generation, path), connected: value.connected, calibrationId: id(value.calibrationId, path) };
}
const pair = (a, b) => JSON.stringify([a, b]);
function envelope(value, path) {
  if (!value || !['event', 'continuous'].includes(value.kind)) invalid(path, 'unsupported envelope kind');
  fields(value, ['version', 'epoch', 'source', 'generation', 'calibrationId', 'sequence', 'timestampMs', 'kind', value.kind === 'event' ? 'payload' : 'value'], path);
  if (value.version !== 1) invalid(path, 'unsupported envelope version');
  const common = { version: 1, epoch: integer(value.epoch, path), source: sourceRef(value.source, `${path}.source`), generation: integer(value.generation, path), calibrationId: id(value.calibrationId, path), sequence: integer(value.sequence, path), timestampMs: finite(value.timestampMs, path), kind: value.kind };
  if (value.kind === 'continuous') return { ...common, value: finite(value.value, path) };
  fields(value.payload, ['type', 'values'], `${path}.payload`);
  return { ...common, payload: { type: id(value.payload.type, path), values: array(value.payload.values, 16, `${path}.payload.values`).map(n => finite(n, path)) } };
}

export function normalizeScriptedReplayFixture(input) {
  const raw = fields(capture(input), rootFields, 'fixture');
  if (raw.version !== 1 || raw.mode !== 'scripted') invalid('fixture', 'unsupported fixture version or mode');
  const durationMs = finite(raw.durationMs, 'fixture.durationMs');
  if (durationMs < 0 || durationMs > replayFixtureLimits.durationMs) invalid('fixture.durationMs', 'duration outside bounds');
  const originEpoch = integer(raw.originEpoch, 'fixture.originEpoch'), seed = integer(raw.seed, 'fixture.seed', 0xffffffff);
  fields(raw.generator, ['id', 'version', 'configuration'], 'fixture.generator');
  if (typeof raw.generator.version !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(raw.generator.version)) invalid('fixture.generator.version', 'invalid generator version token');
  const generator = { id: id(raw.generator.id, 'fixture.generator.id'), version: raw.generator.version, configuration: config(raw.generator.configuration, 'fixture.generator.configuration') };
  const mapping = owner('fixture.mapping', () => normalizeTimedMappingPlan(raw.mapping));
  if (raw.authority !== 'studio') invalid('fixture.authority', 'only Studio authority is supported');
  const base = owner('fixture.base', () => evaluateTimedNumericMappings(mapping, { epoch: originEpoch, deltaMs: 0, authority: 'studio', base: raw.base, signals: [], hostValues: [] }, createTimedMappingState(mapping, originEpoch)).values);
  const live = owner('fixture.definition', () => createLiveInputState(raw.definition, originEpoch, 0));
  const definition = { version: 1, sources: live.sources.map((s, i) => authority(s.authority, `fixture.definition.sources[${i}]`)), signals: live.signals.map(s => ({ source: { sourceId: s.source.sourceId, signalId: s.source.signalId }, kind: s.kind })) };
  const sourceConfigs = array(raw.sourceConfigs, 256, 'fixture.sourceConfigs').map((c, i) => {
    const path = `fixture.sourceConfigs[${i}]`; fields(c, ['sourceId', 'calibrationId', 'configuration'], path);
    return { sourceId: id(c.sourceId, path), calibrationId: id(c.calibrationId, path), configuration: config(c.configuration, `${path}.configuration`) };
  });
  const configured = new Set();
  for (const c of sourceConfigs) { const key = pair(c.sourceId, c.calibrationId); if (configured.has(key)) invalid('fixture.sourceConfigs', 'duplicate configuration pair'); configured.add(key); }
  sourceConfigs.sort((a, b) => a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : a.calibrationId < b.calibrationId ? -1 : a.calibrationId > b.calibrationId ? 1 : 0);
  const referenced = new Set(definition.sources.map(s => pair(s.sourceId, s.calibrationId)));
  const cursors = new Map(definition.sources.map(a => [a.sourceId, { authority: a, sequence: null, timestampMs: null }]));
  const declared = new Map(definition.signals.map(s => [pair(s.source.sourceId, s.source.signalId), s.kind]));
  let previousTime = 0;
  const operations = array(raw.operations, 8192, 'fixture.operations').map((op, i) => {
    const path = `fixture.operations[${i}]`;
    if (!op || !['input', 'sources'].includes(op.kind)) invalid(path, 'unsupported operation kind');
    fields(op, ['kind', 'atMs', op.kind === 'input' ? 'envelope' : 'sources'], path);
    const atMs = finite(op.atMs, `${path}.atMs`);
    if (atMs < previousTime || atMs > durationMs) invalid(path, 'operation time outside ordered duration');
    previousTime = atMs;
    if (op.kind === 'sources') {
      const sources = array(op.sources, 64, `${path}.sources`).map((s, index) => authority(s, `${path}.sources[${index}]`));
      if (sources.length !== definition.sources.length || sources.some((s, index) => s.sourceId !== definition.sources[index].sourceId)) invalid(path, 'source snapshot must preserve complete declaration order');
      for (const a of sources) {
        const cursor = cursors.get(a.sourceId), old = cursor.authority;
        if (a.generation < old.generation || a.generation === old.generation && (a.connected !== old.connected || a.calibrationId !== old.calibrationId)) invalid(path, 'authority change requires increasing generation');
        if (a.generation !== old.generation) { cursor.sequence = null; cursor.timestampMs = null; }
        cursor.authority = a; referenced.add(pair(a.sourceId, a.calibrationId));
      }
      return { kind: 'sources', atMs, sources };
    }
    const e = envelope(op.envelope, `${path}.envelope`), cursor = cursors.get(e.source.sourceId);
    if (e.epoch !== originEpoch || e.timestampMs !== atMs) invalid(path, 'envelope epoch/time disagrees with fixture placement');
    if (!cursor || declared.get(pair(e.source.sourceId, e.source.signalId)) !== e.kind || !cursor.authority.connected || e.generation !== cursor.authority.generation || e.calibrationId !== cursor.authority.calibrationId) invalid(path, 'envelope disagrees with declared signal/current authority');
    if (cursor.sequence !== null && e.sequence <= cursor.sequence) invalid(path, 'source sequence must strictly increase');
    if (cursor.timestampMs !== null && e.timestampMs < cursor.timestampMs) invalid(path, 'source timestamp must not decrease');
    cursor.sequence = e.sequence; cursor.timestampMs = e.timestampMs;
    return { kind: 'input', atMs, envelope: e };
  });
  if (referenced.size !== configured.size || [...referenced].some(key => !configured.has(key))) invalid('fixture.sourceConfigs', 'configuration pairs must exactly cover referenced authorities');
  const result = { version: 1, mode: 'scripted', durationMs, originEpoch, seed, generator, mapping, authority: 'studio', base, definition, sourceConfigs, operations };
  if (encoder.encode(JSON.stringify(result)).byteLength > replayFixtureLimits.bytes) invalid('fixture', 'normalized UTF-8 byte budget exceeded');
  return freeze(result);
}

async function hash(bytes) {
  const subtle = globalThis.crypto?.subtle;
  if (typeof subtle?.digest !== 'function') invalid('fixture.sha256', 'Web Crypto SHA-256 is unavailable', 'REPLAY_HASH_UNAVAILABLE');
  const digest = subtle.digest.bind(subtle);
  const result = await digest('SHA-256', bytes);
  return Array.from(new Uint8Array(result), n => n.toString(16).padStart(2, '0')).join('');
}
export async function encodeScriptedReplayFixture(input) {
  const fixture = normalizeScriptedReplayFixture(input), json = JSON.stringify(fixture), bytes = encoder.encode(json);
  const sha256 = await hash(bytes);
  return Object.freeze({ fixture, json, sha256 });
}
export async function decodeScriptedReplayFixture(json, expectedSha256) {
  if (typeof json !== 'string' || json.length > replayFixtureLimits.bytes) invalid('fixture.json', 'expected bounded primitive JSON string');
  if (typeof expectedSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(expectedSha256)) invalid('fixture.sha256', 'expected lowercase SHA-256');
  const bytes = encoder.encode(json);
  if (bytes.byteLength > replayFixtureLimits.bytes) invalid('fixture.json', 'UTF-8 byte budget exceeded');
  let raw;
  try { raw = JSON.parse(json); } catch { invalid('fixture.json', 'malformed JSON'); }
  const fixture = normalizeScriptedReplayFixture(raw);
  if (JSON.stringify(fixture) !== json) invalid('fixture.json', 'expected exact canonical JSON representation');
  const sha256 = await hash(bytes);
  if (sha256 !== expectedSha256) invalid('fixture.sha256', 'SHA-256 mismatch');
  return Object.freeze({ fixture, json, sha256 });
}
