# Prompt for the implementation coordinator

Copy the prompt below into a new agent working in this Lux repository. This planning task stops before application implementation.

```text
Coordinate implementation of Lux tracer 0.1 in this repository.

Read docs/README.md, docs/decisions.md, docs/architecture.md,
docs/design/tracer-contracts.md, docs/implementation/tracer-0.1.md,
docs/implementation/tracer-acceptance.md, docs/implementation/environment.md,
and docs/reviews/disposition.md. Load the subsystem design documents needed
for each task. The original plans/ files are preserved source records;
docs/requirements.md and the decision log record their reconciliation.

Implement TR-01 through TR-07, using the dependency order and stop gates.
Start by validating/pinning the actual machine, toolchain, host and MCP
client profile; then prove actual WebGPU-originated GPU frames reaching
the real FFGL source before expanding the SDK or editor. Do not assume
Electron shared-texture interoperability or synchronization is proved.

Own integration, shared contracts, a small progress log and frequent Git
commits. Delegate only independent bounded tasks, using separate worktrees
and exclusive file ownership. Freeze contracts before dependent work;
TR-05 needs the real core service from TR-04, so these tasks run sequentially.
Run GPU/host acceptance serially. Review changes before integration.
Make routine decisions autonomously and record evidence. Escalate material
product changes, paid/license decisions, or a backend fallback that changes
the promised authoring/runtime capabilities. A failed feasibility gate
stops dependent work; preserve the experiment and propose the next bounded
decision, never silently substitute screenshots or video playback.

Keep tracer scope small: one scratch visual, one continuous intensity
control, external AI submit-render-capture-revise, one large preview,
play/pause/reset/restart/status, separate host instance, and actual dynamic
Resolume playback that survives closing Studio and AI. Captures must reach
the model as image content and match their revision/frame metadata.
Do not build the full graph/library/docking/chat/audio UI or durable
project system in tracer 0.1. Preserve their documented extension points.

At acceptance, use three independent reviewers biased toward technical
reliability, product/requirement fidelity, and executable verification.
Resolve findings, retain raw evidence for every applicable acceptance gate,
and never mark unavailable metrics or mock-host tests as hardware success.
Stop after tracer 0.1 is implemented, reviewed, committed and honestly
validated, or after documenting a genuine external blocker requiring my
decision. Report commits, checks, evidence, limitations and the next
milestone handoff. Do not automatically implement 0.2 or later milestones.
```
