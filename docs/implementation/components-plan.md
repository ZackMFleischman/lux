# Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. The coordinator assigns a bounded slice, reviews it independently and serializes merges. Steps use checkbox syntax for tracking.

**Goal:** Make reusable components the normal creative authoring unit, with typed graph composition, independent live controls, and deliberate library reuse.

**Architecture:** Normalize one declaration through the existing numeric parameter policy; preserve code-only scenes. Add explicit versioned executable/graph contracts, one dependency scheduler and filesystem-owned graph transactions before exposing Studio/MCP workflows.

**Tech Stack:** Existing pinned TypeScript 7.0.2, Node 24.12.0, Three 0.186.0, Electron/React/MUI/Dockview, Node test runner. Do not upgrade dependencies for the foundation.

**Spec:** [Component architecture](../design/components.md), [filesystem architecture](../design/filesystem-projects.md), [current roadmap](roadmap.md).

## Global constraints

- Filesystem v1 `kind: 'code'` and single-entry scene formats remain compatible.
- Numeric ControlSchema/SavedControlSnapshot/hash behavior remains unchanged.
- `intensity` is optional concrete visual metadata, never an inserted component control.
- Component declaration keys and port/control IDs are local strings, not project UUIDs or package pins.
- Project references, exact pins, safe writes and durable transactions have one owner: the filesystem project service.
- Generated source executes only inside the existing sandbox/compiler boundaries.
- One scheduler owns graph work; one node does not imply one GPU pass.
- Only implemented behavior appears as available in SDK/MCP/skill discovery.
- Every author-facing SDK, asset/source-rule or MCP change updates the repo skill and runs `node scripts/install-visual-skill.mjs`, then `node scripts/install-visual-skill.mjs --check`.
- CPU development/review can run concurrently; graphics/Studio/Resolume evidence sessions are serialized by the coordinator.
- Small reviewed/tested merges to main are authorized; workers do not merge or push themselves.

## Baseline and dispatch order

Baseline inspected in the component worktree at `409c2d7`; roadmap authorization
was subsequently committed on main as `9f42264`. Before implementation the
coordinator brings this branch forward to integrated main and rechecks status.
Root's baseline typecheck passed; that is baseline evidence, not validation of
future changes. Conductor context returns `registered:false` after process-scoped
Git safe-directory configuration for the sandbox ownership mismatch.

Relevant real files: `packages/visual-sdk/src/sdk-v2.ts`,
`packages/runtime-contracts/src/parameters.{mjs,d.mts}`,
`apps/build-worker/src/parameter-declarations.mjs`, `sdk-selection.mjs`,
`packages/core/src/scene-document.ts`, `apps/studio/src/visual-worker.mjs`,
`apps/studio/src/controls/ParameterInspector.tsx`, `control-state.ts`,
`apps/studio/src/runtime-operations.ts`, and `packages/runtime/src/{clock,seed}.ts`.
Do not substitute the proposed module paths in older design docs for these files.

Only **C01** is ready for immediate implementation after this plan's independent
review. C02–C09 are separately reviewable delivery slices with exact handoff
boundaries, acceptance tests and explicit prerequisites. Their first checkbox is
an interface freeze against the preceding integrated implementation; it must
produce the detailed slice patch/test plan before coding. This prevents freezing
unbuilt GPU and filesystem internals while preserving executable end-to-end scope.

| Slice | Deliverable | Prerequisite |
| --- | --- | --- |
| C01 | Pure declaration normalization and immutable metadata registry | Plan review; independent of filesystem |
| C02 | Executable component SDK/compiler sealing, image/signal resources | C01; explicit SDK/artifact decision review |
| C03 | Pure graph validation and scheduler with resource/lifecycle fakes | C02's closed resource interfaces; shared IDs |
| C04 | Actual worker execution, node controls and structural lifecycle | C03; graphics slot |
| C05 | Versioned graph persistence and scoped core operations | C03; filesystem stage/apply/closure contracts integrated |
| C06 | Graph/Inspector/effect stack and Studio/MCP parity | C04+C05 |
| C07 | Meaningful 3D and corrected effect composition | C04; extends resource variants under review |
| C08 | Library search/reuse, groups, overrides and legacy extraction | C05+C06; filesystem package import/pin |
| C09 | Explicit control publishing, offline graph release and final workflow | C07+C08; installed closure support |

## C01: Declaration and registry foundation

**Files:**

