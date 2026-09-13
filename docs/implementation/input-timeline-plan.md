# Deterministic input timing, smoothing and replay

Planning revision 2 for LUX-17. Baseline main `aca4d38c69c71ef2e6f0b71b171163e8fe836ee0` includes independently accepted I01 source `fab83026c7baadb845bb6617c355dc6c6df421db`. Root coordinator is the planner; this document requires a fresh independent critique before any implementation dispatch. It introduces no runtime, device, Studio, SDK or saved-project capability. Revision 1 at `22a20ade78b2523338b0a225d27890f28782a33b` is preserved; revision 2 addresses the independent numeric-edge finding and requires exact recheck.

The governing scope is [I02 in the creative inputs plan](creative-inputs-plan.md). Current code consists only of `packages/inputs/src/mapping.mjs` and its declarations. It validates a complete base snapshot, applies macros before modulation, handles explicit host-owned targets, clamps once and returns detached frozen traces. Its two functions are stateless version 1. Range shaping and combination currently live inside `evaluateNumericMappings`; they must have one implementation when timed evaluation is added. `packages/runtime/src/clock.ts` and `seed.ts` remain their owners' code and are not edited here.

## Delivery sequence and choices

I02 is split into three reviewable leaves. This makes the first change independently testable while preserving the full timeline/replay deliverable:

| Leaf | Deliverable | Dependency and boundary |
| --- | --- | --- |
| I02a | Version-2 per-binding timed mapping, explicit detached state, shared version-1 arithmetic | Detailed below; depends on integrated I01. No clock, events, provider or runtime adapter. |
| I02b | Bounded continuous/event timeline with generation, sequence, timestamp, ingress order, freshness and reset | Depends on I02a interfaces. Requires its own exact envelope/state/error plan and independent review before coding. |
| I02c | Deterministic admitted-order replay and fixture identity | Depends on I02b. Requires a focused fixture schema/time-zero/cursor/hash plan before coding. |

Alternatives considered: putting smoothing into one source signal would incorrectly combine bindings with different curves/constants; applying it after target combination would change the approved contribution order. This plan keeps smoothing after each binding's shaping and before its replace/add/multiply operation. A hidden cache would prevent explicit reset/replay ownership, so state is passed and returned as data. A synchronous exact normalized-plan key avoids introducing async hashing or an externally trusted plan-ID convention in this first leaf. This key is an equality token, not a cryptographic identity or wire/persistence format.

## I02a exact files and API

Modify only `packages/inputs/src/mapping.mjs`, `mapping.d.mts`, and the existing two I01 tests if needed for shared-path regression coverage. Create only `tests/unit/timed-input-mapping.test.mjs` and `timed-input-mapping-admission.test.mjs`. Do not change package manifests, lockfiles, shared test/typecheck configurations, runtime-contracts, SDK/compiler, workers, project storage or other workstream files. The existing Node unit glob discovers the new files. Ignored type fixtures and raw logs are evidence, not shipped files.

Add these internal exports while preserving the exact existing version-1 exports and results:

```ts
export type BindingSmoothing = Readonly<{ bindingId: string; tauMs: number }>;
export type TimedMappingPlan = Readonly<{
  version: 2;
  mapping: NumericMappingPlan;
  smoothing: readonly BindingSmoothing[];
}>;
export type TimedSignalValue = Readonly<{
  source: SourceRef; generation: number; value: number;
}>;
export type TimedMappingFrame = Readonly<{
  epoch: number; deltaMs: number;
  authority: 'studio' | 'host';
  base: readonly InputValue[];
  signals: readonly TimedSignalValue[];
  hostValues: readonly InputValue[];
}>;
export type TimedBindingState = Readonly<{
  bindingId: string; sourceGeneration: number; value: number;
}>;
export type TimedMappingState = Readonly<{
  version: 2; planKey: string; epoch: number;
  bindings: readonly TimedBindingState[];
}>;
export type TimedBindingTrace = BindingTrace & Readonly<{
  shaped: number | null; smoothed: number | null;
}>;
export type TimedTargetTrace = Omit<TargetTrace, 'bindings'> & Readonly<{
  bindings: readonly TimedBindingTrace[];
}>;
export type TimedMappingResult = Readonly<{
  version: 2; values: readonly InputValue[];
  traces: readonly TimedTargetTrace[]; state: TimedMappingState;
}>;
export function normalizeTimedMappingPlan(input: unknown): TimedMappingPlan;
export function createTimedMappingState(plan: TimedMappingPlan, epoch: number): TimedMappingState;
export function evaluateTimedNumericMappings(
  plan: TimedMappingPlan, frame: TimedMappingFrame, state: TimedMappingState,
): TimedMappingResult;
export const timedMappingLimits: Readonly<{
  metadataBytes: 262144; stateBytes: 524288; maxDeltaMs: 60000; maxTauMs: 60000;
}>;
```

