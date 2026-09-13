# Tracer progress

Updated: 12 September 2026. **Tracer is not complete.**

**Done** means the whole task is implemented, integrated into Lux, and tested. Passing tests for one part does not make the whole task done.

| Task | Status | What it means | What remains |
| --- | --- | --- | --- |
| Code-defined properties | In progress | Each visual defines its own controls; Intensity is just one possible property. | Connect the implemented compiler/runtime pieces to the Inspector and AI controls, then test them together in Studio. |
| Save and export properties | In progress | Preserve values when reopening scenes and expose the visual's controls in Resolume. | Integrate scene saving and finish exported property handling and host tests. |
| PNG, JPEG and transparency | In progress | Use common images with correct colors and transparent edges. | Connect the decoders to Studio and verify actual rendering, including transparency. |
| Image import and export | In progress | Import, replace and remove images; include them in standalone exports. | Finish the Studio import controls and exported image playback. |
| Runtime performance monitoring | Not started | Measure frame delivery and visual CPU/GPU cost without stalling playback. | Implement the live measurement collector. The design and result-checking tools exist. |
| Host and control timing | In progress | Measure Resolume startup, frame delivery and how quickly control changes appear. | Replace partial counters/manual observations with complete timing records and measured runs. |
| Basic monitoring status | Not started | Show real measurements in Studio and make them available to agents. | Connect the collector to shared status and compact UI. |
| Performance acceptance | In progress | Run repeatable workloads and check whether performance meets the required budgets. | Collect real hardware results and evaluate them. The result-checking code is implemented. |
| Standalone Resolume checks | In progress | Run different exported visuals with Lux closed and no development checkout available. | Finish different-source and package-isolation checks. Fast startup and independent copies already passed. |
| Failure recovery | In progress | Recover from broken or stalled visuals without freezing Lux or Resolume. | Finish retry behavior and measure actual process shutdown, GPU cleanup and recovery. |

Completed Studio fixes: Ctrl+S/editor navigation, smooth sliders, larger preview/fullscreen, shortcut-hint removal, and basic BMP image preview/restart/save/reopen.

Next after tracer: filesystem-first projects with real TypeScript files, normal coding environments and Git. **Architecture and implementation planning: Done. Implementation: Not started.** See the [architecture](docs/design/filesystem-projects.md), [plan](docs/implementation/filesystem-projects-plan.md), and [completed review](docs/reviews/filesystem-projects-review.md).

Performance details: [design](docs/design/performance-monitoring.md) and [implementation checkpoint](docs/implementation/performance-checkpoint.md). Basic monitoring and measured acceptance are required for the tracer; per-component breakdowns and the full profiler panel come later.

Compact Inspector/status-bar polish is queued after the required property and asset work. Keep the repo-shipped visual-creation skill updated and reinstalled as features land. Run graphics tests one at a time.
