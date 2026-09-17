# LUX-198 bounded Story visual lifecycle

Status: architecture handoff only. S2 starts after S1 acceptance and resolution of
the resource-accounting gate below. This document proposes the shortest two-visual
result; it does not claim SDK 0.4 Story support, export support, or an editing suite.

## Ground truth in the current checkout

The orchestration checkpoint records only the LUX-71 reservation ledger and says a
resource host was still pending at that point. The checkout has since gained an
actual graph `ResourceHost` in `packages/runtime/src/graph/resources.ts` and serial
composition ownership in `packages/runtime/src/components/image-chain.ts`.
Those contracts are useful but narrower than S2:

- each graph host creates its own count ledger; a caller cannot supply a shared
  ledger across visual instances;
- the ledger limits allocations, backend work, inputs, frames, and captures, but
  has no CPU, decoded-asset, render-target, or GPU-byte dimension;
- the host owns one admitted SDK 0.4 graph. It does not own arbitrary SDK 0.2 root
  allocations or coordinate two separately compiled roots;
- `image-chain.ts` and `single-image.ts` already establish serial update/render,
  exact-once instance disposal, output retention, backend drain, and reverse-order
  cleanup. S2 should preserve those semantics;
- Studio currently creates one worker, one SDK 0.2 module, one visual instance,
  and one output target. A candidate worker is promoted after a complete frame,
  but `StandaloneClient.stop()` then calls `worker.terminate()` without receiving
  a GPU-settled disposal acknowledgement.

Two workers are not a viable overlap implementation: their WebGPU textures and
devices cannot be composed directly. The minimal implementation keeps one worker,
device, renderer, and presentation canvas per accepted schedule generation and
hosts the two visual instances inside that worker.

## Persisted contract

Keep Scene v6 and `SceneStoryV1` unchanged. Add Scene v7 only for a multi-visual
Story. It contains a bounded table of independent SDK 0.2 sources and one Story v2
definition. A source is compiled by the existing SDK 0.2 compiler; no component,
graph, SDK 0.4, or implicit conversion is involved.

```ts
type StoryVisualSourceV1 = Readonly<{
  id: string;
  source: SourceBundle & { readonly sdkVersion: '0.2.0' };
  controls: SavedControlSnapshot;
}>;

type StoryTransitionV1 = Readonly<{
  kind: 'crossfade';
  durationSeconds: number;
}>;

type StoryVisualRefV1 = Readonly<{
  visualId: string;
  layer: number;
  parameterOverrides: readonly [];
  transitionIn: StoryTransitionV1;
}>;

type SceneStoryV2 = Readonly<{
  version: 2;
  normal: StoryVisualRefV1;
  beats: readonly Readonly<{
    id: string;
    label: string;
    timing: BeatTiming;
    manual: StoryVisualRefV1;
  }>[];
  sequence: readonly Readonly<{
    id: string;
    beatId: string;
    follow: StoryFollow;
    clip: StoryVisualRefV1;
  }>[];
}>;

type StorySceneDocumentV7 = Readonly<{
  format: 'lux-scene';
  version: 7;
  visuals: readonly StoryVisualSourceV1[];
  settings: OutputSettings;
  tempo: SceneTempoSettings;
  story: SceneStoryV2;
}>;
```

Initial limits should be contract constants: at most eight visual definitions,
two resident instances, two composed layers, one preparation in flight, one
inactive ready instance within that two-instance total, five seconds of look-ahead,
and a five-second preparation deadline. A ready slot is evicted before admitting
an overlap that needs both resident positions. Only `crossfade` is accepted.
`layer` is a bounded integer; equal layers use stable clip ID ordering.
`parameterOverrides` is required and must be the empty array in this slice.

The normal reference identifies the initial and Return-normal target. Manual launch
uses `beat.manual`; sequence entry and resume use `occurrence.clip`. Thus two
occurrences of one beat can select distinct source definitions without changing
the beat's timing capability. A visual ID is definition identity. Runtime
activation ID plus occurrence ID is instance identity.

The visual containing `story: { version: 1, beats: ... }` is the controller. It is
the visual selected by `normal` and compiles to the existing linked version 6.
Every other table entry is an ordinary SDK 0.2 `defineVisual` source and compiles
to linked version 3. The controller capability continues to validate every Story
beat. Secondary visuals receive the scheduler's slot-local `frame.story`; the SDK
already types a visual without a declaration as `StoryFrame<string>`.

