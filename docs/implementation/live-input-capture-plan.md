# Live input capture and import implementation plan

> **For agentic workers:** Use `superpowers:executing-plans` for one assigned, independently reviewed leaf. Root dispatches fresh workers and reviewers and serializes integration. This plan creates no worker, recorder or runtime authority. Steps use checkbox syntax.

**Goal:** Preserve a bounded live input policy transcript with original receipts and effective consumption placement, and verify it independently through the actual I02b/I02a APIs.

**Architecture:** A pure canonical importer reconciles a supplied transcript first. A separately reviewed recording adapter must collect that transcript at the owner's atomic publication boundary. Later runtime execution and pixel pairing consume verified data through a separate live replay contract; the existing scripted fixture and cursor remain unchanged.

**Tech stack:** Existing ESM JavaScript, readonly `.d.mts`, Node24.12.0 built-in tests, Web Crypto SHA-256 and pinned TypeScript7.0.2. No installation or network work.

**Spec:** [creative inputs](creative-inputs-plan.md), full I02/I03 and authority constraints; [live timeline](live-input-timeline-plan.md); [controlled replay](controlled-replay-plan.md), especially I02c3; [scripted cursor](scripted-replay-cursor-plan.md). This is LUX-67 specification2, plan revision1, at isolated base `9e7c9413843dc3fb8def7b5d81c7cc15fc7b640e`, branch `codex/live-input-capture-plan`. I02c2 integrated as `0725c7d6fed9969d1f43a46852049e6218c3ce1e`; its reentrant stale-publication fix stays untouched.

## Authority and delivery limits

The current user grant covers autonomous routine planning, independent review and serial integration across four roadmap workstreams. This ticket writes exactly this Markdown file and bounded local CPU evidence. It performs no source implementation, device access, capture pixels, persisted runtime recordings, Studio/public SDK/native/portal work, dependency installation or network operations. Evidence files are throwaway planning probes, not captured user sessions or runtime recordings. LUX-7 remains policy-stopped. Source checkpoints are historical; current Conductor claims and root reservations remain authoritative.

Visual parameters remain visual-owned. No implicit intensity parameter, second clock, source authority registry, hidden device reconnect, alternative mapping math or filesystem writer is introduced. A byte digest establishes identity of supplied bytes, not real hardware provenance, truthful collection, application of events, an installed runtime, or matching pixels. A caller can fabricate a perfectly self-consistent policy transcript; verification does not make it an authority capability.

## Existing witnesses and observed limitations

All observations below are from actual exported owner functions at the exact base. Planning artifacts live in `C:/Users/zFlei/repos/lux/.worktrees/_coordination/LUX-67/`. `feasibility.mjs` imports the assigned checkout via `pathToFileURL`; `feasibility-results.json` retains full actual inputs/results for six asserted groups. It ran under Node `v24.12.0`; its compact result data is 407607 bytes. No proposed importer was executed.

| Existing owner/output | What is witnessed; what is not |
| --- | --- |
| `admitLiveInputs(state, nowMs, envelopes)` | Decisions preserve every structurally valid attempted original in call/array order, including every continuous original before coalescing. Accepted records contain epoch-qualified ingress and receivedAtMs. Rejections contain originals/reasons but no ingress or receivedAtMs; their enclosing call supplies receipt time and array index. Invalid whole-batch shape throws before decisions, so no fabricated per-envelope rejection receipt exists. |
| `stepLiveInputs(state, step)` | Returns actual policy-selected events/discards and mapping frame; candidate only. A returned event is not proof of SDK or runtime consumption. Frame signals omit ingress/sequence/timestamp. Continuous contributors can be reconciled by matching the returned fresh frame against the candidate state's declared held records, but direct identity instrumentation is absent. |
| `changeLiveInputSources`, `resetLiveInputs` | Return original discarded events with `source-reset`/`reset`; counters and before/after held records identify cleared continuous samples. Source changes have no timestamp argument or timestamp receipt. Reset has explicit new epoch/start, not an observation-clock sample. |
| `evaluateTimedNumericMappings` | Owns complete base/host admission, arithmetic and per-binding smoothing. Returns values/traces/state. Only the caller can establish that timeline and mapping candidates were published together after success. |
| `RuntimeClock`, `SeededRandom` | Runtime owns injected time/playback/clock epoch and unsigned32 seed stream. Timeline epoch and source generations are different scopes. None of these functions records outer RuntimeKey, accepted revision/schema, actual commit sequence, provider calibration coefficients, output persistence or pixels. |
| Scripted fixture/cursor | Mode is exactly `scripted`, envelope timestamp equals placement, controlled execution avoids live late/overflow loss, and cursor authenticates handles plus protects publication against synchronous reentry. These rules cannot admit a live transcript by changing timestamps or dropping receipts. |

