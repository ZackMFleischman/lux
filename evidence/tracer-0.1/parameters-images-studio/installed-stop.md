# Installed hung-JavaScript physical-stop checkpoint

One independently reviewed native probe passed on 13 September 2026 UTC.
Probe source `ee969f9` is integrated as `d143d44`. No Studio or Resolume process
was active; the current health-v2 runtime was exported, privately installed and
registered before the run. No public source registration was changed.

| Identity | Value |
| --- | --- |
| Experiment | `dc51615b-96ef-4a54-8278-695dba2b1d78` |
| Release | `20a7afdf026969ca4fed51fc97756353d669f649c3fddd33bc85643d22e25b4a` |
| Runtime | `6f1f00664d3db545d4f9e722a298b02403857136d2eae7c5489182472541357f` |
| Source | `4360862d38c743c2d54c9fde150912f15a77b926ba46f1fad730b89224005acf` |
| Instance | `00000000000027f00000009a17f02cdf` |
| Failed attempt | `1774d62c3ea9ed8aa69ecb8b32e84dbf` |

The diagnostic observed the expected magenta image, recorded QPC immediately
before calling the actual FFGL arm setter, and required a durable fixed-token
record from the worker entering its non-yielding update loop. The host then
submitted disarm for any subsequent runtime; the blocked worker did not
acknowledge that submission. The supervisor force-stopped the exact failed Job.

All timestamps share QPC frequency 10,000,000 Hz:

| Event | QPC ticks |
| --- | --- |
| Before triggering host setter | `661889411039` |
| Durable hang marker observed | `661889794017` |
| Host disarm submitted | `661890025148` |
| Supervisor stop requested | `661903780474` |
| Native termination requested | `661903790730` |
| Root signaled and Job active processes zero | `661904633231` |

The conservative trigger-to-physical-exit upper bound is **1,522.2192 ms**, below
2 seconds. Starting before dispatch includes control delivery and watchdog time;
it is not an exact hang-onset timestamp. Matching lifecycle records have no lost
or incomplete entries. The native host completed 144 callbacks after the marker,
deinstantiation/deinitialization succeeded, and the outer Job confirmed cleanup.
The 9,977 ms work window and 30-second outer budget were respected; total
supervised operation including preflight was 14,118 ms, with exit 0/no timeout.

Artifacts are in
`C:/Users/zFlei/repos/lux/.worktrees/installed-stop-probe/artifacts/installed-stop-probe/`:
`review-authorized.json`, `last-experiment.json`, `physical-stop.hang.json`,
`inspection.json`, the experiment's marker/manifest/logs, and the private
installed attempt's lifecycle log (path recorded in inspection).
Inspection SHA-256:
`5e5430804db5d04e8925124c450c928334eb5195f5b95a54952d5493db6f9f15`.

This establishes physical termination for one generated update-loop hang in the
native diagnostic host. It does not establish initialization-hang timing, actual
Resolume fault behavior, callback latency budgets, the first recovered image with
current controls, explicit-restart-to-image timing or GPU-resource accounting.
Those remain distinct checks. No missing endpoint is replaced with a banner,
termination request, worker-ready response or process-exit assumption.

## Recovery follow-up: Windows status-file contention

Review of the same run found that automatic retry attempt
`3ba825995402e93d7daf66450810a249` failed before painting: at
`2026-09-13T02:23:15.237Z`, its trace reports `EPERM` while renaming the temporary
health-status file over the published status. Its final summary reports
`paint: 0`, `failed: true`. This does not invalidate the measured physical stop,
but it explains why that run cannot establish recovered output.

Fix `9aef18c`, integrated as `ef83f4f`, tolerates only transient rename
`EPERM`/`EACCES`/`EBUSY`: it leaves the last published sample intact and lets the
next heartbeat attempt publication with current counters. It does not sleep,
extend deadlines or let stale samples renew liveness. Temporary-file write
errors and other rename errors remain fatal. Independent review approved the
change; root reran all 16 health/publication/wiring tests successfully. The new
regression failed before the fix (two uncaught `EPERM` failures), as verified by
the implementation agent. A fresh native recovery run remains required.

## Fresh recovery run: observation window exhausted

Run `a0278ae4-3056-4140-acb6-e35ea551089f` used reviewed recovery probe `e197735`
(integrated as `5317b7c`) and release
`6b6f7506808b632086d2d342f1c0e1fd56c93c401f9d5b40d166127435b0e7e5`, runtime
`814fb341d2bfc08e18eeb57e0402874d900c15e90ff33fc52b501b9662ed0b69`.
All 171 input hashes were independently verified. Studio and Resolume were
closed and their processes had exited before launch.

