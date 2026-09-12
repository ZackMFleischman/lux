# Project, scene, and revision model

Status: implementation design, 11 September 2026; none of the contracts below has been implemented or tested. Requirement IDs refer to [the baseline](../requirements.md). This adopts the vocabulary and structured graph recommendation from [the domain proposal](../../plans/domain-and-workflow-proposal.md), using the coordinator's delegated architectural discretion. It does not change the historical source plans.

## Vocabulary and ownership

| Term | Meaning and owner |
| --- | --- |
| Project | Editable collection of scenes, local definitions, looks, assets, and dependency pins. Application core owns saved state. |
| Scene | One complete generative visual with one final image, settings, controls, and eventually an explicit graph. Only the selected studio scene runs by default. |
| Look | Named values, seed, and creative modulation for a scene; no code or topology. Structural alternatives duplicate a Scene. |
| Revision | Immutable accepted project content snapshot. A Scene revision is the stable ID of its content within that snapshot. Undo creates a new accepted head. |
| Component | Reusable definition, implemented as code or a graph, with declared ports, controls, capabilities, and lifecycle. |
| Node | Stable placed instance of a Component; separate values and runtime state. Copying a node creates a new identity. |
| Group | Editor organization; publishing with an explicit interface creates a graph Component. Grouping need not add GPU passes. |
| Asset | Stable identity referring to immutable file bytes plus interpretation and provenance metadata. |
| Library / Package | Searchable catalog / immutable versioned bundle. Use pins exact content into a project. |
| Release | Immutable, self-contained export, including exact code, assets, looks, controls, and runtime requirements. |
| Runtime Instance | Independent execution of a revision, with its own clock, parameters, seed, input state, and output resources. |

This resolves S04 and P02: Looks follow the current editable Scene; a Release freezes their exact definitions. A Look that loses compatible controls reports migration needs rather than silently changing meaning. Historical Look versions remain in revision history. A Project is not a Resolume composition (B01, B03).

## Stage 0.1: small authoring model and durable exports

Tracer needs basic editable scene save/open, immutable candidate bundles and revision checks, plus durable installed releases under [DEC-13](../implementation/tracer-export-scope.md). It does not need a general project browser, library registry, durable undo or graph editor. The authoring scratch registry may live in the application service; installed releases and their complete dependencies must survive its shutdown and load without the source project or Studio.

```ts
type Id<K extends string> = string & { readonly __kind: K };
type SceneId = Id<"scene">;
type RevisionId = Id<"revision">;
type RuntimeInstanceId = Id<"instance">;
type CandidateId = Id<"candidate">;
type JobId = Id<"job">;
type ControlId = Id<"control">;
type Hash = string; // lowercase SHA-256, checked at ingress
type Value = number | boolean | string | number[];
type SourceBundle = {
  entry: string; files: Record<string, string>; sdkVersion: string;
}; // canonical relative module paths; no disk read/write instructions
type OutputSettings = { width: number; height: number; fps: number; seed: number };
type SceneSnapshot = {
  sceneId: SceneId; revisionId: RevisionId;
  parentRevisionId: RevisionId | null; sourceHash: Hash;
  source: SourceBundle; settings: OutputSettings;
  controlSchemaHash: Hash; summary: string;
};
type ScratchScene = {
  sceneId: SceneId; head: RevisionId | null;
  previousWorking: RevisionId | null;
  selectedInstance: RuntimeInstanceId | null;
};
type RuntimeBinding = {
  instanceId: RuntimeInstanceId; sceneId: SceneId;
  revisionId: RevisionId; generation: number;
  owner: "studio" | "host" | "inspection";
  controlSequence: number; clockEpoch: number;
};
```

Entity IDs are opaque UUIDs allocated by the application service (core/supervisor), never names or list positions. `ControlId` is instead a stable declared schema key such as `intensity`; its validation and the distinct native `pluginClientId` policy are in [tracer contracts](tracer-contracts.md). A new renderer generation preserves logical `instanceId` but increments `generation`; reset increments `clockEpoch`. Output-ring replacement has separate `outputGeneration`. A frame identifies runtime/output generations, clock epoch and revision. Source hashes establish exact content; revision IDs establish history and concurrency, so identical bytes after Undo still have a new revision ID. `head: null` permits first creation through the same submit contract.

The shared identity DTO authority is `packages/runtime-contracts/src/index.ts`; `packages/core/src/contracts.ts` imports/reexports those brands and adds application snapshots/jobs. The declarations above illustrate the combined public shape, not a second independently maintained identity definition. Core owns the Scene head transaction; runtime owns completed-frame and instance state.

