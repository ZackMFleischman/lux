Validation at c574a354df7ec0bffb7745951814a42f73cdf650, review correction 42e5f6f131a435128958faa5caf8551d773ca65c, focused test correction 2646d5963ce3ea34b4336073b0a46cf7430961a5, and preview-side placement 75cf3bf9950aa37f1eeff8cb071a57899df19de0

1. pnpm exec vitest run tests/studio/interactions.test.tsx — pass, 19 tests.
2. node --test tests/studio/prismatic-composition-fixture.test.mjs — pass, 1 test.
3. node_modules/.bin/tsc --noEmit — pass.
4. Private Electron/WebGPU Prismatic demo — pass. Inspect hover-help.png, then keyboard-help.png. The help opens into preview space; keyboard focus visibly outlines the label. The receipt shows that segments A changed and reset while hover help was visible; final values, controls, and paused playback are unchanged.

Remaining QA and integration

- An independent agent must review the source and screenshots before acceptance.
- Root owns serial integration. After integration, root must install/check the shipped visual-creation skill from integrated main, not this candidate worktree.
