# LUX-139 delivery evidence

Candidate and landed main: 416d4640f7db7dd01034f37102b33455eb760fe8. Worktree: C:/Users/zFlei/repos/lux/.worktrees/control-count. Parent baseline: ebf3a72ac71532799310cebabaae2c6f5fb9a470.

Studio no longer has a fixed control, exposure, value-batch, or animation-binding count ceiling. Schema/animation byte budgets and data validation remain. Native Resolume ring-v4 still has 32 transport slots; export now rejects unsupported counts explicitly without truncation. No native ABI change.

The native 64-control case exposed repeated full composition validation on every frame. Startup now admits an immutable profile once and each frame retains value validation. Independent reviewer measured two calls/frame falling from 30.84 ms to 4.34 ms. Mutation isolation, independent state, and invalid values have focused coverage.

Root ran focused control/compiler/schema/export tests, complete Studio CPU runner, root/examples TypeScript checks and actual private-profile native tests. Logs: worktree artifacts/control-count-tests.log, composition-count-tests.log, control-count-studio-cpu-final.log, native-build.log. Reviewer independently checked source and tests. Two existing composition-controls fixture tests fail identically on clean involved baseline files; reviewer verified baseline ebf3a72a directly. They are not newly introduced failures.

Native source run artifacts/control-count/run-1789529380403/result.json passed scene64, batch64, animation64 save/reopen and playing component64 exposure/animation with no renderer errors; owned PID26756 exited0. Actual screenshots scene-64-controls.png and component-64-controls.png received independent UI review. Later final run adds numeric component editing, effective-value change and component save/reopen assertions.

Only private studioTestEnvironment profiles are used. The user's existing desktop process remains untouched. Unrelated main live-copilot changes were preserved; before-patch SHA256 9465F2F763520B18C9647854F1664D5660D9CBE0A4835FB18FAEB9C3A1A2F9A8.

Final source native run: worktree artifacts/control-count/run-1789530130410/result.json. Exact416d4640, ok:true, errors:[], all three owned process exits0. Actual native numeric editing sets component control64 base to .7; effective node value changes; save and reopen in a fresh app restores base and binding. Scene64 batch edits and64 simultaneous animation roundtrip also pass. Independent reviewer inspected both final screenshots and approved source/UI. Main fast-forward integration retained the exact before/after unrelated patch hash. Installed author skill current:true.

Known unresolved limit, separately tracked as LUX-140 (7463e93a-68fb-4a94-9efa-d2a933e1a350): repeated runtime replacements in one process can hit the existing initialization watchdog. Instrumented run-1789530000240 showed five starts reaching device initialization in under650ms; the sixth failed before entering initialize. Instrumentation was removed and watchdog unchanged. Three fresh-process checks do not prove this repeated-replacement issue fixed.

Prior-build comparison: worktree artifacts/control-count/run-1789530270707/result.json launches the actual previous ebf3a72a desktop package and reproduces the SAME final component reopen watchdog. This diagnostic is adapted to32 controls because that build rejects64. Both saved many-controls.lux-scene and component.lux-scene contain exactly32 controls. The raw result's check labels inherited the64 wording from the copied harness; those labels are not a64-control claim. Exact executed diagnostic source is retained at worktree artifacts/diagnose-baseline-replacements.mjs. This establishes that the startup failure predates LUX139; it remains unresolved in both versions.

Final packaged native proof: C:/Users/zFlei/repos/lux/artifacts/control-count/run-1789530477379/result.json. Actual desktop build416d4640-c3b0ecd2, source416d4640, sourceDigest f98b93f9d7723a85325ea3275288b38d170c064ece86ce60bff950a94d7ca339. All64-control scenarios passed, errors:[], ownedPIDs27664/9348/20616 exited0. Actual package screenshots scene-64-controls.png and component-64-controls.png are in that directory. Installation receipt: C:/Users/zFlei/repos/lux/artifacts/feedback-01a0a7bb/control-limit-installation.json.

Supported activation refused because the previous desktop Lux is still running (control-limit-activation.txt). No user process was terminated; verified build is staged, not active.

Independent acceptance: LUX139 done revision4, event9dff5e3c-6d34-4962-9d11-005ae9173e47. Validator and implementation sessions stopped. Validation receipt: control-limit-validation.json.
