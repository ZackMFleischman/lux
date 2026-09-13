# Installed restart adapter implementation plan

> **For agentic workers:** Use `conductor-worker` and `superpowers:executing-plans` for one assigned leaf. Root dispatches each fresh worker and independent reviewer. This document does not authorize implementation or a native run.

**Goal:** Join the accepted restart-intent ledger to the installed registry and serial supervisor without losing attempt identity, retry history or cleanup ownership.

**Architecture:** The registry remains the single lifecycle transition owner. It uses the accepted ledger for command admission and replay. The supervisor supplies validated source identity and the actual random attempt ID before it calls the native start owner. An ambiguous native launch failure retains a blocked ownership reservation.

**Tech stack:** CommonJS, the existing Node runtime, and Node built-in test, assert and VM modules. CPU tests substitute explicit filesystem, timer and native bridge seams.

**Spec:** [Installed recovery plan](installed-recovery-plan.md), [reliability plan](reliability-plan.md), and the complete amended [recovery checkpoint](recovery-checkpoint.md). LUX-78 specification 2 covers this document only. The first implementation leaf below needs fresh independent plan acceptance and a separate assigned ticket.

## Constraints and delivery boundary

- Preserve one automatic retry after 250 ms when the fault is the first fault or is at least 30,000 ms after the previous fault. A second fault inside that interval suppresses automatic admission. Success, explicit restart and elapsed time do not erase `lastFaultAt`.
- Preserve the 15,000 ms startup deadline, independent 1,250 ms main/worker liveness deadlines, 4,000 ms frame/output deadlines and 250 ms supervisor poll.
- Preserve 16 reserved instances, including pending starts and rejected cleanup. Do not start a replacement before the preceding producer exit is confirmed.
- Preserve runtime, release, source, descriptor, instance and host identity. Keep the original seed and native host control owner. The command contains no control snapshot.
- Preserve the `ticking` guard. The production start callback currently has no `await` before returning its producer. Do not insert transport, authentication or long asynchronous preparation into that callback.
- Preserve rejected stop ownership and sibling health polling. Do not wait for one stop promise inside `reconcile`.
- Do not expose a listener, native command, generated-code capability, Studio/MCP route or host action in R4b1. Do not change immutable package capability/version rules.
- R4c/R4d still require separately reviewed authentication, native action semantics, package capability, first-current-image gating, and physical stop within 2 seconds / explicit restart within 5 seconds.
- LUX-7 remains policy-stopped. Native-input provenance blockers remain. No native build, bridge load, installed process test, Studio, GPU, Resolume, download, install, portal or settings operation is authorized here.

## Inspection and reproducible evidence

Executor: `/root/restart_adapter_plan`.
Agent: `0441543d-e436-488d-b8bb-9a37fd7c6b8b`.
Session: `1413c3aa-e050-4584-9a5c-f1b3101341b1`.
Claim: `f02f80f6-3225-47a8-9c01-bbca2edb1ed7`.
Checkout: `C:/Users/zFlei/repos/lux/.worktrees/restart-adapter-plan`.
Branch: `codex/restart-adapter-plan`.
Full base: `34c53f1ce18db13db74f11508b377c7af556bca2`.
Raw evidence directory: `C:/Users/zFlei/repos/lux/.worktrees/_coordination/LUX-78`.

The planner read all three source plans, including the later recovery amendments, the actual ledger and its complete tests, and the registry, supervisor, instance, health, drain, close and scan owners. The earlier three-total-start and 2.5-second heartbeat descriptions are historical. Current source implements the previous-fault rule and separate 1.25-second liveness deadlines.

R4a source `d0f01ec588b2a0b997bbb766ba1c4674d0003880` was independently accepted and integrated at `a13d9635246f4ed5f293daf1c7e51293a371c7f5`. The planner read main's `.worktrees/_coordination/reviews/LUX-70/review.md` and `docs/conductor-onboarding/restart-intent-main-evidence.md`. Those records cover 64 combined CPU tests, both TypeScript configurations, and the independent 128-seed model with 23,040 steps and 20 interleavings. They prove the pure ledger. They do not prove a production adapter or physical recovery.

`owner-hashes.json` records SHA-256 and byte length for 20 files. The principal current owners are:

