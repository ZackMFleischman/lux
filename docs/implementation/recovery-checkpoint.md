# Recovery checkpoint

12 September 2026. CPU-only follow-up to [Studio lifecycle watchdog](studio-lifecycle-watchdog.md).

## Bounded correction

Studio restart previously read only the last worker-applied intensity. An admitted
control update followed by a worker failure before acknowledgement therefore
restarted with the older value. `StandaloneClient` now retains the latest admitted
intensity on the accepted runtime and passes it into explicit restart. The command
still rejects on failure; the snapshot remains applied state, not an optimistic
success. The retained intent survives a failed recovery candidate. Duplicate,
stale-generation and wrong-revision requests cannot change it.

Intent is scoped to that runtime's recovery closure. A submitted source inherits
the existing applied control snapshot as before, not an unacknowledged value from
the previous runtime. Document-level controls continue through the existing
authoring-session path. Accepted source and cached linked bytes are unchanged;
restart advances generation without recompiling. Playback behavior is unchanged:
restart preserves playing state when the old snapshot is playing, and starts
paused after a fault. Pending playback commands are not silently replayed.

## Policy audit and unresolved reconciliation

| Area | Current behavior | Authority / remaining gap |
| --- | --- | --- |
| Studio failure | Terminates worker, rejects pending commands/captures, keeps accepted artifact and failed snapshot; explicit restart only. | Acceptance requires explicit recovery; runtime design additionally specifies one automatic retry. That automatic path is absent. |
| Installed recovery | Registry permits three total starts per attached instance, with attempt-based one/two-second retry delays; successful health never resets the budget. | This is neither one automatic retry nor the design's second-fault-within-30-seconds suppression policy. |
| Installed exhausted budget | Entry remains attached without a producer until removal/re-attachment. | No equivalent explicit retry operation is implemented in this registry. |
| Studio cleanup | Terminal flag, callback removal, watchdog/activation timer cleanup and pending-request rejection precede further messages; replacement removes old canvas. Preview detach removes only its subscription. | Worker termination is a browser request, not confirmed native/GPU stop. Owner teardown relies on renderer/window lifetime; no new client disposal API is added here. |
| Installed cleanup | Registry retirement retains capacity while asynchronous graceful drain completes. Close waits for starting/draining producers. Known failure force-stops the producer Job before retry. Supervisor has 30-second idle exit. | Physical Job exit and GPU resource release remain hardware evidence work. |
| Installed timing | Health defaults: 15-second startup, 2.5-second main heartbeat, 4-second frame/output progress; polling every 250 ms. | These do not establish the required two-second generated-JavaScript stop gate. Main-process heartbeat alone is not execution-loop health. |

