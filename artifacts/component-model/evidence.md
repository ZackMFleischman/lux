# LUX-150 source evidence

Candidate: df472683234847f426f594ccdd414889c2783c61
Application source: ccf7f8108500e36e0c2772f96d79f1470a586562 (later commits change only the native runner).
Base: dc5b1735b3a95d077e37f9684d8230e977c69f4d
Executor: component_model_recovery, Conductor agent 81e28d85-a132-400b-9857-f1f03223a3d0.
Location: C:/Users/zFlei/repos/lux/.worktrees/component-model, codex/component-model.
Model: Astra/high for compatibility, saved identity and runtime admission risk.
Scope: SDK 0.4 code/graph components and runnable visual graph reuse the existing image-chain implementation. A view-only direct occurrence gives legacy scenes the same Graph/Inspector editing. No scene, LFO, transport, audio or native export formats change.

Checks executed in this checkout before candidate commit (same source contents):
- node --test tests/compiler/component-model.test.mjs tests/compiler/composition-declarations.test.mjs: 15 pass. Includes real pinned compiler/linker, new examples, invalid control types, author-role matrix, and exact pre-change canonical profile digests. Log: compiler-tests.log.
- node --test tests/runtime/component-image-chain.test.ts tests/runtime/composition-controls.test.ts tests/studio/visual-model.test.ts tests/studio/scene-control-animation.test.mjs tests/studio/composition-worker-state.test.mjs: 19 pass. Log: runtime-tests.log.
- node --test tests/studio/visual-model.test.ts tests/core/scene-animation.test.ts tests/core/scene-composition.test.ts tests/core/component-library.test.ts: 29 pass. Log: persistence-tests.log.
- Focused esbuild bundle of tests/studio/interactions.test.tsx, then node --test artifacts/component-model/interactions.test.mjs: 21 pass. Logs: tsx-build.log, interactions-regression.log. Existing fullscreen test emits an act warning; no failing assertion.
- node ../../node_modules/typescript/bin/tsc --noEmit and -p apps/studio/tsconfig.json --noEmit: pass. Logs: typecheck.log, studio-typecheck.log.
- git diff --cached --check: pass.

Baseline correction: two composition-controls fixtures manually changed only part of a sealed profile and already failed at dc5b1735. baseline-extractor.mjs contains that commit's extractor with import locations adjusted; baseline-controls.test.ts is the prior test with imports adjusted. baseline-controls.log records the same two failures. The tests now edit real source and re-extract it to test reorder, compatible definition edits and narrowed control schemas. Runtime/profile admission was not relaxed.

Independent source review passed at ccf7f8108500e36e0c2772f96d79f1470a586562. The follow-up aligns the required skill reference and resets direct-only [] selection to Scene when a graph replaces a direct visual. Red/green evidence: selection-red.log and selection-green.log; Studio typecheck passed after the fix.

Full Studio build passed: studio-build.log. The isolated native run native-1789542533949 tested application source ccf7f810 with runner b7af4f6c081eba04eb75539337b30737840999fa. Its result.json records the complete legacy-direct Graph/Inspector base edit, LFO identity, narrow layout, save/reopen with exact embedded source, and invalid-build retention of runtime and saved-file bytes. The same run passed direct-to-graph selection reset and nested graph drill-in/base edit, then exposed an existing slider thumb mouse hitbox overlapping Animate. That run is partial, not an overall pass. Main process 15856 exited; its unique test profile protected user sessions.

The coordinator confirmed the mouse hitbox defect predates this candidate and owns its separate fix. Graph proof uses focus and a real Enter key, without forced clicks, and records this limitation.

Native graph evidence (same application contents as ccf7f810; later commits only modify scripts/test-component-model.mjs):
- native-1789543571998/result.json at cf81164a4351216f4e6d9e3c2e07bb4f4b5a07ec records complete legacy-graph editing, LFO, nested navigation, narrow layout, exact embedded-source save/reopen, invalid-build retention and saved-file integrity. This run is partial overall: the next case's resolution guard failed because reopen restored 1920x1080. Process 29692 exited. Routine graph work used supported 640x360 preview.
- native-1789543716942/result.json at df472683234847f426f594ccdd414889c2783c61 is PASS for the full new component-graph scenario. It verifies the same operations, no page errors, and owned process exit. The harness uses supported slider Home to restore 640x360 after builds and reopen; no production defaults or runtime APIs change. Initial startup and reopen briefly use 1920x1080. This test does not claim resolution persistence.
- Commands: node scripts/test-component-model.mjs; node scripts/test-component-model.mjs --graphs-only; node scripts/test-component-model.mjs --modern-only. Every launch uses studioTestEnvironment() and a matching createStudioConnection session; only the owned app exits. The coordinator reserved the GPU lane and received explicit release after cleanup.
- Screenshots: each native directory contains controls/narrow/failed-build PNGs for its completed case; graph runs also contain inside PNGs. Sizes 1360x900 and 820x720. These are actual native application captures. At narrow width, the existing breadcrumb truncates and controls wrap while the graph remains fit and selectable.

Independent final screenshot/interaction evidence review is requested from review_component_source. Source review already passed.

Coordinator owns integration and shared skill install/check. LUX-7/LUX-59 remain policy stopped.
