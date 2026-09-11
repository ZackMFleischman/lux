# Lux domain and creative workflow proposal

11 September 2026. Architectural discussion, not an approved implementation specification.

The accepted direction is AI-authored code and generated image assets, an interactable graph, reusable building blocks, and dynamic playback in Resolume. The ownership and UX choices below are recommendations for discussion.

## 1. Creative workflow and ownership

A Project is a collection of related Scenes, local Components, Assets, and saved looks. Examples include a festival set, a client identity, or a personal collection. It is not a Resolume composition and does not prescribe clip order or transitions.

A Scene is one complete generative visual. It has a graph, published controls, and a default look. It may contain several layers, simulations, cameras, and effects, but exposes one final image in the first release. Only the selected scene runs in the studio by default.

A Look is a named set of scene control values, seed, and modulation settings. It does not change graph topology or code. A structural variation is a duplicated Scene. A scene edit affects its looks; incompatible controls must be reported. A release freezes the exact scene revision and looks used by the show. This replaces the ambiguous mixture of visual, scene, variant, and revision in the original plan if accepted.

A Component is a reusable definition with typed ports and controls. Its implementation is code or a graph of components. A Node is one placed instance of a component, with its own identity, settings, and runtime state. A Group organizes nodes; it becomes a reusable component when given an explicit interface and saved to the library. Grouping alone does not add a render pass.

An Asset is a saved image, sprite sheet, video, font, model, audio recording, or other supported file. A sprite's frame layout and pivot are metadata associated with the image. Generated media uses the same asset system as imported media.

The Library is a searchable view of built-in, project-local, and reusable personal components/assets/scene templates. It is not a mutable global dependency that every project follows. A Package is a versioned bundle of reusable items. The initial product can have one local personal library without an online registry or marketplace.

A Release is an immutable, self-contained performance export of selected scenes and looks, with exact component versions, assets, control schema, and runtime requirements. It is the delivery unit for a show. A Runtime Instance is one running copy, such as a source loaded in Resolume, with independent control and simulation state.

Suggested VJ flow: create a project; build several scenes; audition and save looks; promote useful components/assets to the library; select scenes and looks for export; install the release; arrange and perform with those sources in Resolume. Later editing affects the project, not that release. Updating an installed show is explicit.

## 2. Graph language

Use one component/node mechanism. Source, effect, simulation, renderer, converter, and controller are capabilities or catalog categories, not separate ownership hierarchies.

A Port is a named typed input or output. A Connection connects compatible ports. A Control is an editable setting; continuous controls may have signal bindings and event controls accept events. The graph must preserve these bindings as explicit relationships.

Initial data domains:

| Domain | Meaning and examples |
| --- | --- |
| Signal | Time-varying scalar, vector, color, or other supported value; envelope, LFO, spring output. Sample rate and clock are explicit when it is a sampled stream. |
| Event | Timestamped discrete occurrences with optional typed payloads; burst, reset, collision. Events are not booleans polled once per frame. |
| Image / Field | Image is color with color-space and alpha metadata. Field is numeric spatial data such as velocity, density, mask, or depth. They may share storage, but color transforms must not silently change numeric data. |
| Geometry / Points | Mesh or point data with named attributes, topology, transforms, and declared mutability. |
| Scene object / Camera / Material | Resources assembled in a shared 3D world and consumed by a render component. Containment is distinct from data dependencies. |
| Structured data | Schema-defined records, tables, or arrays used by custom systems; not unrestricted mutable objects shared across nodes. |

Connections carry enough information to validate format, dimensions, coordinate space, units, clock, and ownership where relevant. Conversions are explicit components or explicit visible adapters. GPU-resident data should remain on the GPU unless a declared conversion requires a bounded readback. This does not promise every conversion or backend in the first release.

A component can expose multiple outputs. It declares initialization, evaluation/update, reset, and disposal behavior. Stateful components declare simulation timestep, reset requirements, and which changes invalidate their state. The runtime schedules a shared dependency once per tick, treats previous-step feedback explicitly, and allows internal solver iterations without treating them as scene-graph cycles.

Prefer immutable outputs or explicitly owned mutation. A component must not unexpectedly deform another branch's shared geometry. Clock advancement belongs to the runtime, not each consumer.

Fluid-driven particles and image-driven geometry are compositions, not new fundamental domains. Fluid, particle advection, image sampling, and mesh displacement can be reusable components. The fundamental requirements are typed fields, points, sampling/conversion, multiple outputs, and state scheduling.

## 3. Code and graph are one editable project

