# Real Studio recovery checks

13 September 2026 UTC. Runtime implementation from stable `b3b72ba`; test: `node scripts/test-studio-recovery.mjs`. Both scenarios passed in one owned Electron instance. No Resolume was launched.

The test builds the SDK 0.2 parameter example with an update-time failure after animation time exceeds 0.35 seconds. One scenario throws; the other enters an infinite JavaScript loop in its dedicated worker. Initial creation and explicit restart remain paused, so the injected loop does not run during initialization.

Both scenarios verified:

- One automatic restart advances generation and preserves acknowledged playing state plus brightness 0.8 and speed 0.7.
- A second fault suppresses automatic retry; another 1.1 seconds does not create another generation.
- Accepted source and draft version remain unchanged.
- Explicit restart advances generation, starts paused and preserves both controls.
- Captured metadata matches the recovered generation/controls. Center pixels match the known reference `[231,124,170,255]` within one byte; the outside area remains transparent. A successful API response alone is insufficient.
- No page errors; Studio remains controllable through MCP throughout. The owned app closes after the run.

In the final run, the parent first reported failure 374 ms after the applied Play response for the throwing scenario and 1,750 ms for the unresponsive scenario. These are **observations from Play**, including the deliberately delayed injection and polling/IPC latency. They do not identify the exact injection instant or independently prove physical execution stop/GPU cleanup. No two-second physical-stop or five-second host-consumed recovery budget is claimed.

Reports, state observations and recovered PNGs are retained under `.worktrees/parameter-integration/artifacts/studio-recovery/`. The committed harness recreates them. Installed renderer recovery, current host values on a recovered consumed frame, and physical process/GPU-resource timing remain separate acceptance work.
