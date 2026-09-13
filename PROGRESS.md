# Tracer progress

Updated: 12 September 2026. **Tracer is not complete.**

**Scope is fixed for tracer:** finish the requirements below. Filesystem projects, full profiler UI and optional polish are deferred.

**Done** means the whole task is implemented, integrated into Lux, and tested. Passing tests for one part does not make the whole task done.

| Task | Status | What it means | What remains |
| --- | --- | --- | --- |
| Code-defined properties | In progress | Each visual defines its own controls; Intensity is just one possible property. | Inspector, numeric inputs and generic AI controls are integrated in the test checkout; CPU regressions running, live Studio validation next (coordinator). |
| Save and export properties | In progress | Preserve values when reopening scenes and expose the visual's controls in Resolume. | Scene save wiring is integrated in the test checkout; native/export agent is finishing offline control mapping and host tests. |
| PNG, JPEG and transparency | In progress | Use common images with correct colors and transparent edges. | PNG/JPEG admission tests pass; assets agent is connecting decoded images to preview and verifying transparency. |
| Image import and export | In progress | Import, replace and remove images; include them in standalone exports. | Assets agent is implementing import controls; native/export agent owns exported image playback. |
| Runtime performance monitoring | In progress | Measure frame delivery and visual CPU/GPU cost without stalling playback. | Performance agent is implementing bounded live measurements and explicit unsupported-metric reporting. |
| Host and control timing | In progress | Measure Resolume startup, frame delivery and how quickly control changes appear. | Replace partial counters/manual observations with complete timing records and measured runs. |
| Basic monitoring status | In progress | Show real measurements in Studio and make them available to agents. | Performance agent is connecting measured status and a compact view; no full profiler UI in this checkpoint. |
| Performance acceptance | In progress | Run repeatable workloads and check whether performance meets the required budgets. | Collect real hardware results and evaluate them. The result-checking code is implemented. |
| Standalone Resolume checks | In progress | Run different exported visuals with Lux closed and no development checkout available. | Finish different-source and package-isolation checks. Fast startup and independent copies already passed. |
| Failure recovery | In progress | Recover from broken or stalled visuals without freezing Lux or Resolume. | Finish retry behavior and measure actual process shutdown, GPU cleanup and recovery. |

Completed Studio fixes: Ctrl+S/editor navigation, smooth sliders, larger preview/fullscreen, shortcut-hint removal, and basic BMP image preview/restart/save/reopen.

Next after tracer: filesystem-first projects with real TypeScript files, normal coding environments and Git. **Architecture and implementation planning: Done. Implementation: Not started.** See the [architecture](docs/design/filesystem-projects.md), [plan](docs/implementation/filesystem-projects-plan.md), and [completed review](docs/reviews/filesystem-projects-review.md).

Performance details: [design](docs/design/performance-monitoring.md) and [implementation checkpoint](docs/implementation/performance-checkpoint.md). Basic monitoring and measured acceptance are required for the tracer; per-component breakdowns and the full profiler panel come later.

Compact Inspector/status-bar polish is queued after the required property and asset work. Keep the repo-shipped visual-creation skill updated and reinstalled as features land. Run graphics tests one at a time.
