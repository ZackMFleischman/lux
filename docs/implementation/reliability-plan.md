# Reliability implementation plan

> **For agentic workers:** Use `conductor-worker` for one assigned leaf and `superpowers:executing-plans` for its steps. Root dispatches fresh workers and independent reviewers. This planning ticket does not authorize implementation, another worker, a graphics session or integration.

**Goal:** Make exported delivery and failure diagnostics reliable, then establish the remaining show-readiness evidence without blocking independent creative development.

**Architecture:** Preserve the bounded native ownership ledger, immutable installed runtimes and host-authoritative controls. Repair evidence-producing lifecycle paths before judging delivery changes; separate CPU correctness, native fixture diagnostics, actual Resolume behavior and clean-machine distribution acceptance.

**Tech stack:** Windows x64, C++20/MSVC, D3D11/WGL interop, Node.js evidence inspectors, Electron installed supervisor, QPC clocks.

**Spec:** [Roadmap workstream 4](roadmap.md), [preview closeout](tracer-preview-closeout.md), [tracer acceptance](tracer-acceptance.md), [performance design](../design/performance-monitoring.md), [PROGRESS](../../PROGRESS.md). The 13 September user amendment recorded in main's `docs/conductor-onboarding.md` authorizes lanes 3/4 and supersedes the roadmap's older paused wording. It does not waive numerical gates.

## Scope and provenance

Plan version 2, LUX-10 specification revision 2. Original inspection on 13 September 2026 UTC by `/root/reliability_plan`, stable agent `8b1e7545-02c3-449b-8d45-a2451e5c81b0`, session `679835f9-243d-4aaa-a7b8-0774cbd13c0b`. Claim `177b40ed-4e02-4e81-ad2c-65ef144545a4` recorded the isolated checkout `C:/Users/zFlei/repos/lux/.worktrees/reliability-plan`, branch `codex/reliability-plan`, baseline `f95f3975892bf612bb63b94111893b18b84fff20`. Root coordinator synthesized independent review findings under ordinary claim `f718ff8c-0f4b-43ef-a4ec-ac7a15283618`; original source and rejection remain preserved. A focused independent recheck must approve this exact revision before dispatch.

This commit changes planning/evidence only. No native host, Studio, Resolume or GPU execution occurred. No dependency installation was needed. The executable analysis uses `C:/Program Files/nodejs/node.exe` and reads existing logs without invoking their launchers or overwriting their `inspection.json`.

### Current source versus retained experiments

[Source inventory](../../.superpowers/conductor/LUX-10/source-inventory.json) records exact heads and dirty paths. Git inspection used exact `-C CHECKOUT -c core.excludesFile= -c safe.directory=CHECKOUT`; no global trust changed. The installed Conductor executable/home used `require_escalated` on every call (CON-24). The exact process-local `safe.directory` correction succeeded in this worktree; LUX-P1's main-only correction was not treated as blanket trust.

| Checkout / branch | Observed full HEAD | State and meaning |
| --- | --- | --- |
| main | `6726f5e420e4136082c864ff85e3216976b3cb63` | Untracked `.pnpm-store/`, `visuals/` preserved. Root's coordination docs follow the planning code baseline; `FrameReceiver.cpp` is identical to this plan baseline. |
| receiver-worker-timing | `30719ff8d235dfa373f3c8fc73fd3e10d7ed2004` | Only untracked `artifacts/`; timing baseline code, no source-slot fix. |
| receiver-timing-treatment | `24afa99e32af81ed2466a386574b43234b20f1a7` | Only untracked `artifacts/`; timing plus source-slot fix. |
| source-slot-retirement | `8c55c506bacf9e6511d1cd19360c8ccc6042db8c` | Only untracked `artifacts/`; the isolated ownership fix and its original red/green logs remain. |
| parameter-integration | `ab32b165c6123b908039a8c2a243606df4dffa0b` | Only untracked `artifacts/`; pending timing/source-slot integration is still excluded from main. |

All four retained branch heads fail `merge-base --is-ancestor HEAD main` (exit 1). Baseline versus treatment branch trees differ in precisely four files: `native/CMakeLists.txt`, `native/ffgl-source/src/FrameReceiver.cpp`, `native/texture-bridge/include/shared_ring.h`, `tests/native/source_slot_retirement_test.cc` (81 insertions). The candidate retires only older Ready source slots after acquiring ownership/admission; it preserves the selected Reading slot, newer/equal/invalid publications, other readers, Writing slots and shutdown admission. Its historical `artifacts/native-red.txt` reports one failing source-slot test among 16; `artifacts/native-final.txt` reports 16/16 CPU checks and explicitly `gpuTested:false, hostTested:false`. This is retained historical evidence, not a fresh test of main or proof of throughput.

