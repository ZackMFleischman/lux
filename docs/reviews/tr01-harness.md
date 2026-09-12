# TR-01 review — spec compliance and code quality

Reviewed frozen source `7d7a5f1..9c869cd` and evidence-only commit `ab6e699` in `C:/Users/zFlei/repos/lux/.worktrees/tr01-harness`. Review was read-only apart from this report. I inspected the focused lockfile entries for the selected npm packages and did not repeat the reported full test matrix.

## Findings

### [P2] Let each MCP phase use its declared 10-second budget

`tests/mcp/profile-fixture.test.ts:7` and `:27` give each whole test only 15 seconds, while `tests/mcp/run-fixture.mjs:23`, `:26`, and `:28` independently allow connection, discovery, and call phases up to 10 seconds. The first test can therefore be killed at 15 seconds even when every phase remains within contract; the reconnect test performs two fixture runs and has the same aggregate limit. This makes the required bounded profile/reconnect evidence timing-dependent and can misreport a conforming but slower stdio client as a test failure. Set an aggregate timeout that covers the sum of the phase bounds plus cleanup (and both runs in the reconnect case), or enforce one explicit 10-second end-to-end deadline and align the phase declarations and tests with that contract.

### [P2] Preserve structured preflight evidence when Electron is absent

`scripts/preflight.mjs:30-39` catches missing package metadata and prepares a failed dependency check, but `scripts/preflight.mjs:51` then calls `require.resolve('electron')` unconditionally. On the exact missing prerequisite this collector is meant to explain, execution throws before schema validation, evidence-file creation, the named prerequisite output, and the intended exit-2 unavailable decision. Guard Electron path resolution in the same way as the dependency probe and carry the failure into `Electron executable version tuple`; reserve an execution failure for malformed collector behavior. Add a focused regression for preflight with Electron unavailable.

## Verdicts

**Spec compliance: CONDITIONAL PASS for the bounded TR-02 experiment; CHANGES REQUIRED for full TR-01 harness acceptance.** The committed evidence supports the exact development/runtime tuple, Windows x64 native smoke, explicit MCP `2025-11-25` negotiation, tool discovery, actual 32×32 PNG `ImageContent`, isolated stdio fixture, nonzero unavailable suites, and an honest `integrationReady: false` outcome. The coordinator's separate host launch and visible fixture observation satisfy the agreed exception for starting bounded TR-02. Finding 2 leaves the required missing-prerequisite behavior incomplete.

**Code quality: CHANGES REQUESTED.** The implementation is compact and keeps inventory, fixture success, and actual integration claims separate. Findings 1 and 2 should be fixed before treating the harness as a reliable gate across unavailable or slow environments.

## Evidence still missing by design

- Renderer, bridge, and host DXGI LUIDs and proof that they match.
- Actual host cadence/refresh measurement, GPU timestamp-query support and coverage, and runtime trace-category coverage.
- Live FFGL/Spout transfer, plugin callback behavior, selected test composition, and rendered AI feedback loop.
- Native Codex MCP server registration. The observed image path was Codex orchestrator → shell/tool bridge → SDK stdio client → fixture, and proves only that topology.
- Harness-owned host launch and plugin-directory evidence. The coordinator separately observed Avenue launch, RTX 2070 renderer initialization, and the existing additional FFGL directory; the committed preflight correctly does not import those observations or claim integration readiness.

These gaps belong to TR-02 or later under the coordinator ruling. No SDK/editor expansion is justified until TR-02 passes.

## Fix recheck — `89c1c44`

Reviewed only `ab6e699..89c1c44`, the appended implementation report, and the focused evidence. I did not repeat the full suite.

### Original finding closures

- **CLOSED — MCP aggregate timeout.** `tests/mcp/profile-fixture.test.ts:7-10` now budgets 35 seconds for one run (three independently bounded 10-second phases plus cleanup), and `:30` budgets 70 seconds for rejection plus reconnect. This is consistent with the unchanged 10-second connection, discovery, and call deadlines. The focused MCP cases passed.
- **CLOSED — missing-Electron preflight.** `scripts/preflight.mjs:51-64` now guards package/path resolution and carries the failure into the structured dependency and runtime-tuple checks. `tests/unit/preflight-missing-electron.test.ts:7-19` verifies schema-valid evidence, exit 2, actionable prerequisite text, and a null runtime. The focused regression passed.

### [P2] Keep fault-injection output out of the real evidence namespace

`tests/unit/preflight-missing-electron.test.ts:8-19` runs the production collector without overriding its output root, so every ordinary unit run writes a timestamped, deliberately synthetic missing-Electron manifest under `evidence/tracer-0.1/`. Commit `89c1c44` already retains one at `evidence/tracer-0.1/2026-09-12T03-58-13-463Z/`, alongside actual preflight runs and with the same schema and naming convention. This pollutes the audit trail, dirties the worktree on every test run, and allows fault-injected evidence to be mistaken for a real machine observation. Add a collector output-root option, direct the regression to a temporary test directory, and clean it up; remove the synthetic run from retained runtime evidence or place it in an explicitly test-only fixture location.

### Closure verdicts

**Spec compliance: PASS for the authorized bounded TR-02 experiment.** Both prior spec-affecting P2s are closed. The original integration evidence gaps remain unavailable by design and still prohibit SDK/editor expansion until TR-02 passes.

**Code quality: CHANGES REQUESTED.** The two reviewed fixes are correct, but the new P2 evidence-namespace pollution should be resolved before final TR-01 harness acceptance.

## Fix recheck round 2 — `1660876`

Reviewed only `89c1c44..1660876`, the appended report, and the stated focused 1/1 regression result. I did not rerun the test or broaden the review.

- **CLOSED — fault-injection evidence namespace.** `scripts/preflight.mjs` now accepts `--output-root`, resolves a relative override from the caller's working directory before changing to the repository root, and preserves the existing production default. `tests/unit/preflight-missing-electron.test.ts` creates a unique OS-temporary root, passes it explicitly, verifies the emitted run is directly beneath that root, asserts the production evidence listing is unchanged, and validates the deletion target is directly beneath the OS temp directory before cleanup.
- The synthetic `2026-09-12T03-58-13-463Z` run is absent at `1660876`; the retained actual preflight and MCP transcript remain present. The source worktree is clean and the scoped diff passes `git diff --check`.
- No new breakage found in the scoped change.

### Final closure verdicts

**Spec compliance: PASS for TR-01 within its declared scope and the coordinator's bounded-TR-02 ruling.** Full integration readiness remains intentionally unavailable pending the previously listed TR-02 measurements.

**Code quality: PASS.** All three review findings are closed at `1660876`.
