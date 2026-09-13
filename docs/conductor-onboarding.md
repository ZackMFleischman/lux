# Lux Conductor onboarding

User grant: initialize and onboard Lux, find the active agent, and continue the two already authorized workstreams through Conductor. Execution coordinator remains Codex task 01a0993a-0e08-7ec2-9455-b85075bf2b1c (Identify parallel Lux workstreams). This task owns onboarding only.

Repository: C:/Users/zFlei/repos/lux; inspected main 2931f53a2322f0a243cbc1df3472bb4776820670. Initial dirty state: untracked .pnpm-store/ and visuals/; preserve both. Active linked worktrees: .worktrees/filesystem-projects and .worktrees/component-projects. Their live state is being reconciled with the coordinator.

Conductor home: C:/Users/zFlei/AppData/Local/Conductor. CLI 0.2.0-dev, schema 4, layers-v1. Initial discovery failed DISCOVERY_UNAVAILABLE because Git reported dubious ownership; retry with process-scoped safe.directory=C:/Users/zFlei/repos/lux succeeded with registered=false. No global Git configuration was changed.

Policy: ordinary ticket tracking, retaining existing code-review and evidence requirements in source plans. No new mandatory workflow gates or managed team imposed. Existing workers continue with distinct ordinary Conductor identities/sessions, attached by their current coordinator at safe checkpoints. This import grants no additional implementation scope, publishing, or human acceptance.

## Proposed source mapping

| Source | Intent/evidence | Disposition | Tickets | Remaining check |
| --- | --- | --- | --- | --- |
| docs/implementation/filesystem-projects-plan.md slices 1-11; docs/design/filesystem-projects.md; docs/reviews/filesystem-projects-review.md | Reviewed filesystem/Git plan, active implementation in existing worktree | Track remaining delivery by slice, preserve branch implementation evidence | Pending | Reconcile worker checkpoint before creating completed-foundation duplicates |
| docs/implementation/components-plan.md C01-C09; docs/design/components.md | C01 implementation/test record exists; review/integration and later slices need reconciliation | Track remaining slices with dependencies | Pending | Current coordinator confirms C01 integration state |
| docs/implementation/tracer-preview-closeout.md; PROGRESS.md; docs/implementation/progress.md; creative-workflow-checkpoint.md | Accepted preview scope with explicit evidence limits | Delivered historical context; do not manufacture done tickets | None | Keep host, portability and performance claims bounded |
| docs/implementation/tracer-preview-closeout.md runtime delivery, recovery, host QA, distribution, performance lanes | Remaining known work outside current two-lane execution | Preserved deferred scope in authoritative closeout | None | Separate execution grant before starting these lanes |
| docs/implementation/roadmap.md; docs/requirements.md; docs/decisions.md; docs/README.md; plans/ | Product requirements and later milestones, older sequencing amended by preview closeout and current user grant | Preserve source records and future scope; current two plans supply executable decomposition | None | No speculative feature expansion |

## Resume checkpoint

Onboarding identity/session/project/ticket: pending registration. No active claim. Before each Conductor mutation, save request key and exact CLI arguments in operations.jsonl and any payload beside it. Save successful response in results.jsonl. Initial namespace: lux-onboard-20260913-01a09967. Pending operation: init. Next safe action: run the saved init operation, inspect workflow/team/full ticket inventory, register onboarding identity/session, then reconcile imports and hand off returned IDs.

## Confirmed registration and expanded authorization

Registration succeeded: project **34723eb7-f57d-45c3-8831-adcb2bbfe485**, prefix LUX. Workflow is disabled (ordinary tracking); team list was empty; complete initial ticket list was empty with no cursor/truncation. No existing ticket or owner was overwritten.

User amendment after registration: this task carries on overall orchestration and advances the other two big roadmap workstreams, creative controls/inputs and reliability, alongside the existing two. User is going to bed and delegates routine decisions without questions. This supersedes roadmap workstreams 3/4 being paused. Plans/acceptance requirements remain authoritative; no numerical hardware gate is waived. Prior standing grant permits small reviewed/tested main merges. Remote push is not inferred.

### Final source-to-work mapping