Before any later integration, root must re-inspect actual HEADs/dirty state and obtain an independent ownership review. Do not cherry-pick the entire parameter-integration branch merely because a launcher exited successfully.

### Raw experiment reconciliation

Raw roots are retained at:

- Baseline: `C:/Users/zFlei/repos/lux/.worktrees/receiver-worker-timing/artifacts/receiver-timing-baseline`, experiment `9ed6224f-ab31-46bb-a3a0-e93530356f68`.
- Treatment: `C:/Users/zFlei/repos/lux/.worktrees/receiver-timing-treatment/artifacts/receiver-timing-treatment`, experiment `f6ee6d77-1079-459a-9ece-a69f103c3108`.

Each root's `configuration.json`, `last-experiment.json`, `cadence.cadence.json`, `receiver.jsonl` and exact installed attempt lifecycle file were read. [Analysis JSON](../../.superpowers/conductor/LUX-10/receiver-analysis.json) holds SHA-256 hashes, identities, lifecycle rows, exact QPC endpoints and inspector outcomes. [Reproduction script](../../.superpowers/conductor/LUX-10/analyze-receivers.mjs) calls retained pure inspectors; it writes only this worker's journal. The original baseline `inspection.json` remains failed with `Missing exact instance`. Treatment had no saved `inspection.json` to replace.

Source provenance is deliberately split: baseline configuration records prepared source `6e3f7649d1fe0bedce501ce223a946eefd8c04e8`, whereas its retained branch HEAD is later `30719ff...`; treatment records `24afa99...`. Both supervisor manifests have `commit:null`. Their manifests contain reviewed binary/source hashes and concrete child observations, but a branch HEAD is not proof that its full tree built every staged binary. Both configurations name visual revision `cee01f784742b5f445229b1dc2312ac0b4a951cd95e8a9fb0ae0b35e4b5749ab`; release/runtime IDs differ and remain in the analysis. A future causal comparison must reconcile complete package/build inputs, not infer equivalence from the visual hash alone.

| Observed fact | Baseline | Treatment | Permitted interpretation |
| --- | --- | --- | --- |
| Child lifetime / outer result | PID 27684, exit 0, no timeout/cancel/forced stop, cleanup true | PID 22432, same result flags | Bounded native fixture process containment only. |
| Independent window / joins | 10 seconds, 600 slot-to-callback QPC joins | 10 seconds, 600 joins, no missed slots | Cadence opportunities; these are not 600 control changes. |
| Host summary | Missing; one `local D3D copy deadline` failure | One exact instance summary, recorded 600, lost 0; no failure row | Baseline is incomplete; treatment passes the unchanged cadence inspector for its bounded fixture. |
| Selected / held / empty transport opportunities | 143 / 209 / 248 | 170 / 170 / 260 | Descriptive cold-start transport identities, not fresh rendered images or causal improvement. |
| Callback elapsed p95 | 0.2875 ms | 0.3056 ms | Includes descheduling/driver time; no exclusive CPU or 300-second acceptance. |
| Complete outer-sleep median | 15.5283 ms | 15.4559 ms | Requested 1 ms; elapsed waits include scheduler delay, not GPU execution. |
| Complete local-copy poll-sleep median | 15.2600 ms | 15.3054 ms | A plausible polling bottleneck remains in both. |
| Timing summary | 1168 records, 1 incomplete span, aborted true, valid false | 1156 records, 1 incomplete span, aborted false, valid false | Both strict worker-timing inspections reject `Timing evidence incomplete`. |

Baseline's incomplete copy span starts QPC `743639087345`, after window end `743639033439`. Treatment's incomplete GL-to-ready span starts `747205739418` before window end `747205862904` and ends `747205893644` after it. Do not trim these records and describe whole-loop timing as valid. Both attempt logs contain restart-trigger and normal stop-requested but no per-attempt process-exit-observed row; outer Job cleanup is separate evidence, not a fabricated attempt exit record. Timing summaries report zero lost records and clock failures but remain invalid due to incompleteness.

