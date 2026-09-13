# Tracer progress

Updated: 12 September 2026. **Tracer is not complete.** Scope is fixed; filesystem projects, full profiler UI and optional polish follow tracer.

**Done** means implemented, integrated and tested. CPU tests alone do not complete tasks that need real rendering or host checks.

| Task | Status | What it means | What remains |
| --- | --- | --- | --- |
| Code-defined properties | Done | Each visual defines its own controls, including names, ranges and defaults. | Five-control visual, compact Inspector, numeric/AI edits, invalid-input handling, save/reopen and restart passed real Studio checks. Host export remains below. |
| Saved property values | Done | Reopening a scene restores its controls. | Studio save/open/restart passed; exported-host checks are separate below. |
| Studio image correctness | Done | PNG/JPEG colors, orientation and transparent edges render correctly. | Pixel, browser composition and save/reopen checks passed. |
| Image import and export | Done | Import, replace and remove images and package original bytes for shows. | Studio workflow and original-byte packaging passed; installed native PNG output exactly matched Studio. Resolume composition checks remain below. |
| Basic monitoring status | Done | Show actual measurements in a small, collapsed Studio section. | Real CPU/GPU measurements reach Studio and the agent API. Incomplete GPU coverage is labeled; budget validation remains below. |
| Playback UI stability | Done | Keep editing and controls responsive while the preview renders. | View-only refresh coalescing fixed the React loop; sustained playback with repeated monitor interactions passed in stable Studio. Controls and AI commands remain immediate. |
| Studio fault recovery | Done | Throwing or hung visuals can restart without losing code or controls. | Real error/hang, retry suppression and recovered-pixel checks passed; physical timing remains below. |
| Installed hang-detection code | Done | Detect a stuck visual even while its launcher still responds. | Separate worker heartbeat and 1.25 s deadline integrated, reviewed and CPU-tested. Physical stop timing remains below. |
| Independent cleanup scheduling | Done | Continue polling healthy sources while another source stops. | Integrated and independently reviewed; slow/rejected cleanup, retained ownership/capacity and close retry regressions pass. Physical multi-source checks remain below. |
| Reject mixed runtime builds | Done | Export must not mix new supervisor code with stale generated renderer files. | Main, worker and relay markers enforced for new packages. Integrated export/installed suite passes 47 tests; immutable old packages remain compatible. |
| Exported controls and alpha probe | In progress | Change a real FFGL property and inspect transparent output. | Preparing a bounded native fixture using the existing image package; actual control/alpha run remains. Opaque PNG output already passed. |
| New-package Resolume workflow | Not started | Use new controls/assets, independent copies and saved compositions in Resolume. | Verify controls, transparent composition, removal isolation and reopen. Earlier manual checks predate these new features. |
| Offline installed-version isolation | Not started | New packages start with Lux closed and source files unavailable; later edits cannot change them. | Verify cold reopen, original release IDs, current saved values and old/new versions together. Package-only dependency audit already passed. |
| Physical stop and recovery timing | Not started | Confirm stuck execution actually exits within 2 s and correct host output returns within 5 s. | Measure process exit, current controls on recovered output, host responsiveness and GPU cleanup after recovery fixes. Studio functional recovery alone is insufficient. |
| Routine sampling and baseline mode | Done | Reduce monitoring work and allow a fair monitoring-on/off comparison. | Integrated and reviewed; CPU suite/typecheck passed. Real Studio controls/playback/monitor test passed with sampled GPU data and zero page errors. Overhead measurement remains below. |
| Full GPU-work measurement | In progress | Include uploads/copies as well as render passes. | Audit complete; current pass queries omit work. Need bounded trace and demonstrated frame attribution. No complete measurement method validated yet. |
| Match controls to consumed frames | In progress | Prove exactly which changed value appeared in the host image. | Native records exist; worker-to-compositor-to-host matching remains unproven. Needed before latency measurements count. |
| Monitoring overhead measurement | Not started | Demonstrate routine monitoring adds less than 2% work. | After baseline/sampling and adequate GPU measurement: paired runs. Current timestamp resolution may leave results inconclusive. |
| Final speed and response runs | Not started | Verify frame delivery, control response, UI response and CPU/GPU budgets. | After measurement prerequisites: 30 s warmup, 300 s host run and 600 matched control changes, plus separate UI evidence. Existing 30 s experiment cap needs an explicit reviewed long-run procedure. |
| Final tracer sign-off | Not started | Review measured results and commit the completed release checklist. | All required gates need real evidence; failures require fixes or an explicit approved change to the acceptance plan. |

Validated integration: `c280365`, including recovery scheduling and sampled monitoring. Stable checkout is updated after this evidence commit. Root coordinates graphics checks serially; agents are preparing the native alpha/control probe and correcting SDK example typecheck configuration.

Following the user's iteration guidance, uncertain full-GPU/latency measurement work is time-boxed. It must not hold up a usable build checkpoint; missing evidence stays explicit and does not become a passed performance gate.

Next after tracer: filesystem-first projects with real TypeScript files and Git. Architecture and planning are done; implementation has not started. See [architecture](docs/design/filesystem-projects.md), [plan](docs/implementation/filesystem-projects-plan.md), and [review](docs/reviews/filesystem-projects-review.md).

Performance: [design](docs/design/performance-monitoring.md) and [checkpoint](docs/implementation/performance-checkpoint.md). Basic monitoring and measured acceptance remain tracer requirements. Run graphics tests one at a time; keep the shipped visual-creation skill synchronized.
