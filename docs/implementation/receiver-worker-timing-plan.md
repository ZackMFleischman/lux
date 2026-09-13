# Receiver worker timing and paired diagnostic plan

> Fresh workers use conductor-worker and executing-plans for one assigned leaf. Root is sole coordinator and supplies independent reviewers; this document starts no additional team or graphics session.

**Goal:** obtain attributable, bounded receiver timing diagnostics while preserving accepted R1 cancellation/finalization and R2a ownership behavior. Establish a trustworthy measurement path before assessing a delivery improvement.

**Baseline:** LUX-29 specification 2, integrated main `3003a407cbd371ef89cd1ce018c76a2104a7c7a0`, isolated `codex/receiver-timing-plan`. R1 integration LUX-18 and R2a integration LUX-28 are accepted. Current source already calls `classifyCopyPoll`, contains diagnostic exceptions, gates attribution with current-run `beginSucceeded`, and retires obsolete Ready slots through the admitted helper. Planning edits only this document.

**Inputs:** [reliability plan](reliability-plan.md), [acceptance](tracer-acceptance.md), [performance design](../design/performance-monitoring.md). Retained timing source is read-only evidence, never a blanket merge instruction:

| Commit | Inspected behavior | Required adaptation |
| --- | --- | --- |
| `19761797b5baf0b07f4f9ec1ffbef1c717a44c34` | Fixed-capacity worker buffer, optional timing spans, native CPU registration/test | Apply only selected helper/instrumentation changes to current receiver; its historical copy loop would overwrite R1 cancellation classification. |
| `6e3f7649d1fe0bedce501ce223a946eefd8c04e8` | Separate pure JS timing inspector and negative tests | Preserve strict rejection and extend malformed-input/attribution coverage. |
| `30719ff8d235dfa373f3c8fc73fd3e10d7ed2004` | Requires independent child QPC lifetime/frequency | Preserve whole-loop envelope; a ten-second cadence window is a different interval. |

Read source in `.worktrees/receiver-worker-timing` at the last SHA; the retained experiment directories stay unchanged. Previous baseline/treatment each contain an incomplete timing span and fail strict timing inspection. Selected transport IDs, callback opportunities and ~15 ms observed one-ms sleeps explain an investigation, not actual fresh-image performance or a causal improvement. Neither run becomes valid by trimming startup/stop spans or replacing a failed inspection.

## Delivery split and ownership

1. **R2b-a, first executable leaf after plan review:** adapt bounded timing instrumentation and inspector with deterministic CPU tests and native receiver DLL build. No graphics, package preparation or performance claim.
2. **R2b-b, separate reviewed package/evidence plan:** prepare exact comparable baseline/treatment packages, complete source/vendor/compiler/runtime/binary manifests, authoritative child identity/envelope joins, frame provenance and diagnostic overhead method. This planning gate must settle how baseline differs only by the intended retirement treatment while both contain identical R1 and timing changes. Do not mechanically revert unrelated commits.
3. **R2b-c, separately reserved diagnostic:** one supervised root-exclusive graphics run at a time after package review; repeated paired workload/settings with calibrated observability. Preserve failures and cleanup evidence. Actual Resolume, sustained numerical acceptance and clean-machine delivery remain later gates in the reliability plan.

First leaf owns exactly these six source/test paths:

- New `native/ffgl-source/src/ReceiverWorkerTiming.h`.
- Modify `native/ffgl-source/src/FrameReceiver.cpp` only for opt-in timing wiring.
- Additive target/test registration in `native/CMakeLists.txt`.
- New `tests/native/receiver_worker_timing_test.cc`.
- New `tools/gpu-spike/receiver-worker-timing-inspect.mjs`.
- New `tests/unit/receiver-worker-timing-inspect.test.mjs`.

No changes to ReceiverRun.h, shared_ring.h, installed supervisor, source acquisition, SDK, renderer, compiler, public Studio controls, package launchers or acceptance thresholds. Root serializes the shared CMake hunk. LUX-7 remains blocked and is not retried. No portal work, dependency download, global timer/priority changes or busy-spin substitution.

## R2b-a fixed contract