Tracer source is authoritative for its single opaque visual module. Do not pretend to extract an editable graph from it. In milestone 2, wrap migrated tracer source in one custom Component with declared external ports/controls; expose internal nodes only after explicit decomposition. Shared SDK/runtime code is proposed in `packages/visual-sdk/` and `packages/runtime/`; these directory names do not assert that the GPU transport hypothesis has passed (B04, T09).

## Revisions, parameters, and activation

The [AI contract](ai-authoring.md) checks `baseRevisionId` on queue admission and immediately before commit. One scene-changing job runs per Scene. Validation does not change `head`; successful automatic activation does. UI edits use the same gate. Durable milestone 1 adds a project-wide commit lock for changes touching shared definitions/assets, preventing different scenes from racing a shared dependency.

Candidate compilation and first-frame smoke rendering occur outside the UI process. A validated candidate becomes active at an output boundary only after the previous working revision and rollback information are retained. The core commits the new head and emits one change summary. Build failure, invalid controls, scope violation, conflict, or activation timeout retains the old head and working output. If the candidate later fails, keep its source available, report the fault, and offer restart or restore; a first frame is not a correctness certificate (A01, A02, T06).

Authoring edits of saved base controls create revisions. Slider updates within an open gesture carry a `gestureId`, coalesce live runtime values, and commit once at gesture end; unrelated jobs cannot silently consume uncommitted gesture values. Runtime-only live controls have their own monotonic sequence and do not rewrite source revisions. Captures record actual effective values and the applied sequence, including live adjustments. UI previews and external AI commands agree on whether an operation is a saved edit or a runtime command.

Control compatibility requires stable ID, type, semantic role/units, and valid range. Preserve compatible values by ID; report removed controls and explicit reset/default decisions for incompatible values. Never silently clamp a saved Look or host mapping into a different meaning. Label schema changes that require allocation, compilation, or simulation reset. Renaming the display label alone preserves identity. Published host index assignment is separate, append-only for compatible releases, with incompatible changes requiring explicit replacement/migration (T10, S03, R02).

Runtime recovery resets simulation by default, preserving seed, accepted revision, output settings, and current owner-authoritative continuous controls. Do not replay obsolete triggers. A supported simulation checkpoint is an explicit capability, not an assumption. The background service and host bindings outlive Studio/MCP adapters; closing a UI or MCP stdio stream does not terminate host-owned instances (T05, T11).

In 0.1, every loaded source has an independent instance bound to an installed immutable release, with its own controls and simulation. Explicit export/install transfers an accepted revision into release storage; Studio auto-apply never mutates host playback. Tracer proves the same submitted code in both runtimes, two sources/copies and offline cold composition reopen. Minimum installed packaging is now 0.1; full distribution and later-feature coverage remain milestone 5.

## Milestone 1: atomic durable project storage

Proposed `packages/core/src/project-store.ts` is the sole content writer. Human-readable files are projections of an immutable committed snapshot; the runtime never loads an arbitrary mixture from editable files. One local writer holds an OS-backed project lock; another process opens read-only or reports `PROJECT_BUSY`. Git is optional infrastructure initialized lazily for checkpoints, never the live transactional database (A01, P01).

```text
MySet.lux/
  project.json                  # project identity/schema + committed head pointer
  scenes/<sceneId>/scene.json    # working projection; graph added at milestone 2
  components/<componentId>/     # local code/definition projections
  looks/<lookId>.json
  assets/manifest.json
  assets/blobs/<sha256>          # immutable actual bytes
  dependencies.lock.json        # version + manifest/content hashes
  .lux/revisions/<revisionId>/   # immutable canonical snapshot manifests
  .lux/objects/<sha256>          # immutable code/data objects
  .lux/transactions/<txId>.json  # prepared/committed + old/new heads
  .lux/cache/                    # rebuildable output; excluded from checkpoints
```

Do not promise that renaming multiple files is atomic. Transaction procedure:

1. Under the commit lock, recheck expected project and affected Scene revisions; resolve all references against immutable objects.
2. Write new objects and a complete revision manifest to temporary files on the same volume. Flush file data, verify hashes, and publish immutable files by rename. Write and flush the prepared transaction record.
3. Atomically replace the small committed head file using the selected Windows filesystem's supported replacement primitive. This is the logical commit point; filesystem/power-loss durability is verified on the selected system.
4. Mark the transaction committed, then regenerate working projections. Interrupted projection writes do not change the committed snapshot.
5. On reopen, verify the head and referenced objects. An intact new head finishes projection; an intact old head discards an uncommitted preparation. A missing/corrupt head offers the last verified snapshot and recovery report; it never partially activates a transaction.

External edits to projections are imported as candidates only after complete validation against the current head. Do not auto-load half-written source. Disk full before commit fails without head change. Failure after commit returns the committed revision with a projection/recovery warning; retrying the same request ID returns that result. A startup sweep classifies incomplete transactions before accepting writes.

