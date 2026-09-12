# Tracer 0.1 acceptance and evidence

This procedure operationalizes [requirements T01–T09](../requirements.md) and original design Appendix B. It is a plan, not a test report. Do not check any acceptance box using source review, a mocked host, or generated fixtures alone.

DEC-13 adds T10 and the minimum installed release outcomes described in
[tracer export scope](tracer-export-scope.md). Tracer is incomplete until the
user can create/export in Lux and cold-start those sources in Resolume with
Studio absent. The existing numerical performance and GPU correctness gates
remain in force.

## Required export and reuse demonstration

- Create two distinct visuals in Lux through the actual source/AI workflow and
  export named fixed versions. Include at least one required asset in a package.
- Install using the provided action/helper. Verify complete code/assets and
  exact runtime dependencies; no local development tools are required to play.
- Close Studio and run both sources together in Resolume. Separately run two
  copies of one source; verify independent controls, state and instance IDs.
- Save the composition and close Resolume and all Lux runtime processes. With
  network disabled and the authoring checkout/source asset locations unavailable,
  reopen using only Resolume. Verify automatic runtime startup and the correct
  installed release IDs and control values. Continuing the exact old animation
  time is not required.
- Edit the source in Lux; verify installed playback does not change. Export a
  new version alongside the old one. Failed export/install must leave old
  versions intact, and old compositions must still resolve their original release.
- Change controls during a renderer outage; require the current host snapshot on
  the first accepted recovered frame. Remove one source while another runs,
  then close the host and verify normal resource/instance cleanup.

Record package/runtime hashes, installed locations, source/instance IDs, process
start/exit evidence, composition save/reopen evidence and user-visible results
in `export-install.md` and `host-evidence/`. A warmed-up service that survives
Studio closing is insufficient: the cold-start test must also pass. Measure
multi-source workloads separately from the single-source performance reference.

Read [profiling and performance monitoring](../design/performance-monitoring.md) for how to implement probes, GPU timing, calibration, bounded collection, summaries and negative measurement tests. This acceptance document owns numerical targets; that design owns measurement implementation. Both are required: correct workload counters cannot compensate for invalid or dropped telemetry, and an accurate profiler cannot compensate for failed hardware budgets.

## Evidence layout

```text
evidence/tracer-0.1/<run-id>/
  manifest.json                # source commit, environment reference, exact workload
  environment.json             # pinned dependency/toolchain/adapter/host tuple
  preflight.md                 # host/client/native checks and actual commands
  gpu-feasibility.md           # chosen bridge, handle ownership and measured results
  ai-session.md                # prompts, tool results, model image-use observation
  revisions/                  # submitted source and accepted artifact hashes
  captures/                   # PNGs and matching metadata JSON
  frames.jsonl                # production/receipt/host-consumption sequence records
  controls.jsonl              # receipt and first corresponding consumed-frame markers
  performance.json            # sample counts, quantiles, gap/drop/repeat statistics
  failures.md                 # injection, expected/observed recovery and timings
  host-evidence/              # screenshots/video of actual host/control behavior
  acceptance.md              # every gate: pass/fail/unavailable with artifact links
```

Paths above are outputs created during implementation. Keep compact reports/source/metadata in Git; retain binary evidence in a documented local artifact directory or archive and commit a manifest with hashes and retrieval path. Never commit API keys or unrelated client conversation data. A missing required artifact is not a pass. Automated output defaults may be `evidence/tracer-0.1/latest/`, but archive each accepted run under an immutable run ID before sign-off.

## Measurement semantics

Use one monotonic timing domain where possible (native QPC); otherwise calibrate clock offsets and error bounds before subtracting timestamps from different processes. Record all clock domains in the manifest. GPU timestamp queries measure GPU duration; CPU wall time around submission is not a substitute. Attribute GPU copy/transfer work separately from visual rendering; record overlapping work rather than adding independent durations blindly.

Every produced frame carries an instance ID, generation, revision, frame ID, animation time, control version, output dimensions and known marker. Count host source-consumption opportunities, not UI paints. A fresh frame means the consumed frame ID advances within the same instance/generation; skipped producer IDs and repeated host consumes are separate counters. Host absence/deactivation is excluded only under a declared window; unexplained delivery gaps are not excluded.

