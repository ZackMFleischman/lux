Commit: 0f6a6b7758226bbf18bd48498a09e4875d452d30

Native isolated Electron 44.3.0 run: `node scripts/test-studio-capture.mjs`

- `artifacts/studio-capture/result.json`: PASS, owned process exit 0.
- `artifacts/studio-capture/frame.png`: decoded 1920×1080 from a 455×288 docked Preview panel.
- `artifacts/studio-capture/clip.webm`: decoded 1920×1080, 650332 bytes, finite 2.912 s duration; playback advanced and seek 1.7472 → 1.747547 succeeded.
- `artifacts/studio-capture/recording.png`: actual recording menu/status UI.
- `artifacts/studio-capture/workspace.png`: actual workspace at tested narrow viewport.
- Close during a second recording exited 0 and left neither the chosen destination nor `.lux-video-*.tmp`.
- `first-run-*` and `second-run-*` retain failed native evidence and diagnosed fixes.