The six actual probe groups establish these literal answers:

1. Admit A seq0 timestamp20 before B seq0 timestamp10 at now20: accepted ingress `[0,1]`; step10 consumes `[1]`, retains `[0]`; step20 consumes `[0]`. Receipt time, envelope time, call order and effective step placement are separate facts.
2. Equal notes seq0/1 at zero both consume once, ingress `[0,1]`. Repeat step0 emits none. A new seq2 timestamp0 after step0 waits through another step0 and consumes ingress2 at step1.
3. Admit256 notes, then seq256 twice: `overflow`, then `sequence`. Step0 and step50 consume32 each; step101 discards192 as `late`. In a separate empty state, now100.001 with timestamp0 gives `late`, then retry gives `sequence`.
4. Continuous seq0 value0@0 and seq1 value1@10 admitted together atnow10 produce two receipts, one held record, coalesced1. Step5 has no signal; step10 emits1. At510 it remains fresh; at510.001 it expires. Final held data cannot reconstruct the earlier sample or imply it contributed at step5.
5. A continuous ingress0, A event ingress1 and B event ingress2: changing A to generation1/cal1 discards ingress1 as source-reset and clears one continuous sample. Old-generation input rejects; new-generation input is ingress3. Reset toepoch1/start1000 discards `[2,3]` as reset and next accepted ingress is0, identified by epoch1. Lifetime received becomes6.
6. Real timed mapping with tau100, previous0, new1 and delta100 yields `0.6321205588285577` within1e-12. A step candidate with missing base succeeds in timeline but fails the mapper (`INVALID_INPUT_MAPPING`). Keeping prior selected states preserves the queued ingress2 for the next valid attempt. A timeline receipt alone cannot establish a committed step.

## Chosen approach and sequencing

Choose a new `mode:'live-policy-transcript'`, version1, profile `i02b-v1`. It describes policy operations and their supplied witnesses; it never calls itself a verified live runtime capture. Timestamp-sorted conversion to scripted mode would erase eligibility/order and is rejected. Recording only events plus a final continuous snapshot would erase repeated inputs and per-binding trajectories and is also rejected.

| Leaf | Exact outcome and remaining gate |
| --- | --- |
| **I02c3a**, first implementation below | Pure bounded canonical transcript normalization/encoding/decoding, with every supplied policy witness reconciled by actual owners. No recording hooks or replay cursor. |
| **I02c3b**, separate current-owner review | Recording adapter at an actual timeline/mapping publication owner. Must preserve full receipt collection, contiguous-prefix loss status, failed/unrecordable operations, source/clock/config provenance and commit identity. Its exact files require I03 owner agreement; it cannot be dispatched from this plan. |
| **I02c3c**, separate live replay plan | Explicit live transcript execution/seek/reset contract preserving recorded committed steps, originals and event outcomes. It must define runtime epoch remapping and complete replay delivery independent of the scripted cursor. |
| I03/I08/reliability gates | Runtime cancellation/deadlines, animation versus paused evaluation, discarded simulation intervals, event application and capture/pixel pairing. Actual device/host/installed evidence remains separate. |

Changing mapping, seed, input clock calibration/domain, target catalogue or runtime owner creates a new capture segment with fresh external authority. Version1 allows source authority changes and timeline resets inside one segment; it does not silently reuse a prior mapping state across resets. Changing host/base values is supported only through complete per-step snapshots admitted by the existing mapper. Merely recording `authority:'host'` proves no permission or host origin.

## I02c3a exact four-file boundary and API

Create only `packages/inputs/src/live-transcript.mjs`, `packages/inputs/src/live-transcript.d.mts`, `tests/unit/live-transcript.test.mjs` and `tests/unit/live-transcript-admission.test.mjs`. Existing mapping/timeline/fixture/cursor owners, tests, barrels, package manifests and configs remain unchanged. Imports use exported owner APIs, never copied shaping/smoothing or live queue algorithms. This is an internal contract and needs no shipped authoring skill change.

All nested fields are readonly and all outputs detached/deeply frozen. Types below are the complete new data contract; no nominal runtime authority is implied. Import the existing referenced types from their owning `.mjs` declarations.

