# Tracer progress

Updated: 12 September 2026. **Tracer is not complete.** Scope is fixed; filesystem projects, full profiler UI and optional polish follow tracer.

**Done** means implemented, integrated and tested. CPU tests alone do not complete tasks that need real rendering or host checks.

| Task | Status | What it means | What remains |
| --- | --- | --- | --- |
| Code-defined properties | Done | Each visual defines its own controls, including names, ranges and defaults. | Five-control visual, compact Inspector, numeric/AI edits, invalid-input handling, save/reopen and restart passed real Studio checks. Host export remains below. |
| Save and export properties | In progress | Reopen the same values and expose the visual's controls in Resolume. | Save and native/export mapping are integrated; verify the newly exported package in a real host. |
| PNG, JPEG and transparency | In progress | Images keep their colors and transparent edges. | Studio PNG straight-alpha captures, browser composition, JPEG orientation and save/reopen passed. Verify exported host alpha next. |
| Image import and export | In progress | Import, replace and remove images and package original bytes for shows. | Studio workflow passed; isolated installed-package playback remains. |
| Runtime performance monitoring | In progress | Measure CPU work, GPU passes and frame delivery without blocking playback. | Bounded collectors and GPU queries integrated; verify real hardware coverage and overhead. |
| Basic monitoring status | Done | Show actual measurements in a small, collapsed Studio section. | Real CPU/GPU measurements reach Studio and the agent API. Incomplete GPU coverage is labeled; budget validation remains below. |
| Host and control timing | In progress | Measure startup, host frames and how quickly controls reach visible output. | Timing records integrated; review fixes and actual measurements remain. Worker-to-host frame matching is still unproven. |
| Performance acceptance | In progress | Compare repeatable measured runs with the required speed budgets. | Collect and evaluate hardware results; unsupported or incomplete measurements cannot pass. |
| Standalone Resolume checks | In progress | Exported sources work with Lux closed and without the development checkout. | Older exports passed fast startup and independent instances; new parameter/image packages need isolated-host checks. |
| Failure recovery | In progress | Broken visuals recover without trapping Lux or Resolume. | Retry and review fixes are integrated. Verify actual process shutdown, recovered playback and current host values. |

Current integration: `codex/parameter-integration`. Completed UI fixes include compact 46 px property rows, collapsed diagnostics sections, and in-app discard confirmations. Final combined validation is underway before updating the stable tracer checkout.

Next after tracer: filesystem-first projects with real TypeScript files and Git. Architecture and planning are done; implementation has not started. See [architecture](docs/design/filesystem-projects.md), [plan](docs/implementation/filesystem-projects-plan.md), and [review](docs/reviews/filesystem-projects-review.md).

Performance: [design](docs/design/performance-monitoring.md) and [checkpoint](docs/implementation/performance-checkpoint.md). Basic monitoring and measured acceptance remain tracer requirements. Run graphics tests one at a time; keep the shipped visual-creation skill synchronized.
