# Components, graph execution and library reuse

Status: proposed architecture for the authorized component workstream, 13 September
2026 UTC. This document and [the staged plan](../implementation/components-plan.md)
are preparation for independent review, not evidence of delivered graph support.
The current [roadmap component requirements](../implementation/roadmap.md#component-authoring-and-runtime-control-milestone-2)
define the outcome. Workstream authorization is committed on main at `9f42264`
and integrated into this worktree; preserve it when integrating these files.

## Decision and baseline

Use a declared component interface, a serialized graph as the sole wiring
authority, and one runtime scheduler below the existing visual instance boundary.
A component is reusable implementation; a node is one placement with independent
values and state. Three.js/TSL remains useful inside components. A particle system,
deformation, material, lighting rig or image effect is a useful creative unit; each
Three operation does not need a node.

Three approaches were considered:

1. **Declared components plus a data graph (recommended).** Reuses the existing
   parameter policy, allows scoped UI/AI edits, and keeps pass scheduling independent
   of editor node boundaries. Requires explicit graph/runtime integration.
2. **Compose only through TypeScript helper calls.** Cheap code reuse, but cannot
   preserve manual wiring or expose stable placed identities without a second
   authority. Keep helpers inside components, not as the graph representation.
3. **Treat every component as a full rendered image.** Easy initial chaining, but
   prevents shared 3D/depth work and imposes unnecessary render passes. Use image
   boundaries only where the declared operation needs them.

The real baseline is SDK 0.1 and 0.2, not the historical future sketches in other
design documents. `sdk-v2.ts` has `defineVisual`, inferred numeric declarations,
and `create/update/render/reset/dispose`. `parameters.mjs` owns normalization,
defaults, strict patches and ID/unit/range reconciliation. The compiler reads
literal metadata without executing authored code and seals artifact v3 control
metadata. Studio already exposes live sliders, frozen-time redraw and saved
`SavedControlSnapshot`. BMP, PNG and JPEG are supported. The pinned SDK selector
still admits only 0.1.0/0.2.0. `visual-worker.mjs` owns the actual update/render
loop; the installed/transport path also has runtime integration to preserve.

At the pre-C01 baseline there was no component registry, typed graph evaluator,
per-node inspector, directory-project writer or general library service in this
checkout. C01 adds only the CPU declaration/registry foundation. It does not
add generated-source imports, executable component factories, new artifact
versions, runtime support flags or UI claims before those paths work.

## Shared ownership with filesystem projects

[Filesystem projects](filesystem-projects.md) owns physical roots, inventories,
revision transactions, local definitions, dependency locks and safe working-file
writes. Its v1 `kind: 'code'` component and single-entry scene remain byte-format
compatible. Neither a metadata registry entry nor a helper file becomes a project
entity implicitly. No duplicate project manifest or independent graph database is
introduced.

| Contract | Owner and use |
| --- | --- |
| Project/Scene/Component/Asset UUIDs | Filesystem contract slice owns neutral `runtime-contracts/src/identities.ts`, imported/reexported by core; the coordinator assigned this ownership before dispatch. |
| `ComponentRef` | Filesystem `project/contracts.ts`: local component ID or package ID/export ID. Graph imports it verbatim. |
| Exact package version/hash | Existing planned `DependencyLock.packages`; do not repeat editable version/hash in every node. |
| Resolved definition hash | Core's accepted closure derived from the reference, source, metadata and exact lock. Runtime uses the derived hash, never a mutable catalog alias. |
| `NodeId` | New UUID in shared identities at graph integration; stable within its graph, copied nodes get new IDs. |
| `PortId`, `ControlId`, declaration key | Bounded declaration-local strings, never entity UUIDs or filesystem paths. |
| Saved values | Reuse core `SavedControlSnapshot` for numeric v1 graph node intents; raw intent and accepted-derived effective values remain separate. |
| Runtime identity and controls | Existing `RuntimeKey`, generation and scene revision remain outer guards. A structured node path adds addressing, not a new runtime owner. |

The older `project-model.md` graph sketch embeds mutable reference hashes and
versions directly in nodes. For directory projects, the filesystem reference/lock
split above supersedes that sketch. Pinning a newer package is a checked project
candidate. The stage-1 one-version-per-package-ID rule remains; simultaneous
versions need a separately reviewed lock extension, not hidden resolver aliases.

## First declaration contract

Proposed new files: `runtime-contracts/src/components.mjs` and `.d.mts` for pure
data policy, `visual-sdk/src/component-metadata.ts` for the typed helper, and
`core/src/components/registry.ts` for an immutable bounded catalog snapshot. They
contain no filesystem or GPU access and import the existing parameter policy.

```ts
type InitialPortType =
  | { readonly kind: 'signal'; readonly value: 'number'; readonly unit: string | null; readonly clock: 'frame' }
  | { readonly kind: 'image'; readonly colorSpace: 'linear-srgb'; readonly alphaMode: 'premultiplied' };
type PortDeclaration = {
  readonly type: InitialPortType; readonly label: string; readonly description: string;
};
type ComponentDeclaration = {
  readonly declarationVersion: 1;
  readonly key: string; // e.g. lux/glow; metadata name, not identity or a pin
  readonly label: string; readonly description: string; readonly tags: readonly string[];
  readonly inputs: Readonly<Record<string, PortDeclaration>>;
  readonly outputs: Readonly<Record<string, PortDeclaration>>;
  readonly controls: ControlDeclarations;
  readonly controlDescriptions: Readonly<Record<string, string>>;
  readonly lifecycle: { readonly state: 'stateless' | 'stateful'; readonly reset: 'seed' };
};
type ComponentMetadata = Omit<ComponentDeclaration, 'controls'> & {
  readonly controls: ControlSchema;
};
function normalizeComponentDeclaration(input: unknown): ComponentMetadata;
function normalizeComponentMetadata(input: unknown): ComponentMetadata;
function canonicalComponentMetadataJson(input: unknown): string;
function declareComponent<const C extends ControlDeclarations>(
  declaration: Omit<ComponentDeclaration, 'controls' | 'controlDescriptions'> & {
    readonly controls: C;
    readonly controlDescriptions: { readonly [K in keyof C]: string };
  }
): ComponentMetadata;
```

All controls retain the existing number/live contract and bounds. Require exactly
one description for each declared control, no extra keys. Empty controls are
valid; `intensity` is never inserted. Ports initially describe required single
inputs only; no implicit conversion, optional/default input, event delivery or
resource allocation is claimed. Image dimensions are runtime values checked when
connecting actual resources, not inferred from the image type alone.

Metadata validation rejects unknown fields/versions, accessors without invoking
them, symbols, inherited records, duplicate IDs, invalid names and
nonfinite control data. Normalized records and arrays are recursively frozen.
Their public TypeScript output types are deeply readonly, including port types,
lifecycle, record values and arrays; compile tests reject nested mutations.
Sort record keys and deduplicated tags by ascending UTF-16 code-unit order
(locale-independent JavaScript string comparison) for canonical serialization; preserve
control presentation order consistently with `canonicalControlSchemaJson`.
Only trusted callers hash returned canonical bytes. A metadata hash alone does
not prove executable implementation identity or runtime support.

Canonical JSON uses fixed schema field order for DTOs and UTF-16 lexical ordering
for dynamic input/output/control-description record keys and deduplicated tags.
The top-level field order is `declarationVersion`, `key`, `label`, `description`,
`tags`, `inputs`, `outputs`, `controls`, `controlDescriptions`, `lifecycle`.
Port descriptors use `type`, `label`, `description`; image types use `kind`,
`colorSpace`, `alphaMode`; signal types use `kind`, `value`, `unit`, `clock`;
lifecycle uses `state`, `reset`. Control rows retain exactly the field order and
presentation order from `canonicalControlSchemaJson`, including its optional
fields. This is the C01 canonical byte contract; it does not create public
metadata pins or executable identity.

Bounds: 128 registry entries, 16 inputs and 16 outputs per component, existing
32 controls, 16 tags of at most 32 Unicode code points, keys at most 96 ASCII characters matching
`^[a-z][a-z0-9-]*/[a-z][a-z0-9-]*$`, local port IDs use the existing control-ID
grammar and exclude `constructor`, `prototype` and `__proto__`, labels at most
80 Unicode code points, descriptions at most 512 Unicode code points,
64 KiB UTF-8 canonical metadata per entry and 1 MiB per registry. These are
admission bounds, not measured performance. Registry construction snapshots every
entry, rejects duplicate keys even for identical entries, and never mutates
global state. A later accepted-project adapter maps resolved references to these
declarations; it does not resolve pins through display keys.

For new component/port labels, component/port/control descriptions, tags and signal
units, require a well-formed Unicode string (`String.isWellFormed()`), reject C0/C1
control characters (`U+0000–001F`, `U+007F–009F`), empty strings and leading/trailing
ECMAScript `trim()` whitespace. Count code points with `[...value].length`, not
UTF-16 units or UTF-8 bytes. Preserve admitted text exactly: no trimming, Unicode
normalization or case folding. IDs and declaration keys must match their ASCII
grammar exactly; whitespace is rejected, never repaired. A signal's required
`unit` field is either `null` (no unit) or 1–24 code points using the same new-text
policy; omission and empty text are errors. Unit compatibility is exact string
equality, with `null` equal only to `null`.

Apply the 16-tag count cap to the raw dense input array before deduplication,
validate each tag, deduplicate by exact string equality and then sort as above.
Canonically distinct Unicode spellings remain distinct tags/text. The registry's
1 MiB aggregate cap is the sum of its entries' canonical UTF-8 byte lengths.
Existing control labels/units continue through the unchanged parameter helper,
which trims them and enforces its established code-point/control-character rules.
This explicit compatibility exception does not authorize trimming new metadata
fields or silently changing existing ControlSchema hashes.

## Executable definition and typed resources

A later explicitly pinned SDK component entry adds `defineComponent` around the
same metadata, with an isolated factory. Its first executable version uses a new
SDK version and artifact discriminant; do not loosen 0.2's sealed literal shape.
Compiler extraction and runtime definition verification must agree before enabling
discovery. Metadata is read from syntax, never by importing code into core.

The execution interface is:

```ts
interface ComponentInstance {
  update(frame: NodeFrame): void;
  evaluate(inputs: InputResources, context: EvaluationContext): Promise<OutputResources>;
  reset(seed: number): void | Promise<void>;
  dispose(): void | Promise<void>;
}
// NodeFrame: existing tick/time/delta/events semantics plus this node's values.
// InputResources/OutputResources: readonly port-ID maps of typed runtime leases.
// EvaluationContext: runtime-owned resource/pass builder, never desktop handles.
```

Before implementing this interface, add closed resource variants and constructors
alongside their runtime implementations: signal (unit and clock); image (dimensions,
linear premultiplied color); field (numeric channels, grid and coordinate space,
no automatic color conversion); geometry/points (attributes and coordinate space);
scene object, camera and material (same renderer ownership/coordinate contract).
Events and arbitrary structured data remain rejected until their own schema,
clock and provider contracts exist. Milestone-0.3 input transport is not implemented
by this component workstream.

Resources are opaque leases owned by a node/runtime. Consumers cannot mutate a
shared upstream resource. A transform makes a new logical view/resource or requests
copy-on-write through the runtime. Scene containment is not a dependency edge.
Object/material/lighting contributions enter one scene assembly and one camera
render pass when compatible. A node's existence must not force a pass or duplicate
simulation. Deformation before lighting shares geometry/depth in 3D; glow after
camera rendering is an image effect. Tests must prove both paths.

## Graph identity, persistence and groups

Graph support is an explicit scene/component schema-v2 extension reviewed with
the filesystem owner. v1 documents continue through their existing path and are
not rewritten on open. The v2 scene keeps scene identity, settings and an
`implementation: ComponentRef`; it refers to a graph component. A v2 graph
component owns its graph file and public interface. A v2 code component owns
source metadata plus its new SDK pin. The directory project's registry can admit
these new entity versions only after its versioned readers and closure logic do.

Graph content uses `nodes[{id, component}]`, `edges[{id,from,to,delay}]`,
`finalOutput`, and explicit public input/output/control bindings. The scene owns
`nodeControls[{nodePath,savedControls}]`, using the existing snapshot type for
numeric/live values. Graph definitions additionally carry default node intents
so publishing a group reproduces its configured example. Scene overrides win;
missing overrides derive definition defaults. A `nodePath` is a readonly array
of UUIDs through graph instances, never concatenated unescaped strings. Moving,
renaming or reordering a node preserves its identity; duplicating allocates one
new outer ID and copies values, never mutable simulation state. Distinct placed
graph instances naturally have distinct outer paths.

On apply, resolve every node against the candidate and lock; reconcile saved
numeric values by existing ID/type/unit/range policy and report migrations per
node path. A stale cache source hash is provenance, not a rejection by itself.
Store raw intent unchanged and accepted-derived hashes/schemas/effective values
separately. Graph references, node values, layouts and package updates enter the
filesystem inventory and one checked project transaction. Live gestures are not
silently saved; completed saved gestures follow its guarded write/apply path.

Graph positions and organization groups are separate editable presentation data.
Grouping allocates an editor group ID and no execution work. Publishing a group
is explicit extraction: declare its public interface, allocate a component ID,
remap internal references and replace selected nodes atomically. Persist an ID
mapping so scope/history/selection can explain the transformation. No implicit
interface is guessed from arbitrary code. Graph-component recursion is rejected.

## Scheduling, lifecycle and control behavior

One scheduler flattens nested graph instances into structured node paths. Validate
references, required ports, type metadata, duplicate destinations, resource
ownership and final image output before runtime preparation. Prune unreachable
branches. Topologically schedule each reachable same-step dependency once; tie
break by stable node path. Caching keys include runtime generation, node path,
definition identity, tick/clock epoch, inputs and effective control sequence.
Never share mutable state between two nodes merely because their definitions match.

Explicit previous-step feedback requires initialized storage, typed ownership and
read-old/write-next ordering; reject feedback until this store is implemented.
Solver iterations stay internal. The scheduler consumes the existing clock;
it does not create another timer or silently add a fixed-step/overload policy.
While paused, live changes evaluate invalidated presentation at frozen time with
zero simulation advance. Same-tick fanout and multiple output consumers cannot
update a stateful node twice. Resource/pass traces count shared work once and
attribute consumers separately.

Each instance has deterministic independent RNG seeded from scene seed and its
full node path using a documented stable derivation. Reset affects the declared
target and dependent state that explicitly requires resetting; full scene reset
retains current values and resets all reachable state. Removal/disposal occurs
once after outstanding GPU/capture leases complete, including partial creation
failures. Reordering and live updates retain state. Topology/source replacement
initially prepares a complete candidate graph and resets simulation after successful
promotion; disclose this cost. Cross-revision state transfer is not implied.

| Change cost | Required behavior when implemented |
| --- | --- |
| `live` | Patch node values at a frame boundary; no compile, create or reset. Frozen-time redraw works. |
| `reallocate` | Prepare replacement resources outside active state, swap after validation/leases; retain unaffected nodes. |
| `reset` | Reinitialize declared affected simulation with current seed/values; report the reset before committing saved intent. |
| `recompile` | Checked candidate compilation/smoke/promotion; prior graph remains on failure. |

Only `live` is admitted initially. A later versioned control extension adds the
other costs plus bool/enum/vector/color where needed; it must preserve numeric
v1 saved snapshots and hash domains rather than widen existing schemas silently.
Declare capabilities for each implemented behavior. Structural labels without
matching runtime behavior fail the release gate. User-facing controls must visibly
affect an example: metadata cannot prove semantic consumption of arbitrary code.

## Effects, publishing and library workflow

An effect input/output contract names one primary image input and complete
processed image output. Amount is a finite [0,1] wrapper control: linear mix of
input and complete processed output. Bypass selects input without evaluating the
effect branch. For stateful effects, require an explicit freeze/reset-on-enable
policy; no hidden simulation continuation. A separately declared emission-only
effect has zero contribution when disabled. Reordering the effect stack changes
the same graph edges through core operations, not a parallel stack model.

Acceptance composition is Particles -> Glow -> Composite with Background as the
other Composite input, then ColorGrade. Do not composite raw Particles again.
Over/Add mode is explicit and uses linear premultiplied image math. Amount 0 and
bypass reproduce input; alpha tests include transparent and partial-alpha edges.
This is processing within a Lux visual, not incoming Resolume effect export.

The library is a bounded local index over validated package metadata and project
definitions. Search by text, tags, port compatibility and capabilities; inspect
the exact interface, lifecycle, required pins/assets and working example before
placing. Static thumbnails and explicit bounded audition avoid continuous tile
renderers. Missing capability allows a custom local component; record why in the
authoring result, without claiming semantic-duplication detection.

Publishing explicitly validates interface, lifecycle, closed source/assets and a
working example, then writes a new immutable package through the filesystem
package service. A new version does not update existing project locks or releases.
Local customization of a package creates an override and repoints the selected
node; shared local edits expose all affected scenes/nodes and require matching
scope. There is no network marketplace or automatic experiment publication.

Eligible numeric live controls can be explicitly published to stable scene-level
control IDs mapped to `{nodePath,controlId}`. Display labels are not addresses.
Reuse the existing host control schema/index and authority limits; reject excess
or structural/unsupported control types with an explicit compatibility report.
Never flatten arbitrary node IDs into unstable host indices. Graph export needs a
new immutable runtime closure and actual offline tests; keep current code-only
export working and reject unsupported graph export until that gate passes.

## UI/AI parity and migration

Graph panel, node inspector, effect stack and library use shared core operations:
read/search/inspect, add/remove/connect, set node values, make unique, group/extract,
pin/publish and publish controls. A transaction names expected project/scene heads,
node scope, saved-intent sequence and request ID. Core validates the actual resolved
diff; UI selection/capture scope never grants edit authority. Manual values and
unrelated wiring survive the next scoped AI edit. A stale patch fails with current
identity information; do not silently rebuild a whole graph from an AI script.

Inspector follows selection or a stable lock. Selecting nodes does not change final
output; explicit inspection does, with a clear return-to-final action. Initially
only supported image-port inspection is enabled; analytical sampling and input
providers remain their roadmap workstreams. Compact Library/Graph/Inspector panels
join the existing shell; broad multi-view polish is separate.

Legacy v1/v2/v3 `.lux-scene` documents and filesystem v1 code scenes stay usable.
An explicit wrap transaction creates one custom code node, preserves SDK/source
envelope/assets/external controls and records identity mapping. A legacy node is
an opaque image source; its renderer access is contained by an adapter, with one
owned offscreen target when mixing requires it. A further extraction deliberately
rewrites source into a reusable component, exposes meaningful controls and checks
the intended output with before/after captures. Wrapping alone does not fulfill
decomposition. Older SDK code is compiled separately by its supported compiler
entry; do not mix SDKs in one flattened source closure.

## Acceptance and delivery boundaries

The staged plan assigns foundation, executable metadata, pure graph validation,
scheduling, project transactions, Studio/MCP workflow, 3D/effects and library/export
coverage to separately reviewed merges. CPU fixtures prove declarations, identities,
transactions and fake-resource scheduling. Serialized actual graphics sessions
prove visible control consumption, shared 3D composition, effect pixels and old
output retention. Offline installed playback is its own gate.

Required final scenarios: library-first AI composition; live versus structural
control behavior; two independent instances; manual/AI/save-reopen parity; explicit
legacy wrap then extraction; corrected branched image composition; shared simulation
and one 3D render pass; old pins after new publication; invalid/stale edits retaining
the working visual. No slice may advertise these later outcomes based only on
metadata validation. Every author-facing SDK/MCP/source-rule change updates the
repo skill, reinstalls from this checkout and checks installation.