Adapt the retained internal API: `ReceiverWorkerStage`, `ReceiverWorkerTimingKey`, `ReceiverWorkerTimingRecord`, `ReceiverWorkerTiming<Capacity=32768>` and `ReceiverWorkerTimingSpan<Capacity>`. One receiver worker owns each instance. No synchronization or shared writer is introduced. Each record remains at most 64 bytes; default allocation is at most 2 MiB, made once before the measured loop. No timing-owned allocation or I/O occurs inside a span/append. This does not assert the preexisting receiver itself never allocates or logs.

`initialize(bool requested)` resets all per-run records/counters and drops any previous allocation before selecting the requested state. Reinitialization occurs only when no span exists and the worker is quiescent. Production constructs a new buffer per run and initializes once. A failed nothrow allocation disables timing and produces unavailable/invalid evidence; it must not stop playback or pretend opt-out. Supply a narrow allocator-injection seam used by initialization so the CPU test deterministically forces null allocation, without global allocation hooks. It receives the fixed capacity and returns owned record storage; default uses `new(std::nothrow)`. No authored input selects allocator, capacity or clocks.

`stamp(Clock)` calls the injected nonthrowing clock only while enabled; disabled mode has zero extra QPC calls, records, allocation after initialization and timing output. Real clock returns zero on QPC failure or nonpositive result. Append validates start nonzero and end >= start, records exact generation/outputGeneration/frame identity, sequence and completion. Invalid clocks, overflow capacity, incomplete spans or failed allocation make the whole result invalid. Counters never wrap: saturate at uint64 maximum, retain a permanent invalid state on saturation, and never infer completeness from saturated totals. Failed attempts do not silently disappear from summary accounting. Keep the buffer bounded even after repeated overflow.

Span construction captures start; `finish(true)` records successful end once, `finish(false)` records interruption, and destruction calls the latter only if unfinished. Delete copy/move behavior that could double-finish. A clock failure is unavailable evidence, not a zero-duration sample. Nested spans may overlap: append order is completion order, so ends must be nondecreasing, while starts need not follow the previous end.

The five stages retain their exact names and meanings:

| Stage | Actual measurement boundaries and identity |
| --- | --- |
| `outer-sleep` | Around each existing worker-loop requested 1 ms sleep, including beginRead refusal; bind the pending import key when present, otherwise all-zero key. Excludes quarantine cleanup sleeps. |
| `local-copy-poll-sleep` | Around each existing requested 1 ms wait after R1 classifies Pending/Wait; bind selected import key. |
| `copy-submit-to-query-done` | Before CopyResource/End/Flush through successful query completion; includes nested poll sleeps. Stop, failure or deadline produces an incomplete span. |
| `nv-lock` | Immediately around successful driver lock return for the same import key; failure/exception produces incomplete. No claim that driver call is bounded. |
| `gl-fence-to-ready` | Before fence creation through actual completion, successful unlock and Ready publication for that key. Pending at loop exit remains incomplete; cleanup completion does not retroactively make Ready publication occur. |

Opt-in remains the process-local environment value `LUX_RECEIVER_WORKER_TIMING=1` (exact one-character value). All other values disable it. Do not set machine/user environment. Read it inside the R1 body, initialize timing before the loop and query QPC frequency only when enabled. Frequency failure remains invalid rather than aborting playback.

## Preserve lifecycle and attribution

Keep `runReceiverBody` and `classifyCopyPoll` unchanged, including Failed > Complete > Stop > Deadline precedence. Insert spans around the existing operations; never replace current control flow with the historical one-line polling loop. Copy ownership remains held until actual Complete. Retain R2a's admitted `retireObsoleteReadySources` and every lease/admission/unlock/fence/quarantine rule. Callback code remains untouched and nonblocking.

Current-run `beginSucceeded` is the only attribution gate. Reused activation objects can retain an old instance ID; nonempty identity alone is insufficient. Capture/reference the current successful instance while its lifetime remains valid; after `activation.end()` any saved view must still have documented ownership, otherwise take an owned snapshot before cleanup outside the measured loop. Never attribute timing rows after failed/throwing begin, even if it assigned an ID. Emit only an unattributed unavailable diagnostic if requested and no current successful activation exists; contain diagnostic exceptions.

Maintain a per-run body-completed flag, false initially and true only after normal loop exit reaches the end of the body. Dedicated cancellation thrown while copying leaves it false, although R1 correctly emits no failure row. A pending GL span is explicitly finished incomplete/reset after the body and before cleanup. A normal stop between operations may be complete; normal stop with pending work remains invalid. Do not change stop behavior to obtain a passing timing summary.

