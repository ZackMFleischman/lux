# Live input timeline implementation plan

> **For agentic workers:** Use `superpowers:executing-plans` for this one assigned leaf. The sole root coordinator dispatches implementation and independent review; this document grants no child dispatch or integration authority. Steps use checkbox syntax.

**Goal:** Deliver I02b as a deterministic, bounded live continuous/event timeline that emits I02a mapping frames and preserves event identity for later replay.

**Architecture:** Pure functions consume explicit caller-owned source authority, calibrated monotonic milliseconds and detached state. The timeline admits envelopes in call/array order, coalesces continuous values, queues discrete events and emits at most 32 events per advancing step. Mapping arithmetic and smoothing remain in the existing I01/I02a evaluator.

**Tech stack:** Existing ESM JavaScript, `.d.mts` declarations, Node unit tests; no new dependency.

**Spec:** [creative-inputs-plan.md](creative-inputs-plan.md), I02/I03, and [input-timeline-plan.md](input-timeline-plan.md), I02b/I02c. Planning revision 1 for LUX-27 specification 2. Inspected baseline `7cff0e571731dd8778765093a98f4c4b5867dbdf` includes independently accepted I02a `cf09ece8`; independent critique of this exact plan is required before coding.

## Scope and decisions

- This first leaf creates only `packages/inputs/src/timeline.mjs`, `timeline.d.mts`, `tests/unit/input-timeline.test.mjs` and `input-timeline-admission.test.mjs`. No existing mapping source/declaration/test changes are authorized. Existing test discovery already includes the new unit files.
- No providers, MIDI/audio adapter, event SDK, runtime clock, fixed-step simulation, held-note engine, Studio, native code, project persistence, capture/replay implementation, public export, install, graphics or portal work. Numeric event payloads are opaque data, not a promise of an actual host event channel.
- Read `mapping.mjs` and `mapping.d.mts` at the exact implementation baseline. Import its public `SourceRef`, `InputValue`, `TimedMappingFrame`, `TimedMappingPlan` and evaluator only in declarations/tests where appropriate. Timeline does not call or duplicate mapping shaping, smoothing or combination math.
- Mapping's descriptor-safe capture is private and has mapping-specific errors, no null scalar, depth 6 and arrays at most 256. Keep mapping byte/error semantics untouched. A small private timeline capture owns timeline's nullable cursors, depth 8 and exact schema; do not export a shared admission framework or edit the mapping owner. Review the two boundaries for equivalent own-data defenses, not identical error names.
- Source-level sequence/timestamp order applies across every signal of one logical source, including mixed continuous/event envelopes. Per-tuple order would accept a stale callback from another signal and is intentionally rejected. Cross-source ordering uses admitted ingress order, never timestamp sorting.
- All clocks and authority come from the caller. Input-evaluation milliseconds are one declared calibrated monotonic domain, not animation time. I03 must separately adapt paused redraw, fixed-step and dropped simulation intervals; this leaf never advances a simulation or authorizes a runtime instance.

## Exact exported contract

All DTO members and nested arrays below are readonly; aliases are exported. `Milliseconds`, `SafeCounter` and IDs are runtime-validated numbers/strings, not nominal trust. An `unknown` normalizer revalidates state; typed arguments confer no trust.

