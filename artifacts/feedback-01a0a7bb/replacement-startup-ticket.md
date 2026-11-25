Keep Studio responsive when a user repeatedly builds or reopens visuals in one session. During 64-control QA, an unchanged candidate intermittently reported “Visual initialization stopped making progress” after several runtime replacements. Fresh app sessions built and reopened the same saved component successfully.

Investigate worker startup and resource cleanup under repeated replacements. Preserve the 1.25-second liveness watchdog and the last working preview. Do not attribute the defect to control count without comparison evidence.

Acceptance: reproduce with exact source/profile provenance; compare the prior build at its supported control count; fix the demonstrated cause; verify repeated build/reopen and invalid-edit preservation in the native app; independently review.

Evidence: C:/Users/zFlei/repos/lux/.worktrees/control-count/artifacts/control-count/run-1789530000240 (instrumented startup sequence; first five starts finish trusted admission quickly, sixth never logs initialize before timeout), run-1789529929059 (same saved64 component opens fresh), run-1789530130410 (three clean-session64 scenarios pass). Prior packaged build comparison is being recorded in the LUX139 handoff.
