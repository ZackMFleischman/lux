# Performance acceptance implementation checkpoint

2026-09-12; inspected integration code at `26fc023` plus the current fixture preparation changes. This audit does not run a hardware benchmark. [Performance design](../design/performance-monitoring.md) owns measurement semantics and [tracer acceptance](tracer-acceptance.md) owns numerical gates.

## Current coverage

| Gate / measurement | Actual implementation and evidence | Missing work |
| --- | --- | --- |
| Installed startup | `scripts/test-installed-package.mjs` times supervisor readiness; user observed process-cold source startup around one second per copy. | Monotonic trigger-to-first-correct-consumed-frame, cold/warm/additional-source separation, release/control identity. Supervisor readiness and manual estimates cannot pass the source timing gate. |
| Host cadence / fresh delivery / gaps | `native/ffgl-source/src/FrameReceiver.cpp` increments callbacks in acquireLatest and consumed on fresh selection; receiver thread logs periodic totals. | Full independent 300-second coverage, per-opportunity timestamps/identities, generation-aware repeats/skips/gaps, loss reconciliation. Aggregate snapshots cannot establish a maximum gap. |
| Host callback cost | `LuxSource.cpp::ProcessOpenGL` executes native draw path. | Entry/exit QPC spans and bounded off-thread collection; no current per-callback duration probe found. |
| Connection delay | `shared_ring.h::SharedSlot` includes completeQpc, assigned by texture bridge completion. | Preserve completion provenance through output selection and record exact host-consumption time; QPC frequency/clock metadata and calibrated endpoints. |
| Control latency | Ring publishes a finite scalar control atomically; worker has controlSequence; render-host logs control observations. User sees Intensity respond. | Ring source frames do not carry control sequence or revision IDs. Add versioned receipt/render/consumption correlation and a real host driver for the 600-version test. Scalar snapshots cannot prove each update appeared. |
| Visual CPU update/submission | Studio visual worker calls update/render; current status has unavailable FPS gauges. | Separate monotonic update and submit spans correlated per frame, then aggregate per-frame durations before quantiles. No current complete measured CPU gate. |
| Visual / bridge GPU cost | Actual native GPU image path exists; no timestamp-query acceptance collector found. | Capability request/probe, valid asynchronous GPU query pool, complete pass attribution and sample coverage; unsupported stays unavailable. |
| UI response | Existing Playwright smoke tests observe layout, disabled-state and fullscreen behavior. | Correlated input-to-acknowledgement presentation traces under load; DOM or rAF is a proxy, not confirmed physical presentation. |
| Watchdog stop / recovery | Studio deterministic watchdog tests and local restart request-to-ready sample (~181 ms); installed startup/heartbeat/progress watchdog tests; manual removal and cold reopen succeed. | Independently observed execution exit/GPU cleanup and current-host-value consumed recovery after injected failure. Native stop joins/retains ownership after an unsupported-unload report, so its two-second assessment is not bounded stop completion. |
| Collection validity / overload | `tools/gpu-spike/recorder.cjs` has a bounded record-count queue and lost/error fields. Render-host main retains up to 10,000 records and logs copies/control/startup. | End-to-end loss/byte budgets and incomplete manifests; main retention is not complete acceptance coverage. Recorder close can wait indefinitely for blocked I/O and is not the designed full collector. |
| Clocks / quantiles / accounting / overhead | `packages/runtime-contracts/src/telemetry.ts` currently defines preflight readiness only. | Acceptance schemas, offline evaluator and negative fixtures; paired baseline/routine measurements and uncertainty. `test:acceptance` still intentionally routes to an unavailable script. |

The diagnostic evidence in `evidence/tracer-0.1` remains useful for feasibility and failure analysis; no complete quantitative acceptance report or corresponding evaluator was found. Files proposed in the design (`scripts/acceptance-report.mjs`, `tests/performance`, native Telemetry.cpp and shared collector) are not delivered merely because the design names them.

## Next independently testable implementation

Implement an offline acceptance validity/evaluation core before adding more gauges. It must take an explicit full measurement window and required record completeness, use BigInt timestamp differences before conversion, compute nearest-rank quantiles, and refuse to pass unavailable/incomplete evidence. Start with actual host opportunity/freshness and control correlation, because these define the records native collection must emit.

Required negative fixtures: a fresh-every-time 30 Hz trace fails the 60 Hz workload; missing beginning/end coverage cannot shrink the window; loss flags or dropped slow responses invalidate the result; repeated frames count as repeats; generation changes cannot look like skipped frame IDs; every required control version must match its own consumed frame; fewer than the required p99 samples cannot certify p99. CPU fixture success validates the evaluator, never host performance.