```ts
type ProjectRevision = {
  schemaVersion: 1; projectId: Id<"project">; revisionId: RevisionId;
  parent: RevisionId | null; sceneHeads: Record<SceneId, RevisionId>;
  objects: Record<string, Hash>; dependencyLockHash: Hash;
  requestId: string; summary: string; createdAt: string;
};
type CommitPrecondition = {
  expectedProjectRevision: RevisionId;
  expectedSceneRevisions: Record<SceneId, RevisionId>;
};
```

Autosave commits successful changes automatically, one AI request per undo step. Undo, redo, and restore validate and create a new head referencing historical content; later history is retained. Redo is available until another edit creates a new branch. Named checkpoints pin a revision; a Git commit may represent a checkpoint but is not a Look, autosave, or backup. Migration writes a new snapshot transaction, keeps the original readable, and rejects unknown newer schemas rather than dropping fields.

Retain all accepted revisions by default in milestone 1; offer explicit history compaction with a size estimate later. Never garbage-collect the current/previous-working head, named checkpoints, undo/redo references, pending job inputs, releases, or retained evidence dependencies. Unreferenced failed candidate/build objects expire after 24 hours and are bounded to 256 MiB per project; active jobs are leased and excluded. If the cap cannot be met, reject new work with `QUOTA_EXCEEDED`. Scratch tracer retains current, previous-working, job-leased and live-runtime-recovery closures, plus bounded diagnostics. Installed releases are durable roots before any Attach and across unrelated Studio revisions and total service restarts. Source-project collection or shutdown cannot remove their closure. Old releases remain installed for saved compositions; updates never silently retarget those compositions. See [host retention contract](tracer-contracts.md).

## Milestone 2: graph data and custom source

The serialized graph is the only authority for composition. Construction code may submit graph data; it is not a second independently editable wiring source. UI rewiring and AI patches operate on the same stable node IDs and graph snapshot. Custom implementation code remains an immutable versioned input to a Component. Stale builders fail revision checks instead of replacing manual changes (G01–G03, P02).

```ts
type NodeId = Id<"node">;
type PortRef = { nodeId: NodeId; portId: string };
type ComponentRef =
  | { kind: "local"; componentId: Id<"component">; contentHash: Hash }
  | { kind: "package"; packageId: string; version: string; contentHash: Hash };
type Graph = {
  nodes: { id: NodeId; component: ComponentRef; values: Record<ControlId, Value> }[];
  edges: { id: string; from: PortRef; to: PortRef; delay: "none" | "previousStep" }[];
  finalOutput: PortRef;
  bindings: { source: PortRef; target: { nodeId: NodeId; controlId: ControlId } }[];
};
```

Port domains include Signal, Event, Image, Field, Geometry/Points, SceneObject/Camera/Material, and schema-defined structured data. Validate units, clock, dimensions, color/alpha representation, ownership, required inputs, and explicit conversions. Shared 3D containment is separate from dependencies. Evaluate a shared dependency once per tick, prune unused branches, and reject same-step cycles; a previous-step edge declares initialized state and ownership. Solver iterations stay internal to the Component. Graph UI layout and selection are not executable graph data.

An ordinary effect returns the complete processed image. Adopt `Particles -> Glow -> Composite`, with Background as the other Composite input, then Color Grade. Do not additionally composite raw Particles; that doubles their contribution. Amount interpolates input/processed output; bypass routes input and avoids unnecessary work. A declared glow-only branch may add emission with zero disabled contribution. Composition uses explicit ordered Over/Add/etc. with linear premultiplied color boundaries; numeric Fields never get automatic color conversion. Component capabilities define simulation bypass/reset behavior and costs (G02, G03).

## Library, assets, and immutable releases

A library use pins package version and content hash, copies required objects into local storage, and verifies them. Missing dependencies give an actionable error; never substitute latest. A scoped node edit of a reused definition creates a project-local override and repoints that node. Editing a shared local definition reports all affected nodes and requires scope encompassing them, otherwise duplicate first. Publishing a library version and updating a project's pin are separate explicit operations. Templates seed independent Scenes without linked inheritance (P01, P02).

Assets register bytes through the same service for import and generation. Validate decoding, dimensions, alpha/color, bounds, and sprite frame layout before committing a replacement. Record content hash, relative path, optional source attribution/prompt/model/seed/reference IDs, and consented reference use. Preserve old bytes while referenced; provider URLs and generation prompts cannot substitute for saved pixels. Credentials remain in machine secret storage. No asset is sent to a provider implicitly. A deterministic atlas tool validates/constructs layouts (M01, M02).

