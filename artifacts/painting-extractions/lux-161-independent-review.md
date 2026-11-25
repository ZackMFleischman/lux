# LUX-161 Watercolor extraction independent review

## Verdict

No blocking findings remain in the Animated Watercolor extraction against `d875c8a34770bd5cef515cbb7ed7ddffe68bf0aa`.

## Source review

- `Animated Watercolor` publishes ABI `lux/watercolor/v1` with exactly one `wash` fragment and five live numeric values: palette, warmth, contrast, pooling, and blooms.
- `Living Painting` requires the exact ABI and exact fragment/value key sets, inserts the wash immediately after region geometry, compiles the assembled shader once per instance, and rejects later source changes while accepting live value updates.
- The extracted fragment retains the original broad wash, cool/warm pools, region tint, cloud texture, blooms, and boundary pigment pooling in the same order and coordinate basis.
- The five moved control schemas retain their IDs, labels, defaults, ranges, steps, descriptions, public ordering, and scene aliases. Each alias now targets the stable Animated Watercolor node; the total public control count remains 38.
- Existing vector packing remains unchanged: palette, warmth, contrast, and pooling occupy the pigment vector; blooms remains the watercolor character value.
- Tracer-created daughter pigment and gradual style transitions remain in the Living Painting/styles consumer. Visible ribbon pigment and bleed remain in the independent Wandering Tracer Renderer.
- The six-component graph adds one direct Watercolor-to-Painting field edge and no render pass. Existing region, hatching, path fan-out, image, and final-renderer edges remain intact.

## Evidence reviewed

- Assembled shader: byte-identical 18,522-byte WGSL.
- `watercolor-comparison-18.json`: exact 1920x1080 RGBA match, zero changed channels.
- `watercolor-comparison-42.json`: exact 1920x1080 RGBA match, zero changed channels.
- `watercolor-after-18/window.png`: readable seven-card graph including Scene, clear field wiring, preserved scene control hierarchy, and no diagnostics.
- `Reusable Watercolor-publication/result.json`: `ok: true`; exact Library readback/resolution, linked render, save/reopen, invalid-edit preview preservation, and selected-node control inspection.
- `Reusable Watercolor-publication/component-controls.png`: saved scene, selected Animated Watercolor node, and all five controls visible with expected values and grouping.
- Animated Watercolor Library component `998130df-ca1f-4b58-9917-1ee7045275cb`, revision 1.
- Reported checks: six-node/38-control compiler pass, standalone Library validation, example TypeScript check, and clean scoped `git diff --check`.
