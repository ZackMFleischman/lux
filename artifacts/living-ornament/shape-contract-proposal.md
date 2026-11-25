# LUX-171 batch 1: Living Ornament shader-field contract

## Decision

Keep every currently published `v1` field and the Living Painting assembly unchanged. Add a second, explicitly named `ornament` shader-field output to the five existing producer leaves, then introduce one new Ornament renderer that consumes only those new fields. Do not revise a published ABI in place.

| Existing leaf | New output ABI | Batch-1 responsibility | Existing controls reused |
| --- | --- | --- | --- |
| Organic Regions | `lux/ornament-regions/v1` | Concave lobe/corridor signed-distance geometry, a stable branch ID, and nested-band coordinate | scale, warp, growth, seed, motion |
| Region Hatching / Styles | `lux/ornament-styles/v1` | Local line, contour, and band styling from the geometry coordinates | coverage, spacing, curvature, angle, hatchWidth, relation, spacingVar, curvatureVar, angleVar, widthVar |
| Animated Watercolor | `lux/ornament-watercolor/v1` | Wash and pigment response that follows the ornament coordinates | palette, warmth, contrast, pooling, blooms |
| Organic Boundary Ink | `lux/ornament-boundary-ink/v1` | One final boundary and paper finish using the shared signed distance | outline, inkWarmth, handDrawn, grain |
| Composition Phrasing | `lux/ornament-phrasing/v1` | Clock, phrase, hash/noise helpers, and composition response | pace, phrasing, composition, tension, hierarchy, time |

Each new output uses the same `ShaderFieldSnapshot` shape, has a fixed fragment-key set, and has its own exact-key check in the new renderer. The existing `field` output, its ABI, fragment bytes, value keys, and the old painting concatenation remain untouched. This is required because the old renderer checks ABI and exact keys and retains a single immutable assembled source for its lifetime.

## Geometry

`ornamentGeometry` should expose one source of truth inside the new ornament function:

```wgsl
// d < 0 is inside. branch is a stable 0..1 identity, u follows the
// nearest corridor, and nest is the signed radial coordinate for bands.
fn loGeometry(p: vec2f, seed: vec2f, t: f32, form: vec4f, music: vec4f)
  -> vec4f;
```

Build `d` from an authored skeleton rather than a repeated warped cell:

1. Use three to five fixed, seed-jittered lobe centers around a slow central spine.
2. Union elliptical lobe SDFs with 2--4 capsule SDF corridors that connect selected centers. A corridor is a segment or a short, bounded polyline; no iteration over a dynamic list is needed.
3. Subtract two or three offset ellipse/capsule bay SDFs with `max(d, -bay)` to create real concavity and deep bays. Place bays between lobe centers so they cannot turn the result back into a uniform cell pattern.
4. Derive `branch` and `u` from the nearest lobe/corridor before the union, with deterministic tie breaks. Derive `nest` from the selected lobe's elliptical radius plus a low-amplitude phrase/noise offset.

The geometry fragment must calculate `edgeAA = max(fwidth(d), smallEpsilon)` once. Styles, watercolor pooling, and boundary ink all read that same `d` and `edgeAA`; only Boundary Ink converts it to the outer cream line. Nested outlines come from bounded `abs(fract(nest * count) - 0.5)` bands in Styles, clipped to `d < 0`, rather than re-running a second shape test. This gives lobes, corridors, bays, nesting, and shared boundaries without Voronoi weights or a grid-like tiling.

## New renderer assembly

Add a small `living-ornament.ts` image component and `living-ornament-composition.ts`. Its six reachable nodes are the five existing producer leaves and this renderer; it does not need Tracer Paths or the Tracer Renderer for batch 1.

The renderer accepts five new `ornament` ports and assembles their fragments once in this fixed order:

1. ornament function prelude (`st`, phrase time, aspect, seed, packed vectors);
2. `regions.ornamentGeometry` inside the function;
3. `watercolor.ornamentWash` inside the function;
4. `styles.ornamentStyles` inside the function;
5. `boundary.ornamentFinish`, which closes the function;
6. `regions.ornamentHelpers`, `phrasing.ornamentPhrase`, and `phrasing.ornamentNoiseBasis` as global helpers.

The existing scalar packing can be retained for visible control continuity: `form=(scale,warp,motion,growth)`, `hatch=(coverage,spacing,curvature,angle)`, `pigment=(palette,warmth,contrast,pooling)`, `ink=(outline,hatchWidth,inkWarmth,grain)`, `character=(composition,handDrawn,blooms,0)`, and `music=(tension,phrasing,relation,hierarchy)`. The new renderer must reject an ABI/key change after its first assembly just as Living Painting does. It must not share fragment constants with, or alter, the old painting source.

## Output and runtime constraints

Adding a second output is compatible with the typed graph model and avoids changing the old graph's node count. The current Living Painting composition is already at the eight-node typed-composition limit; a parallel Ornament output on each existing producer adds no node there. The new Ornament composition uses six nodes.

There is no per-output pruning on a reached node. `planNestedGraph` prunes unreachable *nodes*, while `completeResourceNode` requires all declared outputs from a reached component. Therefore an existing producer with both `field` and `ornament` must return both snapshots each frame even when only `field` is wired in the old painting. Shader fields are immutable CPU snapshots and do not allocate a GPU image, so the cost is bounded fragment/value object creation. Keep each additional snapshot small and stable.

Do not add an ornament output directly to the current `painting.ts` Styles/Splits image component: it is a consumer, its source must remain exact for the saved painting, and it would make a new renderer depend on an image-producing node. Treat Region Hatching as the Styles producer for batch 1. If a separately named Styles leaf is required later, create `ornament-styles.ts` with the same `lux/ornament-styles/v1` contract and migrate only the new Ornament composition.

## Rejected paths

* Do not change `lux/organic-regions/v1` (or the other published `v1` ABIs) to carry ornament fragments or values. The old consumer enforces exact ABI and key sets and would reject it before rendering.
* Do not make Ornament geometry an image/mask pass. It would lose the one shared analytic boundary and add a sampling/quantization seam.
* Do not derive the ornament from `lpRegion` weighted cells with stronger warp. It preserves the regular cell topology and cannot produce controlled corridors and deep negative bays.
