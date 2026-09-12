# Task 5 independent review

Reviewed evaluator checkout commit `15ee09eb876b6c7dddfd189d23693ea8d6248762` against base `a6141d3`, the task brief/report, performance design, implementation checkpoint, and tracer acceptance. Review only; no implementation changes.

**Recommendation: address the four accounting findings below before integrating this evaluator contract.** All reproductions use the existing test's complete 60 Hz / 600-version fixture, with only the listed mutations. These are covered-core issues, independent of the deliberately unavailable hardware gates.

## Findings

### 1. [P2] Check generation transitions on empty opportunities too

Location: `packages/performance/evaluate.ts:101` (generation comparison at line 107).

The `frameId === null` early continue ignores the opportunity's generation. Changing opportunity index 100 to `{generation: 2, frameId: null, controlVersion: null}` while subsequent frames remain generation 1 produces `validity: complete`, passing cadence, freshness, and controls. Once the stream reports generation 2, consuming generation 1 again is stale evidence and violates the documented increasing-generation contract. Track the current opportunity generation independently of the last consumed frame, including empty opportunities; reject a rollback and reset frame comparison appropriately when a newer generation begins. Add a negative fixture for a restart with no frame followed by an old-generation frame.

### 2. [P2] Reconcile every versioned consumption with receipt/render causality

Location: `packages/performance/evaluate.ts:143-144` (map construction at lines 103-106).

Correlation only checks the one `rendered.frameId` selected by each control row. Other consumed frames bearing that same control version are not reconciled. Change opportunity index 29's `controlVersion` from 1 to 2: the host now consumes version 2 at 483.333 ms, before version 2 is sent/received/first rendered at 500 ms. The evaluator still returns complete with all sub-gates passing and zero latency. This is internally contradictory same-clock evidence, not unavailable driver scheduling fidelity. Validate all non-null version markers against their control receipt and rendered provenance; an earlier matching-version consumption must not be ignored because it has a different frame ID. Include early-consumption and unknown-version negative fixtures.

### 3. [P2] Permit the first consumed frame of a version to differ from its first rendered frame

Location: `packages/performance/evaluate.ts:13-14,143` and `packages/performance/README.md` controls contract.

The schema defines `rendered` as the first rendered marker, but matching requires that precise frame ID to be consumed. A latest-frame transport can legitimately skip that first producer frame and consume the next frame carrying the same exact control version. Replacing opportunity index 30 with a repeat of frame 30 / version 1 leaves version 2 first rendered in frame 31 at 500 ms and first visibly consumed in frame 32 at 516.667 ms. Host gates pass (one repeat/skip), but controls reports 599 matches and fails, although all 600 versions are visible and version 2 latency is 16.667 ms. Acceptance requires each exact **version** to appear, not every first producer frame. Extend the normalized rendered evidence to prove the actual first consumed matching frame, while preserving first-render diagnostics if desired. Merely matching the version without causal/provenance validation would leave finding 2 unresolved. Add this positive skip fixture.

### 4. [P2] Anchor the control drain deadline to the final actual stimulus

Location: `packages/performance/evaluate.ts:144-146`.

Tracer acceptance line 70 grants 250 ms **after the final stimulus**, whereas this implementation grants 250 ms after the window end. For the existing fixture, final send is 299500 ms, so its deadline is 299750 ms, but the evaluator accepts responses until 300250 ms. Reproduction: change the last 30 window opportunities to version 599; append an opportunity at 300200 ms for frame 18001 / version 600; point control 600's rendered marker to frame 18001 (render timestamp stays 299500 ms). The result passes all covered gates with 600 matches and maximum latency 700 ms. The p99 can legitimately stay zero with one late tail, so it does not enforce this deadline. Compute the deadline from the latest actual `sent` timestamp and require coverage through the necessary full measurement window and that deadline. A response after the final-stimulus drain must remain unmatched/failed. Update the README and add the late-final-tail fixture.

## Verification and scope