| Owner | SHA-256 | Bytes |
| --- | --- | ---: |
| `apps/installed-runtime/src/registry.cjs` | `3c4c865f5a16178308f56c7bbf4bc4035f6cda14a9eadd0d583740fcd0a0d35c` | 8186 |
| `apps/installed-runtime/src/supervisor.cjs` | `f1680f1b05d57de8d190dd003c47188d67dced1decfa6bb7e438d578decdda83` | 7493 |
| `apps/installed-runtime/src/instance.cjs` | `f026fbf727e6a68d281a5cc4baa169e6168be052d85acc75f6a249db7f7c0967` | 2554 |
| `apps/installed-runtime/src/restart-intent.cjs` | `8f7fe32a40a38dcde7ae416b31dea2448bdc9ba7264608a50da531662ab01845` | 11592 |
| `tests/unit/installed-restart-intent.test.cjs` | `471fc644accc6469ec58a7cf9e5c71523fc2d6e869d0c8f517db8da363438aef` | 26414 |
| `native/texture-bridge/include/installed_process.h` | `85b0b2b8a6ce0c0bff73abcd09509ce75c6d6b21a1ff2f7f9b7cc251a70b62c8` | 6659 |
| `native/ffgl-source/src/InstalledActivation.h` | `078b3eb5928bd0050d4047cc9ffed4f2c0aed480810ce4ec9a9c1b97f12d1f76` | 6975 |
| `native/ffgl-source/src/FrameReceiver.cpp` | `066f347e43a54a5ecc4e8133af295ec8a0fa08d3b0bfd4afb28f35624e8cb0d7` | 30047 |
| `packages/export/src/package.cjs` | `bec76df02325b0851d486cda08f756990e790deacee7f47b2978e93e930b6ccf` | 15356 |
| `packages/export/src/register.cjs` | `c06e2693452a12e7e8d31c8ca06df0c0d2814d4e3c05f97868eb80438b386e60` | 6026 |

Run the retained probe with:

```powershell
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/zFlei/repos/lux/.worktrees/_coordination/LUX-78/probe.cjs'
```

The script requires the actual registry. Its supervisor probe executes the actual supervisor text in a VM. Each import is allowed explicitly. Filesystem methods, native methods, process exit and timers are CPU seams. No native module is loaded. The script writes only its own results file. `probe.cjs`, `probe.log` and `probe-results.json` retain the exact code, setup and observations:

| Probe | Actual observation | Limit |
| --- | --- | --- |
| Synchronous start throw at 0/250/60,000 ms | Two starts; ordinal 2; `lastFaultAt=250`; `retryAt=Infinity` | The test callback throws before owning a producer. It does not prove a native throw has that property. |
| Deferred start and concurrent close | Ordinal 1 and one pending start before resolution; close remains pending; the late returned producer is stopped once | A deferred CPU seam verifies ownership. It is not a physical start or a production concurrent-reconcile experiment. |
| Repeated stop rejection with sibling | Three rejected stop attempts and three sibling polls; no replacement; removal/close retain the drain until stop is allowed | Resolving the fake stop is explicit fixture confirmation only. |
| Actual supervisor with ambiguous bridge throw seam | The current registry has no producer after rejection and calls start again at 250 ms; the seam can retain an unconfirmed owner | This demonstrates missing JS ownership information. The native source inspection below separately establishes why a throw cannot certify exit. |

`baseline-cpu.log` records 38 passing tests, with zero failures, skips or cancellations, from the exact nine-file command near the end of this document. No broader test glob was used. A preliminary read searched two incorrect guessed paths (`apps/installed-runtime/package.cjs` and `native/texture-bridge/src/process.cc`); `rg --files` found the real owners shown above. A later read accidentally used positional `tests/unit/export*` and failed with Windows error 123 despite supplied P49. The corrected search used `-g` filters. Both read failures caused no source mutation or native execution; `workflow-problem.json` preserves them.

## Native launch failure prerequisite

The ordinary `installedStop` success path requires both a signaled root process and zero active Job processes. Only then does it close handles and erase its key. The supervisor's `stop` method resolves only after `stopped.stopped` is true. Diagnostic file deletion and lifecycle telemetry do not supply that confirmation.

The `installedStart` exception path has a different contract. Its catch requests `TerminateProcess`, closes the process/thread/Job handles and throws. It does not wait for root exit or query active descendants. It returns no retained cleanup key. A failure after process creation or resume can therefore reach JS without a recoverable ownership token. A termination request and kill-on-close policy are not an observed exit. The probe does not claim this failure occurred on the physical host.