Then integrate bounded native opportunity/receipt/consumption recording and compatible versioned frame/control metadata. Keep scalar authority and GPU resource ownership correct, bump incompatible protocols explicitly, preserve old installed runtime versions, and do not replace a loaded plugin. Add worker CPU and asynchronous GPU timing after the common validity contract exists. Run the locked real-host workload only after negative fixtures, collector overflow and calibration checks pass.

## Checkpoint boundaries

- The recent manual QA unblocked installed functional work; it did not close the gates in this table.
- Required asset admission is a separate tracer gap, described by the installed-source fixture README; it must not be hidden behind telemetry work.
- Docking is an independent presentation change. Its tests should show that moving panels does not create duplicate runtimes or lose state, without claiming frame-budget acceptance.
- Remaining automatic-retry policy reconciliation is tracked in `recovery-checkpoint.md`; this audit does not authorize changing its limits.

## Delivered evaluator and revised priority

The bounded CPU evaluator is now in `packages/performance/evaluate.ts`, with its normalized record contract in the adjacent README. Independent review corrections are integrated through 3956931; 19 synthetic tests validate window/freshness, exact control-version causality, skipped first-rendered frames, immutable frame metadata and final-stimulus drain accounting. Overall hardware acceptance and unimplemented metric gates remain unavailable. This is evaluator validation, not a measured host result.

User direction now prioritizes real creative workflow feedback; see current-priorities.md. Do not begin the native instrumentation/collector work described above as a prerequisite for creating visuals in Studio. Preserve this design and resume the remaining measurement work for release readiness or a concrete performance problem encountered during creation.

## Current-state reconciliation — 13 September 2026 UTC

Inspected stable checkpoint `b3b72ba`. Earlier coverage tables and proposed work
above describe their original checkpoints. The following delivered measurements
supersede statements that Studio has only unavailable gauges, no GPU query
collector, scalar-only controls, or aggregate-only native callback records.
The [performance design](../design/performance-monitoring.md) and
[acceptance procedure](tracer-acceptance.md) continue to own all numerical gates;
no budgets or workload requirements are changed here.

| Area | Delivered implementation / recorded observation | Still not established |
| --- | --- | --- |
| Studio CPU and frame measurements | The worker records update call, synchronous render call, asynchronous render await and queue-completion wait separately. CPU-call quantiles sum update/render per frame. Completed worker-frame rate is exposed through MCP and the collapsed monitor. | Thenable render continuations cannot be separated into CPU time from await wall time and mark CPU coverage incomplete. Worker fps is not host delivery or physical UI cadence. No complete CPU-budget workload is recorded. |
| Studio GPU measurements | Actual adapter `timestamp-query` support is requested and render/compute passes are measured through a bounded three-slot query/readback pool. Per-frame pass sums feed quantiles. The integrated sphere run observed live query measurements. | Copies, uploads and clears outside passes are excluded and explicitly mark coverage incomplete. Queue waits are not GPU cost. Native bridge GPU cost and complete GPU attribution/paired overhead remain unverified. |
| Collection and receiver validity | `live.mjs` bounds records to 4,096, retains up to 120 seconds and publishes summaries every 500 ms. Invalid, lost, expired, pending and incomplete samples remain explicit. The parent validates schema/sequence/window/owner and marks silent telemetry stale after 1,500 ms. | Routine summaries do not provide the independent full acceptance window or prove loss-free end-to-end host collection. They never turn metric values into budget passes. |
| Native opportunities and provenance | Ring v4 carries schema-aware full host control snapshots and an explicit frame-provenance representation. A bounded native queue records QPC host opportunities, selected frames, copy completion and loss; log output labels correspondence `unavailable` or `producer-claim-unverified`. | Worker-frame-to-Electron-compositor correspondence is not independently established. Current controls cannot substitute for frame-pinned provenance. The 600-version consumed-control test, full cadence/freshness/gap run, exact connection-delay endpoints and callback-duration gate remain unverified. |
| UI behavior under measurements | After the extra scheduler delay was removed, real stable Studio exposed React update-depth failures. The committed fix coalesces frame/metric notifications at the React boundary every 100 ms while owner/control/playback/fault/job changes remain immediate and raw MCP/capture state stays current. | Functional responsiveness and bounded notification tests are not calibrated input-to-physical-presentation latency, nor paired instrumentation-overhead measurements. |
| Recovery | One automatic retry with previous-fault/30-second suppression is implemented in Studio and installed playback; full control snapshots survive cached restart. A recovery evidence evaluator is delivered. | Physical execution stop, GPU teardown and explicit restart-to-correct-host-consumption budgets remain unverified; see the updated [recovery checkpoint](recovery-checkpoint.md). |

