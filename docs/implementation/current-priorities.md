# Current implementation order after standalone QA

2026-09-12. This sequencing addendum reconciles [tracer 0.1](tracer-0.1.md), the user-approved [standalone pivot](standalone-lux.md), and subsequent UI requests. It supersedes conversational suggestions to start the source editor immediately after adding MCP controls. It does not rewrite the original tracer's acceptance criteria or declare unavailable gates passed.

## What the evidence establishes

- Standalone compilation/rendering/control/capture/save-reopen and automated MCP regression have passed; latest recorded full rerun is 5a53e82. Transport button pending-style fix 783c7fb passed CPU checks and still needs its final visual check.
- User relayed an external agent session that created and inspected shapes, revised colors/count/spacing, rejected invalid TypeScript and continued rendering with intensity 0.42. This supports the real AI loop; preserve the actual transcript, source hashes and image pair before treating that report as the full TR-04 evidence package.
- That agent stalled when Studio was paused because the standalone MCP adapter lacks playback/parameter methods. This is an operation-access gap, not a need for more editor UI.
- Current gauges report unavailable rather than providing completed performance acceptance. The standalone five-second initialization rejection test does not prove the original two-second watchdog stop requirement.
- Source editor, multi-file navigation and AI activity log are designed, not implemented. Explicit .lux-scene save/reopen is not milestone 1 durable project history, transactions or autosave.
- Another agent owns transport experiments. Its latest results were not inspected in this sequencing task. Do not infer TR-02/TR-06 completion or restart its hardware tests from the standalone successes.

## Ordered work

| Order | Work and completion condition | Original plan mapping |
| --- | --- | --- |
| 1 | Expose Studio playback (play/pause/reset), intensity, and explicit restart through the MCP adapter using the existing guarded runtime operations. Discover reports capabilities; status/read exposes current playback. Validate finite values, authority, revision/generation and failure responses. Test initially paused → play → pause → intensity → capture, plus reset/restart and stale-command rejection. | TR-03 runtime controls; TR-04 shared operations; TR-05 usable thin Studio |
| 2 | Close the thin Studio QA checkpoint: visually verify pending-button styling and record the successful external AI transcript/source/images. Run affected regressions, not an unrelated broad UI expansion. | TR-04 actual AI evidence; TR-05 interaction evidence |
| 3 | Audit and close standalone-applicable lifecycle, concurrency and failure gaps against tracer-acceptance.md. Prioritize capture/revision/control races, runtime exceptions, confirmed termination of hanging code, restart, bounded queue/resource cleanup, and presentation continuity. Identify actual implementations before marking any contract covered. Explicitly resolve the five-second initialization deadline versus the two-second stop gate; do not relabel timeout evidence as compliance. | TR-03/04 recovery and frame ownership; TR-05 presentation lifetime |
| 4 | Implement/validate the minimum performance instrumentation and acceptance collection: real delivery, CPU/GPU timing where available, UI/control response, calibration/coverage and overhead. Run CPU evaluator fixtures before hardware measurements. Produce a per-gate accepted/deferred/failed/unavailable matrix with raw evidence. Full Performance panel is not required. | TR-03 collector; TR-04 shared status; TR-07 measured acceptance |
| Parallel host lane | Obtain the transport agent's commit/evidence and integrate only reviewed work. Required order within that lane: GPU/image correctness feasibility → explicit artifact activation and native control → independent lifetime/recovery → measured host acceptance. Serialize GPU/host runs with Studio tests. | TR-02 → host portions of TR-03 → TR-06 → TR-07 |
| 5 | Review/sign off the scoped standalone checkpoint and separately reconcile the original full tracer. Full 0.1 completion requires host lane plus all applicable TR-07 gates; a standalone sign-off explicitly lists excluded host requirements. | TR-07 review, evidence manifest and handoff |
| 6 | Follow-on foundations: durable scene/artifact identity and host lifecycle (0.2), reactive simulation/input contracts (0.3), then durable safe project edits/history (1) in the original full-product sequence. Under the existing standalone-first pivot, project transaction/undo work can proceed independently while host-specific stages remain pending; label this as parallel scope, not completion of 0.2/0.3. | Roadmap 0.2, 0.3, 1 |
| 7 | Implement source-workspace plan as an editor workstream after core acceptance gaps are resolved. Small syntax-highlighting-only polish may be pulled forward if it does not displace those gates. Full multi-file editing must preserve whole-bundle concurrency/save semantics; multi-Scene/shared-definition UX integrates only with actual project/graph contracts. | Incremental editor polish; milestone 1 storage and 2 graph dependencies |
| 8 | Graph/compositing, Inspector and initial Library; richer inspection afterward. Use ordinary dockable panes when full docking lands. | Milestones 2 → 3 |
| 9 | Complete flexible layout, Library/Inspector/Source docking, embedded chat, inputs/settings and preview tooling. AI Activity remains low-priority polish here. | Milestone 4 |
| 10 | Immutable standalone performance release, packaging/install, offline host lifecycle and sustained benchmarks. | Milestone 5 |

Tasks 3 and 4 can overlap after shared interfaces agree; instrumentation must land before claiming measured acceptance. Documentation and CPU-only test improvements may proceed while the exclusive hardware lane runs. Do not make host progress a prerequisite for fixing the standalone MCP pause gap, and do not use the standalone pivot to erase the remaining original tracer gates.

## Immediate next implementation task

Implement the missing standalone MCP control adapters and their regression tests. Do not begin CodeMirror, Dockview, graph UI, or the activity log as part of that patch. Keep user playback intent: building a revision does not implicitly authorize starting a paused scene; the agent explicitly requests play when its task calls for animation.

Update this order from integrated evidence, not an agent's unverified progress message. No application was launched and no native branch was changed to prepare this addendum.
