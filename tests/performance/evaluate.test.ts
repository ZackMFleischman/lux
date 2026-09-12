import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePerformance, type Evidence } from '../../packages/performance/evaluate.ts';

const origin = 18_000_000_000_000_000_000n;
const tick = (ms: number) => (origin + BigInt(Math.round(ms * 1000))).toString();
function fixture(hz = 60): Evidence {
  const opportunities = Array.from({ length: hz * 300 }, (_, i) => ({
    sequence: i + 1, at: tick(i * 1000 / hz), generation: 1, frameId: String(i + 1),
    controlVersion: Math.floor(i / hz * 2) + 1, renderedAt: tick(i * 1000 / hz),
  }));
  return {
    schemaVersion: 1, provenance: 'synthetic', instanceId: 'instance', revisionId: 'revision',
    clock: { domain: 'qpc', frequency: '1000000', valid: true },
    window: { start: tick(0), end: tick(300000), coverageStart: tick(0), coverageEnd: tick(300250) },
    lostRecords: 0, incomplete: false, smoothing: false,
    opportunities,
    controls: Array.from({ length: 600 }, (_, i) => ({
      version: i + 1, value: i % 2 === 0 ? 0.2 : 0.8,
      sent: tick(i * 500), received: tick(i * 500), superseded: false,
      rendered: { at: tick(i * 500), generation: 1, frameId: String(i * hz / 2 + 1) },
    })),
  };
}

