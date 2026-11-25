The existing WebM has 113 frames across 84.639s, median frame gap 0.7325s and maximum 1.256s. Its container duration is 129.783s. A 30-FPS MP4 conversion merely duplicates sparse frames.

Instrument completed render, capture, encode and write boundaries. Identify where cadence is lost before selecting a fix. Explicit frame requests are a hypothesis, not a proven remedy. Stop duration measurement at capture end, excluding encoder shutdown and file finalization.

Acceptance:
- Document root cause and a short reproducible diagnostic.
- On a capable host, demonstrate a 30s/30FPS clip with approximately 900 advancing frames; report decoded timestamps, drops, repeats and maximum gaps. Target >=29 actual FPS and <=100ms gaps after startup; detect and report shortfalls.
- Compare visible, occluded and minimized operation, render FPS and recording overhead.
- Validate playback motion and duration, not only headers or a still.
- Checklist: independent review, focused regressions, commit and merge.

References: preview-recorder.ts, visual-worker.mjs, preview-capture-files.ts and webm-duration.ts under apps/studio/src.