The analysis's maxima between selected transport IDs (83.7097 / 66.5369 ms) exclude startup and do not measure repeated underlying render images, window-edge gaps or the acceptance longest fresh-image gap. They are retained diagnostic calculations only. These two unpaired cold runs, incomplete baseline and uncalibrated timing perturbation support no accepted performance delta.

## Global constraints and shared ownership

- Keep the original reference workload/settings and numerical targets in `tracer-acceptance.md`; do not silently lower quality or redefine freshness.
- GPU duration remains unavailable where timestamps omit uploads/copies or lack demonstrated frame attribution. CPU waits never substitute for GPU timing.
- Never release a pending/failed D3D copy, GL fence, producer lease, admission, registration or texture without the existing completion proof. Keep quarantine behavior when safe unload is unavailable.
- FFGL callback remains nonblocking with no intentional producer/texture wait or new per-frame CPU readback/upload.
- All graphics/Studio/Resolume sessions need root's exclusive reservation, reviewed exact binaries and supervised cleanup. CPU planning and focused native CPU tests may run independently.
- C02/LUX-8 owns visual-worker, compiler/SDK/artifacts, runtime-contracts/index.ts, authored-worker-assets, public admission, transport-release/package guards and the narrow project-v1 gate. Native2a/LUX-7 owns native/project-files and core/project/filesystem.ts. First reliability leaf touches neither lane's contracts.
- `native/CMakeLists.txt` is an additive shared registration point: agree the small hunk with Native2a and serialize integration. Do not widen a receiver repair into native filesystem work.
- Later instrumentation integration touching C02 files waits for its landed contracts and a new explicit ownership checkpoint. New SDK/parameter/asset/MCP author behavior requires matching repository skill update, install and `--check`; the first native diagnostic leaf changes none.
- Small reviewed source commits go to root for serialized merge and combined tests. No worker merges or pushes. One ticket/session per fresh worker.

## Ordered delivery slices and evidence contracts

This is the whole-lane sequence. Only R1 below is specified for immediate leaf preparation; later slices require fresh bounded plans from their listed prerequisites. Their broad file lists identify owners, not blanket edit permission.

| Slice / owner | Scope and dependencies | Setup, validation and expected evidence |
| --- | --- | --- |
| R1 native diagnostics | Stop/copy outcome distinction and host summary finalization. Independent of C02; see executable plan below. | Deterministic CPU tests use actual production helper and ImportOwnership. Independent review + native DLL build prove integration; hardware stop behavior remains untested until R2. |
| R2 retained delivery change | Independently review/adapt source-slot retirement from `8c55c50`; reconcile timing commits and R1 together without overwriting branches. Native receiver/shared_ring owner. | Re-run source-slot/admission/ownership CPU negatives; exact mixed-source build/package manifest. Then one root-reserved paired diagnostic with equal source/settings and fresh-image provenance. Preserve all runs, failures and cleanup. Accept safe ownership independently of performance; improvement claim requires comparable measured image delivery. |
| R3 polling and frame freshness | After R2, choose a bounded worker wake/poll strategy using the observed ~15 ms sleeps. Avoid speculative busy-spin or global timer changes. | CPU injectable wake/deadline/stop tests, idle-CPU accounting; separately reviewed hardware pilot attributing paint/source/output/consumption identities, drops, waits and gap bounds. Keep last completed image on producer loss. Only measured results determine follow-up tuning. |
| R4 installed recovery policy | Preserve automatic retry/current-control behavior; prepare explicit restart control/API semantics as a separate product decision. Installed supervisor/instance plus native activation owner; coordinate later Studio/public surfaces. | Reuse recorded update/startup hang and automatic-retry evidence from parameters-images-studio. Fresh CPU retry exhaustion/coalescing/stop/multi-instance tests and serialized native/actual-host injections: current version/generation wins, exactly intended replacement, saved source intact, <=2 s physical JS stop, explicit restart-to-current-image <=5 s. No existing installed Restart action is claimed. |
| R5 resource accounting and soak | After R2/R4 lifecycle contracts; native imports/output pools, installed processes, renderer resource owner registry. C02-dependent renderer instrumentation waits. | Count allocations/live references, leases, queries, processes and queues by generation; distinguish estimates from actual VRAM. CPU failure/overflow/retirement fixtures; serialized lifecycle cycles and later 60-minute soak with 1 Hz counts. Equal phases return to baseline, bounded caches plateau, no unexplained growth or incomplete records. |
| R6 complete measurement method | Native/renderer telemetry after owner agreement; performance design negative fixtures precede measurement. | Establish GPU query coverage/clock calibration/frame attribution or explicit unavailable; validate overflow/truncation/disjoint/pending/cross-tool fixtures. Bounded external trace is investigative. Paired monitoring on/off work-duration runs with uncertainty must support <2% routine overhead; vsync intervals and +0.329% direct-query diagnostic alone do not. |
| R7 sustained acceptance | Depends R3/R5/R6 for the metrics being claimed. Can advance independent host behavior before full performance readiness. | Exact reference 1920x1080, 60 Hz, 30 s warmup + full 300 s measurement; separate host-only budget and concurrent Studio UI runs. Measure actual freshness >=99%, no unexplained >100 ms gap, observed cadence 59.4–60.6/s, CPU/GPU/UI/connection/callback budgets from acceptance. All 600 normal-rate control versions must join receipt/render/consumed pixels; eight intrusive readbacks and 600 callback opportunities do not suffice. |
| R8 real host feature/fault coverage | Exact installed releases and frozen controls; R4 for explicit recovery behavior. | Real Resolume five-control Spike Sphere gestures/save/reopen, independent duplicate sources, remove-one preservation, Studio open/close independence, current controls after faults, alpha/orientation and cold reopen. Record host/version/adapters/captures and measured clocks where required. Prior image/reopen user checks remain bounded historical passes. |
| R9 isolated distribution | May prepare independently of R2–R8; execute against an exact reviewed release after runtime closure is frozen. Package/deployment ownership coordinated with C02. | Clean machine or genuinely inaccessible checkout/tools/network, user identity/environment/access evidence, immutable old/new release hashes, cold reopen and two independent sources. A private directory or dependency audit on this development machine does not meet isolation. Do not rename/delete the user's checkout as a shortcut. |