test('complete synthetic reference evaluates covered gates without claiming hardware acceptance', () => {
  const result = evaluatePerformance(fixture());
  assert.equal(result.validity, 'complete');
  assert.equal(result.host.cadence, 'pass');
  assert.equal(result.host.freshness, 'pass');
  assert.equal(result.host.freshRateHz, 60);
  assert.equal(result.controls.gate, 'pass');
  assert.equal(result.controls.matched, 600);
  assert.equal(result.hardwareAcceptance, 'unavailable');
  assert.equal(result.unsupported.visualGpu, 'unavailable');
});
test('fresh every time at 30 Hz fails independent cadence', () => {
  const result = evaluatePerformance(fixture(30));
  assert.equal(result.host.rateHz, 30);
  assert.equal(result.host.freshRateHz, 30);
  assert.equal(result.host.cadence, 'fail');
  assert.equal(result.host.freshRatio, 1);
});
test('missing beginning/end coverage and loss never pass', () => {
  for (const mutate of [
    (e: Evidence) => { e.window.coverageStart = tick(1000); },
    (e: Evidence) => { e.window.coverageEnd = tick(299000); },
    (e: Evidence) => { e.lostRecords = 1; },
    (e: Evidence) => { e.incomplete = true; },
    (e: Evidence) => { e.opportunities.splice(100, 1); },
  ]) {
    const e = fixture(); mutate(e);
    const r = evaluatePerformance(e);
    assert.equal(r.validity, 'invalid');
    assert.notEqual(r.host.cadence, 'pass');
    assert.notEqual(r.controls.gate, 'pass');
  }
});
test('repeats and delivery gaps count; edges cannot vanish', () => {
  const e = fixture();
  for (let i = 1; i <= 200; i++) { e.opportunities[i]!.frameId = '1'; e.opportunities[i]!.controlVersion = 1; e.opportunities[i]!.renderedAt = tick(0); }
  const r = evaluatePerformance(e);
  assert.equal(r.host.repeats, 200);
  assert.equal(r.host.freshness, 'fail');
  assert.ok(r.host.maxGapMs! > 3300);
  const tail = fixture(); tail.opportunities.splice(-20);
  assert.equal(evaluatePerformance(tail).host.freshness, 'fail');
});
test('generation resets never invent skipped IDs; same-generation skips are counted', () => {
  const e = fixture();
  e.controls = [];
  e.opportunities = e.opportunities.slice(0, 3);
  e.opportunities[0]!.frameId = '1000';
  e.opportunities[1]!.generation = 2; e.opportunities[1]!.frameId = '1';
  e.opportunities[2]!.generation = 2; e.opportunities[2]!.frameId = '4';
  assert.equal(evaluatePerformance(e).host.skipped, '2');
});
test('missing, superseded, substituted or unreceived versions cannot disappear', () => {
  for (const mutate of [
    (e: Evidence) => { e.controls.pop(); },
    (e: Evidence) => { e.controls[10]!.received = null; },
    (e: Evidence) => { e.controls[10]!.superseded = true; },
    (e: Evidence) => { e.controls[10]!.rendered!.frameId = '99999'; },
    (e: Evidence) => { for (const o of e.opportunities) if (o.controlVersion === 11) o.controlVersion = 12; },
  ]) {
    const e = fixture(); mutate(e);
    assert.notEqual(evaluatePerformance(e).controls.gate, 'pass');
  }
});
test('fewer than 500 exact samples cannot produce p99', () => {
  const e = fixture(); e.controls.splice(499);
  const r = evaluatePerformance(e);
  assert.equal(r.controls.matched, 499);
  assert.equal(r.controls.p99Ms, undefined);
  assert.equal(r.controls.gate, 'fail');
});
test('nearest-rank tails use BigInt differences before conversion', () => {
  const e = fixture();
  for (let i = 0; i < 600; i++) {
    // 570 samples at 20 ms, 24 at 60 ms, 6 at 120 ms.
    const delay = i < 570 ? 20 : i < 594 ? 60 : 120;
    e.controls[i]!.sent = tick(i * 500 - delay);
    e.controls[i]!.received = tick(i * 500 - delay);
  }
  // Shift all data so early stimuli stay in the window.
  e.controls[0]!.sent = tick(0); e.controls[0]!.received = tick(0);
  const r = evaluatePerformance(e);
  assert.equal(r.controls.p95Ms, 20);
  assert.equal(r.controls.p99Ms, 60);
  assert.equal(r.controls.maxMs, 120);
  assert.equal(r.controls.gate, 'pass');
});
test('invalid clocks, malformed records and excessive inputs are bounded rejections', () => {
  for (const mutate of [
    (e: any) => { e.clock.frequency = '0'; },
    (e: any) => { e.clock.valid = false; },
    (e: any) => { e.opportunities[1].at = tick(-1); },
    (e: any) => { e.opportunities[0].at = '9'.repeat(1000); },
    (e: any) => { e.opportunities[0].frameId = '-1'; },
    (e: any) => { e.opportunities = new Array(100001); },
    (e: any) => { e.controls = new Array(1001); },
    (e: any) => { e.extra = true; },
  ]) {
    const e = fixture(); mutate(e);
    assert.equal(evaluatePerformance(e).validity, 'invalid');
  }
});


test('slow exact control tails fail rather than getting filtered away', () => {
  for (const delay of [51, 101]) {
    const e = fixture();
    // 6% fail p95 at 51 ms; 2% fail p99 at 101 ms.
    const from = delay === 51 ? 564 : 588;
    for (let i = from; i < 600; i++) {
      e.controls[i]!.sent = tick(i * 500 - delay);
      e.controls[i]!.received = tick(i * 500 - delay);
    }
    const r = evaluatePerformance(e);
    assert.equal(r.controls.matched, 600);
    assert.equal(r.controls.gate, 'fail');
  }
});
test('null opportunities, stale generations and changed frame markers never look fresh', () => {
  const empty = fixture();
  for (const o of empty.opportunities) { o.frameId = null; o.controlVersion = null; o.renderedAt = null; }
  const r = evaluatePerformance(empty);
  assert.equal(r.host.fresh, 0);
  assert.equal(r.host.maxGapMs, 300000);
  assert.equal(r.host.freshness, 'fail');
  for (const mutate of [
    (e: Evidence) => { e.opportunities[1]!.generation = 0; },
    (e: Evidence) => { e.opportunities[1]!.frameId = '0'; },
    (e: Evidence) => { e.opportunities[1]!.frameId = '1'; e.opportunities[1]!.controlVersion = 2; },
    (e: Evidence) => { e.controls[1]!.version = 1; },
    (e: Evidence) => { e.controls[1]!.received = tick(499); },
    (e: Evidence) => { e.window.end = tick(299899); },
  ]) {
    const e = fixture(); mutate(e);
    assert.equal(evaluatePerformance(e).validity, 'invalid');
  }
});

