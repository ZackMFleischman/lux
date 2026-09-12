# Resolume source bridge and GPU transport

Status: proposed design with a mandatory hardware feasibility gate. No GPU path, FFGL behavior or timing target has been demonstrated in this documentation task. Covers T04–T09 and B01/B02/B04; prepares T10/T11 and R01–R03. The exact acceptance procedures remain [original plan §4 and Appendix B](../../plans/ai-visual-workshop-design.md).

## Selected direction and limits of the evidence

Build a small native FFGL **source** that receives completed GPU images from a separately supervised runtime. The plugin exposes host controls and draws a texture; it never executes generated JavaScript or compiles scene code. Resolume owns mixing, mapping, output routing, audio modulation and MIDI assignment. Incoming-image effects are outside this scope.

First candidate: Three.js WebGPU → output canvas → Electron offscreen shared texture → native D3D adapter → owned shared texture slots → FFGL OpenGL output. Spout is a candidate native transport layer, not a browser texture-export API. GPU copies and color-conversion passes are allowed and measured; normal per-frame CPU pixel copies are not.

Verified source facts, not verified integration:

| Source fact | Design consequence |
| --- | --- |
| Electron offscreen `useSharedTexture` provides GPU output; its default bitmap path copies pixels to CPU [S1]. | Enable the shared-texture option and positively assert that it is active. A PNG/NativeImage loop cannot pass. |
| `OffscreenSharedTexture` has format, size, color space and release lifecycle; only a limited number may be retained [S2]. | Copy into a bounded owned ring, and release each borrowed texture after native GPU use completes. |
| Windows `ntHandle` is local to its process; RGBA/BGRA/RGBAF16 handles do **not** have a keyed mutex [S3]. | Open locally or duplicate into the receiving process. Do not call `AcquireSync` on an assumed Electron keyed mutex. |
| Electron's shared-texture design discusses asynchronous GPU lifetime and sync-token handling [S4]. | Handle delivery alone is insufficient justification for arbitrary release timing. Audit the pinned implementation and prove producer-ready semantics. |
| Spout supports native DirectX and OpenGL textures [S5]. | Native interop is plausible; it does not establish the preceding WebGPU/compositor boundary or a wait-free receive callback. |
| Resolume's FFGL SDK exposes plugin lifecycle and parameter methods [S6]. | Pin an SDK commit and test actual host source discovery, schema and state behavior. |

The browser WebGPU interface provides no standard native texture export, as documented in [runtime](runtime.md). Do not reach into private Three.js internals and call that a supported bridge.

## Proposed implementation targets

| Path | Role |
| --- | --- |
| `native/texture-bridge/include/lux_texture_bridge.h` | Versioned native frame/slot API and error/status types. |
| `native/texture-bridge/src/electron_texture.cc` | Native addon receives borrowed Electron handle, opens texture and validates metadata. |
| `native/texture-bridge/src/d3d_ring.cc` | Owned three-slot ring, GPU copies, completion/release and resize generations. |
| `native/texture-bridge/src/spout_transport.cc` | Candidate Spout adapter; exact SDK sync behavior audited here. |
| `native/ffgl-source/src/LuxSource.cpp` | Fixed tracer source metadata, one named float control, lifecycle and draw callback. |
| `native/ffgl-source/src/ControlClient.cpp` | Asynchronous local IPC, snapshots, reconnect and service startup. |
| `native/ffgl-source/src/FrameReceiver.cpp` | Nonblocking completed-slot selection, GL resource cache and last frame. |
| `packages/runtime-contracts/src/bridge.ts` | Matching versioned control/frame descriptors; no binary handles in public AI operations. |
| `tools/gpu-spike/` | Bounded test harness, patterns and result collector, before broad SDK work. |
| `tests/native/` | Slot protocol, stale generations, failed acquire, resize and GL state tests. |
| `tests/e2e/tracer/bridge.spec.ts` | Host-level scripted/manual evidence workflow; actual host runs remain necessary. |

## Feasibility experiment: stop before broad implementation

The coordinator records exact inventory and selected versions in [environment](../implementation/environment.md). Known inventory is Windows 11 Pro, an RTX 2070 plus Intel UHD Graphics, and Resolume Avenue 7.27.1; these facts establish availability only. Use the NVIDIA adapter for the reference run and verify selection at every native boundary. Do not infer GPU capacity from WMI's memory field.

