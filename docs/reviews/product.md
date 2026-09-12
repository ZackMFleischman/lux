# Independent product and requirement coverage review

Reviewed snapshot: `c6cf8eee4481daa73673188f10af58d6aa3016ef` on `codex/review-product`.
Reviewer bias: product fidelity and source-to-requirement-to-task coverage. Review date: 12 September 2026 UTC.

## Verdict

**Ready to START the bounded tracer from a product/coverage perspective.** No product-fidelity implementation blocker was found. TR-01 and TR-02 correctly establish client and GPU feasibility rather than claiming it in advance. Two coverage corrections are required before their affected later milestones. This verdict does not establish runtime feasibility, implemented features, or permission to bypass the coordinator's outstanding review disposition and committed-document finish line.

Read `docs/README.md`, requirements, decisions, architecture, every file in `docs/design/` and `docs/implementation/`, planning progress, and both preserved original plans. No other reviewer report was read; no application code, dependencies, host settings, or design documents were changed. Findings use line numbers from the frozen snapshot.

## Findings

### PROD-01 — Restore the explicit frame-step requirement and its acceptance route

**Classification:** required before affected milestone 4; not a tracer implementation blocker.

**References:** original design `plans/ai-visual-workshop-design.md:562`, §8 Required work, explicitly requires frame-step alongside resolution, quality, target frame rate and seed. `docs/requirements.md:61` (U07) covers the settings split but omits frame-step; no other baseline ID captures it. `docs/design/studio.md:83`, Preview and settings semantics, lists the other controls without step behavior. `docs/implementation/roadmap.md:32` refers generally to complete preview quality/time/settings controls, while `docs/design/ai-authoring.md:148`, Later operation extensions, does not reserve a step operation. A search of the new `docs/` set finds no frame-step requirement.

**Impact:** a milestone 4 implementation can satisfy the enumerated baseline and UI table without letting the artist inspect the next animation step while paused. Controlled sequence capture is a different workflow and does not replace this direct preview control.

**Concrete correction:** add the source requirement to the baseline and milestone 4 coverage, define the runtime-owned step action in Studio/runtime later contracts, and route it through the same application operation for UI and AI. Define paused-state behavior, animation-time/tick advancement, applicable fixed simulation steps, and treatment of inputs. Add acceptance that repeated steps advance the existing authoring instance by the declared amount while preserving pause state, revision and host independence. Keep this out of 0.1.

### PROD-02 — Preserve a minimum supported analytical diagnostic in milestone 3 acceptance

**Classification:** required before affected milestone 3; not a tracer implementation blocker.

**References:** original design `plans/ai-visual-workshop-design.md:458`, §7 Required work, calls for reusable diagnostics for initial visual types, and `plans/ai-visual-workshop-design.md:544`, §7 Completion test, requires reading a bounded sample of particle positions or trails. `docs/requirements.md:36` (C03) changes this to “optional analytical measurements.” `docs/implementation/roadmap.md:31` accepts diagnostics that explain rendered behavior, without retaining the bounded sample check. `docs/design/ai-authoring.md:152`, Later operation extensions, specifies image sequences and diagnostics but does not distinguish a bounded analytical sample operation/result from diagnostic images.

**Impact:** diagnostic images alone could satisfy the new checklist while the original concrete AI workflow of inspecting bounded simulation data is never implemented. Not every component needs analytical introspection, but the specified initial supported fixture must provide it.

**Concrete correction:** clarify C03 so analytical capabilities may be optional per component while at least one initial particle position/trail sample is required for milestone 3. Add a later operation/capability and result contract with sample count/size bounds, revision/time/input provenance and explicit unsupported behavior. Restore the source completion test to the milestone 3 acceptance row, including AI use of the sample and comparison with the same seed/input sequence. Do not expand tracer still capture.

## Coverage assessment

