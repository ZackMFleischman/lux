# Four-workstream orchestration checkpoint

The user designated this task as the sole coordinator on 13 September 2026 and authorized autonomous execution of all four roadmap workstreams. Routine implementation, review and integration decisions remain delegated. The phone portal works; leave its service running and spend no further work on it.

## Ownership and current delivery

Conductor project: `34723eb7-f57d-45c3-8831-adcb2bbfe485` (LUX). Coordinator identity: `77de5ef7-a72d-43f2-8d3b-8dabbaef06f1`; live session: `27df4cd0-6ac6-41b1-b1ae-41af49240d64`; run: `345554f0-0896-4ea2-8fb4-942317f65fda`. The current registry and actual native host observations are authoritative; source checkpoints are historical snapshots.

Every Lux ticket has an assignee. Root owns the four epics and integration tickets. Each new delivery leaf is assigned before launch; its fresh worker claims only that ticket in its recorded worktree. Reviewers use distinct identities and preserve source/plan evidence. The unassigned-ticket query returned an empty, non-truncated result during this checkpoint.

| Workstream | Reviewed and integrated foundation | Current and next delivery |
| --- | --- | --- |
| Filesystem projects, LUX-2 | Metadata/C01 and pure resolver integrated; LUX-24 accepted. Offline tooling plan revision 2 `b57a03112c428fd9c709e02da1f6867e1510e7d6` independently accepted and integrated. | LUX-31 T4a declaration-pack implementation assigned to `lux-tooling-pack-01a09967`, fresh active claim. Later editor/checker/repair/offline-host gates remain explicit; LUX-7 acquisition remains stopped. |
| Components, LUX-3 | C02 integrated and accepted as LUX-21. C03a graph validation/planning source `b9b6ccfc85c6ba48bdcf8db5833c56b99f01ce92` independently accepted as LUX-30, merged `b0396b0a31ff9f9afee5c508c7b39b0370023f1e`. | LUX-34 records exact main integration validation. C03b nesting, C03c scheduler/resources and C03d feedback require separate reviewed plans; no graph execution profile is exposed. |
| Creative controls and inputs, LUX-4 | I01 mapping and I02a timed mapping integrated and accepted. I02b live timeline plan `51be85efff6be452a361e18e2b9124249bf3d9f5` independently accepted and integrated. | LUX-32 assigned to `lux-live-timeline-01a09967`; source `4121e179353efa8064c48f6218e7772158c77ca8` passed worker checks, pending independent source review and root integration. Replay/runtime/device adapters remain later leaves. |
| Reliability, LUX-5 | R1 diagnostics and R2a source ownership integrated, LUX-18/LUX-28 accepted at main `3003a407cbd371ef89cd1ce018c76a2104a7c7a0`. R2b timing plan `8e97f9263928ee28a9c38119b7d99e093cacf291` independently accepted and integrated. | LUX-33 bounded native timing assigned to `lux-receiver-timing-01a09967`; isolated worktree and 203 vendor source hashes prepared. Package/paired graphics/performance gates remain separate. |

The former task **Identify parallel Lux workstreams** (`01a0993a-0e08-7ec2-9455-b85075bf2b1c`) and its transferred children stopped their sessions and released claims. Preserve `.worktrees/_coordination/final-coordinator-handoff.md`; do not resume that coordinator or its stopped sessions. The immutable active run profile retains the historical two-coordinator wording, superseded by the explicit user direction above. Its current limit is five contexts including root and the required workflow improver. Do not silently change that profile or infer extra capacity from old external reservations.

## Validation and remaining boundaries

Source acceptance and integration acceptance are separate. Root integrates serially and records the exact landed commit plus source comparison and focused validation. Root integration decisions are ordinary integrator verification; their cited independent source reviews remain distinct evidence.

