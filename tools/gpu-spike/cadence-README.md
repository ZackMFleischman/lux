# Native cadence pilot

`LUX_STANDALONE_CADENCE=1` enables a test-host-only, cold-start diagnostic. It
requires exactly 10000 ms host duration and the existing 30000 ms supervised Job.
Alpha, hang, recovery and pixel modes are mutually exclusive with cadence.
The coordinator alone launches graphics after reviewing a fresh private artifact.
No production runtime, package, watchdog or performance acceptance policy changes.

The independent QPC window begins after FFGL and output-FBO initialization, before
the first callback, and lasts exactly ten seconds. Six hundred nominal deadlines
are `start + floor(slot * frequency / 60)`, for slots 0 through 599. A Windows
high-resolution one-shot waitable timer blocks until each deadline; early wakes
rearm against QPC. Late wakes skip obsolete slots and never issue catch-up bursts.
Every slot is retained as called or missed. Timer failures fail the diagnostic;
there is no busy wait, ordinary Sleep fallback, or global timer-resolution change.
The observer waits through the independent endpoint even after its last callback.

Fixed storage records QPC immediately around each FF_PROCESS_OPENGL call. There
are no captures, per-frame readbacks, file writes, or new GPU commands in this mode.
Normal plugin GPU work and its existing telemetry remain enabled. Successful
ProcessOpenGL currently calls acquireLatest exactly once. The inspector requires
equal record counts, contiguous ordinal joins, and the actual opportunity QPC
inside the corresponding call bracket. No-frame and held-frame opportunities stay
in the denominator; omitted callbacks cannot shorten the observation window.
QPC call spans include scheduling interruptions and driver time, not exclusive CPU
execution. Timing calls and fixed record writes introduce a small uncalibrated CPU
cost; no overhead acceptance claim is made. Existing receiver logging is unchanged.

The report provides observed Hz, missed slots, lateness, elapsed callback quantiles,
and transport selection/hold counts. Cold startup is included and may leave many
no-frame rows. Native transport IDs can duplicate a worker image, so transport
advancement is not a fresh-rendered-image measure. This pilot does not satisfy
the existing 300-second acceptance window, actual Resolume testing, full GPU cost,
control latency or full performance acceptance. Keep partial raw evidence when
timing, record loss, lifecycle or cleanup checks fail; never promote it to a pass.

CPU verification: `scripts/native-build.ps1`, then
`node --test --test-isolation=none tests/unit/cadence-inspect.test.mjs tests/unit/native-cadence-options.test.mjs tests/unit/native-stop-options.test.mjs`.
The option tests use `--validate-options`, which exits before graphics initialization.