```ts
import type { SourceRef, InputValue, TimedMappingFrame } from './mapping.mjs';
export type InputKind = 'continuous' | 'event';
export type SourceAuthority = Readonly<{
  sourceId: string; generation: number; connected: boolean; calibrationId: string;
}>;
export type SignalDeclaration = Readonly<{ source: SourceRef; kind: InputKind }>;
export type TimelineDefinition = Readonly<{
  version: 1; sources: readonly SourceAuthority[]; signals: readonly SignalDeclaration[];
}>;
export type EventPayload = Readonly<{ type: string; values: readonly number[] }>;
export type EnvelopeBase = Readonly<{
  version: 1; epoch: number; source: SourceRef; generation: number;
  calibrationId: string; sequence: number; timestampMs: number;
}>;
export type InputEnvelope = EnvelopeBase & (
  Readonly<{ kind: 'continuous'; value: number }> |
  Readonly<{ kind: 'event'; payload: EventPayload }>
);
export type AdmittedInput = Readonly<{
  envelope: InputEnvelope; ingress: number; receivedAtMs: number;
}>;
export type SourceCursor = Readonly<{
  authority: SourceAuthority; sequence: number | null; timestampMs: number | null;
}>;
export type RejectionReason = 'epoch' | 'unknown-source' | 'unknown-signal' |
  'kind' | 'generation' | 'disconnected' | 'calibration' | 'sequence' |
  'timestamp' | 'future' | 'late' | 'overflow';
export type DiscardReason = 'late' | 'source-reset' | 'reset';
export type RejectedInput = Readonly<{ envelope: InputEnvelope; reason: RejectionReason }>;
export type DiscardedEvent = Readonly<{ admitted: AdmittedInput; reason: DiscardReason }>;
export type TimelineCounters = Readonly<{
  received: number; acceptedContinuous: number; acceptedEvents: number;
  rejected: Readonly<Record<RejectionReason, number>>;
  consumedEvents: number; discarded: Readonly<Record<DiscardReason, number>>;
  coalescedContinuous: number; expiredContinuous: number; clearedContinuous: number;
}>;
export type LiveInputState = Readonly<{
  version: 1; epoch: number; startMs: number; lastStepMs: number; stepped: boolean;
  ingressNowMs: number; nextIngress: number;
  sources: readonly SourceCursor[]; signals: readonly SignalDeclaration[];
  continuous: readonly AdmittedInput[]; events: readonly AdmittedInput[];
  counters: TimelineCounters;
}>;
export type IngressDecision =
  Readonly<{ status: 'accepted'; admitted: AdmittedInput }> |
  Readonly<{ status: 'rejected'; rejected: RejectedInput }>;
export type IngressResult = Readonly<{ state: LiveInputState; decisions: readonly IngressDecision[] }>;
export type SourceChangeResult = Readonly<{ state: LiveInputState; discarded: readonly DiscardedEvent[] }>;
export type TimelineStep = Readonly<{
  timeMs: number; authority: 'studio' | 'host';
  base: readonly InputValue[]; hostValues: readonly InputValue[];
}>;
export type TimelineStepResult = Readonly<{
  state: LiveInputState; frame: TimedMappingFrame;
  events: readonly AdmittedInput[]; discarded: readonly DiscardedEvent[];
}>;
export function createLiveInputState(definition: TimelineDefinition, epoch: number, startMs: number): LiveInputState;
export function normalizeLiveInputState(input: unknown): LiveInputState;
export function admitLiveInputs(state: LiveInputState, nowMs: number, envelopes: readonly InputEnvelope[]): IngressResult;
export function changeLiveInputSources(state: LiveInputState, sources: readonly SourceAuthority[]): SourceChangeResult;
export function stepLiveInputs(state: LiveInputState, step: TimelineStep): TimelineStepResult;
export function resetLiveInputs(state: LiveInputState, definition: TimelineDefinition, epoch: number, startMs: number): SourceChangeResult;
export const inputTimelineLimits: Readonly<{
  sources: 64; signals: 256; batch: 256; queuedEvents: 256; consumedPerStep: 32;
  liveLatenessMs: 100; freshnessMs: 500; payloadValues: 16;
  inputBytes: 262144; stateBytes: 1048576; resultBytes: 2097152; maxStepDeltaMs: 60000;
}>;
```

`AdmittedInput.envelope.kind` narrows its value/payload; queue validation enforces event kind and held-value validation continuous kind. The implementation may add exported `AdmittedEvent`/`AdmittedContinuous` aliases only as intersections narrowing this same DTO, without widening shape. Prefer these aliases in declarations if they make consumer narrowing simpler. Every operation returns newly detached deeply frozen data; no caller alias, mutable Map/Set, hidden cache, timer, listener or retained process state.

