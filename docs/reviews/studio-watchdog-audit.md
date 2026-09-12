# Studio watchdog and recovery audit

12 September 2026; read-only review of tracer commit
`9c0a20699e7ea6fe9166681525ece10bfc432597`. No graphics launches or behavioral
patches. Line references below are to that checkpoint.

**Outcome:** candidate CPU loops exceed the required stop budget; the ready-worker
path requests termination but does not measure completed termination. A paused
worker with a hung asynchronous command can remain nominally healthy forever.
Implement a shared candidate/live lifecycle watchdog and command-progress tracking
next, then separately prove browser termination and native process containment.

## Authoritative timings

`docs/design/runtime.md:137–141` specifies execution-loop heartbeats every 250 ms;
proposed detection at 1,250 ms and forced-stop deadline at 1,750 ms; **confirmed
stop within 2,000 ms of injected unresponsiveness** is the acceptance gate, not
time until an error banner. `tracer-acceptance.md:72,93–105` requires both init
and update loop tests, responsive UI/host, saved source intact and prior accepted
candidate preserved. The five-second smoke/activation API budget in
`ai-authoring.md:136` is a separate overall timeout; it does not override the
stricter loop-stop requirement (`tracer-0.1.md:144`). Healthy async GPU/device
initialization may use that overall budget while continuing verified heartbeats.

Explicit restart must restore a completed reference image/current host controls
within **5,000 ms**; host measurement ends at actual consumption, not worker ready.
Runtime design additionally calls for one automatic recovery attempt; a second
fault within **30 seconds** latches Failed until explicit retry. Capture permits
one active plus one queued request, **5,000 ms**, at most **8 MiB** PNG.

## Findings

1. **Candidate liveness is unchecked until ready (P1).**
   `standalone-client.ts:61` sets only a 5,000 ms initialization timer; the
   250 ms watchdog starts at `105–108`, after initialization resolves. The worker
   already creates its heartbeat at `visual-worker.mjs:37`, before dynamic import,
   create and first update/render. Therefore a synchronous loop during import,
   create or first draw emits no more heartbeats but survives until the five-second
   timer. Prior preview retention is correctly implemented, but it is not a
   two-second containment result. `scripts/test-studio-mcp.mjs:71–73` currently
   asserts the five-second error text, baking this weaker behavior into the smoke.

2. **Heartbeat and execution progress are conflated (P1).**
   Client `66` refreshes liveness for any matching-identity message before payload
   validation. `86` treats any valid-looking frame/status as progress without
   requiring frame advancement. Worker heartbeats include frameId but no command
   progress (`37`). A synchronous live loop nominally triggers `>1500 ms` on the
   next 250 ms polling turn (roughly 1.5–1.75 seconds plus scheduling delay).
   An asynchronous `render()`/GPU completion stall can continue timer heartbeats;
   playing detection waits `>2000 ms` and the next poll, already roughly 2–2.25
   seconds before requesting termination. More seriously, paused command draws
   (`75,81`) can stall with heartbeats and never trigger the playing-only progress
   check. The command promise rejects after five seconds but the runtime stays
   paused/healthy and its serialized worker queue remains stuck.

3. **Pending commands lack complete lifecycle ownership (P1/P2).**
   Active failure and successful replacement correctly reject and clear pending
   promises (`89,114`). Ordinary command/capture timeout (`132,147`) only removes
   the parent wait; it does not cancel worker work or unblock `chain` (`68`).
   Repeated captures can enqueue unbounded worker work; no one-active/one-queued
   admission exists in this client. Synchronous `postMessage` failure leaves its
   map entry/timer alive until timeout. `fault()` retains `running` and message
   handlers, with no terminal flag: defense against callbacks dispatched around
   shutdown depends on browser termination rather than application state.
   Add an explicit terminal state and generation-scoped pending ownership; test
   that synthetic late ready/status/capture cannot promote or revive a terminal
   candidate. This is a missing invariant, not a claim that the browser normally
   delivers messages after completed termination.

4. **Restart has no five-second recovery bound (P1 acceptance gap).**
   `invoke()` calls `submit(this.source)` (`123`), which recompiles and links before
   worker start (`40–43`). Compile and link can each take their independent
   30-second budgets. Retain the last validated linked payload/settings and restart
   directly from it, preserving current authority controls and incrementing
   generation. Explicit retry exists; automatic retry/storm suppression does not.
   Candidate failure correctly preserves accepted source because `this.source`
   changes only after successful activation (`44`).

