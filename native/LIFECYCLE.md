# TR-02 receiver lifecycle: offline repair contract

This source is newer than the earlier diagnostic DLL involved in the system freeze. The exact earlier source is unavailable. These repairs address independently identified current-source hazards; they do not establish or fix the freeze's root cause. No graphics execution or actual-host acceptance accompanies this change.

## Unload limit

The worker has explicit Stopped, Starting, Running, StopRequested and Finished states. Start requires an actual worker initialization acknowledgement; failed startup is stopped/joined before returning failure. A finished thread must be joined before restart. FFGL initialization propagates receiver failure. Repeated start/stop resets all per-session textures, fences and frame identities.

Stop requests cessation and assesses worker completion with a two-second budget. If completion is unavailable, it emits `bounded-unload-unsupported` through OutputDebugString and the host JSONL log, then retains the worker and waits. This assessment is bounded; **DeInitGL itself is not bounded**. Driver calls, context destruction, and host-output completion can still stall. There is no thread detach, TerminateThread, glFinish, or return to SDK deletion while the worker owns live code/resources. A failed GPU query/fence/unlock/unregister that cannot prove safe release quarantines the worker indefinitely. Process termination is the remaining recovery boundary; even an external process watchdog cannot promise recovery from a whole-system GPU stall.

The pinned SDK `native/vendor/ffgl/source/lib/ffgl/FFGL.cpp` (deInstantiateGL, approximately lines 384–389) calls `p->DeInitGL()` and then unconditionally `delete p`, ignoring its result. Returning FF_FAIL is therefore not a safe way to retain a stalled receiver. The initialization failure path similarly calls DeInitGL and deletes the instance.

## Ownership

Each imported slot uses the production `ImportOwnership` ledger, exercised by CPU fake-operation tests. The common normal/exception cleanup path polls pending D3D completion, retires the exact source key, releases read admission, polls pending GL completion, unlocks NV interop, unregisters the object, then deletes GL and COM resources. Any failed prerequisite stops that chain. Interop closes only after all imports have been cleaned. A timeout is not a completion signal. Host output fences are separately drained before output texture deletion. Output storage is resized only after its previous host read retired.

The host thread creates an unused sharing GL context through its current host DC. The worker creates a hidden window with a unique CS_OWNDC class, sets the host's captured pixel format, binds the transferred context only to that independent DC, and owns its destruction sequence. It never makes the host's DC current. The host's sharing context must remain alive throughout synchronous start/stop. Matching pixel format and cross-context/adapter sharing are compile-checked only; actual compatibility and driver behavior still require independent review and later authorized hardware evidence.

## Shared-ring v2 shutdown handshake

Protocol v2 replaces the separate alive bit with one interlocked admission word: a closing bit plus an active-reader count. A receiver atomically increments admission before examining/claiming Ready slots. It retains admission through any source D3D copy and exact-key retirement. Producer close atomically sets the closing bit; no new admission can succeed afterward. Producer resource release requires zero admitted readers plus no outstanding borrowed copies or Reading slots. This covers a reader admitted immediately before close but not yet visible in any slot state. A crashed or permanently stalled reader is deliberately not reclaimed without proof of safe GPU completion. Old v1 rings are rejected.

Producer submission constructs its acceptance response before enqueuing the GPU copy; completion polling constructs its response before forgetting borrowed IDs. Allocation failure therefore cannot silently lose accepted or completed borrowed leases. These native response boundaries were compiled, not exercised through a loaded addon in this offline run.

## Verification

CPU-only CTest names: `native_clock_smoke`, `pool_ownership`, `shared_ring_ownership`, `shutdown_admission`, `receiver_lifecycle_cpu`.

The shutdown test first reproduced the old alive-check / producer-release / receiver-acquire ordering and failed with `receiver acquired after producer approved release`. The replacement test exercises the real interlocked protocol in both close-first and reader-first orders, including repeated close.

The cleanup test first failed on unconditional release of a pending copy. Production-ledger tests cover pending/failed D3D completion, ordered source retirement/admission release, partial registration failure, pending GL completion, locked failure, unregister failure, failed initialization, repeated lifecycle calls and restart after reap. A promise-gated CPU thread verifies a stop-deadline assessment reports pending while the operation remains blocked and permits join only after explicit completion.

All native targets are compiled without loading the plugin/addon or running the standalone graphics host. Known pre-existing compile warnings: FFGL macro redefinitions and `/UNDEBUG` overriding Release `/DNDEBUG` in old assertion tests. Successful compilation/CPU tests do not satisfy TR-02 hardware, latency, color, or bounded-unload acceptance.

## Context-failure diagnostics (follow-up)

The supervised prompt failure `worker shared GL context failed` did not distinguish context creation from binding. Diagnostic-only records now capture the host's current GL version/profile/flags/vendor/renderer and drawable pixel format, PFD fields, window/thread/monitor/display identity; the worker's independent drawable and pre-call current context; and separate `wgl-create-context` / `wgl-make-current` results with GetLastError captured immediately after each call. Error zero is recorded as zero, not interpreted as success. Display-device identity is explicitly not a verified GL adapter LUID. No context attributes, sharing topology, window placement or retry behavior changed.