- Create `packages/runtime-contracts/src/components.mjs`: strict pure metadata normalizers/canonical bytes and bounds.
- Create `packages/runtime-contracts/src/components.d.mts`: types for the same exports.
- Create `packages/visual-sdk/src/component-metadata.ts`: typed `declareComponent` helper only.
- Create `packages/core/src/components/registry.ts`: bounded immutable metadata index.
- Create `tests/unit/component-metadata.test.mjs`, `tests/unit/component-registry.test.ts`.
- Create `tests/compiler/component-metadata-types.test.mjs`: real pinned TypeScript compile check, adapting the temporary-directory harness from `sdk-v2.test.mjs`.
- Update this plan's C01 record after verification. Do not edit project contracts, SDK selectors, compiler artifacts, Studio entry points, public SDK exports, package versions or installed runtime.

**Consumes:** `normalizeControlDeclarations`, `normalizeControlSchema`,
`canonicalControlSchemaJson`, `ControlDeclarations`, `ControlSchema` from the
existing parameter module. No dependency on the pending project implementation.

**Produces:** the architecture's `ComponentDeclaration`, `ComponentMetadata`,
`InitialPortType`, `PortDeclaration`, `normalizeComponentDeclaration(unknown)`,
`normalizeComponentMetadata(unknown)`, `canonicalComponentMetadataJson(unknown)`
and typed `declareComponent` signatures. Export `componentMetadataLimits` with
the exact architecture bounds. Registry interface:

```ts
type ComponentRegistry = Readonly<{
  get(key: string): ComponentMetadata | undefined;
  list(): readonly ComponentMetadata[];
}>;
function createComponentRegistry(entries: readonly unknown[]): ComponentRegistry;
```

Registry takes normalized-metadata-shaped input, snapshots via
`normalizeComponentMetadata`, rejects duplicates, lists by ascending key, and
does not expose its mutable Map. Search/filtering belongs to C08.

All exported DTO fields and nested port/type/lifecycle/array/record values are
readonly, matching recursive runtime freezing. Follow the spec's exact text
policy: new metadata labels/descriptions/tags/signal units are nonempty well-formed
Unicode without C0/C1 controls or leading/trailing ECMAScript trim whitespace;
reject instead of trimming or normalizing. Count Unicode code points, retaining
ASCII grammar/counts for keys/IDs. Signal unit is a required `null` or 1–24 code
points; equality is exact. Existing numeric control labels/units keep the
parameter helper's historical trimming behavior unchanged. Cap the raw tag array
at 16 before exact dedupe, then sort tags/record keys by locale-independent UTF-16
code-unit order. Registry aggregate bytes are the sum of canonical entry UTF-8
lengths, with a 1 MiB cap.

- [x] Write the positive fixture and assertions in `component-metadata.test.mjs`:

```js
const declaration = () => ({
  declarationVersion: 1, key: 'lux/glow', label: 'Glow',
  description: 'Adds a controlled halo to an input image.', tags: ['effect'],
  inputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb',
    alphaMode: 'premultiplied' }, label: 'Image', description: 'Complete input image.' } },
  outputs: { image: { type: { kind: 'image', colorSpace: 'linear-srgb',
    alphaMode: 'premultiplied' }, label: 'Image', description: 'Complete processed image.' } },
  controls: { radius: { type: 'number', label: 'Radius', default: 2, min: 0, max: 8, unit: 'px' } },
  controlDescriptions: { radius: 'Width of the halo.' },
  lifecycle: { state: 'stateless', reset: 'seed' },
});
test('metadata preserves existing parameter policy without adding Intensity', () => {
  const source = declaration();
  const metadata = normalizeComponentDeclaration(source);
  assert.deepEqual(metadata.controls, normalizeControlDeclarations(source.controls));
  assert.deepEqual(metadata.controls.map(control => control.id), ['radius']);
  source.inputs.image.type.alphaMode = 'straight';
  assert.equal(metadata.inputs.image.type.alphaMode, 'premultiplied');
  assert.throws(() => { metadata.inputs.image.label = 'Changed'; }, TypeError);
});
test('canonical bytes ignore input record key insertion order', () => {
  const original = normalizeComponentDeclaration(declaration());
  const reordered = Object.fromEntries(Object.entries(original).reverse());
  assert.equal(canonicalComponentMetadataJson(original), canonicalComponentMetadataJson(reordered));
});
```

