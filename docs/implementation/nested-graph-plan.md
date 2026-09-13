# Nested graph and public binding implementation plan

> One assigned fresh conductor-worker implements the reviewed leaf using executing-plans and test-driven development. Root alone dispatches, reviews dispositions and integrates. This document authorizes no additional team or graphics session.

**Goal:** compose reusable graph definitions into deterministic leaf plans with exact instance paths, explicit port/control bindings and bounded expansion. Preserve C03a and the closed C02 execution profile.

**Baseline:** LUX-35 specification 2, main `192148a01cf3bc6d35cd936f140af221574326f7`; accepted C03a source `b9b6ccfc85c6ba48bdcf8db5833c56b99f01ce92`, integration LUX-34. Read [C03b constraints](component-graph-plan.md#c03b-constraints-nesting-and-public-bindings), [component design](../design/components.md) and the actual C03a/parameter modules. This plan is internal pure data preparation, not a persisted project schema or runtime capability.

## Decisions and exact scope

Use a separate version-2 model and entrypoints. Keep C03a version-1 DTOs/validator/planner byte-compatible; do not overload them, widen SDK0.3 EmptyInputs, import core into runtime, invent ComponentRef/DependencyLock variants, or add a second scheduler. The future core adapter resolves immutable definition hashes and reconciles SavedControlSnapshot intent before supplying the derived numeric patches specified here.

Only six new files belong to the first implementation leaf:

- `packages/runtime-contracts/src/nested-graph.ts`.
- `packages/runtime/src/graph/nested-validate.ts`.
- `packages/runtime/src/graph/nested-plan.ts`.
- `tests/runtime/nested-graph-fixtures.ts`.
- `tests/runtime/nested-graph-validation.test.ts`.
- `tests/runtime/nested-graph-plan.test.ts`.

No existing shared source/test/config/barrel files change. Existing TypeScript includes and explicit Node test invocation cover the files. Reuse neutral UUID/hash schemas, C01 metadata normalization/canonicalization and existing numeric parameter helpers. C03a's private preflight is not an exported general framework: the new validator owns its bounded two-pass capture with equivalent defenses, while tests verify consistency. Future refactoring is separate from this leaf.

The first nested profile requires every graph body's **direct-node** dependency graph to be acyclic, as well as its expanded leaf graph. This conservative boundary treats a placed graph as one dependency unit during local validation; a local cycle is rejected even if a hypothetical port-specific expansion could remove it. This restriction is explicit, not a claim of maximal acceptance of all acyclic flattened networks. Graphs still flatten to one leaf plan; local validation adds no runtime scheduling work.

Root selection names a graph definition and one declared image output. Root public inputs must be empty: this produces a source plan with no unbound external resources. Nested graph definitions may declare required public inputs and signal or image outputs. Every graph definition must expose at least one output, bound explicitly to an internal output; no guessed final-output convention, input-to-output passthrough, optional inputs, constant resource values or delayed edges. Those capabilities would need another reviewed version.

## Version-2 contracts

All fields and nested arrays/records are readonly; runtime returns detached, recursively frozen data. Existing brands and ComponentMetadata/ControlSchema/ControlValues types are imported, not redefined.

```ts
type NestedNode = Readonly<{
  id: NodeId; definitionHash: DefinitionHash; controlDefaults: ControlValues;
}>;
type LocalControlRef = Readonly<{nodeId: NodeId; controlId: string}>;
type GraphBody = Readonly<{
  nodes: readonly NestedNode[];
  edges: readonly GraphEdge[]; // existing local PortRef and delay:'none'
  inputBindings: Readonly<Record<string, readonly PortRef[]>>;
  outputBindings: Readonly<Record<string, PortRef>>;
  controlBindings: Readonly<Record<string, readonly LocalControlRef[]>>;
}>;
type NestedDefinition =
  | Readonly<{kind:'code'; metadata:ComponentMetadata}>
  | Readonly<{kind:'graph'; metadata:ComponentMetadata; body:GraphBody}>;
type NestedDefinitions = Readonly<Record<DefinitionHash,NestedDefinition>>;
type NestedGraph = Readonly<{
  version:2; rootDefinitionHash:DefinitionHash; outputPort:string;
}>;
type ValidatedNestedGraph = Readonly<{
  graph:NestedGraph; definitions:NestedDefinitions;
}>;
type NodeControlOverride = Readonly<{nodePath:NodePath; values:ControlValues}>;
type ExpandedControlRef = Readonly<{nodePath:NodePath; controlId:string}>;
type PublicControlTarget = ExpandedControlRef & Readonly<{active:boolean}>;
type NestedPlannedNode = Readonly<{
  nodePath:NodePath; definitionHash:DefinitionHash;
  inputs:readonly PlannedInput[]; initialControls:ControlValues;
}>;
type NestedExecutionPlan = Readonly<{
  version:2; nodes:readonly NestedPlannedNode[];
  definitions:ResolvedDefinitions; // reachable code definitions only
  finalOutput:Readonly<{nodePath:NodePath;portId:string}>;
  publicControls:ControlSchema;
  publicControlBindings:Readonly<Record<string,readonly PublicControlTarget[]>>;
  prunedNodePaths:readonly NodePath[];
}>;
export function validateNestedGraph(graph:unknown,definitions:unknown):ValidatedNestedGraph;
export function planNestedGraph(graph:ValidatedNestedGraph,
  overrides?:readonly NodeControlOverride[]):NestedExecutionPlan;
export const nestedGraphLimits:Readonly<{
  definitions:128; nodesPerBody:128; edgesPerBody:512;
  bindingTargetsPerBody:2048; graphLevels:8; expandedPlacements:2048;
  expandedLeaves:512; expandedEdges:4096; expandedControlTargets:16384;
  resolutionSteps:65536; overrides:512;
  rawBytes:2097152; rawValues:100000; rawDepth:16;
  metadataBytes:1048576; bodyBytes:262144; allBodyBytes:1048576;
  overrideBytes:262144; outputBytes:4194304;
}>;
```

Export named aliases above from the new contract module. Validation uses a module-private WeakSet authenticity guard as C03a does; a frozen clone, forged object or deserialized value cannot enter planning without fresh admission. If the guard needs an export for the planner, keep it internal to these source modules, not a public barrel. Authenticity is local object admission, never signature/source provenance or cross-realm trust.

Root path is `[]`; a direct child path is `[childId]`. Each descent appends the placed node ID, never a definition hash or catalog key. Root counts as graph level 1; seven nested graph placements plus a leaf make maximum leaf-path length 8. An eighth nested graph placement is level 9 and rejects. Retain exact neutral UUID spelling, including case-distinct identities; compare paths segment-wise UTF-16 then shorter prefix first. Use JSON.stringify of admitted path arrays only as an internal map key. Do not mint flattened UUIDs, concatenate unescaped paths or normalize case to fit input mapping. Mapping/persistence adapters still require an explicit collision policy.

## Admission, local validation and bounded expansion

1. Preflight graph and complete definitions as a two-element wrapper against the raw byte/value/depth caps. Apply definition count and every raw body node/edge/binding-target array count before visiting descendants. Snapshot own descriptors only; reject getters without invocation, symbols, nonenumerable extras, exotic prototypes, sparse/extra-key arrays, cycles/repeated aliases, nonfinite/unsupported scalars and ill-formed Unicode. Bound string/key UTF-16 length before primitive encoding. Copy only after the complete raw pass. No caller object reaches JSON serialization, spread, normal property reads or a normalizer before admission. Proxy traps and hostile intrinsic replacement remain outside this ordinary-data contract.
2. Enforce exact fields/versions and existing hash/UUID syntax. Normalize every definition's C01 metadata, including unused definitions. Keep 64 KiB per metadata entry, 1 MiB aggregate; count canonical body bytes separately (256 KiB each/1 MiB total). Nodes sort by exact ID, edges by exact ID; definitions by hash. Dynamic binding keys sort by UTF-16; target arrays sort by local node ID then port/control ID and reject duplicates instead of deduplicating. Body field order is the displayed interface order; node order is id,definitionHash,controlDefaults. No new persistent hash authority is created.
3. Validate every local reference and kind. Node/edge IDs are unique within a body, but may recur in another definition. Definition hash lookup determines type/metadata; duplicate catalog keys are legal. Every node's controlDefaults is a possibly empty partial patch of that node's referenced metadata; nonempty patches use validateControlPatch, empty records stay empty. No clamping, quantization, missing-control invention or default-schema mutation.
4. Binding key sets exactly equal their graph metadata inputs, outputs and controls. Input and control bindings have at least one target; outputs have exactly one source. An input target names an immediate node's declared input, output source names its declared output, control target names its declared control. Types match exactly for every port crossing using C01 signal unit/clock/value and image color/alpha. Dimensions remain a later resource check.
5. Each immediate node input has exactly one writer from either an ordinary edge or one graph public-input binding. Reject edge/binding conflicts, fanout target duplicates, two public inputs targeting one destination, missing writers and wrong directions, including unreachable nodes. Each public output is explicit; multiple different public outputs may intentionally alias one internal source. The same output may fan out to many inputs. Count all local edge pairs with one indegree per node pair and reject cycles/self-edges before reachability pruning.
6. Reject recursive graph definitions anywhere in the complete catalog, even unreachable: use active-stack hash membership to detect cycles and memoize completed summaries only after validation. Reuse at distinct paths is legal. Check max graph depth and cardinality for **each graph definition considered as a standalone root**, not just the selected root. Definitions with inputs are validated with abstract boundary sources; they need not be launchable source roots. Root-source admission is the separate zero-input rule above. Graph lifecycle.state must equal stateful when any descendant code definition is stateful, otherwise stateless, considering unpruned contents; reset remains seed. This is metadata consistency, not graph-instance execution.
7. Compute saturated cardinality summaries bottom-up over the nonrecursive definition DAG **before materializing expanded occurrences**: placed nodes (graph plus code, excluding the implicit selected root), leaf nodes, public-port/control target counts and potential expanded leaf edges. The edge count is the sum of required input counts across expanded code leaves, since each must have exactly one writer; standalone abstract public-input writers count once and are replaced, not added again, at composition. Per-body bindingTargets counts every input/control target plus each output source. expandedControlTargets counts all resolved public-control-to-leaf targets across placed graph occurrences and the implicit root, including repeated boundary aliases; resolutionSteps separately bounds their traversal. Addition/multiplication saturates at limit+1, never allocates arrays of guessed size or overflows safe integers. Repeated placements multiply counts. Count placements across the entire selected root before pruning; every standalone definition must fit the same bounds. A leaf-only cap is insufficient because nested graph wrappers and fanout also consume work.
8. Bound the actual total resolution work of one validation/planning call to65536 steps; charge before processing each placed occurrence, traversed public binding reference, emitted leaf connection or expanded control target. Memoized immutable summaries avoid recomputing a definition for every reference. Retain an explicit finite global counter even for unused definitions. If raw, structural or work caps dominate a later limit, reject at the earlier cap and document that dominance. No unbounded expansion is permitted just to discover the result is too large.

Materialization resolves every ordinary source output through nested output bindings to a leaf output, and each input target through nested public inputs to a bounded leaf-input list. Wire their cross-product with a precharged edge count; every expanded leaf input must have exactly one writer, no duplicate paths/targets, and exact types. Preserve distinct port connections between one leaf pair but count that pair once for topological indegree. Check the whole expanded leaf graph for cycles before pruning. Abstract standalone public inputs count as external writers for validation only and never appear as fabricated nodes/resources in a source plan.

Errors are Error with code `INVALID_NESTED_GRAPH` and a bounded path; messages <=768 characters retain both location and violated rule, including a deep malformed input path. Allocation/serialization failures are not hidden as successful empty graphs. Byte quotas include all punctuation/escaped strings. Normalized result and plan output size are checked before publication; failure leaves all input state unchanged. No asynchronous callback, executable factory or retained mutable process state exists in this leaf.

## Numeric control binding and override semantics

Fanout controls must match type:number, changeCost:live, unit presence/value, min/max and step presence/value exactly. Labels/descriptions/presentation order and default values may differ; a graph public default is an intentional configured value propagated into its bound targets. Every value still passes existing numeric validation against its target schema. No scaling, clamping, quantization, unit conversion or control-ID alias inference.

At each graph boundary, expand each public control into concrete descendant leaf control addresses. Two **different** public controls must have disjoint expanded target sets; an equal value does not excuse duplicate writers. A single public control may fan out to many distinct leaf targets. Parent binding through a child's one public control is a chain of the same writer, not a duplicate writer. Validate all aliases before pruning, including unused leaves. Count every expansion against the explicit target/work caps.

Default precedence is deterministic, independent of array order:

1. Start every code leaf with defaultControlValues of its metadata.
2. Build each graph occurrence bottom-up: apply each immediate node's controlDefaults patch to that node's controls (graph-node patches propagate through that graph's public bindings).
3. Apply that graph occurrence's own public metadata defaults to its bound descendants. When that occurrence is placed by a parent, the parent's node patch then overrides those public defaults. The parent's own public defaults propagate last at that level. Thus each enclosing configured interface can intentionally override the internal example values it publishes.
4. After all definition-derived defaults, apply explicit scene/caller overrides to addressed code or graph instances. These are accepted-derived numeric patches, not raw SavedControlSnapshot. Empty nodePath addresses root public controls; other paths must identify an actual placed node. Override entries have unique paths and nonempty valid partial patches. Expand graph-control patches to leaf targets, then reject any two explicit override entries/controls whose expanded leaf writer sets overlap. No array-order winner or silently competing root/leaf override. A single override patch can target multiple disjoint controls. Scene overrides therefore win over definition defaults wherever specified.

Include all nodes, including later-pruned nodes, in override validation. Wrong paths, stale control IDs, unsafe values, mismatched units/ranges or duplicate writer routes fail the whole candidate. Persistence/migration remains core-owned; this function neither repairs saved values nor mutates caller intent. Output initialControls is the complete effective numeric snapshot only for reachable code leaves. It does not represent a live gesture, parameter sequence or runtime publication.

Expose root publicControls metadata and its fully expanded control mapping with an explicit active boolean per target. Preserve inactive mappings so pruning is observable rather than silently losing declared bindings. At least one target exists in the full expansion, but a public control may have no active target for the selected output; this is inert metadata, not an effective runtime control promise. Future UI/runtime adapters must disclose inactive or mixed-value fanout instead of assuming schema.default equals every leaf's current value after scene overrides. Public export/FFGL control limits are separately reviewed in C09.

## Planning and evidence

After complete validation/expansion, walk backward from the selected root output's concrete leaf source. Prune unused code leaves and definitions, preserving sorted prunedNodePaths and active/inactive control mapping. Kahn-sort reachable nodes by exact structured path, inputs by destination port ID. Return distinct detached plans for repeated calls, metadata once per used definition hash, one placed node per reachable leaf occurrence. No factories, simulation, resources, RNG or input-event consumption execute.

Canonical plan DTO order is the interface order above; each input uses existing PlannedInput order; initialControls follow normalized control schema order; public binding keys follow root control schema order, targets path/control sort; pruned paths sort by the same path comparator. State/content hashes, ComponentRef resolution and persisted schema-v2 writers remain out of scope.

Required tests start red before implementation and include:

| Case | Literal result or rejected condition |
| --- | --- |
| Two instances | Root places the same graph hash under A/B; each contains leaf X. Paths[A,X] and[B,X] remain distinct; reordering definitions/nodes/edges/bindings does not change plan. Defaults/overrides differ without sharing values. |
| Nested diamond | One upstream leaf fans out through two graph instances into one final image leaf; upstream appears once, every typed input is wired once and ready-path ordering is stable. Parallel ports between the same pair retain separate inputs. |
| Port boundaries | Missing/extra binding key, empty target list, wrong immediate node/port/direction, unit/color mismatch, edge+public-input duplicate writer and missing required input all reject even in unused definitions. Signal-only nested outputs are legal; root selected signal or root public input rejects. |
| Definition recursion/cycles | Direct and indirect hash recursion on unused definitions reject; legal repeated hash reuse passes. Local direct-node cycle and flattened leaf cycle reject; conservative port-independent local-cycle restriction is explicit. |
| Depth and placements | Chain with root graph level1 through level8 then code leaf passes; level9 rejects before expansion. Legal disconnected graph wrappers count against2048placements even if leaves later prune. Demonstrate lower bound/cap dominance if2048 cannot be reached under stricter caps. |
| Leaf count | Four placed graph definitions each with128 code leaves produce512 complete leaves before pruning and pass; add a fifth graph containing one complete leaf for513 and reject. All outputs/writers valid; make each leaf reachable through bounded aggregation when testing reachable counts, or explicitly assert pre-pruning count when only one root output selects a subset. |
| Expansion fanout | Construct legal source graph with16 public signal outputs and four consumer graphs, each64 leaves with16 required inputs; root fanout bindings produce4096 leaf edges and pass. Add a separately valid consumer/input for4097 and reject before building connections, while staying under512 leaves,128 local nodes/512 local edges and raw caps. Use producer declared ports to avoid synthetic invalid metadata. |
| Controls | Leaf default1, inner node patch2, inner public default3, outer node patch4, outer public default5, explicit leaf override6 resolves6; omission at successive levels gives the documented remaining winner. Preserve fractional values without step quantization. |
| Control alias negatives | Two public controls ultimately map to one leaf control: reject. Parent-to-child binding chain to one target passes. Root override and direct leaf override on that same target reject regardless of values/order. Missing/extra/changed-range/unit/step, nonfinite/out-of-range values reject through existing helpers. |
| Pruning/overrides | Unused leaf is omitted from executable nodes, retained in prunedNodePaths; its public target remains active:false. Valid override to it is validated but creates no runtime work. Unknown path fails. Changing selected output changes active mapping deterministically. |
| Bounds and hostile data | All count caps equality/+1 where reachable; raw/metadata/body/override/output bytes, depth/value/work budgets, aliases/getters/symbols/nonenumerables/exotic/sparse/Unicode cases; preflight counters prove no descendant copying/getter execution before rejection. Saturating count arithmetic never wraps; no oversized allocation to manufacture a negative. |
| Compatibility and types | Existing23graph+5bridge tests pass unchanged, both TS configs; readonly DTO/type-negative fixtures exercise paths/bindings/values and graph/code narrowing. Deep-frozen clones/forgeries fail authenticity, returned plans have no shared mutable records. C03a still rejects version2 and C02 profile stays closed. |

The worker must verify the proposed equality fixtures satisfy **all** simultaneous caps before claiming coverage. If a stated positive cannot be constructed under them, report a plan defect and obtain a versioned disposition rather than weakening admission or silently substituting an invalid fixture. The same applies if the expansion accounting undercounts a public-boundary route. The independent reviewer checks the actual counting algorithm and independently known topology/value answers, not only test totals.

Run direct pinned Node tests for the three existing graph/bridge files and two new nested test files, plus both unchanged TypeScript configs. Existing main dependencies provide Node24.12.0/TypeScript7.0.2/Zod3.25.76; no install. Record exact commands, source SHA, file hashes, red/green/boundary outputs and executor/session. Update no author-facing skill because no delivered authoring capability changes. Submit source for fresh independent review, stop the worker session and end; root serial integration requires its own ticket and combined checks.

C03c runtime state/RNG/leases/scheduler, C03d initialized feedback, C04 real graph profile/GPU, C05 persistence and C06 UI/MCP remain separately gated. LUX-7 remains stopped. Plan acceptance is not implementation or nesting available in Studio.
