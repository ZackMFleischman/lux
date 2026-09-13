# C03 component graph contracts and execution sequence

Plan revision 1, LUX-23 specification 2. Planning baseline:
`09e280f1e7892612795d40a7519ffeb0de156901`, including accepted C02 source
`e28a5a8142074463a7aec0309cc81cd6a2977707` and its combined integration.
This document requires fresh independent critique before an implementation ticket
is dispatched. It is a plan, not evidence that graph execution is available.

The user authorizes continued work on all four workstreams with root as sole
coordinator. Routine design choices are delegated. Main integrations and graphics
sessions remain serialized; no graphics, native, portal, installation or public
capability work is included in this planning ticket.

## Decisions grounded in the current source

The design in `docs/design/components.md` and C03 in `components-plan.md` remain
the roadmap. `components-c02-contract.md`'s migration section is the execution
boundary. Actual source has these distinct contracts:

| Source | Existing behavior and implication |
| --- | --- |
| `packages/runtime-contracts/src/components.mjs` and `.d.mts` | Bounded normalized metadata supports number/frame signals and linear premultiplied images. Metadata is neither executable identity nor capability. Reuse its normalization and port/control types. |
| `packages/runtime-contracts/src/identities.ts` | Shared branded UUID schemas use `z.string().uuid()`. Add graph IDs here using the same policy; no runtime import from core or copied UUID regex. |
| `packages/runtime-contracts/src/index.ts` | `hashSchema` admits 64 lowercase hexadecimal characters. Reuse it for resolved definition hashes. This checks representation, not hash provenance. |
| `packages/runtime-contracts/src/component-profile.mjs` | `single-image-source-v1` admits no inputs and exactly the `image` output. Keep this sealed. |
| `packages/visual-sdk/src/sdk-components.ts` | Internal SDK 0.3 exposes `EmptyInputs`, one image result and `EvaluationContext.render`; it is not a graph resource interface. |
| `packages/runtime/src/components/single-image.ts` | Root token authority, one render per evaluation and settlement-aware invalidation/drain/disposal. Do not repurpose its restriction as one image/pass per graph node. |
| `packages/core/src/project/contracts.ts` | Owns persisted `ComponentRef`, accepted closure and v1 SDK restrictions. A future core adapter resolves these references to hashes before the runtime boundary. No graph fields enter project v1. |

Three approaches were considered: widen C02 now; implement the entire graph
runtime in one change; or establish pure planning followed by separately reviewed
execution seams. The third makes the first deliverable independently testable,
keeps unsupported resource claims out of C02, and leaves one scheduler/resource
authority as the architecture. Its cost is explicit intermediate capability gates.

## Ordered leaves and retained obligations

| Leaf | Deliverable | Prerequisite and execution gate |
| --- | --- | --- |
| C03a | Flat resolved graph admission and deterministic dependency plan, specified completely below | Accepted LUX-23 plan; fresh assigned implementation and source review. No runtime creation. |
| C03b | Nested graph definitions, structured expansion and public input/output/control bindings | Integrated C03a; exact expansion plan and independent critique before implementation. |
| C03c | One pure scheduler with fake typed resource leases, independent controls/RNG, cancellation/reset/disposal | Integrated C03b; reviewed fake resource and lifecycle plan. No C02 SDK widening. |
| C03d | Initialized previous-step storage, read-old/write-next feedback | Integrated C03c; separate typed storage plan, accumulator and retirement evidence before admitting delayed edges. |
| C04 | Actual worker graph adapter, explicit new execution profile, real resources and per-node controls | C03 source/integration evidence, versioned compiler/runtime capability design, reserved graphics slot. Update and reinstall/check the repo visual skill when the author route opens. |
| C05 and later | Graph persistence, library extraction, operations, Studio/MCP and installed release | Filesystem stage/apply/closure and explicit schema extensions plus original C05–C09 gates. |

C03 is not complete when C03a lands. All nested, lifecycle, resource, paused-time,
control and feedback requirements remain in C03b–d. Each later leaf needs its own
exact DTO/method/evidence contract; the constraints below prevent incompatible
shortcuts and are not an authorization to improvise its implementation.