Possible explanations remain hypotheses until these records are collected: incompatible device/renderer or share context; unsupported format/version/profile combination; or successful creation followed by drawable binding failure. The [ARB specification](https://registry.khronos.org/OpenGL/extensions/ARB/WGL_ARB_create_context.txt) defines the creation errors and leaves cross-version sharing support to implementations. [Microsoft's wglMakeCurrent contract](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wglmakecurrent) requires matching device and pixel format and prohibits one context from being current on two threads. This receiver binds a newly created context, so the host sharing context being current elsewhere is not by itself evidence of violating that rule. A different HDC alone also does not establish incompatibility.

## Host-created context handoff hypothesis

The context-only trace isolated creation failure ERROR_INVALID_OPERATION (4317 carried in 0xC00710DD), before make-current, despite matching PFDs. The next single hypothesis creates the unused sharing context on the active host thread/DC and transfers it to the worker. ARB context-creation rules permit binding the returned context to a different DC with the same pixel format and device; matching PFDs alone do not establish the device requirement on hybrid systems. Worker binding may therefore still fail and remains separately logged. No host-DC rendering or worker current binding to the host DC is introduced. Creation now occurs in InitGL before the worker acknowledgement timeout and can itself block in the driver; no bounded initialization claim is made.

The production handoff helper is CPU-tested for creation failure, exceptions after resource preparation, thread-launch failure, successful ownership transfer, and duplicate-start refusal. The unused context is deleted on pre-launch failure; deletion failure retains ownership under the existing unsupported-unload policy. These tests and compilation do not establish hardware compatibility or fix the earlier system freeze.

The worker's transferred context is also protected during path/stream construction: allocation exceptions release the still-unused context and finish the worker, while deletion failure retains it. Empty optional storage and the other owners constructed before the GPU try block are compile-checked as nothrow default-constructible. CPU injection covers allocation and non-standard exceptions at this early boundary.

## Receiver stop and final diagnostics (R1)

The production `ReceiverRun.h` boundary classifies a failed D3D query as failure
even when stop is requested, and preserves a completed query as complete. For a
pending query, a requested stop takes precedence over the poll deadline and exits
the body through a dedicated internal marker. A real query failure or deadline
still emits its precise failure reason. Cancellation skips retirement, admission
release, NV locking and publication after that pending copy; it does not clear
the ownership ledger. Pending or failed cleanup retains ownership until an actual
Complete result permits the established retirement/admission/unregister/release
order. Driver calls and quarantine remain subject to the unload limitations above.

Normal return, cancellation and body exceptions now reach one final diagnostic
attempt before `activation.end()` and the unchanged GPU cleanup. Failure and
finalization callbacks are contained independently, so a throwing diagnostic does
not skip that cleanup handoff. Opportunity counters, the 100,000-record cap and
loss accounting are unchanged. Attributed opportunity draining and the summary
require a current-run successful `activation.begin()` return. A retained old ID,
or an ID assigned by a begin that then throws, cannot authorize attributed rows;
initialization instead attempts an unattributed `host-telemetry-unavailable` row.

Failure rows use the production bounded formatter: at most 1024 reason bytes,
escaped quotes/backslashes, deterministic `\u00XX` escapes for control and
non-ASCII bytes, and a visible `...[truncated]` suffix when the scan limit is
reached. This is bounded byte rendering, not Unicode-preserving conversion.
Diagnostic I/O or allocation failures may leave missing or truncated rows. There
is no retry of partial output and no claim that one attempt guarantees a valid
summary. Summaries precede resource cleanup and cannot prove GPU completion.

`receiver_run_cpu` tests the production decision matrix, cancellation continuation,
known/unknown failures, callback failures and ordering, current-run attribution,
and bounded failure escaping through a real failing ostream. Extended ledger
tests preserve pending/failed ownership after stop and the existing GL negatives.
These CPU checks and DLL compilation provide source-level evidence only. Actual
host behavior, physical stop timing, frame freshness and clean-machine acceptance
remain separate work; prior incomplete timing spans and failure rows remain invalid.

## Obsolete source publications (R2a)

After recording the selected source's exact key, lease and read admission, the
receiver calls `retireObsoleteReadySources`. The helper takes a separate temporary
admission and claims each other Ready slot into Reading before inspecting its
frame. It retires only nonzero older frames through the existing key-checked
operation. Equal, newer and zero frames return to Ready; the selected lease,
other readers and in-progress producers remain untouched. Publication ordering
remains non-wrapping within the existing generation convention.

Closing or saturated admission skips reclamation without changing ownership.
An invalid selected key fails with temporary admission balanced. Invariant
failure never forces a slot Free; failed ownership restoration retains temporary
admission for containment. The receiver sends failure through its unchanged R1
finalization and cleanup. Its selected lease and original admission still require
actual copy completion before release; reclaiming a completed Ready publication
cannot establish completion of that selected copy.

`source_slot_retirement_cpu` covers repeated reclamation/reuse, two admitted
readers, producer ownership, retained publications, invalid selection, admission
refusal and immediate producer reuse. Existing receiver lifecycle checks preserve
Pending/Failed copy ownership until Complete. These CPU checks and DLL compilation
provide ownership evidence only; physical completion, freshness, timing and
performance remain separate R2b and hardware work.
