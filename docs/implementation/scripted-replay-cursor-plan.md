# Scripted replay cursor implementation plan

> Root dispatches one fresh assigned conductor-worker, using executing-plans and verification-before-completion. A fresh independent review must accept this exact plan before implementation.

**Goal:** consume an admitted scripted tape completely and reproducibly, retaining authored control identity, original event order and every smoothing interval.

**Architecture:** an opaque in-memory cursor holds a verified immutable fixture and a canonical simulation checkpoint. Queries between canonical boundaries project from that checkpoint without feeding query-dependent rounding back into it. The existing timed mapping evaluator remains the only numeric policy owner.

**Stack and baseline:** existing JavaScript modules with TypeScript declarations, Node24.12.0/TypeScript7.0.2, no dependencies. LUX-51 specification2, main `b02622d23576ffb9376ce7ee853eee5e7f1c248b`; fixture source `648f1934d2388e62289df7e53e8562dfb274dd62` accepted as LUX-43 and integrated as LUX-49.

**Specs:** [controlled replay plan](controlled-replay-plan.md), [creative inputs](creative-inputs-plan.md), [live timeline](live-input-timeline-plan.md), actual `packages/inputs/src/{mapping,timeline,replay-fixture}.mjs` and declarations. No external authored base, host values or live receipt policy enters this version.

## Selected behavior and alternatives

Sampling the last continuous value of a long request erases earlier trajectories. Feeding every presentation query back into smoothing state makes floating-point results depend on redraw/request partitioning. Recomputing every request from zero avoids that dependency but repeats all historical work. Use canonical checkpoints at every distinct tape operation time, every positive multiple of60000ms up to duration, and duration itself; always include zero. A presentation-only projection never becomes a later simulation checkpoint. This preserves exact endpoint results for a fixed fixture regardless of extra presentation requests, while all math still calls the current evaluator.

All tape operations are already validated in their original order by I02c1. Do not sort equal-time operations, apply the live100ms freshness window, coalesce event multiplicity, drop to32 events, clamp elapsed time or invoke authored code. An event's stable identity is its zero-based index in the complete original operation array, including source-change/continuous operations when counting that index.

## One implementation leaf and ownership

Create exactly `packages/inputs/src/replay-cursor.mjs`, `packages/inputs/src/replay-cursor.d.mts`, `tests/unit/replay-cursor.test.mjs`, and `tests/unit/replay-cursor-admission.test.mjs`. Existing owners, package barrels, public SDK, Studio, filesystem, providers, native code and shipped skill remain unchanged. This leaf includes construction, advance, reset and seek because their epoch/transaction contract is one state machine; it does not include adapters or capture.

```ts
import type { InputEnvelope } from './timeline.mjs';
import type { InputValue } from './mapping.mjs';
declare const cursorBrand: unique symbol;
export type ScriptedReplayCursor = Readonly<{ readonly [cursorBrand]: true }>;
export type ReplayBudget = Readonly<{ evaluations: number; events: number; work: number }>;
export type ReplayCursorView = Readonly<{
  version: 1; fixtureHash: string; runtimeEpoch: number; seed: number;
  durationMs: number; positionMs: number; zeroConsumed: boolean;
  values: readonly InputValue[];
}>;
export type ReplayEvent = Readonly<{
  fixtureHash: string; operationIndex: number;
  original: InputEnvelope & Readonly<{ kind: 'event' }>;
  runtime: InputEnvelope & Readonly<{ kind: 'event' }>;
}>;
export type ReplayEvaluation = Readonly<{
  fromMs: number; toMs: number;
  reason: 'initial' | 'advance' | 'continuous' | 'sources' | 'projection';
  operationIndex: number | null;
}>;
export type ReplayCursorResult = Readonly<{
  view: ReplayCursorView; previousMs: number; nextMs: number;
  events: readonly ReplayEvent[]; evaluations: readonly ReplayEvaluation[];
  work: number;
}>;
export function createScriptedReplayCursor(json: string, expectedSha256: string,
  runtimeEpoch: number): Promise<ScriptedReplayCursor>;
export function inspectScriptedReplayCursor(cursor: ScriptedReplayCursor): ReplayCursorView;
export function advanceScriptedReplayCursor(cursor: ScriptedReplayCursor,
  request: Readonly<{ runtimeEpoch: number; previousMs: number; nextMs: number; budget: ReplayBudget }>): ReplayCursorResult;
export function resetScriptedReplayCursor(cursor: ScriptedReplayCursor,
  request: Readonly<{ runtimeEpoch: number; nextEpoch: number }>): ReplayCursorView;
export function seekScriptedReplayCursor(cursor: ScriptedReplayCursor,
  request: Readonly<{ runtimeEpoch: number; nextEpoch: number; nextMs: number; budget: ReplayBudget }>): ReplayCursorResult;
export const replayCursorLimits: Readonly<{
  evaluations: 32768; events: 8192; work: 1048576; resultBytes: 16777216;
}>;
```