Record a separate prerequisite for the native owner: retain an addressable cleanup owner after partial launch, distinguish no-process-created from process-created failures, and expose confirmed cleanup through the existing native ownership mechanism. Its plan must cover failed assignment, failed resume, insertion/allocation failure after resume, repeated termination/observation failures, and root/descendant confirmation. It must also review key overflow and N-API result failures. It needs its own reviewed CPU/native setup. This document authorizes no change to that header or native package inputs.

R4b1 can be implemented before that prerequisite by failing closed. On an exception from `bridge.installedStart`, retain one explicit quarantine producer in the registry. Give it the known random attempt ID. Its `initialFailure` is `INSTALLED_START_EXIT_UNCONFIRMED`; its `stop()` rejects that fixed error because the current bridge cannot reconcile the lost key. It never reports `exited=true`. It never resolves from elapsed time, a receipt or a mocked clock. The entry remains `failed_owned`, reserves capacity and blocks replacement. The supervisor continues polling siblings and retains its existing close retry loop. This is a bounded loss of recoverability on that exceptional branch, not delivered cleanup. There is no force-release button or automatic retirement for quarantine.

The native prerequisite is mandatory before claiming recoverable cleanup for *all* startup failures or completing R4d. Fail-closed R4b1 acceptance must state this limitation. Do not implement the native prerequisite as an unreviewed addition to R4b1.

## R4b1: first implementation leaf

Select one leaf: **wire the ledger to real registry transitions and supervisor attempt identity, with conservative ownership on ambiguous launch failure**. Keep the ledger implementation unchanged. No separate scheduler rewrite is needed for the serial production caller.

Exact files:

| Action | Path | Responsibility |
| --- | --- | --- |
| Modify | `apps/installed-runtime/src/registry.cjs` | Internal restart queue, attachment/attempt join, synchronous admission ordering, lifecycle observations and safe diagnostics |
| Modify | `apps/installed-runtime/src/supervisor.cjs` | Fresh epoch/nonces, validated release/descriptor binding, real attempt ID, owned launch-error result |
| Create | `tests/unit/installed-restart-adapter.test.cjs` | Actual registry plus actual supervisor VM seam tests and adversarial lifecycle orderings |
| Modify | `tests/unit/installed-health-wiring.test.cjs` | Supply the new trusted attempt context to its direct supervisor-start seam and preserve existing telemetry/health assertions |

All other source, existing ledger tests, package/native owners and historical evidence remain unchanged. Existing registry/drain/close/scan tests run as regressions. Additional tests belong in the new adapter suite. No SDK or skill capability changes, installation or reinstall are part of this internal leaf.

### Internal API

Keep the existing constructor and methods usable without restart options. Production supplies the options below. Missing options preserve the old CPU fixtures; they do not constitute a package Restart capability.

```js
new InstanceRegistry({runtimeId, start, limit:16,
  restart:{supervisorEpoch, now:()=>performance.now(), nonce:()=>randomBytes(16).toString('hex')}});
// start(request, admittedAt, attemptContext) -> Producer | Promise<Producer>
// Production restart mode always passes a frozen attemptContext:
// {generation, bindValidated(sourceHash, attemptId)}
// bindValidated returns undefined. It does not start a process or return a receipt.
// Producer remains {exited, failure?(now), stop(options?)}.
// A failed owned result additionally has initialFailure: fixed nonempty string.
registry.restartTarget(instanceId); // genuine opaque attachment or null
registry.requestRestart(attachment, canonicalCommandJson); // frozen ledger receipt
registry.cancelRestart(attachment, operationId, commandSequence); // ledger receipt
registry.inspectRestart(attachment); // frozen ledger status
```

The queue and active attachment ownership map remain private to the registry, using a module-private WeakMap keyed by registry and a WeakMap from genuine handles to their owner entry. Do not expose `observeRestartOwner`, `takeRestart` or `retireRestart` through a registry command API. `restartTarget` is for trusted in-process code/tests only; no caller is added in native or generated code. Wrapper operations reject a handle from another registry with `INVALID_HANDLE`. They sample the shared clock and then delegate canonical command validation and replay to the existing ledger. They do not accept a caller-supplied observation, source hash or completion flag.