For each slice's submission, record executor, exact checkout/commit, package/binary hashes, required setup, raw artifact paths, command/outcome, criterion status and remaining host QA separately. Independent validator must inspect setup and raw evidence. Missing preconditions mean incomplete, even if a launcher or unit suite passes. R7 budgets and R9 clean-machine constraints are not gates on unrelated creative work.

## R1: first independently implementable leaf

**Proposed ticket:** Distinguish requested receiver stop from copy failure and always finalize host diagnostics.

**Why this first:** The current main receiver throws `local D3D copy deadline` when either `stopRequested()` becomes true or the two-second poll deadline expires. Its only host-summary write is inside the success `try`, so an exception omits it. R1 repairs this confirmed source path without adopting the still-unreviewed source-slot change or changing worker scheduling. Alternatives are to start with slot retirement (useful but presently confounded by diagnostic gaps) or tune polling (requires new controlled graphics measurements). R1 provides the cleanest independently testable foundation.

### Files and interfaces

- Create `native/ffgl-source/src/ReceiverRun.h`: small platform-neutral copy decision and exception/summary helper; use existing `Completion` from `ReceiverLifecycle.h`.
- Modify `native/ffgl-source/src/FrameReceiver.cpp`: use those helpers at its D3D polling loop and top-level run boundary, finalize `drainOpportunities`/host summary exactly once after normal/stop/failure body exit and before `activation.end()`/`detach()`.
- Create `tests/native/receiver_run_test.cc`: deterministic outcome, failure and summary tests invoking actual helper functions; use explicit CHECK failures, never assertions disabled by Release.
- Modify `tests/native/receiver_lifecycle_test.cc`: cover cancelled pending copy followed by failed or completed cleanup using actual `ImportOwnership` and its existing fake operations.
- Modify `native/CMakeLists.txt`: additive `lux_receiver_run_test` / `receiver_run_cpu`, C++20, source include directory, 30-second timeout. Coordinate this registration hunk.
- Modify `native/LIFECYCLE.md`: distinguish stop classification, summary completeness, resource completion and outer process cleanup. Do not revise previous artifacts or mark physical timing passed.

Consumes: existing `Completion::{Complete,Pending,Failed}`, `WorkerLifecycle::stopRequested()`, `ImportOwnership::cleanup(Ops&)`, QPC host-opportunity buffer and existing cleanup path. Produces an internal diagnostic behavior only; no package ABI, shared-ring version, SDK, control or public API change.

Suggested minimal interface (review the exact implementation before coding):

