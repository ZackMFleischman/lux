# Filesystem-first projects architecture review

Status: approved after independent review and correction rechecks, 12 September 2026. No unresolved blocking findings remain in the three review scopes. This review concerns documentation readiness; no filesystem-project feature is claimed implemented or hardware-validated.

## Scope and process

Reviewed [architecture](../design/filesystem-projects.md) and [implementation plan](../implementation/filesystem-projects-plan.md) against current tracer source, user-approved normal coding environments and first-release Git awareness, manual Studio editing, libraries/references, and the existing runtime/export boundary. The draft was checkpointed at `42335b9`; manual-editor/Git clarification at `75e1ac8`. Review corrections are recorded below and committed with this report.

Three reviewers examined the complete documents independently, without receiving each other's conclusions. The coordinator reconciled overlapping findings, revised both architecture and plan, and requested a second check. These were actual agent reviews, not a checklist completed by the author.

| Review | Emphasis | Final disposition |
| --- | --- | --- |
| `filesystem_integrity_review` | Saved/accepted/running state, external writes, crash ordering, Git/index races, identity and recovery | Approved on recheck; no remaining blocking/high/medium finding in scope. |
| `filesystem_workflow_review` | Normal editor/agent experience, Studio buffers, project/scene/component/library ownership and migration | Approved on final recheck, including direct package-export identity and its test requirement. |
| `editor_apply_polish` | Concrete APIs/file boundaries, Windows I/O, Git no-execution, type/compiler parity, dependency closure and tests | Approved on final recheck; all original findings and the package-export follow-up are closed. |

## Findings and resolutions

| ID | Finding / concrete failure | Resolution and validation required by plan |
| --- | --- | --- |
| F01 — High, all reviewers | Local manifests lost source-envelope identity, and one global SDK pin could not faithfully import SDK 0.1/0.2 scenes or distinguish v1 from empty-assets v2. | Per-definition sdkVersion/sourceVersion; exact supported SDK variants in the toolchain; mixed-SDK scenes allowed but each resolved closure uses one SDK. Imports/exports test legacy, empty v2 and mixed projects. No silent conversion. |
| F02 — Medium, integrity/workflow | Relocating source changes compiler sourceHash; valid older saved control caches could be rejected or incorrectly relabeled. | Validate cached schema/value shape; preserve cached origin. Derive new accepted source/schema/value provenance and a migration report after compilation. Store that separately from unchanged raw scene bytes. Explicit Save scene controls updates disk; accepted export uses derived values. |
| F03 — Medium, integrity/workflow | Merge-conflict blocking had no rule when optional Git status was unavailable or the index changed without text changes. | Separate mandatory unmerged-index fingerprint/lease from optional working-tree status. Unknown mandatory state blocks repository apply, but allows draft saves; verified non-repositories need no Git. Tests cover unchanged content with changed index stages and unavailable inspection. |
| F04 — Medium, workflow | A new agent could not obtain its first session ID; lost response/restart recovery lacked an API. | listOpenProjects/openProject bootstrap; discover includes Git; jobStatus/requestStatus support unknown jobId and new session after restart. Unknown/expired receipt means uncertainty and explicit reread, not blind retry. |
| F05 — Medium, workflow | Ctrl+S on Scene A appeared to apply only A despite another saved draft B in the complete project candidate. | Save A succeeds, but additional pending diff blocks narrow apply; review and explicit wider scope required. Invalid B leaves prior preview. Selective partial-project acceptance is explicitly later, not silently promised. |
| F06 — Medium, workflow | Entity scope could not authorize project metadata or unused package/toolchain changes. | Tagged project vs entity scope. Project-wide metadata/dependency changes require explicit project scope; registry edits for named entities have stated rules. Empty entity lists are not project authority. |
| F07 — High, feasibility | Reading Git config and then running live status leaves a config-replacement race that can execute filters/hooks; old Git fsmonitor boolean handling is incompatible. | Git >=2.39.0 plus command probes; private observation Git directory with captured metadata and core-owned configuration. Never reload live repository/includes into the subprocess. Optional content status needs a safe bounded local closure or reports unavailable. Static and racing executable-config sentinel tests required. Official Git behavior was checked against its config documentation. |
| F08 — Correction, feasibility/coordinator | Editor example used ES2022 while the real compiler uses ES2023/DOM. | Sample aligned; per-definition SDK configs and offline tooling tests must track the pinned compiler contract. |
| F09 — Correction, feasibility | Duplicate-key rejection cannot be done after JSON.parse overwrites keys. | Bounded raw duplicate-key-aware parsing precedes schema validation; literal duplicate keys, depth/string limits and invalid UTF-8 are explicit tests. |
| F10 — Medium, workflow recheck | Direct package-backed scenes lacked the entry SDK/envelope metadata defined for local components. | Every package code export declares SDK/sourceVersion/entry/files/references/assets. Add direct package-backed legacy-v1 and empty-v2 resolution/re-export fixtures. |
| F11 — Clarification, integrity | Maximum declaration pack could exhaust the separate candidate-cache cap before any project content fit. | Stream verified pack objects into the 1 GiB immutable store; count/reserve temporary object writes there. Candidate/cache allowance counts references and authoring work rather than the pack twice. |

## Coordinator consistency checks

- Architecture and plan share the project/ unit ownership map, public operation names, Ctrl+S behavior, source-envelope semantics and project-vs-entity scope.
- Local Markdown document links resolve; `git diff --check` passes.
- Git behavior citation verified against [official git-config documentation](https://git-scm.com/docs/git-config#Documentation/git-config.txt-corefsmonitor); observed local Git is 2.39.0.windows.1. This is not a completed Git-adapter security test.
- Native no-clobber save tests include an external creation between original backup and replacement; both versions must survive.
- No Studio or Resolume was launched for this documentation review. No filesystem-project runtime tests exist merely because the plan names them.

## Remaining implementation evidence

Planning approval cannot certify native file/index leases, exclusive replacement races, power-loss durability, runtime promotion, packaged mixed-SDK type resolution or Git subprocess nonexecution. The implementation plan explicitly requires those real filesystem/process/compiler/Studio checks. Unsupported Git/filesystem states must remain visible failures or unavailable observations, never fabricated passes. Essential performance collection and tracer acceptance still precede implementing this project milestone.