Timebox the initial experiment to two engineering days after working compiler/host access is established. This is a decision checkpoint, not a promised completion time. Check in harness/source and evidence; if any critical gate remains unknown, stop expanding the SDK and record the failing boundary plus the next bounded experiment.

1. **Reproduce native baseline.** Build a source with one float named `Intensity`, a moving image and alpha pattern using pinned FFGL SDK. Confirm host loads it, parameter changes arrive, and GL output respects the host FBO/viewport/state. A direct native pattern proves only the host end.
2. **Prove browser output.** Render the same time-driven pattern using Three.js WebGPU in the intended sandboxed worker/canvas topology. Obtain shared textures in a dedicated render-host main process. Assert WebGPU rather than silent software/WebGL fallback; record backend, adapter identity and flags.
3. **Open and copy.** In that main process's native addon, open the shared NT handle through the supported D3D interface [S7], inspect texture description/adapter, establish producer-ready semantics from pinned Electron code, and copy on GPU to an owned texture. Release the Electron texture only after copy completion. If readiness cannot be established, this step fails even if the image looks correct.
4. **Cross-process and API transfer.** Export owned native slots using the selected Spout/DX interop protocol; import into FFGL's GL context. Prove no normal pixel readback, no concurrent overwrite and no render-callback wait. Audit SDK locks before using convenience receive functions. A source-side wait moved into the host callback is a failure.
5. **Match provenance.** Encode distinct frame/revision/control markers into the pattern. Correlate runtime frame completion, compositor output and consumed host image; force repeats, dropped compositor output, pause and revision switch. Do not label a paint event with the latest submitted frame without evidence.
6. **Run the real workload.** At 1080p/60 Hz, collect 30-second warmup plus five-minute feasibility measurements, control markers, starvation and producer-stop evidence. TR-02 must establish color/alpha, completed-frame ownership, absence of CPU streaming and nonblocking callback behavior. Full supervisor recovery, AI and UI-close gates depend on TR-03–06 and are signed off in TR-07 against the table below. Record early performance failures now; do not claim complete tracer acceptance from this spike.

Deliver the [acceptance evidence layout](../implementation/tracer-acceptance.md): `evidence/tracer-0.1/<run-id>/manifest.json`, `gpu-feasibility.md`, timing/event samples, screenshots/host recording, reference source and trace files or stable trace links. Manifest includes OS build, GPU/driver, each adapter LUID, display refresh, host build/bitness, runtime/Chromium/Three.js versions, FFGL/Spout commit, native compiler, render settings, source/bundle hashes, warmup/duration and diagnostic flags.

## GPU ownership and synchronization

```mermaid
sequenceDiagram
  participant W as Visual worker
  participant E as Electron compositor/main
  participant N as Native ring producer
  participant P as FFGL consumer
  W->>E: Present output canvas
  E->>N: Borrowed texture + metadata
  N->>N: Validate readiness; enqueue GPU copy to free slot
  N->>N: Observe copy completion outside host callback
  N->>E: Release borrowed texture
  N->>P: Publish completed slot descriptor
  P->>P: Try newest ready slot; otherwise reuse last image
  P->>P: Copy/draw with host GL context
  P->>N: Retire slot only after GPU read completes
```

The native producer's D3D device belongs to the render-host process; native receiver GL resources belong to the host/plugin and are used only on an appropriate current GL context. Chromium owns its own GPU device/process. They are not one device merely because all choose the RTX adapter. Match adapter LUID and supported shared resource formats; a hybrid-adapter mismatch is an explicit connection error, never a silent CPU fallback.

The original Electron handle remains borrowed. Native code closes only handles it created/duplicated and releases its own COM references. Sending the numeric value over IPC does not transfer an NT handle: duplicate into the specific destination process when necessary [S3/S4]. Validate PID/session identity before duplication; close duplicates on detach/failure. Never expose handles to generated code.

Proposed ring state is `Free → Writing → Ready → Reading → Free`, with three slots and at most two producer submissions in flight. Each slot includes a generation and monotonically increasing frame ID. Publish `Ready` only after the producer GPU copy has completed, with CPU descriptor publication ordered after that completion. Release borrowed compositor resources even when dropping an unwanted frame.