- [x] Add table-driven rejection cases for unknown version/field, key/path/UUID misuse, unsupported port/event/straight-alpha types, invalid numeric defaults and NaN, unknown or missing control descriptions, unknown lifecycle, symbols, prototype pollution and inherited records. Add own accessor sentinels at outer, controls, port descriptor, port type and tag array index; assert rejection with zero getter calls. Empty controls plus empty descriptions pass.
- [x] Add boundary cases at each count/string/UTF-8 limit and one beyond, including astral Unicode descriptions (512 code points pass, 513 fail), unpaired-surrogate and C0/C1 rejection, empty/whitespace-only/edge-whitespace text rejection, exact key/ID whitespace rejection, 24/25-code-point signal units, null unit admission and omitted/empty unit rejection. Assert no NFC/case folding: distinct admitted Unicode spellings preserve distinct canonical bytes. Existing numeric control labels/units still trim identically to the parameter helper. Verify caller mutation cannot change normalized nested records, registry contents or canonical output. Two equal tags deduplicate after validation, 17 equal tags fail the raw count limit, tag output follows UTF-16 lexical ordering, and duplicate registry keys reject even if metadata is byte-identical.
- [x] Run `node --test tests/unit/component-metadata.test.mjs`; expect missing-module failure before implementation, recording that failure in the worker report.
- [x] Implement plain data descriptor validation without evaluating getters, copying only admitted own enumerable properties. Reject unexpected prototypes/symbols before reading values. Normalize controls with the existing helper and compare exact description membership. Construct frozen output, canonicalize record fields, and enforce canonical UTF-8 byte bounds. Do not import build-worker or filesystem policy into this pure module.
- [x] Add registry tests using two fixture keys with reversed input order: `list()` is sorted, `get()` returns the normalized immutable entry, absent key returns undefined, duplicates and aggregate size/count violations throw, and two separately created registries have no shared mutable membership. Implement the closed-over Map and frozen API.
- [x] Add `declareComponent` with the spec's inferred controls/description-key signature. In the pinned compiler harness, a correct literal compiles; missing `radius` description, extra `intensity` description, wrong control value type and unsupported port literal fail. Assert assignments to `metadata.label`, `metadata.inputs.image.label`, narrowed image-port `type.alphaMode`, `metadata.lifecycle.state`, `metadata.controls[0].default`, `metadata.controlDescriptions.radius` and `metadata.tags.push(...)` all fail as readonly. Replacement of an entire nested record also fails. Keep the type test outside authored SDK selection: import `component-metadata.ts` directly, never claim `@lux/visual-sdk` accepts it yet.
- [x] Run `node --test tests/unit/component-metadata.test.mjs tests/unit/component-registry.test.ts tests/compiler/component-metadata-types.test.mjs tests/unit/parameters.test.mjs tests/compiler/sdk-v2.test.mjs`, then `pnpm typecheck`. Expected: pass. The `tests/unit` glob includes the two new runtime tests; keep the compiler test explicit in the handoff until the coordinator assigns test-runner ownership.
- [x] Review the diff for new public discovery/import claims, runtime side effects, duplicate value policy or pin/UUID authority. None belong to C01. Commit the bounded code/tests and record exact commands/results. No GPU tests or shipped-skill change is needed for an internal metadata helper; C02 owns public delivery and installation.

**C01 handoff:** list created exports, exact bounds, passing output and commit;
clearly say no executable components or graph UI shipped. Independent review must
check hostile metadata handling, canonicalization, readonly snapshots, inferred
types and preservation of numeric-policy behavior before merge.

Verification record (C01 implementation, 13 September 2026 UTC): the exact five-file
focused command above passed 82 tests with zero failures. Both configurations in
`pnpm typecheck` passed using pinned TypeScript 7.0.2. Metadata and registry/helper
tests were run before their modules existed and failed with the expected missing-module
errors; subsequent runs passed. The helper remains internal, with no executable
components, public SDK admission, graph UI, runtime or filesystem-project changes.
Independent implementation review and integration are owned by the coordinator.

## C02: Executable declaration, compiler and closed resources

**Files:** add `visual-sdk/src/sdk-components.ts`,
`runtime-contracts/src/component-runtime.ts`, `build-worker/src/component-declarations.mjs`;
extend `sdk-selection.mjs`, `compile.mjs`, `artifact-identity.mjs`, `link-runtime.mjs`,
runtime contract discriminants, SDK discovery and the repo skill. Add
`tests/compiler/component-declarations.test.mjs`, `component-compiler.test.mjs`.

