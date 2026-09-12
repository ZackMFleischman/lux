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

Actual-host run `33558649-2ffd-44c8-b0c5-194c75a15c62` passed: 866 completed
consumptions within sampled counters, 877 paints, clean producer shutdown, and
103 received control changes spanning 0–1. The user confirmed motion, color
response and last-frame retention. Evidence: `tr02-resolume-transfer`.

Reconnect run `9562564a-b8e4-410c-b202-f848cf33a542` passed automated checks with
863 additional consumptions and clean shutdown. It also exposed an initial
control synchronization gap: default 0.65 precedes host value 0.452747 by about
60 ms. Exact first-frame restoration is not proved and needs a snapshot/frame
handshake before production acceptance. The user did not watch this reconnect
run and requested a repeat for visual confirmation and source-removal testing.

The repeat `cf98718d-b6ea-4dcf-b035-75580f8f0edd` passed with 853 additional
completed frames. User confirmed resumed motion, freeze after producer exit,
clip removal and normal Resolume close. Read-only process inspection confirms
the host exited; its current-session log contains no failure/unsupported-unload
records. Evidence: `tr02-resolume-repeat`.

The core GPU transport is now demonstrated in actual Resolume. The standalone
Lux branch has meanwhile added its compiled-visual runtime (`81dccce`), which is
not yet connected to this diagnostic producer. Next implementation work is
binding a validated compiled visual to the transport and gating initial output
on the authoritative host control snapshot. Further acceptance remains separate:
numeric color/alpha and frame provenance, full 1080p60 measurement, multi-instance
identity, resize/device-loss handling and broader lifecycle coverage. No complete
TR-02 or production-ready integration is claimed from the short diagnostic runs.

## Compiled saved visual completion

The independent saved-visual transport feature is now implemented and exercised
in actual Resolume. `pnpm transport:prepare` compiles a saved `.lux-scene` into
an immutable release; `pnpm transport:play` runs either format persistently.
The renderer reuses Studio's visual worker and the native bridge. Resolume's
Intensity initializes the visual before its first render and supplies live
updates. The saved scene's authoring Intensity never overwrites the host value.

Late transfer of an already-composited canvas caused black output despite
advancing worker frames. Replacing the placeholder with a fresh canvas directly
before transfer fixed this in the isolated diagnostic. Temporary shader,
scheduler, and device experiments were removed. A one-frame result no longer
passes the animated diagnostic. Normal playback uses GPU transport; occasional
CPU image captures are confined to the standalone diagnostic.

| Check | Result | Evidence |
| --- | --- | --- |
| Compiled standalone | 166 paints, 73 sampled receiver consumptions, correct final image, complete cleanup | `tr02-compiled-standalone` |
| Compiled Resolume diagnostic | 665 paints, 648 consumptions; first worker frame used 0.17 | `tr02-compiled-resolume` |
| Persistent saved-scene playback | Over one minute, 2766 paints; user confirmed continuous rotation and live color changes; Ctrl+C exited cleanly | `tr02-compiled-playback-stop` |
| Reconnect and host close | User confirmed freeze, resume, clip removal and normal host close; 1234 paints; producer exited automatically with no forced stop | `tr02-compiled-playback-close` |

Evidence folders are under `evidence/tracer-0.1/`. The initial bounded host run
was not visually confirmed because the clip was not triggered; the subsequent
persistent runs supplied the human visual checks. An unwatched restart was
repeated before recording the final manual confirmation.

The final shutdown had `exitCode:0`, `forcedStop:false`, and
`cleanupComplete:true`. Read-only inspection found no remaining Avenue, Arena
or Electron process and no experiment lock. All 34 unit tests, 9 native CPU
tests, type checking, and the build passed. CPU fixtures additionally cover
owner exit and a producer that ignores shutdown.

Installed DLL SHA256:
`2de5d23b889202da46ec9b2b141f9969a14e9c12ad53c29d185815b88f82f453`.
The old installed binary and the earlier disabled incident binary are preserved.
Source is on `codex/resolume-transport`; see [playback instructions](transport-playback.md).

This completes saved-scene playback and initial host-control application for one
source/producer. Studio must currently be closed during playback. Multi-instance
routing, simultaneous authoring/playback, sustained 1080p60 measurement, numeric
color/alpha acceptance and device-loss recovery remain outside this feature's
scope. Worker acknowledgement proves initial control application; it does not
prove which compositor texture was exported first. Full tracer acceptance is
not inferred from these integration checks.
