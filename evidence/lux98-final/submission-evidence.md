Setup and source

- Worker c6435570-912f-49cd-991c-adfc1c47b234; session 090a5c9b-bc59-4fe1-ad49-c44bdbb7ca53; claim 0d3c1b40-09e7-4a4f-a30b-894a489ac0d1.
- Worktree C:/Users/zFlei/repos/lux/.worktrees/control-help-final; branch codex/control-help-final; starting commit 75cf3bf9950aa37f1eeff8cb071a57899df19de0.
- Accepted main 7c9a08cf5a7b78e025e4509495844022ba39a7eb merged as c82e149f311908648fc690eef64dc714d19fb066 without rewriting prior history.
- Final tested source commit a9e86e78f82d6af6edecaab7386410be695c67f4. Exact HEAD and a clean tracked diff were checked immediately before submission.

Acceptance evidence

- Optional description and empty-help behavior: packages/runtime-contracts/src/parameters.mjs validates optional description as text with a 512-code-point limit. tests/studio/interactions.test.tsx passes and verifies described hover/focus help, no focusable help trigger for an undescribed control, and no empty tooltip.
- Adjustment remains usable: the interaction test verifies MUI renders the help toward Preview, changes Source sampling radius to 2 while help is open, and observes the guarded runtime write. The former data-popper-placement assertion was invalid in jsdom because the zero-layout anchor prevents Popper from computing that runtime attribute; it now checks the rendered left-direction class and reaches the behavior assertion.
- Keyboard and readable text: the Inspector exposes only nonempty text as a noninteractive tooltip. Described labels are keyboard focusable with the existing focus-visible outline. The actual keyboard screenshot shows the outline and readable wrapped text.
- Reused component help: tests/studio/prismatic-composition-fixture.test.mjs passes and verifies exposed aliases retain source component descriptions. The combined Graph regression proves a selected node retains its inline description, exposes the same hover/keyboard help, writes only the selected node, preserves selected identity across panel closure, and keeps the stale-node guard.
- Actual Prismatic demonstration: evidence/lux98-private-demo/attempt-test-22bb23e6-c003-4944-8988-018b4455bf1f.json records exact source a9e86e78f82d6af6edecaab7386410be695c67f4, private profile test-22bb23e6-c003-4944-8988-018b4455bf1f, exact checkout endpoint and PID 34072. The actual SDK 0.4 build retained three authored descriptions. hover-help.png places inherited Segments A help in Preview, clear of Inspector values and sliders. keyboard-help.png shows keyboard focus and the help. Segments A changed while help remained visible, reset to 6, and final controls remained ballIntensity 0.67, segmentsA 6, segmentsB 6 with paused playback. PID 34072 was confirmed absent after cleanup.

Preserved history and failures

- The earlier successful source-75cf screenshots/result are preserved with commit-suffixed names. All ten original result/screenshot/attempt files copied from the prior worktree matched SHA-256 before the new run.
- Prior initialization, tooltip lookup and screenshot attempts remain in evidence/lux98-private-demo/attempt-test-*.json and checkpoint.txt; none is rewritten as success.
- The first combined-candidate private run, test-f0974c3d-c78b-41ca-9839-30153fb27eaa, stopped before build because the harness compared equivalent Windows checkout paths case-sensitively. PID 36696 was confirmed absent. The receipt remains and Conductor problem LUX-P100 records the correction.
- Two mistyped session-ID ACK attempts and the first quoted safe.directory mismatch are retained in LUX-P82 append events. No alternate claim or global Git trust was created.