This resolves how the second visual is authored and compiled without claiming
SDK 0.4 Story. Persisted scenes retain source and saved control snapshots, not
linked output. A v6 scene remains valid and can migrate to v7 as a one-entry table,
but adding a second source is an explicit authoring operation.

## Build and admission identity

Compile and link each table entry independently with the existing compiler. Build
an internal schedule manifest after all entries pass source, artifact, linked,
control-schema, and Story-capability verification:

```ts
type AdmittedStoryVisual = Readonly<{
  id: string;
  sourceHash: string;
  linkedHash: string;
  controlSchemaHash: string;
  linked: ParameterLinkedEnvelope | StoryLinkedEnvelope;
}>;

type AdmittedStoryScheduleV1 = Readonly<{
  version: 1;
  storyHash: string;
  scheduleHash: string;
  visuals: readonly AdmittedStoryVisual[];
}>;
```

`storyHash` is the canonical Story v2 definition hash. `scheduleHash` hashes the
ordered visual IDs and their source, linked, and schema identities plus
`storyHash`; it becomes the runtime `revisionId`. Control values remain live state
and are excluded from schedule identity. Existing generation and guarded Story
revision remain separate.

The worker receives the complete verified manifest, but imports and invokes
`create` only when a slot is prepared. Admission must finish while the worker realm
is pristine. The current `prepareAuthoredModule()` retains decoded maps for every
prepared module, so it needs a trusted two-step form: verify and snapshot linked
bytes first, then acquire decoded asset leases and construct readonly facades when
that visual is actually prepared. Do not run the current verifier after authored
code has had a chance to replace realm globals.

## Worker lifecycle

Add one internal Story schedule owner next to, rather than inside, the graph
scheduler. Each activation slot follows:

```text
unloaded -> preparing -> ready -> active -> retiring -> disposed
                   \-> failed
```

Preparation key:

```text
generation + storyHash + activationId/occurrenceId +
visualId/sourceHash/linkedHash + preparationEpoch
```

Each prepared slot owns its module definition, control state, deterministic RNG,
asset leases, visual instance, render target, last completed frame, and pending
GPU settlements. Its renderer facade directs authored renders to that slot's
target. The compositor samples at most two completed slot targets, orders them by
layer then stable clip ID, applies premultiplied-linear crossfade, and writes the
existing presentation target once.

A Story transport action first creates a transition intent. It does not change
visible ownership. The scheduler prepares the target while the outgoing slot
continues updating and rendering. After the incoming slot has produced a complete
valid frame, one serialized draw commits the transport activation and publishes
the first composed frame. Only that frame completes the existing guarded command
receipt. During overlap, outgoing and incoming receive their own activation-local
Story frames. At crossfade completion the outgoing slot enters `retiring`.
`createStoryTransport` therefore needs an internal request/commit/cancel boundary;
the current eager `apply()` cannot be used for ownership-changing actions.

Retirement stops new update/render calls, awaits the serialized callback chain and
`device.queue.onSubmittedWorkDone()`, calls `instance.dispose()` exactly once,
releases its target and asset leases, awaits their settlements, then marks the slot
disposed. Dwell expiry, sequence end, pause, Awaiting cue, preparation delay, and
budget pressure only request work; none retires the current slot.

S1 activation rules remain authoritative:

- manually relaunching the same active beat adopts its instance;
- explicitly resuming an occurrence of that same beat adopts the current
  activation and starts fresh dwell when its visual reference is unchanged;
- starting or advancing to a new occurrence creates a new activation even when
  the visual ID is the same;
- seeking inside the current direct timed activation changes pose on the same
  instance; it does not dispose the slot;
- a loop epoch may reset/reuse the current direct instance. A fresh instance is
  required only when the transition needs simultaneous end and start poses.

Return-normal is the same prepare/commit/retire transaction targeting `normal`.
If preparation fails, the outgoing frame and ownership remain current, status
becomes failed with Retry and Return-normal available, and no partial layer is
published.

Cancellation increments `preparationEpoch` synchronously. A late completion with
an old key can never publish; it enters retirement and releases what it acquired.
A ready inactive slot may be evicted. Active, retiring, visible-frame, callback,
and GPU-in-flight ownership may not be evicted. If two resident slots cannot fit,
the transition is deferred or rejected while the current frame remains visible.

