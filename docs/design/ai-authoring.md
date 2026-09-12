# AI authoring and application operations

Status: implementation design, 11 September 2026. Contracts are proposed, not implemented or tested. Requirements come from [the baseline](../requirements.md); IDs and persistence rules come from [project model](project-model.md). UI, external AI, and later embedded chat call one application service (B02, S01).

## Discovery and connection

Use a small local `lux-mcp` stdio adapter that connects to the independently supervised application service over an authenticated per-user local pipe. The adapter owns no visual lifetime. Closing an AI client or Studio cannot stop a host-owned renderer (T05). Ship explicit executable/argument configuration and report `SERVICE_UNAVAILABLE` with a startup diagnostic when attachment fails; never spawn competing services for the same session.

Use the common supported MCP profile proven with the selected external client in tracer Task 1. The latest official reference checked on 11 September 2026 is **2026-07-28**; it changes the protocol core, so do not combine its messages with legacy initialization. Choose 2026-07-28 when the selected client and SDK support it; otherwise select an explicit 2025-11-25 adapter. Pin the resulting SDK version/profile in the implementation lockfile and evidence. No SDK compatibility is claimed by this design. [Official release announcement, 28 July 2026](https://blog.modelcontextprotocol.io/posts/2026-07-28/).

The stdio subprocess reads/writes JSON-RPC on standard streams; keep logs on stderr. The 2026 profile requires per-request protocol metadata. Do not advertise unsupported versions. [Official stdio specification, version 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio). For the legacy profile, complete `initialize` and `notifications/initialized` and use its agreed version; this is a separate transport adapter over identical application operations. [Official lifecycle specification, version 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle).

Expose a stable `tools/list` with descriptions and input/output schemas. `tools/call` results use `resultType: "complete"` only for the 2026-07-28 profile; the legacy adapter omits that field. Actual captures include base64 PNG ImageContent plus metadata, not only paths. Application failures set `isError: true`; protocol errors remain distinct. [Official tools specification, version 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools).

Bounded profile test: with the actual selected client, allow 10 seconds for connection/version agreement, 10 seconds for listing/discovery, and 10 seconds to retrieve a small known PNG through a stub tool. Record raw version/capability messages, SDK/client versions, schema validation and actual model visibility. Reject unsupported profiles cleanly; test reconnect and a legacy profile only when that adapter is selected. The fixture tests protocol delivery, not T01/T02, which additionally require submitted executable code and rendered feedback. No optional MCP task extension is required; Lux job IDs are ordinary application results.

`lux.discover` returns application API version, scratch/durable capabilities, SDK source contract and minimal working example, allowed imports, size/time limits, available scenes/instances, authority, and tool feature flags. `lux.scene.read` returns source plus accepted revision, declared controls, settings, and diagnostics; milestone 2 adds graph/definitions. An AI must read current source before replacement. Discovery does not require the model to browse local files. Never send secrets in examples or diagnostics.

## Tracer operation surface

All IDs below are branded strings from `packages/runtime-contracts/src/index.ts`, imported/reexported by `packages/core/src/contracts.ts`. Core alone owns Scene snapshots/head transactions. `Mutation` means `{requestId: string; sceneId: SceneId; baseRevisionId: RevisionId | null}`. A unique request ID deduplicates retries by payload hash; reusing it with different input is an error. Stage 0.1 supports one scratch Scene; general saved-project selection begins at milestone 1.

| Tool | Input → result | Behavior |
| --- | --- | --- |
| `lux.discover` | `{}` → capabilities, limits, SDK/example, IDs | Bounded read; no renderer execution. |
| `lux.scene.read` | `{sceneId, revisionId?}` → snapshot | Defaults to accepted head, never an in-progress candidate. |
| `lux.scene.submit` | `Submit` → `{jobId, candidateId}` | Default `autoApply:true`; one submit/validate/activate pipeline. |
| `lux.scene.validate` | `{candidateId, requestId}` → `{jobId}` | Build/smoke-check a staged candidate without head change. |
| `lux.scene.activate` | `Mutation & {candidateId}` → `{jobId}` | For explicitly staged candidates; no default Keep/Discard ceremony. |
| `lux.capture` | `CaptureRequest` → `{jobId}` | Snapshot target and requested revision; asynchronous bounded still capture. |
| `lux.parameters.set` | `ParameterWrite` → acknowledgement | Studio-owned runtime controls; milestone 1 may persist a grouped edit. |
| `lux.playback` | `Playback` → `{jobId}` | Play, pause or reset a named studio instance. |
| `lux.runtime.restart` | `{requestId, instanceId, expectedGeneration}` → `{jobId}` | Supervised replacement, retaining logical identity. |
| `lux.status` | `{sceneId?, instanceId?}` → status | Accepted/active revisions, jobs, faults and distinct UI/runtime measurements. |
| `lux.jobs.get` | `{jobId, includeResult?}` → job/result | Capture results include actual ImageContent when requested. |
| `lux.jobs.cancel` | `{jobId}` → terminal or cancellation pending | Cancellation is best effort until commit; never silently undoes committed work. |

```ts
type Submit = {
  requestId: string; sceneId: SceneId; baseRevisionId: RevisionId | null;
  source: SourceBundle; summary: string; autoApply?: boolean; // default true
  settings?: OutputSettings;
  editScope: { kind: "scene" } | { kind: "nodes"; nodeIds: string[] }; // nodes: M2
};
type ParameterWrite = {
  requestId: string; instanceId: RuntimeInstanceId;
  expectedRevisionId: RevisionId; expectedGeneration: number;
  values: Record<ControlId, Value>;
  mode: "live" | "saved"; // tracer accepts live only
  baseRevisionId?: RevisionId; gestureId?: string; // required for saved mode
};
type Playback = {
  requestId: string; instanceId: RuntimeInstanceId;
  expectedGeneration: number; action: "play" | "pause" | "reset";
};
type CaptureRequest = {
  requestId: string; instanceId: RuntimeInstanceId;
  expectedRevisionId: RevisionId; expectedGeneration: number;
  afterControlSequence?: number;
  target: "final"; mode: "live"; // tracer only
  maxWidth?: number; maxHeight?: number; // preserve aspect; no render override
};
type JobState = "queued" | "running" | "succeeded" | "failed" | "cancelled";
type Fault = {
  code: string; message: string; retryable: boolean;
  phase?: "validate" | "compile" | "smoke" | "activate" | "capture" | "persist";
  file?: string; line?: number; column?: number;
  currentRevisionId?: RevisionId; details?: Record<string, unknown>;
};
type Job = {
  jobId: JobId; requestId: string; state: JobState;
  phase: string; progress?: number; createdAt: string; updatedAt: string;
  candidateId?: CandidateId; committedRevisionId?: RevisionId;
  fault?: Fault; resultExpiresAt?: string; cancellationPending?: boolean;
};
```

Schema rejects unknown fields and nonfinite/out-of-range controls. Accepted live writes return `{acceptedControlSequence}`; this is an enqueue acknowledgement, not proof of a rendered frame. `lux.status` exposes last applied sequence. `afterControlSequence` capture waits for a completed frame that applied at least that sequence. Continuous pending values may coalesce; the result records actual values, not just requested values. Host-owned published values reject AI writes with `AUTHORITY_CONFLICT`; host control transport is separate (T03, S03).

Playback reset resets simulation and clock to zero with current seed/controls, preserves playing/paused state, increments clock epoch, and reports it. Restart increments runtime generation, reapplies current owner values, and resets simulation unless a supported checkpoint is requested in a later contract. Neither operation changes source revision. Stale generation commands fail; a queued command cannot accidentally reset a newly restarted renderer.

## Submit, validate, activate, and Undo

1. Validate request shape/limits and starting revision before admitting the job. Allocate immutable candidate source; no paths supplied by AI are executed as shell commands.
2. In a per-Scene serial queue, check the base again, compile in an isolated compiler process, and validate manifest/declared controls. The compiler has no project writer or desktop capability.
3. Start a disposable candidate renderer with deterministic settings/seed. Require a completed first frame and basic health checks within budget. Measure separately from the currently working instance.
4. Recheck head and affected scope, reconcile compatible current controls, and stage handoff at a frame boundary. If controls changed during smoke checking, apply latest allowed values before publication; report any reset.
5. Commit accepted content and publish runtime binding through the service's serialized activation boundary. A result is successful only when the accepted revision has a completed frame; retain rollback information until that outcome. At milestone 1 a failed post-persistence handoff creates a compensating restore revision instead of rewriting immutable history.
6. Emit one summary, affected IDs, control migration report, and Undo target. The user sees the successful result automatically (A02). No separate Keep step is added.

Default submit runs all steps. `autoApply:false` explicitly stages source; validate stores a certificate keyed by source/settings/SDK/control-schema hashes. Activate verifies certificate identity and the unchanged starting revision; an expired renderer lease requires another smoke run. Explicit staging is for diagnostics/integration, not the default creative workflow.

Scene-changing jobs are bounded FIFO, one running and at most one queued per Scene. Compilation does not hold the UI thread or block `status`, `read`, or cancellation. Saved UI edits share the same revision gate. Two jobs submitted from the same base cannot both commit: the second returns `REVISION_CONFLICT` and current head; the AI rereads and deliberately rebases. A project-wide commit lock serializes shared asset/component changes in milestone 1. No automatic text merge or silent last-writer-wins policy (A01).

Cancellation before commit removes queued work or terminates its disposable worker and releases leases. During the short commit section return `cancellationPending`; finish atomically, then report the actual terminal result. A completed commit is `succeeded` with revision ID, even if cancellation arrived too late. Undo is a separate optimistic mutation. MCP transport disconnect does not imply cancellation, because reconnect/retry must recover the result.

## Actual capture and race control

Capture is an inspection readback, separate from the normal host GPU-transfer path (T02, T04). Reserve one active and one queued capture per instance; cap queued captures at four service-wide when multiple instances arrive. The acceptance point fixes instance, generation, revision, final output, and minimum applied control sequence; later UI selection changes cannot retarget it.

The runtime emits a completed-frame envelope with frame ID, immutable pixel-resource lease, instance/generation/revision, clock epoch, simulation time, effective controls, seed, output settings, runtime build hash, and applied control sequence. Capture selects a matching completed frame and leases that exact resource before asynchronous readback/PNG encoding. Never read metadata from the mutable current Scene after reading pixels. Preserve the lease until GPU completion/readback is acknowledged or the generation is destroyed.

If activation/restart wins before any matching frame can be leased, return `REVISION_UNAVAILABLE` or `RUNTIME_RESTARTED`; do not return a newer image under an older revision. A leased prior frame may finish after activation and remains correctly labeled. A paused instance may return its last completed matching frame, marked repeated with actual animation time. Startup without a completed frame waits up to capture timeout, then fails; do not send the placeholder as scene evidence.

```ts
type CaptureMetadata = {
  captureId: string; instanceId: RuntimeInstanceId;
  revisionId: RevisionId; generation: number; clockEpoch: number;
  frameId: string; actualTimeSeconds: number; completedAtMonotonicMs: number;
  controlSequence: number; controls: Record<ControlId, Value>;
  seed: number; runtimeBuildHash: Hash; sourceHash: Hash;
  renderSize: [number, number]; captureSize: [number, number];
  target: "final"; mode: "live"; repeated: boolean;
  inputSnapshotId: string; colorEncoding: "sRGB"; alpha: "straight";
};
// MCP 2026-07-28 result from lux.jobs.get({jobId, includeResult:true});
// the 2025-11-25 adapter omits resultType, preserving content/metadata:
function imageResult(meta: CaptureMetadata, pngBase64: string) {
  return {
    resultType: "complete", isError: false,
    structuredContent: { state: "succeeded", capture: meta },
    content: [
      { type: "text", text: JSON.stringify(meta) },
      { type: "image", mimeType: "image/png", data: pngBase64 }
    ]
  };
}
```

The image bytes are actual encoded output; `pngBase64` is not a filename or URL. Convert linear premultiplied runtime color explicitly to tagged/display-referred sRGB straight-alpha PNG and record that boundary; retain an opaque-background context image only when requested later. Return repeated image content on result retrieval while retained. If the selected AI client cannot expose ImageContent to its model, T02 fails until that client integration is fixed. A tool transcript merely showing a path is insufficient evidence.

## Bounds, faults, and recovery

Initial API bounds: 1 MiB total UTF-8 source, 32 files, 128 KiB diagnostics, 30-second compile timeout, 5-second smoke/activation timeout, 5-second still capture timeout, and PNG result at most 8 MiB encoded PNG bytes before base64 with at most 1920 by 1080 pixels. Capture downsizes within the requested envelope, preserving aspect, and reports actual dimensions. Oversized PNG fails `RESULT_TOO_LARGE` with smaller-size guidance; never silently change scene quality. Tracer render settings remain the required 1920 by 1080/60 workload for performance evidence. These are engineering limits to implement and verify, not measured capabilities.

Return application errors with machine-readable codes and actionable context: `INVALID_ARGUMENT`, `SOURCE_BOUNDARY_VIOLATION`, `REVISION_CONFLICT`, `SCOPE_VIOLATION`, `COMPILE_FAILED`, `SMOKE_FAILED`, `ACTIVATION_FAILED`, `QUEUE_FULL`, `QUOTA_EXCEEDED`, `TIMEOUT`, `AUTHORITY_CONFLICT`, `RUNTIME_RESTARTED`, `REVISION_UNAVAILABLE`, `RESULT_EXPIRED`, `REQUEST_ID_REUSED`, and `SERVICE_UNAVAILABLE`. Unknown job IDs are `NOT_FOUND`. Failed jobs preserve bounded compiler line/column errors and their candidate ID; redact local secrets and unrelated filesystem paths.

Retain completed job metadata/idempotency records 24 hours, capture bytes 15 minutes up to 64 MiB total, with eviction only after unleased results expire. If memory is full before expiry, reject a new capture; do not break a published retention promise. Report `resultExpiresAt`. Active jobs pin required revisions and frame resources. Repeated `includeResult` does not extend retention. Tracer service restart loses these scratch jobs and returns `NOT_FOUND`; milestone 1 persists request/commit records and marks interrupted uncommitted jobs failed on reopen, without replaying side effects. Metadata retention expiry also ends request deduplication; clients must then inspect head rather than blindly retry.

Renderer failure is distinct from job failure. Supervisor observes an independent heartbeat/watchdog and terminates unresponsive generated execution within the T07 two-second budget; a queued MCP cancellation must not be the only stop mechanism. `status` reports UI response, visual CPU/GPU work, delivered/repeated frames, build faults, and recovery state separately. Missing GPU timing is unavailable, never zero or passing. Restart targets one logical instance, retaining its accepted revision/owner controls; host current values must win over stale Studio values (T05–T07).

## Source and execution boundaries

Accept only normalized relative UTF-8 module paths under the virtual source root; reject absolute paths, traversal, duplicate normalized paths, drive prefixes, symlinks and case-fold collisions. Resolve imports from the submitted bundle and pinned SDK allowlist only. Reject package installation requests, network module URLs, Node built-ins, native addons, and privileged desktop APIs. Compiler output is data handed to an isolated runtime, not evaluated in core, MCP, Electron main/preload, or Resolume.

The rendering process must actually disable Node integration and privileged bridges, restrict network/navigation, load only core-provided immutable asset bytes, and enforce process/IPC capability boundaries. Static import screening is useful but is not the sandbox: dynamic code must still have no host/filesystem/network capability. Runtime messages are schema-validated and size-bounded; generated code cannot choose an arbitrary pipe, release path, export destination, or process command. Validate the actual process configuration with escape attempts in tracer. GPU/driver failure remains a shared-machine risk (B02, T06).

## Later operation extensions

Milestone 1 adds `project.open/save/archive`, `scene.undo/redo/restore`, checkpoints and transactional saved controls. Milestone 2 adds graph patches, component code edits, library search/inspect/pin/publish, and node-scoped changes. Enforce scope by comparing the candidate's resolved diff, not trusting its declared scope; reading full output never grants permission to change all nodes (A01, A02, P01, P02, G01).

Milestone 3 extends `CaptureRequest` with typed component/diagnostic output, normalized rectangle, dimensions/aspect policy, `frameCount <= 16`, `intervalMs`, start state and `live|controlled`. Freeze scope at admission. Limit total decoded output to 32 MiB and execution to 60 seconds; reject requests exceeding the budget. Return per-frame requested/actual times, errors/partial result, input references, diagnostics and explicit render override. Capture size alone does not change render resolution. Controlled capture uses a separate instance, seed and recorded/synthetic input replay, runs necessary fixed steps, and never disrupts a live host. Unsupported checkpoint/reproducibility fails explicitly (C01–C03).

Milestone 4 adds Looks, embedded chat attachments, mappings, and `asset.import/register/replace`. Image generation may occur in an external provider but Lux validates and durably registers bytes before graph references commit. Edits to generated images use the same asset contract, with provenance and authorized references; credentials stay outside project data. Return composited captures for the model to inspect. Milestone 5 export/install collects immutable dependencies and makes playback independent of every authoring tool (S01–S04, M01, M02, R01).

Milestone 3 also adds `lux.inspect.sample`, a job over a declared analytical capability. The initial particle fixture must provide positions (trails can follow); other unsupported components return `UNSUPPORTED_DIAGNOSTIC`. Input identifies instance/generation/revision, node/capability, expected frame or controlled capture job, and `maxSamples` from 1 to 1024. Select samples deterministically by stable particle ID from a documented population, cap serialized output at 64 KiB and job time at five seconds, and never read back the entire unbounded simulation as an incidental operation. The result includes sample IDs/positions, coordinate space/units, population size, sampling policy, revision/frame/animation time/clock epoch, seed and input snapshot. Lease analytical data from the same simulation tick as its evidence image; don't combine current positions with an older capture. The source §7 acceptance must have the AI read this bounded sample, change only the particle simulation, and compare before/after under the same seed/input sequence (C03).

Milestone 4 extends `Playback.action` with `step`, using the runtime-owned paused-step semantics (S05). Return applied tick/time, pause state and input snapshot in the completed job. Reject unpaused requests with `INVALID_PLAYBACK_STATE` and host-owned targets with `AUTHORITY_CONFLICT`. UI and external/embedded AI share this operation; it does not revise code or replace controlled sequence capture.

## Implementation handoff and evidence

Proposed files: `packages/mcp/src/server.ts` (stdio/profile), `packages/mcp/src/tools.ts` (schema/result adapters), `packages/core/src/contracts.ts`, `packages/core/src/scene-service.ts`, `packages/core/src/job-service.ts`, `packages/core/src/capture-service.ts`, `packages/core/src/control-service.ts`, and `packages/core/src/source-policy.ts`. Supervisor/runtime IPC contracts must provide the completed-frame envelope and generation-aware commands above. No MCP adapter directly writes project files or runs visual code.

Introduce `tests/mcp/authoring-loop.test.ts` and `tests/core/capture-races.test.ts` with the tracer. Verify discovery, text-request source creation, automatic activation, actual model image receipt, image-informed executable revision, two revision-tagged captures, and invalid-source retention (T01/T02/T06). Race tests force replacement between frame selection/readback, restart before frame lease, concurrent same-base submits, late cancellation, and control-write/capture ordering. Verify bounded queues and repeated result retrieval. Preserve prompt, source hashes, image bytes, metadata and observed model response as evidence. Actual host closure/recovery and performance gates remain mandatory integration tests; these document contracts do not prove them.