## Admission, bounds and state invariants

IDs (`sourceId`, `signalId`, `calibrationId`, payload `type`) use exactly mapping's `[a-z][A-Za-z0-9_]{0,63}` exclusion of `constructor`, `prototype`, `__proto__`. A source is a logical producer; a tuple is the JSON array `[sourceId,signalId]`. Unique source IDs (at most 64), unique declared tuples (at most 256), each tuple's source exists. Declaration order is retained and defines returned source/continuous order. No catalogue sorting or alias resolution. Mapping's total union bound of 256 referenced tuples still applies when its evaluator consumes a frame.

Epoch, source generation, sequence, counters and ingress are nonnegative safe integers. Sequence zero is valid. Epoch/generation changes require explicit caller authority operations, never a larger envelope value. Milliseconds are finite numbers in `[0,Number.MAX_SAFE_INTEGER]`; fractional milliseconds are allowed and negative zero normalizes to zero. This upper bound ensures elapsed subtraction of two admitted times remains finite. No rounding, inferred offset or device-clock comparison. Caller calibration is represented by a bounded `calibrationId` associated with each source generation; timeline checks equality but cannot prove physical calibration. Raw device timestamps and calibration coefficients remain a later adapter/replay provenance obligation.

The generic data pass rejects symbols, accessors without calling them, non-enumerable extras, exotic prototypes, sparse arrays, cycles, nonfinite numbers, unsupported scalars and depth beyond 8. Accept ordinary and null-prototype records; ordinary dense arrays only. Bound own-key count before copying descriptor values: 16 per record except the exact counters reason map (12); bound keys to 64 chars, array length 256 and strings to 256 KiB before UTF-8 encoding. Exact-schema checks reject every unknown field, missing required field and kind/payload mismatch. Event payload has one valid type and at most 16 finite numeric values; no arbitrary nested JSON. No proxy-trap immunity or protection from prior malicious intrinsic replacement is claimed.

Count raw JSON-equivalent UTF-8 bytes (including record keys, escaped string representation, delimiters and number representation) before each value is copied, just as mapping does; null costs four bytes. Definition, complete ingress batch, source replacement and step each have their own 256-KiB limit; state has 1 MiB. Each operation preflights all input arguments and entire batch before any semantic decision, counter update or result copy. Oversized shape errors throw bounded `INVALID_INPUT_TIMELINE` with a path at most 200 chars; they are not per-envelope live rejection decisions. Argument scalars receive their declared checks too. Returned results have a separate 2-MiB bound, checked while constructing; output/quota/arithmetic failure throws atomically with all input unchanged. Limits are simultaneous: a byte boundary need not be reachable when a stricter field/count limit rejects first. Tests document such dominance rather than inventing a valid oversized fixture.

State normalizer also checks: paired null cursors only; sequence/timestamp cursors belong to current authorities; disconnected sources have no retained input; held entries are unique declared continuous tuples in declaration order; events are declared event tuples in strictly increasing ingress order; all retained envelopes match current epoch/generation/calibration/kind; `receivedAtMs >= timestampMs`, `receivedAtMs <= ingressNowMs`, and no retained input predates `startMs`. Non-null cursor timestamps are within `[startMs,ingressNowMs]`. Cursor sequence/time are at least those of retained input from that source. Retained ingress IDs are unique across held values and queue, less than `nextIngress`. In ingress order, retained receive times do not decrease; retained records of each source have strictly increasing sequence and nondecreasing timestamp, including across different kinds/tuples. This also rejects duplicate source-generation-sequence identities in manually supplied state. Times obey `lastStepMs >= startMs`, `ingressNowMs >= startMs`; when `stepped=false`, `lastStepMs=startMs`. It is valid for step time to lead or lag ingress time; they are separately monotonic observations in the same domain. State is data, not an authority token.

