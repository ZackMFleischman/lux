PASS: `node --test tests/studio/preview-capture-files.test.ts tests/studio/preview-recorder.test.ts tests/studio/webm-duration.test.ts` (16/16).

PASS: `node_modules/.bin/tsc.cmd -p apps/studio/tsconfig.json --noEmit`.

PASS: `node_modules/.bin/tsc.cmd -p tsconfig.json --noEmit`.

PASS: `node apps/studio/build.mjs`.

Studio CPU suite: `node apps/studio/test-cpu.mjs` passed 194/195; the unrelated existing control-description hover timing test failed once. Exact rerun passed: `node --test --test-isolation=none --test-name-pattern "control descriptions" apps/studio/dist/interactions.test.mjs` (1/1).

PASS: `node scripts/test-studio-capture.mjs` against exact commit with isolated `studioTestEnvironment()` profile and installed Electron 44.3.0.

Remaining integration QA: merge onto current main containing animation/control-group work; root-owned combined skill install/check and combined-source regression. No personal skill install was run from this stale-base worktree.
