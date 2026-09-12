# Studio export backend CPU evidence

2026-09-12, `codex/studio-export-backend`, based on tracer `2b0dc52`. No Studio, Electron, GPU, installation or native host launch by this workstream.

The preload exposes only `window.luxExport.create({ name, document })`. Main checks the existing owned-window, exact local page and main-frame guards plus main-window identity. A native folder picker supplies the output path; a renderer cannot select a path through the request. Cancellation returns null.

`createExportService` clones the complete JSON document before the picker and excludes another export until picker/child completion. `runExportChild` uses the trusted `LUX_NODE_EXECUTABLE`, no shell, hidden child windows, JSON stdin capped at 8 MiB, stdout and stderr each capped at 64 KiB, and a three-minute deadline. It rejects malformed/out-of-directory results, child failures, output overflow and shutdown cancellation. Timeout/shutdown uses Windows process-tree termination, including compiler descendants. Packaging, hashing and large runtime copies run outside Electron main.

The child writes its own temporary `.lux-scene` through `SceneFileStore`, compiles/links into that same temporary directory, then calls `exportResolume` with the prepared artifact and saved control value. Ordinary success/failure removes that temporary directory. Source errors occur before copying runtime payloads. The shared CLI exporter now also prepares source and checks runtime capability markers before its expensive copy; runtime staging cleanup runs in `finally`. Existing package publication remains immutable. Abrupt process termination can leave an unpublished temporary/staging directory; no success or installed-playback claim is returned for that outcome.

Validation:

- Full Studio CPU suite: 41 base/backend tests plus 5 CodeMirror DOM tests passed.
- Added final real-invalid-source/staging-cleanup regression: all 3 export-worker tests passed.
- All 3 export-process tests passed with real small Node subprocesses for JSON success/error, malformed output, overflow, deadline and cancellation.
- Studio TypeScript check and `git diff --check` passed.

The native picker and export UI, responsiveness during the full roughly 387 MiB runtime package copy, packaged result installation and installed playback need the coordinator's bounded interactive acceptance. Backend tests use inert fixture processes and dependency-injected package ports; they do not claim a native packaged run.

Integration dependency: `packages/export/src/runtime-capability.cjs` comes from reviewer commit `9f43042`. The coordinator owns adding it to `requiredRuntimeFiles` and registration validation. This branch only adds the export import/check and helper-copy path. The existing render host/native payload must be rebuilt before a real export; stale marker checks intentionally reject previous probe payloads.