Workload validity is a separate prerequisite: an independent monotonic harness brackets the full 300-second measurement window after warmup (boundary tolerance 0.1 seconds). Count actual host source-consumption opportunities within that interval and report their rate. It must be within 1% of the declared 60 Hz rate (59.4–60.6 opportunities/sec); also report fresh delivered images/sec. Missing expected opportunities cannot disappear by shortening the window to first/last callback. A 30 Hz host with 100% fresh frames fails workload validity. No deactivation or fault windows are excluded from the reference run; inject faults in separate labeled runs. Legitimate 59.94 Hz operation is recorded and fits this tolerance.

Control latency starts when the plugin receives the new continuous value/version and ends when host source consumption observes the first corresponding rendered marker/control version. Keep intentional smoothing off. This does not measure the MIDI device, compositor/projector or photon latency. Added connection delay starts at renderer completion and ends at host consumption of that completed frame, with calibrated clocks. Report p50/p95/p99 and maximum, sample count, measurement overhead and raw records.

For control acceptance, send 600 scheduled alternating intensity values (0.2/0.8) at 2 Hz over the five-minute window, with a distinct sequence marker for every update; allow 250 ms after the final stimulus to drain. Use a verified host automation/control driver reaching the actual FFGL parameter setter, not direct runtime writes; record its setup in TR-01/06 evidence. Record sent, plugin-received, superseded, rendered, consumed and unmatched counts. Require all 600 sent versions received and visibly matched to an exact frame version in this non-overload stream; any missing/unmatched version fails rather than disappearing from quantiles. A later snapshot does not prove an earlier value appeared. Preserve timeouts as explicit failures. Test high-rate coalescing separately; expected supersession there cannot excuse losses in the normal-rate stream. At least 500 exact matched samples are needed for any reported p99; the required 600/600 gate is stricter.

UI response uses a scheduled command/input timestamp to the first UI paint acknowledging the operation. Sample during rendering and source replacement; also report UI paint rate separately from delivered visual frames. Watchdog measures injected unresponsiveness to confirmed worker/process stop, not just an error banner. Restart recovery ends at a completed reference frame with current host values being consumed.

## Required 0.1 run

Workload: deterministic animated shader with frame marker, alpha/color/orientation pattern and one immediately visible continuous control, 1920×1080, 60 Hz host. Record source hash, seed, dimensions, quality and all relevant settings. Warm up 30 seconds, then measure five minutes. Do not silently reduce quality to pass.

Use two labeled runs: host reference budgets with the independent authoring preview inactive/closed, and UI-response evidence while the thin Studio and its reference authoring visual are active alongside host playback. Do not pool these samples or claim a two-instance capacity benchmark. Report host delivery in the concurrent run as diagnostic evidence; reference budget sign-off uses the declared single-host workload. Record candidate compile/smoke intervals separately.

| Gate | Pass condition | Evidence |
| --- | --- | --- |
| AI loop | External assistant creates or materially changes executable visual code, receives and demonstrably uses actual captured images, revises and captures again. No manual code transfer. | Session transcript, submitted source/revision hashes, at least before/after image pair, tool metadata. |
| Actual host | Lux and real Resolume show the same visual implementation; a named native control changes it; continuous path has no per-frame CPU readback/upload. | Host screenshots/markers, native transfer counters and code-path observation, selected adapter IDs. |
| Image correctness | Known corners/orientation, RGB ramps and partial/zero alpha behave as specified through host composition; color/alpha conversion documented. | Test pattern, host composition capture and comparison report. |
| Fresh delivery | At least 99% of host output opportunities consume a fresh source frame; no unexplained delivery gap greater than 100 ms. | Raw frames and counts of opportunities/fresh/repeat/skipped frames; longest gap. |
| Actual host cadence | Full 300-second measurement coverage; observed source-consumption rate 59.4–60.6/sec. | Independent harness window, actual opportunity count/rate and expected count reconciliation; a nominal 60 Hz setting alone fails. |
| Visual CPU | p95 update/submission at or below 4 ms. | Measured CPU spans, separated from transfer and UI. |
| Visual GPU | p95 frame work at or below 12 ms. | GPU query measurements; unavailable reported as unavailable, never passed. |
| UI response | p95 at or below 50 ms; p99 at or below 100 ms. | UI input/acknowledgment traces under running workload and revisions. |
| Connection delay | p95 at or below two 60 Hz host frame periods (33.34 ms). | Completion-to-consumption timestamps and clock calibration. |
| Plugin callback | p95 at or below 1 ms; no intentional wait for renderer or texture availability. | CPU trace; callback design audit; forced-late-frame behavior. |
| Control latency | All 600 normal-rate sent versions received and exactly matched; plugin receipt to consumed image p95 at or below 50 ms and p99 at or below 100 ms. | Complete sent/received/superseded/rendered/consumed/unmatched counts, marker correlation and smoothing disabled. |
| Watchdog | Unresponsive generated JavaScript is stopped within two seconds. | Monotonic injection/stop timestamps and saved source intact. |
| Recovery | Explicit renderer restart restores reference image/current host values within five seconds; host remains responsive. | Failure log, frames/control generation evidence and host recording. |
| Routine overhead | Routine instrumentation adds less than 2% median frame cost. | Paired instrumented/uninstrumented runs with same source/settings; measure externally or with a fixed minimal baseline probe. Report noise/confidence; inconclusive is not a pass. |

