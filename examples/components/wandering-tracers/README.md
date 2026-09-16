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
| Organic Regions | None | `field: shader-field` | Scale, flow, growth, variation, drift |
| Region Hatching | None | `field: shader-field` | Coverage, spacing, bend, direction, ink weight and regional variety |
| Animated Watercolor | None | `field: shader-field` | Wash lightness, warm pools, contrast, pooling, blooms |
| Organic Boundary Ink | None | `field: shader-field` | Boundary width, warmth, hand-drawn character, grain |
| Composition Phrasing | None | `field: shader-field` | Pace, phrasing, tension, hierarchy, quiet-to-intricate balance |
| Region Styles & Split Transitions | `paths` and five shader fields | `image` | Uses upstream component controls |

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

## Animated Watercolor shader field

`watercolor.ts` supplies the `wash` fragment through ABI `lux/watercolor/v1`. It owns Wash lightness, Warm pools, Region contrast, Pigment pooling and Watercolor blooms. The consumer inserts the original wash code after region geometry, using the same seed, time, position, region owner/edge, noise/phrase basis and vector packing.

The field supplies the broad changing paint color. The Living Painting/styles consumer retains tracer-created daughter colors and their gradual transitions; the independent Tracer Renderer retains the visible ribbon and pigment bleed. Those connections let the shared paths affect the finished painting without duplicating the path simulation or changing the original mixing order.

## Organic Boundary Ink shader field

`boundary.ts` supplies the original `finish` block through ABI `lux/boundary-ink/v1`. It owns Boundary width, Warmth, Hand-drawn character and Grain. The block runs after the styles consumer has mixed its region colors and hatching, then draws the uneven cream boundary and adds stationary paper detail and the original final color conversion.

The consumer supplies region edge distance and derivatives, position/noise/seed, the current color and cream tone, and the original ink/character vectors. Hand-drawn character and ink warmth still feed the other region and hatching calculations through those shared vectors. No separate image pass is added.

## Composition Phrasing shader field

`phrasing.ts` publishes `lux/composition-phrasing/v1`. Its `lpPhrase` and
`noiseBasis` fragments provide the phrase function and deterministic hash/noise helpers
used by the compatible painting renderer. The renderer assembles these with the
other fields in one shader; this is not a separate image pass.

The component owns the artistic clock. Pace scales elapsed scene time, a paused
clock adds no time, backward scene time is clamped, and reset returns the artistic
clock to zero. It emits that time and the five live composition controls. Keeping
this state in one node lets all painting fields share the same musical phrasing.

The six numeric values are time, pace, phrasing, composition, tension, and hierarchy.
The compatible consumer inserts lpPhrase before lpRegion and noiseBasis after
lpRegion. WGSL permits later declarations; all fields use the same uniforms.

## Region Styles & Split Transitions

`painting.ts` is the terminal painting renderer. It accepts canvas-height
`paths2d` v1 plus the five exact field ABIs documented above. It preserves the
original region-side tests, gradual split reveal, daughter color/hatch identity,
and uneven pigment patches. It outputs one linear-sRGB premultiplied image.
Connect that image and the same paths to Wandering Tracer Renderer for visible ink.

This node has no duplicate controls: all 38 scene controls remain on the upstream
components and tracer renderer. The complete composition has eight leaf nodes
and two image passes. The fields require this compatible consumer contract;
they are not standalone image overlays.