The runtime handle is a frozen empty object authenticated by a module-private WeakMap; the declaration brand has no exported constructor. Cloned/fabricated/proxied/wrong-module handles fail membership before accessing any property. The original encoded-result DTO or a `sha256` field is not authority. Construction accepts primitive canonical JSON/hash only, validates epoch synchronously before awaiting, then calls actual `decodeScriptedReplayFixture` to verify bytes. No external object can mutate its fixture while hashing. This attests caller-supplied hash identity, not a trusted generator/distribution or permission to execute it.

Keep fixture, authored base, mapping state, active authorities, latest continuous sample per declared signal, canonical time/index, presentation position, zero-consumed flag and last projected values private. No persistence/import/export of mutable cursor internals. Return detached recursively frozen DTOs; retain no caller request references. `inspect` exposes only the view above. Its initial/reset values are the fixture's complete authored base, position0/zeroConsumedfalse; no implicit event processing occurs during construction, inspection or reset.

## Canonical evaluation algorithm

1. Begin with `createTimedMappingState(fixture.mapping,runtimeEpoch)`, fixture definition authorities, no continuous samples, canonical time0, operation index0. The first successful advance/seek consumes the separately defined zero batch even if its nextMs is0. Run one `initial` evaluation at delta0 using no samples and the complete hashed base, then process all time0 operations in array order. Commit zeroConsumed only after the entire successful transaction.
2. For each later canonical boundary at or before nextMs, call `evaluateTimedNumericMappings` once over the held samples from the previous canonical time to this boundary, before applying its operations. Use exactly deltaMs=to-from, necessarily0..60000 by the global grid. An `advance` row records this call. A grid boundary coincident with an operation time or duration is deduplicated; do not evaluate the same boundary twice.
3. At that boundary, a continuous operation replaces only its signal's held sample, retaining its admitted source generation and value. Immediately evaluate with delta0 and append `continuous` with its operationIndex. Same-generation smoothing retains its previous value at zero elapsed time, tau0 takes the new shaped value, and a new source generation starts from the new shaped value per the owner. No custom smoothing formula or copied shape/combination policy.
4. A sources operation replaces the full authority list. Compare each source's generation/connected/calibration tuple with the current tuple. Clear held samples only for changed sources; never expire held samples due to wall-clock age. Then evaluate once at delta0 and append `sources`, even for an identical list. The owner drops unresolved binding histories; unchanged sources keep theirs. Source membership is already fixed by I02c1 validation. An increased disconnected generation clears old samples and reconnect does not revive them.
5. An event operation appends exactly one event row at its current array position and changes no signal/mapping state. `original` preserves every admitted envelope field including originEpoch; `runtime` is a separate copied envelope differing only in epoch=runtimeEpoch. It does not map payload values into numeric signals. Both envelopes retain timestampMs=operation atMs and generation/calibration/sequence. There is no backend callback or event execution.
6. Store the resulting mapping state/held samples as the canonical checkpoint. If nextMs lies strictly after the final processed canonical boundary, call the timed evaluator once from that checkpoint to nextMs and append `projection`. Return that call's values but discard its new smoothing state. The next request still starts simulation from the same canonical checkpoint. Thus an evaluation witness may start before the request's previousMs; it describes actual repeated projection work, not an extra returned event interval.
7. Return all events in `(previousMs,nextMs]`, plus the once-only zero batch when zero was not consumed. Because a successful prior request already processed every boundary through previousMs, the operation cursor enforces this without sorting/filtering away duplicates. A repeated-time request after zero consumption returns the saved values with no events/evaluations/work. A first0→0 request consumes zero normally. No event at duration is omitted. Do not advance beyond duration.

