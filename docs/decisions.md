# Planning decisions

Status: coordinator decisions under the user's delegated authority. These guide implementation; feasibility claims still require experiments. The preserved source plans remain historical references.

| ID | Decision and reason | Authority / revisit condition |
| --- | --- | --- |
| DEC-01 | Use Project / Scene / Look / Component / Node / Asset / Library / Release / Runtime Instance as defined in project-model. A Look changes values/seed/modulation; topology changes duplicate or revise a Scene. | Coordinator adopts P 1; resolves vocabulary ambiguity. Revisit only with migration impact recorded. |
| DEC-02 | Structured graph data owns composition wiring; versioned custom code owns component implementation. AI and UI use the same operations. Do not attempt arbitrary code-to-graph round trips. | Coordinator adopts P 3 and D 6. |
| DEC-03 | Automatic successful AI preview plus Undo is the default; no Keep/Discard ceremony. Exported releases remain fixed. | Explicit prior user choice, D 5 and P 4. |
| DEC-04 | Preserve all existing plans. New modular docs reconcile proposals and requirements; do not edit source records to hide contradictions. | User direction. |
| DEC-05 | Prefer one Windows x64 tracer on the installed RTX 2070 / Resolume Avenue 7.27.1; confirm actual adapter and capabilities in environment preflight. | Coordinator adopts available host; no additional platform commitment. |
| DEC-06 | Prefer Electron/React/TypeScript and Three.js TSL/WebGPU, with separate supervisor/render host and native FFGL source. GPU handoff is unproven and gates SDK/editor expansion. | D Appendix A is a proposal. Runtime/bridge design owns experiment and fallback. |
| DEC-07 | Preserve one running scene across layout changes. Preview is a presentation consumer; neither docking nor an inspector owns runtime lifetime. Host instance remains independent from studio instance. | User UI acceptance plus D 4.2. Same visual/runtime means same implementation, not shared mutable studio/host state. |
| DEC-08 | Ultrawide Preview + Graph side by side; laptop central tab group. Custom saved machine layouts, independent panels, explicit output inspection, resolution scopes and dockable Inputs. | Accepted conversation decisions U01–U09. |
| DEC-09 | Full processed effect output feeds Composite once; bypass passes input for image effects. A dedicated glow-only branch has zero-emission disabled output. | Coordinator resolves D 6's raw-plus-processed example using P 5, avoiding accidental doubled particles. |
| DEC-10 | Tracer uses one simple component, one named continuous control, one actual viewable capture path and real FFGL playback. Full graph, project persistence, embedded chat, library, audio setup and installer follow in their milestones. | D milestone boundaries; early interfaces preserve extensions without building them. |
| DEC-11 | Three independent review biases: feasibility/reliability, product/coverage, execution/verification. Same frozen commit; separate reports; coordinator disposition and focused rechecks. | User requested three independent reviewers. |
| DEC-12 | No application implementation, dependency installation, benchmark runs or host modification during this pass. Documentation completion permits starting bounded tracer feasibility work; it does not certify the chosen bridge. | User's stop condition. |

## Escalation policy

Coordinator can select routine paths, tooling, naming and implementation mechanisms with documented evidence. Escalate only a material unmet user requirement, a cost/license/account decision, or a platform/runtime fallback that changes promised authoring or playback behavior. An experiment that cannot meet the GPU contract blocks dependent tasks; it does not justify silently replacing playback with recording or CPU streaming.
