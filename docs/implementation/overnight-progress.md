# Active implementation plan and progress

Updated: 2026-09-12. Coordinator: Lux Studio UI task. Integration checkout: `.worktrees/tracer`, branch `codex/tracer-0.1`. This is the execution checklist for the existing roadmap, not a separate product roadmap.

## Current checklist

| Status | Work | Owner / checkout | Evidence / next action |
| --- | --- | --- | --- |
| DONE | Reconcile revised tracer export scope with Studio docs | Coordinator / tracer | Main merged in 7ce2f56; reusable exports, independent sources and cold reopen remain tracer requirements. |
| DONE | Integrate verified saved-visual transport | Coordinator / tracer | codex/resolume-transport merged; reuse a5eee83 evidence, no transport rewrite. |
| IN PROGRESS | MCP generic parameters, playback and restart | mcp_controls / mcp-controls | Guarded adapter implemented; CPU tests passing in lane; awaiting committed handoff and independent review. |
| IN PROGRESS | Immutable export package and installation foundation | export_foundation / export-foundation | Implementing validated release/runtime closure and safe install helper; does not yet claim automatic source registration or multiple instances. |
| IN PROGRESS | TypeScript editor and multi-file draft state | source_editor / source-editor | Pure draft-store tests passing; CodeMirror pins installed centrally in ab3bc3e. Parallel roadmap work, not a tracer dependency. |
| IN PROGRESS | Automated native UI QA feasibility | Coordinator | Resolume window successfully selected and observed; empty clips and Lux probe confirmed. Bounded drag/trigger attempt next. |
| QUEUED | Review and integrate MCP lane; run real MCP controls QA | Coordinator + fresh reviewer | CPU checks before serialized Studio test. |
| QUEUED | Review and integrate export foundation | Coordinator + fresh reviewer | Verify package works without checkout references; follow with automatic startup and instance routing. |
| QUEUED | Shared installed runtime, automatic source startup, independent instances | Export follow-on lane | Use installed package contract; one shared supervisor/runtime distribution, separate per-source state. |
| QUEUED | Export action in Studio and cold-start/reopen QA | Coordinator | Depends on installed source registration/start contract; do not label package creation alone complete export. |
| QUEUED | Lifecycle/recovery and performance acceptance gaps | Coordinator + review lane | Original gates remain open; measure first-source cold startup and additional-source startup separately. |
| QUEUED | Review/integrate source editor; automated Studio UI QA | Coordinator + fresh reviewer | Validate nonce/CSP, per-file drafts, editor state and preview continuity. |

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
