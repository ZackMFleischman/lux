# LUX-172 reusable pattern milestone

Six independent pattern fields now feed the Ornament Region Styles renderer: Spiral Fill, Packed Circles & Rings, Membrane Divisions, Nested Contours, Region Hatching, and Decorated Ribbons. The scene has eleven executable nodes. Each family has its own density/width controls and leaf variation/motion controls. Legacy Region Hatching output is unchanged.

Actual installed desktop: build43119807-c5bad848, PID8600, session552d95c4d5fed7e01d911575b0d6a37fd86a. The one-time upgrade was needed for the removed node ceiling. Lux remains open for subsequent live MCP edits.

## Validation

One combined live milestone run: milestone172-qa-2026-09-16T11-15-55-536Z-5679f7bb/result.json. At reset time with matching controls, all8,294,400 pixel channels match the saved five-node prototype. Three seed captures and an enlarged detail are included. Save/reopen retained source, all node controls and exact reset pixels. An invalid edit retained the accepted preview and saved bytes. Normal playback produced1,275 frames in21.087seconds, approximately60.46FPS at1920x1080. This is a completed-frame estimate in the live desktop, not a hardware benchmark.

The first preview exposed stale membrane helper math; corrected to the current refined fans. The final image restores curved spokes, recognizable spirals/rings, pale decorated bands, bold irregular boundaries and deliberate quiet ground. Default extraction parity is exact. Membrane density now changes division count.

Two live builds hit the existing initialization watchdog while the old scene played; its preview remained healthy. Pausing before the same build succeeded. No app code or watchdog boundary was changed. The existing LUX-140 follow-up owns that runtime issue.

Independent review: lux-172-independent-review.md. Actual canvas screenshots are available; Studio chrome and graph layout were assessed from source, not a new full-window screenshot.

## Publication

milestone172-publication.json records individual Library IDs/revisions, preserved history, the linked eleven-node scene and its unique persistent saved path. Earlier prototype and original Living Painting scenes remain preserved. Next: LUX-173 coordinated local expression, then LUX-174 structural events.
