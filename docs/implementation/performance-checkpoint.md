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
