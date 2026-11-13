# Studio persistent diagnostics evidence

User result: agents can read local startup/compiler/runtime diagnostic history after the desktop launcher loses console output. Implementation is in an isolated native worktree. Main owns installed app refresh and creative-session restart.

Source: codex/persistent-diagnostics, C:/Users/zFlei/.codex/worktrees/persistent-diagnostics/lux. Model: Sol medium, bounded logging/UI task; independent review uses separate context.

Desktop path after installation: %APPDATA%/Lux/Studio/profiles/desktop/logs/studio.jsonl; previous file studio.previous.jsonl. Each file <=256KiB, record <=8KiB, message <=4096 characters. MCP status/discover and desktop --status report exact paths and writable state.

Retained: timestamp/session/operation, command and duration, startup stage, process exit/signal, compiler code/logical source file/line/column, bounded sanitized diagnostic explanation. Excluded: request/source/assets and endpoint/audio identities; code frames, JSON payload lines, credentials, absolute paths, data URLs and long opaque text removed. Compiler stderr tail yields known native error names/codes only; arbitrary renderer console messages are metadata only. Text redaction is defense in depth for locally authorized diagnostics, not a general secret detector.

Validation from this worker: Studio build passes; Studio TypeScript check passes; seven focused diagnostics/MCP/desktop-discovery checks pass. Tests exercise real disk rotation, redaction with diagnostic explanation retained, failed persistence, and adapter discovery forwarding. Skill installed from source and --check reports current.

Broader baseline: Studio CPU harness timed out at its 60s stage limit and reported existing `connected view distinguishes actual zero measurement, stale coverage and host revision` failure. Full interaction run was54/55 with one new test URL path failure; corrected by bbf4c305, focused normal built test passes. No native app was launched for this work; no actual changed desktop toolbar or live logging acceptance claimed.

Raw logs retained beside worktree: artifacts-logs-tests.log, artifacts-logs-build.log, artifacts-logs-typecheck.log, artifacts-audio-tests.log, artifacts-audio-interactions.log, artifacts-audio-focused.log.
