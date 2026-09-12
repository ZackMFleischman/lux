# TR-02 incident: offline review and restart gates

Status: hardware execution paused after user-reported system freeze requiring forced power-off. This review does not establish root cause.

## Findings

1. Current receiver shutdown is unbounded. FrameReceiver::stop joins its worker; the worker may be inside NV interop or glFinish. Moving driver waits off ProcessOpenGL does not bound DeInitGL. Required change: an explicit lifecycle/failure policy that does not detach a thread with live plugin code/resources or promise safe termination of a stuck driver call. Validate shutdown state transitions using injected stalled operations without GPU execution.
2. Current receiver exception path skips detach cleanup and can close the interop device while registered objects/leases remain. Required change: explicit ownership state and cleanup ordering for each failure boundary, including partial initialization, pending D3D copy and locked GL resources. Test with fake APIs that record acquire/release order. Do not release resources still in use by the GPU.
3. Worker borrows the host HDC. The lifetime and concurrent drawable use are not isolated from the host. Investigate a worker-owned drawable/DC with matching pixel format and shared objects. This is a risk requiring design review, not an established violation or crash cause.
4. The exact staged native diagnostic source was not committed before replacement by receiver code. Current first source history is72e2369 and differs from baseline behavior/log schema. Preserve the disabled DLL; do not claim a source change fixes that exact binary. Every future staged DLL needs a source checkpoint and build manifest before execution.
5. Standalone and actual-host experiment activity overlapped. Introduce an exclusive experiment lock and explicit host-state precondition, PID/lifecycle manifest, per-run logs and conservative5–10second diagnostic defaults. Independently supervised deadlines bound a responsive process, not a whole-system GPU stall.

## Next implementation work (offline only)

- Build fake-operation lifecycle tests for initialization failure, copy timeout, locked-object failure and shutdown stall.
- Implement owned resource states and reviewed teardown policy; compile without loading the plugin.
- Implement/test experiment supervision using harmless child processes, including timeout and competing-run refusal.
- Obtain independent review of ownership/lifecycle and build provenance. Only then select one minimal hardware hypothesis for a user-assisted run. Keep Resolume closed during standalone runs.

The previous requirement remains: actual Resolume1080p transport/performance acceptance has not passed. No downstream runtime/editor expansion yet.