Retired genuine handles remain inspectable. Mutations, including command replay, reject `ATTACHMENT_RETIRED` as the ledger specifies. Remove strong registry references at retirement. A WeakMap does not retain every previous attachment. The only live strong references are the at-most-16 owned entries/drains. `restartTarget` returns null for absent, unvalidated or removed entries. Removal does not manufacture a new attachment on a retained handle.

Use the exact nine R4a functions and unchanged canonical DTO order from `restart-intent.cjs`. The supervisor creates one random 32-hex epoch when it constructs its registry. The registry obtains a new 32-hex attachment nonce from the trusted nonce function after successful identity validation. Validate runtime, epoch, nonce and fixed limit before enabling restart mode. A nonce collision fails before bridge invocation; it cannot silently reuse another attachment.

### Validated identity and real attempt identity

`entry.attempts` is the attempt ordinal. It is not the output ring generation. The random attempt ID remains the basename of the `.attempts/<id>.json` request and status files. Do not derive that ID from the ordinal.

For each admitted attempt, the supervisor first calls the actual `validateRelease`. Require its runtime/release IDs to match the request. Before binding a descriptor, repeat the existing instance validation: legacy release requires request version 1 and maps `descriptorHash` to null; parameter release requires request version 2 and the SHA-256 of `sourceIdentity(release).sidecar` from the existing `register.cjs`. Keep the instance's validation unchanged as a second check. Do not accept `sourceHash` from a request file or fill an unknown hash with zeros.

After those checks, generate the actual random attempt ID and call `attemptContext.bindValidated(release.sourceHash, attemptId)` before creating a native producer. The closure belongs to this exact entry, ordinal and start invocation. Reject a reused/stale closure, changed source identity, changed same-ordinal ID or immediately reused prior attempt ID before the bridge call. Copy the validated request fields into canonical R4a identity JSON. An existing attachment must match those fields exactly. Use null for an unknown attempt ID until the bind occurs.

An entry whose release has never validated has no restart attachment. Its attempt ordinal, diagnostic and automatic fault history still exist. A failure before this bind cannot create genuine source provenance. `restartTarget` returns null for that entry. Later successful automatic validation can attach at the entry's actual positive ordinal, as R4a permits. Recovery of permanently invalid/missing packages is not an explicit Restart capability. Do not revalidate on command admission and invent a different source for a suppressed entry.

The closure checks `closed`/removal again immediately before authorizing a new native start. If close occurred during a deliberately deferred CPU start before binding, throw `REGISTRY_CLOSED` before the bridge. If the producer was already created and its returned promise settles during close, retain and stop that producer through the existing close owner. Never discard a late returned handle.

### Clock contract

Keep `reconcile(requests, now)` monotonic admission/fault semantics. The `now` argument remains the observed tick time used by existing `fault`. Do not replace `lastFaultAt` with a later cleanup-completion time. Do not compare the queue clock to `Date.now()` or QPC text.

Every ledger mutation samples `restart.now()` at the instant of that mutation. Use one registry-private last successful ledger time across all its attachments. Require finite, nonnegative, nondecreasing samples; equal values are valid. This avoids reusing an old tick timestamp after an awaited startup while a trusted command has advanced the queue clock. Do not clamp a backward time and call it valid. Production passes `performance.now`; tests supply one explicit mutable monotonic clock to both their tick calls and ledger operations.

An invalid command or clock leaves ledger state and sequence unchanged. An invalid clock or impossible observation at an owner transition is an integration failure: prevent further starts and hand off to the existing close owner while retaining every producer. Cleanup must still run if status publication fails. Do not clear producer/drain ownership to repair an observation. Preserve the diagnostic and exact entry/ordinal for investigation.

### Admission order and retry history

Keep the existing serial `tick` scan. It validates request shape, filename, bounded lease size, lease age and live host PID before passing requests to `reconcile`. R4b1 adds no asynchronous external command source. A future authenticated caller can use the internal wrapper after its separate review.

Within the existing reconcile loop, perform these actions in order:

1. Retry unconfirmed drains without awaiting them. Remove absent leases. Apply same-instance identity checks. Removal and identity mismatch precede command dispatch.
2. For each retained entry, preserve pending start/stop ownership. Detect producer failure, call `fault` once with the tick time, mark `failed_owned`, and begin the shared forced stop. Continue to the sibling.
3. For an attached failed entry with no pending start, producer or stop, publish `failed_clear` if needed. Call `takeRestart` **before** checking `now < retryAt`.
4. If an effect exists, require its identity, previous ordinal and target ordinal to match the actual entry. Select that explicit operation. If no effect exists, use the unchanged automatic `retryAt` test.
5. Check ordinal overflow before increment. Reserve exactly one next ordinal, mark the attempt pending, and publish `starting` with that ordinal and the selected explicit operation ID (or null for automatic admission). Perform all three synchronously, without a user callback or await between take and observation.
6. Call `start` once with the frozen attempt context. Catch both synchronous throw and rejected promise. Track the actual pending promise before awaiting it. On success, install the producer before removing pending-start ownership. On proven no-launch failure, record the fault and clear pending-start ownership before publishing failed_clear. Publish an owned failure only after retaining its producer. On removal/close, keep removing and route any late producer to the stop owner. The `finally` block removes the settled promise from the global starting set; it must not discard a producer or create a second observation.

This is the deterministic priority point. An explicit intent already accepted when step 3 runs outranks automatic delay/suppression. An intent arriving after automatic reservation observes `starting` and rejects `NOT_FAILED`; it cannot reset that attempt. A legitimate automatic observation that reaches the ledger before an older queued intent is delivered may yield the existing `superseded` receipt. Normal production admission must not create that collision after a previously accepted intent.

Explicit admission changes neither `lastFaultAt` nor `retryAt`. Success also changes neither. A subsequent real fault invokes the existing policy against the previous fault timestamp. For example: faults at 0 and 250 suppress; explicit admission at 300 does not clear 250; a fault at 400 stays suppressed; a fault at 30,250 is eligible because the interval from 250 is exactly 30,000. Each example uses a separate fixture so intervening faults do not alter the reference timestamp.

### Observation table

The registry publishes observations from actual transition code, not by polling exposed maps from a second adapter callback. Preserve the actual attempt ID once known. Use the explicit operation ID only for the first next-ordinal observation that acknowledges its dispatch. Subsequent same-ordinal updates use null. Do not reuse a non-null operation ID after changing the observation bytes.

| Real owner transition | Ledger phase / identity | Required ownership fact |
| --- | --- | --- |
| Ordinal reserved before `start` | `starting`, new ordinal, null attempt ID until known; selected operation ID | One entry owns the admitted start. No earlier producer/start/stop exists. |
| Validated identity bind during start | `starting`, same ordinal, actual random ID, null operation ID | Release/descriptor validated; ID is the path/health ID production will use. First attachment can start at this positive ordinal. |
| Start returns a normal producer | `running`, same ordinal/ID | Registry retains the handle; not known failed. This asserts no ready frame or image. |
| Producer fails, exits, or returns `initialFailure` | `failed_owned`, same ordinal/ID | Real producer or conservative quarantine is retained. Call `fault` once for this attempt fault. |
| Pre-bridge throw/rejection with no acquired process ownership | `failed_clear`, same ordinal and retained/null ID | Inspected production branch has not called the bridge, or owns no producer by the explicit start contract. A rejected promise alone is insufficient evidence. |
| Shared stop resolves with confirmed exit | `failed_clear` if lease remains and attempt failed | No start, producer or stop remains. This is the only ordinary failed-producer dispatch gate. |
| Lease removal / queue close | `removing`, same ordinal/known ID | No new admission. Pending start/stop and quarantine still reserve capacity. |
| Late start returns after removal/close | Keep `removing`; fill previously null ID if genuine bind preceded creation | Retain returned producer and stop it. Do not move removing back to running. |
| Removed entry has no start, producer or cleanup owner | `removed`, then `retireRestart` | Actual registry teardown completed. Delete strong attachment references. |
| Close before any attached attempt | R4a allows generation 0/null only for removing/removed | R4b1 normally attaches only after positive reservation. Do not invent generation 0 for an admitted attempt. |

`closeRestartQueue` runs before `registry.close` awaits pending starts. Accepted receipts become closed; issued work remains owned. Reservation acknowledgement normally occurs synchronously before close can interleave. A late *start result* is not a second explicit observation. Test the ledger's separately supported close-before-next-observation behavior with the genuine ledger and identify it as a ledger boundary check, not a reachable await window inserted into production.

On stop rejection, leave phase `failed_owned` or `removing`, keep producer/quarantine, retain capacity, and retry through the existing stop owner. Removal transfers the same entry to `draining`; it does not create a second stop promise. Close waits for pending starts, retires retained entries and awaits drains. Existing supervisor close retries after 250 ms and never exits merely because the queue reports zero pending commands.