```cpp
// ReceiverRun.h, inside namespace lux, includes ReceiverLifecycle.h and <exception>.
enum class CopyPollAction { Complete, Wait, Stop, Failed, Deadline };
constexpr CopyPollAction classifyCopyPoll(Completion result, bool stop, bool expired) {
  if (result == Completion::Failed) return CopyPollAction::Failed;
  if (result == Completion::Complete) return CopyPollAction::Complete;
  if (stop) return CopyPollAction::Stop;
  return expired ? CopyPollAction::Deadline : CopyPollAction::Wait;
}
struct ReceiverStopRequested {};
template<class Body, class OnFailure, class Summary>
void runReceiverBody(Body&& body, OnFailure&& failure, Summary&& summary) noexcept {
  try { body(); }
  catch (const ReceiverStopRequested&) {} // Only the classified pending-copy stop.
  catch (const std::exception& error) {
    try { failure(error.what()); } catch (...) {} // Diagnostics cannot skip cleanup.
  }
  catch (...) {
    try { failure("unknown worker exception"); } catch (...) {}
  }
  try { summary(); } catch (...) {} // One attempt, never a retry after partial output.
}
```

Use the existing error text for actual query failure/deadline. Stop action throws only the dedicated marker to leave the nested polling loop and skip downstream retirement/NV lock/publication. The exception is internal flow control; cleanup still receives `copyPending=true`, lease/admission intact. Failed completion wins over a concurrent stop; a completed query remains completed; pending stop wins over an expired poll deadline so normal cancellation is distinguishable. Do not blanket suppress a failure merely because stop is currently requested.

The helper wraps the same main body currently guarded by the try/catches, including drawable/device setup and `activation.begin()`. Move zero-initialized opportunity counters and the drain closure into the enclosing run scope before the helper, capturing references; do not change the queue, cap or counting policy. The closure may allocate strings and throw even when stream exceptions are disabled. Contain each failure/summary callback independently as shown, so the existing `activation.end()` and `detach()` ownership/quarantine path remains reachable after callback failure. Passing callables by forwarding reference avoids helper-owned copies; production captures use references and no allocating setup. This does not make unrelated initialization outside the boundary, cleanup itself or stuck driver calls nonthrowing/bounded.

`InstalledActivation` persists across runs and `end()` does not clear its instance ID. Hoist a current-run `beginSucceeded=false`, setting it true only after `activation.begin()` returns successfully. Gate attributed opportunity draining and the host summary on this flag, never just on a nonempty ID. If setup fails before begin or begin throws (even after allocating a new ID), finalization emits no attributed summary/opportunity rows; record an unavailable initialization diagnostic if logging works. This conservatively excludes partial setup evidence and prevents reuse of a previous run's ID. Test a reused activation with an old nonempty ID, failure before begin, and begin throwing before/after ID assignment: no attributed row, one finalization attempt, and continued cleanup handoff. The flag resets for each run. A failed stream or callback leaves diagnostics unavailable/possibly truncated: do not retry a partially emitted row, clear stream errors to claim success, or treat swallowed diagnostic exceptions as valid evidence. Exactly-once means one finalization attempt after the body returns/throws through this boundary; it is not a guarantee of a parseable summary under I/O/allocation failure. Summary writes precede GPU cleanup and cannot prove its completion. Preserve strict rejection of failure rows and incomplete timing spans.

**Failure JSON formatting:** There is no existing native escaping helper in the inspected receiver. Add an internal production-used formatter in `ReceiverRun.h`, for example `writeReceiverFailure(std::ostream&, const char*)`, that emits the unchanged failure-row fields with a bounded JSON string. Scan at most 1024 input bytes (no unbounded `strlen` or allocation); escape quote/backslash and all bytes outside printable ASCII using deterministic JSON escapes (`\u00XX` for controls/high bytes), use a fixed visible truncation suffix, and handle a null reason as a fixed unknown message. This deliberately renders non-ASCII bytes as escaped byte values for bounded valid JSON rather than claiming Unicode-preserving text. The formatter may propagate stream exceptions only into the contained failure callback above. Test exact output through this same production formatter for quote, backslash, newline, tab, NUL termination, other control bytes, high bytes, null and truncation; no partial record is accepted when the stream throws. Do not edit public formats or C02 code.

### Steps and tests