Every evaluator frame uses `authority:'studio'`, `base:fixture.base`, `hostValues:[]`, the supplied runtimeEpoch and deterministic signals in fixture declaration order. Project only held continuous declarations whose exact `(sourceId,signalId)` pair occurs in the mapping's binding references. Use structured pair equality, not an ambiguous concatenation. The owner caps the union of binding and frame signal references at256; undeclared/unresolved mapping refs and unused timeline declarations are independently legal. Intersecting before frame construction keeps this union within the mapping's existing bound. Keep all original operations and private held samples, including unused continuous inputs, and still perform/count their specified zero-delta evaluation; this projection is not operation dropping or a reduced work charge. Event declarations are never mapped from payloads. Externally supplied values are rejected by exact request fields. The source cursor/generation validation already performed by the fixture remains immutable, so execution never promotes an envelope's generation by itself.

Always use the canonical checkpoint, not presentation values, for future smoothing. The mapping key, seed, generator, definition, sourceConfigs, complete base and operation bytes remain bound by fixtureHash; the view also reports seed explicitly for the eventual runtime. The cursor creates no RNG and consumes no generator. Bitwise endpoint equality is promised for the same actual mapping implementation/JS arithmetic and fixture when only presentation-query partition changes; cross-version/platform/GPU identity remains outside this claim.

## Atomic requests, budgets and reset

Requests are exact descriptor-safe plain own-data records, not trusted readonly types. Reject accessors without invocation, sparse/extrakey/symbol/exotic records, unknown fields, nonfinite numbers and non-safe/nonnegative epochs. Request data is tiny: at most1KiB JSON-equivalent bytes/depth3, exact outer fields and three budget fields. Normalize negative-zero times to0. previousMs must exactly equal the cursor's current position; runtimeEpoch must exactly match its current epoch;0<=previousMs<=nextMs<=duration. Fractions in milliseconds are legal. Budget counts are safe integers0..their corresponding exported limit, with equality legal; no omitted/default budgets.

Before evaluator calls or large result allocations, preflight the bounded operation array/canonical boundaries and count actual required calls/events. Charge `work = evaluations * (1 + mapping.mapping.targets.length + mapping.mapping.bindings.length)`; check multiplication safely before evaluation. Reject if any requested budget or module maximum is exceeded. This is a deterministic work-unit budget, not a CPU deadline, memory quota or cancellation guarantee. Even a repeated-time no-op validates the complete request and exact epoch/previous position; it needs zero budgets.

Use private candidate state and incremental exact JSON-equivalent UTF8 output byte accounting, checked before appending/copying each event/evaluation/value row. Include all result keys, delimiters and strings; cap result at16MiB. Fixture already obeys I02c1's8MiB/8192-op limits. The result cap can dominate a legal large fixture with duplicated original/runtime envelopes: report quota failure, not truncation. Neither a preflight nor a runtime numeric/output failure changes epoch, event cursor, canonical checkpoint, position or last values. No external callback is invoked, so atomic publication is a single final private-state replacement. Retain old immutable results unchanged.

Errors use `Error & {code:'INVALID_REPLAY_CURSOR'|'REPLAY_CURSOR_QUOTA_EXCEEDED';path:string}` with path<=200characters and bounded message. Wrong handle/epoch/position/request/time is INVALID; work/event/evaluation/result overflow is QUOTA. Existing verified fixture decode errors retain their existing codes. Existing evaluator errors propagate without committing candidate state; classify neither arithmetic overflow nor an invalid fixture as successful completion.

Reset requires exact current runtimeEpoch and nextEpoch strictly greater, both nonnegative safe integers. It atomically reinstates initial empty mapping/sample/operation state at position0/zeroConsumedfalse, preserving the same verified fixture/base/seed/hash; it does not emit events. MAX_SAFE_INTEGER has no legal successor. Future calls carrying the old epoch fail. The same live opaque handle represents the new epoch; previous returned data remains historical, not writable authority.

