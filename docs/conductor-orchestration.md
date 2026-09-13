# Four-workstream orchestration checkpoint

The user designated this task as the sole coordinator on 13 September 2026. All four roadmap workstreams are authorized. The coordinator can make routine implementation, review and integration decisions. The phone portal works. Leave its service running.

## Next usable milestones

The user corrected the delivery workflow on 13 September 2026. Internal progress
had outpaced usable features. The rules in `../AGENTS.md` now govern dispatch.
Keep these targets in the four parent tickets. They are next outcomes, not claims
of completed features or permission to bypass their prerequisites.

| Workstream | Next user action and demonstration | Defer until needed |
| --- | --- | --- |
| Filesystem, LUX-2 | Edit one scene's TypeScript file, apply it in Lux, and see the change. Show the file diff. Reject an invalid edit while keeping the last working preview and the user's files. | Toolchain upgrades and downgrades, broad version support, and extra proposal systems. Resolve the native file-access blocker before claiming the real file workflow works. |
| Components, LUX-3 | Compose two existing components in a real preview. Change one instance's control and show that the other instance keeps its value. Use the smallest supported authoring path; a full graph editor is not required for this first demonstration. | Library discovery, grouping, broad graph UI and further reusable frameworks unless this example needs them. |
| Inputs, LUX-4 | Map one MIDI knob to one declared visual control and show the response in Studio. Check that manual control still works after disconnect. If hardware is unavailable, label the device demonstration blocked; a synthetic signal is development evidence only. | Recording, transcript extensions, replay and macros unless the first live mapping needs them. |
| Reliability, LUX-5 | Restart one failed installed visual and show a fresh image with its last control value. Preserve the existing stop and recovery targets and verify actual process cleanup. | Broader benchmark and diagnostic frameworks that do not help this case. Native provenance and physical-test gates still apply. |

Before another delivery launch, reconcile unavailable hosts and map retained code
to the shortest path for these demonstrations. LUX-81 and LUX-84 contain submitted
code; inspect and review useful code without automatically extending their old
plans. LUX-85 is a recording plan, not a reason to implement recording next.
LUX-87 is deferred pending a concrete need from the filesystem demonstration.
Preserve submitted commits, old decisions and original evidence.

For each selected child, record four short items: user result, why this task is
needed now, demonstration or connection point, and excluded extensions. Use the
existing ticket and checkpoint fields. Do not create a separate reporting system.
After each accepted slice, update feature status and reassess the remaining path.
Report usable, implemented but not connected, or planned, with any blocker stated
separately. A successful CPU test does not establish a real user demonstration.

## Ownership and historical delivery snapshot

Conductor project: `34723eb7-f57d-45c3-8831-adcb2bbfe485` (LUX). Coordinator identity: `77de5ef7-a72d-43f2-8d3b-8dabbaef06f1`; live session: `27df4cd0-6ac6-41b1-b1ae-41af49240d64`; run: `345554f0-0896-4ea2-8fb4-942317f65fda`. The current registry and actual native host observations are authoritative; source checkpoints are historical snapshots.

Every Lux ticket has an assignee. Root owns the four epics and integration tickets. Each new delivery leaf is assigned before launch; its fresh worker claims only that ticket in its recorded worktree. Reviewers use distinct identities and preserve source/plan evidence. The unassigned-ticket query returned an empty, non-truncated result during this checkpoint.

| Workstream | Reviewed and integrated foundation | Current and next delivery |
| --- | --- | --- |
| Filesystem projects, LUX-2 | Metadata, resolver, T4a declaration pack and T4b editor plan are integrated. LUX-60 fixed the versioned SDK path prerequisite. LUX-63 integrated that fix at `a01f21be260bca525dc365869d243337399de334`. | LUX-57 is in fresh source review at `dfeadf66fd77338e39971fb78c778ac4640a252e`. It corrects missing SDK diagnostic context and unsafe handling of thrown values. The earlier failures remain recorded. Lock upgrades, guarded file writes and actual offline-host checks remain later work. |
| Components, LUX-3 | C02, C03a/b and C03c1 are integrated. LUX-68 adds the reviewed resource reservation ledger. LUX-71 integrated it at `6352ad9cf3a3ff3da90425f4a3827ed9702ffc07`. | LUX-72 is assigned and queued. It will prepare the resource-host plan against the delivered ledger. Backend ownership, scheduling, reset, promotion and graph execution remain later work. |
| Creative controls and inputs, LUX-4 | Mapping, live timeline and scripted fixture foundations are integrated. The cursor reentry defect is fixed. LUX-65 integrated the accepted cursor at `0725c7d6fed9969d1f43a46852049e6218c3ce1e`. | LUX-67 is in independent plan review at `4efc3929d5a42cd4ea43da2c4271964a8907fd35`. It defines a separate live transcript format and importer. Recording adapters, devices and runtime capture remain later work. |
| Reliability, LUX-5 | R1, R2a, R2b-a, receiver comparison plan and input inventory are integrated. LUX-69 integrated the reviewed installed recovery plan at `9e7c9413843dc3fb8def7b5d81c7cc15fc7b640e`. | LUX-70 is in independent source review at `d0f01ec588b2a0b997bbb766ba1c4674d0003880`. It adds an internal restart-intent ledger. Production wiring, native authentication and physical recovery checks remain later work. LUX-59 still blocks receiver package preparation because input provenance is unresolved. |

