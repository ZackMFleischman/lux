# LUX-183 evidence

Executor: worker `lux-audio-device-fix-01a09baf` in `C:\Users\zFlei\repos\lux\.worktrees\audio-device-fix`.

Tested source: `de0226d5973740f2703ebf54479529e0df950875` on `codex/audio-device-discovery`.

## Permission and discovery diagnosis

The read-only Electron 44 probe used a fresh hidden profile. It returned `CABLE Output (VB-Audio Virtual Cable)`, webcam, and Realtek audio inputs before capture. Electron emitted two trusted main-frame audio enumeration check shapes: its empty-origin legacy probe and its exact `file:///` document origin with the exact page URL. The old broker admitted only the first shape and had no discovery arm before Connect.

The follow-up exact CABLE capture probe opened and immediately stopped one track. It observed the exact audio-only media request plus Electron's origin-bearing post-request permission check. The old broker did not admit that post-request shape. This establishes the broker mismatch. It does not independently replay the user's original Default failure against the old build.

Raw probe: `artifacts/audio-device-enumeration-result.json`.

## Automated validation

- `node --test tests/studio/audio-permission-broker.test.ts tests/studio/audio-runtime.test.ts tests/studio/audio-contract.test.mjs tests/studio/audio-provider.test.mjs`: 24 passed, 0 failed.
- `node --test --test-isolation=none --test-name-pattern='audio configuration changes|failed default connection|missing saved audio input|audio device change' apps/studio/dist/interactions.test.mjs`: 4 passed, 0 failed.
- `node node_modules/typescript/bin/tsc --noEmit`: exit 0.
- `node node_modules/typescript/bin/tsc -p tsconfig.examples-v2.json --noEmit`: exit 0.
- `git diff --check`: exit 0 before commit.

The regressions cover pre-connect listing, Default failure followed by exact CABLE retry, missing saved-device refusal, devicechange cleanup, discovery-arm cleanup, exact Electron permission shapes, and device refresh during pending and active capture.

## Native UI and device validation

Command: `node scripts/test-studio-audio.mjs`.

Setup: isolated profile `test-82ba366c-147e-4f8c-b9a5-97b448271a76`; owned Electron PID 23304; checkout source `de0226d5973740f2703ebf54479529e0df950875`; 640x360 preview; Windows host; existing user Studio PID 29824 left running.

Actual result: exit 0 with no page errors. The dropdown listed CABLE Output before any capture. Exact CABLE Output connected first. Default input then connected on the corrected broker. The script disconnected each capture, connected the webcam for existing analyzer checks, saved and reopened the scene, preserved the accepted preview after an invalid edit, and exited only its owned process.

Raw result: `artifacts/studio-audio/run-1789604728126/result.json`.

Screenshots:
- `artifacts/studio-audio/run-1789604728126/available-inputs-before-connect.png`
- `artifacts/studio-audio/run-1789604728126/cable-output-connected.png`
- `artifacts/studio-audio/run-1789604728126/connected-two-control-audio.png`

No audio was recorded or transmitted. No OS endpoint or SonoBus configuration changed.