If GPU queries are unavailable, record which stage cannot be timed and preserve mandatory delivery measurements. Completion requires an explicit recorded revised budget/measurement decision rather than claiming the original GPU gate passed. If a gate fails, identify the bottleneck and fix it or record an explicit approved revision to design/budget before completion. Escalate material changes to the user's promised outcome.

## Failure and lifecycle matrix

| Injection | Required result |
| --- | --- |
| Syntax/build error | Structured diagnostics with source location where available; last accepted scene/preview remains; AI can submit again. |
| Candidate initialization error | Failed job does not advance accepted revision or discard last-good artifact. |
| Infinite loop in update or initialization | Supervisor stops unresponsive execution within two seconds; UI and host remain responsive subject to driver limitations; clear restart/restore action. |
| Runtime exception after initial success | Report active revision and error; restart or restore last working artifact without corrupting source. |
| Renderer exit during host playback | Host uses last completed owned image, or startup transparent black if none; no blocking callback or invalid handle access. |
| Restart while native control changed | Current versioned host value wins; stale generation frames are discarded; reference frame restored within five seconds. |
| Close studio, retain Resolume | Detached supervisor/render instance continues; reopen studio attaches without resetting host instance. |
| Cold composition reopen with Studio absent | Installed sources start their background runtime automatically and restore pinned release IDs/current saved controls without network, checkout or a manual producer. |
| Two sources or duplicate copies | Independent runtime/control state; removing one does not stop the other. |
| Failed export/install or later authoring edit | Installed releases remain usable and unchanged; new versions require explicit selection. |
| Capture concurrent with revision activation | Image and metadata match the requested revision or an explicit revision conflict/unavailable response; never mislabeled pixels. |
| Capture timeout/queue full | Bounded failure, released resources, no UI freeze or stalled host transport. |
| Resize/hide/detach presentation consumer | Render state/clock remains consistent; output resolution changes only by explicit render setting, no double clock advancement. |
| Hybrid-GPU mismatch/device loss | Actionable error and bounded resource cleanup/restart; no implicit CPU streaming fallback. |
| Delayed frame/consumer stall | Producer does not overwrite an in-use resource; bounded pool drops/skips safely, callback returns without waiting. |

## Scope of later evidence

Independent host instances, complete minimum export/install and offline cold composition reopen are now required in 0.1 under DEC-13. Wider resize/upgrade/capacity coverage remains 0.2. Stateful simulation and 20 events/sec over ten seconds are 0.3. Recorded-input deterministic capture is 3. The 60-minute resource/queue soak, polished distribution and five workload categories are 5. Do not describe any gate as established without its evidence.

## Sign-off

First pass the performance design's quantile/clock/accounting/overflow/query-validity negative fixtures and cross-tool checks. Include `telemetry.jsonl`, `calibration.json`, `resources.jsonl`, `instrumentation.json` and selected bounded traces alongside the evidence layout above. `performance.json` records sampling/coverage, clock uncertainty, lost records and incomplete-output status. Routine overhead uses the design's paired work-duration procedure; vsync-capped intervals alone cannot prove the 2% gate.

The implementing coordinator fills `acceptance.md` with source commit, environment, each gate's result and raw artifact links. A reviewer checks the actual AI image loop and host evidence plus raw counters. Run unit/build/contract checks after integration, then actual-host acceptance. A passing unit suite or a WebGPU demo without the FFGL path does not complete the tracer.