- `node --test --test-isolation=none tests/performance/evaluate.test.ts`: 11/11 passed.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- Four additional in-memory, CPU-only reproductions run directly against the module produced the results described above.
- Evaluator working tree was clean at review start; no evaluator source, dependency, manifest, graphics, or production protocol edits were made.
- BigInt subtraction, nearest-rank quantiles, missing-control gate failure, independent cadence, coverage/loss rejection, array count caps, and unavailable overall hardware acceptance are implemented and have useful tests. Bounded parsed decoding and raw-writer completeness reconciliation are explicitly delegated to the future normalizer; this review does not claim that the in-memory API supplies those missing collectors.
- GPU/CPU spans, UI, connection delay, callback, watchdog/recovery, overhead, workload provenance, actual host/control driver scheduling, and full hardware acceptance are expressly unavailable. Their absence is within this patch's declared scope and is not an additional finding. No hardware benchmark or graphics work was run.

## Recheck of `b30890a3170b82255d6ab94bf6dbcbcc116a501a`

The four original findings are addressed by the updated implementation and meaningful regression fixtures. Empty opportunities now advance the generation fence. All versioned consumed frames check receipt/first-render causality using immutable per-frame `renderedAt` metadata. First-version visibility can use a later frame after the initial rendered frame was skipped. The drain is final actual send +250 ms, with the boundary included. `freshRateHz` is explicitly reported and tested. The revised README describes these changes accurately.

**Recheck verdict: one remaining P2 consistency blocker.** The four original findings are closed; the following related edge needs a focused fix before approval.

### 5. [P2] Reconcile first-render markers against each other even when never consumed

Location: `packages/performance/evaluate.ts:166-167` (`observedFirstFrame` reconciliation), with registry construction at lines 97 and 114-117.

`frameControls` contains only consumed frames, so two control rows can claim incompatible metadata for the same first-rendered frame identity if that frame was skipped by the host. Reproduction on the current complete fixture: set `controls[0].rendered.frameId = '0'` and `controls[1].rendered.frameId = '0'`. Both rows now claim generation 1 / frame 0, but one claims version 1 rendered at 0 ms and the other version 2 rendered at 500 ms. Frame 0 is never consumed, so neither marker is checked against the other. The evaluator returns `validity: complete`, cadence/freshness/controls all `pass`, 600 matches, and all zero control quantiles. This is contradictory immutable frame identity evidence within the normalized input, not an unavailable hardware/provenance check. Validate metadata for all first-render control markers and consumed frames in a shared identity registry (or an equivalent independent marker reconciliation), including markers absent from the opportunity stream. Add the duplicate-unconsumed-marker fixture; it must invalidate the input.

Recheck verification:

- `node --test --test-isolation=none tests/performance/evaluate.test.ts`: 18/18 passed.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `git diff 15ee09e b30890a --check`: passed.
- Executed the additional in-memory reproduction above against `b30890a`; it produced the false pass described.
- No source, dependency, graphics, or production protocol edits. No hardware benchmark. Overall hardware acceptance remains explicitly unavailable.

## Final recheck of `cc764a2e2be4363c793252ec9e6d88891beee14e`

**Verdict: approved for integration within the bounded CPU evaluator scope; no remaining actionable review blockers.** Finding 5 is closed. All first-render markers are registered before opportunity evaluation through the same immutable identity check used by consumed frames. Conflicting version/timestamp metadata now invalidates the input even when the frame was never consumed or a control receipt is missing. The new regression tests both cases, and the existing skipped-first-frame positive case continues to pass. The README accurately documents this shared registry.

Final verification on the reviewed commit: evaluator tests 19/19 passed; TypeScript `--noEmit` passed; `git diff b30890a cc764a2 --check` passed. Working tree clean. No implementation, dependency, graphics, or production protocol edits were made during review. This closes the existing evaluator review without expanding measurement scope or initiating further telemetry work. Synthetic evaluator validation remains separate from unavailable hardware acceptance.
