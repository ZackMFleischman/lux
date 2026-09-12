# Installed runtime foundation

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
Startup errors are recorded beside the instance lease (`*.error` and
`supervisor.error`); missing native descriptors also report through the Windows
debug output. A polished host-visible error panel is not implemented.

Supported registration root is `%LOCALAPPDATA%/Lux/Installed`; custom package
storage is separate from installed playback. Runtime packaging must include all
three installed-runtime CJS modules, rebuilt render-host main/worker files, the
descriptor-aware source DLL and native texture addon. Rebuild/export creates a
new runtime hash; do not patch files inside an existing installed runtime.

CPU validation: registry isolation, rejected identity changes, bounded capacity,
retry limits, native descriptor parsing, and the existing native ownership,
control and lifecycle suite. No installed producer, GPU or Resolume launch was
performed for this checkpoint. Cold reopen, duplicate/different source playback,
first accepted pixels, performance and live shutdown remain root QA gates.
