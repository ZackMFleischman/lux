# Pigment Rivers — reference analysis and blind source draft

User request: analyze the second painting reference and build corresponding
components, continuing the source-only worktree workflow. No compilation,
execution, preview, or tests until a later agent is authorized to perform them.

## Reference analysis, ranked by payoff for effort

| Priority | Piece | Reuse and smallest useful addition |
| --- | --- | --- |
| 1 | Broad flowing pink, green, yellow and cyan pigment bands | New folded scalar field for elongated bands. Organic Regions favors compact lobes, so keep it intact and use its LoRegion consumer convention. |
| 2 | Uneven dark ink seams | Reuse Organic Boundary Ink's ornament output against the new field's estimated edge distance. |
| 3 | Dragged dry-brush marks and paper tooth | New reusable image-input Dry Brush & Paper overlay. Use stationary fibers and a small directional sampling offset to suggest underpaint showing through. |
| 4 | Pale translucent pools and pooled edges | Reuse Animated Watercolor's ornament field for wash variation, blended with a dedicated acid-green/hot-pink palette. |
| 5 | Nested blue/green contour scribbles | Reuse Nested Contours in selected quiet regions, with the same LoRegion local frame. |
| 6 | Splattered edges / studio-paper margin | Add optional seeded flecks and a rough paper margin to the surface overlay. This references the photographed artwork without requiring its photograph as a texture. |

Motion should slowly fold and stretch the pigment masses while the paper stays
still. Avoid rainbow cycling, glossy shading, or fast global wobble. Dark seams
and negative space matter as much as the vivid palette. This is a procedural
interpretation, not a reconstruction of the exact brush strokes or a fluid simulation.

## Implementation plan

1. Add Folded Pigment Bands as a shader-field provider: analytic large folds,
   edge distances, tangent/local frames, shape controls and stable identities.
2. Add a compatible Pigment River renderer using the existing phrasing, wash,
   boundary and contour providers through source imports; leave their source unchanged.
3. Add a separate Dry Brush & Paper image effect with grain, scumble, bristles,
   optional margin and flecks. Wire a runnable SDK 0.4 composition.
4. Write CPU contract tests and a complete source-bundle recipe for the next agent.

Acceptance for this task is source authoring and handoff only. Independent code
review, successful compilation, actual UI evidence, performance, control checks,
save/reopen and invalid-edit preservation remain deferred and unverified.

## Testing handoff

Ticket: LUX-192. Branch: `codex/fiber-optic-heart`.
Worktree: `C:/Users/zFlei/repos/lux/.worktrees/fiber-optic-heart`.
Entry: `pigment-rivers/composition.ts` in the prepared SDK 0.4 bundle.
The source imports four existing providers without modifying or publishing them:
Composition Phrasing, Animated Watercolor, Organic Boundary Ink and Nested Contours.
The new renderer adapts the folded field to their LoRegion helper convention.
Organic Regions itself is a design reference, not an imported node.

The graph has seven leaves and two image passes. New components are Folded
Pigment Bands, Pigment River Paint and Dry Brush & Paper. Shared providers retain
their controls; the composition exposes useful controls only. Some controls on
the existing providers relate to their other outputs and are not used by this scene.

**No source compilation, tests, Studio execution, captures, performance checks,
save/reopen or Library validation have been performed.** This is a blind draft.

When testing is authorized:

1. Read AGENTS.md, current Conductor state and this handoff. Reconcile LUX-192.
2. Prepare dependencies in this worktree, without changing a running user app.
   Run `pnpm exec tsc -p examples/components/pigment-rivers/tsconfig.check.json`.
3. Run `node --test examples/components/pigment-rivers/field-contract.test.ts`.
   This checks ABI mismatch rejection only, not WGSL validity or appearance.
4. Run `node scripts/prepare-reference-visual-bundle.mjs pigment-rivers artifacts/pigment-rivers-source.json`.
   The new script is also untested. It refuses to overwrite an existing file.
   Verify all eleven source files are present. It produces a source envelope,
   not a saved scene, and does not execute the visual.
5. Reserve GPU time. Use an isolated `studioTestEnvironment()` profile and its
   matching adapter. Preserve the user's Studio session and files. Build with
   the current draft-version guard, inspect diagnostics, and correct issues.
6. Inspect actual frames at 640×360 first, then 1920×1080 and a portrait ratio
   close to the reference (about 0.76). Record source commit, settings and frames.
   Look for coherent broad pink/green bands, lemon pools, blue details, irregular
   dark seams and restrained contours. Avoid stripe uniformity and muddy colors.
7. Capture separated times: folds and washes should move slowly, paper should
   stay fixed. Check minimum/maximum folding and density for gradient singularities,
   contour aliasing and excessive line density. Inspect paper grain at each size.
8. Exercise all exposed controls, pause/edit/resume/reset, zero pace, zero
   contours, zero margin and zero surface effects. Check input orientation and
   alpha handling independently using a partially transparent input image.
9. Save/reopen outside disposable test artifacts; verify controls and animations.
   Attempt an invalid build and confirm last working preview and files survive.
   Obtain independent source and actual screenshot review before publication.

Known tradeoffs: analytic bands approximate poured/dragged paint; no fluid
simulation or exact reproduction. Band-edge distance is a gradient estimate and
may thicken near extrema. Paper fibers have a preferred horizontal direction.
The optional border is a flat procedural margin, not a perspective photograph.
Provider clock/noise helpers are reused through source imports, not Library
links; pin dependencies explicitly if publishing reviewed reusable components later.