The native fixture reached magenta, armed the hang, and submitted normalized
zero (concrete `arm: -1`) for recovery. It exited **12** at its 10,000 ms work
deadline without observing cyan. Native deinstantiation/deinitialization and
outer Job cleanup succeeded; the operation ended after 15,056 ms, below 30 s.
This run **does not pass recovery**.

The original attempt's physical exit occurred 1,671.4351 ms after the trigger.
The automatic retry began 246.1392 ms later. However, initial magenta had consumed
6,309.5121 ms of the total native work window; only 1,741.1751 ms remained from
retry start to the last host callback. The initial renderer itself had needed
2,988.3004 ms from attempt start to magenta.

Retry `7598c5ebdc623262d1113347e1fef8ee` received concrete `arm: -1`. Its trace
contains no failure and ends with `closed: true`, `failed: false`, `paint: 0`,
`webgpuReady: false`. No further production bug is established by these records;
startup was unfinished when observation ended. The earlier Windows rename error
was not observed in this attempt. Root requested review of one test-only 15 s
recovery observation window, retaining the 30 s outer Job and all production
deadlines. This is not a change to any performance acceptance gate.

Artifacts: `C:/Users/zFlei/repos/lux/.worktrees/installed-recovery-probe/artifacts/installed-recovery-probe/`.

## Verified automatic recovery with current controls

The independently reviewed recovery-only observation adjustment `3f72c26`
(integrated as `c0f5f05`) permits up to 15 s native work while retaining the 30 s
outer Job and 2 s physical-stop requirement. Production behavior is unchanged.
Six root-run inspector/options tests passed, including over-limit rejection.

Fresh run **`4b766584-a481-4abf-9f73-d4d22da3bb23`** used the same immutable
release/runtime as the failed run, a fresh private profile, and reviewed host
SHA-256 `faa93f4c267dd78b48304e691d4e2df6c0541c7c8b1f22b4ef192683fb2fab70`.
All 171 recorded input hashes were independently reverified before launch.
The prior failed run remains unchanged.

Root ran the strict recovery inspector successfully: initial native RGBA was
`[255,0,255,255]`; after the hang, exactly one distinct retry produced native
RGBA `[0,255,255,255]`. The FFGL getter returned normalized zero, representing
concrete `arm: -1`. The hung worker itself did not acknowledge that change.

| Endpoint | QPC ticks (10,000,000 Hz) |
| --- | --- |
| Host arm trigger | `681497347247` |
| Durable hang entry | `681497853826` |
| Host disarm submission | `681497980835` |
| Original Job confirmed exited | `681510914520` |
| Observed recovered cyan | `681537040325` |

The conservative trigger-to-physical-exit bound is **1,356.7273 ms**. Cyan was
observed **3,969.3078 ms** after the trigger. This is automatic recovery of the
pinned binary-color fixture, not measurement of the first accepted frame or the
explicit-restart five-second gate. Both root process exit and zero active Job
descendants were recorded for the failed attempt. Native deinstantiation and
deinitialization, outer Job cleanup and final no-process inventory passed.

The successful run used **9,126 ms** native work and **13,045.097 ms** total
supervised time, exited 0, and did not reach the extended observation ceiling.
Instance `0000000000000be00000009ea8e96084`; failed attempt
`d02ba34c59c9092cc0f5a02e361c6993`; retry
`6aea7f0d755c798915259240af272e15`.

Artifacts: `C:/Users/zFlei/repos/lux/.worktrees/installed-recovery-probe/artifacts/installed-recovery-probe-15s/`.
Inspection SHA-256:
`81b564aee5ce79e315b2ce6ed64d48f697b4e11eae22b3e4dbd89a2718274eda`.
Actual Resolume fault behavior, initialization hangs, explicit-restart timing,
host latency certification and GPU-resource accounting remain separate gaps.

Independent raw-evidence review reproduced the result and found no producer or
receiver failure records. The retry reported concrete `arm: -1`, 12 paints and
`failed: false`. The child duration was 10,524.5969 ms; the 13,045.097 ms above
includes supervisor preflight/operation overhead. The retry has a normal stop
request after cyan but no separate per-attempt exit-observation row; final
process ownership cleanup is established by the outer Job, not an invented
retry exit record. This is not GPU-resource accounting.