Implementation references: [routine measurement contract](../../packages/performance/LIVE.md),
[worker](../../apps/studio/src/visual-worker.mjs),
[receiver](../../apps/studio/src/performance/performance-state.ts),
[native opportunity/provenance contract](../../native/texture-bridge/include/frame_telemetry.h),
and [offline evaluator](../../packages/performance/README.md). These delivered
components narrow the earlier implementation gaps; their existence does not
certify provenance, full workload coverage or budgets.

Recorded evidence, with scopes kept separate:

- [Integrated and stable Studio validation](../../evidence/tracer-0.1/parameters-images-studio/validation.md): generic controls, common-image pixels/alpha, save/open/restart, and real CPU/GPU observations passed their functional checks. Stable `b0a844f` completed the parameter harness with zero page errors and 24 monitor toggles during playing output. Its final short interval observed 58.3 worker fps and zero lost/invalid records. This is not a 60 Hz host acceptance run; excluded GPU work still makes pass coverage incomplete.
- [Installed native image fixture](../../evidence/tracer-0.1/parameters-images-studio/installed-image.md): a private installed package, with Studio closed, rendered PNG-over-white output matching the Studio reference. The 10-second fixture recorded 343 callbacks, summary loss zero, first output 4,405.5242 ms after the first callback, and confirmed descendant cleanup. There was no file-cache clearing. This is neither the 300-second workload nor a complete cold/warm/additional-source startup comparison. It does not verify transparent host composition, live FFGL gestures, multiple-instance persistence or recovery.

Generic controls, image admission/offline packaging and routine measurements are
therefore delivered functional capabilities, rather than prerequisites still
awaiting implementation as the earlier tables imply. Actual Resolume image/alpha
and control behavior, the locked host workload, complete CPU/GPU/control/UI timing,
collection calibration and paired overhead, startup categories and physical
stop/recovery acceptance remain open. Preserve missing or unverified measurements
as unavailable; do not infer a pass from functional screenshots, short intervals,
synthetic evaluator results or unverified frame-correspondence fields.

### Follow-up coverage and overhead audit

The current pass collector cannot certify full GPU-frame cost: pinned Three also
submits uniform writes, uploads and copies outside render/compute passes. Next,
record bounded per-frame excluded-operation counts, submission/pass identities
and query loss, and provide explicit baseline/routine collection modes. Routine
GPU sampling should follow the design's initial one-frame-in-30 policy.

A bounded native GPU trace may cross-check these exclusions, but must demonstrate
frame attribution and copy-engine coverage before contributing acceptance data.
An empty-pass timestamp bracket can include idle submission gaps; a marker placed
after queue completion also includes a CPU round trip. Neither proves GPU work.

Paired overhead validation needs identical source/seed/settings and an independent
GPU measurement in both baseline and routine modes. Keep watchdogs and correctness
counters enabled, alternate five pairs, publish each pair and the run-level 95%
bootstrap interval against the unchanged <2% gate. Observed timestamp steps of
0.065536 ms are much larger than 2% of the current small workload's roughly
0.262 ms pass cost. More samples alone do not establish measurement accuracy;
GPU overhead remains inconclusive until the reference has adequate resolution.

### 12 September automated overhead checkpoint

Both bounded, independently reviewed hardware diagnostics have now run. The
direct query/resolve/copy batch test observed +0.008006 ms per 30-frame batch
(+0.3291% of its controlled baseline). Five sphere pass pairs were too noisy
to resolve a small effect. Raw samples, uncertainty assumptions and confirmed
process cleanup are recorded in [GPU overhead evidence](../../evidence/tracer-0.1/gpu-overhead/README.md).
These tests need no user QA. Collection is complete; full Studio <2% acceptance
remains unverified because coverage and measurement accuracy are still limited.

The preceding native pixel-correspondence run
`04c15dba-5627-4841-a939-bf6c67786c0d` also passed: all eight distinct control
values matched decoded image markers, 246 native observations joined 246 host
opportunities with no missing ordinals, and supervised cleanup passed. Independent
review decoded all 118 valid marker samples, including initial value zero.
Artifacts: `.worktrees/pixel-correlation-probe/artifacts/pixel-correlation-probe/`;
inspection SHA-256 `2d86f81d033ca5890fbb36adf4ccbb9224e0dccc38db8fa1cae9bb40f217019c`.
This intrusive eight-change fixture is a correspondence diagnostic, not the
600-change latency run or an actual Resolume check.

## User-approved preview closeout — 12 September 2026

The user accepted the tracer as a usable preview release and moved remaining
show-readiness validation and performance work after tracer. This supersedes
earlier ordering and completion requirements in this document; it does not
claim the unmeasured gates passed or change their numerical targets.
See [the closeout decision, remaining lanes and preserved experiment handoff](tracer-preview-closeout.md).
Filesystem/Git and creative feature work may proceed in parallel with runtime
hardening when resumed. Graphics tests remain serialized. Merge the verified
tracer branch to main, push, then stop; do not automatically start later work.
