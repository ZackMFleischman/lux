# Offline performance evaluator (schema 1)

`evaluatePerformance(unknown)` is a synchronous, pure CPU evaluator of normalized
host opportunity and exact control-version evidence. It is **not** an installed
telemetry protocol, recorder, host benchmark, or hardware acceptance report.
`hardwareAcceptance` is always `unavailable`, including for recorded inputs.
The canonical numerical requirements are in
[tracer acceptance](../../docs/implementation/tracer-acceptance.md); measurement
semantics come from [performance design](../../docs/design/performance-monitoring.md).

## Admission contract

The exported `Evidence` interface in `evaluate.ts` is the complete schema. Every
object requires exactly its declared fields; missing and extra fields reject.
Inputs must be inert parsed data, not objects with getters/proxies. The caller owns
bounded file decoding before invoking this in-memory API. Arrays are capped before
record traversal: 100,000 opportunities and 1,000 controls. IDs are at most 128
characters, decimal uint64 strings at most 20 characters; integers are nonnegative
safe integers. No filesystem, graphics, network, dependencies or input mutations.
Memory is O(opportunities + controls), work O(opportunities + controls log controls).

- `schemaVersion: 1`, `provenance: synthetic | recorded`, `instanceId`, `revisionId`:
  one instance and immutable visual revision per input. Never pool runs or revisions.
- `clock: { domain: qpc, frequency, valid }`: all timestamps in a single validated
  QPC domain/frequency; `valid` must be true. Cross-clock/calibrated measurements
  are deliberately unsupported. Frequency is a positive decimal uint64 string.
  Timestamps and frame IDs are canonical decimal uint64 strings. Subtraction uses
  BigInt before conversion to milliseconds. There is no wall-clock endpoint.
- `window: { start, end, coverageStart, coverageEnd }`: independent harness
  boundaries, not the first/last callback. Duration is 300 seconds ±0.1 seconds.
  Collection must cover the full window and the 250 ms control drain after the
  final actual `sent` timestamp; the admitted collection span is capped at 301 seconds. Window opportunities
  use `[start, end)`. Drain opportunities only serve control correlation.
- `lostRecords`, `incomplete`: independently retained collection state. Nonzero
  loss or incomplete output invalidates all covered gates. This normalizer must
  reconcile every producer/writer's sequences and loss flags before construction.
- `smoothing`: true fails control evaluation.
- `opportunities`: *every actual* host source-consumption opportunity, ordered by
  strictly increasing `at`, with contiguous `sequence` starting at 1 over the
  admitted collection. `generation` increases across restarts, including empty
  opportunities; a rollback is invalid even if the new generation had no frame.
  `frameId: null` means no frame consumed and requires both `controlVersion: null`
  and `renderedAt: null`. A non-null frame
  may carry null for initial/unversioned controls. Frame IDs never regress within
  a generation. `renderedAt` is the exact frame's producer rendering-completion
  timestamp, correlated by instance/revision/generation/frame identity in the
  normalizer, never inferred from consumption. Reconsuming an identity requires
  the same control version and render timestamp. Every versioned consume is
  checked against receipt and first-render causality, including frames other than
  the control row's first rendered frame.
- `controls`: one row per actually sent version, with unique `version` 1–600 and
  alternating `value` 0.2/0.8 (version 1 is 0.2). `sent` is actual send time inside
  the window; `received` is actual plugin setter receipt or explicit null.
  `superseded` is independently collected; any supersession fails this normal-rate
  stream. `rendered` is null or the first exact rendered marker `{at, generation,
  frameId}`. Host consumption is derived from opportunities, never a provided
  latency or later control version. The first rendered frame may be skipped by
  latest-frame transport; a later rendered frame carrying the same exact version
  can supply its first visible match. Its `renderedAt` and identity must follow
  the first rendered marker, and any consumed copy of that first marker must
  agree with its version/time. All first-render markers and consumed frames share
  one immutable identity registry: conflicting versions/timestamps invalidate
  evidence even when a marker was never consumed or its receipt is missing.
  Missing/timeout stages remain null, not
  deleted. The normalizer must preserve raw record links outside this core.

The normalizer must not invent opportunity records from configured FPS, frame
identity from UI paint, control receipts from sends, or rendered versions from
scalar snapshots. `coverageStart/End` attest collector coverage, not that callbacks
occurred continuously. The evaluator detects callback absence through independent
rate and delivery-gap checks; sequence discontinuities detect missing records.
A forged completeness claim cannot be detected by this offline arithmetic alone.

## Results

`validity: complete` means admitted, loss-free collection with consistent clocks,
sequence and timing; it does not mean all expected controls arrived or budgets
passed. A missing control row/stage is a failing `controls.gate`, with explicit
counts, even when collection itself is complete. `invalid` returns bounded
reasons and no passing covered gates. Invalid input may retain partial diagnostic
numbers; those numbers are not certifiable. Unsupported metrics never receive
numerical zero substitutes.

Host output reports actual opportunity count and rate, expected nominal count,
fresh count, `freshRateHz` (fresh images / independent window seconds), freshness
ratio, repeats, skipped IDs and longest fresh-delivery gap. The
rate gate is 59.4–60.6 Hz over the independent window. Freshness requires ≥99%
fresh opportunities and a maximum gap ≤100 ms, including both window edges.
No-frame opportunities are neither fresh nor repeats but remain in the denominator.
The first observed frame is fresh; a new generation starts fresh and cannot
create skipped IDs across the reset. Within a generation skipped IDs are the
positive advance minus one, serialized as a decimal string to preserve precision.
Fault/deactivation exclusions are not supported in this reference window.

Control output reports sent/received/superseded/rendered/matched/unmatched counts.
Matched means receipt ≤ first render ≤ consumed-frame render ≤ first host
consumption of the exact control version, with that consumed frame's
generation/frame identity and immutable rendering provenance validated. The
consumption must be no later than final actual stimulus +250 ms; a late tail
remains unmatched even if it would not affect p99. The gate
requires all 600 versions received and matched, no supersession/smoothing, p95
≤50 ms and p99 ≤100 ms. Quantiles use ascending nearest rank `ceil(q*N)` (1-based)
on the complete matched population. P99 is omitted below 500 samples; missing
versions cannot pass even above that minimum. Max is diagnostic, not an extra
latency budget. Ordered timestamps are checked before subtraction.

`controlDriverSchedule` and `workloadProvenance` remain unavailable: this core
checks control identity coverage and response budgets, not real FFGL automation,
2 Hz scheduling fidelity, warmup, locked shader/settings, dimensions, actual-host
presence, or image correctness. GPU, CPU, callback, connection delay, UI,
watchdog/recovery and overhead remain explicitly unavailable. A downstream
hardware report must not translate these covered sub-gates into overall acceptance.

## Verification and next collection work

Run `node --test --test-isolation=none tests/performance/evaluate.test.ts` and
`node node_modules/typescript/bin/tsc --noEmit`. Synthetic fixtures validate only
this evaluator. Native work still needs bounded off-thread per-opportunity/receipt
records, explicit compatible frame/control metadata, independent harness and
writer reconciliation, a verified real-host stimulus driver, raw evidence links,
overflow/calibration validation and the locked hardware run. No acceptance script
has been enabled by this patch.