The host telemetry summary stays in R1's contained finalization before cleanup. Timing records and its single summary are written only **after** the existing GPU ownership cleanup and context destruction return. Contain write/flush exceptions separately; no repeated partial row writes. If cleanup quarantines or blocks forever, timing summary is absent and inspection must reject. Summary presence cannot itself establish the physical process-stop bound; the external supervisor supplies that evidence. Do not move timing output before cleanup to bypass this limitation.

Retain the row kinds/fields from the inspected helper: QPC ticks/frameId/frequency as unsigned-decimal strings, numeric safe generations and sequence/counts, exact 32-lowercase-hex instance, known stage, completion/boundFrame flags, requestedSleepMs=1 only for sleep stages. Summary includes capacity, attempted/recorded/lost/clock/incomplete counts, allocationFailed, aborted and valid. A nonempty complete recorded run with valid frequency, no losses/failures/incompleteness/saturation is required for valid=true. Rejected/invalid diagnostics retain honest counts; output never claims GPU duration.

## Inspector and CPU verification

Export `inspectReceiverWorkerTiming(rows, instanceId, frequency, envelope)` as in the retained source. Inputs are already parsed diagnostic rows from trusted local inspection, not a new service protocol; still reject malformed values without coercion. Require an array <=32769 rows, exactly one summary, 1..32768 records, exact identity, known row kinds/stages, booleans, finite safe integer counts/generations, contiguous sequences, matching attempted/recorded totals and summary capacity32768. Require explicit valid=true, no abort/allocation failure/loss/clock failures/incomplete spans. Decimal ticks must be strings in canonical unsigned uint64 notation; frequency >0. Do not let RegExp coerce numeric timestamps into accepted values.

Require an independent `{start,end,frequency}` child-lifetime envelope, exact matching QPC frequency, positive start/end ordered and every span fully inside it including boundary equality. Each record has end>=start, positive start and nondecreasing completion order. Unbound records have all-zero key; non-sleep stages require a nonzero frame and boundFrame=true. All observed durations are worker elapsed CPU/driver/scheduler time, overlapping nested spans are not summed into exclusive cost, and GPU duration is explicitly unavailable. Missing stages return null quantiles/count0, not invented samples.

Tests must include:

- Native red failure before adding the production header, then default bounds and small-capacity overflow; disabled clock call count/output; null allocation via the real initialization seam; quiescent true-to-false and false-to-true reset with no stale records.
- Production span completion once, explicit failure, destructor interruption, all five stage names/keys, nested completion order, zero/backward clocks, zero frequency, capacity equality/+1 and repeated overflow. Verify exact JSON fields with representative output, no valid summary after any invalid condition. Counters have checked saturation arithmetic by source review and a bounded arithmetic seam test if extracted.
- Production R1 boundary with simulated pending copy + Stop: no failure callback, incomplete timing span, one host summary attempt and cleanup sentinel. Repeat failed/deadline with real failure classification; `ImportOwnership` pending/failed must retain all resources, then Complete follows unchanged release order.
- Current-run begin false with an old ID, begin throwing before/after ID assignment, normal begin, normal exit, stop while GL pending. Test actual shared attribution/finalization seams wired by production, not only a duplicate decision expression in the test. If a helper is needed, place the narrow non-graphics timing finalization seam in the new timing header, not a broad lifecycle rewrite.
- Throwing stream/flush and absent/truncated timing output reject inspection without changing cleanup. Native output fixture feeds the JS inspector or an equivalent captured production-formatted fixture; identify its exact generating command/hash.
- JS positive nested spans for all five stages and boundary-equality envelope; missing/duplicate summary/record, unknown kind/stage, invalid/coerced ticks, mismatched identities/clocks, unsafe/negative numeric values, incomplete/aborted/overflow, missing envelope, out-of-envelope start/end, reversed clock, inconsistent binding and requested sleep. Confirm observed 1 ms request can yield 16 ms elapsed with gpuDurationMeasured=false.

No test executes authored visuals or a native graphics host. Use deterministic injected clocks and CPU ownership seams; these do not prove driver behavior.

## Exact native inputs and commands

