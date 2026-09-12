# Tracer cross-subsystem contract map

This document reconciles names and ownership across the subsystem designs. It does not duplicate their full schemas. Implement these exports in TR-03 before delegating core/UI work; changes require coordinator review of every consumer.

## Canonical homes and adapters

| Contract | Authority / proposed export | Consumers |
| --- | --- | --- |
| IDs, hash, OutputSettings, RuntimeKey | `packages/runtime-contracts/src/index.ts`; brands/shapes in [project model](project-model.md) and runtime | Core, supervisor, runtime, native adapter |
| VisualDefinition / VisualInstance / RuntimeSession | [Runtime](runtime.md); SDK and runtime packages | Compiler, generated visual, render host |
| Submit / ParameterWrite / Playback / CaptureRequest / Job / Fault / CaptureMetadata | [AI authoring](ai-authoring.md); `packages/core/src/contracts.ts` | UI and MCP adapter |
| Native FrameDescriptor and host wire messages | [Bridge](resolume-bridge.md); `packages/runtime-contracts/src/bridge.ts` and matching C++ header | Render-host native addon, supervisor, FFGL control worker |
| UI selection/layout/input state | [Studio](studio.md) | Studio; not part of the executable graph/runtime DTO |

Native code lives in `native/texture-bridge/` and `native/ffgl-source/`; `frame-bridge` is not a second package. The full build runner commands are owned by TR-01 and implemented with their task. Shared value sequences use nonnegative safe integers in the public TypeScript API; the native decimal uint64 adapter rejects values above `Number.MAX_SAFE_INTEGER`. Reaching the limit requires a new runtime generation and a reset sequence, never lossy conversion. Frame IDs remain decimal strings end to end.

| Native frame field | Runtime/capture field | Rule |
| --- | --- | --- |
| `instanceId`, `generation`, `revisionId`, `frameId` | Same fields | Exact match, never current mutable UI selection |
| `animationTimeSeconds` | `actualTimeSeconds` | Actual producing animation time |
| `appliedControlSequence` (decimal string) | `controlSequence` (safe integer) | Checked conversion; must represent controls actually used |
| `producerCompleteTicks` + `clockDomain` | native measurement data; `completedAtMonotonicMs` only after calibration | Never subtract timestamps from uncalibrated process clocks |
| `bundleHash` | artifact identity; `sourceHash` comes from immutable revision manifest | Source hash is not interchangeable with compiled bundle hash |
| format/color/alpha/origin | declared transport boundary; PNG uses sRGB straight alpha | Explicit conversion, checked with known patterns |

Every completed runtime frame also includes `clockEpoch`, effective control values, seed, render settings, runtime build hash and input snapshot ID (`none` for 0.1 no-input fixture). A native descriptor must carry clock epoch or resolve it through an immutable generation/frame manifest; do not read reset epoch from current runtime state after capture. The implementation should carry it directly to reduce ambiguity.

`generation` is allocated by the supervisor for a renderer incarnation. `outputGeneration` is a separate counter allocated by the native producer for a ring replacement within that incarnation; it increments on resize/ring recreation without invalidating control commands. Ring registration, descriptors, acquire/retire acknowledgements and resource caches use `(instanceId, generation, outputGeneration, slot)`. Frame IDs remain monotonic across ring swaps within one runtime generation. An old-ring read lease may finish after a new ring reuses its slot number; its retirement cannot free the new slot. A renderer restart changes runtime generation and starts a new output generation namespace. Clock reset changes `clockEpoch`, neither generation counter.

Entity IDs (Scene, Revision, Candidate, Job and canonical Runtime Instance) are UUIDs allocated by the application service, including its supervisor. Declared control IDs are stable schema keys such as `intensity`, validated against `^[a-z][a-z0-9_]{0,63}$`; they are not entity UUIDs. The plugin allocates only a `pluginClientId` UUID for each native object lifetime. This is an attachment identity, not the canonical runtime-instance ID.

## Minimal SDK and runtime completion rules

The SDK example is executable code returned by discovery, not a hidden fixed-scene registry. Runtime imports are limited to the pinned visual SDK and allowed Three.js subset. `create` receives controlled renderer/resource access, immutable asset bytes and deterministic random generator. `update` receives runtime time and effective controls. `render` targets an explicitly sized runtime-owned output; it cannot own pane geometry or FFGL state. Define the concrete allowed TypeScript surface with the SDK in TR-03 and expose that same generated declaration text through `lux.discover`.

`ValidatedBundle` includes candidate/scene/revision identities, source/bundle/runtime hashes, entry/module payload, control schema and fixed output settings. `ReadyFrame` is a completed frame lease with matching identity; a submitted command buffer is not readiness. `RuntimeStatus` reports generation, clock epoch, playback state, applied control sequence, revision, last completed frame and fault. `StillCaptureRequest` is the internal form of `CaptureRequest`; its result includes PNG bytes and the exact metadata from the pinned frame. `OutputTarget` and GPU handles remain runtime-internal.

