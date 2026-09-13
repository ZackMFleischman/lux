# Routine Studio measurements and recovery evidence

`live.mjs` retains at most 4,096 numeric frame records (229,376 bytes) in one
worker. The worker drains at 500 ms intervals and the parent retains one detached
summary. Expired records (older than 120 seconds), invalid observations and
overflow make duration coverage incomplete; cumulative loss is retained. These
short intervals are observations, not the five-minute acceptance workload.

Each completed frame records update call time, synchronous render call time,
asynchronous render wait and queue completion wait independently. CPU call
quantiles sum update and render **per frame** before sorting. Async continuation
CPU cannot be separated from its await wall time, so CPU coverage is explicitly
incomplete when render returns a thenable. Queue completion wait is not GPU cost.
Completed worker frames per independent interval are not host delivery or UI paint.

`PerformanceReceiver` validates a fixed inventory of numeric metrics, copies
bounded fields, rejects sequence/window rollback and retains only the promoted
runtime's identity. Worker and UI clocks are never subtracted. Arrival silence at
1,500 ms marks telemetry stale even when runtime heartbeats are healthy. Faults
retain the latest numbers labeled failed; failed replacement candidates do not
overwrite the previous preview's telemetry. Routine metrics never pass budgets.

Studio wiring: import `PerformanceStatus` from
`apps/studio/src/performance/PerformanceStatus.tsx` and render
`<PerformanceStatus performance={snapshot.performance} />` in the status area.
It exposes compact measurements and detailed coverage via its title. No renderer
or authoring files are changed by this slice.

GPU capability comes from the selected adapter's actual `timestamp-query`
feature. Full visual GPU coverage is initially unsupported, not zero. The pinned
Three public timestamp resolver returns cached values when query resolution
fails or is busy and groups separate renderer calls; it cannot certify freshness
or the complete visual plus presentation passes. Direct bounded pass-query
instrumentation is the next integration point.

`recovery.ts` validates one independent recovery attempt: injection-to-observed
execution exit within 2 s and explicit restart-to-consumed reference frame with
exact current host controls within 5 s. Terminate requests and worker-ready
messages cannot substitute for these endpoints. Missing endpoints are unavailable;
incorrect identity/values or late completion fails; loss/incomplete input cannot
pass. Parsed inputs must be inert and bounded, with at most 32 control values.
Normalize native QPC differences with BigInt in one verified frequency before
passing monotonic millisecond endpoints. Preserve the original raw evidence.
Synthetic tests validate arithmetic and rejection behavior, not a hardware gate.

Native collection still needs frame-pinned schema/control sequence/full values,
independently observed process exit, host reference-image confirmation and host
responsiveness evidence. This work is coordinated separately with the native
transport owner. Neither evaluator changes overall hardware acceptance from
unavailable. No graphics workload has been run in this worktree.

CPU verification: `node apps/studio/test-cpu.mjs` includes collector, receiver,
worker fixture, lifecycle and recovery tests. The worker suite uses fake WebGPU
objects in an isolated VM; esbuild runs but no GPU or Electron is launched.