This table is a status snapshot. Read the tracker and `docs/conductor-onboarding/current-dispatch-checkpoint.json` before the next dispatch. A same-task follow-up checks the run every 15 minutes. It does not replace the live agent and claim checks.

Use Simplified Technical English where it helps in new or updated tickets, plans and handoffs. Write short sentences. Use one clear action per sentence and consistent technical terms. Put IDs, hashes, paths and evidence in separate fields. Preserve exact API names, error codes and acceptance requirements. Do not rewrite historical evidence or claim formal STE compliance.

The LUX-57 correction handoff omitted the CLI `--commit` option. Its submission summary and evidence both identify the full source commit shown above. Its separate `submitted_commit` field is empty. The fresh reviewer must verify the original handoff, actual source and current specification, then record the exact commit in the ordinary structured decision. Preserve the missing field as a handoff defect. Do not change the old record, revive the worker session or infer acceptance from CLI permissiveness.

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
- I02b integration LUX-36: all four accepted source hashes matched; mapping owners unchanged; 78 timeline/mapping/parameter checks and the strict declaration fixture resolving main passed. Independent source review separately ran six additional probes. This validates the internal pure contract, not provider or runtime delivery.
- R2b-a integration LUX-40: six changed source paths, 39 native input paths and 203 vendor files matched; eight pinned Release targets, seven native CPU tests and sixteen JS tests passed against freshly generated main fixtures. Binary/fixture hashes are retained. A late output flush failure remains producer status that a row-only inspector cannot infer; later package evidence must preserve it.
- C03b integration LUX-44: six reviewed hashes matched; 63 nested graph/C03a/bridge checks and both TypeScript configurations passed. Independent source review additionally checked 16 generated nested diamonds and exact expansion cap counts. Pure planning output does not execute a graph.
- T4a integration LUX-45: four reviewed hashes matched; 109 project checks, both TypeScript configurations and all four compiler tests passed on main. Pack `dfaf8c5acf0cbeec8ce2263a78c75d5cebb3b1320839754768d414709527f6c1` contains 1330 payload files, with 1305 declarations, 4030 edges, 9159 concrete metadata rows, eight original wildcard branches and 108 separately checked standard libraries. Missing-dependency, SDK-widening and metadata mutations remain retained evidence. This is a development-host audit, not isolated offline-host acceptance.
- I02c1 integration LUX-49: four source and four unchanged owner hashes matched; 101 focused tests, strict declarations and both TypeScript configurations passed. This is a verified fixture contract, not a replay runtime.
- C03c1 integration LUX-58: four source and nine unchanged owner hashes matched; 84 focused tests with no skips and both TypeScript configurations passed. Independent source review separately checked 320 RNG cases, malformed descriptor paths, forged capabilities and negative types. This evidence covers the runtime-plan and RNG foundation only.
- SDK path prerequisite integration LUX-63: two source and five unchanged owner hashes matched. All 116 project tests and both TypeScript configurations passed. The retained 1330-file declaration pack also passed the actual metadata admission path. Generic project-path validation remains unchanged.
- Scripted cursor integration LUX-65: four source and eight unchanged owner hashes matched. All 183 focused tests, both TypeScript configurations and strict declarations passed. Root also ran the reviewer-authored 960 endpoint comparisons and nine reentry cases against main. Live recording and runtime delivery remain separate.
- Resource ledger integration LUX-71: two source and thirteen unchanged owner hashes and lengths matched. All 114 combined CPU tests and both TypeScript configurations passed. Seven reviewer-authored probe groups also passed on main, including 12,000 modeled operations. This evidence covers the reservation ledger. It does not cover a resource host or scheduler.
- Installed recovery plan integration LUX-69: the document and all eleven owner hashes and lengths matched. The source review separately ran 38 CPU tests and four owner probes. The document merge delivers a plan, not an installed Restart action.
- Receiver comparison plan review LUX-41 is conditional preparation authority. LUX-48 independent review rehashed the retained Node/archive, dependency topology, source, FFGL, Electron candidate, system/tool inputs and indexed raw artifacts; this accepts the bounded investigation, not build readiness. Before any future authorized preparation Node command, contain process TEMP/TMP under its artifact directory and preserve native fixture filenames so all sixteen JS checks run.