Creation uses the definition source order with null/null cursors, its declared signals, empty held/queue arrays, `nextIngress=0`, the supplied epoch, `lastStepMs=ingressNowMs=startMs`, and `stepped=false`. Counters start at zero. Before each operation, validate all are safe and check the following equalities with overflow-checked additions: `received = acceptedContinuous + acceptedEvents + sum(rejected)`; `acceptedEvents = consumedEvents + sum(discarded) + events.length`; `acceptedContinuous = coalescedContinuous + expiredContinuous + clearedContinuous + continuous.length`. Counter increments and next-ingress increments preflight against `Number.MAX_SAFE_INTEGER`; exhaustion rejects the whole operation, never wraps/saturates/returns partial results. Do not carry unbounded receipt/drop history in state: only counters, at most 256 held samples, 256 queued events and 64 watermarks persist. Receipts/discards are returned per operation for caller-owned bounded recording. Reset retains lifetime counters and advances epoch; a separately created timeline is a separately identified instance, not an implicit counter-reset workaround.

## Ordered live ingress algorithm

1. Validate/detach every argument, normalize state, require `nowMs >= ingressNowMs` and `nowMs >= startMs`. Batch order, and then successive call order, is authoritative; do not timestamp-sort callbacks.
2. For each well-shaped envelope increment `received`, then apply exactly this rejection precedence: epoch mismatch; unknown source; unknown signal; declared-kind mismatch; generation mismatch (old and future both); disconnected source; calibration mismatch; sequence not strictly greater than source cursor; timestamp before start or less than source cursor; timestamp greater than `nowMs`. Tied timestamps with increasing sequence pass. These rejections do not advance source watermarks or assign ingress.
3. After identity/order/time validity, advance the source-wide sequence and timestamp watermarks **even if** later live lateness/queue-capacity policy rejects this envelope. A retry of a dropped sequence is therefore `sequence`, not a second late/overflow acceptance attempt. This prevents callback replay resurrecting dropped work. A first valid sequence has no inferred predecessor requirement; gaps are allowed.
4. For an event, `nowMs - timestampMs > 100` rejects `late` (equality100 passes). If not late but queue already has256 events, reject the newest envelope as `overflow`. Never evict earlier accepted events. Events with identical payload/type/timestamp remain distinct when sequence differs. Continuous samples are not subject to the100ms event policy; if already older than500ms, accept then immediately count as expired without storing, so recorded receipt order and cursor remain explicit.
5. For each accepted envelope assign current `nextIngress`, increment it safely, retain exact detached envelope plus `receivedAtMs=nowMs`, increment the matching accepted counter and return an accepted decision in input order. Event append preserves ingress order. Continuous replacement of the same tuple increments `coalescedContinuous`; other tuples remain separate. If the new continuous sample is already stale, clear any previous held sample with `coalescedContinuous` and increment `expiredContinuous` for the new accepted sample; do not let an older held value survive a newer stale receipt.
6. Return decisions for every structurally valid input, including accepted samples later coalesced within this same batch. Dropped events have no ingress ID because ingress identifies acceptance, while the original sequence plus epoch/source/generation identifies attempted receipt. Set `ingressNowMs=nowMs`, even for an empty batch.

Example: source A continuous signal x seq5 then event signal note seq4 is `sequence`, even though the tuple differs. Sources A and B with timestamp10 and9 are independently valid when their source cursors allow them; if A arrived first, its accepted ingress precedes B. Future device timestamps never queue as speculative input; they are rejected before cursor advancement. A later call at that timestamp may retry the same sequence if it was not otherwise admitted/dropped after identity/order validity.

## Steps, freshness and time zero