| Source section | Current evidence and disposition | Conductor coverage | Remaining check |
| --- | --- | --- | --- |
| Filesystem plan Slice1 metadata1a | Branch commits 9a791d3 +22b2dae; 41 focused tests/typecheck reported; independent review found numeric-key hash bug then scoped re-review passed. Remaining integration only imported | LUX-6 under LUX-2 | Existing coordinator integrates and records exact main evidence |
| Filesystem plan Slice1 service DTO remainder1b | Not delivered by metadata1a; explicitly remaining | LUX-2 | Prepare leaf after actual contracts/prerequisites |
| Filesystem plan Slice2 read-only native capture2a | Reviewed exact native brief and race/lifecycle criteria frozen into ticket | LUX-7 under LUX-2; depends LUX-6 | Fresh worker claim; physical native evidence |
| Filesystem plan Slice2 writer/save2b | Explicitly excluded from2a, remaining | LUX-2 | Prepare against verified native boundary |
| Filesystem slices3/4 | Resolver/exact package closure and offline types/tooling remain | LUX-2 | Frozen contracts and reviewed leaf plans |
| Filesystem slices5/6/7 | Store/recovery, buffers/external edits, stage/apply remain | LUX-2 | Native boundary, resolver, precise service DTOs |
| Filesystem slices8/9/10/11 | CLI/MCP, Studio, library/interchange/Git, final acceptance remain | LUX-2 | Source-plan dependency graph and combined real workflow evidence |
| Component C01 | Delivered at main2931f53; implementer and fresh review PASS, coordinator reran 82 tests and both typeconfigs; internal metadata only | Historical evidence in LUX-3, no manufactured done ticket | Executable/public/GPU claims remain excluded |
| Component C02 first internal image bridge | Reviewed proposal and project-v1 SDK gate amendment frozen in ticket | LUX-8 under LUX-3; depends LUX-6 | Internal CPU worker evidence; public admission stays0.1/0.2 |
| Component C02 broader resources, C03/C04 | Resource extensions, scheduler, real worker/node lifecycle and public capability remain | LUX-3 | Freeze preceding integrated interfaces; serialize GPU evidence |
| Component C05/C06 | Graph persistence and UI/MCP remain | LUX-3, cross-lane prerequisites LUX-2 | Filesystem stage/apply/closure required |
| Component C07/C08/C09 | 3D/effects, library/groups/overrides, publishing/offline graph release remain | LUX-3 | Source-plan prerequisites; filesystem pins and installed closure |
| Roadmap workstream3 / 0.3 /4; runtime/Studio/project designs | Newly authorized controls/inputs lane; first implementation requires prepared independent review | LUX-4 and planning leaf LUX-9 | Whole-lane ordered plan plus first bounded CPU foundation |
| Roadmap workstream4; tracer closeout reliability lanes and preserved raw runs | Newly authorized reliability lane; existing pending branch/evidence reconciliation precedes new fixes | LUX-5 and planning leaf LUX-10 | Frame freshness/stop/recovery, hardware/clean-machine limits remain explicit |
| Preview closeout; PROGRESS; implementation progress; creative checkpoint | Accepted preview and prior parameters/assets/editor/MCP work are delivered historical scope with exact recorded limits | Preserved historical context, no duplicate implementations | Do not upgrade unit/launcher evidence to host/performance acceptance |
| Requirements, decisions, source plans, remaining roadmap | Definitions and original records preserved; unselected later effect-export/general-polish milestones remain future context | No speculative leaf import; four epics cover current authorized scope | Separate preparation before new feature dispatch |

### Coordination and ownership

Existing task: 01a0993a-0e08-7ec2-9455-b85075bf2b1c, title Identify parallel Lux workstreams. Stable coordinator lux-creative-coordinator-01a0993a, agent70a02df3-167b-46c7-913c-49d83b6a871f, session219f0a8c-88c4-4669-8134-a566b9bd7de2. It confirmed migration, retained both lanes, and will use fresh identities/sessions/claims for LUX-7/8. Its old first-slice children are idle. This task is overall coordinator for all four lanes; no retroactive managed launch will be invented for the healthy existing coordinator.

Reserved first integration window: existing coordinator owns LUX-6 on shared main, while this task changes only docs/conductor-onboarding*. Next integrations and every GPU/Studio/Resolume session require root slot arbitration. CPU/native filesystem tests may run independently. C02 owns the narrow project-v1 SDK gate plus its listed compiler/worker changes. Filesystem2a does not edit project contracts. New reliability/inputs plans must avoid those shared files until agreement.

Onboarding identity471445bc-9f1c-4c77-8e8a-3681e5bc95b4; session504a493d-3c7b-4562-846b-5b916f9b1bf4; ticket LUX-1; claim502bd021-88ed-4d09-88fb-75dd6e8ab375. Shared checkout is intentional for docs/tracker-only work; PRIMARY_CHECKOUT warning acknowledged. Mutation requests/payloads/results are in conductor-onboarding/. Operations are sequential and persisted before calls; each successful ticket ID was saved immediately. The invoke helper is a synchronous CLI journal, not a background launcher.

Next safe action: verify actual ticket descriptions/dependencies; submit onboarding checkpoint and stop its session. Start a distinct overall orchestration session, persist a managed-run profile and launch intents for fresh new-lane planning/review contexts. Existing two-lane coordinator remains ordinary tracked work. Full lane completion is not implied by registration or plan readiness.