```ts
import type { TimelineDefinition, SourceAuthority, InputEnvelope, IngressDecision,
  DiscardedEvent, AdmittedInput, TimelineStep, TimelineCounters } from './timeline.mjs';
import type { TimedMappingPlan, TimedMappingFrame, InputValue } from './mapping.mjs';
import type { ReplaySourceConfig } from './replay-fixture.mjs';
export type LiveReceiptRef = Readonly<{ epoch: number; ingress: number }>;
export type LiveTranscriptOperation =
  Readonly<{ kind: 'admit'; observedAtMs: number | null; nowMs: number;
    envelopes: readonly InputEnvelope[]; decisions: readonly IngressDecision[] }> |
  Readonly<{ kind: 'sources'; observedAtMs: number | null;
    sources: readonly SourceAuthority[]; discarded: readonly DiscardedEvent[] }> |
  Readonly<{ kind: 'reset'; observedAtMs: number | null; definition: TimelineDefinition;
    epoch: number; startMs: number; discarded: readonly DiscardedEvent[] }> |
  Readonly<{ kind: 'step'; observedAtMs: number | null; step: TimelineStep;
    frame: TimedMappingFrame; events: readonly AdmittedInput[];
    discarded: readonly DiscardedEvent[]; values: readonly InputValue[];
    continuous: readonly LiveReceiptRef[] }>;
export type LiveTranscriptEnding =
  Readonly<{ status: 'complete'; reason: 'requested'; lostRecords: 0 }> |
  Readonly<{ status: 'incomplete'; reason: 'pending-events' | 'output-loss' |
    'owner-error' | 'quota' | 'cancelled' | 'unrecordable-input';
    lostRecords: number | null }>;
export type LivePolicyTranscript = Readonly<{
  version: 1; mode: 'live-policy-transcript'; profile: 'i02b-v1'; seed: number;
  mapping: TimedMappingPlan;
  initial: Readonly<{ epoch: number; startMs: number; definition: TimelineDefinition }>;
  clock: Readonly<{ inputDomainId: string; observationDomainId: string; unit: 'ms' }>;
  sourceConfigs: readonly ReplaySourceConfig[];
  operations: readonly LiveTranscriptOperation[]; ending: LiveTranscriptEnding;
}>;
export type LiveTranscriptSummary = Readonly<{
  operations: number; received: number; counters: TimelineCounters;
  pendingEvents: readonly LiveReceiptRef[]; heldContinuous: readonly LiveReceiptRef[];
  work: number;
}>;
export type NormalizedLiveTranscript = Readonly<{
  transcript: LivePolicyTranscript; summary: LiveTranscriptSummary;
}>;
export type EncodedLiveTranscript = NormalizedLiveTranscript &
  Readonly<{ json: string; sha256: string }>;
export function normalizeLivePolicyTranscript(input: unknown): NormalizedLiveTranscript;
export function encodeLivePolicyTranscript(input: unknown): Promise<EncodedLiveTranscript>;
export function decodeLivePolicyTranscript(json: string, expectedSha256: string): Promise<EncodedLiveTranscript>;
export const liveTranscriptLimits: Readonly<{
  bytes: 8388608; values: 250000; depth: 16; operations: 1024;
  envelopes: 8192; sourceConfigs: 256; work: 65536;
}>;
```

`observedAtMs` is a caller-supplied observation-clock witness or explicitly null. Non-null samples must be finite/nonnegative/safe-range and nondecreasing across the entire segment, including resets; null supplies no ordering proof beyond array position. Never substitute `step.timeMs` for missing observation time. Input now/step/envelope times obey the actual timeline, including separately monotonic ingress/step cursors and new-epoch reset. No global ordering constraint compares step time to ingress time: the 20/10 probe must pass. No conversion between the two named domains is inferred.

## Reconciliation and canonical admission algorithm

