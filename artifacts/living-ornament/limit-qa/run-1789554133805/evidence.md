# LUX-170 evidence

## User result

`node scripts/test-large-painting-graph.mjs --approved-frame C:/Users/zFlei/repos/lux/.worktrees/tracer-components/artifacts/painting-extractions/tracer-before-18/frame.png`

Result: PASS at `cb086ec2c025f88fde86f67d09382954d0becc8f` in isolated profile `test-a60bd3e2-caea-4aa5-809c-630950c63669`. Owned PID 5428 exited with code 0. The persistent user creative preview was not touched.

- The original eight-node 1920×1080 painting matched the approved frame across all 8,294,400 channels (`changedChannels: 0`).
- The 17-node scene matched the eight-node painting at unity relay scale (`changedChannels: 0`).
- Graph Fit contained all 17 nodes and selected Hatching Relay 9.
- Relay 9 scale `1 → 0` changed 533,286 channels.
- Save/reopen retained 17 nodes, exact source, scale 0, and pixels (`changedChannels: 0`).
- An invalid edit retained the accepted revision, preview, node controls, pixels (`changedChannels: 0`), and saved-scene SHA-256 `1ea03055aff2e6377007d1c057070116d1f9f4bbb6910e48a6e893348bbbea95`.

Raw structured evidence: `result.json`. UI evidence: `seventeen-full-graph.png`, `relay-control-zero.png`, `seventeen-reopened-window.png`, and `invalid-edit-preserved.png`.

## CPU validation

- `npm run typecheck` — PASS for both TypeScript configurations.
- Focused compiler/core/runtime command — 87/87 PASS, including 600-component compile/admission/plan/save tests and retained safety bounds.
- All `tests/runtime/*.test.ts` — 176/176 PASS.
- All `tests/core/*.test.ts` — 60/60 PASS.
- Relevant Studio contract/runtime/roundtrip command — 16/16 PASS.
- `node --check scripts/test-large-painting-graph.mjs` and `--prepare-only` — PASS.
- `node apps/studio/build.mjs` — PASS after sandbox escalation allowed esbuild to read the existing shared dependency tree.

The broad 94-test compiler sweep produced 89 passes, four unrelated Windows/harness failures, and one cancellation: a pre-existing temp-fixture import omission, a missing-dependency diagnostic path leak, two PowerShell execution-policy failures, and a tooling-pack timeout. The focused changed compiler test passed 9/9 and is included in the 87-test clean command above.

## Retained bounds

Tests retain eight graph levels; 65,536 planning operations; 256 KiB canonical graph/body, 1 MiB aggregate metadata/bodies, 2 MiB raw data, 100,000 raw values, depth 16, 4 MiB publication plan; source, scene, compile/link, resource allocation, input, frame, and capture limits. Cycle detection, resource provenance, descriptor safety, byte accounting, and invalid-edit preview preservation remain exercised.
