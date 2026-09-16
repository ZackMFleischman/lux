# LUX-173 independent review — expressive motion

## Verdict

Cleared for guarded Library publication, commit, submission, and serialized main integration. I found no functional, artistic, ABI, graph, resource-lifetime, control, or continuity blocker in the reviewed eleven-node milestone.

Independent ticket acceptance remains pending the exact submitted commit and the delivery coordinator's main-landing receipt.

## Code and contract review

- The existing `lux/ornament-regions/v1`, `lux/ornament-watercolor/v1`, `lux/ornament-phrasing/v1`, and motif field agreements remain unchanged. The composition retains eleven nodes and stable node and edge identities.
- `loAttachedLocal` supplies the same owner-attached deformation to shape distance evaluation and the returned motif coordinates. Primary owners use identity `101 + anchor`; nested islands use the matching parent identity, so shape, marks, pigment, and release share one phrase basis.
- Regions lead at the current artistic time; line pressure follows at 3 seconds, watercolor at 5 seconds, and mark release at 8 seconds. The accumulated phrasing clock and reset behavior remain owned by Composition Phrasing.
- Tension now scales both geometric motion/growth and line pressure. Phrasing governs color migration and mark release. Composition affects selected quiet regions. Pattern travel and growth have separate controls. Each exposed control therefore has a visible path in the renderer.
- Motif density and integer motif counts remain fixed during animation. Motion changes attached coordinates, line width, and reveal envelopes, avoiding count-driven popping.
- Watercolor keeps stable identity-based ivory, yellow, blush, teal, violet, and dark families. Its attached warm bloom changes local emphasis without reseeding or swapping families.
- The publication script resolves all eleven existing Library IDs from the LUX-172 receipt, verifies the exact live source before mutation, updates only changed leaves with expected revisions, re-reads new and historical revisions, preserves controls through the reference-only build, and saves a unique persistent scene.

## Artistic and interaction review

The 0, 20, and 40-second captures show a clear but slow evolution: owner shapes drift and flex, motif line pressure changes, attached marks travel or reveal, and pigment blooms move locally. Nested islands and marks remain fitted to their owners throughout. Stable warm yellow, blush, teal, violet, ivory, and dark anchors preserve a readable hierarchy while the right side retains useful quiet ground.

Seeds 7, 19, and 43 vary placement, overlap, internal texture, and band crossings while preserving the same visual identity. The enlarged-region capture remains coherent and exposes no detached marks or contour seams. The controls are grouped and named in source; the active MCP capture surface provides the canvas rather than the full Studio window, so this review did not add a fresh full-window inspector screenshot.

## Runtime evidence

Evidence: `artifacts/living-ornament/milestone173-qa-2026-09-16T11-35-04-890Z-c4b4915b/result.json` and its PNG captures.

- Healthy eleven-node playback completed 1,253 frames in 20.678 seconds: 60.595 completed-frame FPS. Sampled worker rates were about 57.68–59.95 Hz; sampled GPU pass time was about 5.90–5.96 ms. GPU timing excludes copies, uploads, and clears.
- The 20- and 40-second checkpoints differ materially from reset (`5,562,108` and `5,476,816` changed RGBA channels), demonstrating actual evolution rather than a static preview.
- The unique saved scene reopened with the original source, eleven nodes, and all controls. Reset pixels matched exactly.
- An invalid build retained the accepted revision, controls, rendered pixels, and saved-scene bytes. Pixel comparison was exact.
- Normal playback was restored with `fault: null`.

## Remaining delivery gate

Publish and read back the three changed Library leaves (regions, watercolor, and renderer), retain the eight unchanged revisions, commit the reviewed source, and obtain the serialized main-landing receipt. Independent acceptance must match that submitted commit exactly.
