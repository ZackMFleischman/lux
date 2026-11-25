Let an agent request a clip with destination, duration, FPS and format in one MCP call. Lux owns the timer and returns a job ID, status/progress, cancellation and final output path. Reuse the existing recorder behind a small shared job contract; avoid dialogs, screenshot loops and agent-timed stop calls.

Acceptance:
- Record a 30-second clip without computer-use interaction; target 35–45 seconds total on a documented capable host, measured separately from capture quality.
- Validate format/capabilities and destination; refuse overwrite by default. Cancel/failure cleans temporary output and preserves existing files and the active scene.
- Guard session/scene revision; return actual duration, frame statistics and an explicit quality shortfall rather than false success.
- Reuse the encoder service for supported requested formats; avoid unnecessary transcoding.
- Update and install/check the shipped Lux visual skill.
- Checklist: demonstrate running-app behavior, independent review, relevant checks, commit and merge.

Can proceed alongside capture diagnosis after agreeing the job contract.
