# Studio regression rerun

User authorized Studio tests again on 2026-09-12. Tested commit: 2a17b8e (includes playback label fix ec0dde9). CPU checks and two real standalone sessions ran sequentially; no Resolume/native transport test was run here.

- `node apps/studio/test-cpu.mjs`: 25 passed, zero failed; builds current Studio bundles.
- `node scripts/studio.mjs --smoke`: exit 0; fresh smoke.json confirms rendered capture, applied intensity/pause/reset, invalid source retention and save/reopen.
- `node scripts/test-studio-mcp.mjs`: exit 0; fresh mcp-loop.json confirms revision change, changed captured image bytes, stale draft rejection, five-second initialization rejection and previous runtime retention. Runner closed its own Studio session.
- `node node_modules/typescript/bin/tsc -p apps/studio/tsconfig.json --noEmit`: exit 0.

These suites do not manually inspect native fullscreen geometry or the one-frame label transition. User previously reported fullscreen and control layout looked good; final label behavior has a CPU regression, not a fresh visual QA claim. The designed CodeMirror/multi-file editor remains unimplemented.