**Interfaces:** consume C01 metadata; produce `defineComponent({metadata,create})`,
`ComponentInstance` from the architecture and sealed `CompiledComponentArtifact`
with exact SDK/artifact versions, source/bundle/metadata hashes and port metadata.
`InputResources`/`OutputResources` are readonly port-ID maps of closed
`SignalResource | ImageResource` leases; resource identity includes runtime key,
owning node path and lease generation. Image metadata includes dimensions/color/alpha.
`NodeFrame` carries tick/time/delta plus this node's ControlValues and empty events.

- [ ] Freeze an explicit new SDK and artifact discriminant, literal metadata syntax, resource lease constructors and runtime equality check in the slice contract; retain 0.1/0.2 selectors unchanged.
- [ ] Test AST extraction of aliases, duplicate literal fields, getters, calls, spreads and dynamic metadata without running source. Test tampered sealed metadata and runtime declarations disagreeing with compiler metadata are rejected.
- [ ] Implement extraction using shared normalization and the existing bounded compiler/linker. Verify new source works through compiler and browser module loading while legacy 0.1/0.2 fixtures still pass.
- [ ] Run new compiler tests, existing `tests/compiler/sdk-v2.test.mjs`, parameter compiler/identity tests and `pnpm typecheck`. Update/reinstall/check the skill only when actual SDK execution capability is enabled, with partial runtime scope stated.

## C03: Pure graph validation and scheduling

**Files:** add `runtime-contracts/src/graph.ts`, `runtime/src/graph/{validate,plan,scheduler,resources}.ts`; add `tests/runtime/graph-{validation,scheduler,lifecycle}.test.ts`. Shared IDs come from the coordinator-approved identity module; no runtime import from core.

**Interfaces:** `validateGraph(graph: unknown, definitions: ResolvedDefinitions): ValidatedGraph`;
`planGraph(graph: ValidatedGraph): ExecutionPlan`;
`createGraphRuntime(plan: ExecutionPlan, factory: ComponentFactory, resources: ResourceHost): GraphRuntime`.
`GraphRuntime` exposes `update(NodeFrame)`, `evaluate(): Promise<ImageResource>`,
`setNodeControls(NodePath, ControlValues)`, `reset(seed)`, `dispose()`.
ResolvedDefinitions is keyed by core-resolved immutable definition hash, never catalog key.

- [ ] Freeze NodeId/NodePath/PortRef/edge/public-binding DTOs and explicit feedback storage contract; bound graph nodes to 128, edges to 512, nesting to 8 and expanded nodes to 512. Reject expansions exceeding any bound.
- [ ] Test dangling/duplicate IDs, incompatible units/color/dimensions, duplicate input writers, missing required inputs, non-image final output, nested recursion and same-step cycles. Until previous-step storage exists, reject every delayed edge explicitly.
- [ ] Implement deterministic reachability/topological planning with fake resource leases. Diamond fanout executes upstream once; unused branches never create resources; two instances of one definition retain independent counters/values/RNG.
- [ ] Test same-tick multiple consumers, paused control redraw with zero state advancement, reset seed repeatability, partial create failure and once-only disposal after a fake outstanding lease resolves. Implement initialized previous-step read-old/write-next feedback and add accumulator assertions before admitting that edge kind.
- [ ] Run `node --test tests/runtime/graph-*.test.ts` through the shell's actual file expansion or explicit filenames and `pnpm typecheck`; record shared task/pass count assertions, not fabricated GPU timings.

## C04: Worker execution and real per-node updates

**Files:** adapt `apps/studio/src/visual-worker.mjs`, worker control state,
`runtime-operations.ts`, and the corresponding installed/transport runtime loader
identified by the integrated compiler/runtime artifact path; add
`runtime/src/graph/visual-adapter.ts`, `tests/studio/graph-runtime.test.ts`,
`tests/runtime/graph-controls.test.ts`.

**Interfaces:** `createGraphVisual(plan, context): Promise<VisualInstance>`;
node-control request extends existing outer runtime guards with nodePath,
expected definition/schema hash and partial values. Applied sequence remains one
outer monotonic sequence with a per-node effective snapshot in capture provenance.
No native protocol widening without coordinated installed-runtime review.

- [ ] Freeze precise worker-message and structural-control versions, capture metadata and installed capability rejection before touching shared entry points. Plan reallocate/reset/recompile as distinct operations; existing number/live schemas stay unchanged.
- [ ] Test `live` values alter one node without create/reset/compile counters changing, stale node/generation/schema requests fail, paused change produces a new frame with fixed time, and definition removal rejects late callbacks.
- [ ] Integrate the scheduler under the existing loop. Structural resource preparation failures leave active resources and values unchanged. Test unaffected node state remains on local reset/reallocate and complete source/topology candidate promotion reports its full reset.
- [ ] In the coordinator's graphics slot, capture two same-definition nodes with independent radius/speed values, then one live change. Record frame/control provenance and no resets. Run affected CPU runtime/Studio tests and `pnpm typecheck`; do not claim installed graph playback yet.

