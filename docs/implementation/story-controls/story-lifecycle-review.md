# Independent review of the two-visual Story lifecycle

Reviewed 17 September 2026. Reviewer: independent GPT-6 Astra, high; selected for
GPU settlement, cancellation, and ownership analysis. Read-only source review plus
this report; no implementation, tracker mutation, build, native run, or acceptance
of S1. Inspected checkout: `.worktrees/story-controls`, HEAD
`a43412cf095f092a5e38abe44d7c984d5285d338`, with the coordinator's concurrent S1 work.

Inputs: `story-lifecycle-design.md`, section 7 of the revised Story contract, and
the historical plan's S2 section. The revised sustained-beat contract and current
user authorization supersede the historical fixed-interval model and approval
hold. S1 remains a separately accepted, single-root result.

## Ruling

**Revise before S2 implementation. Scoped, truthful resource budgets are adequate
for the usable SDK 0.2 two-visual transition. A general graph ResourceHost extension
is not a prerequisite.** The prerequisite is concrete schedule ownership and
reservation of the resources Lux actually controls, including replacement and
retirement. Extending the present count ledger alone cannot impose a hard cap on
arbitrary Three allocations, repeated asset copies, module globals, or driver
memory. Do not claim bounded total CPU/GPU memory or complete GPU-byte enforcement.

Keep one worker/device/renderer per schedule generation, at most two resident
activation slots per generation, and the existing serial presentation clock. Do
not introduce a second graph scheduler, renderer bypass, SDK 0.4 conversion, or
generic clip editor. Use the existing graph lifecycle as a reference for scoped
callbacks, retained frames, exact-once cleanup, and failed settlement; it does not
currently manage these SDK 0.2 roots.

The following corrections are required. They belong to LUX-198's implementation
and acceptance checklist, not separate tickets for workflow stages.

## 1. Each visual must authorize its own Story behavior

The proposed controller granting capability to a linked-v3 secondary is invalid.
`FrameContext` typing a missing declaration as `StoryFrame<string>` is permissive
TypeScript input typing; it does not certify direct seek or beat support. A
secondary could integrate local state despite the controller declaring direct
seek. The current worker's direct-seek gate is derived from the admitted visual's
own capability.

For this slice, every source referenced by a beat must declare the Story beats it
receives, compile through the existing linked-v6 path, and have those declarations
checked against that beat's timing. Every manual and occurrence reference must
pass this check. A source used only for Normal can remain linked v3. A beat used
by multiple sources has direct seek only when each selectable source supports it;
validate the complete document before promotion and derive runtime controls from
the actual target. Do not manufacture a global controller grant. This reuses
current capability/artifact versions instead of adding an SDK version.

Keep the smallest authored schema: a bounded source table, a Normal visual ID,
manual and occurrence visual references, and a finite crossfade duration. Omit
`layer` and `parameterOverrides` in this slice. There are exactly outgoing and
incoming roles; linear premultiplied crossfade needs no general layer sorting.
Overrides remain unsupported. Validate IDs, references, exact fields, durations,
and aggregate sizes. A new scene discriminator is justified for the source table;
existing v1-v6 readers, hashes, and saving paths must remain exact.

Keep authoring within atomic complete-document build/read. Validate and compile
all source entries before changing accepted source, file identity, or preview.
Do not add per-visual mutable editing endpoints. Saved controls need visual-ID
scope, and existing animations must either have explicit lossless scope or fail
the conversion before mutation. Define live control and trigger targeting by
visual identity and, where an event reaches an instance, activation identity;
otherwise two occurrences of the same source make delivery ambiguous.

The runtime schedule hash must be recomputed from canonical verified data. Bind
all Story references and transition settings plus each visual ID, source hash,
linked hash, and control schema hash. Linked-v6 hashes already bind capability
metadata. Reuse them. Keep activation/occurrence identity distinct from source
identity. Excluding live control values from the schedule hash is sound, but
candidate promotion still needs the latest accepted per-visual values/sequences.

## 2. Preparation must not monopolize the active worker