### Errors and bounded state

Preserve all R4a fixed codes and error precedence. Wrapper lookup failures use `INVALID_HANDLE`; no validated target yields null from `restartTarget`. New owner-side fixed diagnostics are `RESTART_OWNER_CONFLICT`, `RESTART_IDENTITY_UNAVAILABLE`, `INSTALLED_START_EXIT_UNCONFIRMED` and `REGISTRY_CLOSED`. Identity/ordinal conflicts stop new admission for the affected owner and initiate safe close; they do not increment a command sequence or retry an issued effect. Generation overflow uses `IDENTITY_EXHAUSTED` before arithmetic.

Normalize caught values without getters or coercion from arbitrary thrown objects. Use a fixed fallback for non-string/nonstandard failures. In particular, constructing a cleanup diagnostic must not throw and bypass ownership publication. Keep detailed trusted Error messages only through a guarded bounded conversion; do not copy caller JSON into receipts.

Allow at most 16 registry reservations and 16 ledger attachments. Retain one current attempt context and one last receipt per attachment. There is no command inbox, historical attempt map or timer per intent. A pending start, rejected stop or quarantine is still one reservation. Current instance request scanning remains capped at 64 names and 512 bytes per lease; R4a canonical commands remain capped at 1,024 UTF-8 bytes. Keep the existing ledger's safe-integer sequence/ordinal checks. Do not add an unbounded nonce collision retry loop; reject before launch and preserve the current attachment on a collision.

## Implementation steps and achievable tests

- [ ] **1. Freeze source and add red tests.** Rehash these owners at the fresh implementation base. Create the new adapter test file. Require the actual registry and ledger; run the basic request-through-owner test below before adding the wrapper. Its first red is the absent `restartTarget` method. Add behavioral reds for ordering and ownership after the method exists. Retain each raw result.

```js
const test=require('node:test'), assert=require('node:assert/strict');
const {InstanceRegistry}=require('../../apps/installed-runtime/src/registry.cjs');
test('accepted explicit intent outranks suppression and reserves one actual ordinal',async()=>{
  const runtimeId='a'.repeat(64), releaseId='b'.repeat(64), instanceId='c'.repeat(32);
  const supervisorEpoch='d'.repeat(32), sourceHash='e'.repeat(64);
  let now=0, starts=0, nonce=100;
  const hex=n=>n.toString(16).padStart(32,'0');
  const r=new InstanceRegistry({runtimeId,restart:{supervisorEpoch,now:()=>now,nonce:()=>hex(nonce++)},
    start(_request,_at,attempt){starts++;attempt.bindValidated(sourceHash,hex(starts));throw Error('pre-bridge fixture failure');}});
  const lease={version:1,runtimeId,releaseId,instanceId,hostPid:42};
  await r.reconcile([lease],now);now=250;await r.reconcile([lease],now);
  const target=r.restartTarget(instanceId), state=r.inspectRestart(target);
  assert.equal(state.observed.phase,'failed_clear');assert.equal(state.observed.generation,2);
  const bytes=JSON.stringify({version:1,supervisorEpoch,attachmentId:state.identity.attachmentId,
    generation:2,commandSequence:1,operationId:hex(1000)});
  now=300;assert.equal(r.requestRestart(target,bytes).status,'accepted');
  await r.reconcile([lease],now);
  assert.equal(starts,3);assert.equal(r.entries.get(instanceId).attempts,3);
  assert.equal(r.inspectRestart(target).receipt.status,'start_failed');
  assert.equal(r.requestRestart(target,bytes).status,'start_failed');
  assert.equal(r.entries.get(instanceId).lastFaultAt,300);
  assert.equal(r.entries.get(instanceId).retryAt,Infinity);
  await r.close();
});
```

- [ ] **2. Add the registry-owned join.** Use private queue/handle state. Build canonical JSON with the exact field order. Add trusted wrappers and the frozen per-attempt bind closure. Implement synchronous take/reserve/starting order. Keep automatic code and stop ownership in their existing serial locations. The admission code must have this order; the helper names below are local implementation names defined by these actions:

```js
// ownerNow samples/validates the restart clock; publish emits the canonical
// observation for this entry; makeAttemptContext creates the one-use bind closure.
const effect=entry.restartHandle ? takeRestart(entry.restartHandle,ownerNow()) : null;
if (!effect && now < entry.retryAt) continue;
if (entry.attempts===Number.MAX_SAFE_INTEGER) throw ownerError('IDENTITY_EXHAUSTED');
const generation=entry.attempts+1;
if (effect && effect.targetGeneration!==generation) throw ownerError('RESTART_OWNER_CONFLICT');
entry.attempts=generation;
entry.startPending=true;
entry.attemptId=null;
publish(entry,'starting',effect?.operationId ?? null);
const attempt=makeAttemptContext(entry,generation);
// Start invocation and its catch/finally follow immediately. No await or
// external callback belongs between take, reservation and publish.
```

- [ ] **3. Wire the actual supervisor.** Generate the epoch once. Validate release/descriptor before binding. Keep the actual attempt ID in request, health and lifecycle paths. Construct the producer object and its stop closure before the bridge call, then assign the returned key and return that owner without another callback or fallible diagnostic. Catch bridge-call ambiguity into the quarantine result described above. Keep pre-bridge failures as no-launch errors. Once a key exists, later stop/telemetry errors keep that same owner. Update the direct-start health-wiring fixture to supply and assert its trusted bind context.
- [ ] **4. Complete the following adversarial matrix.** Use deferred promises with explicit resolvers; do not sleep or use timeouts as completion. Use sequential production ticks. VM probes must execute actual supervisor source with a whitelist of mocked imports and assert bridge calls, request path IDs and actual constructor options.

| Case | Required assertion |
| --- | --- |
| Synchronous throw and rejected pre-bridge promise | Each reserves one ordinal before call; one fault update; known/null attempt ID is accurate; explicit receipt becomes start_failed; replay never starts again. |
| Deferred start with earlier validated bind | Inspect starting while unresolved; command rejects NOT_FAILED; close remains pending; resolving transfers the exact producer to one stop owner; no second start. No claim of sibling polling during an artificial unresolved start await. |
| Validation/descriptor failure | No native call and no invented first source identity; existing attachment identity cannot change; actual legacy/null and parameter/digest mappings are asserted. |
| Explicit versus due automatic | At 250 ms accept explicit before reconcile; exactly one next ordinal and matching operation; `retryAt` and previous `lastFaultAt` unchanged by admission/success. |
| Automatic reserved before a late command | Command is NOT_FAILED against starting; no extra reservation. Direct ledger boundary test retains superseded for a legitimate earlier automatic observation. |
| Fault after successful explicit start | Same-ordinal running then failed_owned/failed_clear refines the retained receipt to start_failed; actual previous-fault policy suppresses or permits exactly at 30,000 ms. |
| Repeated stop rejection and sibling health | Three or more sequential rejected stops retain one producer and attachment; each tick polls the sibling; no take/start until explicit stop confirmation. Test 1,250 ms worker liveness through this path. |
| Source removal and reattachment | Pending intent becomes removed; confirmed retired attachment frees one slot; fresh nonce for same instance ID; old handle cannot control new attachment. Changed lease identity never starts or retargets a pending intent. |
| Queue close and late explicit result | Accepted receipt closes; admitted start remains retained; late producer stays removing and is drained once; repeated close shares stop; retirement follows confirmed cleanup only. |
| Late explicit ledger observation | Genuine ledger take, queue close, then matching next ordinal stays owned and observable. Mark this as the R4a boundary, separately from reachable registry order. |
| Ambiguous native bridge throw | Actual supervisor VM catches bridge exception into failed-owned quarantine; no automatic or explicit replacement at 250/60,000 ms; close rejection retains capacity and supervisor. No fixture resolver clears quarantine. |
| Native key acquired then stop diagnostic error | Actual key remains in a producer; stop confirmation is required. Inject telemetry/disk/clock errors through the existing actual-supervisor stop seam; they do not discard the key or skip stop. |
| Capacity | 16 starting/running/failed/draining reservations; seventeenth denied; close and cancelled receipts free none; confirmed removed then retire permits one fresh attachment when open. |
| Clock and identity attacks | Backward/NaN/Infinity clocks, stale bind closures, cross-registry handles, changed attempt/source IDs and nonce collision reject before a new bridge call; compare full state and sequence. |

- [ ] **5. Run focused checks.** Run the new suite and accepted ledger suite, then the explicit nine-file CPU baseline and both real TypeScript configurations. Preserve counts, zero-skip status, source hashes and exact command exits.