All data, including supposedly normalized plans and states, is revalidated. Reuse I01 descriptor-safe bounded capture and scalar/target/source validation by factoring private helpers, not copying a second admission/evaluation implementation. Preserve I01's exact 256-KiB raw UTF-8 admission and existing error behavior. Version-2 plan/frame inputs each have the same 256-KiB raw bound; state has a separate 512-KiB bound because it contains a bounded plan key. Count/depth/string bounds precede copying or JSON encoding. Ordinary records/dense arrays/own enumerable data fields only; no symbols, accessors, exotic prototypes or shared mutable storage. This does not promise proxy-trap immunity or a safe realm after arbitrary intrinsic modification.

The nested mapping is a valid version-1 plan. Smoothing must contain exactly one entry for every mapping binding, no extras/duplicates; normalize its order to the binding array. Each tau is finite in `[0,60000]` milliseconds. Version-2 metadata may reject a raw input whose extra smoothing fields exceed its own bound even when the nested I01 object alone would fit; there is no widening of I01 admission. Sources/targets/bindings retain I01's independent count and identity limits.

Epochs and source generations are nonnegative safe integers. Delta is finite in `[0,60000]` milliseconds, negative zero normalized. The caller supplies elapsed evaluation time; no private timer, wall clock or simulation advance occurs. A larger gap requires a caller-chosen new epoch/reset rather than silent clamping. This leaf does not calibrate device clocks, infer current source generation or reject out-of-order provider envelopes; I02b owns those facts before producing a timed frame.

The plan key is `JSON.stringify` of the fully detached normalized timed plan, using its constructed field order and normalized smoothing order. It is bounded by the normalized plan's encoded size, at most 256 KiB. State validates a bounded string key, valid epoch and at most 256 unique canonical binding IDs with safe source generations and finite values. A mismatched plan key or epoch invalidates all prior entries atomically; an invalidly shaped/oversized state is rejected, never treated as an implicit reset. With a matching key/epoch, unknown binding IDs fail. Entry order in returned state follows mapping binding order. Equal normalized plans reuse state; any semantically represented plan change resets it. Label-only changes may conservatively reset state; no claim that this is the final persistence identity.

## Evaluation semantics and ownership

Normalize the plan/frame/state before evaluating; keep caller data unchanged on every failure. The complete authored base, explicit host subset, signal tuple uniqueness and finite intermediate policy remain I01's contract. Timed signals add a generation field. One source tuple has one current value/generation per frame, but two bindings using it have separate smoothing entries.

For an enabled resolved binding on a target without host ownership, compute the exact I01 shaped contribution using one shared private helper. Then:

```js
// previous exists only for the same plan key, epoch, binding and source generation.
let smoothed;
if (!previous || tauMs === 0) smoothed = shaped;
else if (deltaMs === 0) smoothed = previous.value;
else {
  const ratio = requireFinite(deltaMs / tauMs);
  const alpha = requireFinite(-Math.expm1(-ratio));
  const difference = requireFinite(shaped - previous.value);
  const adjustment = requireFinite(difference * alpha);
  smoothed = requireFinite(previous.value + adjustment);
}
// requireFinite uses the existing bounded INVALID_INPUT_MAPPING error policy.
```

First valid sample initializes to the shaped contribution, even at zero delta. Existing state with zero delta retains its prior value unless tau is zero; this short circuit occurs before ratio or difference arithmetic, after valid shaping. A tiny positive tau is legal plan data, but an existing-state positive-delta evaluation whose ratio overflows deliberately fails atomically rather than accepting `expm1(-Infinity)` as implicit saturation. This follows I01's distinction between finite admitted operands and finite evaluated intermediates. First-sample/tau0/zero-delta branches never calculate unused ratios or differences. Tests include `tauMs=Number.MIN_VALUE, deltaMs=60000` with existing state (bounded error), tau0 (instant shaped value), and delta0 with finite opposite extreme previous/shaped values (exact retention without subtraction). A generation change clears that binding's history and initializes from the new sample. This is explicit reset behavior; timeline admission, not this evaluator, determines which generation is current. Disabled, unresolved-source and host-owned bindings produce no new state entry, so re-enabling/reconnecting/releasing host authority starts clean. They retain their existing status and null shaped/smoothed/mapped fields. Host-owned targets still bypass even overflowing competing Studio arithmetic.

Combine the smoothed contribution using the same replace/add/multiply helper and phase order as I01, then perform the same single final clamp. A timed applied trace has `shaped` equal to the pre-smoothing contribution, `smoothed` equal to the actual contribution, and inherited `mapped` equal to `smoothed`. Its before/after values show target accumulation. I01 trace fields and version remain unchanged. Return deeply frozen detached results/state; no Map, Set or typed-array storage is exposed. Invalid arithmetic rejects the entire result and leaves the previous state intact. A caller can construct its own valid numeric state; this library does not confer authority or provenance on it.

## I02a implementation and acceptance

