# Four-workstream orchestration checkpoint

The user designated this task as the sole coordinator on 13 September 2026 and authorized autonomous execution of all four roadmap workstreams. Routine implementation, review and integration decisions remain delegated. The phone portal works; leave its service running and spend no further work on it.

## Ownership and current delivery

Conductor project: `34723eb7-f57d-45c3-8831-adcb2bbfe485` (LUX). Coordinator identity: `77de5ef7-a72d-43f2-8d3b-8dabbaef06f1`; live session: `27df4cd0-6ac6-41b1-b1ae-41af49240d64`; run: `345554f0-0896-4ea2-8fb4-942317f65fda`. The current registry and actual native host observations are authoritative; source checkpoints are historical snapshots.

Every Lux ticket has an assignee. Root owns the four epics and integration tickets. Each new delivery leaf is assigned before launch; its fresh worker claims only that ticket in its recorded worktree. Reviewers use distinct identities and preserve source/plan evidence. The unassigned-ticket query returned an empty, non-truncated result during this checkpoint.

| Workstream | Reviewed and integrated foundation | Current and next delivery |
| --- | --- | --- |
| Filesystem projects, LUX-2 | Metadata/C01 main `f95f397`; pure resolver source `e1c8707fe2dd589be084964bda9302f755ed82bb`, integrated as `f1bbe51a42506dc94ff0e03c7fb8806065a9d705`, LUX-24 accepted | LUX-25 offline coding-kit plan, assignee `lux-offline-tooling-plan-01a09967`; fresh independent critique precedes implementation. File acquisition/store/buffers/stage/apply remain separate. |
| Components, LUX-3 | C02 source `e28a5a8142074463a7aec0309cc81cd6a2977707`, integrated as `c4bdd33a4b38b258fd0a83c5828d20d312fb3e46`, LUX-21 accepted | LUX-23 C03 graph plan source `f9a30161abf24c4f0cf5e90896cdd22a2f1ba337` is under independent critique. Root owns review dispositions; only the exact approved first leaf may be dispatched. |
| Creative controls and inputs, LUX-4 | I01 mapping source `fab83026`, LUX-16 accepted; I02a timed mapping source `cf09ece81d09279595ab2cfdcc2b392f3b6f1015`, integrated as `7cff0e571731dd8778765093a98f4c4b5867dbdf`, LUX-26 accepted | LUX-27 prepares I02b live timeline, assignee `lux-live-timeline-plan-01a09967`. Replay, runtime adapters and device sources remain later reviewed leaves. |
| Reliability, LUX-5 | R1 source `c17e679824a0fed79ce52621a0df4fe85cd659d7`, main `d101a16483e354a3612806eb03cbc1107785bc25`, LUX-18 accepted | R2a ownership source `b07888e158773483ad65f94ef29bba3f2b22d063` independently accepted as LUX-22; LUX-28 records its main integration and final native validation. R2b timing/package/paired graphics preparation remains open. |

The former task **Identify parallel Lux workstreams** (`01a0993a-0e08-7ec2-9455-b85075bf2b1c`) and its transferred children stopped their sessions and released claims. Preserve `.worktrees/_coordination/final-coordinator-handoff.md`; do not resume that coordinator or its stopped sessions. The immutable active run profile retains the historical two-coordinator wording, superseded by the explicit user direction above. Its current limit is five contexts including root and the required workflow improver. Do not silently change that profile or infer extra capacity from old external reservations.

## Validation and remaining boundaries

Source acceptance and integration acceptance are separate. Root integrates serially and records the exact landed commit plus source comparison and focused validation. Root integration decisions are ordinary integrator verification; their cited independent source reviews remain distinct evidence.

- C02 main validation: 27 compiler/runtime tests, Studio CPU groups 137+16+27+21, 100 project/export/asset/input/parameter checks, both TypeScript configurations. Groups overlap; these are per-command counts, not unique-test totals. All 37 changed paths matched the accepted source.
- Resolver plus C02 main validation: 97 project checks, both TypeScript configurations, five compiler cases including ten real contained resolver compilations and component identity/admission regressions. Original helper diagnostics retain exact TS2322 paths at line 2, column 14. All eleven resolver source paths matched.
- I02a main validation: 55 focused tests and a strict TypeScript declaration fixture against main. Independent source review additionally retained 432 comparisons with the original mapping behavior. All four source paths matched.
- R1 main validation: pinned Release DLL and CPU targets built, five native CPU checks and seven cadence/options tests passed. The options test executed only `--validate-options`, which returns before graphics. This exception does not authorize host playback.
- R2a independent source review: seven Release targets built, six native CPU checks passed, 37 native/test source files and 203 vendor files verified, active Release assertions checked. LUX-28 owns new landed-main evidence; source review is not that evidence.

C02 remains an internal sealed root-output profile. Public Studio/MCP/project-v1/export admission continues to support existing SDK0.1/0.2 behavior. No graph execution, persisted graph, live input device or new author-facing skill capability is claimed. Later author-facing SDK/source/assets/MCP work must update the repository skill and reinstall/check it.

LUX-7 remains blocked at its recorded host safety stop. Preserve partial native filesystem files and evidence. No retry, rephrasing or substitute execution of that stopped native acquisition task is authorized by this checkpoint. The pure resolver and offline coding-kit work are independent roadmap slices.

No GPU/Studio/Resolume reservation is active. Native CPU compilation is distinct from hardware acceptance. The R2b paired diagnostic, physical shutdown/recovery, sustained freshness/performance, real-host behavior and clean-machine distribution gates remain incomplete until their actual setups and raw evidence exist. Never lower their numerical targets, replace fresh images with callback opportunities, or describe a private development directory as a clean machine.

## Resume protocol and durable evidence

Before the first repository operation, use the installed Conductor executable and home with `require_escalated`, including discovery. Set process-local exact current-checkout Git trust for discovery. All location-sensitive Git calls use matching `-C CHECKOUT -c core.excludesFile= -c safe.directory=CHECKOUT`; no global or wildcard trust. Shared Git metadata writes require scoped escalation and checked native exit codes.

Read `docs/conductor-onboarding/team-start.json`, current `team show`, and actual native host states. Preserve `operations.jsonl`/`results.jsonl`, exact request payloads and successful claim receipts. A compacted summary may abbreviate an ID; retrieve the original receipt rather than inventing or reclaiming ownership. `TEAM_NOT_READY` is an explicit rejection: reconcile stopped native hosts and sessions, then make a fresh logical launch request. Unknown starts consume capacity.

A new managed context starts a fresh session, registers against the persisted launch, receives a real active observation, and sends its own current epoch/challenge ACK. Check dynamic `ready` and `readiness_issues` before its one claim attempt. A worker submission alone does not free its slot: inspect actual host completion and stopped session before a terminal observation. Healthy contexts are reused; stopped implementation attempts are not revived.

Applicable startup correction records and their provenance are retained at `.worktrees/_coordination/lux-improver-01a09967/validated-corrections.txt`. Select matching records into each fresh assignment. Keep the required improver quiet except actionable delivery blockers; no new workflow projects are requested. Preserve all raw logs, failed attempts, source worktrees, `.pnpm-store/`, `visuals/` and review artifacts.

Integration journals and raw logs live under `docs/conductor-onboarding/`; independent reviews under `.worktrees/_coordination/reviews/LUX-*/`; source workers retain their own ignored evidence locations linked by tickets. Current Conductor tickets bind exact commits, criteria and evidence; do not infer completion from this checkpoint alone.
