# Installed-runtime validation checkpoints

This supplements the acceptance gates and the dedicated [performance design](../design/performance-monitoring.md). Passing an earlier row never certifies a later row.

| Check | Mechanism | What it establishes |
| --- | --- | --- |
| Package closure | Package inventory and capability tests | Exact files/hashes, compatible installed protocol, safe immutable storage. |
| Actual Studio export | `scripts/test-studio-ui.mjs` | Current full draft and applied control become a real package through trusted IPC and the packaging child. The native folder-picker result is supplied by the test. |
| Cross-runtime archive handling | `tests/unit/export-electron-fs.test.mjs` | Machine Node and bundled Electron inspect and copy the same raw ASAR bytes. Electron's archive-aware filesystem cannot substitute archive contents for file hashes. |
| Installed CPU startup | `scripts/test-installed-package.mjs` | The exported Electron executable installs into an isolated profile, starts the installed supervisor without machine Node on PATH, and exits after its documented idle timeout. No source is activated. |
| Native scan and ownership | CTest plus `installed-process.test.cjs` | Source name/control defaults can be scanned without InitGL; inert child processes belong to separate Windows Jobs. |
| Installed visual acceptance | Actual Resolume source activation and saved composition reopen | Correct first pixels/host controls, duplicate and different-source isolation, cold reopen, shutdown and rendering performance. **Still pending manual host QA.** |

Record `installMs`, `coldSupervisorReadyMs`, and `idleExitMs` from the CPU startup test separately. `coldSupervisorReadyMs` includes validation and readiness of the headless supervisor only; it excludes Electron producer startup, visual initialization and the first frame accepted by Resolume. It cannot pass the trigger-to-first-correct-frame gate.

This is a cold **process** start. The test installs and validates the package immediately beforehand, warming the operating-system file cache. It does not represent a cold disk/OS-cache benchmark. The singleton check starts a second supervisor process and verifies it exits while the original owner remains ready.

The Studio MCP test records `restartToReadyMs` from command submission to an acknowledged completed preview frame. It is a local authoring measurement, not a Resolume recovery or physical-display latency measurement. The current measured sample is stored with its identities in `evidence/standalone-lux/mcp-controls/result.json`.

The actual installed acceptance run must record cold first source, warm additional source and duplicate-source startup separately, and compare the first accepted frame's control sequence with the host snapshot. Report missing measurements as pending. Keep the reference tuple, workload, clock calibration and coverage requirements from the performance design; do not infer GPU throughput or confirmed execution-stop timing from watchdog timer constants.