The receiver selects the newest compatible ready slot. It uses only a nonblocking acquire/test; busy means repeat last frame. An atomic descriptor is not a GPU fence. If the chosen native transport uses a keyed mutex on **owned** resources, use its exact key protocol and zero timeout and treat timeout/abandonment as separate failures [S8]. If it uses interop locks/fences, verify their actual blocking behavior before adoption. Do not pretend the borrowed Electron texture supplies those primitives.

Producer may replace unacquired `Ready` frames only through an atomic claim that excludes a concurrent reader. It never overwrites `Reading` slots. Host copies a received frame to its own last-frame texture or retains a read lease; either way, release the source slot only after the host GPU read finishes. A submitted GL copy is not a completed copy. Poll GL completion on later callbacks without blocking; if all slots remain busy, drop new output and expose counters.

Allocation/import/handle opening belongs outside the steady-state callback where possible. GL allocations requiring the host context occur during supported lifecycle or a bounded setup phase; measure them separately from steady state. Preserve host GL bindings, viewport, blend and framebuffer state. The plugin must not assume it owns the GL context or call host rendering from its IPC thread.

On resize/device recreation, increment output generation and prepare a new ring before switching. Keep the old last-frame texture until the new generation produces a valid frame; retire the old ring after completion or process/device teardown. Ignore stale descriptors and acknowledgements. Neither resize nor sender death permits freeing a texture still referenced by a live consumer.

## Frame provenance and image contract

```ts
// Proposed metadata, separate from platform-native handle transfer.
interface FrameDescriptor {
  protocolVersion: number;
  instanceId: string;
  generation: number;
  clockEpoch: number;        // logical reset epoch, not a measurement clock
  frameId: string;            // decimal uint64, not lossy JS number
  revisionId: string;
  bundleHash: string;
  animationTimeSeconds: number;
  appliedControlSequence: string;
  width: number;
  height: number;
  format: "bgra8" | "rgba8" | "rgba16f";
  colorSpace: string;
  alphaMode: "premultiplied" | "straight" | "opaque";
  origin: "top-left" | "bottom-left";
  slot: number;
  clockDomain: string;
  producerCompleteTicks: string;
}
```

Native texture format, dimensions and adapter must agree with the descriptor. Metadata is immutable for a frame and published alongside slot state. Sequence and generation counters must not wrap silently. A frame ID represents one actual visual result, not every host request or every compositor callback. Application adapter maps `appliedControlSequence` to canonical `controlSequence` and `animationTimeSeconds` to capture `actualTimeSeconds`; preserve the runtime reset `clockEpoch` separately from the native measurement clock domain.

Canvas presentation and OSR paint are asynchronous. Proposed initial association uses at most one outstanding canvas presentation and acknowledges it after obtaining the corresponding paint. The spike must validate this association against the encoded marker, including repeated/stale paint events. If this serial association misses delivery budgets or cannot exclude stale output, add a proven compositor/frame token mechanism or instrument marker extraction during the experiment; do not invent exact control latency from unrelated timestamps. Small diagnostic marker readbacks are labeled instrumentation, excluded from the normal transport design, and measured for overhead.

Runtime composition uses linear-light premultiplied images. The transport boundary names the actual conversion to the chosen host format; begin with BGRA8 or RGBA8 only after probing support, with HDR deferred. Respect Electron's reported color space instead of assuming bytes are linear. Configure the output page transparent and verify the compositor did not flatten alpha. Perform gamma conversion exactly once and premultiply/unpremultiply in the documented domain.

Known patterns: labeled asymmetric corners and top/bottom bars; channel-isolated red/green/blue patches; linear ramps and reference sRGB values; 0/25/50/100% alpha over colored host backgrounds; a bright edge over transparency; changing binary frame/control marker. Compare captured expected values with host output using recorded tolerances (proposed ≤2/255 channel error for 8-bit flat patches away from filtered edges). Alpha or color failure blocks the path; screenshots alone do not prove synchronization.

## Host controls and state

For 0.1 choose a fixed tracer source plugin with a compile-time schema and one continuous float `Intensity`, stable control ID `intensity`, native index 0, normalized 0–1. Explicit developer activation pins the selected validated bundle into a separate host-owned runtime instance. The authoring instance keeps its own controls and state; subsequent studio edits do not alter host playback. The host schema cannot silently change when the AI revises code; revisions must preserve this control contract or fail the tracer compatibility check.

