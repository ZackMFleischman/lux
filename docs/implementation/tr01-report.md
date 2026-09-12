# TR-01 harness implementation report

Worktree: `C:/Users/zFlei/repos/lux/.worktrees/tr01-harness`, branch `codex/tr01-harness`, base `7d7a5f1`.

## Delivered

- Minimal pnpm workspace and runtime-contracts package, strict TypeScript check/build, exact package lockfile.
- Schema-validated preflight collector with actual Windows/CIM, VS C++ workload, SDK, compiler, CMake, installed package and Electron binary probes. Inventory never selects an adapter or asserts host cadence. Source commit, dirty status, source SHA256 hashes, raw commands/results, SDK source commits/licenses and build ABI are preserved.
- Native Windows x64 CMake smoke target verifies QueryPerformanceCounter/QueryPerformanceFrequency. No GPU or FFGL claim.
- Test-only MCP stdio server, discoverable `lux_fixture_image`, actual 32x32 PNG quadrants, explicit 2025-11-25 profile, 10-second connection/discovery/call deadlines, raw negotiation/list/call transcript, unsupported-profile rejection and fresh connection test. Fixture stays outside the application tool registry.
- Every requested command exists. Later suites exit 2 with TR-02/TR-04/TR-05/TR-06/TR-07 and concrete prerequisites.

## Verification

Test-first evidence: initial unit test failed because preflight schema module did not exist; initial MCP test failed because fixture runner did not exist. Unsupported-profile regression first failed with missing expected rejection, then passed after strict negotiated-profile validation. Default sandbox disallowed test process spawning; approved elevated execution ran the real tests.

Final run:

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass; lock current, 2 workspace projects |
| `pnpm typecheck` | Pass |
| `pnpm test:unit` | Pass, 3 tests |
| `pnpm build` | Pass, declaration/JS output for current minimal contracts |
| `pnpm native:build` | Pass, MSVC build and CTest 1/1 |
| `pnpm test:mcp -- --profile-fixture` | Pass, 2 tests; actual stdio and PNG decode |
| `node scripts/preflight.mjs` / `pnpm preflight` | Expected exit 2; integration measurements unavailable |
| `pnpm test:gpu`, `test:studio`, `test:host`, `test:acceptance`, bare `test:mcp` | Expected exit 2 with owning task and prerequisites |
| native build with nonexistent `-VsWhere` path | Expected exit 1, names missing VS Installer/C++ workload |
| preflight with nonexistent `LUX_PREFLIGHT_HOST` | Expected unavailable host and Node exit 2, no inferred host pass |
| `git diff --check` | Pass |

Observed tuple: Windows11 Pro10.0.26200 x64; development Node24.12.0/pnpm10.33.0; Electron44.3.0/Chromium152.0.7977.78/embedded Node24.20.0/V815.2.124.19-electron.0/native ABI149/NAPI10; Three0.186.0; MCP SDK1.30.0; TypeScript7.0.2; Zod3.25.76; VS18.1.11312.151; MSVC19.50.35721.0 (toolset14.50.35717); CMake4.1.1-msvc1; SDK10.0.26100.0; native QPC10MHz. Installed Avenue file version7.27.1.15990.

Electron44 package has lazy binary downloading in its require entry. The binary was explicitly installed with `node node_modules/electron/install.js`; preflight now reads installed path metadata and directly launches Electron with ELECTRON_RUN_AS_NODE=1, never triggering installation during inventory. Initial failed collector evidence is intentionally retained beside corrected runs.

Final preflight: `evidence/tracer-0.1/2026-09-12T03-51-30-077Z/{environment.json,preflight.md}`. Implementation source commit9c869cd; dirty marker honestly includes the newly generated untracked MCP evidence, with source file hashes recorded.

Final MCP transcript: `evidence/tracer-0.1/mcp-2026-09-12T03-51-27-034Z/mcp-transcript.json`.

## Readiness decision and remaining gates

