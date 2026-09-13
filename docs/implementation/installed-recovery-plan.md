# Installed explicit recovery implementation plan

> **For agentic workers:** Use `conductor-worker` for one assigned leaf and `superpowers:executing-plans` for its steps. Root dispatches the fresh implementation and independent review contexts. This document authorizes neither a child launch nor native execution.

**Goal:** Prepare a same-instance installed Restart operation after a failed or suppressed attempt, retaining the immutable source and current host controls.

**Architecture:** Add a bounded, synchronous internal restart-intent ledger first. A later reviewed adapter connects that ledger to the existing serial supervisor and confirmed-stop registry; a separately reviewed authenticated native entry point and actual host evidence complete delivery. The ledger owns command admission and replay identity, not processes, fault history, controls or recovered-image truth.

**Tech stack:** CommonJS and Node's built-in test/assert modules for the first leaf; existing Electron supervisor and Windows native attachment remain later integration owners.

**Spec:** [R4 in the reliability plan](reliability-plan.md), the complete [recovery checkpoint](recovery-checkpoint.md), [runtime design](../design/runtime.md#watchdog-and-containment), and unchanged [tracer acceptance](tracer-acceptance.md). LUX-64 specification 2 uses the autonomous four-workstream grant recorded in `docs/conductor-onboarding.md` to propose the product decision below. Fresh independent review of this exact document precedes source dispatch.

## Global constraints

- Keep automatic retry eligibility based on the previous fault: first fault or a fault at least 30,000 ms later allows one retry after 250 ms; a second fault inside that interval suppresses automatic retry. Successful startup, explicit restart and elapsed time alone do not erase fault history.
- Keep 15,000 ms startup, independent 1,250 ms main/worker liveness, 4,000 ms frame/output deadlines and 250 ms supervisor polling. These thresholds are not measured physical completion.
- Preserve the original physical JavaScript stop limit of 2 seconds and explicit restart to a host-consumed reference image with current host controls within 5 seconds. CPU mocks cannot certify either limit.
- Retain source/release/runtime/descriptor/instance identity, seed and host-owned complete current control state. No compilation, source saving, release substitution, default-control replay or new author-facing SDK/parameter occurs in this slice.
- Existing registry ownership governs pending starts, forced cleanup, rejected stops, draining capacity and close. No new start while prior producer exit is unconfirmed. Multiple instances remain independent, with the existing maximum of 16 reserved instances.
- No download, installation, native build, Studio, Resolume, GPU, portal, system setting, LUX-7 retry or R2b package-input workaround is part of this planning ticket or the first leaf.

## Current source and investigation evidence

Planner `/root/installed_recovery_plan`, stable identity `b281b146-1d4f-4666-a70e-70c1706805a5`, session `640b9aa4-eb6d-44db-89c7-03acd2599d8c`, claim `bc1d804f-da64-470f-80cd-c22039675502`, isolated checkout `C:/Users/zFlei/repos/lux/.worktrees/installed-recovery-plan`, branch `codex/installed-recovery-plan`, starting commit `c0f80ed2ee81822f4f3d0c0b93710a1e711fddf7`. Evidence paths below are relative to main's `.worktrees/_coordination/LUX-64/`, outside the source commit.

| Owner | Observed responsibility | Baseline SHA-256 |
| --- | --- | --- |
| `apps/installed-runtime/src/registry.cjs` | Previous-fault retry policy, producer/start/drain ownership, monotonic reconcile clock, no explicit restart method | `3c4c865f5a16178308f56c7bbf4bc4035f6cda14a9eadd0d583740fcd0a0d35c` |
| `apps/installed-runtime/src/supervisor.cjs` | `ticking` guard serializes reconcile; per-attempt random identity; cleanup confirms Job exit; close retries rejected cleanup | `f1680f1b05d57de8d190dd003c47188d67dced1decfa6bb7e438d578decdda83` |
| `apps/installed-runtime/src/instance.cjs` | Validates immutable request/release/descriptor and binds the attempt status channel | `f026fbf727e6a68d281a5cc4baa169e6168be052d85acc75f6a249db7f7c0967` |
| `native/ffgl-source/src/InstalledActivation.h` | Creates attached instance and renews its file lease; removal deletes lease; no restart command channel | `078b3eb5928bd0050d4047cc9ffed4f2c0aed480810ce4ec9a9c1b97f12d1f76` |
| `native/ffgl-source/src/FrameReceiver.cpp` | Reconnects a replacement rendezvous and publishes current desired controls into its ring | `066f347e43a54a5ecc4e8133af295ec8a0fa08d3b0bfd4afb28f35624e8cb0d7` |

`owner-hashes.json` also records exact sizes/hashes for InstalledSource, render-host main, recovery evaluator and the three source plans. The historical checkpoint's three-total-start policy and 2.5-second main heartbeat are superseded by its later 13 September sections and the current source. Its later update-loop and initialization-hang reports retain their bounded historical physical passes; they are not fresh results of this ticket. Installed same-instance Restart remains absent.

`baseline-cpu.log` records 38 passing installed CPU tests, zero skips. `probe.cjs` and `probe.log` exercise the actual registry with fake starts: two failed starts at 0/250 ms stay suppressed at 60,000 ms, `lastFaultAt` remains 250, no restart method exists, and close waits for a pending start then stops it exactly once. No concurrent `reconcile` call was used. The actual supervisor's serial tick makes an overlapping-reconcile mock an unsupported caller experiment, not evidence of a production race.

The first broad installed test selection also included two Windows native-process cases; both stopped at `MODULE_NOT_FOUND` before loading a bridge, creating temporary directories or starting children. `baseline-installed.log` retains those two failures and 38 passes; it is not a passing native suite. LUX-P57 (`aa29879e-3fd5-4484-9a6f-544c3e60c56c`) preserves that selection error, the evidence-directory redirect failure and Windows positional-glob errors. No native build or substitute execution followed. First-leaf commands below explicitly exclude those tests.

## Scoped product decision for independent review

Select **explicit Restart of a failed attached installed instance**, including one suppressed after automatic retry. The request does not remove/re-add the source. It bypasses only that attempt's automatic scheduling suppression/delay for one explicit replacement; it does not grant a new automatic retry budget. The next actual startup/runtime fault still goes through the existing `fault` method with its previous timestamp. Simulation restarts from the existing seed; current host parameters continue through the existing native owner. Installed playback continues its existing playback mode; Studio's paused explicit recovery rule does not silently apply to installed playback.

Healthy and currently starting instances reject Restart as `NOT_FAILED`. This first product slice is recovery, not an arbitrary live reset button. A known failed producer still awaiting confirmed cleanup may accept one intent, but that intent cannot dispatch until cleanup is confirmed. No user-facing success is inferred from queue acceptance or a new producer handle. A transport retry of the identical accepted operation returns its latest receipt, without scheduling another replacement.

Alternatives considered: remove/re-add preserves today's fallback but changes attachment identity and cannot meet the same-instance action requested by this slice; clearing fault history on Restart makes repeated automatic retries possible after every manual action and contradicts Studio's retained-history policy; allowing healthy resets adds lifecycle/playback decisions unnecessary for suppressed recovery. Existing fallback guidance remains available for older immutable packages. The selection here amends the historical unresolved product question prospectively under the standing grant; it does not rewrite the old checkpoint or claim user approval of a shipped button.

## Authentication and entry-point ownership

The first leaf exposes **only an internal CommonJS capability** to trusted supervisor code/tests. It has no listener, file watcher, HTTP route, IPC handler, global registration or generated-code import. A frozen opaque handle backed by private WeakMaps identifies a queue and each attachment; JSON fields and UUID-looking strings alone cannot create that authority. This is process-local provenance, not an operating-system authentication claim.

For later native wiring, select a per-user local named-pipe channel owned by the pinned installed supervisor, with the native host attachment as client. Require a user-SID DACL, local-only clients, OS-observed client PID matching the still-live attached host, and a fresh supervisor epoch plus per-attachment nonce issued after validating the existing lease/release/descriptor. Bind the response to the validated attachment, not a caller-supplied arbitrary PID/path. Generated workers receive neither the pipe handle nor attachment nonce and no API that forwards restart bytes. A nonce in a broadly readable file is not authentication. Same-user hostile applications and same-host plugins are outside the isolation guarantee; document that boundary explicitly.

The native implementation plan must prove exact pipe flags, peer checks, lease/PID lifetime handling, bounded overlapped I/O, cancellation and packaging capability negotiation before dispatch; this document is not its implementation authority. Existing version 1/2 request DTOs and immutable packages remain unchanged in the first leaf. Old packages advertise no Restart capability. Do not add Restart as an authored numeric parameter, alter descriptor indices, or expose a Studio/MCP substitute. A later actual-host action surface must use this authenticated native capability and be reviewed with its exact FFGL/host UI semantics.

## Ordered leaves

| Leaf | Deliverable and exact gate | Owners and remaining evidence |
| --- | --- | --- |
| R4a | Internal bounded restart-intent ledger described below; source and independent CPU acceptance | Two new files only; no production call site and no recovery-delivery claim |
| R4b | Fresh plan, then registry/supervisor adapter using accepted R4a; same-tick explicit intent outranks scheduled automatic start, observed generations/attempt IDs joined | `registry.cjs`, `supervisor.cjs`, exact registry/close/drain/scan CPU suites; maintain serialized tick, confirmed cleanup and fault history; package selection still separately gated |
| R4c | Fresh exact native authentication/transport and immutable capability/version plan, then implementation | InstalledActivation, native bridge, package/register validation and source descriptor ownership; CPU malformed/replay/auth fixtures plus separately authorized native proof |
| R4d | Reviewed host action surface and serialized physical acceptance against an exact package | Source unchanged, two independent installed sources, confirmed stop, first recovered current-control pixels, source re-open and actual Resolume; 2 s/5 s gates remain unchanged |

R4b cannot infer that R4a owns native cleanup, and R4c cannot treat a development source tree as an installed package. R2b input provenance and LUX-7 remain blocked independently. Any shared file added to a leaf requires root ownership arbitration and fresh exact plan review. No first-leaf skill reinstall is needed because no author-facing behavior changes; later public SDK/MCP changes require the repository skill maintenance procedure.

## R4a: internal restart-intent ledger

Create only `apps/installed-runtime/src/restart-intent.cjs` and `tests/unit/installed-restart-intent.test.cjs`. Do not modify `registry.cjs`, `supervisor.cjs`, `instance.cjs`, native files, package validators or existing tests. Use CommonJS and built-in modules only. There are no timers, promises, callbacks, filesystem/network access, process starts, random generation or fault-policy mutations in this module.

### Identities, API and bounded admission

Export these synchronous functions, with no exported class or mutable state:

```js
module.exports = {
  createRestartQueue, attachRestart, observeRestartOwner,
  requestRestart, cancelRestart, takeRestart,
  inspectRestart, closeRestartQueue, retireRestart
};
// createRestartQueue(runtimeId, supervisorEpoch) -> opaque queue
// attachRestart(queue, identityJson) -> opaque attachment
// observeRestartOwner(attachment, observationJson, nowMs) -> frozen status
// requestRestart(attachment, commandJson, nowMs) -> frozen receipt
// cancelRestart(attachment, operationId, commandSequence, nowMs) -> frozen receipt
// takeRestart(attachment, nowMs) -> frozen effect | null
// inspectRestart(attachment) -> frozen status, never authority
// closeRestartQueue(queue, nowMs) -> frozen {closed:true, retained:number}
// retireRestart(attachment, nowMs) -> frozen {retired:true}
```

`runtimeId` is exactly 64 lowercase hex characters; `supervisorEpoch` is exactly 32 lowercase hex characters freshly generated by the future trusted supervisor on every process start. `identityJson` is a primitive UTF-8 JSON string with exactly these keys:

```json
{"version":1,"runtimeId":"<64hex>","releaseId":"<64hex>","sourceHash":"<64hex>","instanceId":"<32hex>","hostPid":42,"descriptorHash":null,"attachmentId":"<32hex>"}
```

`descriptorHash` is null for a validated legacy request or 64 lowercase hex for a validated parameter request; the later adapter owns that mapping to existing request versions. `runtimeId` must equal the queue's runtime ID. `hostPid` is a positive safe integer. The trusted attachment owner provides a fresh random `attachmentId` each time, including reattachment with the same instance ID. The ledger rejects an already-active instance ID or attachment ID within its queue, regardless of JSON equality; it does not silently coalesce attachment creation. It cannot verify randomness or OS identity. After retirement an old handle stays retired; a fresh handle never accepts the old attachment's command identity. No unbounded historical nonce set is retained.

All JSON inputs are primitive strings of at most 1,024 UTF-8 bytes (check code-unit length first, then `Buffer.byteLength`), parsed once with `JSON.parse`; accept only the exact flat shapes shown here, no arrays, extra/missing keys, nested values or non-finite numbers. Reject duplicate JSON member names by requiring exact canonical serialization equality after parsing: `JSON.stringify` in the documented field order must equal the supplied string. Thus whitespace, alternative member order, escaped spellings and duplicate keys are rejected. The native adapter must serialize canonical bytes, not forward arbitrary objects. Check primitive types before coercion. Never invoke methods/getters on caller objects; inputs to string/number parameters of any other type reject without coercion.

The queue has a fixed maximum of 16 attached handles, including failed, closing and dispatched-but-unretired attachments. No configurable unlimited mode. Each holds one pending/dispatched operation and one last receipt; the same receipt is updated in place privately, but every returned object is a fresh deeply frozen snapshot. No previous-command array, log or persistent cache. Capacity releases only at explicit trusted `retireRestart`, not cancellation, queue close or command completion. The ledger's logical cap supplements, and never replaces, the registry's actual producer/drain reservations.

All mutating calls with `nowMs` require finite nonnegative numbers at least the queue's last successful mutation time; equality is legal and negative zero normalizes to zero. Invalid/rejected calls do not advance this clock or mutate any state. JSON and primitive validation complete before checking/committing state. All successful mutating calls, including successful no-op replays, advance the queue clock. `attachRestart` has no time argument and initializes no timer. All exposed integers other than `nowMs` are nonnegative safe integers with negative zero rejected; sequence and target generation overflow reject before state change.

### Owner observation and generation contract

The later trusted adapter calls `observeRestartOwner` only from its serialized registry transition owner. JSON has this exact field order:

```json
{"generation":2,"attemptId":"<32hex-or-null>","phase":"failed_clear","operationId":null}
```

`generation` is the registry entry's monotonically increasing **attempt ordinal**, not the shared ring's output generation or the random attempt ID. First observation may use any positive safe ordinal from the actual entry; subsequent observations use the same ordinal or exactly the next ordinal. The sole zero-ordinal exception is an initial removing/removed observation with null attempt and operation IDs when no start was ever admitted; it can only advance removing to removed and allows close immediately after attachment without inventing an attempt. Every admitted automatic or explicit start, including rejected startup, increments its ordinal exactly once before awaiting startup, as current `entry.attempts` does. A random 32-hex `attemptId` belongs to that attempt; null is permitted before its identity exists or when startup failed before creating one. Once known it cannot change within an ordinal. A new generation may carry null or a fresh ID; non-null IDs cannot equal the immediately preceding attempt ID. The later adapter must retain identity at the supervisor/registry join; the current registry does not yet expose it.

Phases have these precise meanings:

| Phase | Trusted observation asserted by owner |
| --- | --- |
| `starting` | Attempt ordinal reserved; start may be unresolved; no other start allowed |
| `running` | Producer handle is owned and not known failed; non-null attempt ID required; this says nothing about ready/current pixels |
| `failed_owned` | Attempt failed and producer/cleanup ownership remains; non-null attempt ID required |
| `failed_clear` | Attempt failed, no pending start, no producer or outstanding cleanup remains; explicit dispatch may be eligible |
| `removing` | Lease removal or close owns teardown; restart is forbidden |
| `removed` | Lease is gone, pending start settled and all producer/drain ownership cleared; logical capacity may now retire |

No first observation is inferred by attaching: an unobserved handle rejects Restart with `NOT_FAILED`. Same-generation transitions are idempotent exact observations; `starting` may advance to running/failed_owned/failed_clear, running to failed_owned/failed_clear, and failed_owned to failed_clear. Any nonremoved phase may move to removing or removed; removing may move only to removed. No transition back to running or starting at the same generation. A new generation is legal only from failed_clear, and initially enters starting, running, failed_owned or failed_clear. This allows a synchronous resolved/rejected start observation without inventing an intermediate callback. Removed is terminal. Observation validation is atomic; a contradictory phase/identity/generation rejects without changing the last observation or command.

`operationId` is null or exactly 32 lowercase hex. For ordinary automatic attempts and same-generation status changes it is null. After primitive/shape/clock validation, an exact replay of the last accepted observation is an idempotent success checked before operation-state rules; this includes retransmission of an explicit admission observation after its receipt became started. Retain only those last observation bytes. A same-generation observation with unchanged phase/attempt and null operation ID is also an idempotent owner status refresh. A dispatched explicit operation otherwise requires exactly one next-generation observation with its exact operation ID; this acknowledges the start ordinal reservation. That observation records receipt `started` for starting/running and `start_failed` for either failed phase. Later same-generation observations use null; if the receipt is still started and that generation fails, update it to start_failed. Running does not mean recovered; the name started is deliberately only an admission/lifecycle acknowledgement. The adapter must not wait for a first frame to acknowledge an admitted attempt.

If no explicit operation is dispatched, a non-null observation operation ID rejects. If an intent is queued but the owner reports a legitimate automatic next generation first, accept the actual owner observation and terminally mark that intent `superseded`; never restart the new attempt using old intent. R4b must independently demonstrate that its normal same-tick ordering selects an already accepted explicit intent before automatic start. During a dispatched intent, a next-generation observation with null/wrong operation ID rejects as an integration mismatch; retain the issued operation and capacity for reconciliation. No timer is allowed to invent a start or free that ownership.

### Commands, replay, dispatch and cancellation

Command JSON has exactly this order and shape:

```json
{"version":1,"supervisorEpoch":"<32hex>","attachmentId":"<32hex>","generation":2,"commandSequence":1,"operationId":"<32hex>"}
```

The caller must use the queue epoch and handle's attachment nonce. The handle privately binds runtime/release/source/instance/PID/descriptor, so swapping a command onto another attachment rejects even when its instance ID was reused. Sequence starts at 1 for a fresh handle and advances only for each newly accepted command. There is no gap admission: a new command must be the last accepted sequence plus one. Invalid JSON, wrong epoch/attachment, sequence gaps, changed payload reuse, busy, wrong generation, overflow or not-failed outcomes consume no sequence. Rejected calls throw `Error` with a bounded fixed `code` and message; do not include caller JSON or error stacks in a receipt.

After syntax/epoch/attachment checks, compare against the retained last canonical command bytes **before** checking current generation/phase. Exact replay of that last accepted command returns a fresh copy of its current receipt, even after its generation has advanced or the queue has closed; it performs no action. Same sequence or operation ID with different bytes rejects `COMMAND_CONFLICT`. Older sequences reject `STALE_COMMAND`, even after their receipts have been evicted; future gaps reject `COMMAND_GAP`. Only one last operation ID is retained; older-operation replay is rejected through its old sequence, not an unbounded ID set. Clients must never reuse an operation ID for a new command sequence; reuse of the immediately retained ID is rejected. Older ID reuse at a new sequence is outside the client's contract and cannot be detected by this bounded ledger; sequence identity remains authoritative.

A new correctly sequenced command needs the current observed generation and either failed_owned or failed_clear. For a new command after replay/sequence checks, check closed queue, outstanding intent, eligible failed phase, matching generation, then increment overflow, in that order. It receives `{operationId, commandSequence, generation, targetGeneration:generation+1, status:'accepted'}`. At most one accepted or dispatched operation exists per attachment. A different new command while one exists rejects `RESTART_BUSY`; it does not queue another recovery. Distinct failed instances have independent slots, so up to 16 intents are admitted. At last accepted sequence or current generation `Number.MAX_SAFE_INTEGER`, refuse another admission with `IDENTITY_EXHAUSTED`; no wraparound, implicit reattachment or fault-history reset. Compute the checked next sequence without first overflowing it; there is no representable next command when the sequence is exhausted.

`takeRestart` returns null without changing command state if no accepted intent exists, if cleanup remains failed_owned, or if the handle/queue is closing. In failed_clear it atomically changes accepted to dispatched and returns one deeply frozen effect:

```js
const effect = {
  identity, // immutable identity DTO captured at attach, including attachmentId
  supervisorEpoch,
  operationId, commandSequence,
  previousGeneration: generation,
  targetGeneration: generation + 1
};
```

A second take returns null. No process is started and no fault timestamp is changed by taking. The future adapter must reserve the exact next attempt ordinal synchronously before its first await and acknowledge that ordinal through observe, even if start immediately fails. It calls take only when it can own that transition. If adapter code fails between issue and observation, the issued operation remains unresolved; do not retry it or manufacture completion. Root records that evidence and the actual owner reconciles shutdown. This first ledger does not solve process-crash persistence; a fresh supervisor epoch invalidates all old commands after a supervisor restart.

`cancelRestart` accepts only the exact retained operation ID and positive sequence. It changes accepted to cancelled; repeated cancellation of cancelled returns the same receipt. Once dispatched or started it rejects `TOO_LATE`, because cancellation cannot retract owned process work. For another terminal receipt it returns that receipt unchanged; a different ID/sequence rejects `STALE_COMMAND`. Cancellation preserves the consumed sequence and cannot restore the automatic retry budget. A new explicit command at the next sequence may be admitted if the observed instance still fails and no operation is outstanding.

Receipt statuses are exactly `accepted`, `dispatched`, `started`, `start_failed`, `cancelled`, `superseded`, `closed`, and `removed`. Accepted/dispatched are outstanding; all others are terminal for queue admission. Started is terminal for the command, while a later fault at its target generation may refine it to start_failed. Once a newer command is accepted, older receipts are evicted and never updated. The last receipt retains its original source generation and target generation; current owner generation is a separate inspect field.

`inspectRestart` returns `{identity, supervisorEpoch, observed, lastSequence, receipt, closed, retired}`; observed and receipt are null before their first observation/admission. All data are copies and deeply frozen. Inspection cannot change time, scheduling or authority. It remains available for a retired handle while the caller retains that handle; private WeakMaps allow garbage collection and the queue itself no longer holds it after retirement. A forged handle rejects `INVALID_HANDLE` for every entry point.

`closeRestartQueue` is idempotent: mark closed, change accepted receipts to closed, prevent attach/new requests/take, and retain all attachments and dispatched intents. It returns the number of unretired attachments, not a process-cleanup result. Valid owner observations and retirement continue while closed; dispatched intents remain owned until the owner settles/removes them. An observation of removing/removed terminally marks any accepted intent removed; a dispatched intent becomes removed only on removed (the owner asserts start settled and cleanup complete). A successful next-generation explicit observation during close is still recorded; it does not reopen the queue. The registry's close path must immediately drain that late producer.

`retireRestart` requires an observed removed phase, rejects otherwise with `OWNER_NOT_REMOVED`, and releases exactly this attachment's logical capacity. It is idempotent on an already retired genuine handle. All other mutating attachment operations reject `ATTACHMENT_RETIRED`; inspect remains readable. No cancellation/close/elapsed time substitutes for a removed observation. The pure module trusts that observation as an owner assertion; real Job confirmation is proved only in the later adapter/native stages.

Fixed rejection codes are `INVALID_HANDLE`, `INVALID_INPUT`, `INVALID_CLOCK`, `ATTACHMENT_EXISTS`, `CAPACITY`, `QUEUE_CLOSED`, `ATTACHMENT_RETIRED`, `OWNER_NOT_REMOVED`, `OWNER_CONFLICT`, `WRONG_EPOCH`, `WRONG_ATTACHMENT`, `STALE_GENERATION`, `STALE_COMMAND`, `COMMAND_CONFLICT`, `COMMAND_GAP`, `RESTART_BUSY`, `NOT_FAILED`, `IDENTITY_EXHAUSTED`, and `TOO_LATE`. Test the code, not engine-specific TypeError wording. Calls after retirement check the genuine handle/retired condition before decoding; other calls validate all primitive/JSON arguments before touching state, then use the transition precedence above.

### Task 1: implement and verify the two-file CPU contract

**Consumes:** The exact API/identity/state rules above and the unchanged source hashes in the investigation. **Produces:** An importable internal CommonJS ledger and deterministic tests, not a wired installed Restart feature.

- [ ] Write the failing test file first. Use the following complete fixture setup and smoke regressions, then add the adversarial matrix below. These are proposed tests of the new module, not a claim that the current source already exports it.

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../../apps/installed-runtime/src/restart-intent.cjs');
const runtimeId = 'a'.repeat(64), supervisorEpoch = 'b'.repeat(32);
function identity(n = 1) {
  return {version:1, runtimeId, releaseId:'c'.repeat(64), sourceHash:'d'.repeat(64),
    instanceId:n.toString(16).padStart(32,'0'), hostPid:42, descriptorHash:null,
    attachmentId:(n+100).toString(16).padStart(32,'0')};
}
function fixture(phase = 'failed_clear') {
  const queue = api.createRestartQueue(runtimeId, supervisorEpoch);
  const value = identity(), handle = api.attachRestart(queue, JSON.stringify(value));
  const observe = (generation, nextPhase, operationId = null, now = 0) =>
    api.observeRestartOwner(handle, JSON.stringify({generation,
      attemptId:generation.toString(16).padStart(32,'0'), phase:nextPhase, operationId}), now);
  observe(2, phase);
  const command = (sequence = 1, generation = 2, operationId = 'e'.repeat(32)) =>
    JSON.stringify({version:1, supervisorEpoch, attachmentId:value.attachmentId,
      generation, commandSequence:sequence, operationId});
  return {queue, value, handle, observe, command};
}
const code = expected => error => error.code === expected;
test('failed ownership admits one intent but only confirmed clear dispatches it', () => {
  const f = fixture('failed_owned'), bytes = f.command();
  assert.equal(api.requestRestart(f.handle, bytes, 1).status, 'accepted');
  assert.equal(api.takeRestart(f.handle, 2), null);
  f.observe(2, 'failed_clear', null, 3);
  const effect = api.takeRestart(f.handle, 4);
  assert.equal(effect.targetGeneration, 3);
  assert.equal(effect.identity.instanceId, f.value.instanceId);
  assert.equal(api.takeRestart(f.handle, 4), null);
  f.observe(3, 'starting', 'e'.repeat(32), 5);
  assert.equal(api.requestRestart(f.handle, bytes, 6).status, 'started');
  assert.equal(api.inspectRestart(f.handle).observed.generation, 3);
});
test('cancel consumes its sequence and does not create an extra restart', () => {
  const f = fixture();
  api.requestRestart(f.handle, f.command(), 1);
  assert.equal(api.cancelRestart(f.handle, 'e'.repeat(32), 1, 2).status, 'cancelled');
  assert.equal(api.takeRestart(f.handle, 3), null);
  assert.equal(api.requestRestart(f.handle, f.command(), 4).status, 'cancelled');
  const next = f.command(2, 2, 'f'.repeat(32));
  assert.equal(api.requestRestart(f.handle, next, 5).status, 'accepted');
  assert.throws(() => api.requestRestart(f.handle, f.command(), 6), code('STALE_COMMAND'));
});
test('an automatic replacement supersedes queued old-generation intent', () => {
  const f = fixture();
  const command = f.command();
  api.requestRestart(f.handle, command, 1);
  f.observe(3, 'starting', null, 2);
  assert.equal(api.requestRestart(f.handle, command, 3).status, 'superseded');
  assert.equal(api.takeRestart(f.handle, 4), null);
});
test('close retains issued work and capacity until owner removal', () => {
  const f = fixture();
  api.requestRestart(f.handle, f.command(), 1);
  api.takeRestart(f.handle, 2);
  assert.deepEqual(api.closeRestartQueue(f.queue, 3), {closed:true, retained:1});
  assert.throws(() => api.retireRestart(f.handle, 4), code('OWNER_NOT_REMOVED'));
  f.observe(3, 'starting', 'e'.repeat(32), 4);
  f.observe(3, 'removing', null, 5);
  f.observe(3, 'removed', null, 6);
  assert.deepEqual(api.retireRestart(f.handle, 7), {retired:true});
  assert.deepEqual(api.closeRestartQueue(f.queue, 8), {closed:true, retained:0});
});
test('rejected generation mutation cannot alter a queued command or clock', () => {
  const f = fixture();
  api.requestRestart(f.handle, f.command(), 1);
  const before = api.inspectRestart(f.handle);
  assert.throws(() => f.observe(4, 'starting', null, 1000), code('OWNER_CONFLICT'));
  assert.deepEqual(api.inspectRestart(f.handle), before);
  assert.equal(api.takeRestart(f.handle, 2).targetGeneration, 3);
});
```

- [ ] Run `node --test tests/unit/installed-restart-intent.test.cjs` in the isolated implementation checkout. Before module creation the expected red is the missing module, not proof that every proposed branch was exercised. After adding the exports, demonstrate targeted behavioral red cases separately before their corresponding implementation; retain raw logs and exact hashes.
- [ ] Implement the minimal bounded module in `restart-intent.cjs`. Use private `WeakMap`s for genuine queue/attachment handles; frozen null-prototype empty handles; queue-owned `Map`s for at most 16 active attachment/instance identities; primitive-input validation followed by a private candidate transition and a single state/clock publication. No externally supplied object or callback participates in a transition. Use the following implementation pattern for flat canonical JSON and error construction, expanding each exact shape from the contract:

```js
const queues = new WeakMap(), attachments = new WeakMap();
const handle = () => Object.freeze(Object.create(null));
function fail(code) { throw Object.assign(new Error(code), {code}); }
function canonical(text, keys) {
  if (typeof text !== 'string' || text.length > 1024 || Buffer.byteLength(text,'utf8') > 1024)
    fail('INVALID_INPUT');
  let value;
  try { value = JSON.parse(text); } catch { fail('INVALID_INPUT'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length ||
      keys.some(key => !Object.hasOwn(value,key))) fail('INVALID_INPUT');
  const ordered = Object.fromEntries(keys.map(key => [key,value[key]]));
  if (JSON.stringify(ordered) !== text) fail('INVALID_INPUT');
  return ordered; // Apply the specified primitive validators before state access.
}
// A mutation validates all arguments and derives next state without editing the
// old record, then publishes private state and queue time only on success.
// Snapshot code constructs known DTO fields explicitly and freezes all children.
```

- [ ] Add these independent behavioral groups with concrete fixture outcomes. Use fresh queues per case except where cross-instance clock/capacity is the behavior. Each row states an achievable observation; do not use fake exported internals to bypass admission.

| Group | Inputs and exact expected observations |
| --- | --- |
| Identity and authority | `{}`, cloned status and another queue handle passed as attachment all reject INVALID_HANDLE; command from a different attachment/epoch rejects; inspect mutation attempts cannot affect subsequent status; retired old handle stays rejected after identical instance ID is reattached with a new nonce |
| Parsing and numeric domain | Wrong primitive objects with throwing `toString`/getters never invoke them; whitespace, reordered/extra/duplicate keys, array, null, non-string JSON, 1,025-byte input, multibyte byte overflow, negative/fractional/unsafe ordinal or sequence reject atomically; NaN/Infinity/backward times reject; equal times and negative-zero time succeed |
| Eligibility | Unobserved, starting and running reject NOT_FAILED; failed_owned accepts but repeated take remains null; rejected cleanup stays owned; only an observed failed_clear allows dispatch; removing rejects new recovery and removes queued intent |
| Replay and queue | Exact last request is replayed after acceptance, dispatch, next generation, cancellation, failure and close; same sequence/different bytes and retained operation ID/new sequence reject; old sequence rejects after eviction; sequence 3 before 2 rejects; second distinct pending request rejects without consuming sequence 2, which succeeds after cancellation |
| Generation and attempt | Same-generation attempt ID cannot change; ordinal skips/backward changes reject; starting-null to known ID is legal; running-null rejects; failed_owned cannot return to running in the same ordinal; failed_clear-to-next ordinal works; known next ID cannot equal preceding ID; current ordinal MAX_SAFE_INTEGER rejects admission before adding 1 |
| Explicit/automatic collision | Queued command then automatic next ordinal yields superseded and no take; dispatched then null/wrong operation on next ordinal rejects and retains issued state; exact explicit next ordinal starting/running gives started, failed gives start_failed; subsequent same-ordinal fault refines last started receipt; a newer command prevents updates to the evicted receipt |
| Cancellation | Matching pending cancel is idempotent; wrong sequence/operation rejects; dispatched/started cancel is TOO_LATE; cancel does not roll sequence backward; later request uses next sequence and current generation |
| Capacity and isolation | Attach 16 distinct failed instances, each admit one intent; 17th attachment rejects CAPACITY; starting/running/failed/closed-but-unretired all count; removing without removed cannot retire; removing one confirmed-clean attachment permits one new attachment on an open queue; taking/cancelling one changes no sibling receipt |
| Close and late work | Close cancels accepted receipts, blocks fresh attach/new command/take, retains dispatched receipt and all capacity; exact replay remains readable; next-generation late admitted start is recorded while closed; only removed then retire reduces count; immediate close of an unobserved attachment permits a generation-0/null-ID removed observation then retire without inventing a start; generation 0 in other phases rejects; second close and retire are idempotent; a forged removed observation through a forged handle rejects |
| Atomicity and retention | For each rejected call compare full before/after inspect and follow with a valid lower time than the rejected call; no sequence/clock/phase mutation. Run 1,000 sequential accepted/cancelled commands on one failed attachment; inspect exposes only the last receipt/sequence and active map remains one; no durable command-history collection in source |

The 1,024-byte transport cap is a raw-input guard; legal flat DTOs with fixed-width identities and safe numeric fields are smaller. Do not claim a legal DTO exactly at that byte limit. The safe-integer sequence exhaustion guard cannot be reached from sequence 1 in a bounded execution test; independently review the increment guard and test unsafe parsed values, while testing the actual generation-overflow path via a legal initial observation at MAX_SAFE_INTEGER. The 1,000-command test checks behavioral retention and source inspection checks storage structure; neither measures heap leak freedom or a 60-minute soak.

- [ ] Run the new suite plus the explicit CPU baseline below. Preserve raw results, counts and skipped status. No new dependencies are needed. No first-leaf TypeScript declaration surface is introduced; run both actual TypeScript configs as combined regression checks using root's existing compiler if the worktree has no dependency link.

```powershell
node --test tests/unit/installed-restart-intent.test.cjs
node --test tests/unit/installed-close.test.cjs tests/unit/installed-drain.test.cjs tests/unit/installed-hang-marker.test.cjs tests/unit/installed-health-publication.test.cjs tests/unit/installed-health-wiring.test.cjs tests/unit/installed-health.test.cjs tests/unit/installed-init-marker.test.cjs tests/unit/installed-registry.test.cjs tests/unit/installed-scan.test.cjs
node C:/Users/zFlei/repos/lux/node_modules/typescript/bin/tsc --noEmit
node C:/Users/zFlei/repos/lux/node_modules/typescript/bin/tsc -p tsconfig.examples-v2.json --noEmit
```

- [ ] Apply bounded isolated mutations to the candidate module and rerun only affected new tests: permit a second take; move cleanup eligibility from failed_clear to failed_owned; check current generation before replay; clear pending on close without retaining dispatched work; advance the sequence on a rejected busy command. Every mutation must produce an asserted behavioral failure, then restore and rehash the accepted candidate. Do not edit the shared owner files or leave mutated source as the submitted commit.
- [ ] Independently review source and the exact contract with a fresh stable validator. Require independent adversarial orderings across two attachments, random bounded legal command traces against the written state table, wrong-epoch/operation probes and all setup/owner hashes. A new session under the implementer is not independent. Any contract change returns to plan review before rework.
- [ ] Stage exactly the two authorized files, check the staged diff, commit, record full SHA, submit and stop the worker session. Root owns later serialized integration and re-runs combined evidence against the exact landed SHA. Do not merge from the worker or expose a recovery action after CPU acceptance.

## Later adapter obligations and physical evidence boundary

R4b's exact plan must map each registry transition into the ledger rather than allowing callbacks to mutate the registry concurrently. Process incoming authenticated intents at a deterministic point in the existing serial tick after validating the current lease, before automatic start admission. On a queued failed_owned command keep polling siblings while the existing stop promise remains pending/rejected. On failed_clear use one synchronous reservation of `entry.attempts + 1` and the explicit operation, then await its start; startup rejection uses existing `fault(now)` and retains its previous-fault history. Explicit admission does not rewrite `retryAt` as a blanket policy reset. Concurrent close may await an already reserved start, then use the existing shared drain owner. Unconfirmed cleanup never becomes failed_clear/removed for the ledger. Synchronous thrown starts and deferred promise starts both need real registry tests, including second-instance health through stop rejection and removal.

Current supervisor startup work is effectively synchronous before its async return; its `ticking` guard prevents overlapping registry reconciliation. The adapter plan must not introduce a long external authentication/read await while holding that guard or block sibling health on a stop promise. A hypothetical arbitrary concurrent call is not sufficient reason to rewrite the existing registry now. If actual source evidence establishes a defect, record a linked prerequisite and keep it out of R4a.

R4c/d must preserve the full host-authoritative desired control owner across replacement. The restart command intentionally contains no saved control values. The receiver already publishes its current desired snapshot into the newly connected ring; a request-time snapshot could be stale if controls change while cleanup/startup runs. The later plan must additionally prove that the **first presented recovery image** satisfies the selected current host snapshot and source/schema/generation identities, rather than accepting a wrong first image followed by a corrected one. Host changes during recovery need a declared monotonic host control-sequence cut and a stable observation interval; do not silently label a moving target as one frozen snapshot. If existing ring handoff cannot enforce that first-image criterion, prepare its exact gating change independently before physical testing.

An accepted receipt means the ledger stored one intent. Dispatched means one effect was issued. Started means a matching attempt ordinal was reserved, not that worker-ready, a frame, or a visible image was observed. Neither status may be labeled recovered in UI. The eventual host completion signal requires the actual consumed reference frame and current control/source identities. Keep QPC endpoints, instance/attachment/supervisor/operation/attempt IDs, source/release/runtime hashes, control schema/sequence/full values, first-frame identity, incomplete/lost-record flags and confirmed process/descendant exit provenance. No row-only log can infer a missing exit or successful flush.

For a suppressed source with no process left, explicit restart still measures from the user/native action to the first qualifying host-consumed image. For a failed producer still draining, that same interval includes remaining cleanup; a five-second miss fails the gate. The two-second injected-JavaScript physical stop check independently starts at the trusted injection endpoint and ends only at confirmed root/descendant execution exit. Mock clocks and watchdog threshold arithmetic do not provide either physical endpoint. Keep last completed output and sibling responsiveness, inspect actual Resolume behavior, and record GPU resource-accounting limitations separately. Existing package/native input gates must be satisfied before any actual-host run.

## Evidence contract and handoff

| Criterion | Preconditions, method and expected observation | Responsible role and provenance |
| --- | --- | --- |
| Plan grounding | Read complete source plans and exact current owners, compare historical amendments, run only bounded actual-registry fake probes and CPU tests | This planner; full base SHA, owner-hashes.json, baseline-cpu.log and probe.cjs/log; original broad-selection failures remain separate |
| Plan source integrity | Only this Markdown changes; all captured source/plan owner bytes and sizes remain unchanged; LF text and staged diff check pass | This planner; full doc commit and final manifest/check logs; no implementation acceptance claim |
| Plan independent acceptance | Fresh context critiques exact proposed policy, API, orderings, limits and first/later evidence split | Root-selected independent reviewer; exact document hash/commit, findings and dispositions before R4a dispatch |
| R4a source acceptance | Two authorized new files; behavioral red/green, new matrix, unchanged 38-test CPU baseline and both TS configs; mutations restored; no producer/IO path | Fresh implementation then independent validator; exact source SHA, commands/raw results, 11 unchanged owner hashes, executor/session/claim IDs |
| R4a integration | Root serial merge of accepted source; two source hashes match and owners rechecked; new/baseline CPU and both TS commands pass together | Root integrator; exact landed SHA and independent source decision remain separate, no native/host claim |
| R4b/c/d delivery | Independently reviewed actual adapters, authenticated native entry point, exact immutable package and exclusive host reservation; actual first-image/stop evidence | Later assigned workers/reviewers/root; original 2 s/5 s gates and failed/incomplete evidence preserved, never inferred from R4a |

Delivery is one documentation commit for LUX-64, then fresh independent plan review. No source implementation, UI action, transport, package or physical recovery capability is delivered by this planning ticket.