`visual-worker.mjs` currently awaits initialization and each draw on one promise
chain. Awaiting an incoming five-second `create()` on that chain would stop active
draws and command processing. `standalone-client.ts` independently faults after
1.25 seconds without heartbeats or completed playing frames. Merely lengthening
the Story command timeout does not solve either problem.

Preparation must be a bounded job whose completion re-enters the draw owner; do
not await the whole preparation job inside the draw/command chain. Permit one
pending create job and reserve its slot first. Restrict each renderer facade to
the currently admitted render callback, capture/drain every render it starts even
if authored code fails to await it, reject concurrent or late calls, and restore
the renderer target only after the backend render settles. No presentation call
belongs in a slot facade. The current SDK 0.2 facade presents immediately and is
not suitable unchanged. Snapshot the instance methods/disposer once with the
legacy receiver semantics preserved.

Asynchronous preparation can coexist with active rendering under these guards.
Synchronous authored loops and shared-device loss cannot be safely cancelled
inside that same worker. Preserve the visible last-good canvas, use the existing
external liveness authority, and report whole-generation failure when recovery
requires termination. Do not promise that arbitrary incoming code can fail while
the outgoing instance continues live. Ordinary rejected preparation should clean
up its own acquired resources and leave outgoing ownership intact.

Cancellation must invalidate the preparation token at message admission, before
queued work or promise continuations can publish. Validate the request's runtime
guards first. Recheck the entire token after each async boundary and immediately
before promotion. Timeout/cancellation does not release a slot whose create,
callback, or disposal is still pending. A late returned instance is disposed once;
a never-returning create keeps its reservation until generation reclamation.
Reject/defer another prepare rather than accumulating abandoned work.

## 3. Commit and crossfade need explicit transport semantics

Keep the proposed request/commit/cancel boundary, including automatic dwell
advancement. Neither `apply()` nor `beginFrame()` may change visible activation
before target admission and a valid composed frame. A same-beat adoption also
requires the same visual reference; a new occurrence still has a fresh activation.

Specify one transition progress clock and its pause behavior. The shortest
consistent choice is Story advancement time: Story pause holds crossfade weights
while ambient updates continue; global pause holds all advancement. Keep outgoing
and incoming activation-local times separate. Dwell begins at committed incoming
activation, not when preparation starts. A first committed frame with incoming
weight zero is permitted, but the status/receipt must describe that exact frame
and the pending overlap rather than claiming fully visible replacement.

During an overlap both slots are active. A third-target launch cannot create a
third slot or free either visible slot. Return a stable busy/deferred result with
a disabled reason, or keep only one explicitly bounded pending intent. Pause and
same-instance seek must still work. Define Return-normal during overlap by the
same rule; an always-enabled button is not evidence that capacity exists.

Freeze the authoritative last-good composed output until the entire next frame
has succeeded, including GPU completion. Updating an incoming target must not
touch presentation. Retain any target needed by capture or last-good output;
include staging targets in accounting. Publish the guarded command receipt only
with its exact completed frame. Preparation, cancellation, and failure outcomes
must settle or retain the existing idempotent ledger entry coherently; a retry
with the same ID cannot launch a second preparation. Preparation deadline,
command timeout, watchdog, and cleanup timeout need distinct meanings.

Do not reintroduce absolute Story seek to satisfy the superseded plan. The native
case is active timed-beat-local seek, loop reuse where possible, and actual
sequence/manual transitions. A loop requiring simultaneous endpoint/start poses
uses the same two-slot reservation; a loop epoch alone is not a disposal reason.

## 4. Resource limits must cover the actual lifetime and both generations

Use these acceptance boundaries:

| Bound | Required interpretation |
| --- | --- |
| Eight source definitions | Bound aggregate encoded source, linked payload, and metadata bytes as well as entry count. The current 16 MiB linked limit is per module. |
| Two resident slots per generation | Count preparing, ready, active, retiring, and unresolved cleanup; reserve before create. Release only on proved settlement. |
| One preparation in flight | Includes a cancelled/timed-out create until it settles. At most one inactive ready slot, within the two-slot bound. |
| Five-second look-ahead/deadline | Look ahead only where current sequence intent has a known next target. Deadline rejects publication; it is not proof of reclamation. |
| Decoded backing bytes | Reserve before decode; count unique pool entries plus live leases and verification staging. Existing per-source limits are 1 MiB encoded image bytes and 2 MiB RGBA. Copies returned to authored code are outside this enforceable backing-store cap. |
| Lux target attachment bytes | Charge explicit color/depth formats, dimensions, samples, mips, all slot/compositor/staging targets, and retained capture ownership. This is descriptor-based logical bytes, not physical driver allocation. |
| Whole-client replacement | At most old plus one candidate generation, with shared host reservation and separate devices. Each may require two slots, so peak can be four slots plus both generations' targets/assets. Count a retiring old generation until acknowledgement. |

Set numerical aggregate byte limits before implementation and demonstrate the
allowed output sizes fit. At 3840×2160, one four-byte-per-pixel attachment alone
is 33,177,600 bytes. Counting only two color textures omits depth, presentation,
staging, and the replacement generation. Account each attachment actually used;
do not infer total memory from `width × height × 4` or from renderer object counts.

The client must own the reservation spanning workers. Reserve the candidate peak
before starting it. If the old generation has not settled, do not admit another
replacement even after promotion. Deferral is acceptable; silently exceeding the
limit or killing the visible generation to fit is not. Shared decoded leases can
be generation-local; each worker's copy is then separately charged. Cross-worker
pool sharing is unnecessary for this result.

The existing `ResourceLedger` has exact count fields and `ResourceHost` creates a
private ledger per graph. Leave that graph API unchanged for this SDK 0.2 slice.
A small schedule-owned reservation record for the fixed slots and known byte
dimensions is sufficient. It must follow the ledger's all-or-nothing reservation,
owner-authenticated release, and idempotent cleanup rules. If the implementation
instead selects graph components or promises authored GPU-byte enforcement, that
is a different prerequisite: shared resource authority and mediated allocations
must land first. Declared estimates alone do not enforce arbitrary allocations.

## 5. Lazy loading must preserve pristine admission and bound module retention

The proposed admission split is necessary but underspecified. Current
`verifyDerivedAssets()` decodes while verifying, and readonly facades capture safe
operations before authored import. A metadata-only preflight followed by the
current decoder/facade constructors in an authored-modified realm weakens that
boundary. Fully verify all linked artifacts and source assets in pristine trusted
execution, with bounded transient decoded storage, before accepting the schedule.
Lazy reacquisition must use a trusted decoder/facade path whose required intrinsics
were captured before import, or an isolated trusted asset worker. Test poisoned
globals. Never re-run the current unmodified admission path after user code.

Retain verified encoded bytes; release verification-only decoded storage. Lease
decoded backing by verified content identity, including decoding semantics, and
keep readonly copy-on-read behavior. Clear backing references on final release;
a retained facade must not expose released backing or silently recreate it without
reservation. Repeated authored reads can still retain arbitrary copies, so keep
the budget claim narrow.

Import a visual module at most once per definition per schedule generation. Blob
URL revocation and instance disposal do not unload ESM module state. Reimporting
each activation would retain unbounded modules in a long sustained show. Cache
the bounded admitted factories; separate module lifetime from activation lifetime.

There is also a concrete interoperability check: `link-worker.mjs` bundles Three
and TSL independently into each linked module. Matching dependency hashes do not
prove that two library instances cooperate with one renderer. Before building the
full scheduler, demonstrate two separately compiled materials/scenes on one
renderer, including a TSL material and disposal/recreation. If that fails, correct
the trusted linking/library boundary; do not waive artifact verification or use a
second visible renderer as a workaround. This review identifies the risk and does
not assert that existing bundles fail that test.

## 6. Settled disposal is a separate protocol outcome

The existing client `stop()` removes handlers and immediately terminates its
worker. The worker's successful `terminalCleanup()` sends no success message;
`cleanup { complete: true, diagnostics }` currently also includes cleanup errors.
Neither path proves successful resource disposal.