## C03a: exact first implementation leaf

Goal: admit a detached flat internal graph, validate all its topology and metadata,
then produce a deterministic plan for the reachable dependency closure of one
final image output. There is no factory, runtime, timer, GPU object or filesystem
reader in this leaf. Signal-processing/image-effect metadata can be planned even
though no shipped execution profile can execute it.

### Files and imports

Modify only `packages/runtime-contracts/src/identities.ts` to add `nodeIdSchema`,
`edgeIdSchema`, `NodeId` and `EdgeId` alongside the existing identity exports:

```ts
export const nodeIdSchema = z.string().uuid().brand<'NodeId'>();
export const edgeIdSchema = z.string().uuid().brand<'EdgeId'>();
export type NodeId = z.infer<typeof nodeIdSchema>;
export type EdgeId = z.infer<typeof edgeIdSchema>;
```

Create these six files:

- `packages/runtime-contracts/src/graph.ts`: internal readonly types, literal limits.
- `packages/runtime/src/graph/validate.ts`: bounded snapshot, definition/graph admission and authenticity check.
- `packages/runtime/src/graph/plan.ts`: deterministic reachable plan; no resource allocation.
- `tests/runtime/graph-fixtures.ts`: exact metadata/UUID/definition fixtures and mutation helpers.
- `tests/runtime/graph-validation.test.ts`: boundary and rejection evidence.
- `tests/runtime/graph-plan.test.ts`: known-answer order/reachability/identity evidence and type assertions.

No barrel, SDK, compiler, worker, core contract, shared configuration or dependency
changes. Import neutral contracts by relative `.ts`/`.mjs` paths as current source
does. Use `normalizeComponentMetadata`, `InitialPortType`, `ComponentMetadata`,
`ControlSchema` from the existing component/parameter policies and `hashSchema`
from the neutral runtime contracts. No metadata registry/catalog lookup by key.

### Input/output DTO and function surface

Every field below is required and unknown fields reject. Type aliases represent
deeply readonly output; input functions accept `unknown` and never trust a cast.

```ts
type DefinitionHash = string; // validated with existing hashSchema
type NodePath = readonly NodeId[]; // C03a output always exactly one segment
type PortRef = Readonly<{ nodeId: NodeId; portId: string }>;
type GraphNode = Readonly<{ id: NodeId; definitionHash: DefinitionHash }>;
type GraphEdge = Readonly<{ id: EdgeId; from: PortRef; to: PortRef; delay: 'none' }>;
type FlatGraph = Readonly<{
  version: 1;
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  finalOutput: PortRef;
}>;
type ResolvedDefinition = Readonly<{ kind: 'code'; metadata: ComponentMetadata }>;
type ResolvedDefinitions = Readonly<Record<DefinitionHash, ResolvedDefinition>>;
type ValidatedGraph = Readonly<{
  graph: FlatGraph;
  definitions: ResolvedDefinitions;
}>;
type PlannedInput = Readonly<{
  portId: string;
  source: Readonly<{ nodePath: NodePath; portId: string }>;
}>;
type PlannedNode = Readonly<{
  nodePath: NodePath;
  definitionHash: DefinitionHash;
  inputs: readonly PlannedInput[];
}>;
type ExecutionPlan = Readonly<{
  version: 1;
  nodes: readonly PlannedNode[]; // dependency-first order, reachable only
  definitions: ResolvedDefinitions; // only definitions used by plan nodes
  finalOutput: Readonly<{ nodePath: NodePath; portId: string }>;
}>;

// validate.ts
function validateGraph(graph: unknown, definitions: unknown): ValidatedGraph;
function isValidatedGraph(value: unknown): value is ValidatedGraph;
// plan.ts
function planGraph(graph: ValidatedGraph): ExecutionPlan;
```

`ResolvedDefinitions` is keyed by trusted caller-resolved immutable closure hash.
The normalizer checks hash syntax, not source bytes, compiler identity or package
pins. C03a accepts fixtures as that trusted input; it does not assert that any
filesystem reader currently produces component graphs. Two entries may have the
same metadata key and different hashes. Two nodes using one hash remain separate
nodes. A missing hash rejects; never fall back to a declaration key or latest
package. Do not derive definition identity by hashing metadata alone.