1. Synchronously descriptor-capture the entire input before accessing semantic fields or owners. Allow only ordinary/null-prototype records, dense ordinary arrays and finite JSON scalars including null. Reject accessors without executing them, nonenumerable extras, symbols, exotic objects, cycles, sparse/extra array keys, functions/bigints/undefined and unknown fields. Snapshot descriptor values before descendants, charge every alias occurrence. This is not proxy-trap immunity or protection against already modified intrinsics.
2. Enforce exact root/union fields and literal version/mode/profile. IDs use the owners' logical ASCII grammar and reserved-key exclusions. Seed is unsigned32, epochs/ingress/counts safe nonnegative integers. Normalize negative zero as owners do; do not round fractional times. Original means the normalized I02b envelope data, not byte-for-byte original device packets or raw malformed JavaScript objects.
3. Normalize the mapping through `normalizeTimedMappingPlan`; create initial state through `createLiveInputState` and timed state through `createTimedMappingState`. No baseline smoothing import or hidden initial evaluation. Thus an empty transcript has no base or effective control claim. Every recorded step carries complete base and hostValues. Validate exactly those through the real mapper, including host-owned bypass and Studio's empty hostValues requirement.
4. Reconstruct operation arguments in declaration field order and invoke actual owner APIs in array order. For `admit`, call `admitLiveInputs`, compare each supplied decision to the actual detached decision by exact normalized structural data (array order matters), and advance to its returned state. Preserve batch boundaries and empty batches. Receipt-attempt identity is `(operationIndex,batchIndex)`; accepted identity additionally has `(epoch,ingress)`. Rejected attempts receive no invented ingress. All envelopes, even accepted then immediately expired/coalesced continuous values, remain in this tape.
5. For `sources`, call `changeLiveInputSources`, compare exact original discarded records/reasons and retain candidate state. For `reset`, call `resetLiveInputs`, compare discarded records, adopt timeline state and recreate timed mapping state at the new epoch. These functions govern catalogue/generation validity and counter retention. Same-generation calibration changes fail. No mapper call is invented on a source transition; mapping sees missing/new-generation signals on the next recorded step, matching existing I02b ownership.
6. For `step`, call `stepLiveInputs` then `evaluateTimedNumericMappings` on its frame and the prior mapping state. Compare supplied frame/events/discards/values with these exact results, including output order and finite numeric values. Derive `continuous` in frame-signal order by matching each signal to the corresponding candidate held envelope's source/generation/value; require timestamp<=step.timeMs and the actual surviving record. Compare supplied epoch/ingress references exactly. Missing/extra/duplicate refs reject. Only after every comparison succeeds select both states together in this local verifier. There is no runtime publication, event application or recording side effect.
7. A thrown owner error invalidates this supplied success-operation transcript. The importer wraps it as bounded `INVALID_LIVE_TRANSCRIPT` identifying operation/path and returns no prefix. A *collector* encountering a real owner error must close its last committed contiguous prefix with `incomplete/owner-error`; it must not record a successful candidate or infer per-envelope rejections from a thrown batch. Arbitrary malformed input is unrecordable in this exact data format and closes with `unrecordable-input`. Recovering diagnostic call attempts is a separate adapter schema, not silently discarded evidence or a widened first leaf.
8. SourceConfigs exactly covers `(sourceId,calibrationId)` pairs in initial/reset definitions and source authority snapshots, including disconnected sources. Missing/unused/duplicate pairs reject. It uses existing flat scalar config semantics:32 entries, logical keys, strings<=256 UTF-16 units; keys and pairs sort in code-unit order. A pair has one immutable config; changes require a new calibrationId. Epoch changes do not permit reinterpreting an existing pair. These supplied declarations describe calibration/analysis configuration but do not prove any device conversion occurred. No OS binding or permission is inferred.
9. Canonical root/nested new DTO order follows the type declaration; existing mapping uses its authoritative normalizer, envelope/authority fields use declaration order, and witness arrays follow actual owner order. Compare supplied witness data without treating object insertion order as semantic; then emit the canonical constructed witness. Never sort operations, batch elements, decisions, event arrays, source declarations, signal declarations or continuous contributors by timestamp, payload or ID. Hash the transcript only, not the derived summary.
10. Derive final summary from reconstructed state, preserving lifetime counters and pending/held epoch-qualified references. Complete requires zero pending events and lostRecords0; held continuous values may remain and are explicitly listed. `incomplete/pending-events` requires at least one pending event and lostRecords0. `output-loss` requires lostRecords null (unknown) or a positive safe integer. Other incomplete reasons require lostRecords0 and may have pending inputs. Incomplete data remains importable but never qualifies as complete capture or replay. Missing ending/truncated JSON rejects; preserve raw bytes outside the importer for diagnostics.

Each accepted event has one verifiable terminal state: a particular recorded step consumption, a particular recorded discard operation/reason, or pending at end. Rejected originals are terminal at their receipt attempt. Each continuous original retains acceptance and can contribute to zero or multiple recorded steps; losing its held slot is reconciled as coalesced, expired, source/reset-cleared, or held at end using actual before/after state and counter deltas. An accepted stale continuous input may be immediately expired. Do not call any of these policy dispositions a hardware delivery acknowledgement. No extra unbounded outcome log is retained: operation witnesses and final summary are the evidence.

## Byte, work and asynchronous contracts

Preflight limits are simultaneous:8MiB raw JSON-equivalent UTF-8 bytes,250000 visited values, depth16 with root0,1024 operations,8192 total input envelopes across admit arrays,32 record fields,64-character keys and array length8192. Count delimiters, escaped keys/strings and every aliased occurrence before copying descendants. Each owner's stricter count/byte/depth rules still applies to its argument; do not widen timeline batch256, queue256, event32, source64, signal256, payload16, step delta60000 or mapper catalogue/union bounds. Config strings remain256 characters. All other schema strings have their exact ID/literal bounds. Canonical output must also fit8MiB before hashing/result return. Summary is bounded by the owner's final queue/held capacities; it is not a copied history of states.