The [runtime design](../design/runtime.md#watchdog-and-containment) explicitly
requires one automatic restart and failure after a second fault within 30 seconds.
The [acceptance procedure](tracer-acceptance.md) explicitly tests manual recovery;
it does not waive that design requirement. The Studio patch report already marks
automatic recovery as separate work. This checkpoint leaves that discrepancy open,
and changes no installed supervisor behavior.

Proposed coordinator reconciliation: retain explicit-only Studio authoring recovery
only if recorded as an intentional scoped design decision; otherwise implement its
single retry. Separately align installed playback with one automatic retry and a
monotonic 30-second fault window, define the explicit reset operation and its host
entry point, and specify whether the window begins at fault or activation. Review
control snapshot replay, cleanup completion and startup health together before
changing either policy. Existing attempt limits are storm bounds, not acceptance
evidence for the specified policy.

## Verification and limits

- Focused baseline: 11/11 lifecycle tests passed.
- Red regression: recovered intensity was 0.5 instead of admitted 0.8.
- Green: 13/13 lifecycle tests; complete Studio CPU build/test runner 64/64 plus
  7/7 editor tests. Studio and root TypeScript checks passed; diff check passed.
- New coverage: admitted controls survive failure and failed recovery; duplicate,
  stale-generation and wrong-revision commands cannot overwrite intent; source
  replacement does not inherit pending intent.

The test runner required normal subprocess execution for esbuild after sandbox
`spawn EPERM`; no dependencies were installed or changed. No Electron application,
native producer, GPU workload or Resolume was launched. No physical-stop timing,
GPU teardown, current-host-value consumed-frame recovery within five seconds,
automatic retry window or installed cold-start gate is claimed by these tests.

## Current-state reconciliation — 13 September 2026 UTC

Inspected stable checkpoint `b3b72ba`. The sections above retain the earlier
CPU-only audit; their **explicit-only Studio recovery** and **three total installed
starts** descriptions are historical and are superseded by the implementation
below. This reconciliation changes no policy or numerical acceptance budget.

| Area | Implemented at this checkpoint | Evidence boundary |
| --- | --- | --- |
| Studio automatic retry | `StandaloneClient.fault` uses monotonic fault timestamps. A first fault, or a fault at least 30 seconds after the previous fault, permits one cached restart queued after 250 ms. A second fault within that window suppresses automatic restart. Failed automatic startup terminates that candidate without a retry storm; passage of time alone does not restart a suppressed runtime. | Deterministic lifecycle tests cover first/second faults, failed retry startup, the 30-second boundary, and queued retry cancellation. This is implemented policy, not measured physical-stop/recovery acceptance. |
| Studio retry ownership | Automatic recovery uses the accepted linked source and its schema, original assets and latest admitted full control snapshot, without compilation. It advances generation and preserves the last acknowledged playing/paused state. Source replacement cancels an old queued retry; a new source does not inherit old unacknowledged control intent. | Generic numeric controls now use schema/revision guards; legacy Intensity remains compatible. A retained intent is not a successful acknowledgement of the failed original command. |
| Studio explicit recovery | Guarded Restart remains available after suppression or a failed automatic candidate. It cancels the queued automatic action and reuses the accepted closure. It retains fault history rather than granting a fresh automatic retry budget; explicit restart from failed playback starts paused. | Worker-ready and successful cached restart are functional endpoints, not independently observed host-consumed recovery. |
| Installed recovery | `InstanceRegistry.fault` applies the same previous-fault/30-second eligibility rule on the supervisor's monotonic clock, with a 250 ms retry delay. Successful activation does not clear fault history. The old fixed three-start cap is gone. A suppressed attached instance stays failed; removing and re-adding it resets its policy through a new registry entry. | Registry tests cover suppression, healthy generations, exact-window eligibility, removal/re-attachment and rejected backward clocks. There is no separate installed Restart command. |
| Cleanup and health | Studio still marks the worker terminal, removes handlers/timers and rejects pending work before requesting termination. Installed failure awaits forced producer stop before retry; removal retains draining ownership/capacity. Installed health defaults remain 15 s startup, 2.5 s heartbeat and 4 s frame/output progress, polled every 250 ms. | Browser termination requests, watchdog thresholds and supervisor stop deadlines do not independently establish execution exit or GPU-resource release within the acceptance gate. |

Implementation references: [Studio client](../../apps/studio/src/standalone-client.ts),
[Studio lifecycle tests](../../tests/studio/runtime-lifecycle.test.ts),
[installed registry](../../apps/installed-runtime/src/registry.cjs), and
[registry tests](../../tests/unit/installed-registry.test.cjs).

The [integrated Studio evidence](../../evidence/tracer-0.1/parameters-images-studio/validation.md)
records real scene-v3 save/open and cached restart retaining generic controls,
PNG/JPEG originals and rendered output. Failed code and missing required images
retain the previous working runtime. These functional checks supersede the older
Intensity-only scope, but do not inject and independently observe a complete
physical failure/recovery attempt.

The [installed image fixture](../../evidence/tracer-0.1/parameters-images-studio/installed-image.md)
records packaged PNG output matching Studio, fixture exit 0 and outer Job
descendant-cleanup confirmation. It does **not** exercise restart recovery or
measure injection-to-execution-stop. Its 4,405.5242 ms first-output observation is
startup from the first native callback, not recovery from an explicit restart.

`packages/performance/recovery.ts` now evaluates independently supplied stop and
consumed-reference-frame endpoints and rejects incomplete/lost evidence. Its CPU
fixtures validate arithmetic and identity checks; overall hardware acceptance
remains unavailable. The required **2 s injected-JavaScript physical stop** and
**5 s explicit restart to a host-consumed reference frame with current host
controls**, host responsiveness, GPU teardown and real Resolume failure recovery
remain unverified. Do not substitute a terminate request, worker-ready response,
successful clean shutdown or startup timing for those endpoints.

### Subsequent real Studio fault injection

The [real Studio recovery check](../../evidence/tracer-0.1/parameters-images-studio/studio-recovery.md)
now covers throwing and unresponsive generated JavaScript, one automatic retry,
playing/control preservation, second-fault suppression, unchanged source, and an
explicit paused restart with checked reference pixels and capture metadata.
This upgrades functional Studio recovery evidence; installed recovery and the
physical stop/GPU-cleanup/host-consumption budgets remain unverified.
