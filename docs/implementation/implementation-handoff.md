# Prompt for the implementation coordinator

**Current handoff authority (12 September 2026):** start with
[active creative-workflow priorities](current-priorities.md#active-order-creative-workflow-feedback-first)
and [live checkpoints](next-checkpoints.md). The user now prioritizes creating
real visuals and feeding back on the workflow ahead of additional infrastructure.
The existing Studio/MCP authoring, editor, docking and installed functional work
must be reused. [Creative-use guide](creative-workflow-checkpoint.md) is the next
user-facing checkpoint. The prompt below preserves the original implementation
handoff; its historical order and statements about missing integrations are not
the current work queue. Original release acceptance obligations remain in force.

Copy the prompt below into a new agent working in this Lux repository. The
original planning pass is complete; subsequent implementation includes the
[verified transport checkpoint](transport-status.md).

```text
Coordinate implementation of Lux tracer 0.1 in this repository.

The user revised tracer scope on 12 September 2026 (DEC-13): create visuals in
Lux, export/install reusable Resolume sources, and use them with Lux Studio
absent, including cold start and independent sources. Read
docs/implementation/tracer-export-scope.md first. It supersedes old single-host,
scratch-only and installed-export-later exclusions. Inspect current implementation
branches/evidence for reusable work; do not restart completed authoring or
transport experiments, and do not mistake them for a completed export workflow.

Read docs/implementation/transport-status.md before planning transport work.
Saved-scene GPU transport and persistent single-source Resolume playback are
implemented and verified on codex/resolume-transport at a5eee83 (local checkout
.worktrees/transport). Reuse its compiler/runtime/native path, control handshake
and lifecycle fixes. Its detailed reports and tr02-compiled-* evidence are on
that branch; application code has not been merged by the status-doc update.
Integrate carefully with newer Studio/core work. Installed export/runtime
provisioning, automatic cold start, independent sources/copies and the remaining
measurement/first-exported-frame gates are still required.

Read docs/README.md, docs/decisions.md, docs/architecture.md,
docs/design/tracer-contracts.md, docs/implementation/tracer-0.1.md,
docs/design/performance-monitoring.md,
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

Keep the API/UI small: one continuous intensity control per visual, external
AI submit-render-capture-revise, basic editable save/open and one large preview.
Include named immutable export, a basic install helper, complete pinned runtime
and asset bytes, automatic background startup, two independent sources/copies
and saved-composition cold reopen without Studio, AI, network, development tools
or manual producer launch. Editing must not change installed releases. Captures must reach
the model as image content and match their revision/frame metadata.
Do not build the full graph/library/docking/chat/audio UI or durable
project system in tracer 0.1. Preserve their documented extension points.

At acceptance, use three independent reviewers biased toward technical
reliability, product/requirement fidelity, and executable verification.
Resolve findings, retain raw evidence for every applicable acceptance gate,
and never mark unavailable metrics or mock-host tests as hardware success.
Implement the dedicated performance design early: bounded nonblocking
collection, separate CPU/GPU/UI/host metrics, calibrated clocks, telemetry
coverage, profiler overhead checks and negative accounting fixtures.
Stop after tracer 0.1 is implemented, reviewed, committed and honestly
validated, or after documenting a genuine external blocker requiring my
decision. Report commits, checks, evidence, limitations and the next
milestone handoff. Do not automatically implement 0.2 or later milestones.
```
