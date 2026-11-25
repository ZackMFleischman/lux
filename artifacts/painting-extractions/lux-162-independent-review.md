# LUX-162 Boundary Ink extraction independent review

## Verdict

No blocking findings remain in the Organic Boundary Ink extraction against `5ac618b12ba6acafd13e9e00d56d81b55eee6932`.

## Source review

- `Organic Boundary Ink` publishes ABI `lux/boundary-ink/v1` with exactly one `finish` fragment and four live numeric values: outline, ink warmth, hand-drawn character, and grain.
- `Living Painting` requires the exact ABI and exact fragment/value key sets. It inserts `finish` after the watercolor block, where the original boundary, stationary grain, vignette, final color conversion, and function close occurred.
- The extracted fragment retains the original boundary pressure and width calculations, cream boundary color, paper fibers and grain, vignette, and final gamma conversion in the same order and coordinate basis. The cream declaration remains in the styles consumer before the fragment insertion point.
- The four moved control schemas retain their IDs, labels, defaults, ranges, steps, descriptions, public ordering, and scene aliases. Each alias now targets the stable Organic Boundary Ink node; the total public control count remains 38.
- Shared vector packing remains unchanged: `ink = (outline, hatchWidth, inkWarmth, grain)` and `character = (composition, handDrawn, blooms, 0)`. Boundary-owned hand-drawn character therefore still drives region and hatching behavior, and ink warmth still feeds hatching through the same components.
- The seven-component graph adds one direct Boundary-to-Painting field edge and no render pass. Existing path fan-out, region, hatching, watercolor, image, and final-renderer edges remain intact.

## Evidence reviewed

- Assembled shader: byte-identical 18,522-byte WGSL.
- `boundary-comparison-18.json`: exact 1920x1080 RGBA match, zero changed channels.
- `boundary-comparison-42.json`: exact 1920x1080 RGBA match, zero changed channels.
- `boundary-after-18/window.png`: readable eight-card graph including Scene, topological placement of Boundary before Painting, clear field wiring, preserved scene control hierarchy, and no diagnostics.
- `Reusable Boundary Ink-publication/result.json`: `ok: true`; exact Library readback/resolution, linked render, save/reopen, invalid-edit preview preservation, and selected-node control inspection.
- `Reusable Boundary Ink-publication/component-controls.png`: saved scene, selected Organic Boundary Ink node, and all four controls visible with expected values and grouping.
- Organic Boundary Ink Library component `d5718a1e-de84-477c-8330-4633fd91df85`, revision 1.
- Reported checks: seven-node/38-control compiler pass, standalone Library validation, example TypeScript check, and clean scoped `git diff --check`.