`stepLiveInputs` requires `timeMs >= lastStepMs`; delta is exactly `timeMs-lastStepMs`, at most60000ms. A larger gap is an error requiring explicit new-epoch reset, matching I02a. After every successful step set `lastStepMs=timeMs` and `stepped=true`, retaining `ingressNowMs` and `nextIngress`; repeated-time calls still apply the explicit base/host/freshness rules but emit no events. No private clock and no automatic time clamp. A newly created timeline has `stepped=false`, `lastStepMs=startMs`; the first successful step may be at start (delta0), consuming the one-time initialization batch, or later (delta from start). It is an advancing event opportunity when `!stepped || timeMs>lastStepMs`. Repeated calls at a completed timestamp emit zero events and perform no late queue drain, even if new events arrived in between. This makes frozen-time redraw consume no simulation event; I03 still owns runtime adaptation.

On an event opportunity, scan the bounded queue in ingress order. Entries with `timestampMs>timeMs` remain queued; do not let them block later-ingress eligible entries from another source. For every due entry, discard as `late` when `timeMs-timestampMs>100`, incrementing discarded count and reporting its original admitted record. Among other due entries consume the first32; retain excess due entries for a later **strictly advancing** step. The32 budget counts consumed events, not examined entries or late drops; the complete scan is bounded by256. Every consumed event retains original envelope/ingress and increments `consumedEvents`; no acknowledgement that an SDK actually applied it is implied. Exposed returned event order is ingress order among eligible events; a future timestamp may be consumed later despite a smaller ingress ID. This scheduling fact must be recorded by future live-capture replay, not reconstructed from timestamp sorting alone.

Live events with timestamps at or before the already completed step but within100ms of receipt/next step are accepted and consumed on the next strictly advancing opportunity. Do not retroactively emit them into a closed interval or lose them via a replay-style lower-bound filter. The special time-zero batch is consumed only on the first successful step; an event at zero admitted after step(0) waits for a later step, and becomes a declared late drop if that later step is beyond100ms. At equality of the next boundary, events are due. Events retained due to the32 cap can age into explicit late drops at the next drain. Normal20/sec for10s with regular1/60s steps has200 receipts/acceptances/consumptions and zero drops.

At every step, expire held continuous samples where `timeMs-timestampMs>500` (strict greater; equality500 is fresh), incrementing `expiredContinuous` and removing them. A held sample with timestamp after the step is withheld from the frame but retained. Coalescing deliberately retains only the latest received value: stepping backwards through an older sample trajectory is not supported by live state. Future I02c replay must feed each original accepted sample at its own replay interval and must not use this coalesced snapshot as the recording. Output fresh signals in declaration order as `{source,generation,value}`. Missing/stale/disconnected sources are absent, so I02a drops their smoothing entries naturally; new generations reset them even when disconnect/reconnect happened between steps.

Frame is exactly `{epoch:state.epoch,deltaMs,authority:step.authority,base:detached step.base,signals,hostValues:detached step.hostValues}`. Timeline validates base/host arrays as bounded own-data `InputValue` arrays with canonical mapping target UUID/address syntax, finite values and duplicate target rejection; `studio` requires empty hostValues. It does not possess target definitions or prove complete base/schema ranges. The caller must immediately pass frame plus its own matching timed plan/state to `evaluateTimedNumericMappings`, which performs authoritative catalogue/range/union validation and arithmetic. This is the only mapping computation. `stepLiveInputs` is an uncommitted pure candidate; caller publishes its returned timeline and mapping state together only if evaluation succeeds. Failure must preserve both prior states. Timeline does not hide an evaluator inside itself or imply atomic persistence. External base/seed remain caller-owned.

## Source authority changes and reset

`changeLiveInputSources` requires exactly the current source IDs in original order. It cannot add/remove signals or logical sources; catalogue edits use new-epoch reset. A generation may remain equal only when connected/calibration are unchanged; any stop/rebind/reconnect or calibration change requires a strictly greater generation. A lower generation is an error. This snapshot comes from the current owner; an envelope cannot create authority or promote a generation.

