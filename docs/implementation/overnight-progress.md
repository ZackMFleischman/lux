# Active implementation plan and progress

Updated: 2026-09-12. Coordinator: Lux Studio UI task. Integration checkout: `.worktrees/tracer`, branch `codex/tracer-0.1`. This is the execution checklist for the existing roadmap, not a separate product roadmap.

## Current checklist

| Status | Work | Owner / checkout | Evidence / next action |
| --- | --- | --- | --- |
| DONE | Reconcile revised tracer export scope with Studio docs | Coordinator / tracer | Main merged in 7ce2f56; reusable exports, independent sources and cold reopen remain tracer requirements. |
| DONE | Integrate verified saved-visual transport | Coordinator / tracer | codex/resolume-transport merged; reuse a5eee83 evidence, no transport rewrite. |
| DONE | MCP generic parameters, playback and restart | mcp_controls / mcp-controls | Integrated 0559724; 27 CPU tests, typecheck, independent review and real MCP controls/image workflow passed. |
| DONE | Immutable export package and installation foundation | export_foundation / export-foundation | Integrated faadb60 and 9c0a206. Coordinator ran 11 CPU tests including registration location guard; runtime/startup and host acceptance remain separate. |
| DONE | TypeScript editor and multi-file draft state | source_editor + review / source-editor | Integrated review fixes through ead3214; 65 Studio CPU/DOM tests pass. Real Electron syntax/tabs/undo/CSP passes; real MCP helper-only revision changes pixels and invalid helper preserves the complete draft. |
| MANUAL QA NEEDED | Load/trigger source in Resolume | Coordinator | Two drag attempts selected empty slots but did not load the probe; no new host log. Stopped retries. User confirms drag did not work. No native producer started. |
| DONE | Review and integrate MCP lane; run real MCP controls QA | Coordinator + independent reviewer | Real test starts paused, changes parameters, plays/pauses/resets/restarts, rejects stale generation and preserves output on invalid/hanging candidates. Transport worker compatibility also reviewed. |
| DONE | Automated real Studio polish QA | Coordinator / Playwright | Three play/pause cycles had no Reset/Restart disabled transitions or preview relayout; paused intensity stable; native preview-only fullscreen fills window, hint fades, one Escape restores original canvas. |
| IN PROGRESS | Review and integrate export foundation | Coordinator + review lane | Storage/registration integrated; native location, stale-binary capability, static CRT and cached default issues corrected. 18 combined package/install/process tests pass. |
| IN PROGRESS | Shared installed runtime, automatic source startup, independent instances | source_editor / installed-runtime-watchdog | Native rebuild passes 11 CTest checks. Independent audit found alive-but-stalled producer gap; implementing external startup/heartbeat/progress deadlines. Actual installed acceptance pending. |
| IN PROGRESS | Export action in Studio and cold-start/reopen QA | Coordinator + source_editor | Real Studio export passed: 99-file runtime, saved0.08 value, validated hashes. Real bundled-Electron test then caught ASAR transparency mismatch; fixed0cfa936, real raw-file regression passes. Fresh export/install rerun pending. |
| IN PROGRESS | Lifecycle/recovery and performance acceptance gaps | Coordinator + review lane | Watchdog/cached restart integrated 78c8cb8. Real MCP workflow passes; restart request-to-ready measured 172 ms. Native stop/first-source cold/warm timings remain unmeasured. |
| DONE | Review/integrate source editor; automated Studio UI QA | Coordinator + independent reviewer | Three review findings fixed; native editor/preview continuity and readable dark syntax contrast pass. Native IME/maximum-size performance remain broader acceptance tasks. |
| IN PROGRESS | Flexible layout adapter spike (later roadmap) | export_foundation / layout-spike | MIT Dockview/react/core7.0.4 pinned centrally. Isolated panel registry/adapter/state work; current UI remains unchanged until lifecycle QA. |

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
- Integration has preserved current Studio work and merged current main scope plus completed transport implementation. Native tests/install have not been rerun yet.

Each completed lane updates this table with commit IDs and test results. Failed or blocked checks remain visible until resolved; CPU success does not stand in for native visual acceptance.