LUX-59 later read-only findings on 13 September 2026 are retained in `docs/conductor-onboarding/receiver-recovery-investigation.md`. The [official Node 24.20 checksum metadata](https://nodejs.org/dist/v24.20.0/SHASUMS256.txt) matches retained headers archive `7b2141e77e66ab23ead6b200c546afc5837136e3075d8a3ac5a67e540dcc59c1`. Retained `node.lib` hash `fc08ff294c2db5f0c9184a60ba52aa756fdada5b458108b6eda2308a3da5e48f` differs from official x64 `63ec831bbf164d1b23197d6fac1944dfb146534e332889ca0755d250e8dedff9` and arm64. That difference does not establish its origin. The [official Electron release metadata](https://api.github.com/repos/electron/electron/releases/tags/v44.3.0) supplies the Windows x64 archive digest, but no matching retained archive/member comparison was established; the retained executable reports `NotSigned`. Main Electron `dist` remains absent. No distribution was downloaded, copied, executed or substituted, and current HTTPS checks do not supply historical acquisition receipts or signed-checksum verification. The original LUX-48 report remains unchanged.

## Resume protocol and durable evidence

Before the first repository operation, use the installed Conductor executable and home with `require_escalated`, including discovery. Set process-local exact current-checkout Git trust for discovery. All location-sensitive Git calls use matching `-C CHECKOUT -c core.excludesFile= -c safe.directory=CHECKOUT`; no global or wildcard trust. Shared Git metadata writes require scoped escalation and checked native exit codes.

Read `docs/conductor-onboarding/team-start.json`, current `team show`, and actual native host states. Preserve `operations.jsonl`/`results.jsonl`, exact request payloads and successful claim receipts. A compacted summary may abbreviate an ID; retrieve the original receipt rather than inventing or reclaiming ownership. `TEAM_NOT_READY` is an explicit rejection: reconcile stopped native hosts and sessions, then make a fresh logical launch request. Unknown starts consume capacity.

Use `ticket show` for revision, state and assignment. It does not return `claim_id`. Use the saved claim receipt and the existing session response to check active ownership. An absent ticket field does not mean that a claim was lost. Never make another claim attempt to resolve that absent field. Save large JSON responses to disk before parsing selected fields. Include `--commit FULL_SHA` in each new source submission, even when ordinary tracking makes that option optional.

A new managed context starts a fresh session, registers against the persisted launch, receives a real active observation, and sends its own current epoch/challenge ACK. Check dynamic `ready` and `readiness_issues` before its one claim attempt. A worker submission alone does not free its slot: inspect actual host completion and stopped session before a terminal observation. Healthy contexts are reused; stopped implementation attempts are not revived.

Serialize each managed worker startup through its actual successful ticket/session/claim receipt before recording another child launch. Own ACK and a ready snapshot alone can race with a new launch and spend the only claim attempt (LUX-P26). Stop/reconcile a failed attempt and use a fresh context; never retry it. Use distinct operation keys for agent registration and team binding (LUX-P27).

Applicable startup correction records and their provenance are retained at `.worktrees/_coordination/lux-improver-01a09967/validated-corrections.txt`. Select matching records into each fresh assignment. Keep the required improver quiet except actionable delivery blockers; no new workflow projects are requested. Preserve all raw logs, failed attempts, source worktrees, `.pnpm-store/`, `visuals/` and review artifacts.

Integration journals and raw logs live under `docs/conductor-onboarding/`; independent reviews under `.worktrees/_coordination/reviews/LUX-*/`; source workers retain their own ignored evidence locations linked by tickets. Current Conductor tickets bind exact commits, criteria and evidence; do not infer completion from this checkpoint alone.
