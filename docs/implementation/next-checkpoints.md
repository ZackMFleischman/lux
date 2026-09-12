# Next implementation checkpoints

Started 2026-09-12 after the successful guided Resolume QA. This is the active tracker; [overnight progress](overnight-progress.md) preserves the preceding work and manual observations. Integration: `.worktrees/tracer`, branch `codex/tracer-0.1`, starting commit `26fc023`.

**Current objective: real visual creation and workflow feedback.** User reprioritized this ahead of additional infrastructure. [Active order](current-priorities.md#active-order-creative-workflow-feedback-first) governs sequencing: creative-use checkpoint first, bounded UI work already underway, then fixes/features driven by observed use. Tracer release acceptance remains open and does not block an internal creative session.

## Live checklist

| Checkpoint | Status | Owner | Completion evidence / next action |
| --- | --- | --- | --- |
| C0: record the new work and isolate lanes | DONE | Coordinator | Tracker committed 4193818; recovery/layout worktrees dispatched from that base. |
| C1: recovery contract and automated failure validation | DONE (BOUNDED FIX) | checkpoint_recovery + independent review | Fix 5af0eb9 reviewed and integrated as 700ec5f; integrated 71 Studio CPU tests and real MCP workflow pass. Remaining retry/physical timing gaps in recovery-checkpoint.md. |
| C2: dockable Studio panes | DONE | checkpoint_layout + coordinator | Reviewed integration ced1a3b/88ced7e plus native-QA correction7f5bbed. Actual pointer drag/resize, exact saved bounds, original canvas/editor, desktop/laptop tabs and continuing GPU animation pass. Fullscreen/editor/export regression also passes; final review approved. |
| C3: two distinct exported visuals and asset fixture | PACKAGES PREPARED; ASSET GAP OPEN | Coordinator + independent review | 37d3102: real positive/negative compiler test passes; two99-file packages validate with distinct source/release hashes and shared runtime20c587d4. Reviewed with no blockers in bounded scope. Scene asset admission/resolution remains missing; no unused file is counted as an asset. |
| C4: acceptance measurement audit | DONE | Coordinator + independent review | 37d3102 adds performance-checkpoint.md; source-backed per-gate matrix reviewed. Next measurement implementation is offline validity/accounting core, then bounded native correlation/collection. |
| C5: independent review and integration | DONE (FIRST BATCH) | Coordinator + reviewers | Task and final batch reviews pass; two final harness suggestions applied and rerun successfully. Combined 71 Studio CPU + one real Dockview DOM test, Studio typecheck and native UI/MCP checks pass. |
| C6: graphics and host checkpoint | STUDIO PASS; DISTINCT-SOURCE HOST QA PENDING | Coordinator | Real Studio docking, fullscreen/editor/export and MCP checks pass; owned test windows closed. Prepared triangle/ring packages remain uninstalled and untested in Resolume. |
| C7: offline performance validity/evaluation core | FINAL REVIEW; CLOSEOUT ONLY | evaluator_review | cc764a2 fixes the final metadata collision; 19 evaluator tests/45 focused checks reported passing. Finish review/commit without starting telemetry work ahead of creative use. Hardware acceptance remains unavailable. |
| C8: required asset implementation contract | DONE (DESIGN) | Coordinator + independent review | Design f362f87 with intrinsic-isolation/dependency-closure correction 3f84c04 approved on independent recheck. See required-assets.md; actual asset playback remains to implement. |
| C9: installed diagnostic cleanup race | DONE | Coordinator + independent review | 41b4668 suppresses normal ENOENT lease removal and retains other scan errors; 15 installed CPU tests pass. Independent review reproduced red/green. Supporting manual records saved in 1bca5b7. No installed binary changes. |
| C10: compact Studio UX audit | DONE (AUDIT) | compact_ui_audit + coordinator | compact-studio-audit.md records screenshot/code evidence, compact arrangement and bounded slices. Includes per-group picker, application/file controls, icon transport and explicit multiple-view follow-on. No new native run or production changes. |
| C11: local pane picker and compact shell polish | IN PROGRESS | compact_ui_implementation | Isolated codex/checkpoint-compact-ui from 29c4b45. Implements group-local picker, compact application/file controls and accessible icon transport with retained ownership. CPU review precedes coordinator-only native QA; true multiple views remain separate. |
| C12: bounded image validation foundation | DEFERRED | Unassigned | Paused for user-directed creative workflow priority. Uncommitted stub/draft tests removed; no asset implementation is claimed. Resume when a concrete visual needs image input, or for required release closure. |
| C13: creative-use checkpoint | TOP PRIORITY; IN PROGRESS | Coordinator | Prepare concise Studio/MCP start guide; use working creation/revision/capture/save-reopen flow. C11 UI improvement can land when verified but broader polish, assets and full measurement do not block the first creative session. Capture actual feedback and reprioritize from it. |

## Established baseline

- User installed the exported source, triggered it with Studio closed and observed approximately 1–2 second startup.
- Two copies played with independent controls; removing one did not interrupt the other.
- Coordinator verified all matching Resolume/Lux processes had exited. On reopen, user observed about one second startup per copy, restored Intensity 0.2/0.8 and continued independence.
- These are functional observations, not instrumented timing, cold OS-cache, offline/checkout-isolation or full performance acceptance.
- Blank thumbnails in Resolume's clip and property areas are scheduled as early 0.2 export usability in [roadmap](roadmap.md). Existing installed playback is left intact during this implementation batch.

## Constraints and decisions

- User explicitly authorizes parallel agents and worktree isolation. Independent implementations use separate worktrees; coordinator alone edits this tracker, dependency manifests and integration checkout.
- Ruling: run independent implementers in parallel despite the generic skill's serial default, following the user's explicit parallel-work instruction. Review and integration remain sequential.
- No agent launches Studio, Electron graphics, a native producer, or changes the real Resolume installation. User confirmed Resolume closed and authorized Studio tests; coordinator ran them serially and closed all owned windows afterward.
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

Recovery and layout agents dispatched; coordinator prepares fixtures locally. No new QA requested from the user. Recovery inspection found one-auto-retry/30-second design policy differs from explicit-only Studio and three-attempt installed runtime; preserve this discrepancy as outstanding, without silently redefining acceptance. No current graphics processes are launched by this batch.

- 37d3102: distinct source fixtures, preparation command, package manifest evidence and performance audit committed. Triangle release5569712e… and ring releasec1b26300… are under artifacts/installed-package/qa-fixtures; host/GPU flags remain false pending actual playback.
- 700ec5f: independently reviewed recovery correction integrated. Generic desired control intent is preserved within its admitted accepted runtime; rejected/stale commands and source replacement do not inherit it.
- User cleared graphics lane by closing Resolume. Root verified no host/Electron processes before proceeding. Native Studio QA will run only after layout review and integration.

- Native docking regression caught the menu resizing the persisted grid; overlay fix restores exact geometry. Actual pointer drag and splitter movement now pass along with retained owners and continuing GPU output. Evidence is in evidence/standalone-lux/native-ui/docking.json.
- Full native UI regression passes including preview-only fullscreen, CodeMirror and real export. MCP create/revise/capture/controls, invalid/hanging candidate retention and restart pass; latest local restart request-to-ready sample is about223ms, not host recovery timing.
- Required assets, two different installed-source host evidence, offline/checkout isolation, automatic retry policy and the performance collection/evaluator work remain open. C1/C2 DONE describe their bounded delivered work, not full tracer completion.
- Final batch review approved. Harness now closes its owned Electron app before report writes and requires source/runtime agreement for each fixture. Both real fixtures render (cyan triangle center versus dark ring center and gold rim); all seven docking/fixture checks pass without CSP errors. Process inspection confirms no Avenue/Arena/Electron remains. C7/C8 proceed CPU-only.

## Task 5: offline performance evaluator

Implement the next bounded patch in performance-checkpoint.md: a CPU-only offline validity/evaluation core with meaningful synthetic negative fixtures for the host opportunity/freshness window and exact control-version accounting. Read the authoritative performance design and tracer acceptance for exact numerical gates. Own new packages/performance or equivalent focused pure module and tests/performance; do not modify production rendering, package manifests, telemetry protocols or test:acceptance availability. Define a strict explicit record/window contract and document it beside the module so later native instrumentation has a real target. Use BigInt timestamp differences before unit conversion; nearest-rank quantiles; explicit independent measurement window and loss/incomplete flags; missing evidence cannot pass. Required tests include fresh30Hz failing cadence, missing coverage, repeats/gaps, generation changes without invented skipped IDs, missing or substituted control versions, insufficient p99 samples, invalid clocks/data and bounded input admission. Distinguish synthetic evaluator success from actual hardware acceptance in output. Run CPU regression/type checks, commit, and report what remains for real collection. No graphics, dependencies or subagents.

## Task 6: required asset design

Prepare docs/implementation/required-assets.md as an implementation-ready bounded tracer design from the existing project/runtime/export contracts. Current source accepts TS only, runtime supplies empty assets, and immutable release permits only manifest plus linked transport. Choose how actual required image bytes enter an editable scene, survive whole-source editing/undo/MCP/build, reach read-only VisualContext.assets, and become hash-verified offline release closure. Include strict quotas/path/encoding/decoding checks, missing/tampered asset rejection, compatibility with existing .lux-scene and installed releases, and a fixture that actually consumes the asset. Inspect every affected interface before proposing a schema; no unused asset files or source constants mislabeled as asset support. Recommend a minimal supported format/codec with reasons and staged import UI; avoid broad asset-library/provider work. Own doc only; no production edits, dependency changes, graphics, host actions or subagents. User has authorized routine architecture decisions; record tradeoffs and questions requiring actual product input only if unavoidable.

## Task 12: image admission foundation

Implement a browser-compatible pure module under packages/assets for the approved bounded BMP subset and canonical base64 byte admission. No source-v2 wiring or runtime claim in this slice. Validate encoded length/padding and decoded quotas before allocation; validate BMP headers, dimensions, exact padded payload, encoding and trailing bytes before pixel allocation. Decode bottom-up BGR to top-down opaque RGBA only on explicit request. Add reusable CPU fixture generation and tests for asymmetric padded rows, maximum dimensions, invalid headers/dimensions/compression/palette/truncation/trailing data, canonical base64 and boundary limits. No dependency or native changes. Export typed interfaces for later compiler/runtime use, run focused tests/typecheck, then obtain independent review before marking done. Full descriptor/path/aggregate admission, hashing, workspace/MCP and installed closure remain later slices of required-assets.md.
