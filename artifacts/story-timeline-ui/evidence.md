# Story timeline UI evidence

User result: Story's horizontal sequence remains visible in its shallow bottom dock. At 1440x960, the transport, all nine representative steps, selected details, local scrub and compact beat launch strip fit in the 264px dock. At laptop/narrow sizes the sequence scrolls horizontally; lower detail controls remain vertically scrollable.

Source: codex/story-timeline-ui, based on a51ad683868d6a73b9f3a57ec137f71bcfcfb0d5. Exact tested source and built renderer SHA-256 hashes are in final-exclusive/report.json.

Validation:
- `node apps/studio/build.mjs --tests`: pass (build-aligned.log).
- `node node_modules/typescript/bin/tsc -p apps/studio/tsconfig.json --noEmit`: pass.
- `node --test --test-name-pattern='Story|story|sequence timing' apps/studio/dist/interactions.test.mjs`: 11 passed.
- `node --test apps/studio/dist/interactions.test.mjs`: final consolidated log interactions-final.log.
- `node artifacts/story-timeline-ui/native.mjs final-exclusive`: pass. Isolated profile test-afc8cda7-6e0c-426b-84a9-fa40bd7851d1; own PID37048 exited and absence checked. Uses studioTestEnvironment and matching authenticated connection; actual preview640x360. Native Electron/Playwright pointer and keyboard events; no synthetic DOM dispatch or style overrides.
- Native checks: pointer selection preserves active occurrence; keyboard focus reveals final occurrence; Start here selects correct occurrence; local-time keyboard seek; replay; loop; manual sustained launch detaches and removes scrub; narrow panel contains horizontal overflow; return to normal.

Screenshots: final-exclusive/wide.png, laptop.png, narrow.png, selected-manual.png, sustained.png. Comparable pre-change captures: baseline/wide.png and baseline/laptop.png. Default preview is intentionally a simple generated color visual; scene content is disposable.

Limits: Earlier fixture builds intermittently hit the existing Story worker watchdog. Evidence retained in revised*/report.json, final-compact/report.json and final-aligned/report.json. LUX-P121 records this; final exclusive run succeeded without weakening watchdogs. No runtime fix is claimed. No user scene or installed desktop process was edited/restarted. Narrow docks require vertical scrolling for secondary controls.

Independent review: review.md. Terra medium was selected for the bounded React/CSS review with focused context and actual UI screenshots.


Delivered source and main integration commit: 985bda23c4f6b0f59be49f351081b9279e28313e. Main was fast-forwarded from a51ad683; source hashes match the final native capture exactly. Main build and11 focused integration tests passed (main-build.log, main-tests.log). Final combined branch interaction suite54 passed (interactions-final.log).