Definitions admit only `kind: 'code'`. Graph definitions, component references,
node overrides, groups, public bindings and nested paths reject as unsupported
fields/kinds. The future persisted model continues to use `ComponentRef`; this
resolved runtime DTO is not another editable reference/lock format.

### Bounded admission before copying

Export `graphLimits = Object.freeze({ nodes:128, edges:512, definitions:128,
graphBytes:262144, definitionMetadataBytes:1048576, rawBytes:2097152,
rawValues:100000, rawDepth:16 })` from `graph.ts`. Counts apply to raw input before
deduplication/pruning. `definitions` may contain unused entries, but every entry
must pass admission and count toward limits. At least one node is required.

Use two phases. First inspect descriptors and validate bounds for the entire raw
graph and definitions without making a detached graph/metadata snapshot or calling
their normalizers. Only then copy admitted data and normalize. The preflight is a
bounded own-data traversal, not `JSON.stringify(raw)`, `toJSON`, a spread or normal
property read on untrusted nested objects:

1. Accept primitives `null`, booleans, finite numbers and well-formed strings, and
   plain records with prototype `Object.prototype`/`null` or plain dense arrays.
   Reject functions, undefined, symbols, bigint, accessors, symbol keys,
   nonenumerable record fields, inherited/class records, array holes and extra
   array properties. Array `length` is the sole required nonenumerable exception.
   Reject cycles and repeated object/array references using a traversal WeakSet;
   the input boundary is a JSON data tree, so aliases are not a supported DTO.
2. Read array length descriptors and raw node/edge counts, and definition key count,
   before walking their members. Apply 128/512/128 respectively. Bound all other
   arrays and record key counts by `rawValues` before visiting children. Bound a
   string/key's UTF-16 length by `rawBytes` before encoding it. Track every visited
   primitive/container as one value; stop before value 100001 or depth 17 (root
   container depth 0). Never allocate arrays from an unchecked caller length.
3. Compute a running JSON UTF-8 byte count without constructing the full string:
   include `{}`, `[]`, commas, colons, escaped key/string bytes and primitive
   spellings. Encoding a validated bounded primitive with captured JSON string
   serialization is allowed; no caller object reaches serialization. Count graph
   and definitions together with a two-element-array wrapper against 2 MiB. Abort
   before the copy pass when the budget is exceeded. This is a raw representation
   bound, separate from normalized metadata/canonical output bounds.
4. In the second pass use only inspected data descriptors to construct detached
   records/arrays; do not retain caller objects. No async/user callbacks occur
   between passes. Validate all exact DTO fields and call existing metadata
   normalization. Enforce the existing 64 KiB canonical metadata cap per entry,
   plus 1 MiB sum across all normalized definitions. Require the graph's normalized
   canonical JSON UTF-8 size to be at most 256 KiB.

Own-property inspection is not a sandbox against JavaScript proxies or concurrent
same-realm intrinsic replacement. Inputs are untrusted ordinary data, not authored
module objects; do not claim proxy detection, bounded proxy traps or GPU isolation.
Reuse C01 semantics for metadata rather than weakening its strings/controls policy.

Canonical graph output order is top-level `version,nodes,edges,finalOutput`; nodes
sort ascending by exact ID and contain `id,definitionHash`; edges sort by exact ID
and contain `id,from,to,delay`; each port reference is `nodeId,portId`. Definitions
sort by hash. UUID input passes the shared schemas without trimming/case folding;
identity equality is exact string equality, consistent with those schema outputs.
Do not add another UUID acceptance policy. Dynamic metadata ordering remains C01.
Freeze all arrays, objects, metadata and path segments recursively. Record the
successful result in a module-private WeakSet. `isValidatedGraph` consults it;
`planGraph` throws `TypeError('Expected validated graph')` for a forged or cloned
result. The tag is a local API guard, not a serialized security capability.

### Semantic validation and deterministic planning

