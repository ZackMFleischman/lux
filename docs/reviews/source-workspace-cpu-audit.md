# Source workspace CPU coverage audit

Date: 2026-09-12. Static source/test inspection on codex/tracer-0.1 after a8bc614; no new test execution, Studio launch or GPU use for this audit. Historical passing results in progress.md remain historical evidence.

| Area | Existing evidence inspected | Gap and priority |
| --- | --- | --- |
| Compiler bundle admission | compiler.test.mjs rejects traversal, case collisions, malformed Unicode, source/file budgets and unsupported SDK | Good baseline. UI needs matching path feedback; avoid divergent validators. |
| Sibling imports | compiler.test.mjs compiles main.ts importing settings.ts and checks emitted sibling module | P1: helper-only changes affecting hashes; helper-file diagnostic path/line; deleted required helper. |
| Runtime linking | link-runtime.test.mjs links real single-file example, verifies hashes and rejects import escapes/tampering | P1: exercise a genuinely multi-file artifact through linker and tamper with helper bytes. Compiler sibling success alone is not linker coverage. |
| Persistence | scene-file.test.ts roundtrips one-file Unicode draft, handles external conflict and replacement failure | P1: nested three-file bundle, full-byte equality, alternate entry, whole-bundle failure preservation. |
| AI bridge | agent-bridge.test.ts covers authorization, Origin refusal and request deduplication | Does not test authoring draft semantics; transport authorization is not stale-edit protection. |
| AI authoring | scripts/test-studio-mcp.mjs exercises source read/build, changed captured image, stale version and hanging candidate retention | Real app coverage, not CPU-only. P1: extract/inject draft/session logic for failed build, busy lock, complete-bundle adoption and helper preservation tests. |
| Source UI | authoring.tsx edits entry string and recombines it with bundle.files | P1: unsaved helper buffers and multiple source views have no implementation or tests. Store needs one authority shared by read/save/build. |
| Diagnostics | compiler returns structured locations; standalone-client.ts flattens them to Error text | P1: retain typed locations and submitted version, test stale/missing-file navigation. |
| Presentation | interactions.test.tsx exercises controls/fullscreen and DOM surface continuity | Retain these checks; add source-tab/typing tests asserting presentation is not remounted. Native sizing still requires actual UI validation. |

The current authoring component's disabled fields reduce edit/build races, but its mutable draft ref and separate entry state are not a tested multi-file transaction model. This is an implementation risk to resolve before enabling more editing paths, not a demonstrated current data-loss incident.

Recommended CPU sequence: pure store/session tests first, then editor interactions, structured diagnostics, and expanded compiler/linker/persistence fixtures. See [implementation plan](../implementation/source-workspace-plan.md) Tasks 1–5. Keep actual image capture/revision coverage in the existing real-app suite, scheduled only after exclusive transport testing ends.
