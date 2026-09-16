# Tempo Clock Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify the pure manual/tap tempo clock that later Studio wiring can consume without touching shared animation contracts, runtime dispatch, persistence or UI.

**Architecture:** A dependency-free factory owns BPM, phase anchors, tap history and acknowledgement sequence. It receives visual time explicitly from the existing `RuntimeClock` and samples an injected monotonic millisecond function only for taps. Frozen snapshots and acknowledgements expose all behavior needed by later worker integration.

**Tech Stack:** JavaScript ESM, TypeScript declarations, Node test runner, `node:assert/strict`.

**Spec:** `docs/design/manual-tap-tempo.md`

## Global Constraints

- BPM is finite and ranges from 20 through 300; default is 120.
- Tap intervals from 200 through 2000 milliseconds are accepted; keep the newest four and use their arithmetic mean.
- An interval below 200 milliseconds returns `ignored-short` without changing accepted tap time, history, BPM or phase.
- An interval above 2000 milliseconds starts a new sequence, returns `restarted`, rephases beat zero and keeps BPM.
- Manual BPM changes preserve current beat position and clear tap history; same-BPM writes still increment the acknowledgement sequence.
- Reset keeps BPM, clears tap history and establishes beat zero at the supplied visual time.
- No shared evaluator, runtime contract, persistence, dispatch, MCP or UI file changes belong to this slice.

---

### Task 1: Pure tempo clock and tap window

**Files:**
- Create: `apps/studio/src/controls/tempo-clock.mjs`
- Create: `apps/studio/src/controls/tempo-clock.d.mts`
- Create: `tests/studio/tempo-clock.test.ts`

**Interfaces:**
- Consumes: `nowMs(): number` for monotonic tap samples and caller-supplied `timeSeconds` from the existing visual clock.
- Produces: `createTempoClock({nowMs,bpm?,tempoSequence?})` with `snapshot(timeSeconds)`, `setBpm(bpm,timeSeconds)`, `tap(timeSeconds)` and `reset(timeSeconds)`.
- Produces snapshots `{bpm,beatPosition,beatPhase,tempoSequence}` and command acknowledgements that add `tempoResult`.

- [ ] **Step 1: Write failing validation and phase tests**

Add tests that import `createTempoClock`, assert the default 120 BPM snapshot, literal beat positions at 0.5 and 1 second, phase-continuous change from 120 to 60 BPM, same-BPM acknowledgement sequencing, reset to beat zero, and rejection of BPM 19, BPM 301, nonfinite BPM, negative/nonfinite visual time and unsafe initial sequence.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/studio/tempo-clock.test.ts`

Expected: FAIL because `apps/studio/src/controls/tempo-clock.mjs` does not exist.

- [ ] **Step 3: Implement the minimal validated clock**

Implement the factory with frozen outputs. Derive `beatPosition = anchorBeat + (timeSeconds - anchorTimeSeconds) * bpm / 60` and normalized phase `((beatPosition % 1) + 1) % 1`. Validate every external number before mutating state. Increment `tempoSequence` on every admitted set command; return `applied` or `same-bpm`. `reset` keeps BPM and sequence, clears tap history, and anchors beat zero.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/studio/tempo-clock.test.ts`

Expected: validation and phase tests PASS.

- [ ] **Step 5: Add failing tap-window tests**

Add literal tests for first-tap restart, paused tapping, accepted 500/1000 ms intervals, newest-four mean eviction, 199 ms ignore without advancing the accepted timestamp, 2001 ms restart, rejection of negative/nonfinite/backward monotonic samples before mutation, per-command sequence increments, and fresh constructor state with an injected BPM/sequence for replacement synchronization.

- [ ] **Step 6: Run the focused test and verify RED**

Run: `node --test tests/studio/tempo-clock.test.ts`

Expected: FAIL because tap behavior is not implemented.

- [ ] **Step 7: Implement the minimal tap window**

On first tap or a gap above 2000 ms, clear intervals, store the accepted sample, anchor beat zero at visual time and return `restarted`. Ignore gaps below 200 ms without updating accepted tap time or phase. For accepted gaps, append and retain at most four intervals, set BPM to `60000 / mean`, reanchor beat zero and return `accepted`. Increment sequence for every admitted tap, including ignored taps.

- [ ] **Step 8: Refactor and verify the independent slice**

Run:

```text
node --test tests/studio/tempo-clock.test.ts
npx tsc --noEmit
git diff --check
```

Expected: all tests and type checking pass with no diff errors.

- [ ] **Step 9: Commit the independent implementation**

Stage only the plan, tempo-clock module, declaration and focused test. Commit with `feat: add deterministic tempo clock core`.
