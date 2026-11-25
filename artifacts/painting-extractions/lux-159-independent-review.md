# LUX-159 independent review

## Verdict

No blocking findings remain in the Region Hatching extraction against `7e2f4fd3`.

## Source review

- `Region Hatching` publishes ABI `lux/region-hatching/v1` with exactly one `lpRegionMarks` fragment, nine live control values, and the preserved fixed `widthVar: 0.81` value.
- `Living Painting` requires the exact ABI and exact fragment/value key sets, compiles the assembled shader once per component instance, and rejects later source changes while accepting live numeric updates.
- The extracted WGSL retains the original persistent line-family selection, unhatched coverage gate, contour branch, sparse perpendicular crosshatching, islands, pressure, and reveal behavior.
- The nine moved control schemas retain their prior IDs, labels, defaults, ranges, steps, descriptions, and scene-wide aliases. Each alias now targets the stable Region Hatching node; the other 29 public controls retain their previous owners.
- Vector packing into the existing `hatch`, `ink`, and `variety` inputs is unchanged. The total public control count remains 38.
- The five-node graph preserves the Scene root, tracer fan-out, region field, painting image, and final renderer. The new Hatching field has one direct edge to Living Painting and no extra render pass.
- The publication helper verifies readiness, exact Library source/revision resolution, save/reopen, invalid-edit fallback, and an unambiguous selected graph node with `aria-pressed=true` before capturing its controls.

## Evidence reviewed

- Assembled shader: 18,522 bytes with the reported unchanged SHA-256 `c507e3a0...d45325`.
- `hatching-comparison-18.json`: exact 1920x1080 RGBA match, zero changed channels.
- `hatching-comparison-42.json`: exact 1920x1080 RGBA match, zero changed channels.
- `hatching-after-18/window.png`: readable six-node graph, clear Hatching-to-Painting edge, preserved scene control ordering, and no diagnostics.
- `Reusable Hatching-publication/result.json`: `ok: true`; exact Library readback, linked render, save/reopen, invalid-edit preview preservation, and selected-node control inspection.
- `Reusable Hatching-publication/component-controls.png`: saved scene, selected Region Hatching node, and all nine component controls visible with the expected defaults and grouping.
- Region Hatching Library component `f564a771-028a-4031-abaa-e64a1cfc8bec`, revision 1.
- Reported checks: five-node/38-control compiler pass, TypeScript checks, and clean scoped `git diff --check`.