For each changed source, clear its cursor to null/null, discard all queued events with `source-reset`, clear held continuous values counting `clearedContinuous`, and replace its authority. Unchanged sources preserve cursor and data. Return discarded records in prior queue ingress order. Retain counters, epoch, ingress counter and time cursors. There is no held-note state in this leaf; the future event consumer must clear notes for the same transition. Mapping is not invoked; current new-generation/missing signals will invalidate relevant binding state on next successful evaluation.

`resetLiveInputs` requires strictly greater epoch, a fully validated possibly changed definition and explicit nonnegative startMs. Report every pending event as discarded `reset`, count every held continuous sample cleared, retain lifetime counters, and clear all source cursors/queues/held values. Set `lastStepMs=ingressNowMs=startMs`, `stepped=false`, and `nextIngress=0`; epoch-qualified ingress identity prevents reuse ambiguity. Source generations may be chosen afresh because epoch changed. Mapping caller creates timed state at the new epoch, retaining its own valid base/macros/seed; live analysis values are not silently retained. Caller-authoritative controls are present through the base/mapping input and may also be explicitly re-admitted as new-epoch continuous envelopes. No implicit device reconnect or authority claim.

## I02c and I03 gates preserved

I02b is implementable after this plan's critique. I02c remains a separate planning leaf: immutable fixture version and exact bytes/hash, original envelopes and admitted ingress order, recorded consumption-step placement where live eligibility differed from ingress order, source calibration/configuration provenance, seed, plan identity, epoch remapping, bounded capture sizes/deadline, cursor/seek/reset and corruption checks must be frozen before implementation. Current receipts retain originals; coalesced state/counters cannot reconstruct a fixture. This plan deliberately supplies no persistence/hash/cursor API.

Controlled replay has no live lateness discard or silent overflow policy: apply all fixture events in `(previousTime,nextTime]` with one separately consumed time-zero batch, fail the bounded job when complete delivery cannot be achieved, and preserve repeated equal events. For replay of a live capture that consumed late/out-of-order eligible events, the future fixture must define explicit effective step placement while retaining original timestamps and ingress; it cannot silently pretend original timestamp windows reproduce live consumption. Recorded source-generation transitions and continuous originals must reconstruct independent I02a binding state, including the same piecewise held trajectories. I03 later specifies how dropped live simulation intervals map to these declared event outcomes; no fabricated simulation-step/paused/new-frame claim belongs to I02b tests.

## One implementation leaf and evidence contract

**Interfaces consumed:** mapping declarations plus public evaluator in integration tests; no implementation edits to it. **Interfaces produced:** exact functions/DTOs above for future I02c/I03. Worker owns the four new paths only, assigned ticket, one fresh claim. Root creates the implementation ticket dependent on independently accepted LUX-27 and integrated LUX-26; root assigns before launch. Independent review accepts the source worktree first, then a distinct ordinary integration ticket verifies the landed main SHA; no circular dependency on future replay/runtime delivery.

- [ ] Write failing tests importing the six new functions and limits. Include the concrete scenarios below, save red output proving the new module/exports are absent on the recorded baseline.
- [ ] Implement descriptor-safe admission and normalizer, exact DTO schema/counter invariants and capacity/error checks in `timeline.mjs`; mirror exported readonly contract in `timeline.d.mts`.
- [ ] Implement ordered ingress and source authority transitions, run their focused tests, then implement steps/frame construction/reset and run all timeline tests. Keep each input unchanged on thrown error; use local candidate state and commit only the returned frozen result.
- [ ] Run existing I01/I02a/parameter regression suites together with new tests and strict declaration fixture. Inspect exact diff scope/whitespace, record artifact hashes and source commit, then submit with remaining fresh-review/root-integration steps; stop session.

