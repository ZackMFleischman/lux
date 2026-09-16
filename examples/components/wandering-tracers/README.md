# Wandering Tracers

The first reusable extraction from the Living Painting study. It preserves the fine tinted outlines, lifetime-seeded hatching, subtle body motion, and watercolor diffusion while separating motion from its consumers.

## Open a scene

- `composition.ts`: a quiet background with the reusable overlay composition.
- `painting-composition.ts`: the painting and tracer renderer consume the **same** path output. The painting changes regions after a tracer crosses them.
- `overlay.ts`: reusable image-input/image-output composition for the Library. Open this inside a scene that supplies its image input.

Submit the entry with its relative TypeScript dependencies as an SDK `0.4.0` source bundle. This needs a Studio build supporting `typed-image-graph-v1`; an older Studio that supports only image chains cannot run it.

## Components

| Component | Inputs | Outputs | Controls |
| --- | --- | --- | --- |
| Wandering Tracer Paths | None | `paths: paths2d` | Count, speed, curl, sway, seed, width, pace |
| Wandering Tracer Renderer | `image`, `paths` | Composited `image` | Contrast, hatching, bleed |
| Living Painting | `paths` | `image` | Painting's existing grouped controls |

The path generator is the single source of geometry. It produces at most four paths of 64 points. The renderer and painting support those same bounds and reject larger snapshots rather than silently losing a tracer or its head. The general SDK contract supports larger bounded snapshots for other components.

Coordinates use a centered canvas: height 1, width equal to aspect ratio, +X right, +Y up. `width` is full ribbon width. `distance` is cumulative arc distance. The last point is the growing head. `id` identifies the slot; `generation` and `styleSeed` distinguish successive lifetimes. Deposition timestamps remain scene seconds when artistic pace changes. A snapshot is immutable and can feed several consumers without duplicating the simulation.

Choose the overlay wrapper for a simple effect. Choose the separate generator and renderer when another component needs the same geometry. Graph displays those connections and exposes their individual controls. Wiring is currently declared in source.

Library publication uses three entries: **Wandering Tracer Paths** owns `paths.ts` and `tracer-state.ts`; **Wandering Tracer Renderer** owns `renderer.ts`, `tracer-texture.ts`, and `tracer-spline.ts`; **Wandering Tracers** owns only `overlay.ts` and pins the other two as dependencies mounted at `generator` and `renderer`. The published overlay imports `./generator/paths.ts` and `./renderer/renderer.ts`. A scene can link either leaf independently or use the complete composition. Scene builds and saves do not publish Library changes automatically.

## Limits

This milestone has explicit image and path connections. Flow fields, obstacles, arbitrary events, feedback, and interactive graph rewiring are not implemented.

Await each `evaluation.render` before starting another render in the same evaluation. Multiple named image outputs are supported sequentially.

## Verification

`node --test examples/components/wandering-tracers/*.test.ts` checks geometry/data behavior. `node scripts/test-wandering-tracers.mjs painting` (or `overlay`, `library`, `independent-wrapper`, `independent-direct`) launches an isolated actual Studio instance, captures it, and checks save/open and invalid-edit preservation. Build Studio first with `node apps/studio/build.mjs`. These are separate bounded scenarios to fit the test host's lifetime.

Known prototype limit: if a tracer exits and later re-enters the same region, its style transition can soften again while the head is inside. Cuts use the sampled polyline, while the visible ribbon is spline-smoothed.

## Organic Regions shader field

`regions.ts` is an independent Library leaf. It exposes Scale, Flowing bends, Region growth, Variation and Drift. Its output port is `shader-field` version 1, ABI `lux/organic-regions/v1`. A compatible consumer receives exactly:

- Fragments `regionGeometry` and `lpRegion` (source stays fixed for an instance).
- Values `growth`, `motion`, `scale`, `seed`, `warp` (live finite scalars).

`regionGeometry` is inserted in a fragment shader body after `p`, `seed`, and `t` are defined. It uses the original `form`, `music`, and `character` vectors, plus `lpPhrase`, `lpNoise`, `lpHash2` and `lpRegion`. It declares the region coordinates, owner/center, random identity, weighted cell planes, distance to edge and derivative-based pixel size used by subsequent paint and hatch code. `lpRegion` is the weighted moving-site helper; it relies on the original noise/hash/phrase basis. The complete consumer and vector packing are shown in `painting.ts`.

This is shader composition, so no region image is quantized or rendered in an extra pass. The exact ABI is deliberate: another renderer must provide the documented painting basis and insertion context. It is not a generic pre-rendered mask. Scene graph controls remain separate and the scene-wide aliases keep their earlier names.

## Region Hatching shader field

`hatching.ts` owns the unchanged `lpRegionMarks` function. ABI `lux/region-hatching/v1` supplies fragment `lpRegionMarks`, the nine original hatch control values, and the fixed `widthVar: 0.81` character value. The consumer retains the original vector packing shown in `painting.ts`.

The function uses the consumer's region owner, center, local coordinates, edge distance, seed, time, paint color, ink and composition vectors, and hash/noise/phrase helpers. It returns the color with the selected region's line family applied. Coverage determines where marks are absent; regional identity determines angle, spacing, width, curve family and occasional perpendicular crosshatching. This field can be reused by another compatible shader consumer with its own region data; it does not create regions itself.