## C05: Filesystem graph v2 and scoped operations

**Files:** extend the filesystem owner's `core/src/project/{contracts,resolver,service,store}.ts` and add `core/src/components/{graph-document,operations}.ts`; add `tests/core/project-graph.test.ts`, `graph-operations.test.ts`.

**Interfaces:** import its `ComponentRef`, DependencyLock, candidate/inventory/scope
and guarded-write methods unchanged. Produce `readGraph`, `checkGraphPatch`,
`applyGraphPatch` service operations. A patch has requestId, expected project/scene
revisions, declared node/entity scope, saved-intent sequence and operations:
`addNode`, `removeNode`, `connect`, `disconnect`, `setNodeValues`, `setFinalOutput`.
All mutation operations are one filesystem candidate/apply; read/check do not accept.

- [ ] Jointly freeze explicit entity schema-v2 readers, graph file ownership, per-node numeric SavedControlSnapshot placement/default resolution and derived scene closure hashes. Do not add graph fields to v1 or create another writer.
- [ ] Test v1 round trip unchanged; graph save/reopen preserves UUIDs, paths, wiring and independent values; renamed folders preserve identities; incompatible saved values produce per-node migration reports without rewriting raw files.
- [ ] Test stale revisions, a manually changed value followed by an unrelated AI patch, out-of-scope shared definition changes, dirty-buffer conflict and one inactive-scene failure. All rejected candidates retain old head/output and working edits.
- [ ] Implement the operation-to-guarded-draft/candidate adapter, reverse-impact calculation and restart closure integration. Run the new tests plus filesystem stage/apply/recovery suite selected by its owner; merge only after joint review.

## C06: Graph, inspector, effect stack and MCP parity

**Files:** add `apps/studio/src/graph/{GraphPanel,graph-state}.tsx`,
`controls/NodeInspector.tsx`, `graph/EffectStack.tsx`; extend layout registry,
service client, bridge registration and repo skill. Add
`tests/studio/graph-interactions.test.tsx`, `graph-mcp.test.ts`.

**Interfaces:** Studio and MCP invoke C05's same operations and C04's node control
request. Graph viewport/selection/inspector lock are workspace state; node positions
are graph presentation content. Effect-stack actions generate ordinary edge changes.

- [ ] Freeze adapter names and operation schemas with the filesystem/Studio entry-point owner. Expose only supported actions; preserve request deduplication and bounded payloads.
- [ ] Test add/connect/delete and keyboard equivalents, stable inspector lock, deleted-target state, selection leaving final output unchanged, typed-port error messages and effect reorder/bypass through the same graph patch.
- [ ] Implement compact dockable panels and per-node numeric rows sharing existing parameter editing logic; descriptions/costs come from declarations. A saved gesture updates saved intent through C05 and a live-only gesture remains runtime-only.
- [ ] Run affected Studio CPU tests and typecheck. In one serialized Studio/MCP session, manual slider -> scoped AI edit -> save/reopen preserves values and unrelated edges. Verify narrow-pane usability and unchanged preview ownership. Update/reinstall/check the skill.

## C07: Shared 3D units and image effect correctness

**Files:** add `visual-sdk/src/builtins/{particles,deformation,material,lighting,scene-render,glow,composite,color-grade}.ts`, extend closed resource policy/runtime backend; add `tests/runtime/graph-composition.test.ts` and `tests/fixtures/components/` examples.

**Interfaces:** extend C02 resource discriminants with field, geometry/points,
scene-object, camera and material through a new supported contract version.
`ResourceHost` owns immutable/shared inputs and copy-on-write outputs; scene
assembly returns one render pass for compatible object/material/light contributions.
Image effects identify primary input/complete output; wrapper amount/bypass has
declared state policy and is represented in the graph, not inferred by the UI.