The test file defines deterministic fixture helpers with exact values, not random UUIDs: target `{sceneId:'10000000-0000-4000-8000-000000000001',nodePath:[],controlId:'gain'}`, source A=`{sourceId:'a',signalId:'level'}`, event tuple `{sourceId:'a',signalId:'note'}`, B=`{sourceId:'b',signalId:'note'}`; both authorities generation0 connected true calibrationId `cal0`; epoch0,start0; event payload `{type:'note',values:[60,0.5]}`. Canonical control definition is number gain/default0/min0/max1/changeCost `live`, label `Gain`, as confirmed in both baseline mapping suites. Base gain0, hostValues empty. Use helper `event(source,sequence,timestampMs)` to construct the exact version1 epoch0 generation0 calibrationIdcal0 event envelope; no hidden clock. Equivalent continuous helper selects kind/value instead of payload.

A first red/green test can use this complete API-level fixture (the final suite expands every table case):

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveInputState, admitLiveInputs, stepLiveInputs } from '../../packages/inputs/src/timeline.mjs';
const note = { sourceId: 'a', signalId: 'note' };
const definition = { version: 1,
  sources: [{ sourceId: 'a', generation: 0, connected: true, calibrationId: 'cal0' }],
  signals: [{ source: note, kind: 'event' }] };
const event = sequence => ({ version: 1, epoch: 0, source: note, generation: 0,
  calibrationId: 'cal0', sequence, timestampMs: 0,
  kind: 'event', payload: { type: 'note', values: [60, 0.5] } });