Recommend structured composition plus custom code. The AI submits a graph through a construction API, and writes versioned implementation code for custom components. Builder calls record stable node IDs, ports, connections, and bindings; the accepted graph is serialized as project data.

The UI and AI operate on that graph through the same application operations. The AI reads the current graph and component source before revising them. Editing a graph must not require reconstructing the source of an arbitrary JavaScript function. Re-running a stale builder must not erase manual graph edits.

Do not store independently authoritative composition code and graph files and attempt unrestricted bidirectional synchronization. Custom component code remains code; the composition graph is the saved authoritative wiring. Construction code is an authoring input or reproducible export, not a second mutable source of truth. General procedural generation can live inside a component; expose stable semantic parts rather than one node for every particle or repeated object.

Alternative: source-authoritative code with UI overlays. It makes arbitrary code authoring easier initially but complicates structural edits and reconciliation. Full arbitrary-code round-tripping is the highest-complexity alternative and is not recommended.

Use progressive detail: a scene-level graph shows meaningful systems; expandable graph components reveal their internals; custom code components expose declared ports, controls, diagnostics, and code. Do not fabricate inspectable internal nodes that the implementation has not declared. Keep semantic graph structure separate from optimized GPU passes.

## 4. Agreed minimal AI-edit UX

Agreed default: an AI request creates one candidate change; build and basic validation happen off the UI thread; a successful candidate appears automatically in the studio preview; a visible summary and one Undo action cover the request. Failed candidates leave the previous working visual available. A first frame is a smoke test, not proof that a candidate is correct forever. Later runtime failures offer restart or restore of the previous working revision.

Alternative: show a candidate preview with Keep and Discard. This gives more deliberate comparison but adds a confirmation step to every iteration. The user selected automatic preview plus Undo; Keep/Discard is not the default.

Use serial scene-changing jobs initially. Edits identify their starting revision; if the scene changed while an AI job ran, report the conflict and retry/rebase deliberately. Group slider drags and multi-file AI changes into meaningful undo steps. Keep compatible controls, and show when an edit requires a simulation reset.

If the user requests an edit to one node, the operation should reject changes outside that scope. This is a local edit contract, not a roles/permissions product. Read context can remain broad. A node using a shared library component gets a project-local override by default; publishing an update to the library is a separate action.

Autosave preserves work without a Keep ceremony. Named checkpoints let users mark useful states. Undo history, autosave recovery, named looks, and Git commits serve different purposes and should not be presented as the same thing.

## 5. Compositing recommendation

An ordinary effect returns the complete processed image. Its amount blends input with processed output; bypass selects the input and skips avoidable work. The basic graph is Particles -> Glow -> Composite, with Background feeding Composite separately. Do not also feed raw Particles into that same Composite.

Use linear-light, premultiplied-alpha images at composition boundaries, with explicit conversion for imported assets and host output. Composite names its operation: Over, Add, Multiply, etc. For Over, foreground/background order is explicit. Additive emission and HDR values are supported intentionally rather than clamped accidentally. A dedicated glow-only output may be offered when the artist wants an additive branch; that branch's disabled contribution is zero emission, not pass-through particles.

Test zero glow against the no-glow image, partial transparency over a colored background, foreground order, HDR highlights, and the Resolume boundary. A simulation may reset or preserve state on bypass according to its declared behavior; effect amount zero and bypass need not have identical state costs.

## 6. Library and versioning

Start every scene with project-local definitions and pinned library dependencies. The AI can search by intent, inspect metadata, ports, controls, examples, and code, then reuse or author a component. A library item can include previews and a small working example to improve discovery.

Add to Library publishes a version. Using a library item pins that version in the project lockfile. Copies in the library cache are not edited in place. Editing a reused component creates a local override; publishing a new version and updating dependent projects are explicit. A changed shared definition lists the affected scene nodes; duplicate the definition when only one node should change.

A look follows its scene's working definition. If a user wants to preserve a structurally different version as another editable idea, duplicate the scene. Library scene templates seed independent scenes with pinned dependencies. Do not implement linked inheritance between scene templates in the first release.

## 7. Saving, Git, and assets

Recommend a normal project folder with scenes, graph data, custom component code, looks, asset manifests/files, a project manifest, and a dependency lockfile. Store graph layout separately from executable graph data where practical to reduce noisy diffs.

Use a local Git repository per project by default, behind the UI. Initialize it lazily when creating the project or enabling history; never require GitHub, a remote, a branch workflow, or a commit for every slider movement. Save writes atomic project changes and a recoverable transaction record; Git is the durable checkpoint/share layer. A crash during a multi-file AI change must not leave a graph referencing missing code or assets. Restoring a checkpoint creates a new current state without deleting later history.

