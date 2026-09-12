/** Offline normalized evidence contract. See README.md; this is not a wire protocol. */
export interface Evidence {
  schemaVersion: 1;
  provenance: 'synthetic' | 'recorded';
  instanceId: string;
  revisionId: string;
  clock: { domain: 'qpc'; frequency: string; valid: boolean };
  window: { start: string; end: string; coverageStart: string; coverageEnd: string };
  lostRecords: number;
  incomplete: boolean;
  smoothing: boolean;
  opportunities: { sequence: number; at: string; generation: number; frameId: string | null; controlVersion: number | null; renderedAt: string | null }[];
  controls: { version: number; value: number; sent: string; received: string | null; superseded: boolean;
    rendered: { at: string; generation: number; frameId: string } | null }[];
}
type Gate = 'pass' | 'fail' | 'unavailable';
export interface Evaluation {
  validity: 'complete' | 'invalid';
  reasons: string[];
  hardwareAcceptance: 'unavailable';
  unsupported: Record<string, 'unavailable'>;
  host: { cadence: Gate; freshness: Gate; opportunities?: number; expectedOpportunities?: number;
    rateHz?: number; freshRateHz?: number; fresh?: number; repeats?: number; skipped?: string; freshRatio?: number; maxGapMs?: number };
  controls: { gate: Gate; sent?: number; received?: number; superseded?: number; rendered?: number;
    matched?: number; unmatched?: number; p50Ms?: number; p95Ms?: number; p99Ms?: number; maxMs?: number };
}
const UINT64 = 18446744073709551615n;
function object(value: unknown, keys: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected record');
  const allowed = keys.split(' ');
  const actual = Object.keys(value);
  if (actual.length !== allowed.length || actual.some(k => !allowed.includes(k))) throw new Error('Unexpected or missing field');
}
function ticks(value: unknown): bigint {
  if (typeof value !== 'string' || value.length > 20 || !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error('Invalid uint64');
  const n = BigInt(value);
  if (n > UINT64) throw new Error('uint64 overflow');
  return n;
}
function integer(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error('Invalid integer');
}
function boolean(value: unknown) { if (typeof value !== 'boolean') throw new Error('Invalid flag'); }
function identifier(value: unknown) { if (typeof value !== 'string' || value.length < 1 || value.length > 128) throw new Error('Invalid identity'); }
function admit(input: unknown): asserts input is Evidence {
  object(input, 'schemaVersion provenance instanceId revisionId clock window lostRecords incomplete smoothing opportunities controls');
  if (!Array.isArray(input.opportunities) || input.opportunities.length > 100000 || !Array.isArray(input.controls) || input.controls.length > 1000) throw new Error('Input record cap exceeded');
  if (input.schemaVersion !== 1 || !['synthetic', 'recorded'].includes(input.provenance as string)) throw new Error('Unsupported schema/provenance');
  identifier(input.instanceId); identifier(input.revisionId);
  object(input.clock, 'domain frequency valid');
  if (input.clock.domain !== 'qpc' || ticks(input.clock.frequency) === 0n || input.clock.valid !== true) throw new Error('Invalid clock');
  object(input.window, 'start end coverageStart coverageEnd');
  for (const v of Object.values(input.window)) ticks(v);
  integer(input.lostRecords); boolean(input.incomplete); boolean(input.smoothing);
  for (const o of input.opportunities) {
    object(o, 'sequence at generation frameId controlVersion renderedAt');
    integer(o.sequence); ticks(o.at); integer(o.generation);
    if (o.frameId !== null) ticks(o.frameId);
    if (o.controlVersion !== null) integer(o.controlVersion);
    if (o.frameId === null && o.controlVersion !== null) throw new Error('Control without frame');
    if (o.frameId === null) {
      if (o.renderedAt !== null) throw new Error('Render timestamp without frame');
    } else ticks(o.renderedAt);
  }
  for (const c of input.controls) {
    object(c, 'version value sent received superseded rendered');
    integer(c.version); ticks(c.sent); boolean(c.superseded);
    if (c.value !== 0.2 && c.value !== 0.8) throw new Error('Invalid stimulus');
    if (c.received !== null) ticks(c.received);
    if (c.rendered !== null) {
      object(c.rendered, 'at generation frameId');
      ticks(c.rendered.at); integer(c.rendered.generation); ticks(c.rendered.frameId);
    }
  }
}

export function evaluatePerformance(input: unknown): Evaluation {
  const result: Evaluation = {
    validity: 'invalid', reasons: [], hardwareAcceptance: 'unavailable',
    unsupported: Object.fromEntries(['visualCpu', 'visualGpu', 'bridgeGpu', 'connectionDelay', 'callback', 'uiResponse', 'watchdog', 'recovery', 'overhead', 'workloadProvenance', 'controlDriverSchedule'].map(k => [k, 'unavailable'])),
    host: { cadence: 'unavailable', freshness: 'unavailable' }, controls: { gate: 'unavailable' },
  };
  try {
    admit(input);
    const e = input;
    const frequency = ticks(e.clock.frequency);
    const ms = (difference: bigint) => Number(difference) / Number(frequency) * 1000;
    const start = ticks(e.window.start), end = ticks(e.window.end);
    const coverageStart = ticks(e.window.coverageStart), coverageEnd = ticks(e.window.coverageEnd);
    const duration = ms(end - start);
    if (end <= start || Math.abs(duration - 300000) > 100 || coverageStart > start || coverageEnd < end || coverageEnd < coverageStart || ms(coverageEnd - coverageStart) > 301000) throw new Error('Invalid independent window/coverage');
    if (e.lostRecords !== 0 || e.incomplete) throw new Error('Lost or incomplete evidence');
    let fresh = 0, repeats = 0, skipped = 0n, count = 0;
    let lastAt = coverageStart, lastFreshAt = start, maxGap = 0n;
    let currentGeneration: number | undefined;
    let previous: { generation: number; frame: bigint } | undefined;
    const firstConsumes = new Map<number, bigint>();
    const frameControls = new Map<string, { version: number | null; renderedAt: bigint }>();
    const registerFrame = (identity: string, version: number | null, renderedAt: bigint) => {
      const known = frameControls.get(identity);
      if (known && (known.version !== version || known.renderedAt !== renderedAt)) throw new Error('Frame metadata changed');
      frameControls.set(identity, { version, renderedAt });
    };
    // A skipped render still establishes immutable frame identity, even when
    // another stage of its control evidence is missing.
    for (const c of e.controls) {
      if (c.rendered) registerFrame(`${c.rendered.generation}:${c.rendered.frameId}`, c.version, ticks(c.rendered.at));
    }
    const controlByVersion = new Map(e.controls.map(c => [c.version, c]));
    for (const [i, o] of e.opportunities.entries()) {
      const at = ticks(o.at);
      if (o.sequence !== i + 1 || at < coverageStart || at > coverageEnd || (i > 0 && at <= lastAt)) throw new Error('Opportunity sequence/time invalid');
      lastAt = at;
      if (currentGeneration !== undefined && o.generation < currentGeneration) throw new Error('Stale opportunity generation');
      if (o.generation !== currentGeneration) previous = undefined;
      currentGeneration = o.generation;
      const inWindow = at >= start && at < end;
      if (inWindow) count++;
      if (o.frameId === null) continue;
      const frame = ticks(o.frameId), identity = `${o.generation}:${o.frameId}`;
      const renderedAt = ticks(o.renderedAt);
      if (renderedAt > at) throw new Error('Frame consumed before rendering');
      registerFrame(identity, o.controlVersion, renderedAt);
      if (o.controlVersion !== null) {
        if (o.controlVersion < 1 || o.controlVersion > 600) throw new Error('Unknown consumed control version');
        const c = controlByVersion.get(o.controlVersion);
        // Missing evidence remains a failing control gate; contradictory evidence is invalid.
        if (c?.received !== null && c?.received !== undefined && renderedAt < ticks(c.received)) throw new Error('Consumed frame rendered before control receipt');
        if (c?.rendered) {
          const firstRenderAt = ticks(c.rendered.at), firstFrame = ticks(c.rendered.frameId);
          if (renderedAt < firstRenderAt || o.generation < c.rendered.generation ||
            (o.generation === c.rendered.generation && frame < firstFrame) ||
            (o.generation === c.rendered.generation && frame === firstFrame && renderedAt !== firstRenderAt)) throw new Error('Consumed frame contradicts first rendered marker');
        }
        if (!firstConsumes.has(o.controlVersion)) firstConsumes.set(o.controlVersion, at);
      }
      if (previous && (o.generation < previous.generation || (o.generation === previous.generation && frame < previous.frame))) throw new Error('Stale generation/frame');
      const isFresh = !previous || o.generation > previous.generation || frame > previous.frame;
      if (inWindow) {
        if (isFresh) {
          fresh++;
          const gap = at - lastFreshAt; if (gap > maxGap) maxGap = gap;
          lastFreshAt = at;
          if (previous && o.generation === previous.generation) skipped += frame - previous.frame - 1n;
        } else repeats++;
      }
      previous = { generation: o.generation, frame };
    }
    if (end - lastFreshAt > maxGap) maxGap = end - lastFreshAt;
    const rateHz = count / (duration / 1000), freshRatio = count ? fresh / count : 0;
    result.host = { cadence: rateHz >= 59.4 && rateHz <= 60.6 ? 'pass' : 'fail',
      freshness: freshRatio >= .99 && ms(maxGap) <= 100 ? 'pass' : 'fail',
      opportunities: count, expectedOpportunities: duration / 1000 * 60, rateHz, freshRateHz: fresh / (duration / 1000), fresh, repeats,
      skipped: skipped.toString(), freshRatio, maxGapMs: ms(maxGap) };
    const versions = new Set<number>(), samples: number[] = [];
    const finalSent = e.controls.reduce((latest, c) => ticks(c.sent) > latest ? ticks(c.sent) : latest, start);
    const drainDeadline = finalSent + frequency / 4n;
    let received = 0, rendered = 0, superseded = 0;
    let controlValid = !e.smoothing;
    for (const c of e.controls) {
      if (versions.has(c.version) || c.version < 1 || c.version > 600) throw new Error('Duplicate/invalid control version');
      versions.add(c.version);
      if (c.value !== (c.version % 2 === 1 ? .2 : .8)) controlValid = false;
      const sent = ticks(c.sent);
      if (sent < start || sent >= end) throw new Error('Stimulus outside window');
      if (c.superseded) superseded++;
      if (c.received === null) continue;
      received++;
      const receipt = ticks(c.received);
      if (receipt < sent || receipt > coverageEnd) throw new Error('Invalid receipt time');
      if (c.rendered === null) continue;
      rendered++;
      const renderAt = ticks(c.rendered.at);
      if (renderAt < receipt || renderAt > coverageEnd) throw new Error('Invalid rendered time');
      const consumed = firstConsumes.get(c.version);
      if (consumed !== undefined && consumed >= renderAt && consumed <= drainDeadline) samples.push(ms(consumed - receipt));
    }
    if (e.controls.length > 0 && coverageEnd < drainDeadline) throw new Error('Missing control drain coverage');
    samples.sort((a, b) => a - b);
    const quantile = (q: number) => samples.length ? samples[Math.ceil(samples.length * q) - 1] : undefined;
    const p95Ms = quantile(.95), p99Ms = samples.length >= 500 ? quantile(.99) : undefined;
    result.controls = { gate: controlValid && versions.size === 600 && received === 600 && samples.length === 600 && superseded === 0 && p95Ms! <= 50 && p99Ms! <= 100 ? 'pass' : 'fail',
      sent: versions.size, received, rendered, superseded, matched: samples.length, unmatched: versions.size - samples.length,
      p50Ms: quantile(.5), p95Ms, p99Ms, maxMs: samples.at(-1) };
    result.validity = 'complete';
  } catch (error) {
    result.reasons.push(error instanceof Error ? error.message : 'Invalid evidence');
    result.host.cadence = 'unavailable'; result.host.freshness = 'unavailable'; result.controls.gate = 'unavailable';
  }
  return result;
}
