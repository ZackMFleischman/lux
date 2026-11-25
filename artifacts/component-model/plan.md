# LUX-150 compatibility and identity plan

Status: proposed for independent critique; no implementation or build started.
Base: dc5b1735b3a95d077e37f9684d8230e977c69f4d. Worktree: .worktrees/component-model.
Worker: 81e28d85-a132-400b-9857-f1f03223a3d0. Session: 1c0dafe4-69fe-4307-bccf-390756a128c0. Claim: 1abddbe2-daae-4637-892e-c9574e42ceb9. Ticket revision: 3.
Astra/high is justified by saved identity, compatibility and runtime admission risk.

## Contract and approach

Keep the existing image-chain compiler, nested graph planner, renderer and control evaluator. Extend SDK 0.4 in place: defineComponent accepts the existing code definition or the existing literal graph body (definitions, nodes, edges, optional input/label, output, expose). defineVisual accepts the graph body as the runnable entry. defineComposition remains an exact compatibility adapter. Normalize all graph author forms to the current sealed composition representation; no artifact/profile/scene version bump merely to rename concepts. Static extraction recognizes the new calls and validates the same literal fields. Runtime admission compares the same sealed declarations and component metadata. Reject code-plus-graph mixtures, dynamic graph expressions, recursion, disconnected nodes and non-linear image wiring as today.

Expose ComponentDefinition as the code-or-graph author type, with CodeComponentDefinition and GraphComponentDefinition names for precise consumers. Keep source/version selection intact for direct SDK 0.1/0.2 visuals and internal SDK 0.3. Do not rewrite source bundles or library files. This compatibility boundary reuses their existing render path.

Unify Studio occurrence and control-target lookup in one small existing-flow adapter used by Graph/Inspector. Graph-authored visuals retain real occurrences. A direct legacy visual has one code occurrence at the already established empty path [], plus the existing Scene selection. Selecting it uses the same inspector/animation editor and existing flat controller route; no invented UUID or persisted wrapper node. Scene remains the persistence/container concept, not a component implementation. Keep current navigation, exposure aliases and fallback/unavailable state behavior.

## Identity invariants

- Existing graph leaf definition hashes remain hash(modulePath + NUL + sourceText). Existing graph definition hashes retain their current child-name hash formula. No normalization rewrites input source before hashing. New authored source naturally has its own source/graph hashes.
- Instance nodePath remains the authored UUID path, independent of labels and array order. Empty [] remains the flat control target; its historical definitionHash/schemaHash values stay the control schema hash. No migration to a synthetic child path.
- Exposed controls resolve to existing leaf control IDs and paths. Aliases never become leaf identities. Schema hashing, guarded restore and disabled unresolved animation behavior remain unchanged.
- Scene versions 1–5, embedded source text, library links/revisions, saved node controls and animation bindings retain their current shape. Legacy fixtures are opened unchanged and compared after save/reopen. A source edit that changes a leaf definition still invalidates incompatible bindings by existing rules.

## Small implementation sequence

1. Add SDK overloads and declaration extraction cases, with negative declaration tests and a nested fixture using defineVisual plus graph defineComponent. Verify unchanged legacy profile/hash outputs and library source preservation.
2. Factor shared occurrence/control-target lookup from current GraphPanel/Inspector paths and add the empty-path legacy occurrence adapter. Use it for Graph selection and Inspector base controls/animation targets. Keep transport, persistence and evaluator implementations intact.
3. Update SDK discovery and the shipped visual-creation skill with one minimal reusable graph component example. Update only relevant examples; preserve defineComposition documentation as supported compatibility behavior.
4. Run focused declaration/compiler, worker-admission, scene/control-animation/library and Graph/Inspector tests plus TypeScript checks. After coordinator grants the build/GPU lane, demonstrate direct and graph scenes in isolated Studio: select a node, edit base/animation controls, save/reopen, and reject an invalid build while retaining the working preview and user files. Preserve actual screenshots, exact source and execution provenance. Independent review precedes coordinator integration and shared skill install/check.

## Audio boundary for LUX-151

The stable target remains {nodePath, definitionHash, schemaHash, controlId}; expose shared lookup so audio can address direct and graph controls identically. Public graph input remains the existing image input contract. Audio acquisition, typed signal-source variants, binding persistence migration and analyzer evaluation belong to LUX-151 and must stay separate from image-chain admission. This slice adds no signal node, provider, audio evaluator or speculative graph format. LUX-7/LUX-59 policy stops remain intact.

## Independent critique disposition (code gate)

- Preserve exact runtime graph shape: CodeComponentDefinition keeps metadata/create; GraphComponentDefinition keeps kind: composition and graph fields; ComponentDefinition is their union, CompositionDefinition stays an exported alias, and SDK 0.4 exports VisualDefinition. Leaf-only consumers explicitly use CodeComponentDefinition.
- Static matrix: defineComponent(code) is a leaf; defineComponent(graph) and defineComposition(graph) are reusable; only defineVisual(graph) or legacy defineComposition(graph) is a root. Reject nested defineVisual, a code root, mixed fields, and ambiguous recognized calls. The new defineVisual argument excludes input, with a precise diagnostic. Reusable graph components retain their image input. Runnable external image input is deferred.
- Direct adaptation is view-only: selection key [] is distinct from Scene null. Do not populate runtime.composition or nodeControls, add scene rows, wrappers, or hashes. Base edits use setParameters; animation targets stay []; saved flat scenes remain versions 1–3. Tests assert no node operation or graph persistence is emitted.
- For unchanged legacy source, sourceHash, leaf/graph definitionHash, schemaHash and canonical profile/compositionHash remain identical. Changed SDK code may legitimately change bundleHash/linkedHash; compiled artifacts need not be byte-identical.

Coordinator authorized source edits after these clarifications. Build/GPU lane remains reserved by LUX-147 until explicit release.
