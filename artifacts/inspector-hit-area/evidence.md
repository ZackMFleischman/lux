# LUX-166 Inspector pointer evidence

Candidate: 47ccc6a3e6accaf6b76ca3fe39713d3853b925de.
Base/application source: 75178a50569d7b923ff6ed3073ac6bdb77b97adc.
Worktree: C:/Users/zFlei/repos/lux/.worktrees/inspector-hit-area, codex/inspector-hit-area.
Executor: component_model_recovery, agent 81e28d85-a132-400b-9857-f1f03223a3d0; session 7f99d798-1d83-47cf-8d6f-396ab93d13c4.
Model: Astra/high retained for recovery continuity; scope stayed one native regression script.

The production fix was already present in the assigned audio base. Commit 82cce9e857ed2f70c45e2ac3d9161f5ec1bb5862 added `position:relative;z-index:1` to `.parameter-heading` in apps/studio/src/studio.css. It puts the heading controls above the slider thumb's expanded hit area without reducing the slider hit target, changing values or adding row height. LUX-166 reuses this fix. All commits after the base change only scripts/test-inspector-hit-area.mjs.

Original native failure is preserved at C:/Users/zFlei/repos/lux/.worktrees/component-model/artifacts/component-model/native-1789542533949/result.json and failure.png. That receipt identifies the MUI thumb intercepting ordinary Animate clicks. The original fixture was a graph control; the positive regression uses the same shared ParameterRow with the direct noise sphere visual. This is not a pixel-identical before/after fixture comparison.

Final native PASS: native-1789548144151/result.json. Exact command: `node scripts/test-inspector-hit-area.mjs` at candidate47ccc6a3. Main PID8696 exited; exitCode0 and processExited:true. No page errors. Unique profile test-0d756d7e-0b21-4bd4-a4bf-ef60e3ade1e3 was created by studioTestEnvironment(); connection matched the profile, endpoint process and session. Only the owned app was closed. GPU lane was coordinated and explicitly released after cleanup.

Actual checks at 1360x900 and 820x720:
- For Animate, Reset and numeric entry, calculate the value that aligns the slider thumb beneath the action, wait for actual layout, assert horizontal distance under2px, and click within the visible lower edge of the control. Ordinary Playwright pointer clicks pass actionability checks; no force-click or DOM activation.
- Animate opens the correctly named dialog. Reset restores0.85. Pointer-selected numeric entry accepts1.2. Mouse drag moves the base to the expected track value. ArrowRight adds exactly one control step. Tab reaches Animate, Enter opens it, and Escape closes it.
- Supported Preview Scale Home sets640x360 after automatic startup; the final status confirms640x360. No production output defaults change. Audio remains disconnected.

Actual application screenshots: native-1789548144151/wide-animate.png, wide-controls.png, narrow-animate.png, narrow-controls.png. Narrow grouped controls retain the existing wrapping behavior; no layout CSS was changed for this work.

Validation: `node apps/studio/build.mjs` passed (build.log), `node --check scripts/test-inspector-hit-area.mjs` passed, `git diff --check` passed. No unrelated typecheck or full CPU suite was needed for a native test-only change.

Earlier runner attempts are retained in native-* directories. They failed only test setup (stale geometry during responsive reflow, or a rejected inline-style negative-control attempt). No CSP bypass was added; the final script uses unmodified candidate CSS and cites the original failure. Each attempt records processExited:true. The final native result is the acceptance evidence.

Fresh independent source/UI review and coordinator integration remain pending. No skill source, persistence, audio behavior or LUX-7/LUX-59 policy change.
