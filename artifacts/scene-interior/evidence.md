Base: 0e5758e2c4f460a830462d17749d2bb14fcc9abd. Intentional serial scope in main; unrelated dirty files preserved.
Plan: docs/superpowers/plans/2026-11-12-scene-interior.md
Logs: artifacts/scene-interior/{cpu-final.log,final-focused.log,shortcuts-final.log,typecheck-delivery.log,skill-check.json}.
Native final: artifacts/graph-navigation/run-1794540737335/result.json and screenshots. Unique test profile test-6519271a-12af-47f4-a1bb-e102afd385ab. Isolated output artifacts/scene-interior/dist. Test-owned Electron PID33184 terminated explicitly after successful result; creative desktop PID19520 untouched.
Review: artifacts/scene-interior/review.md. Model and reason retained there.
User correction receipt: artifacts/scene-interior/problem-receipt.json (LUX-P124).
Commands: node apps/studio/test-dock-cpu.mjs; focused same esbuild test runner with --test-name-pattern=Graph; node --test tests/studio/shortcuts.test.ts; node node_modules/typescript/bin/tsc -p apps/studio/tsconfig.json --noEmit; LUX_STUDIO_DIST=artifacts/scene-interior/dist node apps/studio/build.mjs; same env node scripts/test-studio-graph-navigation.mjs --composition; node scripts/install-visual-skill.mjs and --check.
Committed reviewed source: 01416dd9067fcbcdce5adbc48668a0c0fa0f36e8.
