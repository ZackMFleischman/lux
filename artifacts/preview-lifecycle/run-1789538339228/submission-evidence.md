Executor: Conductor agent 4599101b-18fe-42ef-a83d-1f141c6de844, session 853b30d0-b290-4f1f-af39-2e4d9e38b02c, claim 59b084a1-6ea0-4e70-aeb7-38062fbf99a1.
Checkout: C:/Users/zFlei/repos/lux/.worktrees/preview-lifecycle, branch codex/preview-lifecycle, commit c7660fd06eb40230436463a53b727960378dfdf0.

Criterion: normal startup and later explicit Pause.
Setup/preconditions: actual Electron 44.3.0 app, unique profile test-ac6a6368-647c-46fc-a564-9074fa40b9ab, isolated workspace checkout, serial GPU lane granted by the coordinator.
Execution/result: `node scripts/test-studio-preview-lifecycle.mjs` launched the app without clicking Build. It observed a working canvas and playback=playing. During a delayed replacement, it issued Pause and observed playback=paused on the old generation and the promoted generation.
Raw evidence: result.json and startup-playing.png / promoted-paused.png in this directory.

Criterion: current preview and edits survive background compilation/initialization; promotion carries latest compatible state and rejects stale or forged state.
Setup/preconditions: SDK 0.2 noise-sphere in the same native run; delayed async candidate create; current preview had one flat scene animation; source/editor and Inspector visible.
Execution/result: the native run marked the old canvas, began the replacement, verified that canvas stayed mounted and Animation amount remained enabled, applied spikeHeight=1.7 and animation amount=0.6, then paused. The replacement promoted at a higher generation with exactly those values and binding. `node --test tests/studio/runtime-flat-animation.test.ts` additionally covered pre-build and candidate-window requests, pending acknowledgements, forged animation acknowledgements, exact candidate reconciliation, acceptedDocument state, and stale-generation rejection. `node --test tests/studio/runtime-composition.test.ts` covered SDK 0.4 node reconciliation and accepted state.
Raw evidence: result.json, background-build-edits.png, promoted-paused.png; complete Studio CPU output reported 197/197 core Studio cases including 5/5 flat animation, 38/38 lifecycle, and composition integration.

Criterion: invalid replacement preserves working visual and edits; file protections remain distinct.
Execution/result: the same native app rejected invalid TypeScript and retained revision, generation, controls, animation binding, and paused state. The authoring-session regression proved runtimeControlsAvailable=true only for Build and false for save/open operations. The saved-scene lifecycle regression proved explicit saved controls win over prior-preview reconciliation.
Raw evidence: result.json and invalid-build-retained.png; `npm run test:studio:cpu` exit 0.

Review and verification:
- `npm run typecheck`: exit 0.
- `npm run test:studio:cpu`: exit 0; 197 core Studio, 20 renderer, 17 source editor, 8 library, 10 dock, 2 capture-menu, 27 worker, and 21 GPU-metrics CPU cases passed.
- `git diff --check`: clean before commit.
- Independent source reviewer /root/review_standard_library found the pre-existing pending-command gap; implementation and regression were corrected. Re-review of exact commit c7660fd06eb40230436463a53b727960378dfdf0 reported no source blocker and independently passed authoring-session 18/18, composition 1/1, flat animation 5/5, lifecycle 38/38.
- Native result: ok=true, errors=[], owned PID 26144 exited with code 0. The coordinator received the GPU release immediately after cleanup.