Seek requires current runtimeEpoch, strictly larger nextEpoch, nextMs in0..duration and exact budgets. Prepare a fresh candidate as if constructed with nextEpoch, then execute the zero batch and all canonical boundaries/projection through nextMs. It reports previousMs0 and every event replayed through the target, including zero; it does not pretend those historical events are only newly elapsed events. A failed seek retains the original cursor epoch/position/state intact. A successful seek replaces it atomically and invalidates old-epoch requests. No shortcut copies smoothing history from an old epoch; reset followed by advance and seek to the same endpoint produce identical values/events except their intentionally supplied epoch values.

## Concrete known answers and meaningful tests

Use the real NumberControlDefinition owner: `{id:'gain',type:'number',label:'Gain',default:0,min:0,max:1,step:0.01,changeCost:'live'}`, valid scene/binding UUIDs, one enabled macro replacement binding from continuous `a/value`, range0..1→0..1, exponent1/invertfalse, tau100ms; source a generation0/calibration cal0 connected. Base gain0.75 is explicit in every fixture, independent of its metadata default. Declare event `a/note` alongside the continuous signal and preserve monotonically increasing source-wide sequence numbers.

Fixture A: value0 at0 sequence0; value1 at100 sequence1; note at200 sequence2; value0 at300 sequence3; duration400. Canonical values just after100 are0; at200 are `1-Math.exp(-1)`; at300 are `1-Math.exp(-2)`; at400 are `(1-Math.exp(-2))*Math.exp(-1)` (approximately0.3180923728035784). Event identity is operationIndex2 and originalepoch0/runtimeepoch7. A request0→400 returns that event once and the same final value as0→125→200→275→400; the additional projections must not change exact endpoint bits. Compare analytic values with tight1e-12 tolerance and compare partition variants with strict equality. The known-answer formula is test expectation only; implementation still calls the existing evaluator.

Fixture B: two identical notes at0 sequence0/1, source transition at10 generation1, continuous0.6 at10 sequence0, note at10 sequence1, allsamecalibration. The first0→0 emits indices0/1 once.0→10 emits index4 only, originalepoch stays0, runtimeepoch supplied; generation1 initializes mapped gain0.6 immediately.10→10 with zero budgets emits none. Reversing transition/new-generation operations must already fail fixture admission; cursor must never repair that order.

Fixture C: value0 at0, value1 at100, disconnect generation1 at200, reconnect generation2 at250, new value0.4 at300. At200/250 unresolved source uses authored0.75; no500ms expiry or latent old sample returns. At300 new-generation history initializes0.4. Add a second source with its own binding to prove changed-source clearing preserves unrelated history.

Fixture D: operation-free duration600000 and empty mapping. A first full request uses initial plus ten60000ms advance calls (11evaluations,11work), zero events;600000ms is not clamped to60000. A nextMs600000.1 request rejects. At30000 projection then600000, ten canonical advances still run from0, not30000. Request count budgets10/11 distinguish preflight rejection/equality. State after rejection equals a fresh cursor at the original position.

Fixture E:8192 small event operations at0 survive whole request with8192eventbudget and no live eventcap;8191budget rejects before committing even the zero batch. The next correct budget still yields all8192. Add dense continuous operations to prove evaluation and work limits separately, documenting when tighter limits dominate; don't create huge expected-array diffs, assert cardinality before element comparison. Use an output-byte helper boundary fixture to test the actual shared publication guard if no fully legal fixture reaches exact16MiB under tighter shape caps; label that distinction and prove the production return path uses the guard.

Fixture F is the independent review regression: one gain target with authored0.75,256 distinct unresolved mapping source references and one unused declared continuous sample at0. Real fixture encode/decode succeeds at100032 bytes with SHA `b2aa44730510293120c28cd4e750773e1da86f0ee02d8fa7e1a6b71c02b2349b`. Forwarding that unused held sample creates a257-reference union and the actual evaluator rejects `frame.signals`. Correct referenced-declaration intersection yields an empty frame signal array and retains0.75. Cursor must still report its initial plus continuous evaluation (two calls,516work), consume the operation and allow a no-op redraw; it cannot reject the valid fixture or lower the work charge. Add a mixed referenced/unreferenced sample case and an independent source transition to ensure intersection neither drops a referenced sample nor resets unrelated smoothing. Preserve the review's original failure fixture and raw owner exception.