Whole-schedule hot replacement should reuse `StandaloneClient`'s candidate-worker
pattern. A candidate becomes current only after all slots required at the current
cursor produce one valid composed frame. Promotion removes the old canvas, then
sends a cooperative dispose request to the old worker. The worker must reply only
after the disposal sequence above. Browser termination remains a bounded final
reclamation path for a hung or device-lost worker, and must be reported separately
from a settled disposal.

## Resource prerequisite and compatibility risks

The existing resource ledger cannot satisfy the plan's cross-visual GPU-byte
claim. It is private to one graph host, count based, and does not observe arbitrary
SDK 0.2 allocations made through Three. Before implementation, review and choose
one of these truthful acceptance boundaries:

1. extend the resource authority so a shared schedule ledger can charge decoded
   assets, Lux-owned targets, callbacks, frames, and measured/declared authored GPU
   allocations; or
2. limit S2's enforceable budget claim to resident instance count, verified decoded
   asset bytes, and Lux-owned render-target bytes, and treat process/GPU memory as
   measured evidence rather than enforced accounting.

The second option is the shortest usable two-visual slice. It must not be described
as complete GPU-byte enforcement. This is a material contract decision and merits
a fresh ownership/resource review before coding.

Other concrete risks:

- Scene v7 changes authoring, save/open, dirty state, and MCP source targeting from
  one source to a visual-ID-scoped source. Existing v1-v6 paths must remain exact.
- Preparing all current `prepareAuthoredModule` closures eagerly retains every
  decoded asset and defeats on-demand loading. The admission split is required.
- One command may remain pending during preparation. Its client timeout must cover
  the fixed preparation deadline, and same-command-ID retry must stay idempotent.
- Asset sharing is currently copy-on-read with no lease API. Refactor the trusted
  decoded backing into a content-hash pool; authored facades still return copies.
- Removing an old canvas is not disposal evidence. Tests must observe the worker's
  settled acknowledgement and distinguish forced termination.

## Candidate file ownership

| Owner | Candidate files |
| --- | --- |
| Contracts/persistence | `packages/runtime-contracts/src/story.{mjs,d.mts}`, `packages/core/src/scene-document.ts`, focused Scene/Story tests |
| Build/admission | `apps/build-worker/src/artifact-identity.{mjs,d.mts}` only if the schedule manifest becomes a shared DTO; otherwise reuse existing v3/v6 envelopes; `apps/studio/src/authored-worker-assets.mjs`; focused compiler/admission tests |
| Runtime lifecycle | new `apps/studio/src/story/story-schedule.mjs`, `apps/studio/src/visual-worker.mjs`, `apps/studio/src/controls/story-transport.mjs`, focused CPU race/lifecycle tests |
| Resource/asset leases | `packages/runtime/src/graph/resource-accounting.ts` only after the review decision; `packages/assets/src/index.{mjs,d.mts}` for trusted decoded backing leases; focused accounting/asset tests |
| Client/UI/operations | `apps/studio/src/standalone-client.ts`, `service-client.ts`, `runtime-operations.ts`, `story/StoryPanel.tsx`, authoring-session and MCP Story files, native UI/command tests |
| Documentation | `skills/lux-visual-creation/` plus its install/check evidence after behavior exists |

Do not make the Story schedule owner another timer or a second graph scheduler. It
consumes the worker's existing serial draw clock and may later host a graph visual
through the current composition bridge, but SDK 0.4 support is outside this slice.

## Native two-visual demonstration

Use an isolated Scene v7 with two SDK 0.2 sources:

- `ambient`: the controller/Normal visual, linked v6;
- `feature`: a separately compiled visual used by both a sustained `orbit` beat
  and a timed direct `arrival` beat, linked v3.

Start in ambient and show that feature has no created instance. Launch the sustained
orbit beat manually and leave it beyond its sequence dwell; the active instance
must not restart or dispose. Return-normal through a visible crossfade. Start the
timed arrival occurrence, crossfade to feature on demand, pause while holding both
ownership and the last-good frame, seek the timed arrival without replacing its
instance, and loop once. Force one stale preparation and one preparation failure;
both retain the old frame and dispose only their unpublished candidate. Hot-build
one source and show off-screen whole-schedule promotion. Finally Return-normal,
close the scene, and record that every slot, target, and asset lease reaches zero
after the GPU-settled disposal acknowledgement within the declared bounds.

CPU tests should cover state transitions, fresh occurrence identity, same-beat
adoption, budget rejection, stale completion, exact-once disposal, shared lease
counts, and failed promotion. The product claim still requires the coordinated
native GPU/UI run and independent ownership/race review.