5. **Timing evidence and performance remain incomplete.**
   The command fake-worker test checks explicit failure rejection, generation
   guards and that `terminate()` was called, not elapsed deadlines or actual stop.
   The MCP smoke checks prior revision retention after an init loop, not injection
   versus stop timestamps. `tests/compiler/memory.test.mjs:25` does confirm a real
   harmless Node child has exited within two seconds using Job timing and PID
   checks; this is useful native supervisor evidence, not Studio browser-worker
   evidence. Worker scheduling waits `1000/fps` after completed draw (`26`) and
   awaits GPU completion every frame (`19`), so actual cadence includes work time;
   nominal 60 fps cannot be treated as measured 60 Hz delivery. UI snapshots publish
   per frame, while UI/visual FPS remain null. Keep the separate workload gates:
   30 s warmup + 300 s run; UI p95 ≤50 ms/p99 ≤100 ms; CPU p95 ≤4 ms; GPU p95 ≤12 ms;
   59.4–60.6 host opportunities/s, ≥99% fresh, no gap >100 ms; routine overhead <2%.
   These are future measurements, not conclusions from this static audit.

## Bounded next patch and CPU tests

Introduce a small lifecycle owner used by both candidate and active workers,
with injectable monotonic clock/timers/Worker adapter. Arm it **before init is
posted**. Track terminal state, liveness, last strictly advancing completed frame,
current command/phase and command progress separately. Use 250 ms polling and
`>=1250 ms` heartbeat-stall detection, leaving termination headroom; keep the
independent five-second healthy activation limit. At explicit error or deadline,
mark terminal first, stop timers, detach handlers, reject owned pending commands
once, request termination and preserve the last-good preview/source. Do not call
an unacknowledged terminate request a confirmed stop.

Paused idle needs only liveness; a dispatched command/capture needs bounded
progress even while paused. Distinguish healthy asynchronous startup, command
stall and GPU completion stall in state/error records. The five-second capture
deadline is compatible with healthy bounded capture work; if its serialized queue
is hung at that deadline, abort the owner/recover rather than just forgetting its
promise. A synchronous CPU loop still uses the shorter heartbeat deadline.
Validate heartbeat/frame messages before updating timers; preserve the documented
limitation that generated code sharing a JS realm is not an adversarial-proof
health oracle. Cache last accepted linked bytes for restart; automatic recovery
and native service leases can follow as their own focused patch.

CPU tests should use deterministic timer advance and cover: silent candidate;
healthy heartbeats during slow init; candidate timeout retaining prior generation;
live and paused CPU stall; paused async command stall; unchanged frameId versus
advancement; explicit failure; capture queue overflow; command timeout cleanup;
postMessage throw; terminal late callbacks; no surviving timers/pending entries;
restart from cached linked bytes without another compile. Assert the 1,250 ms
detection boundary exactly; fake termination can only prove invocation/ownership.

## Real-stop evidence boundary

The [HTML worker termination algorithm](https://html.spec.whatwg.org/multipage/workers.html#terminate-a-worker)
aborts executing script, discards queued worker tasks and clears the dedicated
worker's entangled port queue. It runs in parallel with the worker loop;
`Worker.terminate()` exposes no completion promise/exit event or numeric deadline.
It does not prove OS-process exit, native texture release or recovery from a GPU
driver hang. Do not substitute the timestamp of the call for observed completion.

After the CPU patch, coordinate real browser-worker loop fixtures at module
evaluation, create and later update, with external monotonic injection/termination
instrumentation (for example a verified Chromium worker-target termination event)
and a still-responsive UI acknowledgment trace. Confirm what that browser signal
actually measures before accepting it. Separately inject a harmless loop in the
owned native render process group; record QPC injection/confirmed process-exit
timestamps, group cleanup and source preservation. **Every sample must stop within
2,000 ms**; polling delay and scheduler jitter count, not just configured timeout.
Then measure explicit recovery to the completed consumed frame at **≤5,000 ms**
with current host controls, and the 30-second restart-storm policy. Neither browser
termination nor successful native process exit establishes safe GPU-driver teardown.
