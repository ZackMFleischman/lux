# Next implementation checkpoints

Started 2026-09-12 after the successful guided Resolume QA. This is the active tracker; [overnight progress](overnight-progress.md) preserves the preceding work and manual observations. Integration: `.worktrees/tracer`, branch `codex/tracer-0.1`, starting commit `26fc023`.

## Live checklist

| Checkpoint | Status | Owner | Completion evidence / next action |
| --- | --- | --- | --- |
| C0: record the new work and isolate lanes | IN PROGRESS | Coordinator | Commit this tracker, create isolated worktrees and dispatch bounded tasks. |
| C1: recovery contract and automated failure validation | QUEUED | Recovery agent | Reconcile documented recovery policy with actual Studio/installed behavior, close a bounded verified gap, and report remaining native timing requirements. |
| C2: dockable Studio panes | QUEUED | Layout agent | Connect existing Dockview adapter to real Preview/Source/Inspector/Jobs, preserve application state, test layouts and real pane behavior. |
| C3: two distinct exported visuals and asset fixture | QUEUED | Coordinator | Prepare reproducible export fixtures with distinguishable visuals and a required asset; validate complete packages without touching the installed source. |
| C4: acceptance measurement audit | QUEUED | Performance agent | Map actual telemetry/evaluators to required gates; identify the next concrete implementation step without treating unavailable measurements as passes. |
| C5: independent review and integration | QUEUED | Coordinator + reviewers | Review each code lane, fix findings, integrate commits, run relevant combined CPU/type/build checks. |
| C6: graphics and host checkpoint | WAITING FOR C1–C5 | Coordinator | Serialize owned Studio QA with Resolume use. Native installation/replacement only with host closed; obtain missing host evidence without repeating passed basics. |

## Established baseline

- User installed the exported source, triggered it with Studio closed and observed approximately 1–2 second startup.
- Two copies played with independent controls; removing one did not interrupt the other.
- Coordinator verified all matching Resolume/Lux processes had exited. On reopen, user observed about one second startup per copy, restored Intensity 0.2/0.8 and continued independence.
- These are functional observations, not instrumented timing, cold OS-cache, offline/checkout-isolation or full performance acceptance.
- Blank thumbnails in Resolume's clip and property areas are scheduled as early 0.2 export usability in [roadmap](roadmap.md). Existing installed playback is left intact during this implementation batch.

## Constraints and decisions

- User explicitly authorizes parallel agents and worktree isolation. Independent implementations use separate worktrees; coordinator alone edits this tracker, dependency manifests and integration checkout.
- Ruling: run independent implementers in parallel despite the generic skill's serial default, following the user's explicit parallel-work instruction. Review and integration remain sequential.
- No agent launches Studio, Electron graphics, a native producer, or changes the real Resolume installation. Coordinator serializes graphics later. Resolume may still be running after manual QA.
- Preserve runtime ownership above pane mounts, preview-only fullscreen, source draft/undo, saved control intent, MCP guards, immutable releases and independent instance cleanup.
- Performance design and tracer acceptance remain authoritative. Request-to-ready is not confirmed termination or consumed-frame recovery; never weaken gates to make tests green.
- Library/Graph use the ordinary panel registry when implemented; do not add pretend graph/library contents to this shell change. Popout remains a separate presentation-lifetime feature.
- Each completed task records commits, exact tests and remaining limitations here. DONE means reviewed and integrated, not merely an agent's report.

## Task 1: recovery audit and bounded correction

Read `docs/implementation/studio-lifecycle-watchdog.md`, `docs/implementation/tracer-acceptance.md`, `docs/design/runtime.md` and actual Studio/installed supervisor implementations. Identify automatic retry versus explicit restart policy, storm suppression and owner cleanup. Implement the highest-priority bounded discrepancy that can be proved with CPU tests, preserving current controls and accepted source. Do not invent new automatic behavior where authority is ambiguous; record a concrete policy reconciliation for coordinator review. Own `apps/studio/src/standalone-client.ts`, associated lifecycle tests and a new `docs/implementation/recovery-checkpoint.md`; installed supervisor changes only if needed and explicitly reported. Do not touch Studio shell/layout, package manifests, or root tracker. Run focused red/green regression and affected CPU/type checks, commit and report actual coverage plus remaining physical-stop/GPU timing gaps.

## Task 2: connect dockable Studio panes

Use the approved `docs/implementation/layout-spike.md` and `docs/design/studio.md`. Find actual authoring entry in `apps/studio/src`; connect its existing real Preview, Source, Inspector and Jobs to the tested layout adapter. Retain React/MUI design system and RTL tests. Provide discoverable reopen-panel and desktop/laptop reset/save/restore actions; keep preview dominant on desktop and tab layout on laptop. Runtime/workspace/editor cache owners must survive close/reopen, tab selection and panel movement. Preserve native preview-only fullscreen and source actions/export/MCP status. Own shell/layout/presentation UI and focused tests; do not change standalone-client runtime policy, export implementation, dependencies, or shared test runner without coordinating. Use the existing dependency installation read-only. Run focused DOM/CPU, typecheck and build checks; no Electron/graphics launch. Report tests plus the exact remaining real drag/focus/CSP/presentation validation.

## Task 3: export fixtures

Coordinator prepares two distinct source releases and required-asset coverage using real compiler/export APIs. First inspect existing source/asset contracts. Add reusable checked-in fixtures and a bounded preparation/validation command where useful, producing artifacts in ignored output. Verify stable distinct identities and package closure without installing into the user's host. If current asset APIs cannot support the acceptance fixture, expose the specific gap and implement a bounded supported path or record it as an explicit checkpoint dependency; do not ship an unused asset and call that required-asset coverage.

## Task 4: measurement audit

Read performance design, tracer acceptance, existing telemetry and test evaluators. Produce `docs/implementation/performance-checkpoint.md` with a source-backed per-gate matrix: implemented collection, executed evidence, missing work, and ordered implementation steps. Distinguish counters, actual host coverage, calibration, GPU timing and measurement overhead. Focus the next patch proposal on one independently testable measurement gap. Read-only code audit; no graphics, no dependency changes, no root tracker edits. Commit the doc and report paths/most important gaps.

## Review and integration record

Preflight: tasks 1 and 2 share runtime/shell interfaces but own different files; layout must consume the existing client API without changing runtime policy. Task 3 uses export/fixtures only; task 4 reads all areas without mutating code. All four agree with the constraints above. Any interface change must be coordinated before integration.

No implementations dispatched yet. No new QA requested from the user.