The fresh worker records its exact integrated baseline and confirms these six paths are unowned. Add independent known-answer and admission tests first, retain the failure before new exports exist, then factor the shared I01 math/admission and implement the new functions. Avoid general cleanup unrelated to the timed seam. An ignored TypeScript usage fixture must exercise every new exported DTO, readonly members and invalid version/generation/shape types without editing shared configs.

| Criterion | Setup and method | Expected observation and evidence |
| --- | --- | --- |
| I01 preservation | Existing mapping/admission/parameter suites against exact patch | All original tests pass; version-1 output fixtures identical, no smoothing fields or altered quotas. Source review confirms one shaping/combination implementation. |
| Numeric smoothing | Initialize zero, then hold shaped value one with tau100ms and dt100ms; independent expected `1-exp(-1)` | Approximate equality within `1e-12`; another100ms yields `1-exp(-2)`. First sample, tau0 and dt0 rules checked separately. |
| Per-binding independence | Same source, two distinct bindings with exponents1/2 and tau100/200ms; seed prior zero state via a valid initial sample, then sample0.5 for100ms | Contributions `0.5*(1-exp(-1))` and `0.25*(1-exp(-0.5))`; correct ordered combination and trace values. No shared per-source smoothing accumulator. |
| Deterministic trajectories | Compare100ms to two50ms evaluations with the same held shaped input and identical initial state; include piecewise change boundaries | Same final state/value within tolerance. Different sampling trajectories are not claimed equivalent. Repeated evaluation with identical explicit inputs reproduces equal detached output. |
| Reset/invalidation | Changed plan key, epoch, source generation, disabled/missing source, host acquisition/release | Exact documented reset/initialization; no stale held value after absence or owner change. Unknown entries under matching identity reject. No timer or external generation inference. |
| Atomic failure and bounds | Descriptor counters, duplicate/unknown fields/IDs, negative/unsafe generation, NaN/infinity, dt/tau bounds, exact UTF-8 limits and finite-but-overflowing state arithmetic | Reject with bounded `INVALID_INPUT_MAPPING` path before executing getters or returning partial state. Caller plan/frame/state snapshots unchanged. Valid boundary sizes pass and next byte fails. |
| Types and delivery | Pinned Node24.12.0 focused tests; strict explicit-file declaration fixture using existing TypeScript, whitespace/scope/hash checks | Exact command outputs/source SHA recorded by worker; fresh reviewer independently checks relevant tests and code. Root records later landed-main verification separately. |

Focused command uses the worker's exact checkout:

```powershell
& 'C:/Program Files/nodejs/node.exe' --test tests/unit/timed-input-mapping.test.mjs tests/unit/timed-input-mapping-admission.test.mjs tests/unit/input-mapping.test.mjs tests/unit/input-mapping-admission.test.mjs tests/unit/parameters.test.mjs
```

No GPU/device/native/runtime test belongs to I02a. Source acceptance requires the exact worktree commit and fresh independent review; it does not wait on root integration. Root must verify its landed SHA before I02b consumes the API.

## I02b and I02c retained requirements

These are subsequent preparation inputs, not implementation-ready DTOs. I02b must freeze the source envelope with source/signal identity, generation, safe sequence, monotonic calibrated timestamp, continuous/event kind and bounded payload. Preserve equal repeated events, reject backward per-source sequence/time as specified, assign cross-source ingress order, and keep originals for replay. Continuous samples may coalesce; events may not. Bound256 queued events,32 per step,100ms live lateness and500ms continuous freshness, with explicit overflow/newest rejection, stale-generation and drop reasons/counters. Reset clears old queue/held state and smoothing epoch while caller-authoritative base/seed remains external. Publish a deterministic timed frame for I02a; do not create a second RuntimeClock.

I02c must freeze a serialized admitted-order fixture plus exact version/hash/seed/configuration provenance, cursor/reset semantics, `(previous,next]` event windows and a one-time time-zero initialization batch. Controlled replay executes every required interval or fails a bounded job; no live lateness discard. Seek/reset invalidates old epochs and reproduces equal event identities and separate binding states. Tests must distinguish accepted events, dropped events and consumed events, and make repeated identical notes observable. Neither leaf may claim actual MIDI/audio ingress, a runtime adapter or saved-project behavior.

I03 will adapt these contracts to runtime identity/generation/clock epochs after component/runtime ownership review. I05 will provide deterministic tempo/phase/LFO/curve sources and later device lifecycle with separately reviewed DTOs. I06–I09 retain UI, persistence, capture and release handoffs from the whole inputs plan. No later slice can silently weaken this state's timing/authority boundaries.

## Review request

Review the exact source baseline, API completeness and bounds, reusable I01 math, state identity/reset semantics, per-binding known answers, zero-delta/first-sample/host transitions and whether the three-leaf sequence preserves all I02 requirements. Root authored this revision; a separate fresh reviewer must identify significant gaps and verify dispositions before the first timed implementation ticket is dispatched. Planning includes no application-code change or performance claim.
