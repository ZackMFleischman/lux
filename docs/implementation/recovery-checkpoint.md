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