Add an identity-guarded disposal request/acknowledgement. Stop admitting callbacks,
await pending creates/render callbacks and submitted GPU work, invoke each
captured disposer once, settle its resulting backend work, then release owned
targets/assets and report exact remaining reservations. A rejected barrier does
not authorize freeing in-use targets. A disposer or release failure remains a
diagnosed unreclaimed state, not a zero-resources success. Keep the handler and
reservation alive until this outcome is received. Use a bounded forced-termination
fallback for hangs/device loss, separately reported as browser reclamation
requested rather than GPU-settled disposal. Never count termination as an ack.

## Acceptance needed after these corrections

CPU tests must cover two-slot admission including retiring/unresolved slots,
both-generation peak reservation, cancellation while create is pending, ignored
render promises and late facade calls, stale complete-frame publication, command
ID retries, poisoned admission globals, secondary capability mismatch, shared
lease release, and cleanup failures. Also cover authored source/save/reopen
round-trip and failed complete-document build retaining accepted user files.

The coordinated native run must prove separately compiled sources share the
renderer, on-demand instance creation, a sustained beat beyond dwell, a visible
crossfade, pause/seek/loop semantics, stale and rejected preparation, hot replacement
during overlap, and successful final settled cleanup. Record logical resource
counters separately from available process/GPU measurements. Check two distinct
sources and two activations of the same source. Show loading/busy/failure status
and keyboard behavior in the native panel. Retain existing export rejection and
ship/install/check the relevant visual-creation skill with the usable behavior.

This review approves the narrow budget direction and identifies the required
design corrections. It does not accept the proposed design unchanged, claim S1
acceptance, or supply GPU/UI proof.

## Source evidence

- `packages/runtime/src/graph/resource-accounting.ts`: fixed count dimensions,
  atomic reservation, opaque ownership, idempotent release.
- `packages/runtime/src/graph/resources.ts:281`: one private ledger per host;
  frame/capture holds and failed cleanup retained by the resource authority.
- `packages/runtime/src/components/single-image.ts`: captured methods, evaluation
  epochs, pending backend drain, exact-once disposal.
- `packages/runtime/src/components/image-chain.ts`: serial composition, retained
  output, reverse instance cleanup, backend drain.
- `apps/studio/src/visual-worker.mjs`: serial command/draw chain, root facade
  presentation, cleanup barrier and acknowledgement gap.
- `apps/studio/src/standalone-client.ts`: five-second initialization/commands,
  1.25-second progress watchdog, immediate worker termination on stop.
- `apps/studio/src/authored-worker-assets.mjs` and
  `apps/studio/src/controls/worker-control-state.mjs`: pristine admission and
  runtime declaration checking.
- `packages/assets/src/index.mjs` and `limits.mjs`: decoding during admission,
  retained decoded maps, per-source limits, captured readonly copy operations.
- `packages/visual-sdk/src/sdk-v2.ts` and
  `apps/studio/src/controls/story-transport.mjs`: optional typed Story input,
  capability-derived direct seek, eager transport mutation.
- `apps/build-worker/src/link-worker.mjs:106` and `artifact-identity.mjs`:
  independent Three/TSL bundles and existing linked-v6 capability identities.

## Implementation contract addendum

The first native probe subsequently failed across independently bundled Three/TSL
instances. The [shared linker amendment](story-shared-linker-amendment.md) replaces
the standalone-envelope packaging assumption and narrows the ordering gate for
independent pure schema work. Its capsule identity and quota rules supersede the
corresponding executable-packaging details below; Scene/transport/resource rules
are unchanged.

The coordinator requested this addendum to turn the rulings above into mandatory
implementation choices. It is planning, not a further review or acceptance round.
Where the initial proposal leaves alternatives, use this contract.

### First prerequisite and delivery order

After S1 acceptance, first run one isolated GPU interoperability probe. Compile
two independent SDK 0.2 sources through the normal linker. Use one renderer/device,
two off-screen targets, one ordinary material and one TSL material; compose a
premultiplied-linear fade and recreate/dispose both instances. Verify no cross-
bundle class/cache failure and unchanged capture color/alpha behavior. The probe
uses existing verified artifacts and the ordinary renderer, with no production
scheduler or safety bypass. Record source/dependency identities and images. If it
fails, fix the concrete linker interoperability issue before building S2. No probe
has been run as part of this report.

