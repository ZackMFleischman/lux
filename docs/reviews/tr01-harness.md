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