- C02 main validation: 27 compiler/runtime tests, Studio CPU groups 137+16+27+21, 100 project/export/asset/input/parameter checks, both TypeScript configurations. Groups overlap; these are per-command counts, not unique-test totals. All 37 changed paths matched the accepted source.
- Resolver plus C02 main validation: 97 project checks, both TypeScript configurations, five compiler cases including ten real contained resolver compilations and component identity/admission regressions. Original helper diagnostics retain exact TS2322 paths at line 2, column 14. All eleven resolver source paths matched.
- I02a main validation: 55 focused tests and a strict TypeScript declaration fixture against main. Independent source review additionally retained 432 comparisons with the original mapping behavior. All four source paths matched.
- R1 main validation: pinned Release DLL and CPU targets built, five native CPU checks and seven cadence/options tests passed. The options test executed only `--validate-options`, which returns before graphics. This exception does not authorize host playback.
- R2a main integration LUX-28: seven pinned Release targets built, six native CPU checks passed, five accepted source paths and 203 vendor hashes matched. Source and main evidence remain distinct; no graphics or performance claim.

C02 remains an internal sealed root-output profile. Public Studio/MCP/project-v1/export admission continues to support existing SDK0.1/0.2 behavior. No graph execution, persisted graph, live input device or new author-facing skill capability is claimed. Later author-facing SDK/source/assets/MCP work must update the repository skill and reinstall/check it.

LUX-7 remains blocked at its recorded host safety stop. Preserve partial native filesystem files and evidence. No retry, rephrasing or substitute execution of that stopped native acquisition task is authorized by this checkpoint. The pure resolver and offline coding-kit work are independent roadmap slices.

No GPU/Studio/Resolume reservation is active. Native CPU compilation is distinct from hardware acceptance. The R2b paired diagnostic, physical shutdown/recovery, sustained freshness/performance, real-host behavior and clean-machine distribution gates remain incomplete until their actual setups and raw evidence exist. Never lower their numerical targets, replace fresh images with callback opportunities, or describe a private development directory as a clean machine.

- C03a integration LUX-34: all seven accepted source hashes matched; 83 graph/bridge/input/parameter checks, 97 project checks, nine component compiler/declaration checks and both TypeScript configurations passed. Independent source review also ran 64 generated DAG comparisons. Diagnostic-path truncation was corrected with a reproduced red/green regression before acceptance.

## Resume protocol and durable evidence

Before the first repository operation, use the installed Conductor executable and home with `require_escalated`, including discovery. Set process-local exact current-checkout Git trust for discovery. All location-sensitive Git calls use matching `-C CHECKOUT -c core.excludesFile= -c safe.directory=CHECKOUT`; no global or wildcard trust. Shared Git metadata writes require scoped escalation and checked native exit codes.

Read `docs/conductor-onboarding/team-start.json`, current `team show`, and actual native host states. Preserve `operations.jsonl`/`results.jsonl`, exact request payloads and successful claim receipts. A compacted summary may abbreviate an ID; retrieve the original receipt rather than inventing or reclaiming ownership. `TEAM_NOT_READY` is an explicit rejection: reconcile stopped native hosts and sessions, then make a fresh logical launch request. Unknown starts consume capacity.

A new managed context starts a fresh session, registers against the persisted launch, receives a real active observation, and sends its own current epoch/challenge ACK. Check dynamic `ready` and `readiness_issues` before its one claim attempt. A worker submission alone does not free its slot: inspect actual host completion and stopped session before a terminal observation. Healthy contexts are reused; stopped implementation attempts are not revived.

Serialize each managed worker startup through its actual successful ticket/session/claim receipt before recording another child launch. Own ACK and a ready snapshot alone can race with a new launch and spend the only claim attempt (LUX-P26). Stop/reconcile a failed attempt and use a fresh context; never retry it. Use distinct operation keys for agent registration and team binding (LUX-P27).

Applicable startup correction records and their provenance are retained at `.worktrees/_coordination/lux-improver-01a09967/validated-corrections.txt`. Select matching records into each fresh assignment. Keep the required improver quiet except actionable delivery blockers; no new workflow projects are requested. Preserve all raw logs, failed attempts, source worktrees, `.pnpm-store/`, `visuals/` and review artifacts.

Integration journals and raw logs live under `docs/conductor-onboarding/`; independent reviews under `.worktrees/_coordination/reviews/LUX-*/`; source workers retain their own ignored evidence locations linked by tickets. Current Conductor tickets bind exact commits, criteria and evidence; do not infer completion from this checkpoint alone.
