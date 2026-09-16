# Living Ornament batch 1 shader agreement

This agreement applies only to the new visual. Four existing producers add an `ornament` output with a new ABI. Their existing `field` snapshots (fragment bytes, value keys and values) stay unchanged. Every reached producer returns both declared outputs. The existing painting renderer and composition stay unchanged. A new Ornament Region Styles renderer consumes the four ornament outputs; it is a companion to the existing specialized painting renderer, whose required legacy inputs cannot be silently replaced.

## Geometry: Organic Regions

ABI `lux/ornament-regions/v1`; fragments exactly `{helpers}`; values exactly `{size,complexity,concavity,corridorWidth,nesting,motion,growth,seed}`.

WGSL helpers declare:
`struct LoRegion { identity:f32, parent:f32, edge:f32, age:f32, local:vec2f, tangent:vec2f }`
`fn loRegion(p:vec2f,t:f32,seed:f32,shape:vec4f,detail:vec4f)->LoRegion`

Coordinates: canvas center zero, positive x right, p spans [-aspect,aspect] x [-1,1]. shape=(size,complexity,concavity,corridorWidth); detail=(nesting,motion,growth,hierarchy). edge is nonnegative distance to the visible owning boundary, not hidden primitive seams. identity/parent are stable region IDs; local is attached region space, tangent is a unit preferred flow direction expressed in that same local coordinate frame, age defaults1 until structural events. Use layered analytic lobes, curved corridors, subtracted bays and nested islands; no repeated warped Voronoi grid. A deterministic foreground-to-background winner and nearest visible boundary keeps partitions fitted. Preserve calm boundary stretches. Work for seeds7,19,43 and wide aspect.

Add controls ornamentSize(default1,min0.6,max1.5), ornamentComplexity(default0.7,0..1.5), ornamentConcavity(default0.85,0..1.5), ornamentCorridorWidth(default0.11,0.03..0.25), ornamentNesting(default0.65,0..1), ornamentMotion(default0.15,0..1), ornamentGrowth(default0.25,0..1). Reuse existing seed. Group the new controls under Ornament Shape and Ornament Motion. Geometry helpers may call loHash/loHash2/loNoise/loFbm/loPhrase from Phrasing.

## Phrasing: Composition Phrasing

ABI `lux/ornament-phrasing/v1`; fragments exactly `{helpers}`; values exactly `{time,pace,phrasing,composition,tension,hierarchy}`. Helpers provide loHash(vec2f), loHash2(vec2f), loNoise(vec2f), loFbm(vec2f), loPhrase(vec2f,f32), equivalent to existing lp-prefixed functions. Own the same artistic clock, return legacy field unchanged. Root owns this edit.

## Color: Animated Watercolor

ABI `lux/ornament-watercolor/v1`; fragments exactly `{helpers}`; values exactly `{palette,warmth,contrast,pooling,blooms,saturation}`.
`fn loWash(r:LoRegion,p:vec2f,t:f32,pigment:vec4f,material:vec4f)->vec3f`
pigment=(palette,warmth,contrast,pooling); material=(blooms,saturation,quietBalance,0). Return linear-sRGB color. Aim for yellow anchors, pale pink/ivory quiet masses, blue/purple/teal supporting shapes and selective near-black areas reserved for future light motifs. Keep gentle pigment detail and shape-aware gradients. Add ornamentSaturation(default1,0..1.5); other values reuse existing controls. Preserve old wash exactly.

## Ink: Organic Boundary Ink

ABI `lux/ornament-boundary-ink/v1`; fragments exactly `{helpers}`; values exactly `{width,accent,handDrawn,grain}`.
`fn loFinish(color:vec3f,r:LoRegion,p:vec2f,ink:vec4f)->vec3f`
ink=(width,accent,handDrawn,grain). Bold near-black visible boundaries, optional teal/purple secondary edges, coherent uneven stroke and subtle paper grain. Add ornamentWidth(default0.008,min0.001,max0.025), ornamentAccent(default0.55,0..1); reuse handDrawn and grain. Use shared r.edge and derivative antialiasing; no hidden primitive seams. Preserve old finish exactly.

## Consumer and scene

New `ornament-renderer.ts`, metadata key `lux/ornament-region-styles`, label `Ornament Region Styles`. Inputs regions,watercolor,boundary,phrasing with exact above ABIs; image output; no duplicate controls. Assemble stable helper strings once and reject contract changes for the component instance. Update existing uniforms from values each frame. Use one paint pass. Main function first (wgslFn entry), helpers afterward. Keep actual shader readable.

New `ornament-composition.ts` uses four existing producers and the new renderer: five nodes, independent of the count fix. Expose useful new shape/ink controls plus palette/material/clock controls with organized inherited groups. Use stable UUIDs. No tracers or pattern detail in this batch. Source Library bundles must include helper files imported by their provider. New visual saved separately.
