# Studio lifecycle watchdog patch

12 September 2026. Bounded follow-up to
[the watchdog audit](../reviews/studio-watchdog-audit.md).

`StandaloneClient` now arms the candidate watchdog before posting init. Valid
execution-loop heartbeats refresh liveness; silence at or beyond 1,250 ms triggers
termination on the 250 ms polling turn. Healthy asynchronous initialization may
continue until the separate five-second activation cap. Accepted playing workers
also require strictly advancing completed frame IDs within the progress deadline.
These timer settings leave headroom for the two-second stop gate; they do not
establish measured stop completion or eliminate browser scheduling delay.

Every worker has terminal state. Failure/removal marks it terminal, detaches
callbacks, stops watchdog/activation timers and rejects its pending operations
before subsequent callbacks can change accepted state. Timed-out commands and
captures fault the runtime, including when paused; they no longer leave a
nominally healthy worker with a blocked execution queue. Posting failures use the
same cleanup. Capture admission permits one active and one queued request.

Explicit restart uses the last accepted linked bytes directly, preserves current
intensity and advances generation. Compilation and linking are not rerun. Failed
candidate initialization retains the preceding accepted visual and cache.

Validation: 11 new deterministic lifecycle tests plus the guarded-command test
passed (12 focused tests); complete Studio build/CPU suite passed 34/34; TypeScript
checking passed. Cases include exact 1,250 ms silence boundary, healthy slow init,
five-second cap, paused command/capture stalls, strict frame advancement, cached
restart, capture admission, post failures, stale callbacks and timer cleanup.
No Electron, GPU or Resolume execution was performed for this patch.

The MCP integration smoke must expect `initialization stopped making progress`
for a CPU-loop candidate instead of the old five-second error. Root owns that
real UI/MCP run. Browser `terminate()` invocation remains distinct from confirmed
worker termination, native process/group exit and GPU resource teardown. Real
injection/stop timing, recovery to a completed consumed frame within five seconds,
automatic single-retry/30-second storm suppression and native watchdog ownership
remain separate work. This patch makes no claim that those gates pass.