test('empty restart opportunities advance the generation fence', () => {
  const e = fixture();
  Object.assign(e.opportunities[100]!, { generation: 2, frameId: null, controlVersion: null, renderedAt: null });
  assert.equal(evaluatePerformance(e).validity, 'invalid');
});

test('all consumed version markers obey receipt and first-render causality', () => {
  for (const version of [2, 601]) {
    const e = fixture(); e.opportunities[29]!.controlVersion = version;
    assert.equal(evaluatePerformance(e).validity, 'invalid');
  }
});
test('a later rendered frame can provide the first exact consumed control version', () => {
  const e = fixture();
  Object.assign(e.opportunities[30]!, { frameId: '30', controlVersion: 1, renderedAt: tick(29 * 1000 / 60) });
  const r = evaluatePerformance(e);
  assert.equal(r.host.cadence, 'pass');
  assert.equal(r.host.freshness, 'pass');
  assert.equal(r.controls.matched, 600);
  assert.equal(r.controls.maxMs, 16.667);
  assert.equal(r.controls.gate, 'pass');
});

test('control drain ends 250 ms after the final actual stimulus, including late tails', () => {
  const late = fixture();
  for (let i = 17970; i < 18000; i++) late.opportunities[i]!.controlVersion = 599;
  late.opportunities.push({ sequence: 18001, at: tick(300200), generation: 1,
    frameId: '18001', controlVersion: 600, renderedAt: tick(299500) });
  late.controls[599]!.rendered!.frameId = '18001';
  const r = evaluatePerformance(late);
  assert.equal(r.controls.gate, 'fail');
  assert.equal(r.controls.matched, 599);
  assert.equal(r.controls.unmatched, 1);
});
test('full window coverage suffices when final-stimulus drain ends inside it', () => {
  const e = fixture(); e.window.coverageEnd = tick(300000);
  const r = evaluatePerformance(e);
  assert.equal(r.validity, 'complete');
  assert.equal(r.controls.gate, 'pass');
});

test('consumed frames must agree with first-render identity and retain render timestamps', () => {
  for (const mutate of [
    (e: Evidence) => { e.opportunities[30]!.controlVersion = 1; },
    (e: Evidence) => { e.opportunities[31]!.renderedAt = tick(499); },
    (e: Evidence) => { e.opportunities[31]!.renderedAt = tick(600); },
    (e: Evidence) => { Object.assign(e.opportunities[31]!, { frameId: '31', renderedAt: tick(501) }); },
  ]) {
    const e = fixture(); mutate(e);
    assert.equal(evaluatePerformance(e).validity, 'invalid');
  }
});
test('final control consumed exactly at the final-stimulus deadline still matches', () => {
  const e = fixture();
  for (let i = 17970; i < 17985; i++) e.opportunities[i]!.controlVersion = 599;
  e.opportunities[17985]!.renderedAt = tick(299500);
  e.controls[599]!.rendered!.frameId = '17986';
  const r = evaluatePerformance(e);
  assert.equal(r.controls.matched, 600);
  assert.equal(r.controls.maxMs, 250);
  assert.equal(r.controls.gate, 'pass');
});

test('unconsumed first-render markers share immutable frame identity accounting', () => {
  for (const missingReceipt of [false, true]) {
    const e = fixture();
    e.controls[0]!.rendered!.frameId = '0';
    e.controls[1]!.rendered!.frameId = '0';
    if (missingReceipt) e.controls[0]!.received = null;
    const r = evaluatePerformance(e);
    assert.equal(r.validity, 'invalid');
    assert.notEqual(r.controls.gate, 'pass');
    assert.notEqual(r.host.cadence, 'pass');
  }
});
