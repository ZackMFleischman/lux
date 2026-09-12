# Review disposition and readiness

Initial review snapshot: `c6cf8eee4481daa73673188f10af58d6aa3016ef`. Three reviewers examined it independently before any findings were shared. [Technical report](technical.md), [product report](product.md), [execution report](execution.md). Initial reports remain unchanged as historical evidence; rechecks will be separate files.

Two reviewers were fresh agents. The execution reviewer previously authored the initial core designs because the harness refused a further fresh agent at its thread limit. That reviewer did not read or discuss either other report; the fresh reviewers independently covered the core designs too. This is independence between reviews, not a claim all three were independent of authorship.

## Findings and corrections

| Finding | Disposition | Correction / verification contract |
| --- | --- | --- |
| TECH-01: output/runtime generation ambiguity | Accepted, corrected; recheck pending | Separate outputGeneration in native frame/ring/ack/cache keys; runtime generation remains renderer incarnation. Old-ring lease completion cannot retire same-number new slot; TR-03 contract test. |
| TECH-02: host identity/reconnect allocation | Accepted, corrected; recheck pending | Plugin allocates pluginClientId; service allocates canonical runtime UUID and idempotently maps Attach. Service/connection epochs reject stale pipes; duplicate/lost reply/restart cases specified. |
| TECH-03: paused control/reset rendering | Accepted optional improvement, corrected; recheck pending | Changed controls render one fresh frame at frozen time; reset renders zero-time new-epoch output and remains paused. No old-pixel relabeling. |
| PROD-01: missing frame-step | Accepted, corrected; recheck pending | S05, Studio/runtime/AI step semantics and milestone 4 test route; same shared operation, exact step/input policy, host unchanged. No tracer scope expansion. |
| PROD-02: analytical diagnostic weakened | Accepted, corrected; recheck pending | C03 requires a bounded particle-position fixture in milestone 3; max 1024 samples/64 KiB/five seconds, same-tick provenance, explicit unsupported result elsewhere, AI before/after test. |
| EXEC-01: premature core/UI parallelism | Accepted, corrected; recheck pending | TR-05 follows committed TR-04 real core service. Dependency graph and handoff now sequential; independent subtasks/reviews can still use worktrees. |
| EXEC-02: IDs/ControlId conflict | Accepted, corrected; recheck pending | Entity UUID allocator distinguished from declared control keys (`intensity`) and pluginClientId; same reconnect correction as TECH-02. |
| EXEC-03: low-rate host false pass | Accepted, corrected; recheck pending | Full independent 300-second window and measured 59.4–60.6 Hz host cadence prerequisite; 30 Hz synthetic negative fixture must fail. |
| EXEC-04: unmatched control latency omitted | Accepted, corrected; recheck pending | 600 distinct normal-rate stimuli at 2 Hz, exact count/version reconciliation, 250 ms drain; missing responses fail; coalescing overload separate; negative calculator fixture. |
| EXEC-05: host artifact retention missing | Accepted, corrected; recheck pending | Active binding and live recovery closures explicitly rooted before Attach and through unrelated studio edits; failed replacement preserves prior artifact; bind A/edit B,C/collect/attach/restart test. |
| EXEC-06: inconsistent environment paths | Accepted optional cleanup, corrected; recheck pending | All immutable environment/preflight evidence uses `evidence/tracer-0.1/<run-id>/`. |

## Coordinator verification

- Found and corrected two Mermaid sequence-label parse errors; all nine diagrams rendered successfully using Mermaid 11.12.0 in headless Chromium before review corrections. Re-render required after final edits.
- Initial link/fence/coverage check: 16 design/planning documents, 115 relative links, 43 requirement IDs all routed, no broken links/fences. Added S05 increases requirement count; final recheck required.
- Both original `plans/` files matched their exact bytes at source commit `1c9c884`.
- No application implementation or application test suite run in this pass. Source inspections and diagrams do not prove runtime feasibility.

## Readiness boundary

Current state: corrections prepared; waiting for focused reviewer rechecks and final document validation. Start implementation only after this document records closure. Remaining hardware/API unknowns are deliberately assigned to TR-01/TR-02 with stop gates, not waived. Final numerical performance and installed release capability remain future measured evidence.