After that gate, implement the three ownership groups below against these shared
DTOs. Integrate one complete-document two-source scene before adding optional
look-ahead. Native acceptance remains one coordinated GPU/UI run after CPU checks
and independent source review.

### Exact persisted schema

```ts
type StoryVisualSource = Readonly<{
  id: string;
  source: SourceBundle & { readonly sdkVersion: '0.2.0' };
  controls: SavedControlSnapshot;
  controlAnimations: readonly ControlAnimationBinding[];
}>;

type SceneStoryV2 = Readonly<{
  version: 2;
  normalVisualId: string;
  crossfadeSeconds: number;
  beats: readonly Readonly<{
    id: string;
    label: string;
    timing: BeatTiming;
    visualId: string;
  }>[];
  sequence: readonly Readonly<{
    id: string;
    beatId: string;
    follow: StoryFollow;
    visualId: string;
  }>[];
}>;

type StorySceneDocumentV7 = Readonly<{
  format: 'lux-scene';
  version: 7;
  visuals: readonly StoryVisualSource[];
  settings: OutputSettings;
  tempo: SceneTempoSettings;
  story: SceneStoryV2;
}>;
```

All fields are required; reject unknown fields and accessors using current record
admission. `crossfadeSeconds` is one finite value in `[0, 5]`, with zero meaning an
atomic cut after preparation. New two-source examples use `0.35`. The beat's
`visualId` selects manual launch/replay/loop; an occurrence's `visualId` selects
start/advance/resume. Keeping these two fields supports two occurrences of one
beat using different visuals without a clip abstraction. Normal uses its one
visual ID. There is no transition kind, layer, override list, global duration, or
absolute seek field. The only transition operation is crossfade.

Allow 1–8 visuals and retain current limits of 128 beats and 1,024 occurrences.
Visual IDs use the existing Story stable-ID grammar and are unique; all references
must resolve. Beat timing and follow retain the S1 validators. Each source selected
by a beat/manual or occurrence reference must admit that beat's timing and its own
direct-seek capability through linked v6. Validate the referenced subset against
each source, rather than requiring every visual to declare every scene beat. A
Normal-only source may use linked v3. Never pass Story v2 to the v1 root validator
or infer secondary capability from another source.

Each source owns its saved controls and animation bindings. Bindings retain the
existing flat-root `nodePath: []`, source's schema identity, and existing animation
meaning; reject nonempty paths. Complete-document build compiles all sources,
migrates each saved control/animation snapshot by the existing rules, and replaces
accepted state only after the candidate succeeds. Return migration issues with
visual IDs. UI source/control selection is local `selectedVisualId`, separate from
active Story selection. Build/read receive/return the whole document; there is no
incremental source-write API. Existing typed control patches gain a guarded visual
ID for v7. They update the definition's current saved values and all its resident
slots at the next serialized draw. Triggers additionally require the exact active
activation ID and never broadcast to another occurrence or a ready slot.

Do not silently convert existing scenes. An explicit add-source authoring action
converts an accepted v6 scene into this table, preserving settings, tempo, source,
controls, animations, beats, and occurrence IDs, and filling all visual references
with that source ID before adding another. Existing v1-v6 save/open behavior stays
unchanged. V7 is an explicit runtime choice even with one source entry; do not
promise that its fresh-occurrence instance lifecycle is S1's single-root lifecycle.

The internal admitted manifest contains the normalized Story v2, its hash, sorted
visual IDs with verified source/linked/schema hashes and linked envelopes, plus
the canonical schedule hash. Hash the visual table in ID order; preserve beat and
sequence order. Saved/live values are not artifact identity. Candidate promotion
must nevertheless synchronize their latest sequences. Verify manifests and build
all post-import-safe control/asset factories before any authored module executes.

### Numeric bounds and target recipe

