# Independent technical readiness review

Reviewed snapshot: `c6cf8eee4481daa73673188f10af58d6aa3016ef`. Reviewer bias: technical feasibility and runtime reliability. Review date: 2026-09-12 UTC. This reviewer did not author the design and did not consult other review reports.

**Verdict: ready to start the bounded tracer experiments (TR-01 and TR-02).** No finding blocks starting environment verification or the GPU spike. Two contract clarifications are required before their affected interfaces are frozen; neither requires proving the runtime during this documentation-only pass. This verdict does not approve proceeding beyond a failed TR-02 gate and does not certify GPU transport, performance, sandboxing, or host recovery.

Read scope: `docs/README.md`, requirements, architecture, decisions, every document under `docs/design/` and `docs/implementation/`, and the original design's relevant tracer and Appendix B criteria. Line references below refer to the frozen snapshot.

## Findings

### TECH-01 — Distinguish runtime generation from output-ring generation

**Classification: required before affected milestone — TR-02 native contract finalization / TR-03 shared DTO freeze.**

References: `docs/design/resolume-bridge.md`, GPU ownership and synchronization, line 86; Frame provenance and image contract, lines 91–110; `docs/design/tracer-contracts.md`, Canonical homes and adapters, line 19; `docs/design/project-model.md`, Stage 0.1, line 60.

The bridge increments an **output generation** on resize/device recreation and retains the previous ring until retirement. Its `FrameDescriptor` only has `generation`, however, and the contract map requires that field to equal the runtime/capture generation. The project model defines that generation as the renderer incarnation. The documents do not say whether ring replacement increments the runtime incarnation too, or how a receiver distinguishes old-ring and new-ring slot numbers while the process remains alive.

Impact: different implementations can reject all new frames after ring recreation, invalidate otherwise current control commands, or associate a delayed slot retirement with a reused slot in the new ring. The prose already requires rejecting stale acknowledgements, but the wire identity does not identify which generation it means.

Concrete correction: preferably add an explicit `outputGeneration` (or `ringId`) to frame descriptors, ring registration, acquire/retire acknowledgements, and native resource-cache keys. Keep `RuntimeKey.generation` for renderer replacement and document frame-ID monotonicity across ring swaps. Alternatively explicitly choose a unified generation, identify its sole allocator, and define how every runtime/control/capture consumer advances atomically. Add a protocol scenario with an old-ring read lease completing after a replacement ring reuses the same slot number. Full host resize acceptance remains 0.2; the transport identity should be settled when the initial protocol is frozen.

### TECH-02 — Specify one host-instance allocation and reconnect protocol

**Classification: required before affected milestone — TR-03 supervisor contract freeze, consumed in TR-06.**

References: `docs/design/project-model.md`, Stage 0.1, line 60; `docs/design/resolume-bridge.md`, Host controls and state, lines 128–132, and Host and service lifecycle, line 141; `docs/design/tracer-contracts.md`, Host artifact activation, line 53; `docs/design/runtime.md`, Ownership and lifetime, line 109.

The project model says core generates IDs. The bridge initializes a native instance identity and sends an `Attach` identifying the instance. The contract map then says to allocate an independent instance UUID on the plugin's `Attach`. These could describe one coordinated allocation, but no mapping says whether the native identifier is the canonical runtime ID or a distinct client key, nor whether reconnecting `Attach` allocates or resolves. The requirement not to create duplicate instances is clear; the allocation contract is not.

Impact: a native client and supervisor can implement incompatible identities, or reconnect can allocate a fresh runtime while the prior lease remains alive. That undermines generation checks, current-control replay and the intended independent host lifetime even with one plugin instance.

Concrete correction: choose one allocation authority. For example, the plugin creates a stable native-client key for its object lifetime, and the service allocates/returns the canonical runtime UUID on first attachment, storing an idempotent mapping; reconnect resolves that mapping and returns the authoritative generation. Define what a reconnect carries, what happens when a service restart has lost scratch bindings, and how stale connections are superseded. Alternatively allow the plugin to allocate the canonical UUID and explicitly exempt this from the core-only ID rule. Add a lost-`Attached`-reply/retry scenario and a reconnect scenario proving one runtime and the latest host controls. This needs contract clarification, not an installed lifecycle implementation in 0.1.

### TECH-03 — Make paused control and reset rendering behavior explicit

**Classification: optional clarification, best resolved with TR-03 clock tests.**

References: `docs/design/runtime.md`, Clock, scheduling and bounds, line 95; `docs/design/ai-authoring.md`, Tracer operation surface, lines 78–80, and Actual capture and race control.

Pause stops simulation advancement and permits reusing the completed frame. A control-barrier capture waits for a frame with the new control sequence, and reset preserves paused state while changing clock epoch. The text leaves open whether either action while paused schedules a fresh render at frozen time. Both a bounded timeout and an on-demand render can be implemented without violating the stated capture bounds, but users and tests need predictable behavior.