- [ ] **1. Reconstruct and freeze the leaf.** Fresh worker starts from root's current integrated main, confirms no receiver owner, reads this plan, claims its new ticket and records exact source/dirty inventory. Root obtains independent critique of this plan before dispatch. Coordinate only the CMake registration hunk with Native2a. No graphics reservation is needed for CPU implementation.
- [ ] **2. Add production-helper regression tests and observe red.** New test enumerates all 3 completion values x 2 stop values x 2 deadline values, including simultaneous failed+stop+deadline. Compile the new test before creating the header: expected failure is missing `ReceiverRun.h`. Record the failing command/source, not a historical log.
- [ ] **3. Implement the helper and use it in the actual receiver.** Add the outcome and independently contained diagnostic policy above, move counters/drain into enclosing scope, and implement the bounded production-used failure JSON formatter. Make summary the common finalization callback. Verify source has no duplicate host-summary call, no fabricated pre-instance summary, and all body exceptions pass through the helper before unchanged ownership cleanup.
- [ ] **4. Exercise behavior through the shared seam.** Test normal return, dedicated stop, `std::runtime_error("local D3D copy deadline")`, `std::runtime_error("local D3D copy query failure")`, and `throw 7`. For each, assert summary attempt count 1; failure attempts respectively 0,0,1,1,1 with the expected reason. In the stop case, a sentinel after the throw stays unexecuted. Capture order: failure, summary, then a caller cleanup-handoff sentinel. Repeat with failure callback throwing, summary callback throwing, both throwing, and stream failure; summary is attempted once and the cleanup handoff always executes. Cover no-instance and begin-created-instance setup outcomes without claiming actual host execution. Test all JSON escaping/bounds cases above. A CPU fake callback is a seam used by production, not a second copy of its decision logic; reviewer checks actual captures/wiring and attribution.
- [ ] **5. Prove cleanup ownership remains independent.** Start `ImportOwnership{true,true,true,false,false,true}`. After classified stop, Pending cleanup may call only `poll-copy`; no retire/end-admission/unregister/release. Failed cleanup also retains ownership. After Complete, expect exactly `poll-copy, retire, end-admission, unregister, release`. Keep existing GL-pending/unlock/unregister negative tests. No completion is inferred from cancellation or summary emission.
- [ ] **6. Build and run focused CPU checks.** Use installed VS discovery from `scripts/native-build.ps1`, CMake generator `Visual Studio 18 2026`, x64 toolset `v145,version=14.50.35717`, Windows SDK `10.0.26100.0`. Configure in the worker's own `native/build`, build only listed CPU targets plus `LuxTracerTR02`; do not run the standalone host. Commands below give the exact target/test set and must guard each native exit code before proceeding. Before dispatch, root must arrange and record reviewed exact FFGL source inputs: `native/vendor/ffgl/source/lib/FFGLSDK.cpp`, `glsdk_0_5_2/glload/source/gl_load.c` and their include/source closure. They are absent in main and this planning worktree, present in retained receiver-worker-timing. CMake requires both named source files at configure time even for CPU-only target selection. An isolated copy of the inspected existing source closure may be prepared after provenance/hash verification; record the complete source tree digest, source location and destination comparison, never copy old build output or claim an upstream revision without evidence. This authorizes no dependency download, tool installation or host launch. Node headers/library belong to the unselected bridge target and are not a prerequisite for `LuxTracerTR02` itself. If reviewed inputs cannot be established, block the required native build criterion rather than calling the implementation complete.
- [ ] **7. Record and hand off.** Update lifecycle documentation, run diff whitespace/scope checks, commit the bounded source/test/docs change. Submit criterion evidence with CPU versus untested hardware separation, then stop the session. Root supplies an independent reviewer and serializes integration. Combined main check must run at the landed SHA before R2 consumes it.

Example seam test body (the new native file defines CHECK as in `receiver_lifecycle_test.cc`):

```cpp
int summaries = 0, failures = 0, continued = 0;
lux::runReceiverBody([&] {
  auto action = lux::classifyCopyPoll(lux::Completion::Pending, true, false);
  if (action == lux::CopyPollAction::Stop) throw lux::ReceiverStopRequested{};
  ++continued;
}, [&](const char*) { ++failures; }, [&] { ++summaries; });
CHECK(summaries == 1 && failures == 0 && continued == 0);
CHECK(lux::classifyCopyPoll(lux::Completion::Failed, true, true)
      == lux::CopyPollAction::Failed);
CHECK(lux::classifyCopyPoll(lux::Completion::Pending, false, true)
      == lux::CopyPollAction::Deadline);
```

