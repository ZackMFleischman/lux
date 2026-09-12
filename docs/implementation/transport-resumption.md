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