These are admission constants, not a claim about total process or GPU memory. A
byte below means a logical serialized byte or a byte of explicitly owned backing
storage, as named by its dimension. All arithmetic must use checked safe integers.

| Dimension | Exact limit |
| --- | --- |
| Scene v7 serialization | 32 MiB (`33,554,432`) using the existing pretty JSON plus final newline convention |
| Source text | Existing 1 MiB and 32 files per source; 8 MiB (`8,388,608`) aggregate UTF-8 file text |
| Linked envelopes | Existing 16 MiB per envelope; 64 MiB (`67,108,864`) aggregate compact serialized envelope bytes per generation |
| Schedule metadata apart from linked/source payloads | 1 MiB (`1,048,576`) compact JSON per generation |
| Prepared/resident activation slots | 2 per generation, including preparing/ready/retiring/unsettled slots |
| Generations owned by a client | 2 total: current plus candidate or retiring previous; no candidate while both positions are occupied |
| Pending create jobs | 1 per generation, including cancelled jobs not yet settled |
| Ready inactive slots | 1 per generation, within its 2 slots |
| Preparation look-ahead | 5 seconds; only the immediate next occurrence with a known `after` boundary |
| Preparation deadline | 5,000 ms from reservation through first valid off-screen frame; expiration invalidates publication, not ownership |
| Command receipt timeout | 8,000 ms; retain existing uncertain-result/same-ID retry behavior |
| Cooperative cleanup deadline | 5,000 ms; forced termination remains a separate, non-settled outcome |
| Trusted asset backing retained by live slot leases | 6 MiB (`6,291,456`) per generation; 12 MiB (`12,582,912`) across the client |
| Trusted asset verification/decode output in staging | 3 MiB (`3,145,728`) client-wide; one asset-set staging job at a time |
| Explicit Story render-target attachments | 192 MiB (`201,326,592`) per generation; 384 MiB (`402,653,184`) client-wide |
| GPU readback buffer | 1 client-wide, at most 32 MiB (`33,554,432`); reserve separately from attachments |
| Completed PNG result | Existing 40 MiB (`41,943,040`) limit; at most one capture command in flight |

Scene/source/linked size checks are payload quotas, not heap-memory estimates.
Retain existing stricter per-source asset limits. The 6 MiB lease bound derives
from two slots, each with at most 1 MiB decoded encoded-file bytes and 2 MiB RGBA
pixels. A content-shared entry is charged once within a generation while any lease
holds it. Verification uses at most one source's 3 MiB final asset buffers at a
time. Across both generations plus staging, retained trusted asset backing is at
most 15 MiB (`15,728,640`). Reserve staging before decode, then atomically transfer
the charge to a slot lease or release it; count both copies if transfer copies.
Decoder internals, readonly facade copies retained by authored code, structured-
clone copies, strings, and module-created data are not included in this backing
counter and must not be described as capped CPU memory.

Pin the following explicit target recipe to the current renderer behavior:

| Target | Count at overlap | Attachments | Logical charge |
| --- | --- | --- | --- |
| Slot render target | 2 | `rgba8unorm-srgb` color; `depth24plus` depth; no stencil | `8 × width × height` each |
| Composed front/working pair | 2 | `rgba8unorm-srgb` color; depth/stencil disabled | `4 × width × height` each |

Use one color attachment, one mip, one array layer, and one sample (`samples: 0`
in Three). Preserve `SRGBColorSpace`, unsigned-byte RGBA, and the existing
premultiplied-linear sampling/presentation boundary. Make these options explicit;
check the allocated descriptors in the probe. `depth24plus` is charged at four
logical bytes per pixel, matching pinned Three's own byte-length convention, not
an assertion about the driver's physical depth allocation.

Therefore each generation reserves at most `24 × width × height`. At 3840×2160
this is **199,065,600 bytes**, below 192 MiB. Old plus candidate at that size is
**398,131,200 bytes**, below 384 MiB. The client reserves the candidate's complete
two-slot peak before starting it, even if only one slot is initially needed.
Within that grant, allocate slots on demand; do not create every source instance.
Reserve both composition buffers from initialization. The front remains the last
completed composition while the other is written. Swap only after successful GPU
settlement; never present a partially written working buffer. Per-slot targets
may be reused after settlement because last-good composition lives independently.