Work is an explicit conservative reconciliation count. It does not measure time. Charge initial `1 + initialSources + initialSignals + mappingTargets + mappingBindings`. Before each operation charge `1 + currentSources + currentSignals + queuedEvents + heldContinuous + mappingTargets + mappingBindings + inputEnvelopes + replacementSources + resetSources + resetSignals`. Absent terms are 0. Charge before any owner call or witness append for that operation. Reject when cumulative work exceeds 65536. Each count comes from captured or admitted data. Check arithmetic before addition. A failed operation returns no summary or partial normalized result. Descriptor traversal has separate value and byte limits. Each owner also retains its own validation limits. These quotas do not establish a deadline or cancellation behavior.

Actual `format-probe.mjs` constructs proposed DTOs without implementing an importer. The empty transcript is432 UTF-8 bytes,29 visited values, depth3.1024 empty admit operations are79279 bytes,6173 values, depth3 and work1025, so this count boundary is reachable.32 real I02b batches of256 continuous inputs give8192 accepted,8191 coalesced and1 held; their proposed transcript is3407568 bytes,237803 values, depth8 and32 operations. Thus8192 envelopes is reachable below the other limits; add one further one-element batch to test8193 rejection. These measurements are in `format-probe.json`. Do not claim an8MiB or250000-value *valid* fixture unless its other schema/count limits also pass; malformed oversized preflight probes establish bounded rejection only. Root retains original erroneous depth-count evidence separately; the corrected assertions and this later run are the cited successful evidence.

Canonical JSON is `JSON.stringify(transcript)` after reconstruction, UTF-8 without BOM/whitespace/newline. SHA-256 is64 lowercase hex and covers originals, per-step full base/host authority and values, mapping, seed, source configurations, clock labels, operation order and ending. `TimedMappingState.planKey` stays the owner's noncryptographic equality key. The module makes no filesystem writes.

`encodeLivePolicyTranscript` completes all descriptor snapshots, owner reconciliation, canonical construction and byte admission synchronously before its first await. Only detached local data and captured digest capability cross the asynchronous boundary. Immediate caller mutation or a concurrent call cannot alter an in-flight result. `decodeLivePolicyTranscript` accepts only primitive JSON and digest strings; check string length<=8MiB before UTF-8 allocation, actual byte length before JSON.parse, and canonical string equality after admission. Duplicate keys, alternate number spelling, escaping aliases, BOM, whitespace, reordered fields, unknown mode and wrong/uppercase digest reject. Digest mismatch returns no result. Hash unavailable/rejected digest uses bounded `LIVE_TRANSCRIPT_HASH_UNAVAILABLE`; all format/owner/witness failures use `INVALID_LIVE_TRANSCRIPT`, quota failures `LIVE_TRANSCRIPT_QUOTA_EXCEEDED`. Error path<=200 and message<=512 characters; wrap owner text, do not retain an arbitrary foreign error object as a cause.

The importer is stateless: synchronous Proxy reflection may reenter another import but cannot mutate a shared selected runtime state. Do not add a global mutable current capture or accept caller callbacks. Async decode/encode results also confer no mutable handle. Future collection/cursor adapters must reject stale operation publication by authentic owner identity plus monotonically changing commit revision, checked after descriptor capture and immediately before commit; a same-epoch/same-position nested transaction still invalidates the outer candidate. Preserve the scripted cursor's existing state-identity checks and adversarial regressions unchanged.

## Recording and runtime evidence gates

The first leaf verifies a supplied contiguous prefix. It does not collect one. Before I02c3b dispatch, identify an actual exclusive owner of timeline/mapping/outer runtime state and freeze a transaction protocol in that owner's current source files. A recorder must capture every original input and attempt index before possible coalescing, operation call boundaries, source changes and observation timestamps, then record only jointly published timeline/mapping candidates as successful steps. Source/calibration/clock metadata must come from the real provider and runtime authorities, not envelope self-assertion. Required outer guards include RuntimeKey/owner generation, clock epoch, accepted revision/schema/control sequence and recording segment/commit identity; none exists in an I02b receipt today.