After locating `$cmake` and `$ctest` with the checked-in script's VS discovery (do not run the script's broad build automatically):

```powershell
& $cmake -S native -B native/build -G 'Visual Studio 18 2026' -A x64 -T 'v145,version=14.50.35717' '-DCMAKE_SYSTEM_VERSION=10.0.26100.0'
& $cmake --build native/build --config Release --target lux_receiver_run_test lux_receiver_lifecycle_test lux_shutdown_race_test lux_shared_ring_test lux_context_handoff_test LuxTracerTR02
& $ctest --test-dir native/build -C Release --output-on-failure -R '^(receiver_run_cpu|receiver_lifecycle_cpu|shutdown_admission|shared_ring_ownership|context_handoff_cpu)$'
& 'C:/Program Files/nodejs/node.exe' --test tests/unit/cadence-inspect.test.mjs tests/unit/native-cadence-options.test.mjs
```

Expected: new receiver_run CPU tests plus all named existing tests pass; native receiver DLL compiles. JS inspector negatives continue rejecting absent summaries/failures/invalid clocks. Record exact output and final source commit. Do not count compilation of the DLL as actual WGL/D3D execution or claim a physical stop bound. Graphics follow-up belongs to R2's separately reviewed/root-reserved run.

### R1 acceptance contract

| Criterion | Required setup / execution / observation | Responsible stage and artifact |
| --- | --- | --- |
| Correct stop versus failure outcome | Production-used CPU helper; complete matrix including races. Stop emits no spurious copy-deadline failure, real failed/deadline cases retain precise failure. | Fresh worker CPU implementation; exact test log/commit. Independent reviewer checks real receiver wiring. |
| Final host diagnostics after body exits | Shared production boundary, normal/cancel/known/unknown failure and diagnostic-callback failure injections; exactly one finalization attempt, valid instance attribution, bounded JSON escaping, unchanged counts/loss. Failure precedes summary; caller cleanup handoff continues even if callbacks throw; no resumed body after cancellation. | CPU tests + review of FrameReceiver use; failed-output and pre-instance limitations recorded. |
| No premature release | Existing ledger receives pending/failed copy after stop; no release before Complete, then exact established cleanup order. Existing GL/ownership negatives pass. | Native CPU tests and independent ownership review; this proves model behavior, not driver completion. |
| Source implementation remains coherent | Starting main recorded, isolated build of changed receiver using inspected/hash-recorded vendor closure, exact shared CMake hunk coordination, existing inspector rejection tests pass. | Worker source commit and focused build/test logs; independently reviewed worktree acceptance, not landed-main acceptance. |
| Honest remaining evidence | No new hardware test in R1; preserved raw hashes and failures unchanged; runtime timing/actual-host/freshness/clean-machine gates remain incomplete. | Worker handoff + independent review, with R2/R4/R7/R9 follow-ups. |

Root creates a separate integration follow-up after source acceptance. It records included reviewed commits, the exact landed main SHA and combined focused build/test logs, and resolves shared CMake changes serially. R2 depends on that integration evidence. R1 source acceptance does not depend on a later root merge; neither stage claims the other stage completed.

## Plan completion and review handoff

LUX-10's planning evidence is this versioned plan, the source inventory and reproducible read-only analysis. Self-review checked whole-lane coverage, owner boundaries, first-leaf exact files/test targets, preserved numerical requirements and raw-artifact support. The plan author cannot supply its independent critique. Root should ask a fresh reviewer to assess: cancellation precedence, actual helper wiring, summary-versus-cleanup semantics, experimental causal limits, CMake ownership, restart product decision and the distinction between CPU delivery and later hardware acceptance. Significant findings require a new plan version and disposition before implementation.

Version-2 review dispositions: round-1 P2 diagnostic containment is addressed by separate catch-all callback attempts, reference captures, hoisted counters/drain, truthful pre-instance behavior and throw/order tests. P2 missing escaping is addressed by the new bounded internal formatter and production-seam tests. P2 circular integration acceptance is split into source and root-owned integration stages. P3 missing vendor prerequisites are named and made an inspected/hash-recorded pre-dispatch requirement. Original review remains at `C:/Users/zFlei/repos/lux/.worktrees/_coordination/reviews/LUX-10/review-r1.md`; this disposition records proposed corrections, pending exact independent recheck.
