# Independent Resolume transport work

The user resumed transport on 2026-09-12 UTC as independent feature work. The
standalone Lux work remains separate. Starting checkpoint: `8971cb2`; worktree:
`.worktrees/transport`, branch `codex/resolume-transport`.

## Discovery repair

The previous paired diagnostic had 329 callbacks in ten seconds and only two
receiver counter records. Discovery used `ticks % 500`, with a requested 1 ms
sleep per iteration. Windows scheduling made that interval roughly eight
seconds, outliving the five-second producer. No attachment was recorded.

Discovery now uses a steady-clock deadline every 500 ms. A pending GL copy keeps
the deadline due until switching rings is safe. Counters have an independent
deadline. Discovery and mapping errors are recorded to distinguish a missing
advertisement from failed mapping access. No GPU ownership or context topology
is changed in this repair.

The CPU regression models 16 ms worker wakeups and initially failed `found`
with the old 500-iteration policy. It passes with elapsed-time polling, including
pending-copy deferral and delayed-worker behavior. All eight native CPU tests,
21 Node unit tests, TypeScript checking and probe syntax checks pass. Release
build uses MSVC 14.50.35717 / compiler 19.50.35721 and Windows SDK 10.0.26100.0.
Build: fresh CMake configuration followed by `scripts/native-build.ps1`; generated
probe: `node tools/gpu-spike/build.mjs`. Dependency sources copied unchanged from
the existing TR-02 vendor directory; installed Node dependencies are shared with
the tracer worktree through a junction.

Next experiment: the existing exclusive supervisor launches one five-second
WebGPU producer and ten-second standalone FFGL receiver, with a 20-second job
deadline and Resolume closed. Record exact source and binary hashes before
execution. This does not establish Resolume, performance, color/alpha or full
transport acceptance. The earlier system incident's cause remains unconfirmed.

Independent review noted an existing reconnect defect: after detaching A to try
unavailable B, the cached name A can suppress a later return to A. It does not
affect this single-producer diagnostic and remains follow-up work.

## Standalone result

Run `c2171c69-a48d-4914-b84e-ad813a968251` passed the short standalone evaluator:
284 compositor paint callbacks, 92 completed receiver consumptions, 333 host
callbacks; producer closed with zero held/uncertain leases, both children exited
zero, and the supervisor confirmed cleanup. The final image contains the
expected orientation, corner colors, moving-line sample and alpha bands. This
is visual inspection, not a numeric color/alpha acceptance test. The receiver
kept its final image after the producer stopped. See
`evidence/tracer-0.1/tr02-discovery-repair/` for image, logs and manifest.

## Manual Resolume diagnostic

The same tested DLL (SHA256
`af739bc0d4f26db6d83416ab47fcf5d245f3241ce767dea80d091ab782fe540a`)
was copied to the configured Extra Effects directory. The older disabled DLL is
preserved. `scripts/resolume-experiment.mjs` runs a 15-second producer inside the
existing 25-second Job budget; it does not launch or terminate Resolume.

The review must name `testKind: resolume-producer`, set `hostClosedConfirmed:
false`, and include `host: {pid, executable, creationUtc}`. The runner admits only
that exact Avenue/Arena identity, rejects other graphics processes, rechecks host
identity after hashing immediately before dispatch, and records the external
host as unsupervised. Inventory both the host executable and the actual staged
DLL, and verify the host's loaded module path against it before launch.

Manual precondition: an empty composition with exactly one active Lux TR02 Probe;
keep that instance loaded throughout the run. Existing receiver counters have no
instance tags, so this diagnostic depends on that precondition. New context
records or decreasing counters invalidate the run. Attachment must name the
current producer PID and counters must increase beyond the starting sample.
Producer records host Intensity changes. User observation is required for image
movement/control effect; neither control logging nor this short test proves
end-to-end latency, 60 fps, host teardown or long-run stability.
