Make recording independent of presentation-canvas visibility by feeding completed rendered output to an encoder with explicit timestamps. Use capture-diagnosis evidence to choose the smallest reliable path. Reuse the MCP recording job contract and existing safe file finalization.

Acceptance:
- Select the encoder through measured capability checks; evaluate WebCodecs/hardware or worker/process encoding rather than assuming availability.
- Use bounded buffering, explicit backpressure, cancellation and error propagation. Report dropped frames and quality shortfalls; never mask them by duplication.
- Demonstrate smooth 30s/30FPS output while visible, occluded and minimized on the documented host.
- Measure decoded cadence, render FPS, CPU/GPU cost, memory and total delivery time; compare against baseline.
- Preserve scene state, interactive preview and existing output files.
- Update author-facing tooling documentation if its contract changes.
- Checklist: running-app demonstration, independent review, targeted regressions, commit and merge.

Depends on MCP recording and capture diagnosis; avoid a second parallel recording service.
