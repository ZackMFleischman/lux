Implementation evidence:
- `npx tsc -p apps/studio/tsconfig.json --noEmit`: pass on c19af935.
- Focused analyzer/contract/provider/evaluator/runtime/transport tests: 34/34 pass.
- Built interaction suite: 26/26 pass; existing React act warning only.
- Visual worker suite with VM modules: 17/17 pass.
- `node apps/studio/test-cpu.mjs`: every stage passed after adding the standard worktree dependency junction: 214 + 26 + 17 + 8 + 11 + 4 + 28 + 21 tests.
- Independent source review `/root/review_shortcuts_final`: PASS at c19af935; independent narrow run 24/24 pass.

Native evidence:
- Artifact directory: `C:\Users\zFlei\repos\lux\.worktrees\studio-kick\artifacts\studio-kick\run-1789550404570`.
- `result.json`: isolated profile `test-4b39e498-f73d-45d8-b1b6-8c316b3b32cb`, 640x360 preview, enumerated OS input `Audio input 1`, no page errors, owned PID 23808 exited 0.
- Actual input moved kick-bound Spike height from 0.85 to 0.911836 and preserved highs-bound Noise scale from 3.400518 to 3.486608.
- Saved scene preserves 640x360, manual Spike height base 1, exact kick settings, both bindings and shared analyzer; it contains no device ID or device label.
- Disconnect samples converge to Spike height 1 and Noise scale 3.404951 within the harness tolerance.
- `connected-kick-controls.png` and `disconnected-kick-base.png`: actual running Studio screenshots at the tested resolution.
- Independent native/UI/evidence review `/root/review_shortcuts_final`: PASS; screenshots readable and unclipped, evidence internally consistent.