Recording storage cannot silently drop a row while runtime continues and later call the suffix a full session. Reserve bounded receipt space before publishing a recorded transaction or, if the owner must continue unrecorded, close the last fully retained contiguous prefix as incomplete/output-loss and stop appending to that segment. Retain producer close/flush status separately: absence of a row cannot prove a successful flush, and a self-declared complete footer cannot prove truthful collection. Quota/cancellation/owner-error/unrecordable-input retain explicit incomplete status and pending records. If no footer survives, preserve raw truncated bytes and report absence rather than repairing it into a complete file. Actual persistence is owned by the filesystem layer under its existing authority; this plan opens no alternate store.

Live replay must preserve committed operation index and effective step identity. It must not feed originals into the scripted cursor or re-sort them into timestamp windows. Original epochs/ingress remain immutable provenance; any remapped runtime epoch belongs in a separate runtime envelope. Repeated equal events and accepted-but-dropped live inputs retain distinct outcomes; replay must reproduce the recorded outcome rather than re-run live lateness against wall time. Continuous originals feed only the recorded policy operations and contributor steps; do not invent intermediate evaluations merely because a sample was received. Exact recorded deltas and source transitions reproduce the same per-binding trajectory, including two bindings with different curves/taus. Failed mapping candidates are not simulation steps.

I03 must resolve one input-evaluation versus animation clock adapter, paused redraw, fixed1/60 steps, live catch-up/discard intervals and controlled complete execution with deadline/cancellation. I08 captures require actual new frames carrying applied values/events, source hash/seed/epoch and completed step IDs. A requested snapshot attached to old pixels fails that gate. Real host/device input,200 equal note events over10seconds, zero normal-load loss, latency/installed/offline gates and host independence remain their original criteria; these local probes certify none of them.

## First implementation steps and literal known answers

- [ ] Record a fresh isolated worker checkout/base, current reviewed plan commit/hash and the owner hashes below. Confirm the four new paths are absent and source owners unchanged. Use one exact eligible Conductor claim; no shared integration or graphics reservation.
- [ ] Add the two test files with actual proposed API imports. Save missing-module setup red separately from later semantic red. Write the following empty canonical test and the receipt/step cases before implementation.

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { encodeLivePolicyTranscript, decodeLivePolicyTranscript } from '../../packages/inputs/src/live-transcript.mjs';
const empty = { version:1, mode:'live-policy-transcript', profile:'i02b-v1', seed:1,
  mapping:{version:2,mapping:{version:1,targets:[],bindings:[]},smoothing:[]},
  initial:{epoch:0,startMs:0,definition:{version:1,sources:[],signals:[]}},
  clock:{inputDomainId:'input',observationDomainId:'receipt',unit:'ms'},
  sourceConfigs:[],operations:[],ending:{status:'complete',reason:'requested',lostRecords:0} };
