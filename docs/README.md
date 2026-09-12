# Lux engineering documentation

Status: documentation and planning complete; reviews closed; ready for tracer implementation. Start with [progress](planning-progress.md) and [requirements](requirements.md). Runtime feasibility remains subject to the planned experiments.

The original [design and handoff](../plans/ai-visual-workshop-design.md) and [domain proposal](../plans/domain-and-workflow-proposal.md) remain preserved source records. Direct user decisions take precedence. This document set will record implementation decisions explicitly; an earlier proposal is not silently treated as user approval.

## Document ownership

Requirements own outcomes and source references. Architecture owns cross-subsystem boundaries. Subsystem designs own detailed contracts. Implementation plans own ordered work and acceptance evidence. Link to authoritative definitions instead of duplicating them.

Specialist drafting assignments:

| Owner | Files |
| --- | --- |
| Runtime/bridge | `design/runtime.md`, `design/resolume-bridge.md` |
| Core/AI | `design/project-model.md`, `design/ai-authoring.md` |
| Studio/inputs | `design/studio.md` including UI diagrams |
| Coordinator | Architecture, decisions, requirements, implementation plans, progress, review disposition |

## Reading paths

- **Product:** [requirements](requirements.md), [decisions](decisions.md), [studio and UI diagrams](design/studio.md).
- **Architecture:** [system diagrams and ownership](architecture.md), [cross-subsystem tracer contracts](design/tracer-contracts.md).
- **Runtime/native implementation:** [runtime](design/runtime.md), [Resolume bridge](design/resolume-bridge.md), [environment](implementation/environment.md).
- **Application/AI implementation:** [project model](design/project-model.md), [AI operations and capture](design/ai-authoring.md).
- **Execution:** [tracer task plan](implementation/tracer-0.1.md), [acceptance/evidence](implementation/tracer-acceptance.md), [later milestone coverage](implementation/roadmap.md).
- **Review:** [disposition and readiness](reviews/disposition.md), [technical](reviews/technical.md), [product](reviews/product.md), [execution](reviews/execution.md).
- **Handoff:** [copyable coordinator prompt](implementation/implementation-handoff.md).
- **Checks:** [documentation validation](validation.md).

The task plan defines work order; subsystem contracts define behavior. The tracer contract map resolves cross-document naming/ownership. Actual implementation results belong in evidence manifests, not in source design prose. Planning readiness is permission to execute the bounded experiments, not a claim the proposed GPU path works.
