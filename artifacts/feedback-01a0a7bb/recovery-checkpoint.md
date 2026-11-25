# Recovery checkpoint

After the user's OOM report, collaboration inventory showed only root. Host inspection found 51.64 GiB free of 63.83 GiB and no Lux/Electron test process or build. This does not establish the cause of the earlier OOM. Saved work was preserved; no user process was terminated.

- Main: `dc5b1735b3a95d077e37f9684d8230e977c69f4d`. Accepted LUX143 merged as `334e0123`; conflicts preserve Preview capture and runtimeControlsAvailable plus both source-editor assertions. Accepted LUX149 merged as `dc5b1735`. Combined validation with LUX147 remains pending. Visual skill install/check currently passes on this main.
- LUX147 recovery: agent `11da1de0-0512-47f7-8eae-0f7a1fd093ab`, session `51da477e-cffc-4afb-b912-431d04fb1d85`, claim `adc00d21-9021-4ca7-b6c1-9e3c7a740754`, in_progress revision 7/spec2. Worktree `.worktrees/studio-shortcuts`, starting HEAD `e55d4e80febca16bde4328f045b8d105d8406aad`; saved partial dialog/Restore changes retained. Worker `/root/shortcuts_recovery` owns serialized build/GPU lane.
- LUX150 recovery: agent `81e28d85-a132-400b-9857-f1f03223a3d0`, session `1c0dafe4-69fe-4307-bccf-390756a128c0`, claim `1abddbe2-daae-4637-892e-c9574e42ceb9`, in_progress revision3. Worktree `.worktrees/component-model`, base main above. Worker `/root/component_model_recovery` prepares compatibility design; `/root/review_component_design` independently critiques before code gate. No build/GPU lane yet.
- LUX151–154 remain assigned root, not dispatched. Existing LUX109 covers image-input/effect work. Root coordinator task `01a09baf-3806-7eb0-8bed-48b8b7f771cf` owns unrelated board cleanup and LAN portal; do not terminate its portal processes.

Keep one build/runtime test at a time during recovery. Root owns serial main integration, final skill installation, and packaging. Preserve unrelated live-copilot working-tree changes. Do not infer live workers or claims from this historical checkpoint: reconcile current state after another interruption.