After structural admission, check in this order: normalized definitions in hash
order; nodes in ID order (reject duplicates); edges in ID order (reject duplicate
IDs); final output; required inputs; full-graph cycle check. All nodes, including
unreachable ones, must be valid before pruning. Use these rules:

- Resolve each node's exact definition hash. IDs are unique within their own node
  or edge namespace. Identical ID strings in different namespaces are allowed.
- An edge source names an existing node output, and its destination names an
  existing node input. Membership in normalized port records supplies port-ID
  policy; no new port regex. A destination has exactly one writer. Every required
  input of every node has one incoming edge. Self-edges fail the cycle check.
- Only literal `delay:'none'` is accepted. Missing delay, `previous-step`, numeric
  delays or any other value reject, even on an unreachable edge. Feedback is not
  implemented by deleting delayed edges from the cycle check.
- Signal ports match `kind`, `value`, `clock` and `unit` exactly. Null units match
  only null; no conversion, resampling or tolerance. Image ports match `kind`,
  `colorSpace` and `alphaMode` exactly. Labels/descriptions do not affect wiring.
  Signal/image mixing fails. C01 itself rejects unknown resources and unsupported
  image/color/clock metadata before wiring is considered.
- Final output names an existing output with image type. Empty graph, input-side
  final reference and a signal final output fail. Dimensions are absent from C01
  metadata; C03a cannot prove dimensional compatibility. Do not invent dimensions
  in metadata. Actual leases must check them in C03c/C04.
- Detect cycles on the entire graph, including disconnected islands, before
  reachability pruning. On valid data, walk backward from final output's node;
  then topologically order that reachable subset using Kahn's algorithm. At every
  selection choose the smallest exact node ID by JavaScript `<` comparison,
  never locale comparison. Count indegrees once per distinct source/destination
  node pair even when multiple ports connect that pair; preserve every port edge
  in `inputs`. Decrement once per pair using the same adjacency set.
- Emit one planned node per reachable node with singleton `nodePath:[id]`;
  inputs sorted by destination port ID, each source path singleton. Include all
  required inputs and only used definitions sorted by hash. No metadata-key
  deduplication, simulation cache or factory call. Reordering node/edge arrays
  changes neither canonical graph nor plan. Planning the same validated value
  twice yields deeply equal detached/frozen plans, with no runtime state.

Validation throws `Error` with `code:'INVALID_GRAPH'`, string `path`, and bounded
message. Wrap existing hash/UUID/metadata normalization failures at the relevant
graph/definition path with this code and a bounded underlying rule description.
Use paths `graph.nodes[i]`, `graph.edges[i]`, `definitions.<hash>` during
raw/shape admission; after normalization use `node:<id>` / `edge:<id>` /
`graph.finalOutput`. Error messages identify the violated rule and at most the
bounded IDs/port names; never embed the raw object. Tests assert code and relevant
path/rule, not an incidental stack trace or a universal ordering of multiple raw
shape errors. Any failure returns no partial result and leaves input unchanged.

### Concrete implementation and acceptance steps

1. Add the shared identity exports and readonly graph contract. Add an explicit
   type assertion that `NodeId` and `EdgeId` cannot substitute for each other,
   and nested plan arrays/metadata cannot be mutated. Existing identities retain
   their exact inferred brands and acceptance. Create fixtures using these UUIDs:

   ```ts
   const A = '00000000-0000-4000-8000-000000000001';
   const B = '00000000-0000-4000-8000-000000000002';
   const C = '00000000-0000-4000-8000-000000000003';
   const D = '00000000-0000-4000-8000-000000000004';
   const U = '00000000-0000-4000-8000-000000000005';
   const h = 'a'.repeat(64), h2 = 'b'.repeat(64);
   // fixture metadata uses normalizeComponentDeclaration; declarations are not
   // hand-written normalized ControlSchema lookalikes.
   const image = {kind:'image',colorSpace:'linear-srgb',alphaMode:'premultiplied'};
   const signal = {kind:'signal',value:'number',unit:null,clock:'frame'};
   ```

