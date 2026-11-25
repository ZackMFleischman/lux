# UI refactor post-mortem — 17 September 2026

Scope: recent Lux Inspector density/search/group actions, Preview FPS, and Source sidebar. This is a retrospective of existing evidence, not new application QA.

## Findings

| Observed outcome | Workflow gap | Reusable correction |
| --- | --- | --- |
| Larger Inspector headings and connected borders still needed repeated padding fixes. The parent Inspector retained 19px horizontal padding. | Local styling was assessed before the whole layout and realistic control density. | Inspect ancestor spacing and the CSS cascade; use dense representative content before choosing dimensions. |
| Source files remained capped by an older 86px max-height until native screenshots exposed it. | Source changes and passing tests did not establish final layout. | Inspect computed constraints in the running app; review screenshots and geometry together. |
| The first FPS implementation read snapshot.visualFps, which stayed null in the standalone client. | A plausible field passed code review without tracing its live producer. | Exercise real runtime data, including unavailable and paused states. |
| Inspector QA attempted forced panel widths and a synthetic click when the clear button was offscreen. | The harness could bypass the usability defect it was meant to detect. | Resize through the real layout and use normal pointer/keyboard interaction. |
| Several handoffs preceded final fixes or matching evidence. | Submission was treated as a progress update. | Bind final review and evidence to the final source; submit once when ready. |
| Small changes accrued repeated waits, broad preparation, and status messages. | Coordination and harness repair were disproportionate to the change. | Use the shortest existing verification path, bounded diagnosis, and task-sized delegation. |

The shared Disclosure pattern and real native screenshots were useful. Final Source evidence covers empty/imported assets and expanded/collapsed states at wide/narrow sizes. Files uses remaining height and Assets stays at the bottom. Final FPS evidence shows 43.9 FPS while playing and a dash while paused, with owned process cleanup.

No runtime speed improvement was measured. Compact layout is a usability improvement, not evidence of faster rendering. The new skill has scenario review and structural validation; future application use must establish its effectiveness.

## Evidence

- Source final implementation: main 8aa98af77064a972e7c336a41c71de3e5e201da4; LUX-209.
- Source measurements/screenshots: ../../.worktrees/source-sidebar/artifacts/source-sidebar/native/result.json and adjacent PNGs.
- FPS runtime evidence: ../preview-fps-final/result.json, playing.png, paused.png; LUX-208. Initial rejection is Conductor event 7a75f761-ec60-47dc-82de-aaddd7c1d5ee.
- Inspector outer-padding fix: main 3985d0e80eb23659f1f24d74e3d3998baddb1b73; LUX-203.
- Inspector search/density evidence: ../../.worktrees/inspector-group-density/artifacts/inspector-density/run-1789624565155/result.json; LUX-201.

The global skill intentionally omits Lux-specific paths, ticket mechanics, and graphics caps. Project instructions retain those responsibilities.

