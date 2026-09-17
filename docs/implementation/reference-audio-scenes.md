# Reference audio demo scenes

Two self-contained scenes are committed alongside the repository's saved scenes in `visuals/`.

- `Fiber Tracers and Glass Ribbons.lux-scene`: kick raises core brightness and traveling pulse strength; bass expands the core slightly; mids lift strand brightness; highs lift dust sparkle.
- `Pigment Bands and Ink Contours.lux-scene`: bass gently folds the bands; mids warm the pigment; overall level adds pooling; highs strengthen contours. Longer attack/release times preserve the painted flow.

Mappings use portable `primary-audio`, with no physical device identifier. Connect the desired audio input in Lux. Original base values and ordinary animation remain available without audio. Geometry counts, seeds and time multipliers are deliberately stable.

## Reproduction and evidence

Source baseline: `a8b382185de5e1caa691e2fae537a68e08bd3a4d`, branch `codex/fiber-optic-heart`.

Run `node scripts/save-reference-audio-demos.mjs <saved-fiber-scene> <saved-pigment-scene> <destination>`.
The script refuses overwrite, retains source/schema identities, uses SceneFileStore verification and atomic saving, and verifies the reopened document. Synthetic analyzer snapshots exercise all nine bindings through Studio's actual control evaluator, checking response, bounds and return to base after disconnect. These are not live audio-device tests.

Run `node scripts/render-reference-previews.mjs <demo.lux-scene> <label>` for isolated background Studio verification. Both saved demos opened, rendered two actual 1920x1080 frames, and saved again. All bindings remained enabled and identical with no binding issues or runtime fault.

Raw evidence under this worktree:
- `artifacts/background/fiber-audio-1789622686178/`: report, status, frames, saved scene.
- `artifacts/background/pigment-audio-1789622688589/`: report, status, frames, saved scene.

The runs used separate test profiles and did not touch the user's active Studio. No live microphone, loopback or music input was tested. Independent review and branch integration remain separate from this scene delivery.