Harness/toolchain/protocol fixture: PASS. Full integration readiness: UNAVAILABLE, as intended. Actual renderer/bridge/host LUIDs, measured host refresh, timestamp-query support/coverage and runtime trace categories require the bounded TR-02 discovery experiment. The automated manifest leaves host plugin preference and model image observation unavailable instead of importing coordinator claims. Coordinator separately observed actual host and model-visible fixture through shell/tool bridge; see its `evidence/tracer-0.1/tr01-model-observation/mcp-observation.json`. Native Codex MCP registration was not tested. No T01/T02 rendered AI loop, host transfer, GPU readiness, or production visual success is claimed.

Per coordinator decision, the passing harness/toolchain plus separately observed fixture permits only the bounded TR-02 discovery experiment to establish missing hardware IDs/capabilities, not SDK/editor expansion.

Checkpoint commits: `7a588e3` (harness), `9c869cd` (inventory/profile corrections); final evidence commit is reported directly to coordinator.

## Review fix round 1

Addressed both P2 findings from task-1-review.md with no integration scope expansion:

- MCP test aggregate budgets now allow 35 seconds per fixture run (three 10-second phases plus 5 seconds cleanup), and 70 seconds for rejection plus reconnect. Existing phase deadlines stay 10 seconds.
- Electron path resolution/read is guarded. Missing package now produces a failed dependency check, unavailable runtime tuple with an actionable install prerequisite, schema-valid evidence, and exit 2.
- Added a test-only Node module-resolution fault fixture. It removes Electron availability only in the collector subprocess; installed dependencies are untouched.

Exact focused commands/results:

1. `node --test tests/unit/preflight-missing-electron.test.ts` initially failed during test-fixture setup because Node registerHooks did not intercept createRequire.resolve. Replaced that test-only mechanism with scoped Module._resolveFilename interception.
2. Re-ran `node --test tests/unit/preflight-missing-electron.test.ts`: expected RED, collector threw at the unguarded Electron resolution and exited 1 rather than 2. This reproduced the review finding before the production fix.
3. After the guard and aggregate timeout changes, ran `node --test tests/unit/preflight-missing-electron.test.ts tests/mcp/profile-fixture.test.ts`: PASS, 3 tests, 0 failed, 4754.9801 ms total. Individual cases: image fixture 955.2005 ms; unsupported profile/reconnect 2130.9533 ms; missing Electron evidence 4450.1453 ms. This command completed before the user interruption; no command remained running and tests were not repeated afterward.
4. `git -c safe.directory=C:/Users/zFlei/repos/lux/.worktrees/tr01-harness diff --check`: PASS.

Missing-Electron evidence retained at `evidence/tracer-0.1/2026-09-12T03-58-13-463Z/`. The unsuccessful first test-fixture setup's incidental inventory run was removed; its failure is documented above. No native/hardware or broad suite rerun was needed for these focused changes. Review-fix commit hash is sent directly to coordinator.

## Review fix round 2

Addressed the evidence-namespace P2. Preflight now accepts a general `--output-root <directory>` CLI option for CI/isolated diagnostics; its default real-evidence location is unchanged. Relative output paths resolve from the caller's working directory. The missing-Electron regression uses a uniquely created OS-temp directory, verifies the manifest is beneath that directory and the real evidence directory listing is unchanged, and removes only its own verified temporary directory in finally.

Focused verification only:

- `node --test tests/unit/preflight-missing-electron.test.ts` before implementation: expected RED, asserted temporary output parent differed from actual production evidence parent; confirmed the option was not implemented.
- Same command after implementation: PASS, 1 test, 0 failures; 3235.4684 ms case duration / 3492.0973 ms total. It verified structured missing-Electron evidence/exit 2 and no production-evidence additions.
- `git -c safe.directory=C:/Users/zFlei/repos/lux/.worktrees/tr01-harness diff --check`: PASS.

Removed the specifically reviewed synthetic run `2026-09-12T03-58-13-463Z` from current production evidence; history preserves it in commit89c1c44. Also removed only the exact newly generated RED-test artifact `2026-09-12T04-03-03-054Z`, created before the new option worked. No real observation runs or other artifacts were removed. The previous round's statement that the synthetic run was retained is superseded by this correction.
