# LUX-171 independent review — Living Ornament foundation

## Verdict

Cleared to continue into the integrated pattern milestone. No source, artistic-foundation, compatibility, or performance blocker remains in the reviewed LUX-171 snapshot.

Per the user's direction to iterate quickly and QA only at the milestone boundary, the interrupted Library publication is **not** a completion claim for this slice. Four existing providers reached revision 2; the new renderer publication stopped during fetch. Publication recovery, linked save/reopen, invalid-edit preservation, and selected-node checks are deferred to the milestone-end integrated QA.

## Technical review

- The four existing providers keep their legacy `field` output and add exact, separately branded ornament outputs. The old painting renderer and composition remain unchanged.
- The new renderer validates exact ABI, fragment, and value keys for regions, watercolor, boundary ink, and phrasing; captures stable shader source per component instance; updates uniforms each frame; and renders in one paint pass.
- The five-node composition wires only ornament outputs to the renderer. Its 20 scene controls are organized and affect this visual. The previously exposed inert `composition` scene control was removed.
- `LoRegion.local` and `tangent` now share the documented attached local frame. Band derivatives are rotated into that frame, so later motifs can remain attached during motion.
- Hierarchy changes broad, medium, and small tiers around a default-preserving center. Child clipping uses the corresponding parent tier size. Nesting scales child radii and uses an explicit zero-presence gate.
- Existing field contracts stay byte/value compatible. The dual-output implementation returns every declared output on each evaluation.
- Source bundle and publisher review found no unsafe overwrite or history assumption: known entries use expected revisions, exact source readback is required, prior revisions are checked, and partial reruns skip already identical heads.

Focused evidence reported for the final source: examples TypeScript passed, 9/9 ornament geometry tests passed, actual five-node compile/link passed with 20 scene controls, and diff check passed.

## Artistic and UI review

The reviewed 18-second captures for seeds 7, 19, and 43, plus the enlarged detail, establish a usable foundation for the next pattern batch:

- multiple concave lobe families, deep bays, nested islands, curved corridors, and broad/medium/small hierarchy;
- quiet ivory ground with yellow anchors and pink, teal, violet, and near-black support;
- coherent bold boundaries with watercolor texture;
- clear negative space and calm stretches where later motifs can breathe.

The result is still deliberately sparse and shape-led. Motif packing, internal line vocabulary, and richer quiet/intricate contrast belong to LUX-172 and later batches.

The Studio view shows the complete five-node graph plus Scene, readable routing, organized controls, `Build ready`, and zero diagnostics. Motion between the 18- and 42-second captures is restrained but measurable: mean RGBA channel difference is 4.22–5.09 across the three seeds. This preserves the visual's identity while avoiding restless drift.

## Preservation and performance evidence

- Legacy Living Painting at 18 seconds: exact 1920×1080 RGBA match, zero changed channels (`legacy-18-comparison.json`).
- Legacy Living Painting at 42 seconds: exact 1920×1080 RGBA match, zero changed channels (`legacy-42-comparison.json`).
- Final-source normal-motion profile: 59.83 observed FPS, 59.73 worker FPS, 58.10 minimum interval FPS, maximum interval GPU p95 4.13 ms, 1,201 frames, no fault, clean process exit.
- The final 18-second, 42-second, and performance artifacts all embed hashes matching the reviewed source, including `ornament-regions.ts` SHA-256 `d22492e60831a7ca54d973881c1c19a0bcd07b2718d0264db8385ed1733118e6`.

## Deferred milestone-end checks

- Recover and complete canonical Library publication for all five independent entries.
- Verify exact resolved sources and revisions, linked render, unique save/reopen, invalid-edit preservation, and selected-node controls in the final integrated visual.
- Selecting the dual-output Phrasing leaf still shows legacy `composition`. It remains meaningful for that leaf's old painting output but does not affect this ornament graph. LUX-173 should give it a visible ornament role or clarify that distinction in the leaf UI.
