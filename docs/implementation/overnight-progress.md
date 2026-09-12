# Active implementation plan and progress

Updated: 2026-09-12. Coordinator: Lux Studio UI task. Integration checkout: `.worktrees/tracer`, branch `codex/tracer-0.1`. This is the execution checklist for the existing roadmap, not a separate product roadmap.

## Current checklist

| Status | Work | Owner / checkout | Evidence / next action |
| --- | --- | --- | --- |
| DONE | Reconcile revised tracer export scope with Studio docs | Coordinator / tracer | Main merged in 7ce2f56; reusable exports, independent sources and cold reopen remain tracer requirements. |
| DONE | Integrate verified saved-visual transport | Coordinator / tracer | codex/resolume-transport merged; reuse a5eee83 evidence, no transport rewrite. |
| DONE | MCP generic parameters, playback and restart | mcp_controls / mcp-controls | Integrated 0559724; 27 CPU tests, typecheck, independent review and real MCP controls/image workflow passed. |
| DONE | Immutable export package and installation foundation | export_foundation / export-foundation | Integrated faadb60 and 9c0a206. Coordinator ran 11 CPU tests including registration location guard; runtime/startup and host acceptance remain separate. |
| DONE | TypeScript editor and multi-file draft state | source_editor + review / source-editor | Integrated review fixes through ead3214; final combined Studio CPU/DOM suite passes 69 tests including layout. Real Electron syntax/tabs/undo/CSP passes; real MCP helper-only revision changes pixels and invalid helper preserves the complete draft. |
| PASS (USER OBSERVED) | Load/trigger installed source in Resolume | User + coordinator | User installed the prepared package successfully, loaded/triggered the exported source, and reported output in about 1–2 seconds. Intensity visibly changes the image. This is manual functional evidence, not instrumented startup/performance acceptance. |
| DONE | Review and integrate MCP lane; run real MCP controls QA | Coordinator + independent reviewer | Real test starts paused, changes parameters, plays/pauses/resets/restarts, rejects stale generation and preserves output on invalid/hanging candidates. Transport worker compatibility also reviewed. |
| DONE | Automated real Studio polish QA | Coordinator / Playwright | Three play/pause cycles had no Reset/Restart disabled transitions or preview relayout; paused intensity stable; native preview-only fullscreen fills window, hint fades, one Escape restores original canvas. |
| DONE | Review and integrate export foundation | Coordinator + review lane | Storage/registration integrated; native location, stale-binary capability, static CRT and cached default issues corrected. 18 combined package/install/process tests pass. |
| IMPLEMENTED; HOST QA PENDING | Shared installed runtime, automatic source startup, independent instances | Coordinator + native review | Watchdog155cb3b and nonblocking cleanup6705365 integrated; 14 CPU supervision tests and 11 native CTests pass. Real packaged supervisor installation/startup/singleton/idle exit passes. Actual visual/source concurrency acceptance pending. |
| DONE | Export action in Studio | Coordinator | Real Studio export and bundled Electron install/supervisor checks pass for release2d254982… / runtime20c587d4…. 99 runtime files. Install17.0s, supervisor ready1.66s, idle exit31.7s; OS file cache warm, no producer/first-pixel measurement. |
| MANUAL QA NEEDED | Installed export registration, playback and composition cold reopen | Coordinator + user for host interaction | Actual Resolume registration/playback/reopen is unverified. Use the prepared export and installed-runtime-validation.md; this gate is separate from the completed Studio export action. |
| UNFINISHED | Lifecycle/recovery and performance acceptance gaps | Coordinator | Watchdog/cached restart integrated 78c8cb8; external supervision improved in 155cb3b/6705365. Real MCP workflow passes; latest Studio restart request-to-ready is 181 ms. Confirmed stop/GPU teardown, recovered consumed frame, cold/warm source timing and remaining performance gates are unmeasured. Automatic recovery/retry policy still needs reconciliation with the acceptance design; CPU tests and further implementation can proceed without Resolume UI. |
| DONE | Review/integrate source editor; automated Studio UI QA | Coordinator + independent reviewer | Three review findings fixed; native editor/preview continuity and readable dark syntax contrast pass. Native IME/maximum-size performance remain broader acceptance tasks. |
| DONE | Flexible layout adapter spike (later roadmap) | export_foundation / layout-spike | Integrated fa88bfa/af52dd2; real Dockview CPU move/save/restore/reopen/reset tests, scoped typecheck and React/CSS bundle pass. Current UI remains unchanged. |
| QUEUED | Connect ordinary dockable Source/Preview/Inspector/Jobs panels | Coordinator | Use tested adapter with application-owned state above mounts; native drag/focus/CSP and preview/editor continuity QA required before replacing current shell. Future Library/Graph use same registry. |
| QUEUED (EARLY 0.2) | Resolume thumbnails for exported sources | Coordinator | User reports blank thumbnails in both clip and property areas despite working playback. Track under roadmap early export usability after basic installed functional QA, before broad Studio/distribution polish. Check static SDK thumbnail support and both actual host surfaces; no producer startup for thumbnail inspection. |

## Operating rules and rulings