For 0.2/5 recommend thin generated per-release source wrappers sharing one maintained bridge library. Each wrapper freezes release identity and published schema into its binary/manifest; distinct releases get distinct plugin identities. This avoids promising dynamic arbitrary-schema discovery in a generic plugin. Validate host plugin-ID length/registration constraints and composition persistence before adopting this packaging decision. No registry/editor implementation is needed in 0.1.

Each native plugin object has a new runtime-instance UUID, independent values and output resources. A wrapper identifies immutable scene/release/schema hashes; saved host control indices are append-only within a compatible schema, never reassigned. Changed meaning/type/range or removed required controls requires a new incompatible release identity. A reconnect instance UUID is not the same thing as durable release identity. The studio authoring instance is separate even in 0.1; the two-host-instance test remains 0.2.

`SetFloatParameter` (SDK naming to confirm at the pinned commit) validates finite input and updates an atomic current-value snapshot plus sequence. A non-render control worker sends `Hello`, `Attach`, `ControlSnapshot`, `Heartbeat`, `Detach`; runtime replies with `Attached`, `Status`, `FrameReady` metadata and `Error`. Use bounded length-prefixed messages over a per-user Windows named pipe with local user ACLs and protocol handshake; never block the GL callback on I/O, service launch or parsing.

`Hello` negotiates protocol/runtime/schema versions and process identity. `Attach` identifies instance, release or explicitly pinned tracer bundle, output size and full host snapshot. Host values are authoritative for published performance controls. Continuous pending updates coalesce; after reconnect send the latest full snapshot, including changes made during downtime, before accepting the first restored frame. No studio or stale renderer snapshot may overwrite it.

0.3 adds a separate `TriggerBatch` carrying ordered event IDs, arrival timestamps and connection epoch. Proposed limit is 256 pending events; overflow reports failure rather than silently coalescing. Discard disconnected-epoch events on recovery. Verify 20 events/s for 10 seconds and the selected host's repeated-note behavior. Native host modulation is the initial audio/MIDI path; neither raw audio buffers nor raw MIDI events are assumed to come through FFGL.

## Host and service lifecycle

| Event | Required behavior |
| --- | --- |
| Plugin discovery | Metadata/schema available without starting a visual during directory scan. |
| Instance initialization | Allocate native instance identity; asynchronously attach/start service; clear transparent black until first completed frame. |
| Process callback | Read atomic status and newest ready frame; reuse last completed image when late. No intentional renderer wait. |
| Studio closes | Host lease keeps service and render-host alive; control updates and image delivery continue. |
| Renderer crashes/hangs | Keep last host-owned frame; control worker reports failure and sends latest values on recovery; host stays responsive. |
| Renderer restarts | New generation; reset simulation; reject obsolete events/frames; first restored frame uses current host snapshot. |
| Host viewport resize | Request explicit new output dimensions; retain prior frame during ring recreation; never use pane size as scene resolution. |
| Deactivation/removal | Map actual host callbacks to lease policy; stop unneeded work and release GL/native resources on appropriate context/thread. |
| Host process exits | Lost pipe/lease expiry reclaims renderer; bounded shutdown with no orphan service growth. |
| Device loss | Mark transport unavailable; rebuild owned devices/rings through supervisor; never reuse dead-device handles. |

See [runtime lifetime/watchdog](runtime.md) for lease periods, generation invalidation and restart policy. 0.2 must exercise two copies, composition save/reopen, deactivate/reactivate and resize. Verify the exact host persistence mechanism rather than assuming plugin-private arbitrary state is serialized. Wrapper identity plus host-native parameter persistence is the preferred minimal model.

## Measurements and pass/fail

Use one monotonic native clock domain (Windows performance counter) for plugin receipt, native completion and host consumption. Calibrate worker timestamps through ping-pong samples and record offset/error, or keep worker timings in their own domain. Do not subtract unrelated clocks. The endpoint is host source consumption, not monitor/projector presentation. Measure host reference budgets with the authoring preview inactive/closed, then measure the separate concurrent studio/UI workload and declare both configurations in the manifest.