Fresh worker starts from root's current main containing accepted R1/R2a, then claims its isolated checkout. Root prepares vendor sources from the reviewed retained FFGL source-only closure: canonical `.worktrees/transport/native/vendor/ffgl`, commit `fda8d4a5904eaf09dd97ac0f95c246bd7f9f9a46`. Copy only the 203-file `source/lib` manifest into the new checkout after comparing every SHA/length; no old build binaries or Git metadata. Canonical manifest `docs/conductor-onboarding/receiver-vendor-source-manifest.json` SHA256 `0C1925968568652331DC9E4245854D7C1B5D64D88AD59A9339A13AD6E1892356`. If provenance differs, stop that prerequisite and investigate; no downloads.

Use existing VS18 BuildTools CMake/CTest, generator `Visual Studio 18 2026`, x64, toolset `v145,version=14.50.35717`, Windows SDK10.0.26100.0. In this verified PowerShell host normalize duplicate Path/PATH only in the command process by preserving `$env:PATH`, removing Env:PATH, restoring `$env:Path`; never change global environment. New build cache uses Release /O2 /Ob2 /DNDEBUG; add `/UNDEBUG` for the new CPU assertion target, keep /EHsc /W4 /WX. Configure the worker's own native/build; inspect compiler/cache and no-op-disabled behavior, rather than assuming historical binaries match.

```powershell
& $cmake -S native -B native/build -G 'Visual Studio 18 2026' -A x64 -T 'v145,version=14.50.35717' '-DCMAKE_SYSTEM_VERSION=10.0.26100.0'
& $cmake --build native/build --config Release --target lux_receiver_worker_timing_test lux_source_slot_retirement_test lux_receiver_run_test lux_receiver_lifecycle_test lux_shutdown_race_test lux_shared_ring_test lux_context_handoff_test LuxTracerTR02
& $ctest --test-dir native/build -C Release --output-on-failure -R '^(receiver_worker_timing_cpu|source_slot_retirement_cpu|receiver_run_cpu|receiver_lifecycle_cpu|shutdown_admission|shared_ring_ownership|context_handoff_cpu)$'
& 'C:/Program Files/nodejs/node.exe' --test tests/unit/receiver-worker-timing-inspect.test.mjs tests/unit/cadence-inspect.test.mjs
```

Guard every native exit code before the next command. Retain failing and passing logs, active assertion/compiler flags, vendor digest and resulting DLL/test hashes. Do not invoke standalone host or native-cadence options here; DLL compilation is not hardware validation. Worker commits exactly six listed paths, submits source SHA with criteria evidence, stops its session and ends. Independent reviewer checks source/wiring and repeats meaningful CPU checks. Root then performs a separately tracked serial integration and combined validation at exact landed SHA.

## Later measurement gates remain explicit

R2b-b must define exact installed/runtime/binary source provenance for both arms, same visual revision/resolution/quality/cadence/warmup/duration/driver/host settings, complete child instance/PID/QPC envelopes and physically supervised cleanup. Prepare bounded storage and record stream truncation/loss/failure; do not overwrite retained raw evidence. Compiler/vendor input digests must trace all staged binaries; commit:null remains unavailable source attribution until repaired by actual build evidence.

R2b-c needs root's exclusive graphics reservation and independent package review. Repeated paired runs require order controls and uncertainties; a single cold baseline/treatment is insufficient. Distinguish transport selection from rendered-image freshness, join producer render/source/output/consumer identities and state unavailable where pixels are unverified. Diagnostic timing is opt-in and its perturbation uncalibrated until monitoring-on/off work-duration evidence supports a claim; CPU sleep measurements do not establish GPU cost or <2% routine overhead.

Do not force a timing pass by omitting an incomplete stop span, weakening strict inspector, using only an interior window or counting summary emission as clean exit. A separately designed bounded acquisition interval, if needed later, requires its own reviewed semantics and raw complete-loop context. Existing 30 s warmup +300 s sustained acceptance and actual-host feature/fault/soak/clean-machine requirements remain unchanged. Safe R2a ownership is already accepted independently of performance, and R2b-a acceptance likewise means instrumentation correctness, not faster delivery.

## Review handoff

Independent plan critique must challenge retained/current control-flow reconciliation, begin attribution, incomplete stop semantics, nested-span order, allocation/counter bounds, post-cleanup output reachability, malformed JS inputs, exact native prerequisites and the separate causal/hardware gates. Significant findings receive a versioned root synthesis before first-leaf dispatch. No future leaf is executable solely because it appears in this plan.