A release builder traverses the accepted snapshot closure and includes actual dependency/asset bytes, selected Looks, exact runtime/SDK constraints, source snapshot hash, and stable control schema/index map. Verify hashes and unresolved references before sealing a manifest. A project archive also collects editable source and dependencies. LFS pointers alone fail completeness checks. Installation copies a new immutable release; explicit replacement changes the host binding. Authoring autosave never mutates installed bytes. Offline playback requires no AI, Studio, Git, provider, or library service (R01, R02).

Machine device choices, secret credentials, window layout, and monitor placement live outside project content (U05, U09). Creative mappings, output dimensions/FPS/seed, and supported simulation resolution belong to Scene/Look content. Preview pane size and fit/zoom never alter render dimensions (U07). Captures, caches, logs, and per-frame state are transient unless explicitly retained as evidence.

## Proposed code ownership and acceptance evidence

| Proposed path | Responsibility / future verification |
| --- | --- |
| `packages/runtime-contracts/src/index.ts` | Shared branded identity and runtime DTO authority, imported by core and renderer. |
| `packages/core/src/contracts.ts` | Reexports identities; owns snapshots/jobs; schema rejects malformed IDs, paths, nonfinite values. |
| `packages/core/src/scene-service.ts` | Scratch revisions, compatibility and activation; invalid candidate retains working head (T01, T06). |
| `packages/core/src/job-service.ts` | Queue, leases and idempotency; concurrent same-base submissions cannot both commit (A01). |
| `packages/core/src/project-store.ts` | Transaction persistence; inject failure before/after head swap and reopen without mixed references (A01). |
| `packages/core/src/graph-service.ts` | Authoritative graph edits and scope checks; alternating UI/AI changes preserve unrelated nodes (G01, P02). |
| `packages/core/src/library-service.ts` | Pins/overrides; updating catalog cannot alter an existing project (P01). |
| `packages/core/src/asset-service.ts` | Validated immutable imports; failed decode/replacement preserves prior asset (M01, M02). |
| `packages/core/src/release-service.ts` | Closure and immutable manifests; offline package uses generated sprite and exact source (R01). |
| `tests/core/revisions.test.ts`, `tests/core/project-recovery.test.ts` | Race, cancellation, disk-full and recovery fixtures; introduced with their milestones. |

Required evidence also includes reopening two independent host instances (T10), runtime failure with current owner values restored (T05/T11), and manual graph edit followed by scoped AI revision. These are future acceptance procedures, not results of this documentation change.

## Filesystem-first authoring clarification — 12 September 2026

User direction: agents are effective in normal coding environments; use that capability rather than requiring all source edits to pass through MCP. This clarifies the milestone-1 storage model, not a claim that directory projects exist in the tracer.

A project exposes ordinary, human-readable TypeScript files and scene/component metadata with stable relative paths. These are supported editable working files, not disposable generated output that Lux may overwrite after an external edit. Keep the accepted immutable runtime snapshot separate: an external editor or agent can edit several files, then explicitly apply the complete candidate. The same validation, revision/conflict checks and last-good-preview behavior apply to Studio edits, filesystem edits and MCP submissions. A watcher may detect changes but must not activate a partially written set of files. Protect dirty Studio buffers and external changes with explicit reconciliation; never silently favor one writer.

Normal coding environments must resolve the pinned Lux SDK and supported Three imports for TypeScript diagnostics, completion and navigation. Supply a usable project configuration and documented validation/build command, consistent with the actual compiler boundary. Filesystem authoring does not expand the submitted-code import allowlist or grant runtime filesystem access.

MCP exposes project/scene identity and source locations, applies an explicit batch, and provides diagnostics, parameters, playback and captures. It remains useful for agents without direct disk access, but is not the mandatory transport for every code edit. Submitted file paths never grant authority outside the selected project. Open questions for the focused implementation plan include the apply-batch boundary, clean/dirty reconciliation and external Git checkout detection.

Git tracks normal source, scene metadata, asset references/content and dependency pins. Runtime/build caches and machine-local state stay out of source history. Agents may use ordinary diff, branch, commit and checkout workflows under user authorization; Lux must reconcile a checkout before activating it. Git commits are deliberate checkpoints, distinct from accepted runtime revisions and editor undo. Existing .lux-scene files must import without losing source, assets or values; retain a portable scene interchange workflow. Resolve project-store recovery so it cannot regenerate old working projections over newer external edits.

Acceptance: open a project in a normal editor/agent environment, resolve SDK types, edit an entry plus helper, inspect a meaningful per-file Git diff, apply the batch and capture the changed preview. Verify invalid/incomplete edits retain the previous preview; concurrent unsaved Studio edits are not lost; commit/checkout/reopen recovers coherent source and values. Import a tracer scene with assets and preserve its behavior. Implement the bounded filesystem/project bridge immediately after tracer completion, ahead of optional UI polish and broader project history/graph expansion.