const literal = '{"version":1,"mode":"live-policy-transcript","profile":"i02b-v1","seed":1,"mapping":{"version":2,"mapping":{"version":1,"targets":[],"bindings":[]},"smoothing":[]},"initial":{"epoch":0,"startMs":0,"definition":{"version":1,"sources":[],"signals":[]}},"clock":{"inputDomainId":"input","observationDomainId":"receipt","unit":"ms"},"sourceConfigs":[],"operations":[],"ending":{"status":"complete","reason":"requested","lostRecords":0}}';
test('empty canonical identity is independently pinned', async () => {
  const encoded = await encodeLivePolicyTranscript(empty);
  assert.equal(encoded.json, literal);
  assert.equal(encoded.sha256, '0c25161254eb8af4f702a4dae47b28db9632741b610e9283c9c6466026bd703a');
  assert.equal(encoded.sha256, createHash('sha256').update(literal).digest('hex'));
  assert.deepEqual((await decodeLivePolicyTranscript(encoded.json, encoded.sha256)).transcript, encoded.transcript);
  assert.deepEqual(encoded.summary.pendingEvents, []);
  assert.equal(encoded.summary.work, 1);
});
```

- [ ] Add actual-owner transcript builders for the six feasibility groups. Builders may supply owner-generated witnesses but expectations must independently pin consumed IDs, order, counts, values and dispositions listed above. Mutate one witness after cloning frozen results: deleting/swapping a receipt, changing reason/ingress/receivedAtMs/value/continuous ref or moving a step must reject. Never accept a digest-only self-comparison as behavior evidence.
- [ ] Implement local descriptor capture, exact new DTO normalization, work charging and chronological owner reconciliation in `live-transcript.mjs`; mirror the complete readonly API in `.d.mts`. Existing nested semantics remain delegated to exported owners. Implement canonical encoding/verified decode with synchronous snapshot before await and bounded closed errors.
- [ ] Run focused new tests and unchanged owner regression suites, then strict declarations against this exact checkout. Exercise every union and readonly negative case; `scripted` data must fail the new API and live data must fail existing scripted APIs. Verify source preservation and four-path scope, commit tested files, submit for fresh review and stop. Root integration is separate.

| Criterion and required setup | Required literal observation / method | Responsible role and stage |
| --- | --- | --- |
| Canonical identity |432-byte empty literal and fixed SHA above; seed/config/ending/valid operation order changes identity; reordered config keys normalize identically. Wrong hash, duplicate keys and noncanonical spelling reject. | Worker then distinct reviewer at exact source SHA, raw JSON/hash and assertion logs. |
| Original inputs and placement | Actual 20/10 owner calls produce receipt ingress0/1, consumed1 then0. Equal notes stay distinct. Replacing original timestamps to force scripted windows, swapping receipts, or moving consumption without matching actual semantics rejects. | Worker/reviewer transcript and corrupted copies, exact IDs and calls; no runtime claim. |
| Drops and closed outcomes |256/257,32+32 consumed,192 discardedlate; ingresslate then sequence retry. Pending event with complete ending rejects; incomplete/pending-events accepts and lists its epoch/ingress. Incomplete output-loss accepts only positive/unknown lostRecords. Missing footer rejects. | Full probe inputs/results plus footer/error tests at candidate SHA. |
| Continuous provenance | Two originals and coalesced1 survive encode/decode. Frame at5 empty, at10 value1/ref ingress1, at510 fresh,510.001 expired. A changed continuous ref with same value rejects. Source/reset clearing and final held references accounted. | Worker known-answer tests, reviewer adversarial equal-valued sample replacement. |
| Source/config/reset | generation1/cal1 transition flushes specified originals; old generation rejects, epoch1 ingress0 distinct fromepoch0 ingress0. Missing/unused/duplicate pair or same-generation config mutation rejects. | Actual source/reset APIs, config coverage tests and unchanged owner hashes. |
| Mapping and authority | Gain tau100 expected0.6321205588285577 atdelta100; missing base fails whole transcript success-step. Host gain0.75 overrides input1 and is recorded as0.75; Studio hostValues rejects. Different base changes identity. | Real mapper, complete numeric definition, raw frames and values. No authority permission claim. |
| Smoothing identity | Use the actual timed-mapping fixture for two additive bindings on one source. Exponents are 1 and 2; taus are 100 and 200 ms. Initialize with source value 0. After 100 ms at value 0.5, contributions must equal `0.5*(1-Math.exp(-1))` and `0.25*(1-Math.exp(-0.5))` within 1e-12. The target value is their sum. Reset creates fresh mapping state. Source change adds no intermediate evaluation. | Worker plus unchanged timed regression suites. Reviewer checks the recorded steps and both contributions. |
| Bounds/preflight |1024 empty calls and8192 continuous inputs are proven reachable by planning data above; next operation/envelope rejects. Timeline256batch/64sources/256signals/16payload/max60000 delta remain effective. Bytes/value/depth malformed preflight rejects before owner calls; report any valid-bound dominance. | Worker/reviewer retain actual counts and bounded fixture construction; no exaggerated maximum claim. |
| Work exhaustion | Use one gain target, 256 disabled bindings to source a/level, one source and one signal. Queue and held samples stay empty. Initial work and each repeated step cost 260. With 251 steps, work is 65520 and passes. Step 252 would produce 65780 and must reject before its owner call. The real-owner planning fixture is 240496 bytes, 14756 values and depth 7, below the other bounds. | `format-probe.json` proves reachability. Worker and reviewer test the proposed 65536 cap at the exact source SHA. |
| Hostile and async input | Getter/toJSON count0, sparse/symbol/cycle/exotic/unknown rejects. Start encode then immediately mutate originals; output matches pre-call literal. A proxy trap reenters a separate import without changing outer captured result or creating shared state. | Raw adversarial tests; guard claims bounded to ordinary descriptor snapshots. |
| Compatibility and types | All new tests, both replay suites, timeline/mapping/parameter tests pass; declarations import/narrow all new types and reject wrong mode/readonly writes. Ten owner code/declaration hashes unchanged. | Pinned Node/TS, exact source checkout/commit, executor/session/artifacts; fresh source review then root serial integration. |

Focused command from the implementation worker's exact checkout:

```powershell
& 'C:/Program Files/nodejs/node.exe' --test tests/unit/live-transcript.test.mjs tests/unit/live-transcript-admission.test.mjs tests/unit/replay-fixture.test.mjs tests/unit/replay-fixture-admission.test.mjs tests/unit/replay-cursor.test.mjs tests/unit/replay-cursor-admission.test.mjs tests/unit/input-timeline.test.mjs tests/unit/input-timeline-admission.test.mjs tests/unit/input-mapping.test.mjs tests/unit/input-mapping-admission.test.mjs tests/unit/timed-input-mapping.test.mjs tests/unit/timed-input-mapping-admission.test.mjs tests/unit/parameters.test.mjs
```

Use existing TypeScript7.0.2 with an ignored explicit `.mts` file resolving the assigned checkout: `--ignoreConfig --noEmit --strict --module NodeNext --moduleResolution NodeNext --target ES2022`. Actual project configs are `tsconfig.json` and `tsconfig.examples-v2.json`; do not invent other names or pass `--ignoreConfig` for their checks. If resolving the installed native compiler, `getExePath.js` has a default export; require nonempty successful resolution. No dependency install. On Windows use `pathToFileURL` for ESM and exact Git `-C`/`safe.directory` plus `core.excludesFile=`. Preserve all red/setup/adversarial evidence and never mutate frozen owner fixtures without first cloning.

## Source pins, self-review and delivery handoff

The following SHA-256 pins authenticate actual source bytes read for this plan. `owners.json` separately includes all byte lengths; it and the raw probe results name exact base, host and session. The planning doc's own hash is recorded **after** commit in the submission evidence, avoiding a self-referential digest.

| Owner path | Bytes | SHA-256 |
| --- | ---: | --- |
| packages/inputs/src/timeline.mjs |21423|452806c3b9b3707cf6263bf9ff9012daf8a306b4a5f92a442a00e0cc46caac13|
| packages/inputs/src/timeline.d.mts |4064|388816ed28ab96914625442f19cf3b6b55a240f2efcedd69318959aaf29b45ed|
| packages/inputs/src/mapping.mjs |18486|c5a09e123815953fa5e04569e11f9229710901887fe8f51f507e57212356e431|
| packages/inputs/src/mapping.d.mts |4091|52c9c7248511a3ff7a26e687802d459552f2489b86ba85223942bab9fc22135a|
| packages/inputs/src/replay-fixture.mjs |14942|65569f2b5df137dcdadc1d8560bb262e7afd7fe0ad10f6a5cb2ee81070a75ee3|
| packages/inputs/src/replay-fixture.d.mts |1900|7796ee843759200474622b2c6ea21d706ec6be748db4d21c8eb4fdfa83cffaed|
| packages/inputs/src/replay-cursor.mjs |11854|3c9a52c12360f5b1d6d396251142df6709ee06e524466d18a32237f09b2a1b19|
| packages/inputs/src/replay-cursor.d.mts |2369|f56ddc66e1c162b04bcb8abdfeda0bea8370f007de3f8e275fc9257fa94d0502|
| packages/runtime/src/clock.ts |2435|aa940865afebddad8a02429de553623c5d57fd2a28ef51b022c3552413acbadd|
| packages/runtime/src/seed.ts |1040|bc213d3723fc556ef47b8ed8ef743799e13af94c16330dec919a8fc12037b35a|
| docs/implementation/creative-inputs-plan.md |51214|67acb429d39bab04ca05b6d61a51d0fb11e26ffe629077e579645ead58b5f3cf|
| docs/implementation/live-input-timeline-plan.md |34508|40b0121a8ab8efd5c2a59f292f0ad29619fdc4ce73fb1a3815210ade87361dcc|
| docs/implementation/controlled-replay-plan.md |25016|c0556351678f501636ed97410c4dcc92ec6acd10f2c08390bab33d44649c5204|

Self-review mapped every LUX-67 requirement to existing-witness audit, actual probes, the separate format, first-leaf contract/budgets, or explicitly retained adapter/runtime gate. Existing versus proposed behavior is labeled. Original order, repeated outcomes, continuous pre-coalescing originals, source/calibration/epochs, caller base/authority/clock, pending/error/loss closure and hash-truth distinction are explicit. Scripted source and reentry fix stay unchanged. No independent acceptance is claimed here.

Root must send a fresh reviewer the exact documentation commit/SHA-256 and probe hashes, full spec2 and current owner pins. Reviewer independently checks API reconciliation, schema/type consistency, literal known answers, canonical/hostile/async boundaries, reachable budgets and evidence provenance. Preserve findings/dispositions and re-review material corrections before dispatch. Next ticket proposal: **Implement bounded live policy transcript admission (I02c3a)**, parent LUX-4, dependent on independently accepted/integrated LUX-67 and current I02b/I02a; exact four files and evidence matrix above. Source review accepts that candidate; a separate root integration ticket records exact landed SHA and repeats combined checks plus owner hash comparison. This planner submits one documentation commit and stops its session; it does not claim that next leaf or integrate itself.