Capture leases the composed front and is serialized against draws. No third
composition target is allocated for capture. The pinned readback length is
`(height - 1) × ceil(width × 4 / 256) × 256 + width × 4`; its maximum at the allowed
size is 33,177,600 bytes, below 32 MiB. Hold the front and the readback reservation
until the copy settles. The 40 MiB PNG limit is checked on encoded output; it is
not a cap on encoder working memory. Browser swapchain images, renderer-internal
canvas/depth resources, pipelines, authored geometry/textures, and driver caches
are outside `storyTargetBytes`. Report available measurements separately.

Do not raise output dimensions or introduce MSAA/HDR/mips in S2. Such a request
requires a revised recipe and budgets rather than silently charging the old one.
On cleanup failure, keep the affected grant charged and report unreclaimed state.
Forced worker termination does not synthesize a successful zero-resource receipt
or permit repeated replacement to escape the two-generation bound. If it exhausts
the available positions, stop admission and report that the client needs recovery.

### Direct seek, overlap, and busy rules

The authoritative target after a committed transition is incoming; outgoing keeps
its private activation frame until fade completion. `crossfadeProgress` is `[0,1]`
and advances using Story advancement time. Both visual updates still use the
ordinary animation clock. Pause freezes Story local phase/dwell and fade progress,
while ambient updates continue; global pause retains the existing zero-delta
command-frame rule. Preparing does not start incoming dwell or advance ownership.

| State/action | Exact behavior |
| --- | --- |
| Stable active timed beat: seek | Direct-seek its local time, retain the instance/activation, pause Story, and acknowledge its completed frame. |
| Overlap: seek | Seek incoming's timed local phase only, retain both slots, freeze current fade weight, and pause Story. Outgoing's Story pose is held; its ambient updates may continue. UI labels the seek target as the incoming beat. |
| Seek to another visual/occurrence | Unsupported. There is no absolute Story/overlap-position seek. Use launch/start/resume after capacity permits. |
| Overlap: play/pause | Resume/freeze incoming Story advancement and fade together; neither action changes ownership. |
| Preparation pending: pause or current-beat seek | Cancel/invalidate the pending transition intent, apply the action to the committed active slot, and retain the cancelled slot reservation until cleanup settles. |
| Stable active same beat/reference: manual launch | Adopt current activation, detach sequence ownership under S1 rules, and do not prepare another instance. |
| Stable same beat/reference: explicit resume | Adopt current activation and begin fresh dwell for that occurrence under S1 rules. |
| New occurrence, including same source | New activation and fresh instance; use the second slot and crossfade/cut. |
| Timed loop without overlap | Reuse the current direct instance for end/start poses, publish the endpoint once, then a new loop epoch at zero; no new slot is needed. |
| Overlap: launch/start/advance/resume/replay/loop/Return-normal | Reject with `STORY_TRANSITION_BUSY`; never admit a third slot or replace a visible slot. No hidden user-command queue. |
| No overlap but cancelled/retiring slot still holds capacity | Actions that need another slot return `STORY_CAPACITY_BUSY`; same-instance seek/play/pause/adoption remain available. |
| Automatic advance becomes due during overlap/retirement | Keep a single due-next intention derived from current sequence state, show Waiting for transition, and retry only when capacity settles; no new prepare/activation/dwell begins early. |

Same-instance seek during overlap does not cancel the committed overlap; it changes
the incoming direct pose at the held weights. There is no scrub of fade progress.
Replay/loop requests for a different beat outside overlap follow manual beat
selection and preparation. Replaying the same stable timed beat may reuse its
direct instance with a fresh activation epoch; it is not a new sequence occurrence.
No reset/replay simulation or historical audio reconstruction is introduced.