| Area | Assessment and authoritative route |
| --- | --- |
| Accepted decisions versus proposals | `requirements.md` explicitly records U01–U09 and distinguishes D/P/U sources. DEC-01/02 adopt vocabulary and graph ownership under delegated authority; DEC-03 preserves the user's automatic preview plus Undo choice; DEC-09 resolves the source compositing ambiguity without rewriting it. The chosen stack, wrapper strategy and Dockview remain testable proposals, not alleged user mandates or working results. |
| Actual external AI image loop | T01/T02 map to TR-01/03/04 and the acceptance AI-loop gate. The fixture is expressly insufficient; actual submitted executable source, model-visible PNG content, image-informed code revision, second capture, and revision/time evidence are required. No manual copying or parameter-only fixed example can pass. |
| Actual GPU Resolume playback | T04/T05/T08/T09 map to TR-02/03/06/07. Same visual implementation, native continuous control, GPU completion/ownership, no normal CPU image streaming, host survival after Studio/AI closure, and current host controls after recovery remain mandatory. Explicit host artifact activation is appropriate to the scratch tracer and does not silently turn Studio auto-apply into release mutation. |
| Safe authoring and persistence | A01/A02 map to milestone 1 transactions, autosave, conflict handling, meaningful Undo and recovery. Successful 0.1 activation is already automatic; `tracer-contracts.md`, Unified limits and scope, and runtime Load and replacement explicitly avoid a nonfunctional tracer Undo button. Source §5 places durable history in milestone 1, so this staging does not remove the accepted UX. |
| Graph, inspector and compositing | G01–G03 and P02 retain explicit typed graph data, stable nodes, shared 3D/dependencies, previous-step feedback, scoped overrides, capabilities and bypass costs. Corrected Glow composition feeds the processed image once. Milestone 2 preserves branches and the manual/AI edit survival test; a full arbitrary-code graph round trip is correctly excluded. |
| Flexible layout and preview | U01–U06 are represented in Studio's panel behavior, both diagrams and staged table: arbitrary tab/split arrangements; larger Preview beside Graph on ultrawide; laptop tab group; independent Library/Inspector and lock; explicit inspect-output without changing final output; preserved graph viewport; maximize/popout/fullscreen/return; personal layout and monitor recovery. Real-surface lifetime smoke in TR-05 is bounded and is not misrepresented as full docking acceptance. |
| Settings, input and host boundaries | U07–U09 and S02/S03 separate fit/zoom/render scale, scene settings, simulation resolution and preferences; pane geometry does not silently alter output. Inputs separate device/status, analysis and mappings, with visible resulting values and explicit monitoring. Machine bindings stay outside creative content. Host authority and export mapping reports prevent assumed studio mapping transfer or assumed raw FFGL audio/MIDI. PROD-01 covers the missing source frame-step control. |
| Inspection and embedded AI | C01–C03 and S01 reserve component/diagnostic/crop/sequence capture, live versus controlled simulation stepping, immutable request targets, distinct read/edit scopes and external/embedded operation parity. Controlled jobs preserve the live performance instance. PROD-02 identifies the weakened analytical fixture. |
| Generated assets and reuse | M01/M02, project-model Library/assets/releases, and AI later extensions preserve generate/edit-or-import, durable validated bytes, provenance, authorized references, register/connect/render/revise, failed replacement retention and credentials outside exports. Milestones 4 and 5 explicitly require transparent sprite revision and offline generated sprite playback. P01/P02 cover local overrides, pins, explicit publication/update, templates and archive closure. A provider-specific generation UI is not improperly required in tracer. |
| Later host and release work | T10/T11 route to 0.2 identity/composition/independent instances and 0.3 audio/MIDI/repeated triggers/stateful simulation. R01–R03 route to installed offline releases, compatible updates, current host controls, broader workload categories and the 60-minute soak. Source-only plugins remain the initial delivery; no video or incoming-image effect substitute appears. |

All baseline requirement IDs have a design and milestone route in `roadmap.md`, Complete requirement routing. T01–T09 have task and evidence routes in `tracer-0.1.md`, Traceability for tracer. This checks completeness of the index; PROD-01 and PROD-02 show why indexing alone is insufficient to prove fidelity to the original source.

## Scope and unresolved assumptions

The tracer has not grown into the full product. One scratch visual, a fixed continuous `intensity` schema, one authoring instance plus an independent host instance, minimal preview controls, bounded capture/recovery and a small presentation-lifetime harness serve its required outcomes. General graph/library/chat/docking/input setup, durable project history, installed packaging, multi-host-instance persistence and reactive simulation are staged explicitly. The first-frame, queue, control-authority and provenance contracts add necessary safety around the actual loop rather than replacing it.

This review accepts the planning conversation's U01–U09 record as supplied; it cannot independently reconstruct the original conversation. The preserved proposal is not proof that all of its recommendations were user choices. The decision log and clearly labeled subsystem proposals appropriately expose the coordinator's delegated choices.

Hardware inventory, external client image visibility, GPU transport/synchronization/color/alpha, independent process lifetime, performance budgets, packaged docking behavior, host control persistence and native audio/MIDI semantics remain unverified. Their designated gates are the right place to establish them. I did not verify linked external API/library claims or run hardware tests; those are not asserted by this product review. No missing later feature should be demanded in tracer merely to remove these explicit uncertainties.

The coordinator should record disposition of PROD-01 and PROD-02, finish the independent-review process, and commit the final documentation before application implementation, as required by DEC-12 and the planning finish line.