2. Write the first failing admission and plan tests, run to capture missing
   implementation assertions, then implement bounded validation before planning.
   Fixtures supply complete valid C01 metadata (declarationVersion1, valid key,
   nonempty label/description, tags[], controls{}, controlDescriptions{},
   lifecycle `{state:'stateful',reset:'seed'}`). Port declarations use the above
   types with valid label/description. The basic graph is one source node A with
   no inputs and image output; its plan contains just `[A]` and final `[A]/image.
   Construct fresh nested objects for each raw DTO position (or serialize/parse
   trusted fixture data); sharing the constant type object across several raw
   definitions would intentionally fail the no-alias JSON-tree boundary.

3. Add the diamond known answer: A outputs signal `value`; B and C each consume
   signal `in` and output signal `value`; D consumes `left` from B and `right`
   from C and outputs image. U is a valid unconnected no-input image source.
   Deliberately reverse raw node and edge array orders. Assert:

   ```ts
   const result = planGraph(validateGraph(diamond, definitions));
   assert.deepEqual(result.nodes.map(n => n.nodePath), [[A],[B],[C],[D]]);
   assert.deepEqual(result.nodes[3].inputs, [
     {portId:'left',source:{nodePath:[B],portId:'value'}},
     {portId:'right',source:{nodePath:[C],portId:'value'}}
   ]);
   assert.equal(result.nodes.filter(n => n.nodePath[0] === A).length, 1);
   assert.equal(result.nodes.some(n => n.nodePath[0] === U), false);
   ```

   This counts planned tasks, not executions. Add two ports between the same node
   pair to catch indegree/adjacency inconsistencies. Give B/C the same definition
   hash and retain both; give two definitions the same catalog key/different
   hashes and retain exact hash resolution. Rename a key without changing graph
   hash references in the fixture and prove key lookup is never attempted.

4. Negative fixtures: dangling node/hash/port; duplicate node/edge ID; two writers
   to one destination; missing required input; wrong direction; wrong signal unit
   including null versus text; image/signal mismatch; invalid C01 color/alpha or
   clock; signal final output; same-step self/two-node/disconnected cycle; every
   delayed-edge representation; graph definition; unexpected nested/public fields.
   Include valid unreachable nodes plus malformed unreachable nodes that reject.
   Assert getter counters stay zero, caller mutation after validation changes no
   output, returned nested mutation fails, and forged/cloned validated data cannot
   enter `planGraph`. Repeated object aliases/cycles fail in preflight.

5. Bound fixtures use exact 128/129 nodes, 512/513 edges, 128/129 definitions.
   The 512-edge passing graph is acyclic and satisfies all inputs: 32 no-input
   signal producers feed 32 consumers with 16 required inputs each (reuse producer
   outputs for fanout); one of those 32 consumers produces the final image. It is below
   128 nodes and uses at most16 ports per component. Distinct edge UUIDs are made
   with a safe bounded fixture counter. Add explicit raw count-before-pruning
   failures and existing C01 port/control/entry/aggregate boundaries. Construct
   legal metadata text padding to straddle rawBytes and metadata aggregate caps;
   if a nominal later cap is unreachable under earlier bounds, prove that fact
   and test the earlier boundary instead of bypassing an invariant. Count byte
   fixtures with `TextEncoder` on the fixture's known-safe JSON; include Unicode
   and escaped characters. Giant length, sparse array, depth17, property/value
   budget, nonenumerable/symbol/accessor/custom-prototype and nonfinite fixtures
   must fail before normalization/copy. Keep test setup bounded itself.

6. Run these explicit CPU commands in the exact worker checkout with existing
   pinned dependencies and Node24.12.0; capture actual versions and exit codes:

   ```text
   node --test tests/runtime/graph-validation.test.ts tests/runtime/graph-plan.test.ts
   node --test tests/runtime/component-single-image.test.ts
   pnpm typecheck
   git diff --check
   ```

   Inspect actual package manager availability first; no install is authorized.
   `pnpm typecheck` means both existing project configs. An equivalent invocation
   of those same pinned local compiler/configs is acceptable with recorded reason,
   not an arbitrary explicit-file mode. No test runner glob or fake GPU timing.
   Commit only the seven authorized source/test paths after meaningful red/green
   evidence. Submit the full source SHA, file hashes, focused output and remaining
   C03b–d/C04 gates. Fresh source reviewer repeats critical negative/known-answer
   checks; root integrates serially and reruns focused combined CPU/type checks.

## C03b constraints: nesting and public bindings

Prepare this leaf against integrated C03a; do not quietly extend its version1 DTO.
A reviewed internal model version2 adds graph definitions keyed by the same
immutable definition hashes. Each definition owns nodes/edges plus explicit public
input/output/control bindings. Local node IDs remain per-definition; expanded
identity is an array of outer graph-instance IDs followed by the leaf ID. Never
concatenate unescaped IDs into an identity key. Path comparison is segment-wise
UTF-16 order, then shorter path first when one is a prefix; map storage may use
JSON.stringify of normalized path arrays, with no claim of a new persistent hash.

Keep 128 nodes and512 edges per graph body, depth8 graph-instance levels maximum,
and512 expanded leaf nodes across the root. Count raw graph bodies before pruning,
and increment expansion budget before materializing each occurrence. Reuse of a
definition at two paths counts twice; recursion detection tracks definition hashes
on the active expansion stack, not a global visited set that rejects legal reuse.
Reject direct/indirect recursive definitions even on unreachable branches. A plan
must also freeze a bound on total expanded edges/public binding targets before
implementation, since512 leaves alone does not bound fanout/expansion work.

Public input bindings name a declared public port and explicit internal consumers;
public output bindings name a declared public port and one internal source. Types
must match exactly through every boundary and resolved required leaf input must
have exactly one writer. No guessed exports or output-name convention. Public
control bindings name explicit internal control targets; version1 numeric/live
semantics remain authoritative. The exact plan must resolve default/override
precedence, fanout compatibility, duplicate alias writers and bound every expanded
target. Reuse current parameter policy and later filesystem-owned SavedControlSnapshot
for saved intent, without putting core/runtime ownership in a cycle. C03b must
cover same-definition nested instances with distinct paths and stable reorder,
depth8/9 and expanded512/513 legal fixtures, and rejection before expansive copy.

## C03c constraints: scheduler, controls and ownership

This leaf supplies a separately reviewed internal `ComponentFactory`,
`ResourceHost`, `NodeFrame`, `GraphRuntime` and closed fake signal/image lease
interfaces. The existing C02 `ComponentInstance` is not already assignable to
them. Keep the architectural seam `update/evaluate/reset/dispose`; adapt only under
an explicit future execution profile, never broaden `EmptyInputs` in SDK0.3.
`createGraphRuntime(plan,factory,resources)` must be the only scheduler under the
existing visual runtime. It consumes clock/tick/epoch input and creates no timer.

Freeze these observable rules in that exact plan:

- Instantiate only reachable leaf paths, in deterministic plan order, one mutable
  instance per path even for identical definitions. Factory lookup uses hash.
- Per-epoch/tick update happens at most once for each stateful instance. Multiple
  consumers share upstream work; changes while paused evaluate presentation with
  frozen time/delta0 and no simulation advance. Freeze cache keys containing outer
  generation, node path, definition hash, clock epoch/tick, input lease versions
  and effective control sequence. Same-tick conflicting frame data must reject or
  receive a documented explicit revision; never silently reuse stale results.
- `setNodeControls` accepts bounded numeric/live patches through existing policy,
  queues atomic effective values at a frame boundary, and causes no create/reset.
  Distinct paths keep separate values. Initial defaults use metadata; saved intent
  reconciliation belongs to the core adapter. No intensity insertion, structural
  change-cost, events or provider transport is added.
- Document stable scene-seed/full-path derivation with exact byte encoding,
  algorithm/version and known vectors before implementing RNG. Independent RNG
  streams must not depend on execution order, catalog key or another node's draws.
  Reset repeats each path's sequence and retains current effective controls.
- The runtime resource authority issues opaque immutable leases tied to owner,
  generation, evaluation and declared consumers. Clones, foreign owners, released
  or previous-epoch tokens fail. Signals validate finite numeric value/unit/clock;
  images validate dimensions/format/color/alpha against the concrete host contract.
  Dimension mismatch fails before consumption. A transform requests a new resource
  or explicit copy-on-write; it cannot mutate another consumer's shared lease.
- Logical nodes do not imply GPU passes. Fake counters must prove diamond shared
  work once and release only after every authorized consumer/async backend/capture
  lease settles. Later geometry/points/material/camera/scene variants need explicit
  constructors and shared scene assembly, not full image sources per node.
- Serial operations and terminal cancellation prevent any frame publication after
  terminal state. Invalidated in-flight evaluation still drains already-issued
  work; output failure never falsely proves settlement. Test unawaited backend work,
  throw/reject, invalid output, cancellation during create/update/evaluate/reset,
  partial initialization, and dispose while a lease is pending.
- Disposal marks attempted before invocation, runs once per created instance,
  preserves original failure and independently attempts safe cleanup after lease
  settlement. Repeated dispose returns the same completion. Never release resources
  merely because a callback threw or stop was requested. A hung operation retains
  ownership until the outer supervisor's explicit termination boundary, which
  cannot prove authored cleanup or GPU drain.
- Full reset affects all reachable instances with current values. The exact plan
  must specify targeted reset's explicit dependency policy before exposing it;
  reordering/live controls retain state. Source/topology changes prepare a complete
  candidate, preserve active state on failure, and on promotion report a full
  simulation reset. Reallocate/change-cost/state-transfer behavior stays gated.

CPU evidence includes diamond execution counts, two same-definition paths with
independent counters/controls/RNG, repeated consumers, paused redraw, deterministic
reset vectors, partial-create failure and deferred lease settlement/once-only
disposal. Fake-resource output is not actual GPU, Studio or installed acceptance.

## C03d constraints: feedback storage

All earlier leaves reject delayed edges, including well-typed ones. Admission
changes only alongside initialized typed storage and a reviewed model/profile
version. Freeze a previous-step initial value/resource for every edge, ownership,
generation/reset initialization, and atomic read-old/write-next commit at completed
steps. Failure/cancellation must retain old committed storage and retire abandoned
next resources after settlement. No step may consume partially written next state.
An accumulator fixture with initial0 and input1 yields1,2,3 on successive steps;
same-step multiple consumers see the same old value and do not double-advance.
Paused presentation must not commit feedback history. Include reset, incompatible
types/dimensions, missing initialization, outstanding old-reader leases and failed
next-write cases. Feedback never hides an otherwise illegal same-step cycle.

## Evidence and delivery contract

| Criterion | Required setup, executor and evidence |
| --- | --- |
| Plan matches source | LUX-23 planner in exact baseline checkout; inspect neutral IDs, C01 metadata/parameters, C02 profile/SDK/bridge and original design/plan. Report file paths and exact planning commit; no application tests implied. |
| C03a becomes executable work | Fresh reviewer independently critiques this exact plan revision against original C03 intent. Check raw bounds before copy, topology known answers, source identity and sealed C02 profile; record findings/dispositions and exact plan SHA. |
| C03a implementation | Fresh assigned worker, clean isolated integrated plan baseline, existing pinned dependency provenance; red/green output, exact commit and source hash manifest for seven files, no hidden shared changes. |
| Independent source acceptance | Distinct fresh reviewer with no implementation participation; inspect exact submitted SHA, reproduce meaningful negative/known-answer cases and type checks; report criterion-specific evidence. |
| Main integration | Root alone owns integration ticket; compare landed source files with reviewed source, record exact landed SHA, focused graph/root-bridge regressions and both typeconfigs. |
| Later C03/C04 claims | Separate accepted exact plans and implementation/integration evidence. Missing typed storage, GPU slot, compiler profile, filesystem schema or installed closure is an incomplete prerequisite, not waived by passing C03a tests. |

For every evidence row record actual checkout, baseline and final commit, executor
identity/session, command/setup, observed result and raw artifact path. Distinguish
planning fixtures from executed tests. This planning ticket delivers only this
document. Source implementation, public discovery, installed support and actual
graphics remain separate authorized work with the prerequisite gates above.
