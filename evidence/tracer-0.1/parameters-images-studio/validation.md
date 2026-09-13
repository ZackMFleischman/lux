# Integrated Studio properties and images

12 September 2026. Tested integration checkpoint `0a0b0d1` plus the committed performance assertion in `scripts/test-studio-parameters.mjs`. No Resolume acceptance claim.

## Observed in actual Electron/WebGPU

- Five independently declared properties, no built-in Intensity, 46 CSS-pixel property rows. Numeric UI and MCP edits change captured geometry; untouched controls retain their values. Invalid, unknown and stale changes are rejected atomically.
- Scene-v3 save/open and cached restart preserve all values. Failed code preserves the last good visual. Empty schemas and legacy scenes work.
- Pending numeric text protects close. In-app Open/Close confirmations support cancellation and explicit discard without a native confirmation dialog.
- PNG captures return straight sRGB RGBA: half-alpha red `[255,0,0,128]`, opaque green, zero-alpha black and quarter-alpha white. Browser composition over black/white and linear scene composition pass separate comparisons. Progressive JPEG EXIF orientation and colors pass bounded pixel comparisons.
- Import/replace/remove preserves the last applied image until Build. A failed build after removing a required image retains the exact previous runtime. Original PNG/JPEG bytes survive save/open and restart.
- Playing the sphere publishes live CPU and timestamp-query GPU measurements through MCP and the collapsed monitor. No dropped/invalid records in the observed interval. GPU pass coverage correctly reports incomplete because copies/uploads/clears outside passes are excluded. This short functional check is not a workload or budget pass.

## Reproduction and artifacts

Run `node apps/studio/build.mjs`, then each separately:

- `node scripts/test-studio-parameters.mjs`
- `node scripts/test-studio-common-images.mjs`

Both passed without page errors. Reports and screenshots are local generated artifacts under `.worktrees/parameter-integration/artifacts/studio-parameters/` and `artifacts/studio-common-images/`; the harness recreates them. Studio CPU/DOM/worker/performance runner and Studio typecheck passed; export/install/registry suite passed 40 tests. Native build passed before the subsequent telemetry review fixes, whose rebuilt check is recorded separately.

Still required: installed image/control playback, host alpha composition, complete performance/overhead measurements, and physical failure/recovery acceptance. The implementation must not turn missing or unverified evidence into a pass.

## Stable-checkout follow-up

`60297e1` removes an extra full-frame delay after drawing. Real stable Studio then reproduced React maximum-update-depth errors twice: per-frame synchronous external-store notifications overwhelmed pending UI work. `2f4a511` caches and coalesces frame/metric observations at the React boundary (100 ms), preserving immediate control/playback/owner/fault/job updates and unchanged raw agent/capture state.

Stable `b0a844f` passed the complete parameter harness with zero page errors, including 24 monitor toggles over sustained playing output. The final short interval observed 58.3 worker fps with zero lost/invalid records; this is functional evidence, not a 60 Hz host acceptance run. All five property rows remained 46 CSS pixels. Three coalescing/urgency/lifecycle unit tests and Studio typecheck passed. The original integrated run and the final stable run use separate artifact directories; latest stable output is `.worktrees/tracer/artifacts/studio-parameters/result.json`.

The [installed native image check](installed-image.md) additionally verifies the packaged PNG output and supervised cleanup. Actual Resolume and full performance/recovery gates remain open.