Root's planning probe uses the real fixture encoder and timed evaluator, with exact source imports into this worktree. Fixture A admits as2140 UTF8 bytes, SHA `a2c674607a04f56ed40eb0d7b1f24c280388bccf0a0d88d41f07c9f915f15507`; four analytic endpoints match, extra125/275ms projections preserve exact endpoint values, disconnected input returns0.75 and generation2 starts0.6. An empty600000ms schedule needs11 evaluator calls. Probe source is MAIN `.worktrees/_coordination/LUX-51-feasibility.mjs`; observations are `docs/conductor-onboarding/replay-cursor-plan-feasibility.json`. Revision2 incorporates the independent P2 finding against original plan53c4fd18; review and Fixture F reproduction remain in MAIN `.worktrees/_coordination/reviews/LUX-51/{review.md,independent-probe.mjs,independent-probe.json,legal-unmapped-fixture.json}`. These are current owner/algorithm feasibility facts, not tests of an implemented cursor or full request admission.

- [ ] Author failing imports and first exact-state/event assertions before the module exists; retain real absent-module red. Add semantic failures before implementing each behavior above.
- [ ] Implement private verified construction/inspection and exact request admission; test forged handles, async JSON/hash capture, unknown host/base fields and getter counters.
- [ ] Implement bounded canonical schedule/held-sample candidate evaluation through the real evaluator, then atomic publication. Prove event indices, projection independence, initial/transition calls, maxDelta subdivision and Fixture F referenced-signal intersection with unchanged operation/evaluation/work accounting.
- [ ] Add reset/seek epoch and budget failure tests, including failed seek leaving prior epoch/state usable; arithmetic/output error rollback; detached/frozen DTOs and unchanged original envelopes.
- [ ] Add strict declaration fixture resolving the worker checkout: opaque handle cannot be constructed, event union narrows, budget/request fields mandatory, returned arrays readonly, epoch-only runtime envelope change represented. Run both existing TypeScript configurations separately.
- [ ] Run new suites plus the existing101 replay/timeline/mapping/parameter checks. Retain exact command/source hashes and all raw negative probes. Copy-based bounded mutation tests must detect storing projection state, last-sample-only evaluation, event truncation, stale epoch acceptance and partial budget commits; restore source and verify hashes.
- [ ] Commit only the four named source/test files, submit full SHA and complete evidence matrix, release claim/stop session. Fresh independent reviewer tests an independently generated partition set and known-answer formulas; root integrates separately and reruns focused/types at exact combined main SHA.

## Evidence contract and preserved gates

| Criterion | Required setup/observation | Evidence owner |
| --- | --- | --- |
| Verified identity and authority | Real I02c1 canonical JSON/SHA plus authored0.75 base, exact original/runtime event copies; no supplied DTO can become a cursor | Worker and fresh reviewer at exact source; fixture bytes/hash and raw corruption logs |
| Intermediate numeric trajectory | Actual timed evaluator; analytic fixtures A/C and dense transitions; strict endpoint equality across extra query partitions | Worker source commands and independent generated reviewer probes, not copied expectations from cursor output |
| Complete interval/event semantics | Oncezero, `(previous,next]`, duration endpoint, equal-time indices and8192 multiplicity preserved | Bounded exact event lists and count-first comparisons; no livequeue admission substituted |
| Budgets/transaction | Real preflight equality/+1 and failure retry, arithmetic/output rollback, exact module guard at publication | Raw failure and succeeding retry showing unchanged prior state; distinguish structural cap dominance |
| Epoch/reset/seek | Fresh replay from zero with same hashed base and new epoch; stale requests reject, failedseek leaves oldstate intact | Independent reset/seek comparison and operation identities with explicit epochs |
| Compatibility and delivery | Existing101 tests plus new tests, strict worker-resolving declaration and both configs, four source hashes | Worker→fresh source review→root exact landed integration; separate executor/session/artifact attribution |

No clocks, timers, RNG, device/provider operation, real cancellation/deadline adapter, host control authority, authored execution, capture pixels or frame identity is delivered. I02c3 live capture requires its own mode/version preserving receipts, rejected/discarded inputs and actual consumption steps. I03 must join real runtime/capture/cancellation evidence; CPU query determinism does not prove it. Any author-facing surface later updates/reinstalls the repository skill. Do not weaken existing plan's physical or offline preconditions, or resume stopped native acquisition.