```powershell
node --test tests/unit/installed-restart-adapter.test.cjs tests/unit/installed-restart-intent.test.cjs
node --test tests/unit/installed-close.test.cjs tests/unit/installed-drain.test.cjs tests/unit/installed-hang-marker.test.cjs tests/unit/installed-health-publication.test.cjs tests/unit/installed-health-wiring.test.cjs tests/unit/installed-health.test.cjs tests/unit/installed-init-marker.test.cjs tests/unit/installed-registry.test.cjs tests/unit/installed-scan.test.cjs
node C:/Users/zFlei/repos/lux/node_modules/typescript/bin/tsc --noEmit
node C:/Users/zFlei/repos/lux/node_modules/typescript/bin/tsc -p tsconfig.examples-v2.json --noEmit
```

- [ ] **6. Check sensitivity and hand off.** In the isolated source only, mutate one admission ordering, one stop-confirmation gate and one fault-history assignment. The relevant test must fail behaviorally for each mutation. Restore and rehash the candidate. Commit only the four authorized files. Submit full source SHA and criterion evidence. Stop the worker session. Root obtains fresh independent source review, then serial integration and combined validation. No worker merges or pushes.

## Evidence contract and remaining gates

| Criterion | Preconditions and method | Observation / role / artifact |
| --- | --- | --- |
| LUX-78 plan grounding | Exact full base; complete amended plans and actual owners; bounded actual registry/supervisor CPU seams | Planner: 20 owner hashes, probe source/results/log, 38-test baseline. No native execution claim. |
| LUX-78 source integrity | One Markdown output; original source/tests/metadata/evidence unchanged | Planner: exact commit, final hash comparison and Git diff checks. Root supplies fresh independent plan review. |
| R4b1 lifecycle join | Genuine ledger handles created from validated supervisor identity; actual registry transition owner | Fresh implementer and independent validator: per-case matrix evidence, full source SHA, request/health attempt-ID joins and replay assertions. |
| R4b1 cleanup and isolation | Explicit deferred/rejected-stop seams; actual supervisor VM; no native module load | Pending/failed ownership retained; healthy sibling polls continue through cleanup; ambiguous launch stays quarantined. CPU result only. |
| R4b1 integration | Accepted source commit and root's exact landed SHA | Root rehashes source/owners and reruns combined CPU/types. Source acceptance is distinct from integration acceptance. |
| Native launch cleanup prerequisite | Separately reviewed partial-start owner contract and actual native input provenance | Later worker/reviewer: retained cleanup token and independently confirmed root/descendant exit. R4b1 quarantine does not complete it. |
| R4c/R4d | Reviewed authentication/action/package and exclusive host reservation | First recovered host-consumed image with current complete controls; original physical 2 s / 5 s gates. No receipt/handle/timeout substitute. |

The native receiver currently republishes its host-owned desired controls on the connected replacement ring. Its frame provenance validation does not by itself prove that the first presented recovery image equals the selected current-control snapshot. Keep the first-image gate, stable host control-sequence cut, authentication, immutable capability and actual Resolume behavior in R4c/R4d. Existing update-loop and initialization-hang physical passes retain only their original bounded scope. R4b1 changes no current-control owner and claims no recovered pixels.

The registry will require the accepted `restart-intent.cjs` at runtime. Current `register.cjs` and `runtime-capability.cjs` check the three supervisor/registry/instance files; that is not proof of the new transitive closure. Before packaging or advertising Restart, R4c must include the ledger and its exact hashes in the immutable runtime inventory and prove missing-dependency rejection. R4b1 source/CPU acceptance does not authorize substituting new registry bytes into an older installed package.

Conductor commands used the exact installed executable/home with `require_escalated` and process-scoped checkout trust from the first call (CON-24/LUX-P1/P25). Git uses exact checkout `-C`, empty `core.excludesFile` and exact `safe.directory` (READ-P9/CON-P38). The worker used the current bound epoch/challenge, dynamic ready state and one successful claim; root reads that receipt before another child launch (P26). Submission uses `--commit FULL_SHA` and saved claim/session receipts (P62). The explicit CPU selection preserves P57. P49 applies to file discovery. No ESM import, compiler fixture or executable resolver was needed for planning, so P32/P35/P28 did not require a workaround. These corrections do not add authority.

Delivery is one planning document. Fresh independent review may reject this exact first-leaf contract. No production source, native transport or installed Restart action is delivered by LUX-78.
