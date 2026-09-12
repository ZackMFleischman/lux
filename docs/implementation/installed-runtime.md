# Installed runtime foundation

Removal drains run independently of the supervisor polling loop. A draining
producer retains its capacity slot and cannot be replaced until cleanup finishes;
supervisor shutdown waits for both pending admissions and removal drains. This
keeps a slow source teardown from expiring healthy sibling heartbeats.

Implemented CPU/build checkpoint; installed GPU and Resolume acceptance is pending.

Each registered `Lux_<releaseId>.dll` reads its adjacent `.dll.lux-source` descriptor
at scan time (at most 512 ASCII bytes). Five lines identify protocol
`lux-installed-source-v1`, the immutable 64-hex release and runtime IDs, a unique
four-character FFGL ID, and a display name of at most 16 characters. Scanning
does not launch a process or execute a visual. The original `LuxTracerTR02.dll`
without a descriptor keeps the probe behavior.

On activation, the receiver worker creates an independent 32-hex instance lease
under `%LOCALAPPDATA%/Lux/Installed/instances/<runtimeId>`. A per-user native
startup mutex and supervisor mutex prevent duplicate owners. The pinned
`runtimes/<runtimeId>/electron/electron.exe` runs `apps/installed-runtime/src/supervisor.cjs`
in Node mode. No separate Node installation, checkout or Studio is required.
The supervisor hashes the installed runtime once on cold startup. Additional
sources share that validated supervisor; each source uses its own producer
process, Electron renderer and visual worker because the texture addon currently
owns process-global GPU state. GPU process startup remains a per-instance cost.

The supervisor starts each producer suspended, assigns a dedicated Windows Job
with kill-on-close, then resumes it. Its native handle is the only stop target;
no process-name matching or shared producer termination occurs. Each producer
publishes its mapping name to its own rendezvous file. The receiver sends its
current host intensity through that ring before the compiled worker initializes.
Existing host-control/render acknowledgement gates are retained. Exact worker
frame to compositor-texture association still requires the existing GPU
acceptance evidence; this checkpoint does not close that gap.

Admission is limited to 16 instances per runtime and three producer starts per
attachment, with backoff. Source removal deletes its lease and drains that one
producer for up to three seconds before closing its Job. Crashed host leases
expire after ten seconds. The supervisor stays warm for 30 seconds after its
last attachment, then exits. A crashed supervisor closes every Job it owns;
remaining host instances automatically request a replacement supervisor.
Each producer attempt receives a fresh 32-hex nonce, an immutable request under
`<instanceId>.attempts/<attemptId>.json`, and a private status file beside it.
Retries also use separate Electron profile/output directories. Old-attempt
status cannot renew a replacement. The original top-level host lease remains
the source-removal authority.

The supervisor now owns a monotonic 15-second first-ready deadline. Readiness
requires the first host-control-acknowledged visual and a completed published
texture copy. After readiness, producer-main status must advance within 2.5
seconds, worker frame IDs within 4 seconds, and output admission within 4 seconds.
Main writes one bounded, atomically replaced status file every 250 ms, starting
before `loadFile`/`getGPUInfo` awaits; missing, malformed, replayed or foreign-nonce
samples cannot renew health. No child-supplied timestamp controls a deadline.
Known expiry immediately closes only that producer's Job, then uses the existing
backoff and maximum three starts. The final failed attempt is also disposed.

Installed visuals remain playing while attached; a host pause is not a request
to pause their simulation clock. A non-consuming host may legitimately fill the
receiver ring. Confirmed `no-free-slot` callbacks with no borrowed copy outstanding
renew output-admission freshness while worker-frame and main-heartbeat progress
remain required. An in-flight-copy stall receives no backpressure exemption.
This avoids restarting healthy sources merely because their host stopped drawing.
The 15/2.5/4-second watchdog values are conservative recovery failsafes, not proof
of the original <=2-second stop gate or three-second cold responsiveness target.
Normal removal still has its existing up-to-three-second drain path; watchdog
expiry does not add that drain delay.

Startup errors are recorded beside the instance lease (`*.error` and
`supervisor.error`); missing native descriptors also report through the Windows
debug output. A polished host-visible error panel is not implemented.

Supported registration root is `%LOCALAPPDATA%/Lux/Installed`; custom package
storage is separate from installed playback. Runtime packaging must include all
three installed-runtime CJS modules, rebuilt render-host main/worker files, the
descriptor-aware source DLL and native texture addon. Rebuild/export creates a
new runtime hash; do not patch files inside an existing installed runtime.
The source DLL statically links its C++ runtime so registration does not depend
on Resolume's DLL search finding a matching VC redistributable. Export and
registration can use `assertRuntimeCapabilities` to reject probe-only DLLs,
old addons and old emitted render-host main files without loading their code.
These protocol markers detect stale builds; complete package hashes remain the
integrity check.

CPU validation: registry isolation, rejected identity changes, bounded capacity,
retry limits, native descriptor parsing, and the existing native ownership,
control and lifecycle suite. A metadata-only scan in a disposable CPU process
also checks the real copied DLL's release ID/name and canonical 0.5 default;
it does not call InitGL. No installed producer, GPU or Resolume launch was
performed for this checkpoint. Cold reopen, duplicate/different source playback,
first accepted pixels, performance and live shutdown remain root QA gates.

Watchdog CPU evidence additionally covers fake-time startup stalls, independently
stale main/worker/output progress, receiver backpressure, foreign/replayed status,
per-attempt path isolation, forced expiry of only the affected Job and disposal
after the third failed attempt. A fake Electron test executes the real render-host
main with `loadFile` permanently pending and observes bounded non-ready heartbeat
publication. These tests do not initialize graphics. Re-emit the render-host main
before export: the capability marker is now `lux-installed-render-host-v2`, so an
old pre-watchdog emitted main is rejected rather than silently missing health.
