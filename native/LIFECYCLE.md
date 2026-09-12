# TR-02 receiver lifecycle: offline repair contract

This source is newer than the earlier diagnostic DLL involved in the system freeze. The exact earlier source is unavailable. These repairs address independently identified current-source hazards; they do not establish or fix the freeze's root cause. No graphics execution or actual-host acceptance accompanies this change.

## Unload limit

The worker has explicit Stopped, Starting, Running, StopRequested and Finished states. Start requires an actual worker initialization acknowledgement; failed startup is stopped/joined before returning failure. A finished thread must be joined before restart. FFGL initialization propagates receiver failure. Repeated start/stop resets all per-session textures, fences and frame identities.

Stop requests cessation and assesses worker completion with a two-second budget. If completion is unavailable, it emits `bounded-unload-unsupported` through OutputDebugString and the host JSONL log, then retains the worker and waits. This assessment is bounded; **DeInitGL itself is not bounded**. Driver calls, context destruction, and host-output completion can still stall. There is no thread detach, TerminateThread, glFinish, or return to SDK deletion while the worker owns live code/resources. A failed GPU query/fence/unlock/unregister that cannot prove safe release quarantines the worker indefinitely. Process termination is the remaining recovery boundary; even an external process watchdog cannot promise recovery from a whole-system GPU stall.

The pinned SDK `native/vendor/ffgl/source/lib/ffgl/FFGL.cpp` (deInstantiateGL, approximately lines 384–389) calls `p->DeInitGL()` and then unconditionally `delete p`, ignoring its result. Returning FF_FAIL is therefore not a safe way to retain a stalled receiver. The initialization failure path similarly calls DeInitGL and deletes the instance.

## Ownership

Each imported slot uses the production `ImportOwnership` ledger, exercised by CPU fake-operation tests. The common normal/exception cleanup path polls pending D3D completion, retires the exact source key, releases read admission, polls pending GL completion, unlocks NV interop, unregisters the object, then deletes GL and COM resources. Any failed prerequisite stops that chain. Interop closes only after all imports have been cleaned. A timeout is not a completion signal. Host output fences are separately drained before output texture deletion. Output storage is resized only after its previous host read retired.

The worker creates a hidden window with a unique CS_OWNDC class, sets the host's captured pixel format, creates a sharing GL context on that independent DC, and owns its entire destruction sequence. It never makes the host's DC current. The host's sharing context must remain alive throughout synchronous start/stop. Matching pixel format and cross-context/adapter sharing are compile-checked only; actual compatibility and driver behavior still require independent review and later authorized hardware evidence.

## Shared-ring v2 shutdown handshake

Protocol v2 replaces the separate alive bit with one interlocked admission word: a closing bit plus an active-reader count. A receiver atomically increments admission before examining/claiming Ready slots. It retains admission through any source D3D copy and exact-key retirement. Producer close atomically sets the closing bit; no new admission can succeed afterward. Producer resource release requires zero admitted readers plus no outstanding borrowed copies or Reading slots. This covers a reader admitted immediately before close but not yet visible in any slot state. A crashed or permanently stalled reader is deliberately not reclaimed without proof of safe GPU completion. Old v1 rings are rejected.

Producer submission constructs its acceptance response before enqueuing the GPU copy; completion polling constructs its response before forgetting borrowed IDs. Allocation failure therefore cannot silently lose accepted or completed borrowed leases. These native response boundaries were compiled, not exercised through a loaded addon in this offline run.

## Verification

CPU-only CTest names: `native_clock_smoke`, `pool_ownership`, `shared_ring_ownership`, `shutdown_admission`, `receiver_lifecycle_cpu`.

The shutdown test first reproduced the old alive-check / producer-release / receiver-acquire ordering and failed with `receiver acquired after producer approved release`. The replacement test exercises the real interlocked protocol in both close-first and reader-first orders, including repeated close.

The cleanup test first failed on unconditional release of a pending copy. Production-ledger tests cover pending/failed D3D completion, ordered source retirement/admission release, partial registration failure, pending GL completion, locked failure, unregister failure, failed initialization, repeated lifecycle calls and restart after reap. A promise-gated CPU thread verifies a stop-deadline assessment reports pending while the operation remains blocked and permits join only after explicit completion.

All native targets are compiled without loading the plugin/addon or running the standalone graphics host. Known pre-existing compile warnings: FFGL macro redefinitions and `/UNDEBUG` overriding Release `/DNDEBUG` in old assertion tests. Successful compilation/CPU tests do not satisfy TR-02 hardware, latency, color, or bounded-unload acceptance.