Suggested correction: document whether controls/reset invalidate the paused image and produce a new frame without advancing animation time. If rendering is deferred until play, return a clear status and document the capture consequence. Never relabel the old pixels with the new epoch or control values. This is not a blocker to the GPU experiment.

## Primary-source audit

Sources were inspected during this review; moving official pages/source heads are corroboration, not the dependency tuple selected for Lux. TR-01 must still pin versions and TR-02 must audit those versions.

| Boundary | Source-backed assessment |
| --- | --- |
| Electron handles and lifetime | [SharedTextureHandle](https://www.electronjs.org/docs/latest/api/structures/shared-texture-handle) confirms process-local NT handles and no keyed mutex for the proposed RGBA/BGRA formats. [OffscreenSharedTexture](https://www.electronjs.org/docs/latest/api/structures/offscreen-shared-texture) documents release responsibility, bounded retained textures and compositor metadata. The bridge correctly refuses to infer producer readiness from handle delivery. |
| Electron synchronization evidence | The linked [v44.3.0 shared-texture design](https://raw.githubusercontent.com/electron/electron/v44.3.0/shell/common/api/shared_texture/README.md) principally describes **import** and asynchronous imported-frame destruction. It is not an independent proof of external D3D producer-ready semantics for OSR export. The plan already requires the selected implementation audit and makes unknown readiness fail TR-02; no additional documentation blocker is raised. |
| Three.js backend | [WebGPURenderer documentation](https://threejs.org/docs/pages/WebGPURenderer.html) documents automatic WebGL2 fallback and explicit `forceWebGL`. The spike correctly requires evidence of the actual WebGPU backend. A class name or successful render alone will not establish it. |
| Spout transport | [SpoutGL implementation](https://raw.githubusercontent.com/leadedge/Spout2/master/SPOUTSDK/SpoutGL/SpoutGL.cpp) contains texture-access/interop locking, GL-context-dependent cleanup and CPU-sharing alternatives. The plan appropriately treats Spout as a candidate, prohibits silent CPU fallback, and requires an audit of actual receive calls. GPU capability does not imply nonblocking host callbacks. |
| Native API and host | [Microsoft AcquireSync](https://learn.microsoft.com/en-us/windows/win32/api/dxgi/nf-dxgi-idxgikeyedmutex-acquiresync) distinguishes timeout and abandoned ownership; [FFGL's plugin header](https://raw.githubusercontent.com/resolume/ffgl/master/source/lib/ffgl/FFGLPluginSDK.h) supplies GL lifecycle, processing and parameter interfaces. Neither proves actual Resolume timing, persistence or thread behavior. The native baseline and later host lifecycle gates are correctly placed. |

## Reliability assessment and unverified assumptions

The plan handles the major risks as experiments rather than hidden implementation facts:

- **Producer synchronization and ownership:** TR-02 checks producer readiness, completion before borrowed-texture release, bounded slots, consumer retirement, forced delays and producer death. The two-engineering-day checkpoint has a stop/next-experiment decision instead of a promise of success. A correct-looking image cannot pass synchronization.
- **Compositor provenance:** the bridge recognizes that paint timestamps/counts are not runtime frame identity. It proposes serial presentation plus markers, explicitly tests repeats/drops/switches, and blocks acceptance if correlation cannot be proved. Whether this association can meet 99% fresh delivery remains unknown.
- **Process lifetime and recovery:** independent service leases, separate profiles/process groups, execution-loop heartbeats, confirmed termination, restart limits and current host snapshot replay are specified. Actual Windows launch/job behavior, sandbox configuration and two-second termination remain TR-03/06 evidence. GPU/driver faults are correctly excluded from a promise of complete process isolation.
- **Capture and clocks:** immutable frame leases, revision/generation race outcomes, control sequence barriers, bounded readback and PNG image content are specified. Native QPC versus worker clocks, calibration error, GPU-duration measurement and source-consumption endpoints are separated. Clock offsets, marker accuracy and instrumentation overhead remain to be measured; unavailable timing cannot pass.
- **Scope:** composition persistence/two-instance lifecycle (0.2), trigger/simulation behavior (0.3), full docking/inputs (4), and installed offline playback/soak (5) remain staged. Their absence today is not a tracer-start blocker. GPU preview attachment across windows is also unproved and has a real-surface tracer smoke test plus later full-shell gates.

No package, native compiler, Electron app or Resolume plugin was installed or run for this review. No benchmark or hardware success is inferred. After TECH-01/02 are reconciled at their named contract boundaries, the remaining uncertainty is appropriately assigned to bounded implementation experiments and explicit acceptance gates.