- User authorizes implementation and QA without waiting for manual input, including parallel later-roadmap work. All lanes commit in isolated worktrees. Coordinator owns shared dependencies, integration and native UI actions.
- Only coordinator launches graphics tests. No concurrent native transport and Studio GPU sessions. Other agents run CPU tests/builds only.
- If a bounded Resolume drag/trigger attempt cannot be completed, stop that UI path, record the exact manual action and continue CPU/other implementation work. Do not repeatedly poke the host.
- Shared runtime means reuse of an installed runtime version/supervisor; each source/copy must have independent values, clock and failure handling. Process topology must preserve isolation and be measured, not inferred from a shared executable.
- Startup responsiveness is an acceptance concern: record trigger-to-first-correct-frame for cold first source and warm additional sources. Provisional engineering targets: cold at most 3 seconds, warm at most 1 second on the reference machine; report measurements and revisit explicitly if unmet, never claim these have been measured already.
- Source editor work is intentionally parallel under explicit user authorization; it does not replace unfinished tracer export/lifecycle/measurement work.
- Main roadmap scope supersedes the older ordering in current-priorities.md where that file defers minimum installed export or independent sources.

## Checkpoints

- Started three independent implementation agents; transport task was idle before this execution began.
- Read computer-use guidance, selected the actual Resolume window, and confirmed the user-described empty workspace/source filter without changing clips yet.
- Integration has preserved current Studio work and merged current main scope plus completed transport implementation. Native CPU tests and isolated packaged installation have subsequently passed; the real Resolume plugin installation remains unchanged.

## Work remaining after the agent checkpoint

All three dispatched agents have finished; no implementation lane is currently running in the background. Completion of their bounded assignments does not mean tracer acceptance is complete.

1. Reconcile lifecycle recovery/retry behavior with the acceptance design, implement outstanding behavior, and add meaningful automated failure/timing checks. Separate confirmed stop and consumed-frame recovery from request-to-ready observations.
2. Independently connect the tested Dockview adapter to the actual Studio panes and validate drag/resize/tab persistence and preview/editor continuity. The visible Studio is not dockable yet; preview popout is also not delivered by the adapter spike.
3. When host interaction is available, validate installed Resolume sources, duplicate/different-source independence, removal and saved-composition cold reopen, and collect first-correct-frame and performance measurements. This host gate does not block items 1 and 2.

Status labels distinguish completed implementation, outstanding acceptance, and unfinished work. Update a row to IN PROGRESS only while an owner is actively executing it.

Each completed lane updates this table with commit IDs and test results. Failed or blocked checks remain visible until resolved; CPU success does not stand in for native visual acceptance.

## Ready for the next host QA checkpoint

All dispatched lanes have returned and their bounded work is integrated. No test Studio remains open. The real Resolume plugin installation was not changed. The prepared export is under `artifacts/studio-ui/exports/2d2549826ffcb8a3f0265e060e89c0b86b4b09ab0a7c6a758c96a08634e2a468`; its `install.cmd` opens the native-dialog installer. Close Resolume before using that installer and select its configured Extra Effects folder.

Next host actions: load the named exported source, measure first-correct-frame startup, then test two different sources and duplicate copies, independent values, removal, and saved composition cold reopen. These remain manual QA because the earlier computer-use drag did not load a source. Follow `installed-runtime-validation.md` and the original acceptance gates; supervisor readiness alone is not installed visual acceptance.

Evidence: `evidence/standalone-lux/native-ui/result.json`, `evidence/standalone-lux/mcp-controls/result.json`, and `evidence/installed-runtime/package-startup.json`. Packaged CPU startup uses an isolated profile and a warm OS file cache, with no GPU/host activation. The real authoring restart sample is about 181 ms; installed first-pixel timing is still pending.

## Manual host QA update — 2026-09-12

This update supersedes the earlier checkpoint's unchanged-installation and failed-drag status. The user ran the prepared package's installer and received its success message. Following the Studio-closed playback instructions, they loaded and triggered the exported source in Resolume: “it appeared in like a second or 2.” They then confirmed that changing Intensity between approximately 0.2 and 0.8 works.

Single-source installation, automatic visible startup and control response now have user-observed functional evidence. The startup estimate is not an instrumented measurement or proof of cold-cache performance. Duplicate-copy independence, different-source independence, removal, fully stopped-runtime composition reopen and numerical performance gates remain pending. Next guided check: two copies on separate layers with independent Intensity values.

Subsequent user checks: two copies run simultaneously on separate layers with independent Intensity values; removing one leaves the other animating and responding to Intensity. Both are user-observed functional passes. Following instructions to restore two copies, save distinct values in a test composition and close Resolume, the user confirmed the host is closed. An elevated read-only Win32_Process query then found no Avenue/Arena, Electron, or matching Lux installed-runtime processes; its only match was the querying PowerShell process itself. Nothing was terminated or launched. The process-cold reopen precondition is verified; composition reopen/restored values, different exported sources and quantitative gates remain pending. This does not establish a cold OS file cache or timed shutdown completion.

After the verified stopped-process checkpoint, the user reopened and reported “took about 1 second for each.” Process-cold visible startup now has user-observed evidence for both copies. Saved Intensity values of 0.2/0.8 and independence after reopen still need explicit confirmation; no exact release/control telemetry or offline/checkout-isolation evidence was collected. User also reported blank thumbnails in the clip and property areas. That issue is queued in roadmap early 0.2 export usability, with both surfaces called out explicitly.