Preparation failure leaves the outgoing committed transport and frame visible.
After failed candidate cleanup, Retry uses a new command ID; repeating the failed
command's ID returns its original outcome. A timed-out uncertain ID retains the
existing retry semantics. An ordinary Return-normal also prepares/commits, uses
the global fade duration, and can be busy; disable it with the reason rather than
pretending it bypasses the resource bound. Normal-to-Normal is an idempotent no-op.

Retain the existing 1.25-second external liveness checks for authored stalls. The
5-second preparation allowance applies to cooperative asynchronous preparation
while active frames continue, not a five-second renderer lock or watchdog waiver.
Any pending shader/backend operation retains its facade and resource ownership
until settlement; a deadline cannot make concurrent renderer access safe.

### Ownership split and integration contracts

| Owner | Exclusive implementation surface | Required handoff |
| --- | --- | --- |
| Schema, admission, assets | Shared Story/Scene v7 contracts and validators; complete-manifest identity; per-visual capability/control verification; trusted encoded admission and decoded lease pool | Pure normalized DTOs; exact quota constants; a pre-import prepared asset/control factory per visual; `acquire`/idempotent `release` leases with counters and safe late-use rejection |
| Worker slots, rendering, disposal | `story-schedule` owner, worker protocol execution, scoped render facade, request/commit transport boundary, two-target composition, slot/generation cleanup | Manifest/grant consumption; full-key preparation completions; exact completed-frame status/receipts; resource counters; cooperative disposal result distinguishing settled/failed/unreclaimed |
| Host reservations, authoring, UI | Client's two-generation grants, candidate synchronization/promotion, complete-document authoring save/read/build, source/control selection, Story loading/overlap/busy UI and MCP | Pre-start peak grant; guarded protocol DTO usage; client timeout/retry integration; single accepted file/preview transaction; user-visible reasons and native evidence |

One assigned owner lands shared DTO changes before dependents edit protocol call
sites. The host owner owns `standalone-client.ts`; worker owner owns
`visual-worker.mjs` and `controls/story-transport.mjs`; schema owner owns shared
Story contracts and `authored-worker-assets.mjs`. Keep edits in these boundaries
or coordinate a precise handoff. Parent serializes integration, graphics use, and
any overlap with unfinished S1 work. No second team or extra workflow-stage ticket.

The prepared asset factory is constructed in pristine admission and closes over
the required safe operations. Full verification may decode/discard each source
serially before import. Later `acquire` decodes only the requested source, using
the trusted captured decoder/facade path, and resolves an opaque charged lease;
it must pass modified-realm tests. A generation caches at most one imported module
factory per admitted visual ID; new activations call its `create`, not another
blob import. The lease pool keys backing by verified content plus decoder version.
No post-import call to the current unmodified admission helpers is permitted.

The host passes a generation-bound reservation grant with manifest identity,
output dimensions, and the fixed allowance; the worker derives exact internal
charges from descriptors. It cannot enlarge the grant through telemetry. Every
status identifies generation, schedule hash, Story revision, committed activation,
optional outgoing/incoming transition, pending-preparation state, and resource
counts. A disposal success includes that same identity and zero owned slots,
leases, targets, pending callbacks, and GPU submissions after settlement. Failure
includes bounded diagnostics and remaining ownership; it does not release the
host's grant. Force termination has a distinct disposition.

Native acceptance must show both a direct seek without overlap and the held-weight
incoming seek during overlap; a busy third launch; sustained ownership beyond
dwell; on-demand preparation and cancellation; save/reopen; current/candidate peak
reservations during hot replacement; and final cooperative zero ownership. These
are implementation checks on the one usable two-visual result, not added features.

Numeric evidence inspected for this addendum: pinned Three `0.186.0`;
`src/core/RenderTarget.js` defaults; `src/textures/Texture.js` RGBA/unsigned-byte
defaults; `src/renderers/common/Textures.js:89` default depth creation;
`src/renderers/webgpu/utils/WebGPUTextureUtils.js:1642` color mapping, `:1774`
depth mapping, `:1337` depth byte convention, and `:815` readback allocation;
Studio's `capture-png.mjs` and current target construction. These are planning
derivations from source, not measured GPU allocation evidence.