A personal library can be a separate local package folder, optionally backed by its own Git repository. Avoid Git submodules in the initial creative workflow. The project resolves exact library versions into a local cache; a portable project archive and performance release collect the exact required files. Opening an unavailable dependency must produce an actionable missing-dependency message, never silently select the newest version.

Track code, graphs, manifests, looks, and stable IDs in ordinary Git. Small images can be ordinary tracked files. Adopt Git LFS for large/changing binaries when that workflow is needed; LFS pointers alone are not a portable project or show. Export must verify that every required binary is actually present. Exclude caches, transient captures, build products, model credentials, and per-frame simulation state from normal commits. Keep named evidence captures only when requested.

Git history is not a backup until copied or pushed elsewhere. Provide an explicit project archive including dependencies/assets; remote sync can follow later. Exported playback requires neither Git nor the library service. A release manifest records the exact source snapshot hash even if it was exported from uncommitted, validated work.

## 8. AI-generated images and sprites

Provide discover -> generate/edit or import -> inspect -> register -> connect -> render -> revise as an asset workflow. The model may use an external generator, a connected tool, or a future embedded provider. Lux owns the durable import/validation/reference contract rather than assuming one image provider.

Asset records include stable identity, content hash, relative path, dimensions, alpha/color metadata, and optional sprite layout. Preserve prompt, model/provider, seed when supplied, and source/reference attribution when available. Generation metadata is provenance, not a promise of reproducibility: the saved pixels are authoritative.

Generation jobs are cancellable and report status. Failed jobs keep the previous asset. Generated replacements create a new asset revision; do not overwrite files used by an existing release. Show final composited results to the AI so it can evaluate sprite scale, edges, transparency, and motion. An atlas packer is a deterministic tool; do not rely on a model to generate perfectly aligned animation sheets. Validate any claimed frame layout.

Do not send project images to a generation provider as an incidental background operation. Use references the user selected or authorized as part of the requested generation. Store credentials outside projects and exports.

## 9. Acceptance examples

Use the inspected Loom checkout (bbc6e81d8f6609486f12aa0a303a23a30d46760d; local live scene/settings changes were present) as source evidence, not proof of runtime performance.

- Pho Nebula: nested image branches, asset references, selected-branch effects.
- Rutt-Etra / Attractor Cloud: geometry dependencies, shared scene, camera, post-processing.
- Slime Veins / Smoke Signals: stateful fields, internal iterations, separate simulation resolution, diagnostics.
- Geo Wars: one shared simulation feeding several renderers and events.
- Spring Rave: inspectable signal chains and repeated objects.
- Camera Ghost: external media lifecycle and recorded substitute input.

Add fluid-driven particles, image-driven geometry, and a custom component edited alternately through AI and the graph. These are coverage tests for the abstractions, not mandatory new base classes. In the edit test, verify that manual connections, independent instances, controls, and unaffected simulation state survive the next AI revision. Add generation of a transparent sprite, import, rendering, revision, and offline export.

## 10. Resolume delivery decisions

A Lux Scene becomes a source available to a Resolume clip; a Look provides its initial controls. The Resolume composition owns show arrangement, mixing, shortcuts, and host modulation. An installed release does not change when the authoring project changes.

Prefer one maintained native bridge implementation, but resolve source registration and control-schema discovery in the 0.1/0.2 tracer. A generic plugin that loads arbitrary packages and thin per-scene native wrappers are candidates; do not promise a host mechanism before proving it. Every loaded copy has independent state, even when immutable code/assets are shared.

Host controls are authoritative for published values during performance. Lux-internal modulation can drive internal controls; the binding model must specify base/macro/modulation order and avoid applying the same audio response twice. Richer spectrum inputs need their own supported host/input contract.

On recovery, restore host values and reset the simulation unless the component explicitly supports a checkpoint. Pixel-perfect continuation after a crash is not the default requirement. Use transparent black before the first frame and the last completed frame during a temporary outage, with connection status visible outside the render callback.

## 11. Open decisions

1. Resolved: automatic preview plus Undo; exports stay fixed until explicitly replaced.
2. Accept Scene / Look / Component / Node / Asset / Library / Release terminology?
3. Accept structured graph data plus custom code as the saved source of truth, rather than arbitrary composition-source round-tripping?

Resolve these before merging this proposal into the main design and producing an implementation plan.

Sources: local Loom source review; Resolume vocabulary https://www.resolume.com/support/en/vocabulary ; Git LFS https://git-lfs.com/ . These sources support the comparison; the architecture above is a proposal.