test('identical events at zero each consume once', () => {
  const initial = createLiveInputState(definition, 0, 0);
  const admitted = admitLiveInputs(initial, 0, [event(0), event(1)]);
  const step = { timeMs: 0, authority: 'studio', base: [], hostValues: [] };
  const first = stepLiveInputs(admitted.state, step);
  assert.deepEqual(first.events.map(row => row.envelope.sequence), [0, 1]);
  assert.deepEqual(first.events.map(row => row.ingress), [0, 1]);
  assert.equal(first.state.counters.acceptedEvents, 2);
  assert.equal(first.state.counters.consumedEvents, 2);
  assert.equal(initial.counters.received, 0);
  assert.equal(stepLiveInputs(first.state, step).events.length, 0);
  assert.ok(Object.isFrozen(first.events[0].envelope.payload.values));
});
```
| Criterion and required setup | Exact test/expected observation | Evidence owner/stage |
| --- | --- | --- |
| Known repeated events/order | Admit A(note) seq0@0, A(note) seq1@0 with equal payload and B(note)seq0@0; step0 consumes ingress0,1,2 unchanged; repeated step0 consumes none. | Worker then fresh reviewer CPU, receipt and step assertions at exact source SHA. |
| Source-wide authority | A(level)seq5@10 then A(note)seq4@10 rejects sequence; seq6@9 rejects timestamp, seq6@10 passes. Wrong generation1 cannot promote current0. Changing authority to generation1 flushes old queue/held values; old0 rejected, new1 seq0 accepted. Stop/reconnect same-generation change throws. | Admission/source-change tests, explicit counters and unchanged input checks. |
| Clock admission | now10: ts11 rejected future with no cursor advance; retry seq0 ts11 atnow11 succeeds. Backward now or step fails atomically. Tied source timestamps pass with increasing sequence. Fractional10.25 admitted exactly. | Worker/reviewer, no real clock/device evidence claimed. |
| Boundary zero/late | Initialstep0 consumes pre-admittedzero once. Admit anotherzero afterstep0; repeatedstep0 none, step1 consumes it. Age100 admitted/consumed, age100.001 rejected at ingress or discarded after acceptance on a later step. Already-closed timestamp within lateness executes next advancing step. | Exact accepted/rejected/discarded/consumed counts and originals, no lower-window loss. |
| Cross-source eligibility | Admit A timestamp20 before B timestamp10 atnow20; step10 consumes B ingress1, retains A ingress0; step20 consumes A. Declared behavior demonstrates why replay records step placement too. | Known answers independent of implementation sorting. |
| Capacity and fairness | Accept256 events timestamp0. Envelope257 rejects overflow, earlier256 retained; retry same sequence rejects sequence. Step0 consumes32; step50 consumes32; step101 discards remaining192 as late, consumed budget unaffected by late scans. Separate mixed future/due queue proves future entry never head-blocks eligible later ingress. | Worker/reviewer CPU bounds; counters satisfy identities. |
| Continuous/coalescing | A(level)seq0 value0@0, seq1 value1@10 in one ingress call yield two acceptance receipts, one held value, coalesced1. Step10 emits1. At510 stillfresh,510.001 absent/expired1. A future-to-step latest sample is withheld, never replaced with invented history. | Frame known-answer assertions; no provider latency claim. |
| Normal workload | 200 repeated events at `i*50` ms, seqi, on one source; ingress batches aligned before the next explicit step `k*(1000/60)` through10000ms; exactly200 received/accepted/consumed, none rejected/discarded. | Deterministic CPU scheduler fixture with explicit numeric times, no wall-clock timing gate. |
| Mapping handoff | Establish mapping state with held0, then held1 with100ms delta andtau100; combined candidate evaluation yields `1-Math.exp(-1)` within1e-12. Two bindings sharing tuple with distinct exponents/taus retain I02a known answers. A mapping failure leaves caller's prior timeline AND smoothing state selected unchanged; next valid attempt consumes same event IDs once. | Call existing evaluator, not copied math; worker/reviewer inspect candidate commit protocol. |
| Reset/freshness identity | Reset toepoch1 retains counters and clears queue withreset reason; oldepoch0 envelopes reject; firststep atnewstart consumed once. Generation transition between two steps prevents old smoothing reuse. Changed definitions require reset. | Exact receipts/state and evaluator integration assertions. |
| Hostile data/limits | Getters never execute; symbols/nonenumerable/sparse/cyclic/exotic/null cursor mismatch/unknown fields fail. Exercise64/65sources,256/257signals/batch/events,16/17payload values, unsafe counters/sequences, NaN/Infinity, duplicate cursors/ingress/tuples, contradictorycounter totals. Byte/depth/field limits preflight before cloning offending descendants. | Counter/getter probes, raw unchanged snapshots, bounded errorcode/path. Document stricterlimit dominance. |
| Exhaustion/types/preservation | Valid synthetic state at safe-counter/ingress maximum rejects the next increment atomically. Exercise all DTO imports/function arguments, readonly/narrowing and negative shape/version cases. Original mapping tests pass unchanged; no new exports silently added there. | Ignored declaration fixture + strict pinned compiler output; source diff review. |

Focused run from exact worker checkout:

```powershell
& 'C:/Program Files/nodejs/node.exe' --test tests/unit/input-timeline.test.mjs tests/unit/input-timeline-admission.test.mjs tests/unit/input-mapping.test.mjs tests/unit/input-mapping-admission.test.mjs tests/unit/timed-input-mapping.test.mjs tests/unit/timed-input-mapping-admission.test.mjs tests/unit/parameters.test.mjs
```

Use existing pinned TypeScript for an ignored explicit-file strict NodeNext declaration fixture; inspect installed version/path before execution. Where actual TypeScript7.0.2 requires `--ignoreConfig` for this explicit-file audit, use that bounded correction and record it; do not alter project tsconfigs. No dependency installation just to check declarations. Raw evidence records exact command, tool version, working directory, commit, executor/session/host and every expected/actual result. The fresh reviewer repeats meaningful boundaries and checks trace provenance. Root compares all four source files at the landed target SHA and reruns the combined command there; CPU success proves this internal contract only.

## Planning review and handoff

Self-review covers source/tuple ordering, generation authority, original envelopes, bounded ingress/history/counters, coalescing, repeated events, live lateness/freshness, one-time zero, reset and mapping ownership. Accepted-versus-consumed distinction and controlled replay's separate effective placement/provenance gate remain explicit. No implementation or independent approval is claimed by this plan. Root must request fresh critique against the full plan commit/hash and preserve findings plus versioned dispositions before assigning implementation.