- [ ] Freeze exact coordinate/attribute/renderer ownership and resource format compatibility, effect bypass/amount and blend formulas. Keep events/providers outside this slice.
- [ ] Test fake-pass fanout counts and independent simulation state, sharing geometry/material without mutating upstream objects, required explicit conversions and failed resource ownership checks.
- [ ] Implement noisy sphere geometry/deformation/material/light composition and the Particles -> Glow -> Composite(+Background) -> ColorGrade fixture. Independent height/sharpness/rotation/roughness controls must affect implementation.
- [ ] Validate GPU captures: amount 0/bypass equals input within declared measured tolerance; amount 1 equals complete processed output; particles are not double-composited; Over/Add and alpha edges are correct. Record shared simulation count, scene render pass count and actual resource cleanup. Run CPU composition tests and typecheck; graphics evidence is required for creative completion.

## C08: Library reuse, graph publication and legacy extraction

**Files:** add `core/src/components/{catalog,publish,extract,legacy}.ts`,
`apps/studio/src/library/LibraryPanel.tsx`; adapt filesystem package service and
MCP tools/skill; add `tests/core/component-library.test.ts`,
`component-extraction.test.ts`, `tests/studio/library-workflow.test.ts`.

**Interfaces:** `searchComponents({text,tags,compatibleInput,limit,cursor})`,
`inspectComponent(ComponentRef)`, `makeUnique(nodePath)`, `publishComponent`,
`extractGroup`, `wrapLegacy`. Search returns at most 50 entries/page and bounded
metadata; inspect includes exact resolved pins, supported capabilities and example.
Writes use C05 transaction context and filesystem pin/import methods.

- [ ] Freeze local catalog storage/index invalidation, package metadata extension, default/override propagation and extraction ID mapping. Templates copy independent IDs; shared definitions stay explicit.
- [ ] Test deterministic search and port filtering, missing exact package bytes, immutable package tampering, same-version hash mismatch, new publication leaving old lock unchanged and make-unique affecting only the selected node.
- [ ] Implement explicit validated publish and group extraction with typed public ports/control bindings. Static thumbnails plus explicit audition use bounded existing capture/runtime leases; opening Library does not spawn tile renderers.
- [ ] Test legacy SDK 0.1/0.2 single-node wrap preserves source envelopes/assets/controls and compiles through its own SDK closure. Explicitly extract one useful part, preserve intended output with before/after capture and prove new inspector controls work.
- [ ] Run library/extraction/operation tests and typecheck. Record one AI workflow that searches/inspects existing components, reuses them and justifies one missing custom capability; manual changes persist through its patch/reopen. Update/reinstall/check the skill.

## C09: Control publishing, releases and final acceptance

**Files:** add `core/src/components/control-publishing.ts`; extend export package
closure/runtime capability readers and installed graph loading; add
`tests/unit/graph-export.test.mjs`, `tests/core/graph-control-publishing.test.ts`.

**Interfaces:** stable scene public control ID -> `{nodePath,controlId}` mapping,
derived host schema/index map and immutable graph runtime closure. Export consumes
accepted-derived per-node values and exact pins; never raw unvalidated caches.

- [ ] Freeze explicit release manifest/capability version and supported published control types/counts against the actual installed host schema; reject unsupported costs/types instead of dropping them.
- [ ] Test publishing/removal/reorder leaves stable mapping identities, host-only control authority in performance instances, missing pins/assets rejection, byte-complete offline closure and existing code-source export regression.
- [ ] Implement graph export only after independent compatibility review. New releases coexist; authoring/publishing cannot retarget installed releases.
- [ ] In serialized actual-host QA, export a reusable graph source, close Studio and reopen offline with two independent copies. Verify pinned values/state/control bindings and capture provenance. This gate covers source export, not future incoming Resolume effect export.
- [ ] Complete architecture acceptance matrix with links to actual evidence for library reuse, live/structural distinction, independent nodes, AI/manual persistence, legacy extraction, shared 3D work and corrected effects. Run affected CPU suites/typecheck and update/reinstall/check the skill. Record remaining unsupported behavior explicitly.

## Review and integration handoff

For every slice, the worker reports changed contracts, behavior, exact tests and
material limits. Independent review checks spec coverage and implementation;
the coordinator resolves findings, merges serially and brings dependent worktrees
forward. Shared test-runner, SDK/discovery, Studio and project-service edits are
assigned to one owner per merge. Retain existing tracer/experiment evidence.

Planning self-review: each roadmap component expectation maps to C02 (one declared
interface), C03/C04 (identity/lifecycle/scheduling), C05/C06 (manual/AI persistence),
C07 (creative 3D/effects), C08 (reuse/publishing/extraction) or C09 (pins/releases/
control publishing). C01 is deliberately narrower and must not be reported as
completion of the component workstream.