| Gate from Appendix B | Evidence |
| --- | --- |
| 1920×1080, 60 Hz; 30 s warmup + 5 min | Immutable source/settings/seed and environment manifest; no adaptive quality changes. |
| ≥99% fresh host opportunities; no unexplained gap >100 ms | Host opportunity count, actual visual frame IDs, repeat/drop/skip counters and gap histogram. Paused and injected failure intervals are separate fault runs. |
| Added connection delay p95 ≤2 host periods | Producer completed frame to host consumption, with compositor/native intervals reported separately where measurable. Report timing attribution gaps explicitly. |
| Control response p95 ≤50 ms, p99 ≤100 ms | Plugin-receipt sequence to first consumed matching visual marker, smoothing off, automated sample stream; device-to-visible latency separately if measured. |
| Plugin callback p95 ≤1 ms | Native callback elapsed CPU time; audit absence of intentional waits; GPU transfer measured separately. |
| CPU update/submission p95 ≤4 ms; GPU frame work p95 ≤12 ms | Runtime instrumentation plus native GPU trace for compositor/transfer; unknown GPU timing is not passing. |
| UI p95 ≤50 ms, p99 ≤100 ms | Responsive UI interaction test while reference visual and host run, separately recorded from visual frame cadence. |
| Infinite JavaScript loop stopped ≤2 s | Independent supervisor timestamps fault injection and process stop, with host still responsive. |
| Explicit restart restores frame and current values ≤5 s | Change host value while renderer is down, restart, check restored marker/value and fresh generation. |
| Routine instrumentation <2% median cost | Paired baseline/metrics runs; captures and heavy diagnostic traces separately labeled. |

A profiler/source audit must positively identify the normal image path: no `ReadPixels`, `mapAsync` pixel buffer, staging readback, `NativeImage` encoding or CPU pixel upload loop. Inspection captures remain separate and allowed. GPU-only transport can still have extra copies and synchronization costs; report them.

Milestone 0.3 repeats with seeded bounded-count fixed-step particles and ordered trigger evidence; Milestone 5 adds full 60-minute resource/queue soak and the broader workload suite. Failed gates require a bottleneck report and explicit design/budget decision before completion. Passing on one adapter does not establish cross-adapter or unrestricted multi-instance capacity.

## Fallback decision tree

1. If Electron output succeeds but Spout convenience calls block, retain Electron and implement the owned D3D/GL ring behind `TextureTransport`; use proven native interop with explicit readiness/retirement. This requires a new bounded native synchronization experiment.
2. If WebGPU canvas export fails but Electron exports WebGL output, test an explicit shared Three.js WebGL runtime mode for both studio and background playback. Three.js documents a WebGL option [S9], but compute/features may differ. Revalidate the tracer SDK and later simulation plan; do not silently select this backend.
3. If compositor export, alpha, synchronization or budgets cannot be made reliable, evaluate a shared native renderer service used by both studio and FFGL. That changes the SDK/backend and requires a revised plan before broad authoring work. A native renderer is an architectural alternative, not a proven drop-in Three.js host.

Every fallback preserves live dynamic same-runtime playback, host controls, offline operation and UI-independent lifetime. Recorded video, browser screenshot streaming and separate hand-reimplemented FFGL visuals do not meet the requirement. No fallback is marked accepted until its equivalent hardware gates pass.

## Sources checked 2026-09-12 UTC

- [S1 Electron offscreen rendering](https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering).
- [S2 Electron OffscreenSharedTexture](https://www.electronjs.org/docs/latest/api/structures/offscreen-shared-texture).
- [S3 Electron SharedTextureHandle](https://www.electronjs.org/docs/latest/api/structures/shared-texture-handle).
- [S4 Electron shared-texture design at the documentation-linked tag](https://github.com/electron/electron/blob/v44.3.0/shell/common/api/shared_texture/README.md). This is source evidence, not the selected Lux version; recheck the selected build.
- [S5 Spout maintained SDK](https://github.com/leadedge/Spout2) and [DirectX documentation](https://spoutdx-site.netlify.app/).
- [S6 Resolume FFGL SDK](https://github.com/resolume/ffgl) and [plugin interface header](https://raw.githubusercontent.com/resolume/ffgl/master/source/lib/ffgl/FFGLPluginSDK.h).
- [S7 Microsoft OpenSharedResource1](https://learn.microsoft.com/en-us/windows/win32/api/d3d11_1/nf-d3d11_1-id3d11device1-opensharedresource1).
- [S8 Microsoft AcquireSync](https://learn.microsoft.com/en-us/windows/win32/api/dxgi/nf-dxgi-idxgikeyedmutex-acquiresync).
- [S9 Three.js WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html).