`RuntimeSession.load` prepares the candidate runtime, but core owns acceptance/head commit. `setControls` admits the versioned snapshot; completed frames prove application. `transport` is generation-checked by its service adapter, with reset incrementing clock epoch and preserving play/pause state. `capture` holds a bounded immutable frame lease through readback. `dispose` drains/invalidates owned resources without disposing other instances. Supervisor restart replaces the render generation and preserves current owner controls.

## Host artifact activation

Tracer has one fixed FFGL schema per exported visual: `intensity`, float, native index 0, range/default 0–1 / 0.5. Discovery examples and generated tracer scenes must retain it. Creative code may use it in any visible way but cannot silently change its schema. General control publishing is later; named per-release wrappers and installed persistence are required now by [DEC-13](../implementation/tracer-export-scope.md).

The following pre-DEC-13 developer-activation DTOs may remain diagnostic helpers, not the required user workflow or a complete installed-release API. Before TR-06 implementation, extend shared contracts with durable release identity and export/install results; do not reuse one global binding across sources. Generated code cannot invoke export/install or choose package paths.

```ts
type ActivateTracerHost = {
  requestId: string; sceneId: SceneId; revisionId: RevisionId;
  expectedHostBindingVersion: number | null; // null only on first activation
};
type TracerHostBinding = {
  bindingVersion: number; sceneId: SceneId; revisionId: RevisionId;
  bundleHash: Hash; controlSchemaHash: Hash;
};
```

Export resolves an accepted retained revision, validates the fixed schema and full code/asset/runtime closure, and creates an immutable installed release with stable host identity. Each source attachment identifies that release and allocates its own runtime under the idempotent contract below. Studio head and authoring state are unaffected. Source installation is durable across service/host shutdown; cold reopen must not require developer reactivation. A new release coexists with the old one; existing compositions never silently retarget. Failed export/install preserves previous releases.

Any retained diagnostic activation helper must compare binding versions and report conflicts. The actual user path is Export for Resolume plus install, returning the installed release identity. Captures, host status and acceptance evidence must identify both the immutable release/revision and the live instance.

An installed release pins its complete immutable closure even with no plugin attached. Live instances separately pin restart and frame resources. Scratch collection and service shutdown cannot delete installed release bytes; old versions remain usable by saved compositions. Test: export/install A, accept B then C, collect scratch data, close all Lux processes, make the source project unavailable, and reopen Resolume to render A with its saved values.

### Attachment and reconnect identity

```ts
type HostAttach = {
  pluginClientId: string; connectionEpoch: number;
  releaseId: string; // validated installed immutable release identity, not a live runtime ID
  knownServiceEpoch?: string; knownInstanceId?: RuntimeInstanceId;
  bindingVersion: number; controls: ControlSnapshot;
};
type HostAttached = {
  serviceEpoch: string; pluginClientId: string; connectionEpoch: number;
  releaseId: string;
  instanceId: RuntimeInstanceId; generation: number; bindingVersion: number;
};
```

The service creates a fresh `serviceEpoch` UUID at startup and owns a mapping from `pluginClientId` to one canonical runtime UUID and immutable release while that object's lease is live. Only first attachment allocates the runtime; retry after a lost reply resolves the same mapping. Reconnect increments `connectionEpoch`, supplies the latest full host snapshot and returns the authoritative generation. Newer connection epochs supersede old pipes; old messages cannot renew leases or change controls. Retries are idempotent by request ID/payload. A second object has a distinct pluginClientId and independent runtime, even for the same release. Tracer must support the two-source/copy acceptance fixture; larger unsupported capacity fails explicitly, never aliases state.

If clean detach or expiry destroyed an instance, reconnect allocates a new instance and reports the reset. A mismatched known instance under a live mapping fails `INSTANCE_CONFLICT`. On changed service epoch, resolve the installed release anew, allocate a fresh runtime and apply the host snapshot before the first accepted frame. Missing/incompatible releases return an actionable unavailable result; service restart alone cannot require Studio or developer reactivation. Test duplicate Attach, lost reply, renderer/service restart, cold composition reopen, two independent objects and delayed old-connection writes. Each live client mapping owns at most one runtime.

## Unified limits and scope

API limits belong to AI authoring: 30-second compile, five-second smoke/activation and capture deadlines, one active plus one queued scene change, one active plus one queued capture per instance, at most four queued captures service-wide, 1 MiB/32 source files, 1920×1080 capture ceiling and 8 MiB encoded PNG ceiling. The 8 MiB limit is encoded PNG bytes before base64, not raw RGBA storage. Pixel buffers have their own bounded allocation implied by dimensions.

Capture timeout starts on admission (including queue wait); scene compile/smoke budgets begin when their phase starts, with job status exposing queue time. Jobs do not supersede an admitted candidate silently; full queue rejects `QUEUE_FULL`. Metrics and job-result retention follow their respective designs.

0.1 offers automatic successful activation, summaries and access to previous-working source through read/discovery for explicit restoration. Full durable Undo/redo is milestone 1; the UI must not show a nonfunctional Undo button in the tracer. Host instances never follow authoring activation automatically.
